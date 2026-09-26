import { useEffect, useRef, useState } from 'react';
import type { Environment } from '../domain/types';
import type { RescueDiscovery } from '../simulation/rescue';
import type { SceneAgent, CameraMode } from '../rendering/rescue3d/model';
import { sceneEnvironment } from '../rendering/rescue3d/model';
import type { RescueScene } from '../rendering/rescue3d/scene';
import { EnvironmentCanvas } from './EnvironmentCanvas';
import './rescue3d.css';

interface Props {
  environment:Environment; agents:(SceneAgent & {path:{x:number;y:number}[]})[]; selected:number;
  discoveries:RescueDiscovery[]; elapsed:number; running:boolean;
  onSelect:(index:number)=>void; onDiscovery:(id:string)=>void; onExit:()=>void; onToggle:()=>void; resumeDisabled:boolean;
}
const renderFrame=(p:Props)=>({agents:p.agents,discoveries:p.discoveries,selected:p.selected,elapsed:p.elapsed,explored:p.environment.exploration.explored});
export default function Rescue3D(props:Props) {
  const host=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
  const scene=useRef<RescueScene|null>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'failed'>('loading');
  const [camera,setCamera]=useState<CameraMode>('overview');
  const [fog,setFog]=useState(true),[wide,setWide]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    if(status==='failed')return;
    void import('../rendering/rescue3d/scene').then(({createRescueScene})=>{
      if(cancelled||!host.current)return;
      try {
        const view=createRescueScene(host.current,sceneEnvironment(live.current.environment),i=>live.current.onSelect(i),()=>setStatus('failed'));
        scene.current=view;view.update(renderFrame(live.current));setStatus('ready');
      } catch { setStatus('failed'); }
    }).catch(()=>{if(!cancelled)setStatus('failed');});
    return()=>{cancelled=true;scene.current?.dispose();scene.current=null;};
    // The parent remounts on mission reset. Snapshot identity changes every frame.
  },[status==='failed']);
  useEffect(()=>{scene.current?.update(renderFrame(props));});
  useEffect(()=>{if(!wide)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setWide(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[wide]);
  const changeCamera=(mode:CameraMode)=>{setCamera(mode);scene.current?.camera(mode);};
  const selected=props.agents[props.selected];
  const fallback=<EnvironmentCanvas {...props} reveal={false} debug={false}/>;
  return <div className={`rescue-3d ${wide?'scene-expanded':''}`}>
    <div className="scene-toolbar"><div className="scene-mode-buttons" role="group" aria-label="3D camera"><button disabled={status!=='ready'} aria-pressed={camera==='overview'} onClick={()=>changeCamera('overview')}>◈ OVERHEAD</button><button disabled={status!=='ready'} aria-pressed={camera==='follow'} onClick={()=>changeCamera('follow')}>◎ FOLLOW BIOBUG</button></div><div className="scene-actions">{wide&&<button disabled={props.resumeDisabled} onClick={props.onToggle}>{props.running?'PAUSE':'RESUME / DEPLOY'}</button>}<button disabled={status!=='ready'} aria-label="Zoom in" onClick={()=>scene.current?.zoom(.8)}>＋</button><button disabled={status!=='ready'} aria-label="Zoom out" onClick={()=>scene.current?.zoom(1.25)}>−</button><button disabled={status!=='ready'} aria-pressed={fog} onClick={()=>{scene.current?.fog(!fog);setFog(!fog);}}>MISSION FOG {fog?'ON':'OFF'}</button><button aria-pressed={wide} onClick={()=>setWide(!wide)}>{wide?'EXIT FOCUS':'FOCUS SCENE'}</button></div></div>
    <div className="scene-stage">
      {status!=='failed'&&<div className="scene-canvas" ref={host}/>}
      {status==='loading'&&<div className="scene-loading" role="status"><span className="scene-loading-icon">✳</span><strong>ASSEMBLING RESCUE SCENE</strong><span>Loading the 3D renderer…</span></div>}
      {status==='failed'&&<div className="scene-fallback"><div role="alert"><strong>3D graphics unavailable</strong><p>Your mission is intact. The live 2D map remains available.</p><button onClick={props.onExit}>RETURN TO PRESENTATION MODE</button></div>{fallback}</div>}
      {status==='ready'&&<>
        <div className="scene-hud"><span className="scene-live-dot"/>{props.running?'LIVE MISSION':'MISSION PAUSED'}<span className="scene-hud-divider">/</span>{camera==='follow'?`TRACKING ${selected.bug.id.toUpperCase()}`:'STRUCTURAL CUTAWAY'}<small>SIMULATED ENVIRONMENT</small></div>
        <div className="scene-compass" aria-hidden="true">3D<span>◈</span></div>
        <div className="scene-minimap"><span>SHARED RESCUE MAP</span>{fallback}</div>
        <div className="scene-bottom-hud"><strong>{camera==='follow'?'FOLLOW CAMERA':'ORBIT CAMERA'}</strong><span>{camera==='follow'?'Tracking actual position · use + / − to adjust distance':'Drag to orbit · scroll to zoom · click a BioBug to select'}</span><small>{fog?'Dim areas are unmapped · discoveries use sensor estimates':'Terrain inspection only · hidden targets remain hidden'}</small></div>
      </>}
    </div>
    <div className="scene-roster" role="group" aria-label="Select 3D BioBug">{props.agents.map((agent,i)=><button key={agent.bug.id} aria-pressed={props.selected===i} onClick={()=>props.onSelect(i)}><span style={{background:agent.color}}/><strong>BUG {String(i+1).padStart(2,'0')}</strong><small>{agent.bug.state}</small></button>)}</div>
    <div className="scene-telemetry"><span>SELECTED / <b>{selected.bug.id}</b></span>{(['left','front','right'] as const).map(side=><label key={side}>{side.toUpperCase()}<meter min={0} max={85} value={selected.bug.sensors[`${side}Distance`]}/><span>{selected.bug.sensors[`${side}Distance`].toFixed(0)} u</span></label>)}</div>
    <p className="scene-disclaimer">Same mission, rendered in 3D. Insect bodies, leg motion and building heights are illustrative. Navigation remains on the original 2D plane.</p>
  </div>;
}
