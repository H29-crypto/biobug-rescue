import json
from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient
from connectome.morphology import parse_swc
from connectome.control import ControlEngine
from connectome.dynamics import Stimulus
from connectome.api import create_app
from connectome.loader import LoadedConnectome
from test_dynamics import engine, full_graph


def test_swc_parent_order_and_coordinates_are_preserved():
    points, segments, roots = parse_swc('# official comment\n2 0 4 5 6 1 1\n1 0 1 2 3 1 -1\n3 0 8 9 10 1 -1')
    assert roots == 2
    assert points.tolist() == [[4,5,6],[1,2,3],[8,9,10]]
    assert segments.tolist() == [[[1,2,3],[4,5,6]]]


@pytest.mark.parametrize('text', ['1 0 0 0 0 1 1', '1 0 0 0 0 1 -1\n2 0 0 0 0 1 99',
    '1 0 0 0 0 1 -1\n1 0 0 0 0 1 -1', '1 0 nan 0 0 1 -1', '1 0 0 0 0 -1 -1',
    '1.5 0 0 0 0 1 -1', '1 0 0 0 0 1 -1\n2 0 0 0 0 1 3\n3 0 0 0 0 1 2'])
def test_reject_malformed_swc(text):
    with pytest.raises(ValueError): parse_swc(text)


def test_optional_activity_is_same_evaluation_and_preserves_all_control_values(engine):
    control=ControlEngine(engine)
    for input in [Stimulus(),Stimulus(left=1),Stimulus(front=.7,right=.2),Stimulus(left=.1,front=.2,right=.3)]:
        old=control.evaluate(input)
        new=control.evaluate(input,include_activity=True)
        activity=new.pop('activity')
        old.pop('evaluation_seconds');new.pop('evaluation_seconds')
        assert old == new
        assert len(activity['values']) == len(engine.records)
        assert activity['body_ids'] == [str(r['bodyId']) for r in engine.records]
        for side in ['L','R']:
            i=activity['body_ids'].index(new['dna02'][side]['id'])
            assert activity['values'][i] == new['dna02'][side]['peak']


def test_activity_api_is_opt_in_and_evaluates_once(full_graph,monkeypatch):
    calls=[];original=ControlEngine.evaluate
    def counted(self,*args,**kwargs):calls.append(1);return original(self,*args,**kwargs)
    monkeypatch.setattr(ControlEngine,'evaluate',counted)
    with TestClient(create_app(loader=lambda _:LoadedConnectome(full_graph,{'dataset':'MaleCNS','version':'fixture'}))) as client:
        plain=client.post('/connectome/control',json={'left':1}).json()
        rich=client.post('/connectome/control?include_activity=true',json={'left':1}).json()
        assert len(calls)==2
        assert 'activity' not in plain and 'activity' in rich
        assert plain['dna02']==rich['dna02']


def test_acquired_manifest_binary_and_sources_match():
    root=Path(__file__).resolve().parents[2]
    path=root/'public/malecns/manifest.json'
    if not path.exists():pytest.skip('Run scripts/acquire_morphology.py for real asset validation')
    import hashlib
    m=json.loads(path.read_text())
    binary=(path.parent/'skeletons.bin').read_bytes()
    assert hashlib.sha256(binary).hexdigest()==m['binary']['sha256']
    rendered=np.frombuffer(binary,dtype='<f4').reshape(-1,2,3)
    assert len(rendered)==m['segment_count']
    for row in m['neurons']:
        assert row['available']
        raw=(root/row['swc_path']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==row['sha256']
        points,segments,_=parse_swc(raw.decode())
        assert len(points)==row['node_count'] and len(segments)==row['segment_count']
        expected=((segments-np.array(m['transform']['center_native']))*.008).astype('<f4')
        np.testing.assert_array_equal(rendered[row['segment_offset']:row['segment_offset']+row['segment_count']],expected)
