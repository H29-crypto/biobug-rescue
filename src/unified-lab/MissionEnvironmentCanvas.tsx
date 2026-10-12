import type { RescueDiscovery } from '../simulation/rescue';
import { useEffect, useRef } from 'react';
import type { BioBug, Environment, Vec2 } from '../domain/types';
import { drawEnvironment } from './missionDrawEnvironment';
import { drawBioBug } from './missionDrawBioBug';
import { MX, MX_FONT_MONO, pill, type MapTheme } from '../rendering/missionPalette';
interface Props { picking?:boolean; onWaypoint?:(p:Vec2)=>void; discoveries:RescueDiscovery[]; onDiscovery:(id:string)=>void; environment:Environment; agents:{bug:BioBug;color:string;path:Vec2[];altitude?:number}[]; selected:number; onSelect:(i:number)=>void; reveal:boolean; debug:boolean; theme?:MapTheme }
type Trails=Map<string,Vec2[]>;
function paint(canvas:HTMLCanvasElement,p:Props,trails?:Trails) {
  if(p.theme==='mission'){paintMission(canvas,p,trails??new Map());return;}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(canvas.width/p.environment.width,0,0,canvas.height/p.environment.height,0,0);
  drawEnvironment(ctx,p.environment,p.reveal);
  // Only operator estimates are drawn, independently of terrain inspection/fog.
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  for(let row=0;row<4;row++)for(let col=0;col<4;col++) {ctx.fillStyle='#7d929d';ctx.font='10px monospace';ctx.fillText(`${'ABCD'[row]}${col+1}`,col*200+18,row*140+14);}
  for(const d of p.discoveries) {
    const {x,y}=d.estimatedPosition;ctx.strokeStyle=d.kind==='gas'?'#f2bd66':'#8af3c9';ctx.fillStyle='#10262c';
    ctx.setLineDash(d.status==='possible'?[3,3]:[]);ctx.beginPath();ctx.arc(x,y,16,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=d.kind==='gas'?'#f2bd66':'#8af3c9';ctx.font='bold 18px sans-serif';ctx.fillText(d.kind==='gas'?'!':d.status==='confirmed'?'+':'?',x,y);
    ctx.font='10px monospace';ctx.fillText(`${d.kind==='gas'?'GAS':d.id.startsWith('T-')?'HEAT ?':'LIFE'} / ${d.sector}`,x,y+27);
  }
  ctx.restore();
  const selected=p.agents[p.selected];
  if(p.debug&&selected?.path.length){
    ctx.save();ctx.strokeStyle=selected.color;ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();
    ctx.moveTo(selected.bug.position.x,selected.bug.position.y);selected.path.forEach(v=>ctx.lineTo(v.x,v.y));ctx.stroke();ctx.restore();
  }
  p.agents.forEach((a,i)=>drawBioBug(ctx,a.bug,p.debug&&i===p.selected,a.color,i===p.selected));
}

/* ───────── Dark mission theme (presentation only) ───────── */
const TRAIL_MAX=260;
/** Presentation-only trail memory. Cleared on teleports (reset / new mission) or roster changes. */
function updateTrails(trails:Trails,agents:Props['agents']){
  const ids=new Set(agents.map(a=>a.bug.id));
  for(const id of [...trails.keys()])if(!ids.has(id))trails.delete(id);
  for(const a of agents){
    const t=trails.get(a.bug.id)??[],last=t[t.length-1],p=a.bug.position;
    if(last&&Math.hypot(p.x-last.x,p.y-last.y)>80)t.length=0;
    if(!last||t.length===0||Math.hypot(p.x-last.x,p.y-last.y)>=4){t.push({x:p.x,y:p.y});if(t.length>TRAIL_MAX)t.splice(0,t.length-TRAIL_MAX);}
    trails.set(a.bug.id,t);
  }
}
function drawTrails(ctx:CanvasRenderingContext2D,trails:Trails){
  ctx.save();ctx.strokeStyle=MX.explore;ctx.lineCap='round';ctx.lineJoin='round';
  for(const t of trails.values()){
    if(t.length<2)continue;
    const n=t.length,bands=4;
    for(let b=0;b<bands;b++){
      const from=Math.floor(n*b/bands),to=Math.min(n-1,Math.floor(n*(b+1)/bands));if(to<=from)continue;
      ctx.globalAlpha=0.12+0.16*b;ctx.lineWidth=1.5+0.5*b;ctx.beginPath();ctx.moveTo(t[from].x,t[from].y);
      for(let i=from+1;i<=to;i++)ctx.lineTo(t[i].x,t[i].y);ctx.stroke();
    }
  }
  ctx.restore();
}
function cloud(ctx:CanvasRenderingContext2D,x:number,y:number){
  ctx.beginPath();ctx.arc(x-4,y+1.5,3.6,Math.PI*0.5,Math.PI*1.5);ctx.arc(x-0.5,y-2.5,4.4,Math.PI,Math.PI*1.9);ctx.arc(x+4,y+0.5,3.4,Math.PI*1.4,Math.PI*0.5);ctx.closePath();ctx.fill();
}
function drawMarker(ctx:CanvasRenderingContext2D,d:RescueDiscovery){
  const {x,y}=d.estimatedPosition,gas=d.kind==='gas',confirmed=!gas&&d.status==='confirmed';
  const color=gas?MX.hazard:confirmed?MX.confirmed:MX.uncertain;
  ctx.save();
  if(gas){
    // Estimated hazard area: soft red fill + diagonal hatching, dashed edge while still a warning.
    const r=d.status==='high gas'?40:32;
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=0.12;ctx.fill();ctx.clip();
    ctx.globalAlpha=0.38;ctx.strokeStyle=color;ctx.lineWidth=1;
    for(let k=-r*2;k<r*2;k+=6){ctx.beginPath();ctx.moveTo(x+k-r,y+r);ctx.lineTo(x+k+r,y-r);ctx.stroke();}
    ctx.restore();
    ctx.strokeStyle=color;ctx.globalAlpha=0.8;ctx.lineWidth=1.2;ctx.setLineDash(d.status==='high gas'?[]:[4,3]);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  } else {
    ctx.fillStyle=color;ctx.globalAlpha=0.14;ctx.beginPath();ctx.arc(x,y,24,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  // Icon badge
  ctx.fillStyle='#0b0f14';ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.setLineDash(!gas&&!confirmed?[3,2.5]:[]);
  ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=color;ctx.strokeStyle=color;
  if(gas)cloud(ctx,x,y);
  else if(confirmed){ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x-5,y+0.5);ctx.lineTo(x-1.5,y+4);ctx.lineTo(x+5.5,y-4);ctx.stroke();}
  else{ctx.font=`700 15px ${MX_FONT_MONO}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',x,y+1);}
  ctx.restore();
  const label=gas?(d.status==='high gas'?'HIGH GAS':'GAS'):confirmed?'SURVIVOR \u2713':d.id.startsWith('T-')?'HEAT ?':'POSSIBLE ?';
  pill(ctx,`${label} \u00b7 ${d.sector}`,x,y+(gas?(d.status==='high gas'?52:44):32),color);
}
function paintMission(canvas:HTMLCanvasElement,p:Props,trails:Trails){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(canvas.width/p.environment.width,0,0,canvas.height/p.environment.height,0,0);
  drawEnvironment(ctx,p.environment,p.reveal,'mission');
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=MX.faint;ctx.font=`500 10px ${MX_FONT_MONO}`;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)ctx.fillText(`${'ABCD'[row]}${col+1}`,col*200+18,row*140+14);
  ctx.restore();
  drawTrails(ctx,trails);
  // Gas areas under life markers so labels stay readable.
  [...p.discoveries].sort((a,b)=>(a.kind==='gas'?0:1)-(b.kind==='gas'?0:1)).forEach(d=>drawMarker(ctx,d));
  const selected=p.agents[p.selected];
  if(p.debug&&selected?.path.length){
    ctx.save();ctx.strokeStyle=selected.color;ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();
    ctx.moveTo(selected.bug.position.x,selected.bug.position.y);selected.path.forEach(v=>ctx.lineTo(v.x,v.y));ctx.stroke();ctx.restore();
  }
  p.agents.forEach((a,i)=>drawBioBug(ctx,a.bug,p.debug&&i===p.selected,a.color,i===p.selected,'mission'));
}
export function MissionEnvironmentCanvas(props:Props) {
  const ref=useRef<HTMLCanvasElement>(null),latest=useRef(props),trails=useRef<Trails>(new Map());latest.current=props;
  useEffect(()=>{if(props.theme==='mission')updateTrails(trails.current,props.agents);if(ref.current)paint(ref.current,props,trails.current);},[props]);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const resize=()=>{const bounds=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.round(bounds.width*dpr);canvas.height=Math.round(bounds.height*dpr);paint(canvas,latest.current,trails.current);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    return()=>observer.disconnect();
  },[]);
  return <canvas ref={ref} style={{aspectRatio:`${props.environment.width} / ${props.environment.height}`}} role="img" className={props.theme==='mission'?'mx-canvas':undefined}
    aria-label={`Disaster map with ${props.agents.length} BioBugs and shared exploration. Select an agent using the roster or by clicking it on the map.`}
    onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width*props.environment.width,y=(event.clientY-bounds.top)/bounds.height*props.environment.height;
      if(props.picking){props.onWaypoint?.({x,y});return;}
      const marker=props.discoveries.find(d=>Math.hypot(d.estimatedPosition.x-x,d.estimatedPosition.y-y)<20);if(marker){props.onDiscovery(marker.id);return;}
      const nearest=props.agents.map((a,i)=>({i,d:Math.hypot(a.bug.position.x-x,a.bug.position.y-y)})).sort((a,b)=>a.d-b.d)[0];if(nearest?.d<24)props.onSelect(nearest.i);}}>
    BioBug swarm explores a shared disaster map. Agent selection is available in the roster.
  </canvas>;
}

