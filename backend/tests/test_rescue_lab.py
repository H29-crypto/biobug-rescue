import copy
from fastapi.testclient import TestClient
from test_dynamics import full_graph
from connectome.api import create_app
from connectome.loader import LoadedConnectome


def test_rescue_batch_activity_matches_original_control_and_uses_one_evaluation(full_graph, monkeypatch):
    app = create_app(loader=lambda _: LoadedConnectome(full_graph, {'dataset': 'MaleCNS', 'version': 'fixture'}))
    with TestClient(app) as client:
        agents = [{'id': str(i), 'stimulus': {'left': i / 7, 'right': (7 - i) / 7}} for i in range(8)]
        normal = client.post('/connectome/control-batch', json={'agents': agents}).json()['results']
        engine = app.state.control_engine
        original = engine.evaluate
        calls = []
        def counted(stimulus, **options):
            calls.append(stimulus)
            return original(stimulus, **options)
        monkeypatch.setattr(engine, 'evaluate', counted)
        result = client.post('/connectome/control-batch?include_activity=true', json={'agents': agents})
        assert result.status_code == 200
        assert len(calls) == 8
        for before, after in zip(normal, result.json()['results']):
            assert before['id'] == after['id']
            response = copy.deepcopy(after['response'])
            activity = response.pop('activity')
            before['response'].pop('evaluation_seconds')
            response.pop('evaluation_seconds')
            assert response == before['response']
            assert len(activity['values']) == response['graph']['neurons']
            for side in ('L', 'R'):
                index = activity['body_ids'].index(response['dna02'][side]['id'])
                assert activity['values'][index] == response['dna02'][side]['peak']
