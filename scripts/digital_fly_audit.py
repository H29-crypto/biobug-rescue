"""Read-only MaleCNS feasibility analysis; no application or dynamics changes.

Run from project root: backend/.venv/Scripts/python scripts/digital_fly_audit.py
Outputs new research evidence under docs/ and temporary sparse caches under work/.
"""
from pathlib import Path
import sys, json, time, hashlib, platform, gc, subprocess
from collections import Counter
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
import psutil
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from connectome.loader import load_connectome
from connectome.metadata import load_manifest, source_paths
from connectome.graph import json_value

OUT = ROOT / 'docs'
WORK = ROOT / 'work/digital-fly'
WORK.mkdir(parents=True, exist_ok=True)

def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, allow_nan=False) + '\n', encoding='utf-8')

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while b := f.read(1024*1024): h.update(b)
    return h.hexdigest()

def run():
    start = time.perf_counter()
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    frozen = {p: digest(ROOT/p) for p in tracked if p}
    manifest = load_manifest()
    print('Verifying and loading actual downloaded release...', flush=True)
    loaded = load_connectome()
    g, t = loaded.graph, loaded.graph.neurons
    A, ids, n = g.adjacency, g.body_ids, len(g.body_ids)
    print('Loaded', n, A.nnz, 'in', loaded.report['load_seconds'], 'seconds', flush=True)
    # Temporary cache supports additional research without reparsing >2 GB of inputs.
    sparse.save_npz(WORK/'selected-graph.npz', A, compressed=False)
    feather.write_feather(t, WORK/'selected-neurons.feather')
    write('DIGITAL_FLY_LOAD.json', {k:v for k,v in loaded.report.items() if k!='annotations'})
    columns = {name: np.array(t[name].to_pylist(), dtype=object) for name in
               ['type','superclass','class','subclass','entryNerve','rootSide','somaSide','somaNeuromere','synonyms']}
    def eq(field, *values): return np.isin(columns[field], values)
    pops = {
        'tactile':eq('class','mechanosensory_tactile'),
        'proprioceptive':eq('class','mechanosensory_proprioceptive'),
        'chordotonal':eq('class','mechanosensory_proprioceptive') & eq('subclass','chordotonal organ'),
        'visual':eq('class','visual'), 'olfactory':eq('class','olfactory'),
        'head_mechanosensory':eq('class','mechanosensory') & eq('superclass','cb_sensory'),
        'descending':eq('superclass','descending_neuron'), 'ascending':eq('superclass','ascending_neuron'),
        'central_or_ascending':eq('superclass','cb_intrinsic','ascending_neuron'),
        'central':eq('superclass','cb_intrinsic'), 'vnc_intrinsic':eq('superclass','vnc_intrinsic'),
        'vnc_motor':eq('superclass','vnc_motor'), 'cb_motor':eq('superclass','cb_motor'),
        'leg_motor':eq('superclass','vnc_motor') & eq('subclass','fl','ml','hl'),
    }
    for nerve in ['ProLN','MesoLN','MetaLN']:
        for category in ['tactile','proprioceptive','chordotonal']:
            pops[f'{category}_{nerve}']=pops[category] & eq('entryNerve',nerve)
    for subclass in ['fl','ml','hl','wm','nm','hm','ad']:
        pops[f'motor_{subclass}']=pops['vnc_motor'] & eq('subclass',subclass)
    for name in ['chordotonal_ProLN','proprioceptive_ProLN','tactile_ProLN']:
        for side in ['L','R']: pops[f'{name}_{side}']=pops[name] & eq('rootSide',side)
    for side in ['L','R']:
        pops[f'motor_fl_{side}']=pops['motor_fl'] & eq('somaSide',side)
        pops[f'tibia_motor_fl_{side}']=pops[f'motor_fl_{side}'] & eq('type','Ti flexor MN','Ti extensor MN','Acc. ti flexor MN')
    pops['FeCO_MetaLN_R']=pops['proprioceptive_MetaLN'] & eq('rootSide','R') & eq('synonyms','FeCO claw','FeCO hook','FeCO club')
    pops['tibia_motor_hl_R']=pops['motor_hl'] & eq('somaSide','R') & eq('type','Ti flexor MN','Ti extensor MN','Acc. ti flexor MN')
    named = ['DNa01','DNa02','DNg13','DNp09','MDN','DNa11','DNb08','DNg100','DNg97','DNp07','DNp17','DNp18','DNa03','BPN','BRK','BB','FG','oDN1','MAN','LAL013','LAL014','LAL015']
    for name in named: pops['type_'+name]=eq('type',name)
    def freqs(table, col):
        if pa.types.is_list(table[col].type): return None
        vc=pc.value_counts(table[col]).to_pylist()
        return dict(sorted(((str(x['values']) if x['values'] is not None else '(missing)', int(x['counts'])) for x in vc), key=lambda z:(-z[1],z[0])))
    def record(index): return json_value(t.slice(int(index),1).to_pylist()[0])
    def stats(mask):
        ix=np.flatnonzero(mask); table=t.take(pa.array(ix)); outgoing=A[ix,:]
        strengths=np.asarray(outgoing.sum(axis=0)).ravel(); targets=np.flatnonzero(strengths)
        strongest=targets[np.argsort(-strengths[targets],kind='stable')[:15]]
        outclass={}
        for key in ['descending','ascending','central','vnc_intrinsic','leg_motor']:
            chunk=outgoing[:,pops[key]]
            outclass[key]={'edges':int(chunk.nnz),'contacts':int(chunk.sum())}
        return {'count':len(ix),'ids':[int(x) for x in ids[ix]],
                'fields':{c:freqs(table,c) for c in ['type','subclass','superclass','rootSide','somaSide','somaNeuromere','entryNerve','exitNerve','mancType','consensus_nt','predicted_nt']},
                'outgoing_edges':int(outgoing.nnz),'outgoing_contacts':int(outgoing.sum()),
                'unique_postsynaptic_neurons':len(targets),'outgoing_by_class':outclass,
                'strongest_downstream':[{'neuron':record(i),'contacts':int(strengths[i])} for i in strongest]}
    audit={'version':manifest['version'],'selection':loaded.report['scope'],'source_schemas':{},'selected_schema':{},'populations':{},'metadata':{}}
    for role,path in source_paths(ROOT/'backend/data',manifest).items():
        if role=='metadata':
            meta=json.loads(path.read_text(encoding='utf-8'))
            audit['metadata']={'keys':list(meta),'voxelSize':meta.get('voxelSize'),'voxelUnits':meta.get('voxelUnits'),'roiInfo_keys':list(meta.get('roiInfo',{}))[:50]}
            continue
        with pa.OSFile(str(path),'rb') as f:
            reader=pa.ipc.open_file(f)
            audit['source_schemas'][role]={'filename':path.name,'bytes':path.stat().st_size,'columns':{field.name:str(field.type) for field in reader.schema},'record_batches':reader.num_record_batches}
    for field in t.schema:
        col=t[field.name];f=freqs(t,field.name)
        audit['selected_schema'][field.name]={'type':str(field.type),'non_null':n-col.null_count,'null':col.null_count,'distinct_non_null':None if f is None else len(f)-int('(missing)' in f),'top_values':None if f is None else dict(list(f.items())[:25])}
    for name,mask in pops.items():
        audit['populations'][name]=stats(mask)
    detailed=pops['proprioceptive'] | pops['leg_motor'] | pops['descending'] | pops['cb_motor'] | pops['vnc_motor']
    write('DIGITAL_FLY_NEURONS.json',json_value(t.filter(pa.array(detailed)).to_pylist()))
    write('DIGITAL_FLY_AUDIT.json',audit)
    print('Inventory saved; searching bounded, category-constrained routes.',flush=True)
    # Cache only category-to-category sparse edge arrays, not per-edge Python objects.
    cache={}
    def transitions(left,right):
        key=(left,right)
        if key not in cache:
            selected=np.flatnonzero(pops[left]); sub=A[selected,:]
            rows=np.repeat(selected,np.diff(sub.indptr)); keep=pops[right][sub.indices]
            cache[key]=(rows[keep],sub.indices[keep].copy(),sub.data[keep].copy())
        return cache[key]
    def chain(stages,threshold):
        links=[]
        for a,b in zip(stages,stages[1:]):
            r,c,w=transitions(a,b); keep=w>=threshold;links.append((r[keep],c[keep],w[keep]))
        forward=[pops[stages[0]].copy()]
        for r,c,w in links:
            nxt=np.zeros(n,bool);nxt[c[forward[-1][r]]]=True;forward.append(nxt)
        backward=[pops[stages[-1]].copy()]
        for r,c,w in reversed(links):
            nxt=np.zeros(n,bool);nxt[r[backward[-1][c]]]=True;backward.append(nxt)
        backward.reverse(); uniq_edges=[]; nodes=np.zeros(n,bool);stage_counts=[]
        best=np.zeros(n,np.int64);best[pops[stages[0]]]=np.iinfo(np.int64).max;parents=[]
        for j,(r,c,w) in enumerate(links):
            keep=forward[j][r]&backward[j+1][c]; rr,cc,ww=r[keep],c[keep],w[keep]
            nodes[rr]=True;nodes[cc]=True;uniq_edges.append(rr.astype(np.int64)*n+cc)
            stage_counts.append({'edges':len(rr),'contacts':int(ww.sum())})
            score=np.minimum(best[r],w);nxt=np.zeros(n,np.int64);np.maximum.at(nxt,c,score)
            parent=np.full(n,n,np.int32);match=(score>0)&(score==nxt[c]);np.minimum.at(parent,c[match],r[match]);parents.append(parent);best=nxt
        codes=np.unique(np.concatenate(uniq_edges));rr=(codes//n).astype(np.int32);cc=(codes%n).astype(np.int32)
        weights=np.asarray(A[rr,cc]).ravel() if len(codes) else np.array([],np.int64)
        path=[];best_contact=int(best.max())
        if best_contact:
            node=int(np.flatnonzero(best==best_contact)[0]);path=[node]
            for parent in reversed(parents):node=int(parent[node]);path.append(node)
            path.reverse()
        intermediate=nodes.copy();intermediate[pops[stages[0]]|pops[stages[-1]]]=False
        typecontacts=Counter()
        incident=np.bincount(rr,weights=weights,minlength=n)+np.bincount(cc,weights=weights,minlength=n)
        for ix in np.flatnonzero(intermediate):
            typecontacts[str(columns['type'][ix])]+=int(incident[ix])
        result={'stages':stages,'hops':len(stages)-1,'min_edge_contacts':threshold,'neurons':int(nodes.sum()),'edges':len(codes),'contacts':int(weights.sum()),'source_participants':int((nodes&pops[stages[0]]).sum()),'target_participants':int((nodes&pops[stages[-1]]).sum()),'stage_edges':stage_counts,'strongest_by_maximum_bottleneck':{'bottleneck':best_contact,'neurons':[record(i) for i in path],'edge_contacts':[int(A[a,b]) for a,b in zip(path,path[1:])]},'top_intermediate_types_by_incident_route_contacts':typecontacts.most_common(15),'rootSide':freqs(t.filter(pa.array(nodes)),'rootSide'),'somaSide':freqs(t.filter(pa.array(nodes)),'somaSide'),'consensus_nt':freqs(t.filter(pa.array(nodes)),'consensus_nt')}
        if threshold==5 and stages[0] in ('chordotonal_ProLN_L','proprioceptive_ProLN_L','FeCO_MetaLN_R'):
            result['participating_ids']=[int(x) for x in ids[nodes]]
            sub=A[nodes,:][:,nodes];result['induced_edges']=sub.nnz;result['induced_contacts']=int(sub.sum())
        return result
    templates=[
      ['tactile','central_or_ascending','descending','vnc_intrinsic','leg_motor'],
      ['tactile','vnc_intrinsic','ascending','central','descending','vnc_intrinsic','leg_motor'],
      ['proprioceptive','central_or_ascending','descending','vnc_intrinsic','leg_motor'],
      ['proprioceptive','vnc_intrinsic','leg_motor'],
      ['chordotonal','vnc_intrinsic','vnc_intrinsic','leg_motor'],
      ['chordotonal_ProLN_L','vnc_intrinsic','tibia_motor_fl_L'],
      ['proprioceptive_ProLN_L','vnc_intrinsic','tibia_motor_fl_L'],
      ['chordotonal_ProLN_L','vnc_intrinsic','vnc_intrinsic','tibia_motor_fl_L'],
      ['tactile_ProLN','central_or_ascending','descending','vnc_intrinsic','motor_fl'],
      ['FeCO_MetaLN_R','vnc_intrinsic','tibia_motor_hl_R'],
      ['FeCO_MetaLN_R','vnc_intrinsic','vnc_intrinsic','tibia_motor_hl_R'],
    ]
    chains=[]
    for stages in templates:
        for threshold in [1,5,10]:
            result=chain(stages,threshold);chains.append(result)
            print('Route',stages[0],len(stages)-1,threshold,result['neurons'],result['edges'],flush=True)
    # Multi-source BFS to all motors, max six hops, directed thresholded graph.
    reach={}
    for name in ['tactile','proprioceptive','chordotonal','visual','olfactory']:
        seen=pops[name].copy();front=seen.copy();rows=[]
        for h in range(1,7):
            sub=A[np.flatnonzero(front),:];nxt=np.zeros(n,bool);nxt[sub.indices[sub.data>=5]]=True;nxt &= ~seen;seen |= nxt;front=nxt
            rows.append({'hop':h,'new_neurons':int(nxt.sum()),'new_leg_motors':int((nxt&pops['leg_motor']).sum()),'cumulative_leg_motors':int((seen&pops['leg_motor']).sum())})
        reach[name]=rows
    write('DIGITAL_FLY_PATHWAYS.json',{'method':'Exact-stage directed walk unions, 1/5/10-contact sensitivity; unique edges and contacts counted once. Maximum-bottleneck witness, lowest-ID ties; not a biological pathway ranking. BFS up to six hops at >=5 contacts is separate and unconstrained.','chains':chains,'bounded_reachability':reach})
    print('Timing sparse arithmetic only, no new neural model.',flush=True)
    del cache;gc.collect();x=np.random.default_rng(2026).random(n)
    times=[]
    for i in range(25):
        ts=time.perf_counter();y=A.T@x;elapsed=time.perf_counter()-ts
        if i>=5:times.append(elapsed)
    perf={'cpu':platform.processor(),'logical_cpus':psutil.cpu_count(),'physical_cpus':psutil.cpu_count(logical=False),'ram_bytes':psutil.virtual_memory().total,'numpy':np.__version__,'scipy':__import__('scipy').__version__,'csr_dtype':str(A.dtype),'csr_index_dtype':str(A.indices.dtype),'neurons':n,'edges':A.nnz,'csr_bytes':A.data.nbytes+A.indices.nbytes+A.indptr.nbytes,'state_float32_bytes':4*n,'estimated_float32_csr_bytes':8*A.nnz+4*(n+1),'estimated_dense_float32_bytes':4*n*n,'kernel':'A.T @ x, original int64 structural CSR and float64 synthetic vector; 5 warmups + 20 measured repetitions; no normalization, clipping, body, physiology or HTTP','seconds':times,'median_seconds':float(np.median(times)),'p95_seconds':float(np.quantile(times,.95)),'output_checksum':float(y.sum()),'process_rss_at_end':psutil.Process().memory_info().rss,'total_audit_seconds':time.perf_counter()-start}
    write('DIGITAL_FLY_PERFORMANCE.json',perf)
    assert all(digest(ROOT/p)==h for p,h in frozen.items()),'An existing tracked file changed during audit'
    write('DIGITAL_FLY_RESEARCH_INTEGRITY.json',{'existing_tracked_files_unchanged':True,'file_count':len(frozen),'sha256':frozen})
    print('Audit complete. Existing tracked files unchanged.',flush=True)

if __name__=='__main__':run()
