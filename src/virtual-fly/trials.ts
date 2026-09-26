import { createFly, advanceFly, runFly, flyNeuralDue, acceptFlyNeural, flyResult, FLY_STEP } from './simulation';
import type { FlyResult } from './simulation';
import type { ExperimentConfig } from './experiments';
import { requestNeural } from '../simulation/neuralClient';
import type { NeuralRequest } from './neuralLoop';
import { mapSensors } from '../simulation/sensorMapping';
export async function runTrial(config:ExperimentConfig,signal:AbortSignal,request:NeuralRequest=requestNeural,onProgress:(elapsed:number)=>void=()=>{}):Promise<FlyResult>{
  const sim=createFly(config);runFly(sim,true);
  while(!sim.completed){
    if(signal.aborted)throw Error('Comparison cancelled');
    if(flyNeuralDue(sim)){
      const abort=new AbortController(),cancel=()=>abort.abort();signal.addEventListener('abort',cancel,{once:true});const timeout=setTimeout(cancel,4000);const start=performance.now();
      try{const response=await request(mapSensors(sim.fly.sensors),abort.signal);if(signal.aborted||abort.signal.aborted)throw Error('Comparison cancelled or neural request timed out');acceptFlyNeural(sim,response,performance.now()-start);}
      finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);}
    }
    advanceFly(sim,FLY_STEP);
    if(sim.ticks%60===0){onProgress(sim.elapsed);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }
  return flyResult(sim);
}
export async function compareTrial(config:ExperimentConfig,signal:AbortSignal,request:NeuralRequest=requestNeural,onProgress:(text:string)=>void=()=>{}){
  const results:FlyResult[]=[];
  for(const mode of ['rule-based','malecns'] as const)results.push(await runTrial({...config,mode},signal,request,time=>onProgress(`${mode}: ${time.toFixed(0)} / ${config.duration} s`)));
  return results;
}
