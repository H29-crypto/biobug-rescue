import type {AnatomicalHistory} from './anatomicalTelemetry';
import type {MorphologyManifest} from './anatomyModel';

export interface AnatomyViewState {
  config:{mode:string};running:boolean;elapsed:number;neural:{status:string};fly:{turning:string};
}
/** Read-only presentation of accepted samples; never advances or evaluates a controller. */
export function anatomyPresentation(sim:AnatomyViewState,history:AnatomicalHistory,manifest:MorphologyManifest|null,error='',suspended=false){
  const latest=history.samples.at(-1);
  const match=!!manifest&&(!history.graph||history.graph===manifest.graph_sha256)&&(!history.ids.length||history.ids.length===manifest.neurons.length&&manifest.neurons.every(n=>history.ids.includes(n.body_id)));
  const enabled=match&&!error&&sim.config.mode==='malecns';
  const sample=enabled?latest:undefined;
  const values:Record<string,number>=sample?Object.fromEntries(history.ids.map((id,i)=>[id,sample.values[i]])):{};
  let status:string;
  if(error)status='VIEWER UNAVAILABLE';
  else if(!manifest)status='VERIFYING STRUCTURE';
  else if(!match)status='IDENTITY MISMATCH';
  else if(sim.config.mode!=='malecns')status='STRUCTURE ONLY';
  else if(suspended)status=sample?'HISTORICAL / OPERATOR':'OPERATOR / NO SAMPLE';
  else if(sim.neural.status==='offline')status=sample?'OFFLINE / LAST SAMPLE':'OFFLINE / NO SAMPLE';
  else if(!sample)status=sim.running?'AWAITING FIRST SAMPLE':'PAUSED / NO SAMPLE';
  else if(!sim.running)status='PAUSED / LAST SAMPLE';
  else if(sim.neural.status==='waiting'||sim.neural.status==='idle')status='WAITING / LAST SAMPLE';
  else status='LIVE / SAMPLED';
  const headline=status==='LIVE / SAMPLED'?'LIVE SIMULATED ACTIVITY ON REAL MALECNS STRUCTURE':sample?'RECORDED SIMULATION SAMPLE ON REAL MALECNS STRUCTURE':'REAL MALECNS STRUCTURE · NO ACTIVITY DISPLAYED';
  const explanation=sim.config.mode!=='malecns'
    ?'Rule-based control is selected. Neurons show anatomy only; movement in this mode does not generate neural activity.'
    :sample
      ?`${status==='LIVE / SAMPLED'?'Colors update after each accepted controller evaluation.':'Colors hold the last accepted evaluation; they are not changing live.'} Hue identifies the neuron population; brightness represents sampled activity. A white highlight marks the selected neuron, not firing.`
      :'No accepted neural sample is available. Start or resume a MaleCNS run with the backend connected to see activity.';
  return {match,enabled,sample,values,status,headline,explanation,active:Object.values(values).filter(v=>v>0).length};
}
