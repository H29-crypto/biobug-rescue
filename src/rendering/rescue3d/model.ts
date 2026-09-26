import type { BioBug, Environment } from '../../domain/types';
import type { RescueDiscovery } from '../../simulation/rescue';

/** No hidden target fields cross this renderer contract. All lengths are simulation units. */
export type SceneEnvironment = Pick<Environment, 'width' | 'height' | 'obstacles' | 'entry' | 'exploration'>;
export interface SceneAgent { bug: BioBug; color: string; distance: number }
export interface SceneFrame { agents: SceneAgent[]; discoveries: RescueDiscovery[]; selected: number; elapsed: number; explored: boolean[] }
export type CameraMode = 'overview' | 'follow';
export function sceneEnvironment(e: Environment): SceneEnvironment {
  return { width:e.width, height:e.height, obstacles:e.obstacles.map(o=>({...o})), entry:{...e.entry}, exploration:{...e.exploration, explored:[...e.exploration.explored]} };
}
/** Three's horizontal plane is X/Z; simulation positive Y points south. */
export function worldPose(bug: Pick<BioBug,'position'|'heading'>) {
  return { x:bug.position.x, z:bug.position.y, yaw:-bug.heading };
}
/** Animate legs by actual accumulated translation, so pause and neural waits freeze gait. */
export function gaitPhase(distance:number, index:number, side:number) {
  return distance * .32 + ((index + (side > 0 ? 1 : 0)) % 2) * Math.PI;
}
export function writeExploration(data: Uint8Array, explored: readonly boolean[]) {
  let changed=false;
  for(let i=0;i<explored.length;i++) {
    const value=explored[i]?255:0, j=i*4;
    if(data[j]!==value){data[j]=data[j+1]=data[j+2]=value;changed=true;}
    data[j+3]=255;
  }
  return changed;
}
/** Stable decoration noise independent of the mission's random generator. */
export function visualRandom(seed:number) {
  let n=seed>>>0;
  return ()=>{ n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296; };
}
