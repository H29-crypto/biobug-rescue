import {useEffect,useRef,useState} from 'react';
import type {ControllerMode} from '../simulation/engine';
import type {Vec2} from '../domain/types';
import {createRescueLab,advanceMission,runMission,switchMission,rescueLabView,rescueLabSnapshot,issueCommand,setMissionLink,investigateHeat} from './rescueMission';
import {MissionNeuralLoop} from './missionNeural';
export function useRescueLab(){
  const [initial]=useState(()=>createRescueLab()),state=useRef(initial),loop=useRef<MissionNeuralLoop|null>(null),revision=useRef(0),[,render]=useState(0);
  const refresh=()=>render(n=>n+1);
  useEffect(()=>{const neural=new MissionNeuralLoop();loop.current=neural;let frame=0,previous:number|null=null,lastPaint=0;
    const tick=(now:number)=>{const s=state.current;if(previous!==null)advanceMission(s,(now-previous)/1000);void neural.pump(s,()=>state.current,refresh);previous=now;if(now-lastPaint>=1000/30){refresh();lastPaint=now;}frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);neural.dispose();};
  },[]);
  const s=state.current,view=rescueLabView(s),selected=s.world.selected,sim=s.world.agents[selected].simulation;
  return {...view,revision:revision.current,history:s.histories[selected],neuralSuspended:!view.operation.connected||s.ops[selected].authority==='operator',
    anatomy:{config:{mode:sim.mode},running:s.world.running,elapsed:s.world.elapsed,neural:{status:sim.neural.status},fly:{turning:s.proposals[selected]}},
    select:(index:number)=>{if(index>=0&&index<s.world.agents.length){s.world.selected=index;refresh();}},
    toggle:()=>{loop.current?.cancel();runMission(s,!s.world.running);refresh();},
    reset:(count=s.world.agents.length)=>{loop.current?.cancel();const fresh=createRescueLab(count,s.world.seed,s.world.coordinated);switchMission(fresh,sim.mode);state.current=fresh;revision.current++;refresh();},
    controller:(mode:ControllerMode)=>{if(s.world.running)return;loop.current?.cancel();switchMission(s,mode);refresh();},
    coordinate:(enabled:boolean)=>{if(s.world.running)return;s.world.coordinated=enabled;s.world.nextPlan=s.world.elapsed;refresh();},
    command:(kind:'operator'|'explore'|'flight'|'land')=>{issueCommand(s,s.world.selected,{kind});refresh();},
    waypoint:(target:Vec2)=>{const ok=issueCommand(s,s.world.selected,{kind:'waypoint',target});refresh();return ok;},
    steer:(forward:number,angular:number)=>{issueCommand(s,s.world.selected,{kind:'manual',forward,angular});refresh();},
    link:(connected:boolean)=>{setMissionLink(s,s.world.selected,connected);refresh();},
    investigate:(id:string)=>{const ok=investigateHeat(s,id);refresh();return ok;},
    commanderSnapshot:()=>rescueLabSnapshot(state.current),
    exportOperations:()=>({agents:s.world.agents.map((a,i)=>({id:a.simulation.bug.id,connected:s.ops[i].connected,packetTime:s.ops[i].packet?.time??null,battery:s.ops[i].packet?.battery??null,position:s.ops[i].packet?{...s.ops[i].packet!.position}:null,altitude:s.ops[i].packet?.altitude??null,task:s.ops[i].packet?.task??null})),investigations:[...s.receivedInvestigations.values()].map(t=>structuredClone(t)),events:s.events.map(e=>({...e}))}),
  };
}
