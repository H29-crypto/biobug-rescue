import type {Vec2} from '../domain/types';
import {isPositionValid,canTravel} from '../simulation/collision';
import {move} from '../simulation/movement';
import {sense,rayDistance} from '../simulation/sensors';
import {control} from '../simulation/controller';
import type {MotorCommand} from '../simulation/controller';
import {decodeMotor} from '../simulation/motorDecoder';
import {createFly,FLY_STEP,DECISION_TICKS} from '../virtual-fly/simulation';
import type {FlySimulation} from '../virtual-fly/simulation';
import {AnatomicalHistory,parseAnatomicalResponse} from '../virtual-fly/anatomicalTelemetry';
import type {Stimulus} from '../simulation/sensorMapping';

export type Authority='explore'|'waypoint'|'operator';
export interface Packet {time:number;position:Vec2;speed:number;angular:number;contact:Stimulus;bodyContact:boolean;authority:Authority;source:string;battery:number}
export interface Supervised {
  sim:FlySimulation; authority:Authority; resume:Exclude<Authority,'operator'>;
  connected:boolean; battery:number; packet:Packet; history:AnatomicalHistory;
  contact:Stimulus; bodyContact:boolean; speed:number; angular:number;
  manual:MotorCommand; lease:number; route:Vec2[]; goal:Vec2|null; routeStatus:string;
  source:string; events:{time:number;text:string}[]; recovery:number;
}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const approach=(v:number,target:number,amount:number)=>v+clamp(target-v,-amount,amount);
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
export function log(s:Supervised,text:string){s.events.unshift({time:s.sim.elapsed,text});s.events.length=Math.min(s.events.length,40);}
export function createSupervised(mode:'rule-based'|'malecns'='rule-based'):Supervised {
  const sim=createFly({experiment:'front',mode,seed:2026,duration:120});
  sim.environment.name='Supervised contact arena';
  sim.environment.obstacles.push({id:'divider',kind:'wall',x:380,y:90,width:20,height:230});
  const s:Supervised={sim,authority:'explore',resume:'explore',connected:true,battery:100,
    packet:null!,history:new AnatomicalHistory(),contact:{left:0,front:0,right:0},bodyContact:false,
    speed:0,angular:0,manual:{forward:0,angular:0},lease:0,route:[],goal:null,routeStatus:'Choose a destination on the arena map.',
    source:'paused',events:[],recovery:0};
  observeContact(s);transmit(s);log(s,'Arena ready. Backpack, contact probes and movement parameters are engineering models.');return s;
}
/** Short virtual feelers extending ten world units beyond the collision body.
 * Compression is a geometric surrogate, not a calibrated biological receptor model. */
export function observeContact(s:Supervised){
  const {fly,environment}=s.sim;
  const probe=(offset:number)=>clamp((fly.radius+10-rayDistance(environment,fly.position,fly.heading+offset,fly.radius+10))/10,0,1);
  s.contact={left:probe(-Math.PI/4),front:probe(0),right:probe(Math.PI/4)};
}
export function transmit(s:Supervised){if(s.connected)s.packet={time:s.sim.elapsed,position:{...s.sim.fly.position},speed:s.sim.fly.velocity,angular:s.angular,contact:{...s.contact},bodyContact:s.bodyContact,authority:s.authority,source:s.source,battery:s.battery};}
function invalidate(s:Supervised){s.sim.generation++;s.sim.accumulator=0;s.sim.neural.decision=null;s.sim.neural.nextTick=s.sim.ticks;s.sim.neural.status='idle';release(s);s.angular=0;}
export function release(s:Supervised){s.manual={forward:0,angular:0};s.lease=0;s.speed=0;s.angular=0;s.sim.fly.velocity=0;}
export function setRunning(s:Supervised,running:boolean){invalidate(s);s.sim.running=running&&!s.sim.completed&&s.battery>0;s.source=s.sim.running?'awaiting command':'paused';s.sim.fly.turning='STOP';log(s,s.sim.running?'Simulation resumed.':'Simulation paused.');transmit(s);}
export function takeControl(s:Supervised){if(!s.connected||s.battery<=0)return false;if(s.authority!=='operator')s.resume=s.authority;invalidate(s);s.authority='operator';s.source='operator hold';log(s,'Operator took guidance control; autonomy suspended.');transmit(s);return true;}
export function resumeAutonomy(s:Supervised){
  if(!s.connected||s.battery<=0)return false;
  if(s.resume==='waypoint'&&s.goal){
    const route=planRoute(s,s.goal);if(!route){s.routeStatus='Cannot resume: destination is unreachable from the current pose.';log(s,s.routeStatus);return false;}
    s.route=route;s.routeStatus='Following a replanned route from the current pose.';
  }
  invalidate(s);s.authority=s.resume;s.source='autonomy';log(s,`Autonomy resumed: ${s.authority}.`);transmit(s);return true;
}
export function explore(s:Supervised){if(!s.connected||s.battery<=0)return false;invalidate(s);s.authority=s.resume='explore';s.route=[];s.goal=null;s.source='autonomy';log(s,'Automatic exploration selected.');transmit(s);return true;}
export function steer(s:Supervised,forward:number,angular:number){
  if(!s.connected||!s.sim.running||s.authority!=='operator'||s.battery<=0)return;
  if(!Number.isFinite(forward)||!Number.isFinite(angular))throw Error('Invalid steering input');
  s.manual={forward:clamp(forward,-1,1)*s.sim.fly.speed,angular:clamp(angular,-1,1)*1.9};s.lease=.35;
}
export function setLink(s:Supervised,connected:boolean){s.connected=connected;if(s.authority==='operator')release(s);log(s,connected?'Radio restored; latest packet synchronized.':'Radio lost; operator commands expire, onboard autonomy can continue.');transmit(s);}

/** Known-arena mission planner. It is not a neural pathway or an unknown-world mapper. */
export function planRoute(s:Supervised,target:Vec2):Vec2[]|null {
  const env=s.sim.environment,from=s.sim.fly.position,r=s.sim.fly.radius;
  if(![target.x,target.y].every(Number.isFinite)||!isPositionValid(env,target,r))return null;
  if(canTravel(env,from,target,r))return [{...target}];
  const points:Vec2[]=[];for(let y=45;y<env.height-30;y+=30)for(let x=45;x<env.width-30;x+=30)if(isPositionValid(env,{x,y},r))points.push({x,y});
  const start=points.length;points.push({...from});const end=points.length;points.push({...target});
  const previous=new Int32Array(points.length).fill(-1),queue=[start];previous[start]=start;
  for(let k=0;k<queue.length&&previous[end]<0;k++){
    const a=queue[k];for(let b=0;b<points.length;b++){
      if(previous[b]>=0)continue;
      const distance=Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);
      if(a!==start&&b!==end&&distance>43)continue;
      if(!canTravel(env,points[a],points[b],r))continue;
      previous[b]=a;queue.push(b);
    }
  }
  if(previous[end]<0)return null;const route:Vec2[]=[];for(let i=end;i!==start;i=previous[i])route.unshift(points[i]);return route;
}
export function setWaypoint(s:Supervised,target:Vec2){
  if(!s.connected||s.battery<=0)return false;
  const route=planRoute(s,target);if(!route){s.routeStatus='Destination blocked or unreachable. Previous command retained.';log(s,s.routeStatus);return false;}
  invalidate(s);s.route=route;s.goal={...target};s.authority=s.resume='waypoint';s.routeStatus='Following a route through the known test arena.';s.source='waypoint planner';log(s,`Waypoint accepted: ${target.x.toFixed(0)}, ${target.y.toFixed(0)}.`);transmit(s);return true;
}
export const neuralDue=(s:Supervised)=>s.sim.running&&s.authority!=='operator'&&s.sim.config.mode==='malecns'&&(s.sim.ticks>=s.sim.neural.nextTick||!s.sim.neural.decision);
export function acceptNeural(s:Supervised,raw:unknown,input:Stimulus){
  const response=parseAnatomicalResponse(raw,input),sim=s.sim;
  const decision=decodeMotor(response.dna02.L.peak,response.dna02.R.peak,input,sim.fly.sensors,sim.fly.speed,sim.decoder);
  sim.neural={status:'ready',response,decision,nextTick:sim.ticks+DECISION_TICKS,sampleTime:sim.elapsed,error:''};
  sim.metrics.samples++;s.history.observe(sim);
}
function command(s:Supervised):MotorCommand {
  const sim=s.sim;
  if(s.authority==='operator'){s.source=s.lease>0?'operator steering':'operator hold';return s.lease>0?s.manual:{forward:0,angular:0};}
  if(s.recovery>0){s.recovery=Math.max(0,s.recovery-FLY_STEP);s.source='body-contact recovery';return {forward:-12,angular:1.9};}
  if(s.authority==='waypoint'){
    while(s.route.length&&Math.hypot(s.route[0].x-sim.fly.position.x,s.route[0].y-sim.fly.position.y)<4)s.route.shift();
    if(!s.route.length){s.source='waypoint reached';if(s.routeStatus!=='Waypoint reached.'){s.routeStatus='Waypoint reached.';log(s,s.routeStatus);}return {forward:0,angular:0};}
    if(Math.max(s.contact.front,s.contact.left,s.contact.right)>.65&&sim.config.mode==='malecns'){s.source='MaleCNS contact response';return sim.neural.decision!.command;}
    const target=s.route[0],error=angle(Math.atan2(target.y-sim.fly.position.y,target.x-sim.fly.position.x)-sim.fly.heading);
    s.source='waypoint planner';return {forward:Math.abs(error)>.5?0:Math.min(sim.fly.speed,Math.hypot(target.x-sim.fly.position.x,target.y-sim.fly.position.y)*2),angular:clamp(error*3,-1.9,1.9)};
  }
  if(sim.config.mode==='malecns'){s.source='MaleCNS + engineering decoder';return sim.neural.decision!.command;}
  s.source='rule-based proximity controller';return control(sim.fly,sim.controller,FLY_STEP);
}
export function advanceSupervised(s:Supervised,delta:number){
  const sim=s.sim;if(!sim.running||!Number.isFinite(delta)||delta<=0)return;
  sim.accumulator+=Math.min(delta,.1);
  while(sim.accumulator+1e-10>=FLY_STEP&&sim.running){
    if(neuralDue(s)){sim.accumulator=0;sim.fly.velocity=0;break;}
    sense(sim.environment,sim.fly);observeContact(s);
    s.lease=Math.max(0,s.lease-FLY_STEP);const desired=command(s);
    s.speed=approach(s.speed,desired.forward,90*FLY_STEP);s.angular=approach(s.angular,desired.angular,8*FLY_STEP);
    const before={...sim.fly.position},allowed=move(sim.environment,sim.fly,{forward:s.speed,angular:s.angular},FLY_STEP);
    const wasContact=s.bodyContact;s.bodyContact=!allowed;
    if(!allowed){s.speed=0;sim.metrics.blocked++;sim.metrics.collisionAttempts++;if(!wasContact)log(s,'Body contact: forward motion blocked.');if(s.authority!=='operator')s.recovery=.35;}
    const distance=Math.hypot(sim.fly.position.x-before.x,sim.fly.position.y-before.y);
    sim.metrics.distance+=distance;sim.fly.velocity=distance/FLY_STEP;
    sim.fly.turning=s.angular>.1?'TURN_RIGHT':s.angular<-.1?'TURN_LEFT':distance>0?'FORWARD':'STOP';sim.fly.state=!allowed?'blocked':distance>0?'exploring':'stopped';
    sim.ticks++;sim.elapsed=sim.ticks*FLY_STEP;sim.accumulator=Math.max(0,sim.accumulator-FLY_STEP);
    s.battery=Math.max(0,100-sim.elapsed/6); // Hypothetical ten-minute powered budget, not a hardware claim.
    observeContact(s);
    if(sim.ticks%DECISION_TICKS===0){sim.path.push({...sim.fly.position,time:sim.elapsed});transmit(s);}
    if(sim.ticks>=7200||s.battery<=0){sim.completed=true;setRunning(s,false);log(s,'Two-minute trial complete. Reset for a new trial.');}
  }
}
