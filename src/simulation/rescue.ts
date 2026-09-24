import type { BioBug, Environment, Vec2 } from '../domain/types';
import { rayDistance } from './sensors';

export const RESCUE_CONFIG = { interval: .25, lifeRadius: 85, gasRadius: 100, detect: .2, strongLife: .45, strongGas: .65, confirmReadings: 3 } as const;
export type TargetKind = 'life' | 'gas';
export interface RescueTarget { id: string; kind: TargetKind; groundTruthPosition: Vec2 }
export interface RescueReading { life: number; gas: number; exposed: boolean; status: 'EXPLORING' | 'INVESTIGATING' | 'HAZARD EXPOSURE' }
export interface RescueDiscovery {
  id: string; kind: TargetKind; status: 'possible' | 'confirmed' | 'gas warning' | 'high gas';
  estimatedPosition: Vec2; sector: string; confidence: number; observations: number; peakSignal: number;
  firstDetected: number; latestObservation: number; detectedBy: string; confirmedBy: string[];
  observers: string[]; priority: number;
}
export interface RescueEvent { timestamp: number; bugId: string; targetId: string; type: string; estimatedPosition: Vec2; sector: string; signal: number; confidence: number; status: RescueDiscovery['status'] }
interface Track { consecutive: number; confirmed: boolean }
export interface RescueMission {
  targets: RescueTarget[]; discoveries: RescueDiscovery[]; events: RescueEvent[];
  readings: Record<string, RescueReading>; tracks: Record<string, Track>; nextSample: number; completedAt: number | null;
}
const clamp = (n: number, min=0, max=1) => Math.max(min, Math.min(max,n));
export function sector(p: Vec2, width=800, height=560) { return `${'ABCD'[clamp(Math.floor(p.y / height * 4),0,3)]}${clamp(Math.floor(p.x / width * 4),0,3)+1}`; }
export function signalStrength(distance: number, radius: number) { return clamp(1-distance/radius); }
export function createRescueMission(env: Environment): RescueMission {
  return { targets: [...env.survivors.map(s=>({id:s.id,kind:'life' as const,groundTruthPosition:{...s.position}})),
    ...env.hazards.filter(h=>h.kind==='gas').map(h=>({id:h.id,kind:'gas' as const,groundTruthPosition:{...h.position}}))],
    discoveries:[],events:[],readings:{},tracks:{},nextSample:RESCUE_CONFIG.interval,completedAt:null };
}
export const emptyReading = (): RescueReading => ({life:0,gas:0,exposed:false,status:'EXPLORING'});
/** Abstract directional engineering sensor: quantized bearing relative to the agent, not a truth coordinate readout. */
export function observation(env: Environment, bug: BioBug, target: RescueTarget) {
  const dx=target.groundTruthPosition.x-bug.position.x,dy=target.groundTruthPosition.y-bug.position.y,distance=Math.hypot(dx,dy);
  const bearing=Math.atan2(dy,dx), radius=target.kind==='life'?RESCUE_CONFIG.lifeRadius:RESCUE_CONFIG.gasRadius;
  const signal=distance>radius || rayDistance(env,bug.position,bearing,distance)<distance-.001 ? 0 : signalStrength(distance,radius);
  const relative=Math.atan2(Math.sin(bearing-bug.heading),Math.cos(bearing-bug.heading));
  const measuredBearing=bug.heading+Math.round(relative/(Math.PI/6))*(Math.PI/6);
  const measuredRange=Math.max(5,Math.round((1-signal)*radius/10)*10);
  return {signal,estimate:{x:clamp(bug.position.x+Math.cos(measuredBearing)*measuredRange,0,env.width),y:clamp(bug.position.y+Math.sin(measuredBearing)*measuredRange,0,env.height)}};
}
function emit(m:RescueMission,d:RescueDiscovery,bugId:string,time:number,signal:number,type:string) {
  m.events.push({timestamp:time,bugId,targetId:d.id,type,estimatedPosition:{...d.estimatedPosition},sector:d.sector,signal,confidence:d.confidence,status:d.status});
}
/** Sample every quarter simulated second after movement. No wall-clock or fog knowledge enters detection. */
export function sampleRescue(m:RescueMission,env:Environment,bugs:BioBug[],time:number) {
  if(time+1e-9<m.nextSample)return;
  m.nextSample+=RESCUE_CONFIG.interval;
  for(const bug of bugs) {
    const reading=emptyReading();m.readings[bug.id]=reading;
    for(const target of m.targets) {
      const {signal,estimate}=observation(env,bug,target);
      reading[target.kind]=Math.max(reading[target.kind],signal);
      const key=`${bug.id}:${target.id}`,track=m.tracks[key]??(m.tracks[key]={consecutive:0,confirmed:false});
      const strong=signal>=(target.kind==='life'?RESCUE_CONFIG.strongLife:RESCUE_CONFIG.strongGas);
      track.consecutive=strong?track.consecutive+1:0;
      if(signal<RESCUE_CONFIG.detect)continue;
      let d=m.discoveries.find(d=>d.id===target.id);const first=!d;
      if(!d){d={id:target.id,kind:target.kind,status:target.kind==='life'?'possible':'gas warning',estimatedPosition:{...estimate},sector:sector(estimate,env.width,env.height),confidence:0,observations:0,peakSignal:0,firstDetected:time,latestObservation:time,detectedBy:bug.id,confirmedBy:[],observers:[],priority:0};m.discoveries.push(d);}
      const error=Math.hypot(estimate.x-d.estimatedPosition.x,estimate.y-d.estimatedPosition.y);
      const weight=1/Math.min(12,d.observations+1);
      d.estimatedPosition={x:d.estimatedPosition.x*(1-weight)+estimate.x*weight,y:d.estimatedPosition.y*(1-weight)+estimate.y*weight};
      d.observations++;d.peakSignal=Math.max(d.peakSignal,signal);d.latestObservation=time;
      d.sector=sector(d.estimatedPosition,env.width,env.height);
      if(!d.observers.includes(bug.id))d.observers.push(bug.id);
      const confirmedNow=track.consecutive>=RESCUE_CONFIG.confirmReadings&&!track.confirmed;
      if(confirmedNow){track.confirmed=true;d.confirmedBy.push(bug.id);d.status=target.kind==='life'?'confirmed':'high gas';}
      // Monotonic evidence score; persistence is historical evidence, not current medical certainty.
      d.confidence=Math.max(d.confidence,clamp(.2+.3*d.peakSignal+.15*Math.min(1,d.observations/8)+.1*Math.min(1,(time-d.firstDetected)/2)+.1*Math.min(1,(d.observers.length-1)/2)+.1*clamp(1-error/40)+(d.confirmedBy.length?.05:0),0,.99));
      if(first)emit(m,d,bug.id,time,signal,target.kind==='life'?'POSSIBLE LIFE SIGNAL':'GAS HAZARD DETECTED');
      if(confirmedNow)emit(m,d,bug.id,time,signal,target.kind==='life'?(d.confirmedBy.length===1?'SURVIVOR LOCATED':'INDEPENDENT SURVIVOR CONFIRMATION'):'HIGH GAS CONCENTRATION');
      if(target.kind==='life'&&d.status==='possible')reading.status='INVESTIGATING';
    }
    reading.exposed=reading.gas>=RESCUE_CONFIG.strongGas;
    if(reading.exposed)reading.status='HAZARD EXPOSURE';
  }
  for(const d of m.discoveries) {
    const nearbyGas=m.discoveries.some(g=>g.kind==='gas'&&Math.hypot(g.estimatedPosition.x-d.estimatedPosition.x,g.estimatedPosition.y-d.estimatedPosition.y)<120);
    d.priority=Math.round(100*clamp(d.kind==='life'?.7*d.confidence+(nearbyGas?.3:0):d.peakSignal));
  }
  const lives=m.targets.filter(t=>t.kind==='life');
  if(lives.length&&m.completedAt===null&&lives.every(t=>m.discoveries.some(d=>d.id===t.id&&d.status==='confirmed')))m.completedAt=time;
}
/** Operator projection deliberately excludes targets, private association keys and ground-truth positions. */
export function rescueView(m:RescueMission,selectedId:string) {
  return {discoveries:m.discoveries.map(d=>({...d,estimatedPosition:{...d.estimatedPosition},observers:[...d.observers],confirmedBy:[...d.confirmedBy]})),
    events:m.events.map(e=>({...e,estimatedPosition:{...e.estimatedPosition}})),reading:{...(m.readings[selectedId]??emptyReading())},completedAt:m.completedAt,
    confirmed:m.discoveries.filter(d=>d.status==='confirmed').length,possible:m.discoveries.filter(d=>d.kind==='life'&&d.status==='possible').length,hazards:m.discoveries.filter(d=>d.kind==='gas').length};
}
