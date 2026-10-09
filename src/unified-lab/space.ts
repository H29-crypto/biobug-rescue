import type {Environment,Obstacle,Vec2} from '../domain/types';
import {canTravel,isPositionValid} from '../simulation/collision';
import {cellCenter,isExplored} from '../simulation/exploration';
import {neighbors} from '../simulation/frontiers';

export const SPACE={ground:3,cruise:28,maxAltitude:46,halfHeight:3,climbSpeed:16,flightSpeed:54,walkingSpeed:42} as const;
export type Volume=Obstacle&{baseAltitude?:number;elevation?:number};
export const heightOf=(o:Volume)=>o.elevation??(o.kind==='wall'?52:18);
export function configureSpace(env:Environment){
  env.obstacles=env.obstacles.map(o=>({...o,elevation:heightOf(o)}));
  env.obstacles.push({id:'ceiling-slab',kind:'debris',x:280,y:270,width:180,height:100,baseAltitude:38,elevation:8} as Volume);
}
export function sliceAt(env:Environment,altitude:number):Environment{return {...env,obstacles:env.obstacles.filter(o=>{
  const v=o as Volume,b=v.baseAltitude??0;return altitude+SPACE.halfHeight>=b&&altitude-SPACE.halfHeight<=b+heightOf(v);
})};}
export function validPose(env:Environment,p:Vec2,z:number,radius:number){return Number.isFinite(z)&&z>=SPACE.ground&&z<=SPACE.maxAltitude&&isPositionValid(sliceAt(env,z),p,radius);}
export function travel3D(env:Environment,from:Vec2,z0:number,to:Vec2,z1:number,radius:number){
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,z1-z0)/2));
  for(let i=1;i<=steps;i++){const t=i/steps;if(!validPose(env,{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},z0+(z1-z0)*t,radius))return false;}
  return true;
}
/** Ground target visibility through extruded obstacles. No through-wall thermal sight. */
export function groundVisible(env:Environment,from:Vec2,z:number,to:Vec2){
  const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/2));
  for(let i=1;i<steps;i++){const t=i/steps,p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},alt=z*(1-t)+2*t;
    if(env.obstacles.some(o=>{const v=o as Volume,b=v.baseAltitude??0;return p.x>=o.x&&p.x<=o.x+o.width&&p.y>=o.y&&p.y<=o.y+o.height&&alt>=b&&alt<=b+heightOf(v);}))return false;
  }return true;
}
/** Routes use revealed cells, with exact geometry only for known-space collision clearance. */
export function knownRoute(env:Environment,from:Vec2,target:Vec2,altitude:number,radius:number):Vec2[]|null{
  const layer=sliceAt(env,altitude);
  if(![target.x,target.y].every(Number.isFinite)||!isExplored(env,target)||!isPositionValid(layer,target,radius))return null;
  const free=env.exploration.explored.map((seen,i)=>seen&&isPositionValid(layer,cellCenter(env,i),radius+1));
  const starts=free.map((v,i)=>({i,d:v?Math.hypot(cellCenter(env,i).x-from.x,cellCenter(env,i).y-from.y):Infinity})).filter(v=>v.d<35).sort((a,b)=>a.d-b.d||a.i-b.i);
  const start=starts.find(v=>canTravel(layer,from,cellCenter(env,v.i),radius));if(!start)return null;
  const parent=new Int32Array(free.length).fill(-1),queue=[start.i];parent[start.i]=start.i;let end=-1;
  for(let k=0;k<queue.length;k++){const i=queue[k],p=cellCenter(env,i);if(Math.hypot(p.x-target.x,p.y-target.y)<30&&canTravel(layer,p,target,radius)){end=i;break;}
    for(const j of neighbors(env,i))if(free[j]&&parent[j]<0&&canTravel(layer,p,cellCenter(env,j),radius)){parent[j]=i;queue.push(j);}}
  if(end<0)return null;const route=[{...target}];for(let i=end;i!==start.i;i=parent[i])route.unshift(cellCenter(env,i));route.unshift(cellCenter(env,start.i));return route;
}
