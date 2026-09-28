import { requestNeural } from '../simulation/neuralClient';
import { requestAnatomical } from './anatomicalTelemetry';
import { mapSensors } from '../simulation/sensorMapping';
import { acceptFlyNeural, failFlyNeural, flyNeuralDue } from './simulation';
import type { FlySimulation } from './simulation';
export type NeuralRequest=typeof requestNeural;
/** Per-lab request owner. No rescue state, no backend neural session, one in flight. */
export class FlyNeuralLoop {
  private pending:AbortController|null=null;private disposed=false;
  constructor(private request:NeuralRequest=requestAnatomical,private now=()=>performance.now()){}
  cancel(){this.pending?.abort();}
  dispose(){this.disposed=true;this.cancel();}
  async pump(s:FlySimulation,current:()=>FlySimulation,notify:()=>void=()=>{}){
    if(this.disposed||this.pending||!flyNeuralDue(s))return;
    const abort=new AbortController(),generation=s.generation,start=this.now();this.pending=abort;s.neural.status='waiting';s.fly.velocity=0;s.fly.turning='STOP';notify();
    const valid=()=>!this.disposed&&current()===s&&s.generation===generation&&s.running;
    const timeout=setTimeout(()=>abort.abort(),4000);
    try{const response=await this.request(mapSensors(s.fly.sensors),abort.signal);if(abort.signal.aborted)throw Error('Neural request cancelled or timed out');if(valid())acceptFlyNeural(s,response,this.now()-start);}
    catch(error){if(valid())failFlyNeural(s,String(error));}
    finally{clearTimeout(timeout);this.pending=null;if(!this.disposed)notify();}
  }
}
