import os
import pytest
from fastapi.testclient import TestClient
from connectome.api import create_app
from connectome.loader import load_connectome

@pytest.mark.integration
@pytest.mark.skipif(os.environ.get('MALECNS_INTEGRATION')!='1',reason='Set MALECNS_INTEGRATION=1 for downloaded release')
def test_official_release_end_to_end():
    loaded=load_connectome();g=loaded.graph
    assert loaded.report['neurons']==len(g.body_ids)>100000
    assert loaded.report['edges']==g.adjacency.nnz>1000000
    assert loaded.report['validation']['status']=='passed_with_scope_notes'
    body=int(g.body_ids[0]);assert g.neuron(body)['bodyId']==body
    neighbors=g.outgoing(body,limit=3);assert len(neighbors['body_post'])>0
    post=int(neighbors['body_post'][0]);contacts=int(neighbors['weight'][0])
    assert g.edge(body,post)==contacts and g.subgraph([body,post]).edge(body,post)==contacts
    with TestClient(create_app(loader=lambda _:loaded)) as client:
        assert client.get('/connectome/status').json()['edges']==g.adjacency.nnz
        assert client.get(f'/connectome/edges/{body}/{post}').json()['synaptic_contacts']==contacts
