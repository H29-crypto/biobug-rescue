import type {SwarmSimulation} from '../simulation/swarm';
import {swarmSnapshot} from '../simulation/swarm';
import {buildMissionSnapshot} from '../simulation/commanderSnapshot';
import type {MissionSnapshot} from '../simulation/commanderSnapshot';
import {thermalView,thermalMarkers} from './thermal';
import type {ThermalState} from './thermal';

export function thermalMissionView(world:SwarmSimulation,thermal:ThermalState){
  const base=swarmSnapshot(world),heat=thermalView(thermal,base.bug.id);
  const gas=base.rescue.discoveries.filter(d=>d.kind==='gas');
  const events=[...base.rescue.events.filter(e=>gas.some(d=>d.id===e.targetId)),...heat.events].sort((a,b)=>a.timestamp-b.timestamp);
  return {...base,thermal:heat,rescue:{...base.rescue,discoveries:[...thermalMarkers(heat.findings),...gas],events,
    completedAt:null,confirmed:0,possible:0,reading:{...base.rescue.reading,life:0,status:base.rescue.reading.exposed?'HAZARD EXPOSURE' as const:'EXPLORING' as const}}};
}
export function thermalMissionSnapshot(world:SwarmSimulation,thermal:ThermalState):MissionSnapshot {
  const base=buildMissionSnapshot(world),view=thermalMissionView(world,thermal);
  return {...base,survivors:[],completedAt:null,
    agents:base.agents.map(a=>({...a,status:a.status==='INVESTIGATING'?'EXPLORING':a.status})),
    recentEvents:view.rescue.events.slice(-6).map(e=>({timestamp:Number(e.timestamp.toFixed(2)),bugId:e.bugId,targetId:e.targetId,type:e.type,sector:e.sector})),
    thermalFindings:view.thermal.findings.map(d=>({id:d.id,estimatedLocation:{...d.estimatedPosition},uncertaintyRadius:d.uncertaintyRadius,
      sector:d.sector,apparentC:d.apparentC,contrastC:d.contrastC,observations:d.observations,firstDetected:d.firstDetected,
      latestObservation:d.latestObservation,detectedBy:d.detectedBy,observers:[...d.observers],persistent:d.persistent})),
  };
}
