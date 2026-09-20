import type { Environment, Vec2 } from '../domain/types';
import { cellCenter } from './exploration';
import { canTravel, isPositionValid } from './collision';
export interface Assignment { target: number; path: Vec2[] }
export function neighbors(env: Environment, index: number): number[] {
  const { columns, rows } = env.exploration, x = index % columns, y = Math.floor(index / columns);
  return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<columns&&b<rows).map(([a,b])=>b*columns+a);
}
/** ENGINEERING shared-map planner. Only revealed cells may enter the navigation graph.
 * AccessibleCells (the omniscient scoring denominator) is deliberately not an input.
 */
export function assignFrontiers(env: Environment, positions: Vec2[], radius: number, priority = 0): (Assignment | null)[] {
  const known = env.exploration.explored;
  const free = known.map((seen,i)=>seen && isPositionValid(env,cellCenter(env,i),radius+1));
  const frontiers = free.map((valid,i)=>valid && neighbors(env,i).some(j=>!known[j]));
  const assigned: (Assignment|null)[] = positions.map(()=>null), reserved: number[] = [];
  const links = free.map((valid,i)=>valid ? neighbors(env,i).filter(j=>free[j] && canTravel(env,cellCenter(env,i),cellCenter(env,j),radius+1)) : []);
  for(let offset=0;offset<positions.length;offset++) {
    const agent=(priority+offset)%positions.length, position=positions[agent];
    const starts = free.map((valid,i)=>({i,d:valid?Math.hypot(cellCenter(env,i).x-position.x,cellCenter(env,i).y-position.y):Infinity}))
      .filter(v=>v.d<=40).sort((a,b)=>a.d-b.d||a.i-b.i);
    const start=starts.find(v=>canTravel(env,position,cellCenter(env,v.i),radius));
    if(!start) continue;
    const parent=free.map(()=>-1), depth=free.map(()=>Infinity), queue=[start.i];depth[start.i]=0;
    for(let q=0;q<queue.length;q++) for(const next of links[queue[q]]) if(depth[next]===Infinity) {
      depth[next]=depth[queue[q]]+1;parent[next]=queue[q];queue.push(next);
    }
    const candidates=queue.filter(i=>frontiers[i]&&!reserved.includes(i));
    // Spread targets first; if the known frontier is small, still reserve unique cells.
    const distant=candidates.filter(i=>reserved.every(j=>Math.hypot(cellCenter(env,i).x-cellCenter(env,j).x,cellCenter(env,i).y-cellCenter(env,j).y)>=60));
    const pool=distant.length?distant:candidates;
    pool.sort((a,b)=>depth[a]-depth[b]||a-b);
    if(!pool.length) continue;
    const target=pool[0], indices=[target];
    while(indices[indices.length-1]!==start.i) indices.push(parent[indices[indices.length-1]]);
    assigned[agent]={target,path:indices.reverse().map(i=>cellCenter(env,i))}; reserved.push(target);
  }
  return assigned;
}
