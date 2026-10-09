import type { RescueDiscovery } from '../simulation/rescue';
import { useEffect, useRef } from 'react';
import type { BioBug, Environment, Vec2 } from '../domain/types';
import { drawEnvironment } from '../rendering/drawEnvironment';
import { drawBioBug } from '../rendering/drawBioBug';
interface Props { picking?:boolean; onWaypoint?:(p:Vec2)=>void; discoveries:RescueDiscovery[]; onDiscovery:(id:string)=>void; environment:Environment; agents:{bug:BioBug;color:string;path:Vec2[];altitude?:number}[]; selected:number; onSelect:(i:number)=>void; reveal:boolean; debug:boolean }
function paint(canvas:HTMLCanvasElement,p:Props) {
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
      if(props.picking){props.onWaypoint?.({x,y});return;}
      const marker=props.discoveries.find(d=>Math.hypot(d.estimatedPosition.x-x,d.estimatedPosition.y-y)<20);if(marker){props.onDiscovery(marker.id);return;}
      const nearest=props.agents.map((a,i)=>({i,d:Math.hypot(a.bug.position.x-x,a.bug.position.y-y)})).sort((a,b)=>a.d-b.d)[0];if(nearest?.d<24)props.onSelect(nearest.i);}}>
    BioBug swarm explores a shared disaster map. Agent selection is available in the roster.
  </canvas>;
}
