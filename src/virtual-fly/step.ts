import {acceptFlyNeural,advanceFly,DECISION_TICKS,FLY_STEP,runFly,failFlyNeural} from './simulation';
import type {FlySimulation} from './simulation';
import type {NeuralRequest} from './neuralLoop';
import {mapSensors} from '../simulation/sensorMapping';
/** One ordinary evaluation followed by its existing twelve physics ticks, then pause. */
export async function stepFlyDecision(s:FlySimulation,current:()=>FlySimulation,request:NeuralRequest,signal:AbortSignal,notify:()=>void=()=>{}){
  if(s.running||s.completed||s.config.mode!=='malecns')throw Error('Pause an unfinished MaleCNS experiment before stepping');
  runFly(s,true);const generation=s.generation,start=performance.now();s.neural.status='waiting';notify();
  const valid=()=>current()===s&&s.generation===generation&&s.running&&!signal.aborted;
  try{
    const response=await request(mapSensors(s.fly.sensors),signal);
    if(signal.aborted)throw Error('Neural step cancelled or timed out');
    if(!valid())return;
    acceptFlyNeural(s,response,performance.now()-start);notify();
    for(let i=0;i<DECISION_TICKS&&!s.completed;i++)advanceFly(s,FLY_STEP);
    if(s.running)runFly(s,false);
  }catch(e){if(current()===s&&s.generation===generation&&s.running)failFlyNeural(s,signal.aborted?'Neural step cancelled or timed out':String(e));}
  finally{if(current()===s&&s.generation===generation&&s.running)runFly(s,false);notify();}
}
