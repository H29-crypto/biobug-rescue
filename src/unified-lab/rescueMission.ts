import type {Environment,Vec2,BioBug} from '../domain/types';
import {createSwarm,runSwarm,switchSwarm,swarmSnapshot} from '../simulation/swarm';
import type {SwarmSimulation} from '../simulation/swarm';
import type {ControllerMode} from '../simulation/engine';
import {FIXED_STEP,neuralDue} from '../simulation/engine';
import {control,chooseTurn} from '../simulation/controller';
import type {MotorCommand} from '../simulation/controller';
import {sense} from '../simulation/sensors';
import {mapSensors} from '../simulation/sensorMapping';
import {assignFrontiers} from '../simulation/frontiers';
import {cellCenter,coverage,isExplored} from '../simulation/exploration';
import {sampleRescue,createRescueMission} from '../simulation/rescue';
import {createThermal,sampleThermal,thermalView,thermalMarkers} from './thermal';
import type {ThermalState} from './thermal';
import {RescueActivity} from './activity';
import {AnatomicalHistory} from '../virtual-fly/anatomicalTelemetry';
import {SPACE,configureSpace,sliceAt,travel3D,groundVisible,knownRoute} from './space';
import {BACKPACK,emptyCommand} from './operations';
import type {OperatorAgent,MissionCommand,MissionEvent,Investigation,RadioPacket} from './operations';
import {sector} from '../simulation/rescue';
import {thermalMissionSnapshot} from './thermalMission';

export interface RescueMissionState {world:SwarmSimulation;environment:Environment;ops:OperatorAgent[];thermal:ThermalState;activity:RescueActivity;histories:AnatomicalHistory[];proposals:string[];events:MissionEvent[];investigations:Investigation[];receivedInvestigations:Map<string,Investigation>;gas:SwarmSimulation['rescue'];heatOrigins:Map<string,Map<string,Vec2>>;revision:number}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.y-b.y);
export function missionLog(s:RescueMissionState,i:number,text:string){s.events.unshift({time:s.world.elapsed,agentId:s.world.agents[i]?.simulation.bug.id??'Team',text});if(s.events.length>80)s.events.pop();}
export function createRescueLab(count=4,seed=2026,coordinated=true):RescueMissionState{
  const world=createSwarm(count,seed,coordinated),env=world.agents[0].simulation.environment;configureSpace(env);
  const shared={...env,exploration:{...env.exploration,explored:[...env.exploration.explored]}};
  const ops:OperatorAgent[]=world.agents.map(a=>{a.simulation.environment={...env,exploration:{...env.exploration,explored:[...env.exploration.explored]}};
    return {authority:'explore',resume:'explore',goal:null,route:[],task:'Exploring revealed frontiers',findingId:null,taskStarted:0,scanRemaining:0,scanStarted:0,
      altitude:SPACE.ground,targetAltitude:SPACE.ground,phase:'grounded',speed:0,angular:0,manual:emptyCommand(),lease:0,battery:100,connected:true,lowBattery:false,commandEpoch:0,
      commands:[],motionTrace:[],actuations:[],desired:emptyCommand(),localHeat:createThermal(env,seed),packet:null,pendingPackets:[],nextPacket:0,seenHeat:new Map(),explanation:null};});
  // Life targets are never used by this mission; only independent thermal observations and gas sensing.
  world.rescue=createRescueMission({...env,survivors:[]});
  const s:RescueMissionState={world,environment:shared,ops,thermal:createThermal(env,seed),activity:new RescueActivity(),histories:ops.map(()=>new AnatomicalHistory()),proposals:ops.map(()=>'NO_SAMPLE'),events:[],investigations:[],receivedInvestigations:new Map(),gas:createRescueMission({...env,survivors:[]}),heatOrigins:new Map(),revision:0};
  for(let i=0;i<count;i++){sense(sliceAt(env,ops[i].altitude),world.agents[i].simulation.bug);recordMotion(s,i);capture(s,i);deliver(s,i,true);}return s;
}
export function runMission(s:RescueMissionState,running:boolean){runSwarm(s.world,running);for(const o of s.ops){o.speed=o.angular=0;o.lease=0;o.actuations=[];o.desired=emptyCommand();o.commands=o.commands.filter(c=>c.command.kind!=='manual');}if(!running)missionLog(s,s.world.selected,'Simulation paused. Queued radio messages and battery clocks also freeze.');}
export function switchMission(s:RescueMissionState,mode:ControllerMode){if(s.world.running)return;switchSwarm(s.world,mode);s.activity=new RescueActivity();s.histories=s.ops.map(()=>new AnatomicalHistory());s.proposals=s.ops.map(()=>'NO_SAMPLE');s.ops.forEach(o=>{o.pendingPackets=[];if(o.packet){o.packet.activity=null;o.packet.explanation=null;}o.nextPacket=s.world.elapsed;});missionLog(s,s.world.selected,`Controller selected: ${mode}. Guidance and collision safety remain engineering logic.`);}
export const needsNeural=(s:RescueMissionState,i:number)=>s.ops[i].battery>0&&s.ops[i].authority!=='operator'&&s.ops[i].authority!=='hold'&&neuralDue(s.world.agents[i].simulation);
export function issueCommand(s:RescueMissionState,i:number,command:MissionCommand){
  const o=s.ops[i];if(!o||!o.connected||o.battery<=0){missionLog(s,i,'Command rejected: backpack unavailable.');return false;}
  if(command.target&&![command.target.x,command.target.y].every(Number.isFinite))return false;
  if(command.kind==='waypoint'&&command.target&&!isExplored(s.environment,command.target)){missionLog(s,i,'Destination rejected: operator map has not revealed that cell.');return false;}
  if(command.kind==='manual'&&(!Number.isFinite(command.forward)||!Number.isFinite(command.angular)))return false;
  o.commands.push({due:s.world.elapsed+BACKPACK.commandDelay,epoch:o.commandEpoch,command:{...command,target:command.target?{...command.target}:undefined}});
  if(o.commands.length>20)o.commands.shift();missionLog(s,i,`Queued ${command.kind} command; simulated radio delay ${BACKPACK.commandDelay.toFixed(2)} s.`);return true;
}
function invalidate(s:RescueMissionState,i:number){const sim=s.world.agents[i].simulation;sim.generation++;sim.neural.decision=null;sim.nextDecision=s.world.elapsed;s.ops[i].actuations=[];s.ops[i].desired=emptyCommand();s.ops[i].speed=s.ops[i].angular=0;}
export function setMissionLink(s:RescueMissionState,i:number,connected:boolean){const o=s.ops[i];if(o.connected===connected)return;o.connected=connected;o.commandEpoch++;o.commands=[];o.pendingPackets=[];
  if(!connected){o.manual=emptyCommand();o.lease=0;o.actuations=[];o.desired=emptyCommand();}
  else o.nextPacket=s.world.elapsed;
  missionLog(s,i,connected?'Radio restored. Awaiting a fresh delayed packet.':'Radio lost. Manual commands expire; the onboard task continues. Operator map and reports retain their last received data.');}
function cancelInvestigation(s:RescueMissionState,i:number){for(const task of s.investigations)if(task.agentId===s.world.agents[i].simulation.bug.id&&task.finished===null){task.status='cancelled';task.finished=s.world.elapsed;task.message='Superseded by an operator command.';}}
function applyCommand(s:RescueMissionState,i:number,c:MissionCommand){
  const o=s.ops[i],sim=s.world.agents[i].simulation,env=sim.environment;
  if(c.kind==='manual'){if(o.authority!=='operator')return;o.manual={forward:clamp(c.forward!, -1,1)*sim.bug.speed,angular:clamp(c.angular!,-1,1)*1.9};o.lease=BACKPACK.manualLease;return;}
  if(c.kind==='flight'){
    if(!travel3D(env,sim.bug.position,o.altitude,sim.bug.position,SPACE.cruise,sim.bug.radius)){missionLog(s,i,'Takeoff rejected: insufficient vertical clearance.');return;}
    o.targetAltitude=SPACE.cruise;o.phase='taking off';o.route=[];o.actuations=[];missionLog(s,i,'Takeoff accepted. Horizontal movement waits for cruise altitude.');return;
  }
  if(c.kind==='land'){
    if(!travel3D(env,sim.bug.position,o.altitude,sim.bug.position,SPACE.ground,sim.bug.radius)){missionLog(s,i,'Landing rejected: debris or a slab blocks the descent. Move to clear floor first.');return;}
    o.targetAltitude=SPACE.ground;o.phase='landing';o.route=[];o.actuations=[];missionLog(s,i,'Landing accepted over clear floor.');return;
  }
  if(c.kind==='waypoint'||c.kind==='investigate'){
    if(!c.target)return;const route=knownRoute(env,sim.bug.position,c.target,o.altitude,sim.bug.radius);
    if(!route){o.task='Destination blocked, unrevealed or unreachable at current altitude';missionLog(s,i,o.task);const task=s.investigations.find(t=>t.agentId===sim.bug.id&&t.findingId===c.findingId&&t.finished===null);if(task){task.status='blocked';task.finished=s.world.elapsed;task.message=o.task;}return;}
    cancelInvestigationExcept(s,i,c.findingId);invalidate(s,i);o.goal={...c.target};o.route=route;o.authority=c.kind==='investigate'?'investigate':'waypoint';o.findingId=c.findingId??null;o.taskStarted=s.world.elapsed;o.scanRemaining=0;o.scanStarted=0;
    o.task=c.kind==='investigate'?`Approaching another viewpoint for ${c.findingId}`:'Following a route through revealed space';
    const task=s.investigations.find(t=>t.agentId===sim.bug.id&&t.findingId===c.findingId&&t.finished===null);if(task)task.status='en route';missionLog(s,i,o.task);return;
  }
  cancelInvestigation(s,i);invalidate(s,i);
  if(c.kind==='operator'){o.resume=o.authority;o.authority='operator';o.task='Operator control: pulses expire automatically';o.manual=emptyCommand();o.lease=0;}
  if(c.kind==='explore'){o.authority='explore';o.goal=null;o.route=[];o.findingId=null;o.task='Autonomous exploration resumed';}
  missionLog(s,i,o.task);
}
function cancelInvestigationExcept(s:RescueMissionState,i:number,id?:string){for(const t of s.investigations)if(t.agentId===s.world.agents[i].simulation.bug.id&&t.finished===null&&t.findingId!==id){t.status='cancelled';t.finished=s.world.elapsed;t.message='Reassigned';}}
export function investigateHeat(s:RescueMissionState,id:string){
  const f=s.thermal.findings.find(d=>d.id===id);if(!f)return false;
  if(s.investigations.some(t=>t.findingId===id&&t.finished===null)){missionLog(s,s.world.selected,'Investigation already assigned.');return false;}
  const candidates=s.world.agents.map((a,i)=>({a,i,o:s.ops[i],old:f.observers.includes(a.simulation.bug.id)})).filter(({o})=>o.connected&&o.battery>BACKPACK.reserve&&o.authority==='explore'&&o.phase!=='taking off'&&o.phase!=='landing').sort((a,b)=>Number(a.old)-Number(b.old)||distance(a.o.packet?.position??a.a.simulation.bug.position,f.estimatedPosition)-distance(b.o.packet?.position??b.a.simulation.bug.position,f.estimatedPosition)||a.i-b.i);
  for(const {a,i,o}of candidates){const origins=s.heatOrigins.get(id),origin=origins?.values().next().value??a.simulation.bug.position;
    const points=s.environment.exploration.explored.map((_,j)=>cellCenter(s.environment,j)).filter((p,j)=>s.environment.exploration.explored[j]&&distance(p,f.estimatedPosition)>=20&&distance(p,f.estimatedPosition)<=70&&distance(p,origin)>=25).sort((p,q)=>distance(p,f.estimatedPosition)-distance(q,f.estimatedPosition));
    for(const p of points){if(!knownRoute(a.simulation.environment,a.simulation.bug.position,p,o.altitude,a.simulation.bug.radius))continue;
      const task:Investigation={id:`I-${s.investigations.length+1}`,findingId:id,agentId:a.simulation.bug.id,started:s.world.elapsed,finished:null,status:'queued',target:{...p},message:'Re-observe from a separated viewpoint. Heat identity remains unknown.'};
      s.investigations.push(task);s.receivedInvestigations.set(task.id,structuredClone(task));if(!issueCommand(s,i,{kind:'investigate',target:p,findingId:id})){task.status='blocked';task.finished=s.world.elapsed;return false;}missionLog(s,i,`Investigation ${id} assigned to ${a.simulation.bug.id}.`);return true;
    }}missionLog(s,s.world.selected,'No available insect and reachable revealed viewpoint. Explore further or release operator control.');return false;
}
function navigation(s:RescueMissionState,i:number,proposed:MotorCommand):{command:MotorCommand;reason:string}{
  const o=s.ops[i],a=s.world.agents[i],bug=a.simulation.bug;
  if(o.battery<=0||o.authority==='hold')return {command:emptyCommand(),reason:'Backpack exhausted: modeled safety hold'};
  if(o.phase==='taking off'||o.phase==='landing')return {command:emptyCommand(),reason:`Vertical ${o.phase}; horizontal motion held`};
  if(o.authority==='operator')return {command:o.lease>0?{...o.manual}:emptyCommand(),reason:o.lease>0?'Operator steering pulse':'Operator deadman hold'};
  if(o.authority==='investigate'&&o.scanRemaining>0){o.scanRemaining=Math.max(0,o.scanRemaining-FIXED_STEP);return {command:{forward:0,angular:.75},reason:'Scanning heat viewpoint; no identity inference'};}
  if(o.authority==='waypoint'||o.authority==='investigate'){
    while(o.route.length&&distance(bug.position,o.route[0])<5)o.route.shift();
    if(!o.route.length&&o.goal&&distance(bug.position,o.goal)>7)o.route=knownRoute(a.simulation.environment,bug.position,o.goal,o.altitude,bug.radius)??[];
    if(!o.route.length){
      if(o.goal&&distance(bug.position,o.goal)>7)return {command:emptyCommand(),reason:'Task route blocked; awaiting new command'};
      if(o.authority==='investigate'&&o.scanStarted===0){o.scanStarted=s.world.elapsed;o.scanRemaining=9;o.task='Scanning from a separated viewpoint';const t=s.investigations.find(t=>t.agentId===bug.id&&t.finished===null);if(t)t.status='scanning';return {command:{forward:0,angular:.75},reason:'Begin viewpoint scan'};}
      o.task='Destination reached';return {command:emptyCommand(),reason:'Destination reached'};
    }
    // Routing is engineered. Strong local avoidance continues to take priority over the task.
    if(bug.sensors.frontDistance<18||Math.abs(proposed.angular)>.8)return {command:proposed,reason:'Local obstacle response overrides task route'};
    const p=o.route[0],error=angle(Math.atan2(p.y-bug.position.y,p.x-bug.position.x)-bug.heading);
    return {command:{forward:Math.abs(error)>.6?0:Math.min(bug.speed,distance(bug.position,p)*2),angular:clamp(error*3,-1.9,1.9)},reason:`${o.authority} guidance through revealed cells`};
  }
  const path=a.assignment?.path;
  while(path?.length&&distance(bug.position,path[0])<12)path.shift();
  if(s.world.coordinated&&path?.length&&bug.sensors.frontDistance>=22&&Math.abs(proposed.angular)<=.8){const e=angle(Math.atan2(path[0].y-bug.position.y,path[0].x-bug.position.x)-bug.heading);return {command:{forward:Math.abs(e)>.8?0:proposed.forward,angular:clamp(e*2,-1.5,1.5)},reason:'Shared-map frontier guidance'};}
  return {command:proposed,reason:a.simulation.mode==='malecns'?'MaleCNS proposal + engineering decoder':'Rule-based obstacle response'};
}
function recordMotion(s:RescueMissionState,i:number){const sim=s.world.agents[i].simulation,o=s.ops[i],bug=sim.bug;
  o.motionTrace.push({time:s.world.elapsed,x:bug.position.x,y:bug.position.y,heading:bug.heading,altitude:o.altitude,distance:sim.metrics['rule-based'].distance+sim.metrics.malecns.distance,state:bug.state,motion:o.phase==='grounded'?'walk':'flight'});
  if(o.motionTrace.length>64)o.motionTrace.shift();
}
function capture(s:RescueMissionState,i:number){const o=s.ops[i],sim=s.world.agents[i].simulation;
  if(!o.connected||o.battery<=0)return;
  const p:RadioPacket={time:s.world.elapsed,due:s.world.elapsed+BACKPACK.packetDelay,position:{...sim.bug.position},heading:sim.bug.heading,altitude:o.altitude,phase:o.phase,state:sim.bug.state,battery:o.battery,authority:o.authority,task:o.task,explored:[...sim.environment.exploration.explored],
    heat:[...o.localHeat.associations].map(([association,id])=>({association,finding:structuredClone(o.localHeat.findings.find(f=>f.id===id)!)})),reading:{...(o.localHeat.readings[sim.bug.id]??{signal:0,apparentC:null,contrastC:0,visibleSpots:0})},
    gas:s.world.rescue.discoveries.filter(d=>d.kind==='gas'&&d.observers.includes(sim.bug.id)).map(d=>({...structuredClone(d),observers:[sim.bug.id],confirmedBy:d.confirmedBy.includes(sim.bug.id)?[sim.bug.id]:[]})),explanation:o.explanation?structuredClone(o.explanation):null,
    motionSamples:o.motionTrace.map(p=>({...p})),route:o.route.map(v=>({...v})),distance:sim.metrics['rule-based'].distance+sim.metrics.malecns.distance,coordination:s.world.agents[i].coordination,ownCoverage:coverage(sim.environment,sim.accessible),peerBlocks:s.world.agents[i].peerBlocks,novelCells:s.world.agents[i].novelCells,neuralStatus:sim.neural.status,investigations:s.investigations.filter(t=>t.agentId===sim.bug.id).map(t=>structuredClone(t)),sensors:{...sim.bug.sensors},gasSignal:s.world.rescue.readings[sim.bug.id]?.gas??0,activity:null};
  const history=s.activity.get(sim),latest=history.samples.at(-1);if(latest)p.activity={graph:history.graph,ids:[...history.ids],time:latest.time,sequence:latest.sequence,values:[...latest.values],proposal:s.activity.proposal(sim)};
  o.pendingPackets.push(p);o.nextPacket=s.world.elapsed+BACKPACK.packetInterval;
}
function deliver(s:RescueMissionState,i:number,initial=false){const o=s.ops[i],bug=s.world.agents[i].simulation.bug;if(!o.connected||o.battery<=0)return;
  while(o.pendingPackets.length&&(initial||o.pendingPackets[0].due<=s.world.elapsed+1e-9)){
    const p=o.pendingPackets.shift()!;o.packet=p;p.investigations.forEach(t=>s.receivedInvestigations.set(t.id,structuredClone(t)));p.explored.forEach((known,j)=>{if(known)s.environment.exploration.explored[j]=true;});
    if(p.activity){const a=p.activity,h=s.histories[i];if(!h.samples.length||a.sequence>h.samples.at(-1)!.sequence){h.graph=a.graph;h.ids=[...a.ids];h.samples.push({time:a.time,sequence:a.sequence,values:[...a.values]});if(h.samples.length>180)h.samples.shift();s.proposals[i]=a.proposal;}}
    for(const {association,finding:f}of p.heat){const previous=o.seenHeat.get(association)??0,diff=f.observations-previous;if(diff<=0)continue;o.seenHeat.set(association,f.observations);
      let id=s.thermal.associations.get(association),d=s.thermal.findings.find(d=>d.id===id);const first=!d;
      if(!d){id=`T-${String(s.thermal.findings.length+1).padStart(3,'0')}`;d={...structuredClone(f),id,observations:0,observers:[],detectedBy:bug.id};s.thermal.associations.set(association,id);s.thermal.findings.push(d);}
      if(f.latestObservation>=d.latestObservation){d.estimatedPosition={...f.estimatedPosition};d.uncertaintyRadius=f.uncertaintyRadius;d.latestObservation=f.latestObservation;d.apparentC=f.apparentC;d.contrastC=f.contrastC;d.sector=f.sector;}
      d.firstDetected=Math.min(d.firstDetected,f.firstDetected);d.observations+=diff;d.persistent||=f.persistent;d.peakSignal=Math.max(d.peakSignal,f.peakSignal);if(!d.observers.includes(bug.id))d.observers.push(bug.id);
      delete d.observerPosition;
      let origins=s.heatOrigins.get(d.id);if(!origins){origins=new Map();s.heatOrigins.set(d.id,origins);}origins.set(bug.id,{...(f.observerPosition??p.position)});
      if(first)s.thermal.events.push({timestamp:f.firstDetected,bugId:bug.id,targetId:d.id,type:'UNIDENTIFIED HEAT DETECTED',estimatedPosition:{...d.estimatedPosition},sector:d.sector,signal:d.peakSignal,confidence:0,status:'possible'});
    }
    for(const gas of p.gas){const old=s.gas.discoveries.find(d=>d.id===gas.id);if(!old)s.gas.discoveries.push(structuredClone(gas));else{const observers=[...new Set([...old.observers,...gas.observers])],confirmedBy=[...new Set([...old.confirmedBy,...gas.confirmedBy])];if(gas.latestObservation>=old.latestObservation)Object.assign(old,structuredClone(gas));old.observers=observers;old.confirmedBy=confirmedBy;}}
    const merged=s.environment.exploration.explored;s.world.agents.forEach((a,j)=>{if(s.ops[j].connected)merged.forEach((v,k)=>{if(v)a.simulation.environment.exploration.explored[k]=true;});});
  }
}
function reveal3D(env:Environment,bug:BioBug,z:number){env.exploration.explored.forEach((known,i)=>{if(known)return;const p=cellCenter(env,i);if(distance(p,bug.position)<=75&&groundVisible(env,bug.position,z,p))env.exploration.explored[i]=true;});}
function finishTasks(s:RescueMissionState,i:number){const o=s.ops[i],id=s.world.agents[i].simulation.bug.id,t=s.investigations.find(t=>t.agentId===id&&t.finished===null);
  if(!t)return;
  if(s.world.elapsed-t.started>60){t.status='blocked';t.finished=s.world.elapsed;t.message='Task exceeded 60 simulated seconds; no success inferred.';o.authority='explore';o.route=[];o.goal=null;o.task='Investigation timed out; exploration resumed';missionLog(s,i,o.task);return;}
  if(o.scanStarted>0&&o.scanRemaining<=0){const association=[...s.thermal.associations].find(([,v])=>v===t.findingId)?.[0],localId=association?o.localHeat.associations.get(association):undefined;
    const local=o.localHeat.findings.find(f=>f.id===localId);t.status=local&&local.latestObservation>=o.scanStarted?'observed again':'no new observation';t.finished=s.world.elapsed;t.message=t.status==='observed again'?'Heat observed again; identity and life remain unverified.':'No matching new heat observation. Absence does not exclude a survivor.';o.authority='explore';o.route=[];o.goal=null;o.findingId=null;o.task=t.message;missionLog(s,i,t.message);
  }
}
/** Deterministic 60 Hz mission dynamics. Rendering and real API latency never advance time. */
export function advanceMission(s:RescueMissionState,delta:number){const w=s.world;if(!w.running||!Number.isFinite(delta)||delta<=0)return;w.accumulator+=Math.min(delta,.1);
  while(w.accumulator+1e-10>=FIXED_STEP&&w.running){
    // Apply due radio instructions before the next decision, invalidating only that insect's old request epoch.
    s.ops.forEach((o,i)=>{while(o.commands.length&&o.commands[0].due<=w.elapsed+1e-9){const item=o.commands.shift()!;if(o.connected&&o.battery>0&&item.epoch===o.commandEpoch)applyCommand(s,i,item.command);}});
    if(w.agents.some((a,i)=>needsNeural(s,i)||(s.ops[i].battery>0&&s.ops[i].authority!=='operator'&&s.ops[i].authority!=='hold'&&a.simulation.mode==='malecns'&&!a.simulation.neural.decision))){w.accumulator=0;break;}
    if(w.elapsed+1e-9>=w.nextPlan){
      const reserved:number[]=[];
      w.agents.forEach((a,i)=>{if(s.ops[i].authority!=='explore')return;const explorers=w.agents.map((_,j)=>j).filter(j=>s.ops[j].authority==='explore');const positions=explorers.map(j=>j===i?a.simulation.bug.position:s.ops[j].packet?.position??s.environment.entry);const plan=assignFrontiers(sliceAt(a.simulation.environment,s.ops[i].altitude),positions,a.simulation.bug.radius)[explorers.indexOf(i)];a.assignment=plan&&!reserved.includes(plan.target)?plan:null;if(a.assignment)reserved.push(a.assignment.target);});w.nextPlan=w.elapsed+2;
    }
    for(let offset=0;offset<w.agents.length;offset++){
      const i=(w.ticks+offset)%w.agents.length,a=w.agents[i],o=s.ops[i],sim=a.simulation,bug=sim.bug,env=sim.environment;
      const before={...bug.position},zBefore=o.altitude;
      bug.speed=o.phase==='grounded'?SPACE.walkingSpeed:SPACE.flightSpeed;sense(sliceAt(env,o.altitude),bug);const inputDistances={left:bug.sensors.leftDistance,front:bug.sensors.frontDistance,right:bug.sensors.rightDistance};
      const proposed=o.battery<=0||o.authority==='operator'||o.authority==='hold'?emptyCommand():sim.mode==='rule-based'?control(bug,sim.memory,FIXED_STEP):{...sim.neural.decision!.command};
      const chosen=navigation(s,i,proposed);
      const close=w.agents.map((other,j)=>({other,j,d:distance(bug.position,other.simulation.bug.position),bearing:angle(Math.atan2(other.simulation.bug.position.y-bug.position.y,other.simulation.bug.position.x-bug.position.x)-bug.heading)})).find(p=>p.j!==i&&p.d<29&&Math.abs(s.ops[p.j].altitude-o.altitude)<7&&Math.abs(p.bearing)<Math.PI*.6);
      if(close&&o.authority!=='operator'&&o.authority!=='hold'&&o.phase!=='taking off'&&o.phase!=='landing'){chosen.command={forward:0,angular:close.bearing>=0?-1.9:1.9};chosen.reason='Peer separation overrides navigation';}
      a.coordination=chosen.reason;
      if(Math.abs(o.desired.forward-chosen.command.forward)>.01||Math.abs(o.desired.angular-chosen.command.angular)>.01){o.desired={...chosen.command};o.actuations.push({due:w.elapsed+BACKPACK.actuationDelay,command:{...chosen.command}});}
      while(o.actuations.length&&o.actuations[0].due<=w.elapsed+1e-9){const c=o.actuations.shift()!.command;o.speed=c.forward;o.angular=c.angular;}
      o.lease=Math.max(0,o.lease-FIXED_STEP);
      if(o.authority==='operator'&&(o.lease<=0||!o.connected)||o.battery<=0||o.phase==='taking off'||o.phase==='landing'){o.speed=o.angular=0;o.actuations=[];}
      const response=.94+.06*Math.sin((w.seed+i*31)*.01+w.elapsed*.7);const applied={forward:o.speed*response,angular:o.angular*response};
      // Local safety after delayed/variable actuation prevents stale commands crossing geometry or peers.
      const vertical=clamp(o.targetAltitude-o.altitude,-SPACE.climbSpeed*FIXED_STEP,SPACE.climbSpeed*FIXED_STEP);
      const newZ=o.battery>0?o.altitude+vertical:o.altitude;
      const heading=(bug.heading+applied.angular*FIXED_STEP+Math.PI*2)%(Math.PI*2),next={x:bug.position.x+Math.cos(heading)*applied.forward*FIXED_STEP,y:bug.position.y+Math.sin(heading)*applied.forward*FIXED_STEP};
      const blocked=!travel3D(env,before,o.altitude,next,newZ,bug.radius)||w.agents.some((other,j)=>j!==i&&Math.abs(s.ops[j].altitude-newZ)<SPACE.halfHeight*2+1&&distance(next,other.simulation.bug.position)<bug.radius+other.simulation.bug.radius+.25);
      bug.heading=heading;if(!blocked){bug.position=next;o.altitude=newZ;}else{a.peerBlocks++;sim.metrics[sim.mode].blocked++;if(sim.mode==='rule-based'&&o.authority!=='operator')chooseTurn(bug,sim.memory);}
      if(Math.abs(o.altitude-o.targetAltitude)<.001){o.phase=o.targetAltitude===SPACE.ground?'grounded':'flying';}
      const moved=distance(before,bug.position);bug.state=blocked?'blocked':moved>0||applied.angular!==0?'exploring':'stopped';
      const m=sim.metrics[sim.mode];m.distance+=moved;m.elapsed+=FIXED_STEP;if(Math.abs(applied.angular)>.8&&Math.sign(applied.angular)!==sim.lastTurn)m.turns++;sim.lastTurn=Math.abs(applied.angular)>.8?Math.sign(applied.angular):0;
      reveal3D(env,bug,o.altitude);sim.controllerExplored[sim.mode]=[...env.exploration.explored];m.coverage=coverage(env,sim.accessible);sim.elapsed=(w.ticks+1)*FIXED_STEP;
      sense(sliceAt(env,o.altitude),bug);
      const r=sim.neural.response;o.explanation={time:sim.elapsed,mode:sim.mode,distances:inputDistances,stimulus:r?{...r.stimulus}:sim.mode==='malecns'?mapSensors(bug.sensors):null,
        neuralTime:s.activity.get(sim).samples.at(-1)?.time??null,dna02:r?{left:r.dna02.L.peak,right:r.dna02.R.peak}:null,proposal:{...proposed},chosen:{...chosen.command},applied:{forward:blocked?0:applied.forward,angular:applied.angular},reason:chosen.reason,blocked,distance:moved,altitudeChange:o.altitude-zBefore};
      o.battery=Math.max(0,o.battery-FIXED_STEP*(BACKPACK.idleDrain+BACKPACK.thermalDrain+(o.connected?BACKPACK.radioDrain:0)+(Math.abs(applied.angular)>.05||Math.abs(applied.forward)>.05?BACKPACK.stimulationDrain:0)));
      if(o.battery<=BACKPACK.reserve&&!o.lowBattery){o.lowBattery=true;missionLog(s,i,'Backpack reserve reached. Land over clear floor and release guidance; insect flight energy is separate from electronics.');}
      if(o.battery<=0&&o.authority!=='hold'){cancelInvestigation(s,i);o.authority='hold';o.task='Backpack exhausted: modeled safety hold';o.commands=[];o.speed=o.angular=0;missionLog(s,i,o.task);}
    }
    w.ticks++;w.elapsed=w.ticks*FIXED_STEP;w.accumulator=Math.max(0,w.accumulator-FIXED_STEP);
    // Gas remains the existing illustrative 2D field; it has no calibrated height/diffusion physics.
    sampleRescue(w.rescue,s.environment,w.agents.filter((_,i)=>s.ops[i].battery>0).map(a=>a.simulation.bug),w.elapsed);
    s.ops.forEach((o,i)=>{const sim=w.agents[i].simulation;recordMotion(s,i);if(o.battery>0)sampleThermal(o.localHeat,sim.environment,[sim.bug],w.ticks,{altitude:()=>o.altitude,visible:(bug,source)=>groundVisible(sim.environment,bug.position,o.altitude,source.position)});finishTasks(s,i);if(w.elapsed+1e-9>=o.nextPacket)capture(s,i);deliver(s,i);});
    s.activity.observe(w);
  }
}
export function rescueLabView(s:RescueMissionState){const base=swarmSnapshot(s.world),selected=s.world.selected,o=s.ops[selected],packet=o.packet;
  const heat=thermalView(s.thermal,base.bug.id);heat.reading={...(packet?.reading??{signal:0,apparentC:null,contrastC:0,visibleSpots:0})};
  const agents=base.agents.map((a,i)=>{const p=s.ops[i].packet;return {...a,bug:p?{...a.bug,position:{...p.position},heading:p.heading,state:p.state,sensors:{...p.sensors}}:a.bug,distance:p?.distance??0,coordination:p?.coordination??'No received command explanation',ownCoverage:p?.ownCoverage??0,peerBlocks:p?.peerBlocks??0,novelCells:p?.novelCells??0,neuralStatus:p?.neuralStatus??'idle',target:null,motionSamples:p?.motionSamples.map(v=>({...v}))??[],motionConnected:s.ops[i].connected&&s.world.elapsed-(p?.time??0)<=BACKPACK.heartbeatTimeout,sampleTime:p?.time??0,altitude:p?.altitude??SPACE.ground,motion:p?.phase==='grounded'?'walk' as const:'flight' as const,path:(p?.route??[]).map(p=>({...p}))};});
  const source=packet?.explanation??null;
  const sharedEnvironment={...base.environment,obstacles:s.environment.obstacles,exploration:{...s.environment.exploration,explored:[...s.environment.exploration.explored]}};
  return {...base,bug:agents[selected].bug,environment:sharedEnvironment,agents,thermal:heat,explored:coverage(sharedEnvironment,s.world.agents[0].simulation.accessible),
    rescue:{...base.rescue,discoveries:[...thermalMarkers(heat.findings),...s.gas.discoveries.map(d=>structuredClone(d))],events:heat.events,completedAt:null,confirmed:0,possible:0,hazards:s.gas.discoveries.length,reading:{life:0,gas:packet?.gasSignal??0,exposed:(packet?.gasSignal??0)>=.65,status:'EXPLORING' as const}},
    operation:{authority:packet?.authority??o.authority,task:packet?.task??o.task,altitude:packet?.altitude??SPACE.ground,phase:packet?.phase??'grounded',battery:packet?.battery??100,connected:o.connected&&s.world.elapsed-(packet?.time??0)<=BACKPACK.heartbeatTimeout,packetTime:packet?.time??0,age:s.world.elapsed-(packet?.time??0),pending:o.commands.length,explanation:source,investigations:[...s.receivedInvestigations.values()].map(t=>structuredClone(t)),events:s.events.map(e=>({...e}))},
  };
}
export function rescueLabSnapshot(s:RescueMissionState){
  // Commander receives only delivered heat/gas findings. Hidden onboard observations are excluded.
  const view=rescueLabView(s),world={...s.world,rescue:{...s.gas,events:[]}};
  const result=thermalMissionSnapshot(world,s.thermal);result.swarm.coverage=Number(view.explored.toFixed(2));result.agents=result.agents.map((a,i)=>{const p=s.ops[i].packet;return {...a,sector:sector(p?.position??s.environment.entry),status:!s.world.running||p?.state==='stopped'?'PAUSED':'EXPLORING',controller:null};});return result;
}
