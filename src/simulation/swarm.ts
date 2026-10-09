import { createRescueMission, sampleRescue, rescueView } from './rescue';
import type { RescueMission } from './rescue';
import type { BioBug, Vec2 } from '../domain/types';
import { advance, createSimulation, FIXED_STEP, neuralDue, setRunning, snapshot, switchController } from './engine';
import type { Simulation, ControllerMode } from './engine';
import { isPositionValid } from './collision';
import { sense } from './sensors';
import { coverage, revealExploration } from './exploration';
import { assignFrontiers } from './frontiers';
import type { Assignment } from './frontiers';
import type { MotorCommand } from './controller';
export interface SwarmAgent { simulation: Simulation; assignment: Assignment|null; coordination: string; novelCells: number; peerBlocks: number; separationTurn: number; separationRemaining: number }
export interface SwarmSimulation {
  rescue: RescueMission; agents: SwarmAgent[]; selected: number; running: boolean; elapsed: number; accumulator: number;
  coordinated: boolean; nextPlan: number; planRound: number; ticks: number; seed: number;
  batchRequests: number; batchFailures: number; batchLatencies: number[];
}
export const AGENT_COLORS = ['#58dfba','#f6c970','#82baff','#e9a0ce','#c4b0ff','#ff9982','#c5de7c','#98dae5'];
export function createSwarm(count=4, seed=2026, coordinated=true): SwarmSimulation {
  if(!Number.isInteger(count)||count<1||count>8) throw new Error('Deployment must contain 1–8 BioBugs');
  const first=createSimulation(seed), env=first.environment;
  const agents: SwarmAgent[]=[];
  // Compact, collision-checked deployment beside the entry; never spawn on unknown distant terrain.
  const candidates: Vec2[]=[];
  for(let ring=0;ring<5;ring++) for(let y=-ring;y<=ring;y++) for(let x=-ring;x<=ring;x++) {
    if(Math.max(Math.abs(x),Math.abs(y))!==ring) continue;
    candidates.push({x:env.entry.x+x*22,y:env.entry.y+y*22});
  }
  for(let i=0;i<count;i++) {
    const sim=i===0?first:createSimulation(seed+i*1013);
    const position=candidates.find(p=>isPositionValid(env,p,sim.bug.radius) && agents.every(a=>Math.hypot(p.x-a.simulation.bug.position.x,p.y-a.simulation.bug.position.y)>=22));
    if(!position) throw new Error('No safe deployment position');
    sim.environment=env;sim.bug.id=`BioBug #${i+1}`;sim.bug.position={...position};
    sense(env,sim.bug);revealExploration(env,position);
    // Personal coverage starts from that agent's own line of sight, not another agent's observations.
    for(const mode of ['rule-based','malecns'] as const) {
      const explored=env.exploration.explored.map(()=>false);
      const own={...env,exploration:{...env.exploration,explored}};revealExploration(own,position);
      sim.controllerExplored[mode]=explored;sim.metrics[mode].coverage=coverage(own,sim.accessible);
    }
    agents.push({simulation:sim,assignment:null,coordination:'Awaiting shared-map plan',novelCells:0,peerBlocks:0,separationTurn:0,separationRemaining:0});
  }
  return {rescue:createRescueMission(env),agents,selected:0,running:false,elapsed:0,accumulator:0,coordinated,nextPlan:0,planRound:0,ticks:0,seed,
    batchRequests:0,batchFailures:0,batchLatencies:[]};
}
export function runSwarm(s: SwarmSimulation,running:boolean) {
  s.running=running;s.accumulator=0;
  for(const a of s.agents) setRunning(a.simulation,running);
}
export function switchSwarm(s:SwarmSimulation,mode:ControllerMode) {
  for(const a of s.agents) {switchController(a.simulation,mode);a.separationRemaining=0;a.separationTurn=0;}
  s.accumulator=0;s.nextPlan=s.elapsed;
}
function angleDifference(target:number,current:number) {return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
function coordinatedCommand(s:SwarmSimulation,index:number,proposed:MotorCommand):MotorCommand {
  const a=s.agents[index],bug=a.simulation.bug;
  // A short safety commitment avoids frame-by-frame arbitration chatter at the angular boundary.
  if(a.separationRemaining>0) {
    a.separationRemaining=Math.max(0,a.separationRemaining-FIXED_STEP);
    a.coordination='Engineering separation: committed turn away from nearby BioBug';
    return {forward:0,angular:a.separationTurn*1.9};
  }
  const close=s.agents.filter((_,i)=>i!==index).map(other=>{
    const p=other.simulation.bug.position,dx=p.x-bug.position.x,dy=p.y-bug.position.y;
    return {distance:Math.hypot(dx,dy),angle:angleDifference(Math.atan2(dy,dx),bug.heading)};
  }).filter(p=>p.distance<32&&Math.abs(p.angle)<Math.PI*.6).sort((p,q)=>p.distance-q.distance)[0];
  if(close) {
    a.separationTurn=close.angle>0?-1:1;a.separationRemaining=.6-FIXED_STEP;
    a.coordination='Engineering separation: turn away from nearby BioBug';
    return {forward:0,angular:a.separationTurn*1.9};
  }
  if(!s.coordinated||s.agents.length===1) {a.coordination='Independent exploration · local controller';return proposed;}
  // Local obstacle avoidance takes priority over the global engineering navigation objective.
  if(Math.abs(proposed.angular)>.8||bug.sensors.frontDistance<22) {a.coordination='Local obstacle avoidance has priority';return proposed;}
  const path=a.assignment?.path;
  while(path?.length && Math.hypot(path[0].x-bug.position.x,path[0].y-bug.position.y)<12) path.shift();
  if(!path?.length) {a.coordination='No reachable frontier route · local exploration';return proposed;}
  const error=angleDifference(Math.atan2(path[0].y-bug.position.y,path[0].x-bug.position.x),bug.heading);
  a.coordination=`Engineering navigation toward reserved frontier ${a.assignment!.target}`;
  return {forward:Math.abs(error)>.8?0:proposed.forward,angular:Math.max(-1.5,Math.min(1.5,error*2))};
}
/** Minimum point-to-segment distance: prevent tunneling through another stationary agent. */
export function clearOfPeers(from:Vec2,to:Vec2,bug:BioBug,peers:BioBug[]):boolean {
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  return peers.every(peer=>{
    const t=length?Math.max(0,Math.min(1,((peer.position.x-from.x)*dx+(peer.position.y-from.y)*dy)/length)):0;
    return Math.hypot(from.x+t*dx-peer.position.x,from.y+t*dy-peer.position.y)>=bug.radius+peer.radius+.25;
  });
}
export function advanceSwarm(s:SwarmSimulation,delta:number,afterStep?:()=>void) {
  if(!s.running||!Number.isFinite(delta)||delta<=0) return;
  s.accumulator+=Math.min(.1,delta);
  const env=s.agents[0].simulation.environment;
  while(s.accumulator+1e-10>=FIXED_STEP) {
    if(s.agents.some(a=>neuralDue(a.simulation)||(a.simulation.mode==='malecns'&&!a.simulation.neural.decision))) {s.accumulator=0;break;}
    if(s.coordinated&&s.agents.length>1&&s.elapsed+1e-9>=s.nextPlan) {
      const plans=assignFrontiers(env,s.agents.map(a=>a.simulation.bug.position),7,s.planRound++%s.agents.length);
      s.agents.forEach((a,i)=>a.assignment=plans[i]);s.nextPlan=s.elapsed+2;
    }
    // Rotate physical update/novel-cell credit priority deterministically each step.
    for(let offset=0;offset<s.agents.length;offset++) {
      const i=(s.ticks+offset)%s.agents.length,a=s.agents[i],before=env.exploration.explored.filter(Boolean).length;
      advance(a.simulation,FIXED_STEP,{command:c=>coordinatedCommand(s,i,c),permit:(from,to)=>{
        const allowed=clearOfPeers(from,to,a.simulation.bug,s.agents.filter((_,j)=>j!==i).map(other=>other.simulation.bug));
        if(!allowed) {a.peerBlocks++;a.coordination='Safety hold: another BioBug blocks movement';}
        return allowed;
      }});
      a.novelCells+=env.exploration.explored.filter(Boolean).length-before;
    }
    s.elapsed+=FIXED_STEP;sampleRescue(s.rescue,env,s.agents.map(a=>a.simulation.bug),s.elapsed);s.ticks++;s.accumulator=Math.max(0,s.accumulator-FIXED_STEP);afterStep?.();
  }
}
export function swarmSnapshot(s:SwarmSimulation) {
  const selected=snapshot(s.agents[s.selected].simulation), ordered=[...s.batchLatencies].sort((a,b)=>a-b);
  return {...selected,environment:{...selected.environment,survivors:[],hazards:[]},rescue:rescueView(s.rescue,selected.bug.id),running:s.running,elapsed:s.elapsed,selected:s.selected,coordinated:s.coordinated,
    agents:s.agents.map((a,i)=>({bug:{...a.simulation.bug,position:{...a.simulation.bug.position}},color:AGENT_COLORS[i],
      target:a.assignment?.target??null,path:a.assignment?.path.map(p=>({...p}))??[],coordination:a.coordination,
      novelCells:a.novelCells,peerBlocks:a.peerBlocks,distance:a.simulation.metrics['rule-based'].distance+a.simulation.metrics.malecns.distance,
      ownCoverage:coverage({...a.simulation.environment,exploration:{...a.simulation.environment.exploration,
        explored:a.simulation.controllerExplored['rule-based'].map((seen,j)=>seen||a.simulation.controllerExplored.malecns[j])}},a.simulation.accessible),neuralStatus:a.simulation.neural.status})),
    swarmMetrics:{distance:s.agents.reduce((sum,a)=>sum+a.simulation.metrics['rule-based'].distance+a.simulation.metrics.malecns.distance,0),
      peerBlocks:s.agents.reduce((sum,a)=>sum+a.peerBlocks,0),batchRequests:s.batchRequests,batchFailures:s.batchFailures,
      meanBatchMs:ordered.length?ordered.reduce((a,b)=>a+b,0)/ordered.length:0,p95BatchMs:ordered.length?ordered[Math.ceil(ordered.length*.95)-1]:0} };
}
