import type {BioBug,Environment,Vec2} from '../domain/types';
import type {RescueDiscovery,RescueEvent} from '../simulation/rescue';
import {sector} from '../simulation/rescue';
import {rayDistance} from '../simulation/sensors';

/** Illustrative sensor settings, not specifications of a fly-sized device. */
export const THERMAL={interval:.25,range:110,halfFov:Math.PI/3,ambientC:22,minContrastC:2,detect:.12,persistentReadings:3} as const;
export interface HeatSource {key:string;position:Vec2;surfaceC:number}
export interface ThermalFinding {
  id:string;estimatedPosition:Vec2;uncertaintyRadius:number;sector:string;
  apparentC:number;contrastC:number;peakSignal:number;observations:number;
  firstDetected:number;latestObservation:number;detectedBy:string;observers:string[];persistent:boolean;
  observerPosition?:Vec2;
}
export interface ThermalReading {signal:number;apparentC:number|null;contrastC:number;visibleSpots:number}
export interface ThermalState {
  sources:HeatSource[];findings:ThermalFinding[];events:RescueEvent[];readings:Record<string,ThermalReading>;
  associations:Map<string,string>;streaks:Map<string,number>;nextTick:number;seed:number;
}
export const emptyThermal=():ThermalReading=>({signal:0,apparentC:null,contrastC:0,visibleSpots:0});
/** Source type is deliberately absent from sensor input: heat cannot classify people. */
export function createThermal(env:Environment,seed=2026):ThermalState {
  return {sources:[...env.survivors.map(s=>({key:s.id,position:{...s.position},surfaceC:32})),
    {key:'warm-equipment',position:{x:180,y:450},surfaceC:32},
    {key:'warm-rubble',position:{x:420,y:180},surfaceC:36}],
    findings:[],events:[],readings:{},associations:new Map(),streaks:new Map(),nextTick:15,seed};
}
function noise(seed:number,key:string,tick:number,channel:number){
  let n=(seed^tick^Math.imul(channel+1,0x9e3779b9))>>>0;
  for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;
  return ((n>>>0)/4294967295)*2-1;
}
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
export interface ThermalGeometry {altitude:(bug:BioBug)=>number;visible:(bug:BioBug,source:HeatSource)=>boolean}
export function thermalObservation(env:Environment,bug:BioBug,source:HeatSource,tick:number,seed:number,geometry?:ThermalGeometry){
  const dx=source.position.x-bug.position.x,dy=source.position.y-bug.position.y,planarDistance=Math.hypot(dx,dy),distance=Math.hypot(planarDistance,geometry?.altitude(bug)??0),bearing=Math.atan2(dy,dx);
  const relative=Math.atan2(Math.sin(bearing-bug.heading),Math.cos(bearing-bug.heading));
  if(distance>THERMAL.range||Math.abs(relative)>THERMAL.halfFov||(geometry?!geometry.visible(bug,source):rayDistance(env,bug.position,bearing,distance)<distance-.001))return null;
  const key=`${bug.id}:${source.key}`,apparentC=Math.round((source.surfaceC+.3*noise(seed,key,tick,0))*10)/10;
  const contrastC=apparentC-THERMAL.ambientC;
  const signal=clamp(contrastC/15)*clamp(1-distance/THERMAL.range);
  if(contrastC<THERMAL.minContrastC||signal<THERMAL.detect)return null;
  // No thermal monocular ranging claim: this is an explicitly simulated range/localization aid.
  const range=Math.max(0,Math.round(planarDistance/10)*10+5*noise(seed,key,tick,1));
  const angle=bug.heading+Math.round(relative/(Math.PI/22.5))*(Math.PI/22.5)+(Math.PI/60)*noise(seed,key,tick,2);
  const estimatedPosition={x:clamp(bug.position.x+6*noise(seed,key,tick,3)+Math.cos(angle)*range,0,env.width),y:clamp(bug.position.y+6*noise(seed,key,tick,4)+Math.sin(angle)*range,0,env.height)};
  // Conservative engineering bound for the injected range, bearing and pose errors; not a confidence interval.
  const uncertaintyRadius=Math.ceil(22+.15*range);
  return {signal,apparentC,contrastC,estimatedPosition,uncertaintyRadius};
}
/** Called after every physics tick. Independent of render rate, wall clock and neural evaluation. */
export function sampleThermal(s:ThermalState,env:Environment,bugs:BioBug[],tick:number,geometry?:ThermalGeometry){
  if(tick<s.nextTick)return;s.nextTick=tick+15;const time=tick/60;
  for(const bug of bugs){
    const reading=emptyThermal();s.readings[bug.id]=reading;
    for(const source of s.sources){
      const key=`${bug.id}:${source.key}`,o=thermalObservation(env,bug,source,tick,s.seed,geometry);
      if(!o){s.streaks.set(key,0);continue;}
      reading.visibleSpots++;if(o.signal>reading.signal){reading.signal=o.signal;reading.apparentC=o.apparentC;reading.contrastC=o.contrastC;}
      const streak=(s.streaks.get(key)??0)+1;s.streaks.set(key,streak);
      let id=s.associations.get(source.key),d=s.findings.find(f=>f.id===id);const first=!d;
      if(!d){id=`T-${String(s.findings.length+1).padStart(3,'0')}`;s.associations.set(source.key,id);d={id,estimatedPosition:{...o.estimatedPosition},uncertaintyRadius:o.uncertaintyRadius,sector:'',apparentC:o.apparentC,contrastC:o.contrastC,peakSignal:0,observations:0,firstDetected:time,latestObservation:time,detectedBy:bug.id,observers:[],persistent:false};s.findings.push(d);}
      const newlyPersistent=!d.persistent&&streak>=THERMAL.persistentReadings;
      d.estimatedPosition={...o.estimatedPosition};d.uncertaintyRadius=o.uncertaintyRadius;d.sector=sector(o.estimatedPosition,env.width,env.height);d.apparentC=o.apparentC;d.contrastC=o.contrastC;
      d.peakSignal=Math.max(d.peakSignal,o.signal);d.observations++;d.latestObservation=time;d.persistent||=newlyPersistent;
      if(geometry)d.observerPosition={...bug.position};
      if(!d.observers.includes(bug.id))d.observers.push(bug.id);
      if(first||newlyPersistent)s.events.push({timestamp:time,bugId:bug.id,targetId:d.id,type:first?'UNIDENTIFIED HEAT DETECTED':'REPEATED HEAT OBSERVATIONS — IDENTITY UNKNOWN',estimatedPosition:{...d.estimatedPosition},sector:d.sector,signal:o.signal,confidence:0,status:'possible'});
    }
  }
}
/** Detached, anonymous observation records only. No source identity, category or truth position. */
export function thermalView(s:ThermalState,selectedId:string){return {
  findings:s.findings.map(d=>({...d,estimatedPosition:{...d.estimatedPosition},observers:[...d.observers]})),
  reading:{...(s.readings[selectedId]??emptyThermal())},
  events:s.events.map(e=>({...e,estimatedPosition:{...e.estimatedPosition}})),
};}
/** Compatibility projection for existing map markers. Never use legacy survivor confirmation. */
export function thermalMarkers(findings:ThermalFinding[]):RescueDiscovery[]{return findings.map(d=>({
  id:d.id,kind:'life',status:'possible',estimatedPosition:{...d.estimatedPosition},sector:d.sector,confidence:0,
  observations:d.observations,peakSignal:d.peakSignal,firstDetected:d.firstDetected,latestObservation:d.latestObservation,
  detectedBy:d.detectedBy,confirmedBy:[],observers:[...d.observers],priority:0,
}));}
