"""Official MaleCNS SWC acquisition and lossless segment export. No neural dynamics."""
from __future__ import annotations
import hashlib
import io
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/'


def parse_swc(text: str):
    values = np.loadtxt(io.StringIO(text), comments='#', ndmin=2)
    if values.shape[1] != 7 or not len(values) or not np.isfinite(values).all():
        raise ValueError('Expected nonempty finite seven-column SWC')
    if not np.equal(values[:, [0, 1, 6]], np.floor(values[:, [0, 1, 6]])).all():
        raise ValueError('Node IDs, types and parent IDs must be integers')
    ids = values[:, 0].astype(np.int64)
    parents = values[:, 6].astype(np.int64)
    if len(np.unique(ids)) != len(ids) or (ids <= 0).any() or (values[:, 5] < 0).any():
        raise ValueError('Duplicate/nonpositive IDs or negative radii')
    mapping = {int(x): i for i, x in enumerate(ids)}
    if not (parents == -1).any() or any(p != -1 and p not in mapping for p in parents):
        raise ValueError('Missing root or parent')
    parent_index = np.array([-1 if p == -1 else mapping[int(p)] for p in parents])
    visited = np.zeros(len(ids), np.uint8)
    for start in range(len(ids)):
        node = start
        trail = []
        while node >= 0 and visited[node] == 0:
            visited[node] = 1
            trail.append(node)
            node = parent_index[node]
        if node >= 0 and visited[node] == 1:
            raise ValueError('Cycle in skeleton parents')
        visited[trail] = 2
    child = np.flatnonzero(parent_index >= 0)
    positions = values[:, 2:5]
    segments = np.stack([positions[parent_index[child]], positions[child]], axis=1)
    return positions, segments, int((parents == -1).sum())


def acquire():
    started = time.perf_counter()
    audit = json.loads((ROOT/'docs/MALECNS_MORPHOLOGY_AUDIT.json').read_text(encoding='utf-8'))
    raw = ROOT/'backend/data/morphology/v1.0'
    public = ROOT/'public/malecns'
    raw.mkdir(parents=True, exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    def download(record):
        body = record['bodyId']
        path = raw/f'{body}.swc'
        row = {'body_id': str(body), 'population': record['population'], 'type': record['type'],
               'annotation': {'class': record['class'], 'superclass': record['superclass'], 'entryNerve': record['entryNerve'],
                              'rootSide': record['rootSide'], 'somaSide': record['somaSide']},
               'swc_path': str(path.relative_to(ROOT)).replace('\\', '/'), 'url': SOURCE+f'{body}.swc',
               'available': False, 'node_count': 0, 'segment_count': 0, 'bounding_box': None}
        try:
            if not path.exists():
                for attempt in range(3):
                    try:
                        with urllib.request.urlopen(row['url'], timeout=45) as response:
                            content = response.read(20_000_001)
                        if len(content) > 20_000_000: raise ValueError('Unexpected SWC size >20 MB')
                        parse_swc(content.decode('utf-8'))
                        path.write_bytes(content)
                        break
                    except Exception:
                        if attempt == 2: raise
                        time.sleep(attempt+1)
            content = path.read_bytes()
            points, segments, roots = parse_swc(content.decode('utf-8'))
            row.update(available=True, node_count=len(points), segment_count=len(segments), roots=roots,
                       bounding_box={'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()},
                       bytes=len(content), sha256=hashlib.sha256(content).hexdigest(),
                       source_header=[line for line in content.decode('utf-8').splitlines() if line.startswith('#')])
            return row, segments
        except Exception as error:
            row['error'] = f'{type(error).__name__}: {error}'
            return row, None
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(download, audit['neurons']))
    rows = [x[0] for x in results]
    available = [x for x in results if x[0]['available']]
    if not available: raise RuntimeError('No official skeletons available; stopping')
    lo = np.min([r['bounding_box']['min'] for r, _ in available], axis=0)
    hi = np.max([r['bounding_box']['max'] for r, _ in available], axis=0)
    center = (lo+hi)/2
    # Native 8 nm units -> micrometers; identity axis transform, common center.
    offset = 0
    buffers = []
    for row, segments in results:
        row['segment_offset'] = offset
        if segments is not None:
            buffers.append(((segments-center)*.008).astype('<f4').ravel())
            offset += len(segments)
    binary = np.concatenate(buffers).tobytes()
    # Metadata only: use exact same controller selection; no new neural evaluation.
    from .loader import load_connectome
    from .dynamics import build_dynamics_graph
    print(f'Downloaded/parsed {len(available)}/295 skeletons; verifying controller metadata...', flush=True)
    graph = build_dynamics_graph(load_connectome().graph)
    if graph.structural_sha256 != audit['controller']['structural_sha256']:
        raise ValueError('Controller identity changed; no morphology assets published')
    if len(rows) != 295 or {int(r['body_id']) for r in rows} != set(graph.structural.body_ids.tolist()):
        raise ValueError('Morphology IDs do not exactly match the controller')
    for row in rows:
        ix = graph.structural.index(int(row['body_id']))
        incoming = graph.structural.adjacency[:, ix]
        outgoing = graph.structural.adjacency[ix, :]
        row.update(incoming_edges=incoming.nnz, outgoing_edges=outgoing.nnz,
                   incoming_contacts=int(incoming.sum()), outgoing_contacts=int(outgoing.sum()))
    manifest = {'dataset': 'MaleCNS', 'version': 'v1.0', 'license': 'CC-BY-4.0',
                'source': 'https://male-cns.janelia.org/download/', 'requested': 295,
                'available': len(available), 'graph_sha256': graph.structural_sha256,
                'structural_scope': 'Existing 295-neuron, 280-edge, 2308-contact controller; not whole-CNS degrees',
                'transform': {'native_frame': 'MaleCNS EM, non-mirrored', 'native_unit_nm': 8,
                              'render_unit': 'micrometer', 'scale': .008, 'center_native': center.tolist(),
                              'axis_matrix': [[1,0,0],[0,1,0],[0,0,1]], 'formula': '(native_xyz - center_native) * 0.008'},
                'binary': {'file': 'skeletons.bin', 'dtype': 'little-endian float32', 'components_per_segment': 6,
                           'bytes': len(binary), 'sha256': hashlib.sha256(binary).hexdigest()},
                'node_count': sum(r['node_count'] for r in rows), 'segment_count': offset,
                'swc_bytes': sum(r.get('bytes', 0) for r in rows),
                'acquisition_and_verification_seconds': time.perf_counter()-started, 'neurons': rows}
    output = json.dumps(manifest, indent=2, allow_nan=False)+'\n'
    (public/'skeletons.bin').write_bytes(binary)
    (public/'manifest.json').write_text(output, encoding='utf-8')
    (ROOT/'docs/MALECNS_MORPHOLOGY_MANIFEST.json').write_text(output, encoding='utf-8')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ['neurons','transform']}, indent=2))


if __name__ == '__main__': acquire()
