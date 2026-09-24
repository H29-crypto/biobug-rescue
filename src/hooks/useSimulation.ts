import { buildMissionSnapshot } from '../simulation/commanderSnapshot';
import { useEffect, useRef, useState } from 'react';
import type { ControllerMode } from '../simulation/engine';
import { advanceSwarm, createSwarm, runSwarm, swarmSnapshot, switchSwarm } from '../simulation/swarm';
import type { SwarmSimulation } from '../simulation/swarm';
import { SwarmNeuralLoop } from '../simulation/swarmNeuralLoop';
export function useSimulation() {
  const ref=useRef<SwarmSimulation|null>(null);
  if(!ref.current) ref.current=createSwarm();
  const [view,setView]=useState(()=>swarmSnapshot(ref.current!));
  const missionRevision=useRef(0);
  const loop=useRef<SwarmNeuralLoop|null>(null);
  const refresh=()=>setView(swarmSnapshot(ref.current!));
  useEffect(()=>{
    let frame=0,previous:number|null=null;
    const controller=new SwarmNeuralLoop();loop.current=controller;
    const tick=(time:number)=>{
      const s=ref.current!;
      if(previous!==null&&s.running){advanceSwarm(s,(time-previous)/1000);setView(swarmSnapshot(s));}
      void controller.pump(s,()=>ref.current!,()=>setView(swarmSnapshot(ref.current!)));
      previous=time;frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);controller.dispose();};
  },[]);
  const redeploy=(count=ref.current!.agents.length,coordinated=ref.current!.coordinated)=>{
    missionRevision.current++;loop.current?.cancel();const mode=ref.current!.agents[0].simulation.mode;
    ref.current=createSwarm(count,ref.current!.seed,coordinated);switchSwarm(ref.current,mode);refresh();
  };
  return {...view,missionRevision:missionRevision.current,commanderSnapshot:()=>buildMissionSnapshot(ref.current!),
    toggle:()=>{loop.current?.cancel();runSwarm(ref.current!,!ref.current!.running);refresh();},
    reset:()=>redeploy(),
    deploy:(count:number)=>redeploy(count),
    setCoordinated:(enabled:boolean)=>{const s=ref.current!;s.coordinated=enabled;s.nextPlan=s.elapsed;s.agents.forEach(a=>{a.assignment=null;a.coordination=enabled?'Awaiting shared-map plan':'Independent exploration · local controller';});refresh();},
    selectBug:(index:number)=>{if(index>=0&&index<ref.current!.agents.length){ref.current!.selected=index;refresh();}},
    selectController:(mode:ControllerMode)=>{if(ref.current!.agents[0].simulation.mode!==mode){loop.current?.cancel();switchSwarm(ref.current!,mode);refresh();}},
  };
}
