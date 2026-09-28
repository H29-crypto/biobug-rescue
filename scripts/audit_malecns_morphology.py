"""Read-only morphology availability audit; does not download or implement a viewer.

Run from the project root with backend/.venv/Scripts/python.
Reuses the verified release loader and existing controller selection, unchanged.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import pyarrow as pa

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'backend'))
from connectome.loader import load_connectome
from connectome.dynamics import build_dynamics_graph
from connectome.graph import json_value


def run():
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    before = {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in tracked if p}
    data = ROOT/'backend/data'
    files = [{'name': p.name, 'bytes': p.stat().st_size} for p in sorted(data.rglob('*')) if p.is_file()]
    geometry_candidates = [x['name'] for x in files if
                           Path(x['name']).suffix.lower() in {'.swc', '.obj', '.ply', '.stl', '.glb', '.gltf'}
                           or any(word in x['name'].lower() for word in ('skeleton', 'mesh', 'syn-points', 'syn-partners'))]
    assert not geometry_candidates, ('New anatomical data requires a fresh content audit; refusing to reuse the absent-data conclusion: ' + str(geometry_candidates))
    schemas = {}
    for p in data.glob('*.feather'):
        with pa.OSFile(str(p), 'rb') as stream:
            reader = pa.ipc.open_file(stream)
            schemas[p.name] = {f.name: str(f.type) for f in reader.schema}
    meta = json.loads((data/'Neuprint_Meta_debug.json').read_text(encoding='utf-8'))
    print('Fresh checksum-verified load and unchanged controller selection...', flush=True)
    loaded = load_connectome()
    controller = build_dynamics_graph(loaded.graph)
    graph = controller.structural
    records = json_value(graph.neurons.to_pylist())
    populations = {}
    all_rows = []
    base = 'https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/'
    for name, mask in [('ProLN', controller.source_mask),
                       ('intermediate', ~controller.source_mask & ~controller.target_mask),
                       ('DNa02', controller.target_mask)]:
        rows = [r for r, keep in zip(records, mask) if keep]
        populations[name] = {'count': len(rows), 'ids': [r['bodyId'] for r in rows],
                             'somaLocation_count': sum(r['somaLocation'] is not None for r in rows),
                             'tosomaLocation_count': sum(r['tosomaLocation'] is not None for r in rows),
                             'local_skeleton_count': 0}
        for r in rows:
            all_rows.append({k: r[k] for k in ['bodyId', 'type', 'class', 'superclass', 'entryNerve', 'rootSide', 'somaSide', 'somaLocation', 'tosomaLocation']} |
                            {'population': name, 'official_swc_candidate_url': base+str(r['bodyId'])+'.swc',
                             'remote_file_verified': False})
    assert (len(records), graph.adjacency.nnz, int(graph.adjacency.sum())) == (295, 280, 2308)
    assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest() == value for p, value in before.items())
    evidence = {'dataset': 'MaleCNS', 'version': loaded.report['version'], 'local_files': files,
                'local_feather_schemas': schemas, 'metadata_keys': list(meta),
                'metadata_roi_examples': dict(list(meta.get('roiInfo', {}).items())[:2]),
                'voxel_size': loaded.report['voxel_size'], 'voxel_units': loaded.report['voxel_units'],
                'controller': controller.summary(), 'populations': populations, 'neurons': all_rows,
                'sources_verified': loaded.report['sources'],
                'verification_seconds': loaded.report['load_seconds'],
                'existing_tracked_files_unchanged': True, 'tracked_files_checked': len(before),
                'availability': {'local_skeletons': False, 'local_neurite_morphology': False,
                                 'local_meshes': False, 'local_synapse_coordinates': False,
                                 'local_reference_geometry': False,
                                 'body_id_naming_supported_by_official_documentation': True,
                                 'all_295_remote_morphology_files_verified': False},
                'note': 'Soma points and ROI descriptions are not skeletons, meshes, or neurite paths. Candidate URLs follow official same-release body-ID naming; no remote morphology files downloaded or individually verified.'}
    (ROOT/'docs/MALECNS_MORPHOLOGY_AUDIT.json').write_text(json.dumps(evidence, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps({'controller': {'neurons': len(records), 'edges': graph.adjacency.nnz, 'contacts': int(graph.adjacency.sum())},
                      'populations': {k: {field: value for field, value in v.items() if field != 'ids'} for k, v in populations.items()},
                      'metadata_keys': list(meta), 'existing_tracked_files_unchanged': True}, indent=2))


if __name__ == '__main__':
    run()
