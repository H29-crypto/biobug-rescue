import {parseBatch} from '../simulation/swarmNeuralLoop';
import type {AgentInput} from '../simulation/swarmNeuralLoop';
import type {SwarmSimulation} from '../simulation/swarm';
import type {Simulation} from '../simulation/engine';
import {AnatomicalHistory,parseAnatomicalResponse} from '../virtual-fly/anatomicalTelemetry';
import type {AnatomicalResponse} from '../virtual-fly/anatomicalTelemetry';

export function parseAnatomicalBatch(raw:unknown,inputs:AgentInput[]):AnatomicalResponse[]{
  // Validate the complete batch before accepting any agent, then route by ID.
  return parseBatch(raw,inputs).map((response,i)=>parseAnatomicalResponse(response,inputs[i].stimulus));
}
export async function requestRescueActivity(agents:AgentInput[],signal:AbortSignal){
  const response=await fetch('http://127.0.0.1:8000/connectome/control-batch?include_activity=true',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agents}),signal});
  if(!response.ok)throw Error(`Connectome batch HTTP ${response.status}`);
  return parseAnatomicalBatch(await response.json(),agents);
}
/** One bounded history per agent identity; never a separate evaluation for the viewer. */
export class RescueActivity {
  private histories=new WeakMap<Simulation,{history:AnatomicalHistory;last:unknown;proposal:string}>();
  get(sim:Simulation){let entry=this.histories.get(sim);if(!entry){entry={history:new AnatomicalHistory(),last:null,proposal:'NO_SAMPLE'};this.histories.set(sim,entry);}return entry.history;}
  proposal(sim:Simulation){return this.histories.get(sim)?.proposal??'NO_SAMPLE';}
  observe(s:SwarmSimulation){for(const agent of s.agents){const sim=agent.simulation;
    if(sim.mode!=='malecns'){this.histories.delete(sim);continue;}
    const h=this.get(sim),entry=this.histories.get(sim)!,r=sim.neural.response as AnatomicalResponse|null;
    if(!r||!r.activity||r===entry.last)continue;
    entry.last=r;entry.proposal=sim.neural.decision?.action??'NOT_AVAILABLE';
    if(h.graph&&(h.graph!==r.graph.structural_sha256||h.ids.some((id,i)=>id!==r.activity.body_ids[i])))h.samples=[];
    h.graph=r.graph.structural_sha256;h.ids=r.activity.body_ids.slice();
    h.samples.push({time:sim.elapsed,sequence:sim.metrics.malecns.neuralDecisions,values:r.activity.values.slice()});
    if(h.samples.length>180)h.samples.shift();
  }}
}
