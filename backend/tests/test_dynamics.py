"""Model invariants on tiny explicit graphs. Biological IDs come only from real-data runs."""
import json
import numpy as np
import pyarrow as pa
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from scipy.sparse import csr_matrix
from connectome.dynamics import (DynamicsEngine, SimulationParameters, SimulationRequest, Stimulus,
                                build_dynamics_graph, fingerprint, transmitter_sign)
from connectome.graph import ConnectomeGraph
from connectome.loader import LoadedConnectome
from connectome.api import create_app

@pytest.fixture
def full_graph():
    ids=np.array([1,2,3,4,5,6,7,8],dtype=np.int64)
    table=pa.table({'bodyId':ids,'type':['touchL','touchR','relayL','relayR','DNa02','DNa02','outside','touchUnknown'],
        'superclass':['vnc_sensory']*2+['vnc_intrinsic']*2+['descending_neuron']*2+['vnc_intrinsic','vnc_sensory'],
        'class':['mechanosensory_tactile']*2+['interneuron']*2+[None]*3+['mechanosensory_tactile'],
        'rootSide':['L','R',None,None,None,None,None,'unknown'],
        'somaSide':[None,None,'L','R','L','R','M',None],
        'entryNerve':['ProLN','ProLN',None,None,None,None,None,'ProLN'],
        'predicted_nt':['acetylcholine']*3+['gaba']+['acetylcholine']*2+['glutamate',None],
        'consensus_nt':['acetylcholine']*3+['gaba']+['acetylcholine']*2+['glutamate',None],
        'predicted_nt_confidence':[.99]*7+[None]})
    links=[(1,3,10),(2,4,20),(3,5,5),(3,6,2),(4,6,8),(4,5,1),(5,7,99),(7,5,100),(1,7,3)]
    a=csr_matrix(([w for _,_,w in links],([u-1 for u,_,_ in links],[v-1 for _,v,_ in links])),shape=(8,8))
    return ConnectomeGraph(table,ids,a)

@pytest.fixture
def engine(full_graph):
    return DynamicsEngine(build_dynamics_graph(full_graph))

def test_graph_union_exact_contacts_and_annotations(full_graph):
    before=fingerprint(full_graph)
    bounded=build_dynamics_graph(full_graph)
    # Includes all input IDs, two targets and every intermediate on a <=2-hop route.
    assert bounded.structural.body_ids.tolist()==[1,2,3,4,5,6,7,8]
    assert bounded.structural.adjacency.nnz==8
    assert bounded.structural.adjacency.data.sum()==149
    assert bounded.structural.edge(5,7)==0  # Not on a <=2-hop source->target walk.
    assert bounded.structural.neurons.equals(full_graph.neurons)
    assert fingerprint(full_graph)==before and full_graph.adjacency.data.flags.writeable
    with pytest.raises(ValueError): bounded.structural.adjacency.data[0]=123

def test_three_hops_union_has_actual_edges(full_graph):
    g=build_dynamics_graph(full_graph,3).structural
    for pre in g.body_ids:
        for post in g.body_ids:
            assert g.edge(int(pre),int(post)) in (0,full_graph.edge(int(pre),int(post)))
    with pytest.raises(ValueError): build_dynamics_graph(full_graph,4)

def test_source_target_annotation_validation(full_graph):
    broken=ConnectomeGraph(full_graph.neurons.set_column(full_graph.neurons.schema.get_field_index('somaSide'),'somaSide',pa.array([None]*8,type=pa.string())),full_graph.body_ids,full_graph.adjacency)
    with pytest.raises(ValueError,match='somaSide'): build_dynamics_graph(broken)

def test_zero_disabled_and_pulse_zero(engine):
    for request in [SimulationRequest(steps=200), SimulationRequest(stimulus={'left':1},injection_enabled=False), SimulationRequest(stimulus={'left':1},pulse_steps=0)]:
        response=engine.simulate(request)
        assert all(t['max_activity']==0 and t['active_neurons']==0 for t in response['trace'])
        assert response['summary']['dominant_intermediate_types']==[]

def test_temporal_direction_and_readout_metadata(engine):
    response=engine.simulate(SimulationRequest(stimulus={'left':1},steps=5,pulse_steps=1))
    assert response['trace'][1]['roles']['source']['sum']>.0
    assert response['trace'][1]['roles']['intermediate']['sum']==0
    assert response['trace'][2]['roles']['intermediate']['sum']>0
    assert response['trace'][2]['dna02']['L']['activation']==0
    assert response['trace'][3]['dna02']['L']['activation']>0
    assert response['readout_neurons']['L']['id']=='5'
    assert response['readout_neurons']['R']['id']=='6'
    assert response['readout_neurons']['L']['side_field']=='somaSide'
    assert all(n['id']!='7' for n in response['trace'][1]['top_neurons'])

def test_bounded_finite_deterministic_immutable(engine):
    request=SimulationRequest(stimulus={'left':1,'right':1,'front':1},steps=200,pulse_steps=200,parameters={'decay':.3,'gain':.29,'input_gain':1})
    before=fingerprint(engine.graph.structural)
    a,b=engine.simulate(request),engine.simulate(request)
    assert a['trace']==b['trace'] and a['summary']==b['summary']
    assert fingerprint(engine.graph.structural)==before
    for t in a['trace']:
        assert np.isfinite(t['max_activity']) and 0<=t['max_activity']<=1
        assert all(0<=n['activity']<=1 for n in t['top_neurons'])
    json.dumps(a,allow_nan=False)

def test_unsigned_monotonic_input(engine):
    low=engine.simulate(SimulationRequest(stimulus={'left':.1}))
    high=engine.simulate(SimulationRequest(stimulus={'left':1}))
    for a,b in zip(low['trace'],high['trace']):
        for side in ('L','R'): assert a['dna02'][side]['activation']<=b['dna02'][side]['activation']<=1

def test_injection_uses_root_side_only_and_front_half(engine):
    signal=engine.input_vector(Stimulus(front=1))
    assert signal.tolist()==[.5,.5,0,0,0,0,0,0]
    assert engine.input_vector(Stimulus(left=.8,front=.6))[0]==1
    assert engine.input_vector(Stimulus(left=1),False).sum()==0

@pytest.mark.parametrize('transform',['incoming_log','global_log'])
def test_weight_formula_and_separate_structural_counts(engine,transform):
    p=SimulationParameters(transformation=transform)
    original=engine.graph.structural.adjacency.data.copy()
    w,_=engine.simulation_weights(p)
    raw=engine.graph.structural.adjacency
    sums=np.asarray(sparse_log(raw).sum(axis=0)).ravel()
    e=0;post=w.indices[e]
    denom=max(1,sums[post]) if transform=='incoming_log' else max(1,max(sums))
    assert w.data[e]==pytest.approx(np.log1p(original[e])/denom)
    assert max(np.asarray(abs(w).sum(axis=0)).ravel())<=1+1e-12
    assert np.array_equal(original,raw.data)

def sparse_log(matrix):
    a=matrix.astype(float);a.data=np.log1p(a.data);return a

@pytest.mark.parametrize('nt,confidence,pred,expected',[
 ('acetylcholine',.9,'acetylcholine',1),('gaba',.9,'gaba',-1),
 ('glutamate',.99,'glutamate',0),('dopamine',.99,'dopamine',0),
 ('gaba',.79,'gaba',0),('gaba',.99,'acetylcholine',0),(None,None,None,0),('gaba',float('nan'),'gaba',0)])
def test_sign_rules(nt,confidence,pred,expected):
    r={'consensus_nt':nt,'predicted_nt':pred,'predicted_nt_confidence':confidence}
    assert transmitter_sign(r,SimulationParameters(sign_mode='predicted'))[0]==expected
    assert transmitter_sign(r,SimulationParameters())[0]==1

def test_explicit_unknown_positive_fallback():
    assert transmitter_sign({},SimulationParameters(sign_mode='predicted',unknown_sign='positive'))[0]==1

def test_inhibitory_rule_changes_simulation_not_structure(engine):
    unsigned=engine.simulate(SimulationRequest(stimulus={'right':1}))
    signed=engine.simulate(SimulationRequest(stimulus={'right':1},parameters={'sign_mode':'predicted'}))
    assert unsigned['summary']['dna02']['R']['peak']>signed['summary']['dna02']['R']['peak']
    assert signed['summary']['structural_unchanged']

@pytest.mark.parametrize('kwargs',[{'steps':0},{'steps':201},{'steps':1.5},{'stimulus':{'left':float('nan')}},{'stimulus':{'front':2}},{'parameters':{'gain':.3,'decay':.2}},{'parameters':{'decay':0}},{'parameters':{'transformation':'raw'}},{'pulse_steps':-1},{'top_k':21},{'hops':3}])
def test_reject_invalid_requests(kwargs):
    with pytest.raises(ValidationError): SimulationRequest(**kwargs)

def test_api_stateless_bounded_serialization_and_cors(full_graph):
    loaded=LoadedConnectome(full_graph,{'dataset':'MaleCNS','version':'fixture'})
    with TestClient(create_app(loader=lambda _:loaded)) as client:
        response=client.post('/connectome/simulate',json={'stimulus':{'left':1},'steps':6})
        assert response.status_code==200
        data=response.json();assert data['version']=='fixture' and len(data['trace'])==7
        assert data['summary']['structural_unchanged']
        assert data['performance']['cold_graph_build']
        assert len(data['weight_examples'])<=20
        zero=client.post('/connectome/simulate',json={'stimulus':{}}).json()
        assert zero['summary']['peak_active_neurons']==0  # Previous run never leaks state.
        assert not zero['performance']['cold_graph_build']
        assert client.post('/connectome/simulate',json={'steps':300}).status_code==422
        preflight=client.options('/connectome/simulate',headers={'Origin':'http://127.0.0.1:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
        assert preflight.status_code==200

def test_api_missing_data():
    def fail(_): raise ValueError('missing real data')
    with TestClient(create_app(loader=fail)) as client:
        assert client.post('/connectome/simulate',json={}).status_code==503
