import { parseNeuralResponse } from '../simulation/neuralClient';
import type { NeuralResponse } from '../simulation/neuralClient';
import type { Stimulus } from '../simulation/sensorMapping';
import type { FlySimulation } from './simulation';

export interface AnatomicalResponse extends NeuralResponse {
  activity: { statistic:'peak-over-20-steps-from-rest'; body_ids:string[]; values:number[] };
}
export function parseAnatomicalResponse(raw:unknown,input:Stimulus):AnatomicalResponse {
  const r=parseNeuralResponse(raw,input) as AnatomicalResponse,a=r.activity;
  if(!a||a.statistic!=='peak-over-20-steps-from-rest'||!Array.isArray(a.body_ids)||!Array.isArray(a.values)||
    a.body_ids.length!==r.graph.neurons||a.values.length!==a.body_ids.length||new Set(a.body_ids).size!==a.body_ids.length||
    !a.body_ids.every(id=>typeof id==='string'&&/^\d+$/.test(id))||
    !a.values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)||
    !(['L','R'] as const).every(side=>a.values[a.body_ids.indexOf(r.dna02[side].id)]===r.dna02[side].peak))
      throw Error('Incomplete or mismatched per-neuron telemetry; movement paused');
  return r;
}
export async function requestAnatomical(input:Stimulus,signal:AbortSignal):Promise<AnatomicalResponse>{
  const response=await fetch('http://127.0.0.1:8000/connectome/control?include_activity=true',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
  if(!response.ok)throw Error(`Connectome HTTP ${response.status}`);
  return parseAnatomicalResponse(await response.json(),input);
}

export interface ActivitySample {time:number;sequence:number;values:number[]}
/** Read-only observer. Never mutates simulation, decisions, sensors or request timing. */
export class AnatomicalHistory {
  private last:NeuralResponse|null=null;
  ids:string[]=[]; graph=''; samples:ActivitySample[]=[];
  observe(sim:FlySimulation){
    const response=sim.neural.response as AnatomicalResponse|null;
    if(!response||response===this.last||!response.activity||sim.config.mode!=='malecns'||sim.neural.sampleTime===null)return;
    this.last=response;
    if(this.graph&&(this.graph!==response.graph.structural_sha256||this.ids.some((id,i)=>id!==response.activity.body_ids[i]))){this.samples=[];}
    this.graph=response.graph.structural_sha256;
    this.ids=response.activity.body_ids.slice();
    this.samples.push({time:sim.neural.sampleTime,sequence:sim.metrics.samples,values:response.activity.values.slice()});
    if(this.samples.length>180)this.samples.shift();
  }
  value(id:string):number|null {const i=this.ids.indexOf(id);return i<0||!this.samples.length?null:this.samples.at(-1)!.values[i];}
  trace(id:string){const i=this.ids.indexOf(id);return i<0?[]:this.samples.map(s=>({time:s.time,value:s.values[i]}));}
}
const histories=new WeakMap<FlySimulation,AnatomicalHistory>();
export function anatomyHistory(sim:FlySimulation){let h=histories.get(sim);if(!h){h=new AnatomicalHistory();histories.set(sim,h);}return h;}
