import { useEffect, useRef, useState } from 'react';
import { createFly, advanceFly, runFly } from './simulation';
import type { ExperimentConfig } from './experiments';
import { FlyNeuralLoop } from './neuralLoop';
import { anatomyHistory,requestAnatomical } from './anatomicalTelemetry';
import { stepFlyDecision } from './step';
export function useFlySimulation(){
  const state=useRef<ReturnType<typeof createFly>|null>(null);if(!state.current)state.current=createFly();
  const loop=useRef<FlyNeuralLoop|null>(null),epoch=useRef(0);const [,render]=useState(0);
  const stepping=useRef<AbortController|null>(null);
  const refresh=()=>{anatomyHistory(state.current!).observe(state.current!);render(n=>n+1);};
  useEffect(()=>{let frame=0,previous:number|null=null,lastPaint=0;const network=new FlyNeuralLoop();loop.current=network;
    const tick=(time:number)=>{const s=state.current!;if(!stepping.current){if(previous!==null)advanceFly(s,(time-previous)/1000);void network.pump(s,()=>state.current!,refresh);}previous=time;if(time-lastPaint>=30){refresh();lastPaint=time;}frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);network.dispose();stepping.current?.abort();};
  },[]);
  return {sim:state.current,epoch:epoch.current,stepping:!!stepping.current,step:async()=>{
    if(stepping.current||state.current!.running)return;
    loop.current?.cancel();const abort=new AbortController();stepping.current=abort;refresh();
    const timer=setTimeout(()=>abort.abort(),4000);
    try{await stepFlyDecision(state.current!,()=>state.current!,requestAnatomical,abort.signal,refresh);}
    finally{clearTimeout(timer);if(stepping.current===abort)stepping.current=null;refresh();}
  },toggle:()=>{stepping.current?.abort();loop.current?.cancel();runFly(state.current!,!state.current!.running);refresh();},reset:(config:ExperimentConfig)=>{stepping.current?.abort();loop.current?.cancel();state.current!.generation++;state.current=createFly(config);epoch.current++;refresh();}};
}
