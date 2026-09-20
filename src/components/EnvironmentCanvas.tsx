import { useEffect, useRef } from 'react';
import type { BioBug, Environment, Vec2 } from '../domain/types';
import { drawEnvironment } from '../rendering/drawEnvironment';
import { drawBioBug } from '../rendering/drawBioBug';
interface Props { environment:Environment; agents:{bug:BioBug;color:string;path:Vec2[]}[]; selected:number; onSelect:(i:number)=>void; reveal:boolean; debug:boolean }
function paint(canvas:HTMLCanvasElement,p:Props) {
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(canvas.width/p.environment.width,0,0,canvas.height/p.environment.height,0,0);
  drawEnvironment(ctx,p.environment,p.reveal);
  const selected=p.agents[p.selected];
  if(p.debug&&selected?.path.length){
    ctx.save();ctx.strokeStyle=selected.color;ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.beginPath();
    ctx.moveTo(selected.bug.position.x,selected.bug.position.y);selected.path.forEach(v=>ctx.lineTo(v.x,v.y));ctx.stroke();ctx.restore();
  }
  p.agents.forEach((a,i)=>drawBioBug(ctx,a.bug,p.debug&&i===p.selected,a.color,i===p.selected));
}
export function EnvironmentCanvas(props:Props) {
  const ref=useRef<HTMLCanvasElement>(null),latest=useRef(props);latest.current=props;
  useEffect(()=>{if(ref.current)paint(ref.current,props);},[props]);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const resize=()=>{const bounds=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.round(bounds.width*dpr);canvas.height=Math.round(bounds.height*dpr);paint(canvas,latest.current);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    return()=>observer.disconnect();
  },[]);
  return <canvas ref={ref} style={{aspectRatio:`${props.environment.width} / ${props.environment.height}`}} role="img"
    aria-label={`Disaster map with ${props.agents.length} BioBugs and shared exploration. Select an agent using the roster or by clicking it on the map.`}
    onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();const x=(event.clientX-bounds.left)/bounds.width*props.environment.width,y=(event.clientY-bounds.top)/bounds.height*props.environment.height;
      const nearest=props.agents.map((a,i)=>({i,d:Math.hypot(a.bug.position.x-x,a.bug.position.y-y)})).sort((a,b)=>a.d-b.d)[0];if(nearest?.d<24)props.onSelect(nearest.i);}}>
    BioBug swarm explores a shared disaster map. Agent selection is available in the roster.
  </canvas>;
}
