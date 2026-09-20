import pytest
from fastapi.testclient import TestClient
from test_dynamics import full_graph, engine
from connectome.control import ControlEngine
from connectome.dynamics import Stimulus, SimulationRequest, fingerprint
from connectome.loader import LoadedConnectome
from connectome.api import create_app
from connectome.dynamics import DynamicsEngine, build_dynamics_graph
from connectome.graph import ConnectomeGraph
from scipy.sparse import csr_matrix


@pytest.mark.parametrize('stimulus',[{}, {'left':1}, {'right':1}, {'front':1}, {'left':1,'right':1}, {'left':.23,'front':.77,'right':.41}])
def test_compact_control_matches_lab(engine, stimulus):
    controller = ControlEngine(engine)
    before = fingerprint(engine.graph.structural)
    reference = engine.simulate(SimulationRequest(stimulus=stimulus, steps=20, pulse_steps=3))
    result = controller.evaluate(Stimulus(**stimulus))
    for side in ('L','R'):
        assert result['dna02'][side]['peak'] == pytest.approx(reference['summary']['dna02'][side]['peak'], abs=1e-14)
        assert result['dna02'][side]['id'] == reference['summary']['dna02'][side]['id']
    assert fingerprint(engine.graph.structural) == before
    repeat = controller.evaluate(Stimulus(**stimulus))
    assert repeat['dna02'] == result['dna02']
    assert controller.evaluate(Stimulus())['dna02']['L']['peak'] == 0


def test_control_api_reuses_engine_validates_and_reports_real_metadata(full_graph):
    loaded = LoadedConnectome(full_graph, {'dataset':'MaleCNS','version':'fixture'})
    app = create_app(loader=lambda _: loaded)
    with TestClient(app) as client:
        r = client.post('/connectome/control',json={'left':1})
        assert r.status_code == 200 and r.json()['version'] == 'fixture'
        engine = app.state.control_engine
        r2 = client.post('/connectome/control',json={}).json()
        assert app.state.control_engine is engine
        assert r2['dna02']['L']['peak'] == r2['dna02']['R']['peak'] == 0
        assert r2['graph']['edges'] == engine.engine.graph.structural.adjacency.nnz
        network = client.get('/connectome/control-network').json()
        assert len(network['nodes']) == r2['graph']['neurons']
        assert len(network['edges']) == r2['graph']['edges']
        for edge in network['edges']:
            assert edge['structural_contacts'] == full_graph.edge(int(edge['source']), int(edge['target']))
            assert 0 <= edge['engineering_weight'] <= 1
        assert client.post('/connectome/control',json={'left':2}).status_code == 422
        assert client.post('/connectome/control',json={'sign_mode':'predicted'}).status_code == 422
        assert client.options('/connectome/control',headers={'Origin':'http://127.0.0.1:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}).status_code == 200


def test_control_missing_backend():
    def unavailable(_): raise ValueError('Missing data')
    with TestClient(create_app(loader=unavailable)) as client:
        assert client.post('/connectome/control',json={}).status_code == 503


def test_readout_requires_structural_routes(full_graph, engine):
    intact = ControlEngine(engine).evaluate(Stimulus(left=1))
    disconnected = ConnectomeGraph(full_graph.neurons, full_graph.body_ids.copy(), csr_matrix(full_graph.adjacency.shape))
    absent = ControlEngine(DynamicsEngine(build_dynamics_graph(disconnected))).evaluate(Stimulus(left=1))
    assert intact['dna02']['L']['peak'] > 0
    assert absent['dna02']['L']['peak'] == absent['dna02']['R']['peak'] == 0
    assert absent['input_active'] > 0  # Input alone cannot manufacture a DNa02 readout.


def test_swarm_batch_is_bounded_independent_and_matches_single_api(full_graph):
    app=create_app(loader=lambda _:LoadedConnectome(full_graph,{'dataset':'MaleCNS','version':'fixture'}))
    with TestClient(app) as client:
        agents=[{'id':str(i),'stimulus':{'left': i/7}} for i in range(8)]
        result=client.post('/connectome/control-batch',json={'agents':agents})
        assert result.status_code==200
        assert [r['id'] for r in result.json()['results']]==[a['id'] for a in agents]
        cached=app.state.control_engine
        for a,r in zip(agents,result.json()['results']):
            single=client.post('/connectome/control',json=a['stimulus']).json()
            assert single['dna02']==r['response']['dna02']
            assert single['graph']==r['response']['graph']
        assert app.state.control_engine is cached
        for invalid in [[],agents+[{'id':'extra','stimulus':{}}],[agents[0],agents[0]],[{'id':'a','stimulus':{'left':2}}]]:
            assert client.post('/connectome/control-batch',json={'agents':invalid}).status_code==422


def test_batch_missing_dataset():
    def fail(_): raise ValueError('offline')
    with TestClient(create_app(loader=fail)) as client:
        assert client.post('/connectome/control-batch',json={'agents':[{'id':'one','stimulus':{}}]}).status_code==503
