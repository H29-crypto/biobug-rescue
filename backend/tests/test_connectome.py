import json
import numpy as np
import pyarrow as pa
import pyarrow.feather as feather
import pytest
from fastapi.testclient import TestClient
from scipy import sparse
from connectome.api import create_app
from connectome.download import verify_file
from connectome.edges import load_edges
from connectome.metadata import load_metadata,source_paths
from connectome.neurons import load_neurons
from connectome.validation import validate_counts

def test_parsing_and_selection(loaded):
    g=loaded.graph
    assert g.body_ids.tolist()==[10,20,30]
    assert g.neuron(10)['predicted_nt']=='acetylcholine'
    assert g.neuron(20)['predicted_nt']=='gaba'
    assert g.neuron(30)['predicted_nt'] is None
    assert g.neuron(10)['somaLocation']==[4,5,6]
    assert loaded.report['source_statistics']['annotation_body_records']==5
    assert loaded.report['source_statistics']['neurons_missing_nt_record']==1
    assert loaded.report['annotations']['types']==['A','B','C']

def test_sparse_graph_direction_duplicates_and_isolates(loaded):
    g=loaded.graph
    assert sparse.isspmatrix_csr(g.adjacency) and g.adjacency.shape==(3,3)
    assert g.adjacency.nnz==2 and g.adjacency.dtype==np.int64
    assert g.edge(10,20)==5 and g.edge(20,10)==1 and g.edge(10,30)==0
    assert loaded.report['isolated_neurons']==1
    assert loaded.report['source_statistics']['duplicate_selected_pairs_coalesced']==1
    assert loaded.report['source_statistics']['excluded_synaptic_contacts']==4
    assert loaded.report['synaptic_contacts']==6

def test_lookup_and_query(loaded):
    g=loaded.graph
    assert g.find_neurons(neuron_type='A')['bodyId'].to_pylist()==[10]
    assert g.find_neurons(neuron_type='absent').num_rows==0
    for body in [0,40,999]:
        with pytest.raises(KeyError): g.neuron(body)
    with pytest.raises(KeyError): g.edge(10,999)
    assert g.outgoing(10)['body_post'].tolist()==[20]
    with pytest.raises(ValueError): g.find_neurons(limit=0)

def test_subgraph_mapping(loaded):
    g=loaded.graph.subgraph([20,10])
    assert g.body_ids.tolist()==[10,20]
    assert g.edge(10,20)==5 and g.edge(20,10)==1
    assert loaded.graph.subgraph([30]).adjacency.nnz==0
    assert loaded.graph.subgraph([]).adjacency.shape==(0,0)
    with pytest.raises(ValueError): loaded.graph.subgraph([10,10])
    with pytest.raises(KeyError): loaded.graph.subgraph([999])

@pytest.mark.parametrize('weights',[[-1],[0],[None],[1.5]])
def test_invalid_weights(tmp_path,weights):
    path=tmp_path/'bad.feather'
    feather.write_feather(pa.table({'body_pre':[10],'body_post':[20],'weight':weights}),path)
    with pytest.raises(ValueError): load_edges(path,np.array([10,20]))

def test_missing_columns(tmp_path):
    path=tmp_path/'bad.feather'
    feather.write_feather(pa.table({'body_pre':[10],'weight':[1]}),path)
    with pytest.raises(ValueError,match='missing columns'): load_edges(path,np.array([10,20]))

def test_large_integer_ids(tmp_path):
    ids=np.array([2**54+1,2**54+3],dtype=np.int64)
    path=tmp_path/'large.feather'
    feather.write_feather(pa.table({'body_pre':[int(ids[0])],'body_post':[int(ids[1])],'weight':[4]}),path)
    g,stats=load_edges(path,ids)
    assert g[0,1]==4 and stats['source_synaptic_contacts']==4

def test_duplicate_annotations(dataset):
    paths=source_paths(*dataset)
    table=feather.read_table(paths['annotations'])
    table=table.set_column(table.schema.get_field_index('bodyId'),'bodyId',pa.array([10,10,20,40,50]))
    feather.write_feather(table,paths['annotations'])
    with pytest.raises(ValueError,match='Duplicate'): load_neurons(paths['annotations'],paths['neurotransmitters'])

def test_checksum_and_missing_source(dataset):
    directory,manifest=dataset
    source=manifest['files'][0];path=directory/source['filename']
    content=bytearray(path.read_bytes());content[30]^=1;path.write_bytes(content)
    with pytest.raises(ValueError,match='Checksum'): verify_file(path,source)
    path.unlink()
    with pytest.raises(FileNotFoundError): verify_file(path,source)

def test_metadata_version(dataset):
    path=source_paths(*dataset)['metadata']
    metadata=json.loads(path.read_text());metadata['tag']='v0.9';path.write_text(json.dumps(metadata))
    with pytest.raises(ValueError,match='dataset/version'): load_metadata(path,dataset[1])

def test_discrepancies_are_reported(loaded,dataset):
    assert loaded.report['validation']['status']=='passed_with_scope_notes'
    r=loaded.report
    result=validate_counts({'totalPreCount':999,'totalPostCount':10},r['source_statistics']['body_stats'],r['source_statistics'],{'synaptic_contacts':6},dataset[1])
    assert result['status']=='discrepancy'
    assert result['checks'][0]['actual']==3 and result['checks'][0]['expected']==999
    assert result['checks'][0]['delta']==-996

def test_api_status_and_queries(loaded,tmp_path):
    with TestClient(create_app(tmp_path,loader=lambda _:loaded)) as client:
        response=client.get('/connectome/status');assert response.status_code==200
        data=response.json()
        assert data['loaded'] is True and data['neurons']==3 and data['edges']==2 and data['synaptic_contacts']==6
        assert data['memory']['csr_bytes']==sum(x.nbytes for x in [loaded.graph.adjacency.data,loaded.graph.adjacency.indices,loaded.graph.adjacency.indptr])
        assert client.get('/connectome/neurons/10').json()['type']=='A'
        assert client.get('/connectome/neurons/999').status_code==404
        assert client.get('/connectome/edges/10/20').json()['synaptic_contacts']==5
        assert client.get('/connectome/edges/10/999').status_code==404
        assert client.get('/connectome/neurons?limit=0').status_code==422

def test_api_unloaded_has_no_fake_counts(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        data=client.get('/connectome/status').json()
        assert data['loaded'] is False and data['neurons'] is None and data['edges'] is None and data['version'] is None
        assert 'Missing' in data['error']
        assert client.get('/connectome/neurons/10').status_code==503

@pytest.mark.parametrize('ids', [[10.9], [10.0], ['10'], [True], [2**63]])
def test_subgraph_rejects_noninteger_or_overflowing_ids(loaded, ids):
    with pytest.raises(ValueError, match='exact signed-64-bit integers'):
        loaded.graph.subgraph(ids)
