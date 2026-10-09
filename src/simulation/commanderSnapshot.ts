import type { SwarmSimulation } from './swarm';
import { coverage } from './exploration';
import { sector } from './rescue';

/** Explicit allowlist; never serialize Simulation, environment, targets or neural response objects. */
export function buildMissionSnapshot(s:SwarmSimulation) {
  const first=s.agents[0].simulation;
  return {
    missionTime:Number(s.elapsed.toFixed(2)),controllerMode:s.agents[0].simulation.mode,
    completedAt:s.rescue.completedAt===null?null:Number(s.rescue.completedAt.toFixed(2)),
    swarm:{deployed:s.agents.length,active:s.running?s.agents.length:0,coverage:Number(coverage(first.environment,first.accessible).toFixed(2))},
    survivors:s.rescue.discoveries.filter(d=>d.kind==='life').map(d=>({id:d.id,status:d.status,sector:d.sector,confidence:Number(d.confidence.toFixed(3)),
      estimatedLocation:{x:Number(d.estimatedPosition.x.toFixed(1)),y:Number(d.estimatedPosition.y.toFixed(1))},detectedBy:d.detectedBy,
      confirmedBy:[...d.confirmedBy],observers:[...d.observers],firstDetected:Number(d.firstDetected.toFixed(2)),latestObservation:Number(d.latestObservation.toFixed(2)),observations:d.observations})),
    hazards:s.rescue.discoveries.filter(d=>d.kind==='gas').map(d=>({id:d.id,type:'gas',status:d.status,sector:d.sector,confidence:Number(d.confidence.toFixed(3)),severity:Number(d.peakSignal.toFixed(3)),detectedBy:d.detectedBy})),
    agents:s.agents.map(a=>{const sim=a.simulation,r=sim.neural.response,d=sim.neural.decision;return {id:sim.bug.id,status:s.running?(s.rescue.readings[sim.bug.id]?.status??'EXPLORING'):'PAUSED',sector:sector(sim.bug.position),
      controller:sim.mode==='malecns'&&r&&d?{status:sim.neural.status,stimulus:{...r.stimulus},dna02L:r.dna02.L.peak,dna02R:r.dna02.R.peak,decoderDecision:d.action}:null};}),
    recentEvents:s.rescue.events.slice(-6).map(e=>({timestamp:Number(e.timestamp.toFixed(2)),bugId:e.bugId,targetId:e.targetId,type:e.type,sector:e.sector})),
  };
}
export interface ThermalReport {
  id:string;estimatedLocation:{x:number;y:number};uncertaintyRadius:number;sector:string;apparentC:number;contrastC:number;
  observations:number;firstDetected:number;latestObservation:number;detectedBy:string;observers:string[];persistent:boolean;
}
export type MissionSnapshot=ReturnType<typeof buildMissionSnapshot>&{thermalFindings?:ThermalReport[]};
export function systemSummary(s:MissionSnapshot) {
  if(s.thermalFindings)return `${s.thermalFindings.length} unidentified heat sources; heat alone cannot confirm a person, animal or life. ${s.hazards.length} gas hazards detected. Coverage: ${s.swarm.coverage.toFixed(1)}%. Locations are uncertain; human verification is required.`;
  return `${s.survivors.filter(d=>d.status==='confirmed').length} survivors confirmed; ${s.survivors.filter(d=>d.status==='possible').length} possible life signals; ${s.hazards.length} gas hazards detected. Coverage: ${s.swarm.coverage.toFixed(1)}%. Undetected hazards may remain.`;
}
