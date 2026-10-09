import {requestAnatomical} from '../virtual-fly/anatomicalTelemetry';
import {acceptNeural,neuralDue,log,setRunning} from './model';
import type {Supervised} from './model';

/** Separate request owner; modes/pauses/resets invalidate pending responses. */
export class SupervisedNeuralLoop {
  private pending:AbortController|null=null;private disposed=false;
  constructor(private request=requestAnatomical){}
  cancel(){this.pending?.abort();}
  dispose(){this.disposed=true;this.cancel();}
  async pump(s:Supervised,current:()=>Supervised,notify:()=>void=()=>{}){
    if(this.disposed||this.pending||!neuralDue(s))return;
    const abort=new AbortController(),generation=s.sim.generation,input={...s.contact};this.pending=abort;s.sim.neural.status='waiting';notify();
    const valid=()=>!this.disposed&&current()===s&&s.sim.generation===generation&&s.sim.running&&s.authority!=='operator';
    // First evaluation may build the structural subgraph; physics waits throughout.
    const timer=setTimeout(()=>abort.abort(),10000);
    try{const r=await this.request(input,abort.signal);if(abort.signal.aborted)throw Error('Neural request cancelled or timed out');if(valid())acceptNeural(s,r,input);}
    catch(e){if(valid()){setRunning(s,false);s.sim.neural.status='offline';s.sim.neural.error=String(e);log(s,'Neural service unavailable. Simulation paused; operator control remains available.');}}
    finally{clearTimeout(timer);this.pending=null;if(!this.disposed)notify();}
  }
}
