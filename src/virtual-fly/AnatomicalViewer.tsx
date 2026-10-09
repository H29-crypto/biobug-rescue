import {useEffect,useRef,useState} from 'react';
import type {FlySimulation} from './simulation';
import {anatomyHistory} from './anatomicalTelemetry';
import type {AnatomicalHistory} from './anatomicalTelemetry';
import {validateManifest} from './anatomyModel';
import type {MorphologyManifest,PopulationFilter} from './anatomyModel';
import type {AnatomyScene,AnatomyPerformance} from './anatomyScene';
import './anatomy.css';
import {anatomyPresentation} from './anatomyPresentation';
import type {AnatomyViewState} from './anatomyPresentation';
export type {AnatomyViewState} from './anatomyPresentation';
const value=(v:number|null|undefined)=>v==null?'—':v===0?'0.0000':v<.0001?v.toExponential(2):v.toFixed(4);
export default function AnatomicalViewer({sim}:{sim:FlySimulation}){
  return <AnatomicalPanel sim={sim} history={anatomyHistory(sim)} sourceLabel={`Controlled experiment · ${sim.environment.name} · ${sim.fly.id}`}/>;
}
/** Shared renderer: callers supply the history from their own accepted control responses. */
export function AnatomicalPanel({sim,history,sourceLabel='Active experiment',neuralSuspended=false,actionLabel='APPLIED BODY ACTION'}:{sim:AnatomyViewState;history:AnatomicalHistory;sourceLabel?:string;neuralSuspended?:boolean;actionLabel?:string}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<AnatomyScene|null>(null);
  const [manifest,setManifest]=useState<MorphologyManifest|null>(null),[error,setError]=useState(''),[loadedMs,setLoadedMs]=useState<number|null>(null);
  const [filter,setFilter]=useState<PopulationFilter>('all'),[activeOnly,setActiveOnly]=useState(false),[selected,setSelected]=useState('523769');
  const [perf,setPerf]=useState<AnatomyPerformance|null>(null);
  const presentation=anatomyPresentation(sim,history,manifest,error,neuralSuspended);
  const {match,enabled,values,sample:latest}=presentation;
  const showActiveOnly=activeOnly&&!!latest;
  const current=useRef({values,filter,activeOnly:showActiveOnly,selected});current.current={values,filter,activeOnly:showActiveOnly,selected};
  useEffect(()=>{const abort=new AbortController();let cancelled=false;const start=performance.now();
    async function load(){try{
      const response=await fetch('/malecns/manifest.json',{signal:abort.signal});if(!response.ok)throw Error('Official morphology assets are missing. Run scripts/acquire_morphology.py.');
      const m=validateManifest(await response.json());const bytes=await fetch('/malecns/skeletons.bin',{signal:abort.signal});if(!bytes.ok)throw Error('Skeleton geometry unavailable');
      const buffer=await bytes.arrayBuffer();if(buffer.byteLength!==m.binary.bytes)throw Error('Skeleton geometry size mismatch');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==m.binary.sha256)throw Error('Skeleton geometry checksum mismatch');
      const positions=new Float32Array(buffer);if(!positions.every(Number.isFinite))throw Error('Invalid morphology coordinates');
      const {createAnatomyScene}=await import('./anatomyScene');if(cancelled||!host.current)return;
      scene.current=createAnatomyScene(host.current,m,positions,setSelected,setPerf,()=>setError('WebGL context lost. Reload the anatomical panel; fly state is preserved.'));
      setManifest(m);setLoadedMs(performance.now()-start);const c=current.current;scene.current.update(c.values,c.filter,c.activeOnly,c.selected);
    }catch(e){if(!cancelled)setError(String(e));}}
    void load();return()=>{cancelled=true;abort.abort();scene.current?.dispose();scene.current=null;};
  },[]);
  useEffect(()=>{scene.current?.update(values,filter,showActiveOnly,selected);},[latest,filter,showActiveOnly,selected,match,enabled]);
  const neuron=manifest?.neurons.find(n=>n.body_id===selected),trace=enabled?history.trace(selected):[],first=trace[0]?.time??0,last=trace.at(-1)?.time??0;
  const focus=(id:string)=>{setSelected(id);setFilter('DNa02');setActiveOnly(false);};
  return <section className="anatomy-panel fly-card" aria-label="MaleCNS anatomical view">
    <header className="anatomy-heading"><div><p className="fly-kicker">{presentation.headline}</p><h2>MaleCNS anatomical view</h2></div><span className="anatomy-live">{presentation.status}</span></header>
    <p>{presentation.explanation}</p>
    <p aria-label="Neural activity source"><b>{sourceLabel}</b> · {latest?`${presentation.active} / ${history.ids.length} neurons with nonzero sampled activity`:"No activity sample displayed"}</p>
    <div className="anatomy-toolbar" role="group" aria-label="Neuron population filters">{([['all','ALL'],['ProLN','ProLN'],['intermediate','INTERMEDIATES'],['DNa02','DNa02']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}<label><input type="checkbox" checked={showActiveOnly} disabled={!latest} onChange={e=>setActiveOnly(e.target.checked)}/> ACTIVE ONLY</label></div>
    <div className="anatomy-stage"><div ref={host} className="anatomy-canvas"/>{!manifest&&!error&&<div className="anatomy-loading">VERIFYING OFFICIAL SKELETONS…</div>}
      {error&&<div className="anatomy-loading fly-error" role="alert">{error}<br/>No synthetic morphology substituted.</div>}
      <div className="anatomy-stage-note">NATIVE MALECNS FRAME · μm<br/>{manifest?`${perf?.renderedNeurons??manifest.available} / ${manifest.available} available neurons shown`:'295 controller neurons requested'}<br/>Official coarse skeletons · no added simplification</div>
      <div className="anatomy-camera">{(['oblique','XY','XZ','YZ'] as const).map(p=><button key={p} disabled={!manifest||!!error} onClick={()=>scene.current?.preset(p)}>{p==='oblique'?'RESET VIEW':p}</button>)}</div>
    </div>
    <div className="anatomy-legend"><span>● ProLN / sensory</span><span>● Intermediate</span><span>● DNa02 / output</span></div>
    <p className="anatomy-help">Drag: rotate · right-drag: pan · scroll: zoom · click a branch: inspect. White highlight marks selection, not activity. XY/XZ/YZ are native coordinate planes, not verified anatomical camera labels.</p>
    {!match&&manifest&&<p role="alert" className="fly-error">Controller identity differs from the morphology manifest. Activity overlay disabled.</p>}
    <div className="anatomy-readouts">{(['L','R'] as const).map(side=>{const id=side==='L'?'523769':'10360';return <button key={side} onClick={()=>focus(id)}><span>DNa02-{side}</span><strong>{value(values[id])}</strong><small>ID {id}</small></button>;})}<div className="anatomy-decision"><span>{actionLabel}</span><strong>{sim.fly.turning.replaceAll('_',' ')}</strong><small>{latest?`Evaluation ${latest.sequence} · sample ${latest.time.toFixed(2)} s · body ${sim.elapsed.toFixed(2)} s`:'No accepted neural sample'}</small></div></div>
    <p>Activity is the per-neuron peak from an accepted 20-step controller evaluation, held between decisions. Manual control, guidance and safety overrides may replace its movement proposal. Paused, offline and operator views retain a labeled historical sample. Color uses a fixed logarithmic scale; zero activity stays dim. This is simulated dynamics on real structural data, not recorded or biologically validated brain activity.</p>
    <div className="anatomy-inspection"><div><label className="anatomy-select">INSPECT NEURON<select value={selected} onChange={e=>setSelected(e.target.value)}>{manifest?.neurons.map(n=><option key={n.body_id} value={n.body_id}>{n.body_id} · {n.type??'untyped'} · {n.population}</option>)}</select></label>
      {neuron&&<dl><div><dt>REAL · body ID / type</dt><dd>{neuron.body_id} / {neuron.type??'untyped'}</dd></div><div><dt>Population / side</dt><dd>{neuron.population} / {neuron.annotation.rootSide??neuron.annotation.somaSide??'unassigned'}</dd></div><div><dt>Annotation</dt><dd>{neuron.annotation.class??neuron.annotation.superclass} {neuron.annotation.entryNerve??''}</dd></div><div><dt>Incoming edges / contacts</dt><dd>{neuron.incoming_edges} / {neuron.incoming_contacts}</dd></div><div><dt>Outgoing edges / contacts</dt><dd>{neuron.outgoing_edges} / {neuron.outgoing_contacts}</dd></div><div><dt>Skeleton nodes / segments</dt><dd>{neuron.node_count.toLocaleString()} / {neuron.segment_count.toLocaleString()}</dd></div><div><dt>SIMULATED · sampled peak</dt><dd>{value(values[selected])}</dd></div></dl>}<small>Structural counts are within this 295-neuron controller, not the entire CNS.</small></div>
      <div><h3>Selected neuron · simulated peak history</h3>{trace.length?<svg className="fly-neural-trace" viewBox="0 0 400 140" role="img" aria-label={`Simulated activity history for neuron ${selected}, fixed 0 to 1 scale`}>
        {[0,.5,1].map(v=><g key={v}><line x1="30" x2="385" y1={110-v*90} y2={110-v*90} stroke="#294255"/><text x="0" y={113-v*90}>{v.toFixed(1)}</text></g>)}
        <polyline fill="none" stroke="#aa9aff" strokeWidth="2" points={trace.map(t=>`${30+355*(t.time-first)/Math.max(.2,last-first)},${110-90*t.value}`).join(' ')}/><text x="30" y="135">{first.toFixed(1)} s</text><text x="335" y="135">{last.toFixed(1)} s</text>
      </svg>:<p>No per-neuron telemetry yet. Run or step a MaleCNS experiment.</p>}<small>Fixed 0–1 scale · latest 180 decisions · simulated time. Tiny activity remains tiny in the trace.</small>
      <details><summary>Measured rendering performance</summary><dl><div><dt>Visible nodes / segments</dt><dd>{perf?.renderedNodes.toLocaleString()??'—'} / {perf?.renderedSegments.toLocaleString()??'—'}</dd></div><div><dt>FPS / frame interval</dt><dd>{perf?.fps.toFixed(1)??'—'} / {perf?.frameMs.toFixed(2)??'—'} ms</dd></div><div><dt>Session FPS / mean frame</dt><dd>{perf?.sessionFps.toFixed(1)??'—'} / {perf?.sessionFrameMs.toFixed(2)??'—'} ms</dd></div><div><dt>Measured intervals / tab state</dt><dd>{perf?.frames??'—'} / {perf?.visibility??'—'}</dd></div><div><dt>p95 frame / CPU submit</dt><dd>{perf?.p95FrameMs.toFixed(2)??'—'} / {perf?.renderSubmitMs.toFixed(2)??'—'} ms</dd></div><div><dt>GPU buffer allocation estimate</dt><dd>{perf?`${(perf.geometryBytes/1e6).toFixed(2)} MB`:'—'}</dd></div><div><dt>Fetch + verify + scene setup</dt><dd>{loadedMs?.toFixed(0)??'—'} ms</dd></div><div><dt>Draw calls</dt><dd>{perf?.drawCalls??'—'}</dd></div></dl><small>CPU arrays have a similar footprint. This is not total browser heap or measured GPU VRAM; CPU submit time is not GPU execution time. Hidden populations remain allocated.</small></details></div>
    </div>
    <footer className="anatomy-evidence"><span><b>REAL</b> Morphology · identity · structural connectivity</span><span><b>SIMULATED</b> Neural activity</span><span><b>ENGINEERED</b> Sensory transduction · motor decoding</span></footer>
  </section>;
}
