import { useEffect, useRef, useState } from 'react';
import { createFly, advanceFly, runFly } from './simulation';
import type { ExperimentConfig } from './experiments';
import { FlyNeuralLoop } from './neuralLoop';
export function useFlySimulation(){
  const state=useRef<ReturnType<typeof createFly>|null>(null);if(!state.current)state.current=createFly();
  const loop=useRef<FlyNeuralLoop|null>(null),epoch=useRef(0);const [,render]=useState(0);
  const refresh=()=>render(n=>n+1);
  useEffect(()=>{let frame=0,previous:number|null=null,lastPaint=0;const network=new FlyNeuralLoop();loop.current=network;
    const tick=(time:number)=>{const s=state.current!;if(previous!==null)advanceFly(s,(time-previous)/1000);previous=time;void network.pump(s,()=>state.current!,refresh);if(time-lastPaint>=30){refresh();lastPaint=time;}frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);network.dispose();};
  },[]);
  return {sim:state.current,epoch:epoch.current,toggle:()=>{loop.current?.cancel();runFly(state.current!,!state.current!.running);refresh();},reset:(config:ExperimentConfig)=>{loop.current?.cancel();state.current!.generation++;state.current=createFly(config);epoch.current++;refresh();}};
}
