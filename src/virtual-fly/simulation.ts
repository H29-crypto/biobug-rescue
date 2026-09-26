import type { BioBug, Environment } from '../domain/types';
import { sense } from '../simulation/sensors';
import { move } from '../simulation/movement';
import { accessibleCells } from '../simulation/exploration';
import { control, chooseTurn, createControllerMemory } from '../simulation/controller';
import type { ControllerMemory } from '../simulation/controller';
import { createDecoder, decodeMotor } from '../simulation/motorDecoder';
import type { Action, DecoderMemory, Decision } from '../simulation/motorDecoder';
import { mapSensors } from '../simulation/sensorMapping';
import type { Stimulus } from '../simulation/sensorMapping';
import { parseNeuralResponse } from '../simulation/neuralClient';
import type { NeuralResponse } from '../simulation/neuralClient';
import { createArena, DEFAULT_EXPERIMENT, validateConfig } from './experiments';
import type { ExperimentConfig } from './experiments';
export const FLY_STEP=1/60, DECISION_TICKS=12;
export interface VirtualFly extends BioBug { velocity:number; turning:Action }
export interface TelemetryRow { time:number; x:number; y:number; heading:number; tactile:Stimulus; dna02L:number|null; dna02R:number|null; decision:Action; distance:number; turns:number; blocked:number; collisionAttempts:number; intermediates:{type:string;cumulative_activity:number}[] }
export interface FlySimulation {
  config:ExperimentConfig; environment:Environment; fly:VirtualFly; controller:ControllerMemory; decoder:DecoderMemory;
  ticks:number; elapsed:number; accumulator:number; running:boolean; generation:number; completed:boolean;
  neural:{status:'idle'|'waiting'|'ready'|'offline'; response:NeuralResponse|null; decision:Decision|null; nextTick:number; sampleTime:number|null; error:string};
  metrics:{distance:number; turns:number; blocked:number; collisionAttempts:number; movingTime:number; latencies:number[]; asymmetrySum:number; samples:number; peakLeft:number; peakRight:number; fallbacks:number; intermediates:Record<string,number>};
  lastTurn:number; accessible:boolean[]; visited:Uint8Array; path:{x:number;y:number;time:number}[]; telemetry:TelemetryRow[];
}
export function createFly(config:ExperimentConfig=DEFAULT_EXPERIMENT):FlySimulation {
  validateConfig(config);const environment=createArena(config.experiment);
  const fly:VirtualFly={id:'Virtual Fly 01',position:{...environment.entry},heading:0,radius:7,speed:42,velocity:0,turning:'STOP',state:'stopped',sensors:{frontDistance:85,leftDistance:85,rightDistance:85,obstacleFront:0,obstacleLeft:0,obstacleRight:0,hazard:0,survivorCue:0,unexploredDirection:0}};
  sense(environment,fly);const controller=createControllerMemory();controller.randomState=config.seed>>>0;
  const s:FlySimulation={config:{...config},environment,fly,controller,decoder:createDecoder(config.seed),ticks:0,elapsed:0,accumulator:0,running:false,generation:0,completed:false,
    neural:{status:'idle',response:null,decision:null,nextTick:0,sampleTime:null,error:''},
    metrics:{distance:0,turns:0,blocked:0,collisionAttempts:0,movingTime:0,latencies:[],asymmetrySum:0,samples:0,peakLeft:0,peakRight:0,fallbacks:0,intermediates:{}},lastTurn:0,accessible:accessibleCells(environment,fly.radius),visited:new Uint8Array(384),path:[{...fly.position,time:0}],telemetry:[]};
  visit(s);return s;
}
function visit(s:FlySimulation){const g=s.environment.exploration,index=Math.floor(s.fly.position.y/g.cellSize)*g.columns+Math.floor(s.fly.position.x/g.cellSize);if(s.accessible[index])s.visited[index]=1;}
export function runFly(s:FlySimulation,running:boolean){s.generation++;s.running=running&&!s.completed;s.accumulator=0;s.fly.velocity=0;s.fly.turning='STOP';s.fly.state=s.running?'exploring':'stopped';if(s.config.mode==='malecns'){s.neural.nextTick=s.ticks;s.neural.decision=null;if(s.running)s.neural.status='idle';}}
export const flyNeuralDue=(s:FlySimulation)=>s.running&&s.config.mode==='malecns'&&(s.ticks>=s.neural.nextTick||!s.neural.decision);
function record(s:FlySimulation,decision:Action,response:NeuralResponse|null){s.telemetry.push({time:s.elapsed,x:s.fly.position.x,y:s.fly.position.y,heading:s.fly.heading,tactile:mapSensors(s.fly.sensors),dna02L:response?.dna02.L.peak??null,dna02R:response?.dna02.R.peak??null,decision,distance:s.metrics.distance,turns:s.metrics.turns,blocked:s.metrics.blocked,collisionAttempts:s.metrics.collisionAttempts,intermediates:response?.top_intermediate_types.map(x=>({...x}))??[]});if(s.telemetry.length>601)s.telemetry.shift();}
export function acceptFlyNeural(s:FlySimulation,raw:NeuralResponse,latency:number){
  const input=mapSensors(s.fly.sensors),response=parseNeuralResponse(raw,input);
  const decision=decodeMotor(response.dna02.L.peak,response.dna02.R.peak,input,s.fly.sensors,s.fly.speed,s.decoder);
  s.neural={status:'ready',response,decision,nextTick:s.ticks+DECISION_TICKS,sampleTime:s.elapsed,error:''};
  const m=s.metrics;m.latencies.push(latency);m.samples++;m.asymmetrySum+=Math.abs(decision.delta);m.peakLeft=Math.max(m.peakLeft,response.dna02.L.peak);m.peakRight=Math.max(m.peakRight,response.dna02.R.peak);m.fallbacks+=Number(decision.fallback);
  for(const row of response.top_intermediate_types)m.intermediates[row.type]=(m.intermediates[row.type]??0)+row.cumulative_activity;
  record(s,decision.action,response);
}
export function failFlyNeural(s:FlySimulation,error:string){runFly(s,false);s.neural.status='offline';s.neural.error=error;s.neural.response=null;s.neural.decision=null;}
export function advanceFly(s:FlySimulation,delta:number){
  if(!s.running||!Number.isFinite(delta)||delta<=0)return;s.accumulator+=Math.min(delta,.1);
  while(s.accumulator+1e-10>=FLY_STEP&&s.running){
    if(flyNeuralDue(s)){s.accumulator=0;s.fly.velocity=0;s.fly.turning='STOP';break;}
    sense(s.environment,s.fly);
    const command=s.config.mode==='rule-based'?control(s.fly,s.controller,FLY_STEP):s.neural.decision!.command;
    const turn=Math.abs(command.angular)>.8?Math.sign(command.angular):0;
    const action:Action=turn>0?'TURN_RIGHT':turn<0?'TURN_LEFT':command.forward?'FORWARD':'STOP';
    if(s.config.mode==='rule-based'&&s.ticks%DECISION_TICKS===0)record(s,action,null);
    if(turn&&turn!==s.lastTurn)s.metrics.turns++;s.lastTurn=turn;
    const before={...s.fly.position};
    const allowed=move(s.environment,s.fly,command,FLY_STEP);
    if(!allowed){s.metrics.blocked++;if(command.forward!==0)s.metrics.collisionAttempts++;if(s.config.mode==='rule-based')chooseTurn(s.fly,s.controller);}
    const distance=Math.hypot(s.fly.position.x-before.x,s.fly.position.y-before.y);s.metrics.distance+=distance;if(distance>1e-9)s.metrics.movingTime+=FLY_STEP;
    s.fly.velocity=distance/FLY_STEP;s.fly.turning=allowed?action:'STOP';s.fly.state=!allowed||turn?'blocked':'exploring';
    s.ticks++;s.elapsed=s.ticks*FLY_STEP;s.accumulator=Math.max(0,s.accumulator-FLY_STEP);sense(s.environment,s.fly);visit(s);
    if(s.ticks%DECISION_TICKS===0)s.path.push({...s.fly.position,time:s.elapsed});
    if(s.ticks>=s.config.duration*60){s.completed=true;runFly(s,false);}
  }
}
export function flySummary(s:FlySimulation){const m=s.metrics,ordered=[...m.latencies].sort((a,b)=>a-b);return {
  config:{...s.config},elapsed:s.elapsed,distance:m.distance,turns:m.turns,blocked:m.blocked,collisionAttempts:m.collisionAttempts,movingTime:m.movingTime,
  coverage:100*s.visited.reduce((a,b)=>a+b,0)/Math.max(1,s.accessible.filter(Boolean).length),
  neuralSamples:m.samples,peakDNa02L:m.samples?m.peakLeft:null,peakDNa02R:m.samples?m.peakRight:null,meanAsymmetry:m.samples?m.asymmetrySum/m.samples:null,fallbacks:m.fallbacks,
  meanLatencyMs:ordered.length?ordered.reduce((a,b)=>a+b,0)/ordered.length:null,p95LatencyMs:ordered.length?ordered[Math.ceil(ordered.length*.95)-1]:null,
  topIntermediates:Object.entries(m.intermediates).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,5).map(([type,cumulativeActivity])=>({type,cumulativeActivity})),
  finalPose:{...s.fly.position,heading:s.fly.heading},graph:s.neural.response?.graph??null,
};}
export interface FlyResult { summary:ReturnType<typeof flySummary>; path:FlySimulation['path']; telemetry:TelemetryRow[] }
export function flyResult(s:FlySimulation):FlyResult {return {summary:flySummary(s),path:s.path.map(p=>({...p})),telemetry:s.telemetry.map(t=>({...t,tactile:{...t.tactile},intermediates:t.intermediates.map(n=>({...n}))}))};}
