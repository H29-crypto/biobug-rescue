import { useEffect, useRef, useState } from 'react';
import { stimulateFly } from './stimulation';
import type { NeuralResponse } from '../simulation/neuralClient';
import type { Decision } from '../simulation/motorDecoder';
import type { FlySimulation } from './simulation';
import { DynamicsLab } from '../components/DynamicsLab';
export function StimulationLab({sim,ready}:{sim:FlySimulation;ready:boolean}){
  const [stimulus,setStimulus]=useState({left:1,front:0,right:0}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<{response:NeuralResponse;decision:Decision}|null>(null);const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  const run=async()=>{const abort=new AbortController();pending.current=abort;setBusy(true);setError('');const timeout=setTimeout(()=>abort.abort(),4000);
    try{const measured=await stimulateFly(sim,stimulus,abort.signal);if(abort.signal.aborted)return;setResult(measured);}
    catch(e){if(!abort.signal.aborted)setError(String(e));else if(pending.current===abort)setError('Stimulation timed out or was cancelled.');}
    finally{clearTimeout(timeout);if(pending.current===abort){pending.current=null;setBusy(false);}}};
  return <section className="fly-card"><p className="fly-kicker">ENGINEERING MODEL / EXPERIMENTAL STIMULATION</p><h2>Pause the body. Probe the circuit.</h2><p>Independent from the walking loop. A fresh neural experiment and decoder use the current geometric clearance; the body and its controller memory do not change.</p><div className="fly-stimuli">{(['left','front','right'] as const).map(side=><label key={side}>{side.toUpperCase()}<input type="range" min={0} max={1} step={.05} value={stimulus[side]} disabled={busy} onChange={e=>setStimulus({...stimulus,[side]:Number(e.target.value)})}/><output>{stimulus[side].toFixed(2)}</output></label>)}</div><button disabled={busy||!ready} onClick={()=>void run()}>{busy?'PROPAGATING…':'STIMULATE CIRCUIT'}</button>{error&&<p role="alert">{error}</p>}
    {result&&<div className="fly-stimulation-result"><p>Sampled input L / F / R: {[result.response.stimulus.left,result.response.stimulus.front,result.response.stimulus.right].map(n=>n.toFixed(2)).join(' / ')}</p><p>{result.response.input_active} active ProLN inputs → {result.response.graph.neurons} real neurons / {result.response.graph.edges} edges → simulated DNa02-L <b>{result.response.dna02.L.peak.toFixed(4)}</b> / DNa02-R <b>{result.response.dna02.R.peak.toFixed(4)}</b></p><strong>Predicted engineering output: {result.decision.action.replaceAll('_',' ')}</strong><p>{result.decision.reason}</p><p>Top reported intermediates: {result.response.top_intermediate_types.map(n=>`${n.type} (${n.cumulative_activity.toFixed(3)})`).join(', ')||'None active'}</p></div>}
    <details><summary>Stepwise neural dynamics · existing independent experiment tool</summary><DynamicsLab/></details>
  </section>;
}
