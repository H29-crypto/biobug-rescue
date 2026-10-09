import {useEffect,useRef,useState} from 'react';
import type {FlyResult,FlySimulation} from './simulation';
import {FlyCanvas} from './FlyCanvas';
import type {PaintStats} from './FlyCanvas';
import {embodimentPose} from './embodimentModel';
import type {BodyStyle,MotionStyle} from './embodimentModel';
import type {EmbodimentScene,EmbodimentPerformance} from './embodimentScene';
import './embodiment.css';

export function FlyEmbodiment({sim,showPath,comparisons,onSelect,onPerformance}:{
  sim:FlySimulation;showPath:boolean;comparisons:FlyResult[];onSelect:()=>void;onPerformance:(p:PaintStats)=>void;
}){
  const [style,setStyle]=useState<BodyStyle>('biobug'),[map,setMap]=useState(false),[failure,setFailure]=useState('');
  const [stats,setStats]=useState<EmbodimentPerformance|null>(null);
  const [motion,setMotion]=useState<MotionStyle>('flight');
  const host=useRef<HTMLDivElement>(null),scene=useRef<EmbodimentScene|null>(null);
  const pose=embodimentPose(sim),latest=useRef({pose,style,motion});latest.current={pose,style,motion};
  const use3d=style!=='simple'&&!failure;
  useEffect(()=>{
    if(!use3d)return;
    let cancelled=false;
    const arena={width:sim.environment.width,height:sim.environment.height,obstacles:sim.environment.obstacles.map(o=>({x:o.x,y:o.y,width:o.width,height:o.height}))};
    void import('./embodimentScene').then(({createEmbodimentScene})=>{
      if(cancelled||!host.current)return;
      try{
        scene.current=createEmbodimentScene(host.current,arena,latest.current.pose,setStats,()=>setFailure('WebGL context lost. Showing the simple body.'));
        scene.current.update(latest.current.pose,latest.current.style,latest.current.motion);
      }catch{setFailure('3D rendering is unavailable. Showing the simple body.');}
    }).catch(()=>{if(!cancelled)setFailure('3D renderer could not load. Showing the simple body.');});
    return()=>{cancelled=true;scene.current?.dispose();scene.current=null;};
  },[use3d,sim.environment]);
  useEffect(()=>{scene.current?.update(pose,style,motion);});
  const canvas=<FlyCanvas sim={sim} showPath={showPath} comparisons={comparisons} onSelect={onSelect} onPerformance={onPerformance}/>;
  return <div className="fly-embodiment">
    <div className="embodiment-toolbar"><label>BODY STYLE<select aria-label="Body style" value={style} onChange={e=>{setStyle(e.target.value as BodyStyle);setFailure('');setStats(null);}}>
      <option value="natural">NATURAL FLY</option><option value="biobug">BIOBUG / CYBORG FLY</option><option value="simple">SIMPLE / FALLBACK</option>
    </select></label><label>MOTION DISPLAY<select aria-label="Motion display" value={motion} disabled={!use3d} onChange={e=>setMotion(e.target.value as MotionStyle)}>
      <option value="flight">FLYING</option><option value="walk">WALKING</option>
    </select></label><span>VISUAL ONLY</span></div>
    {failure&&<p className="fly-error" role="status">{failure}</p>}
    {use3d?<><div className="embodiment-stage"><div ref={host} className="embodiment-canvas"/>
      <div className="embodiment-caption"><b>{style==='biobug'?'BIOBUG · INSTRUMENTED':'DROSOPHILA · NATURAL'}</b><span>ILLUSTRATIVE EMBODIMENT / NOT A SCAN</span></div>
      <div className="embodiment-status">{!pose.running?'PAUSED':pose.waiting?'NEURAL WAIT':motion==='flight'?(pose.moving?'FLYING':'HOVERING'):pose.moving?'WALKING':'HELD'}<br/>{pose.time.toFixed(2)} s · {pose.speed.toFixed(1)} u/s</div>
      <div className="embodiment-cameras"><button onClick={()=>scene.current?.preset('follow')}>FOLLOW / RESET</button><button onClick={()=>scene.current?.preset('overview')}>ARENA</button></div>
    </div><div className="embodiment-note">Drag to orbit · scroll to zoom. {motion==='flight'?'Visual flight: wingbeats, tucked legs and hovering follow the existing ground path. Height is illustrative; obstacle sensing and collisions stay planar.':'Walking: six articulated legs follow traveled distance.'} {style==='biobug'?'A small thorax pack adds illustrative instrumentation.':'Natural body, without instrumentation.'} Pause freezes the body and wings.</div>
    <details className="embodiment-map" open={map} onToggle={e=>setMap(e.currentTarget.open)}><summary>2D ARENA · SENSORS & PATHS</summary>{map&&canvas}</details>
    <details className="embodiment-performance"><summary>Body rendering performance</summary><p>{stats?`${stats.fps.toFixed(1)} FPS · ${stats.frameMs.toFixed(2)} ms/frame · ${stats.cpuMs.toFixed(2)} ms CPU submit`:'Measuring…'}</p>{stats&&<p>{stats.drawCalls} draw calls · {stats.triangles.toLocaleString()} triangles · {(stats.geometryBytes/1024).toFixed(1)} KiB geometry · {stats.setupMs.toFixed(0)} ms scene setup</p>}<small>30 FPS display budget. CPU submission is not GPU execution time; geometry excludes driver/framebuffer memory. Animation uses simulated time and traveled distance.</small></details>
    </>:canvas}
  </div>;
}
