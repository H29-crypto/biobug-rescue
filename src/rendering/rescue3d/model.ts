import type { BioBug, Environment } from '../../domain/types';
import type { RescueDiscovery } from '../../simulation/rescue';

/** No hidden target fields cross this renderer contract. All lengths are simulation units. */
export type SceneEnvironment = Pick<Environment, 'width' | 'height' | 'obstacles' | 'entry' | 'exploration'>;
export interface SceneAgent { bug: BioBug; color: string; distance: number; altitude?:number; motion?:'walk'|'flight'; sampleTime?:number; motionSamples?:MotionSample[]; motionConnected?:boolean }
export interface SceneFrame { agents: SceneAgent[]; discoveries: RescueDiscovery[]; selected: number; elapsed: number; running?:boolean; explored: boolean[] }
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

/** Observed fixed-step poses, transported in bounded radio packets; never predicted. */
export interface MotionSample {time:number;x:number;y:number;heading:number;altitude:number;distance:number;state:BioBug['state'];motion:'walk'|'flight'}
export const MOTION_PLAYBACK_DELAY=.8;
export function receivedPose(samples:readonly MotionSample[],time:number):MotionSample {
  const last=samples[samples.length-1];if(!last)throw Error('No received motion');
  if(time<=samples[0].time)return {...samples[0]};if(time>=last.time)return {...last};
  const upper=samples.findIndex(p=>p.time>=time),a=samples[upper-1],b=samples[upper],t=(time-a.time)/(b.time-a.time);
  const turn=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));
  return {...a,time,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:a.heading+turn*t,altitude:a.altitude+(b.altitude-a.altitude)*t,distance:a.distance+(b.distance-a.distance)*t};
}
/** Display-only buffered playback. It cannot extrapolate, command or read onboard truth. */
export class ReceivedMotionPlayback {
  private states=new Map<string,{cursor:number;elapsed:number;pose:MotionSample}>();
  update(frame:SceneFrame,delta=0):SceneFrame {
    const agents=frame.agents.map(agent=>{
      const samples=agent.motionSamples;if(!samples?.length)return agent;
      let entry=this.states.get(agent.bug.id);
      const first=samples[0].time,last=samples[samples.length-1].time,target=Math.max(first,Math.min(last,frame.elapsed-MOTION_PLAYBACK_DELAY));
      if(!entry||frame.elapsed<entry.elapsed){entry={cursor:target,elapsed:frame.elapsed,pose:receivedPose(samples,target)};this.states.set(agent.bug.id,entry);}
      if(frame.running!==false&&agent.motionConnected!==false){
        entry.cursor=Math.max(first,Math.min(target,entry.cursor+Math.max(0,Math.min(delta,.1))));
        entry.pose=receivedPose(samples,entry.cursor);
      }
      entry.elapsed=frame.elapsed;const p=entry.pose;
      return {...agent,bug:{...agent.bug,position:{x:p.x,y:p.y},heading:p.heading,state:p.state},distance:p.distance,altitude:p.altitude,motion:p.motion,sampleTime:p.time};
    });
    for(const id of this.states.keys())if(!agents.some(a=>a.bug.id===id))this.states.delete(id);
    return {...frame,agents};
  }
}
