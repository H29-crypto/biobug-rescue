import base64
import hashlib
import json
import pyarrow as pa
import pyarrow.feather as feather
import pytest
from connectome.loader import load_connectome

@pytest.fixture
def dataset(tmp_path):
    tables = {
        'annotations': pa.table({'bodyId': [30,10,20,40,50], 'superclass': ['cb_intrinsic','cb_sensory','cb_motor','cb_tbc',None],
            'type': ['C','A','B',None,None], 'status': ['Traced','Traced','Traced','Assign','Glia'],
            'somaLocation': pa.array([[1,2,3],[4,5,6],None,None,None], type=pa.list_(pa.int64())),
            'tosomaLocation': pa.array([None]*5,type=pa.list_(pa.int64()))}),
        'neurotransmitters': pa.table({'body':[20,50,10], 'predicted_nt':['gaba','unclear','acetylcholine'],
            'consensus_nt':['gaba','unclear','acetylcholine'], 'ground_truth':[None,None,'acetylcholine']}),
        'edges': pa.table({'body_pre':[10,20,10,10], 'body_post':[20,10,20,50], 'weight':[2,1,3,4]}),
        'body_stats': pa.table({'body':[10,20,30,40,50], 'pre':[1,2,0,0,0], 'post':[2,4,0,0,4], 'downstream':[9,1,0,0,0]})}
    files=[]
    for role,table in tables.items():
        path=tmp_path/f'{role}.feather'
        feather.write_feather(table,path,chunksize=2)
        files.append({'role':role,'filename':path.name})
    path=tmp_path/'metadata.json'
    path.write_text(json.dumps({'dataset':'male-cns','tag':'v1.0','totalPreCount':3,'totalPostCount':10,'voxelSize':[8,8,8],'voxelUnits':'nanometers'}))
    files.append({'role':'metadata','filename':path.name})
    for item in files:
        content=(tmp_path/item['filename']).read_bytes()
        item.update(size_bytes=len(content),md5_base64=base64.b64encode(hashlib.md5(content).digest()).decode())
    return tmp_path,{'dataset':'MaleCNS','version':'v1.0','files':files}

@pytest.fixture
def loaded(dataset):
    return load_connectome(dataset[0],manifest=dataset[1])
