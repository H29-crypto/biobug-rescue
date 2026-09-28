"""Additional read-only audit and independent checks of Digital Fly evidence.

Run digital_fly_audit.py first; uses only its verified-data sparse cache.
Does not run or change any neural model or application behavior.
"""
from pathlib import Path
import json
import re
import time
import hashlib
from collections import Counter
import numpy as np
import pyarrow.feather as feather
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]


def run():
    docs = ROOT / 'docs'
    audit = json.loads((docs / 'DIGITAL_FLY_AUDIT.json').read_text(encoding='utf-8'))
    pathways = json.loads((docs / 'DIGITAL_FLY_PATHWAYS.json').read_text(encoding='utf-8'))
    table = feather.read_table(ROOT / 'work/digital-fly/selected-neurons.feather')
    graph = sparse.load_npz(ROOT / 'work/digital-fly/selected-graph.npz')
    ids = table['bodyId'].to_numpy()
    n = len(ids)
    index = {int(body): i for i, body in enumerate(ids)}
    col = {name: np.array(table[name].to_pylist(), dtype=object) for name in
           ['type', 'superclass', 'class', 'subclass', 'rootSide', 'somaSide', 'entryNerve', 'consensus_nt']}
    masks = {}
    for name, pop in audit['populations'].items():
        mask = np.zeros(n, bool)
        mask[[index[x] for x in pop['ids']]] = True
        masks[name] = mask

    # Independently prune sparse layer matrices to validate ALL route union totals.
    validations = []
    for chain in pathways['chains']:
        stages = chain['stages']
        layers = [np.flatnonzero(masks[stage]) for stage in stages]
        matrices = []
        for left, right in zip(layers, layers[1:]):
            mat = graph[left, :][:, right].copy()
            mat.data[mat.data < chain['min_edge_contacts']] = 0
            mat.eliminate_zeros()
            matrices.append(mat)
        forward = [np.ones(len(layers[0]), bool)]
        for mat in matrices:
            forward.append(np.asarray(mat.T @ forward[-1]).ravel() > 0)
        backward = [np.ones(len(layers[-1]), bool)]
        for mat in reversed(matrices):
            backward.append(np.asarray(mat @ backward[-1]).ravel() > 0)
        backward.reverse()
        codes = []
        for j, mat in enumerate(matrices):
            coo = mat.tocoo()
            keep = forward[j][coo.row] & backward[j+1][coo.col]
            codes.append(layers[j][coo.row[keep]].astype(np.int64)*n + layers[j+1][coo.col[keep]])
        code = np.unique(np.concatenate(codes))
        row, dest = code//n, code % n
        values = np.asarray(graph[row, dest]).ravel()
        node_ids = ids[np.unique(np.concatenate([row, dest]))]
        assert (len(node_ids), len(code), int(values.sum())) == (chain['neurons'], chain['edges'], chain['contacts'])
        if 'participating_ids' in chain:
            assert sorted(map(int, node_ids)) == sorted(chain['participating_ids'])
        witness = chain['strongest_by_maximum_bottleneck']
        path = [index[x['bodyId']] for x in witness['neurons']]
        assert all(masks[stage][ix] for stage, ix in zip(stages, path))
        contacts = [int(graph[a, b]) for a, b in zip(path, path[1:])]
        assert contacts == witness['edge_contacts']
        assert min(contacts) == witness['bottleneck'] >= chain['min_edge_contacts']
        validations.append({'stages': stages, 'threshold': chain['min_edge_contacts'], 'totals_and_witness_valid': True})

    aliases = {}
    alias_cols = ['type', 'synonyms', 'mancType', 'flywireType', 'matchingNotes']
    records = table.select(['bodyId', *alias_cols]).to_pylist()
    for term in ['claw', 'hook', 'club', 'BPN', 'BRK', 'BB', 'FG', 'oDN1', 'BDN2', 'MAN']:
        pattern = re.compile(r'(?<![A-Za-z0-9])'+re.escape(term)+r'(?![A-Za-z0-9])', re.I)
        matches = [r for r in records if any(pattern.search(r[field] or '') for field in alias_cols)]
        aliases[term] = {'count': len(matches), 'matches': matches}
    def counts(values):
        return dict(Counter('(missing)' if x is None else str(x) for x in values))
    stats = {}
    indegree = np.bincount(graph.indices, minlength=n)
    outdegree = np.diff(graph.indptr)
    for name in ['tactile', 'proprioceptive', 'chordotonal', 'visual', 'olfactory', 'descending', 'vnc_intrinsic', 'vnc_motor', 'leg_motor']:
        selected = masks[name]
        stats[name] = {'no_incoming_selected_edges': int((selected & (indegree == 0)).sum()),
                       'no_outgoing_selected_edges': int((selected & (outdegree == 0)).sum()),
                       'fully_isolated_selected_graph': int((selected & (indegree == 0) & (outdegree == 0)).sum())}
    to_motor = graph[:, masks['leg_motor']].copy()
    to_motor.data[to_motor.data < 5] = 0
    to_motor.eliminate_zeros()
    premotor = masks['vnc_intrinsic'] & (np.diff(to_motor.indptr) > 0)
    premotor_stats = {'definition': 'vnc_intrinsic with >=1 direct edge of >=5 contacts to a selected leg motor neuron; structural premotor candidate, not physiological validation',
                     'neurons': int(premotor.sum()), 'edges': to_motor[premotor, :].nnz,
                     'contacts': int(to_motor[premotor, :].sum()), 'ids': [int(x) for x in ids[premotor]]}
    small = []
    for chain in pathways['chains']:
        if 'participating_ids' not in chain: continue
        ix = np.array([index[x] for x in chain['participating_ids']])
        mat = graph[ix, :][:, ix]
        x = np.random.default_rng(2026).random(len(ix))
        timings = []
        for attempt in range(110):
            start = time.perf_counter()
            mat.T @ x
            if attempt >= 10: timings.append(time.perf_counter()-start)
        input_contacts = int(graph[:, ix].sum())
        output_contacts = int(graph[ix, :].sum())
        internal = int(mat.sum())
        small.append({'stages': chain['stages'], 'neurons': len(ix), 'induced_edges': mat.nnz,
                      'induced_contacts': internal, 'csr_bytes': mat.data.nbytes + mat.indices.nbytes + mat.indptr.nbytes,
                      'median_kernel_seconds': float(np.median(timings)), 'p95_kernel_seconds': float(np.quantile(timings, .95)),
                      'all_incoming_contacts': input_contacts, 'external_incoming_contacts': input_contacts-internal,
                      'fraction_incoming_contacts_retained': internal/input_contacts,
                      'all_outgoing_contacts': output_contacts, 'external_outgoing_contacts': output_contacts-internal,
                      'fraction_outgoing_contacts_retained': internal/output_contacts,
                      'superclasses': counts(col['superclass'][ix]), 'rootSide': counts(col['rootSide'][ix]),
                      'somaSide': counts(col['somaSide'][ix]), 'consensus_nt': counts(col['consensus_nt'][ix])})
    motor_mapping = []
    for i in np.flatnonzero(masks['tibia_motor_fl_L']):
        motor_mapping.append(table.slice(int(i), 1).to_pylist()[0])
    nt_disagreements = {}
    for name in ['leg_motor', 'vnc_motor', 'tibia_motor_fl_L']:
        ix = np.flatnonzero(masks[name])
        nt_disagreements[name] = {'consensus_nt': counts(col['consensus_nt'][ix]),
                                 'types': counts(col['type'][ix]), 'somaSide': counts(col['somaSide'][ix])}
    saved = json.loads((docs/'DIGITAL_FLY_RESEARCH_INTEGRITY.json').read_text(encoding='utf-8'))
    assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest() == digest for p, digest in saved['sha256'].items())
    report = {'route_checks': validations, 'alias_search': aliases, 'degree_gaps': stats,
              'premotor_candidates': premotor_stats, 'small_subgraphs': small,
              'front_left_tibia_motors': motor_mapping, 'motor_annotation_audit': nt_disagreements,
              'existing_tracked_files_unchanged': True}
    (docs/'DIGITAL_FLY_SUPPLEMENT.json').write_text(json.dumps(report, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print('Validated', len(validations), 'route unions and all witness edges; existing tracked files unchanged.')
    print('Alias match counts:', {key: value['count'] for key, value in aliases.items()})
    print('Premotor:', {k: v for k, v in premotor_stats.items() if k != 'ids'})
    for item in small: print('Small subgraph:', item)


if __name__ == '__main__':
    run()
