import type { Environment, Obstacle } from '../domain/types';
export const EXPERIMENTS = [
  { id:'open', name:'A · Open arena', description:'Baseline walking inside an empty bounded arena.' },
  { id:'left', name:'B · Left obstacle', description:'A tactile obstacle to the left of the initial trajectory.' },
  { id:'right', name:'C · Right obstacle', description:'The mirrored obstacle to the right of the initial trajectory.' },
  { id:'front', name:'D · Frontal obstacle', description:'A barrier directly ahead of the initial trajectory.' },
  { id:'corridor', name:'E · Narrow corridor', description:'Confined walking with repeated boundary interactions.' },
] as const;
export type ExperimentId = typeof EXPERIMENTS[number]['id'];
export type FlyMode = 'rule-based' | 'malecns';
export interface ExperimentConfig { experiment:ExperimentId; mode:FlyMode; seed:number; duration:number }
export const DEFAULT_EXPERIMENT:ExperimentConfig = Object.freeze({experiment:'open',mode:'rule-based',seed:2026,duration:30});
export function validateConfig(c:ExperimentConfig) {
  if(!EXPERIMENTS.some(e=>e.id===c.experiment)||!['rule-based','malecns'].includes(c.mode)||!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295||!Number.isInteger(c.duration)||c.duration<1||c.duration>120)throw Error('Invalid experiment configuration');
}
export function createArena(id:ExperimentId):Environment {
  const wall=(id:string,x:number,y:number,width:number,height:number):Obstacle=>({id,x,y,width,height,kind:'wall'});
  const obstacles=[wall('north',20,20,680,12),wall('south',20,448,680,12),wall('west',20,20,12,440),wall('east',688,20,12,440)];
  if(id==='left')obstacles.push(wall('left-probe',140,163,100,32));
  if(id==='right')obstacles.push(wall('right-probe',140,285,100,32));
  if(id==='front')obstacles.push(wall('front-probe',205,205,28,70));
  if(id==='corridor')obstacles.push(wall('upper-corridor',32,185,620,16),wall('lower-corridor',32,279,620,16),wall('end-corridor',640,201,12,78));
  return {id:`fly-${id}`,name:EXPERIMENTS.find(e=>e.id===id)!.name,width:720,height:480,entry:{x:110,y:240},obstacles,survivors:[],hazards:[],exploration:{columns:24,rows:16,cellSize:30,explored:Array<boolean>(384).fill(false)}};
}
