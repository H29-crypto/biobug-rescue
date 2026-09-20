import { acceptNeural, failNeural, neuralDue } from './engine';
import { mapSensors } from './sensorMapping';
import type { Stimulus } from './sensorMapping';
import { parseNeuralResponse } from './neuralClient';
import type { NeuralResponse } from './neuralClient';
import { runSwarm } from './swarm';
import type { SwarmSimulation } from './swarm';
export interface AgentInput { id:string; stimulus:Stimulus }
export function parseBatch(raw:unknown,inputs:AgentInput[]):NeuralResponse[] {
  const batch=raw as {results?:{id:string;response:unknown}[]};
  if(!batch||!Array.isArray(batch.results)||batch.results.length!==inputs.length||new Set(batch.results.map(r=>r.id)).size!==inputs.length) throw new Error('Invalid swarm response IDs');
  return inputs.map(input=>{
    const match=batch.results!.find(r=>r.id===input.id);
    if(!match) throw new Error('Missing BioBug response');
    return parseNeuralResponse(match.response,input.stimulus);
  });
}
export async function requestBatch(agents:AgentInput[],signal:AbortSignal):Promise<NeuralResponse[]> {
  const response=await fetch('http://127.0.0.1:8000/connectome/control-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agents}),signal});
  if(!response.ok) throw new Error(`Connectome batch HTTP ${response.status}`);
  return parseBatch(await response.json(),agents);
}
export class SwarmNeuralLoop {
  private pending:AbortController|null=null;
  private disposed=false;
  constructor(private request=requestBatch,private now=()=>performance.now()) {}
  cancel(){this.pending?.abort();}
  dispose(){this.disposed=true;this.cancel();}
  async pump(s:SwarmSimulation,current:()=>SwarmSimulation,update:()=>void=()=>{}) {
    if(this.disposed||this.pending||!s.running||!s.agents.some(a=>neuralDue(a.simulation))) return;
    const epochs=s.agents.map(a=>a.simulation.generation),abort=new AbortController(),started=this.now();
    const inputs=s.agents.map(a=>({id:a.simulation.bug.id,stimulus:mapSensors(a.simulation.bug.sensors)}));
    this.pending=abort;s.batchRequests++;s.agents.forEach(a=>a.simulation.neural.status='waiting');update();
    const valid=()=>!this.disposed&&current()===s&&s.running&&s.agents.every((a,i)=>a.simulation.generation===epochs[i]&&a.simulation.mode==='malecns');
    const timeout=setTimeout(()=>abort.abort(),4000);
    try {
      const responses=await this.request(inputs,abort.signal);
      if(abort.signal.aborted) throw new Error('Request cancelled or exceeded 4 seconds');
      if(responses.length!==s.agents.length) throw new Error('Incomplete swarm response');
      if(valid()) {
        const latency=this.now()-started;
        s.agents.forEach((a,i)=>acceptNeural(a.simulation,responses[i],latency));s.batchLatencies.push(latency);
      }
    }catch(error){
      if(valid()) {
        s.batchFailures++;runSwarm(s,false);
        s.agents.forEach(a=>failNeural(a.simulation,String(error)));
      }
    }finally {clearTimeout(timeout);this.pending=null;if(!this.disposed) update();}
  }
}
