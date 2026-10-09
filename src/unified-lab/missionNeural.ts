import {acceptNeural,failNeural} from '../simulation/engine';
import {mapSensors} from '../simulation/sensorMapping';
import {requestRescueActivity} from './activity';
import {needsNeural,runMission,missionLog} from './rescueMission';
import type {RescueMissionState} from './rescueMission';
/** Evaluate autonomous participants only; reject responses from old command epochs. */
export class MissionNeuralLoop {
  private pending:AbortController|null=null;private disposed=false;
  constructor(private request=requestRescueActivity,private now=()=>performance.now()){}
  cancel(){this.pending?.abort();}dispose(){this.disposed=true;this.cancel();}
  async pump(s:RescueMissionState,current:()=>RescueMissionState,notify:()=>void=()=>{}){
    if(this.disposed||this.pending||!s.world.running||!s.world.agents.some((_,i)=>needsNeural(s,i)))return;
    const participants=s.world.agents.map((a,i)=>({a,i,epoch:a.simulation.generation})).filter(({i,a})=>s.ops[i].battery>0&&s.ops[i].authority!=='operator'&&s.ops[i].authority!=='hold'&&a.simulation.mode==='malecns');
    const inputs=participants.map(({a})=>({id:a.simulation.bug.id,stimulus:mapSensors(a.simulation.bug.sensors)})),abort=new AbortController(),start=this.now();
    this.pending=abort;s.world.batchRequests++;participants.forEach(({a})=>a.simulation.neural.status='waiting');notify();
    const valid=()=>!this.disposed&&current()===s&&s.world.running&&participants.some(({a,epoch})=>a.simulation.generation===epoch);
    const timer=setTimeout(()=>abort.abort(),10000);
    try{const results=await this.request(inputs,abort.signal);if(abort.signal.aborted)throw Error('Neural request expired');if(results.length!==participants.length)throw Error('Incomplete agent batch');
      if(valid()){const latency=this.now()-start;participants.forEach(({a,i,epoch},k)=>{if(a.simulation.generation===epoch&&s.ops[i].authority!=='operator'&&s.ops[i].authority!=='hold')acceptNeural(a.simulation,results[k],latency);});s.world.batchLatencies.push(latency);s.activity.observe(s.world);}
    }catch(e){if(valid()){s.world.batchFailures++;runMission(s,false);participants.forEach(({a})=>failNeural(a.simulation,String(e)));missionLog(s,s.world.selected,'Neural service failed. Mission paused; retry or select Rule-Based explicitly.');}}
    finally{clearTimeout(timer);this.pending=null;if(!this.disposed)notify();}
  }
}
