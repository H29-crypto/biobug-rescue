import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createSupervised,advanceSupervised,explore,takeControl,resumeAutonomy,setWaypoint,setRunning,setLink,steer,release} from './model';
import type {Supervised} from './model';
import {SupervisedNeuralLoop} from './neural';
import {embodimentPose} from '../virtual-fly/embodimentModel';
import type {BodyStyle} from '../virtual-fly/embodimentModel';
import type {EmbodimentScene} from '../virtual-fly/embodimentScene';
import '../virtual-fly/fly-lab.css';
import './supervised.css';
const Anatomy=lazy(()=>import('../virtual-fly/AnatomicalViewer').then(m=>({default:m.AnatomicalPanel})));

function Body({state}:{state:Supervised}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<EmbodimentScene|null>(null);
  const [style,setStyle]=useState<BodyStyle>('biobug'),[error,setError]=useState('');
  const latest=useRef({pose:embodimentPose(state.sim),style});latest.current={pose:embodimentPose(state.sim),style};
  useEffect(()=>{let cancelled=false;setError('');
    void import('../virtual-fly/embodimentScene').then(({createEmbodimentScene})=>{
      if(cancelled||!host.current)return;
      try{scene.current=createEmbodimentScene(host.current,state.sim.environment,latest.current.pose,()=>{},()=>setError('3D context lost. The map and controls remain available.'));scene.current.update(latest.current.pose,latest.current.style,'walk');}
      catch{setError('3D unavailable. Use the arena map below.');}
    }).catch(()=>{if(!cancelled)setError('3D could not load. Use the arena map below.');});
    return()=>{cancelled=true;scene.current?.dispose();scene.current=null;};
  },[state]);
  useEffect(()=>{scene.current?.update(latest.current.pose,style,'walk');});
  return <section className="fly-card supervised-body"><div className="supervised-row"><h2>Single-fly walking arena</h2><label>BODY <select aria-label="Supervised body style" value={style} onChange={e=>setStyle(e.target.value as BodyStyle)}><option value="biobug">Instrumented fly</option><option value="natural">Natural fly</option></select></label></div>
    <div className="supervised-stage" ref={host}/>{error&&<p role="status">{error}</p>}
    <div className="supervised-row"><button onClick={()=>scene.current?.preset('follow')}>Follow insect</button><button onClick={()=>scene.current?.preset('overview')}>Arena overview</button><small>RESEARCH VIEW · exact simulated pose</small></div>
    <p>Walking only. Body speed and turning have acceleration limits; collision contact blocks translation. Legs remain procedural animation, not muscle or joint dynamics.</p>
  </section>;
}

function ArenaMap({state,onWaypoint}:{state:Supervised;onWaypoint:(x:number,y:number)=>void}){
  const {sim}=state,p=sim.fly.position;const probes=[['left',-Math.PI/4],['front',0],['right',Math.PI/4]] as const;
  return <svg className="supervised-map" viewBox="0 0 720 480" role="img" aria-label="Known test arena. Click open ground to assign a waypoint. Keyboard users can use destination coordinates below."
    onClick={e=>{const box=e.currentTarget.getBoundingClientRect();onWaypoint((e.clientX-box.left)*720/box.width,(e.clientY-box.top)*480/box.height);}}>
    <rect width="720" height="480" fill="#0c2028"/>
    {sim.environment.obstacles.map(o=><rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height} fill="#77948e"/>)}
    <polyline points={sim.path.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#7dafbb" strokeWidth="2" opacity=".5"/>
    {state.route.length>0&&<polyline points={[p,...state.route].map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#e7c581" strokeDasharray="6 5" strokeWidth="2"/>}
    {state.goal&&<g transform={`translate(${state.goal.x} ${state.goal.y})`}><circle r="9" fill="none" stroke="#efcd85" strokeWidth="2"/><path d="M-14 0H14M0-14V14" stroke="#efcd85"/></g>}
    {probes.map(([key,offset])=><line key={key} x1={p.x} y1={p.y} x2={p.x+Math.cos(sim.fly.heading+offset)*17} y2={p.y+Math.sin(sim.fly.heading+offset)*17} stroke={state.contact[key]>0?'#ff9277':'#8ecebc'} strokeWidth="3"/>)}
    <circle cx={p.x} cy={p.y} r="7" fill="#b9f3cf"/><text x="42" y="430" fill="#adc9c6" fontSize="13">Known arena · world units · contact probes in coral</text>
  </svg>;
}

export default function SupervisedLab(){
  const state=useRef<Supervised|null>(null);if(!state.current)state.current=createSupervised();
  const loop=useRef<SupervisedNeuralLoop|null>(null),held=useRef(new Set<string>());
  const [,render]=useState(0),[controller,setController]=useState<'rule-based'|'malecns'>('rule-based'),[showNeural,setShowNeural]=useState(true),[destination,setDestination]=useState({x:560,y:240});
  const s=state.current,sim=s.sim,packet=s.packet;
  const refresh=()=>render(n=>n+1);
  const clear=()=>{held.current.clear();if(state.current!.authority==='operator')release(state.current!);};
  const action=(fn:(s:Supervised)=>unknown)=>{clear();const old=state.current!,generation=old.sim.generation;fn(old);if(state.current!==old||old.sim.generation!==generation)loop.current?.cancel();refresh();};
  useEffect(()=>{const network=new SupervisedNeuralLoop();loop.current=network;let frame=0,previous:number|null=null,lastPaint=0;
    const tick=(now:number)=>{const s=state.current!;
      if(held.current.size){const keys=held.current;steer(s,Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown')),Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft')));}
      if(previous!==null)advanceSupervised(s,(now-previous)/1000);previous=now;void network.pump(s,()=>state.current!,refresh);
      if(now-lastPaint>40){refresh();lastPaint=now;}frame=requestAnimationFrame(tick);
    };
    const blur=()=>{clear();};const visibility=()=>{if(document.hidden){clear();network.cancel();setRunning(state.current!,false);refresh();}};
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);network.dispose();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const waypoint=(x:number,y:number)=>action(s=>setWaypoint(s,{x,y}));
  const reset=()=>action(old=>{old.sim.generation++;state.current=createSupervised(controller);});
  const key=(event:React.KeyboardEvent,down:boolean)=>{
    const k=event.key.length===1?event.key.toLowerCase():event.key;
    if(!['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))return;
    event.preventDefault();if(k===' '){clear();return;}
    if(down&&s.authority==='operator'&&s.connected&&sim.running)held.current.add(k);else held.current.delete(k);
    if(!held.current.size)release(s);
  };
  return <main className="fly-lab supervised-lab"><div className="fly-title"><div><p className="fly-kicker">SUPERVISED AUTONOMY · SINGLE-INSECT BASELINE</p><h1>You guide. <span>It explores.</span></h1><p>A controlled walking trial before the next rescue milestone.</p></div><a href="#">All experiences ↗</a></div>
    <div className="fly-card supervised-row"><label>Autonomous controller <select aria-label="Supervised controller" value={controller} onChange={e=>setController(e.target.value as typeof controller)}><option value="rule-based">Rule-based baseline</option><option value="malecns">MaleCNS contact controller</option></select></label><button onClick={reset}>New trial / apply controller</button><button className="fly-primary" onClick={()=>action(x=>setRunning(x,!x.sim.running))} disabled={sim.completed}>{sim.running?'Pause simulation':'Start / resume simulation'}</button><small>Changing the controller starts a fresh trial only when applied. Active: {sim.config.mode}. MaleCNS needs the local backend.</small></div>
    <div className="supervised-status"><span>{sim.completed?'TRIAL COMPLETE':sim.running?'RUNNING':'PAUSED'} · {sim.elapsed.toFixed(1)} / 120 s</span><span>AUTHORITY: {s.authority.toUpperCase()}</span><span>APPLIED: {s.source}</span></div>
    <div className="supervised-grid"><div><Body state={s}/><section className="fly-card"><div className="supervised-row"><h2>Known arena & waypoint</h2><small>Click open ground or enter coordinates</small></div>
      <ArenaMap state={s} onWaypoint={waypoint}/><form className="supervised-row" onSubmit={e=>{e.preventDefault();waypoint(destination.x,destination.y);}}><label>X <input aria-label="Waypoint X" type="number" min="0" max="720" required value={destination.x} onChange={e=>setDestination({...destination,x:e.target.valueAsNumber})}/></label><label>Y <input aria-label="Waypoint Y" type="number" min="0" max="480" required value={destination.y} onChange={e=>setDestination({...destination,y:e.target.valueAsNumber})}/></label><button disabled={!s.connected}>Assign waypoint</button></form><p role="status">{s.routeStatus}</p><small>This planner knows the test arena geometry. It is engineered guidance, not neural mapping or rescue exploration.</small></section></div>
      <div><section className="fly-card"><h2>Guidance console</h2><div className="supervised-buttons"><button disabled={!s.connected} aria-pressed={s.authority==='explore'} onClick={()=>action(explore)}>Explore automatically</button><button disabled={!s.connected} aria-pressed={s.authority==='operator'} onClick={()=>action(takeControl)}>Take control</button><button disabled={!s.connected||s.authority!=='operator'} onClick={()=>action(resumeAutonomy)}>Resume autonomy</button></div>
        <div className="steering-pad" role="group" aria-label="Operator steering. Focus here and hold WASD or arrow keys. Space releases steering." tabIndex={0} onKeyDown={e=>key(e,true)} onKeyUp={e=>key(e,false)} onBlur={clear}>
          <p>{s.authority==='operator'?'Hold WASD / arrow keys · Space releases':'Select Take control to enable steering'}</p><div className="steering-buttons">{[['w','Forward'],['a','Left'],['s','Reverse'],['d','Right']].map(([k,label])=><button key={k} disabled={s.authority!=='operator'||!s.connected||!sim.running} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);held.current.add(k);}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear} onContextMenu={e=>e.preventDefault()}>{label}</button>)}</div>
        </div><p>Operator commands temporarily replace automatic guidance. Body collisions still apply. Release, focus loss or radio loss clears steering; unattended commands expire after 0.35 simulated seconds.</p>
      </section><section className="fly-card"><div className="supervised-row"><h2>Simulated backpack</h2><b className={s.connected?'link-good':'link-lost'}>{s.connected?'LINKED':'DISCONNECTED'}</b></div><button onClick={()=>action(x=>setLink(x,!x.connected))}>{s.connected?'Simulate radio loss':'Restore radio'}</button>
        <p>Last received packet: {packet.time.toFixed(1)} s {s.connected?'· 5 Hz':'· frozen until reconnected'}</p><dl className="backpack-data"><dt>Reported position</dt><dd>{packet.position.x.toFixed(1)}, {packet.position.y.toFixed(1)}</dd><dt>Reported speed</dt><dd>{packet.speed.toFixed(1)} u/s</dd><dt>Reported turning</dt><dd>{packet.angular.toFixed(2)} rad/s</dd><dt>Body contact</dt><dd>{packet.bodyContact?'BLOCKED':'clear'}</dd><dt>Power budget</dt><dd>{packet.battery.toFixed(1)}%</dd><dt>Reported authority</dt><dd>{packet.authority}</dd></dl>
        <h3>Reported contact probe compression</h3>{(['left','front','right'] as const).map(side=><label className="contact-meter" key={side}><span>{side}</span><meter min="0" max="1" value={packet.contact[side]}/><b>{packet.contact[side].toFixed(2)}</b></label>)}
        <p>Contact is measured geometrically by three short virtual probes. Speed and turning are simplified body feedback, not joint proprioception. The ten-minute power budget is illustrative, not a validated fruit-fly payload.</p><small>Only this packet panel represents radio-received data. The 3D scene, map, event log and neural inspector are research instruments with direct access to simulation state.</small>
      </section></div></div>
    {sim.neural.error&&<p className="fly-error" role="alert">{sim.neural.error} · Start the backend and resume, or take operator control.</p>}
    <section className="fly-card"><div className="supervised-row"><h2>Neural research inspector</h2><button aria-expanded={showNeural} onClick={()=>setShowNeural(!showNeural)}>{showNeural?'Hide neurons':'Show neurons'}</button></div><p>MaleCNS uses the existing 295-neuron structural circuit with simulated dynamics. Short-contact inputs replace the old proximity stimulus in this arena only. This mapping and motor decoder are engineering hypotheses. No new biological pathway is claimed. {s.authority==='operator'?'Operator mode suspends neural evaluations; any visible activity is the last accepted historical sample.':'Waypoint planning and body-contact recovery can override the neural movement proposal; the applied source is shown above.'}</p>
      {showNeural&&<Suspense fallback={<p>Loading anatomical inspector…</p>}><Anatomy sim={sim} history={s.history} neuralSuspended={s.authority==='operator'} sourceLabel={`Supervised arena · ${sim.fly.id}`}/></Suspense>}
    </section><section className="fly-card"><h2>Research event log</h2><ol className="supervised-events">{s.events.map((e,i)=><li key={`${e.time}-${i}`}><time>{e.time.toFixed(2)} s</time> {e.text}</li>)}</ol></section>
    <p className="fly-premise">Scientific boundary: a fruit-fly connectome-based computational experiment, not a validated living-insect control device. Planar body collisions and procedural legs; no physical flight, muscles, vision, smell, survivor recognition or real neural recording is added in this trial.</p>
  </main>;
}
