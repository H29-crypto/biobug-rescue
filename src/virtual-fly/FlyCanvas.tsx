import { useEffect, useRef } from 'react';
import type { FlySimulation, FlyResult } from './simulation';
import { SENSOR_ANGLES } from '../simulation/sensors';
export interface PaintStats { fps:number; paintMs:number; physicsStepsPerSecond:number }
export function drawFlyArena(ctx:CanvasRenderingContext2D,s:FlySimulation,showPath:boolean,comparisons:FlyResult[]){
  const e=s.environment;ctx.clearRect(0,0,e.width,e.height);ctx.fillStyle='#0c1925';ctx.fillRect(0,0,e.width,e.height);
  ctx.strokeStyle='#1b2d3d';ctx.lineWidth=.5;
  for(let x=0;x<=e.width;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,e.height);ctx.stroke();}for(let y=0;y<=e.height;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(e.width,y);ctx.stroke();}
  s.visited.forEach((v,i)=>{if(v){ctx.fillStyle='#234851';ctx.fillRect(i%24*30,Math.floor(i/24)*30,30,30);}});
  e.obstacles.forEach(o=>{ctx.fillStyle='#596977';ctx.fillRect(o.x,o.y,o.width,o.height);ctx.strokeStyle='#8a9ba7';ctx.strokeRect(o.x+.5,o.y+.5,o.width-1,o.height-1);});
  function path(points:FlyResult['path'],color:string,dash:number[]=[]){if(points.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
  if(showPath){path(s.path,'#71dfc6');comparisons.forEach(r=>path(r.path,r.summary.config.mode==='rule-based'?'#f6bf73':'#bea6ff',r.summary.config.mode==='malecns'?[5,3]:[]));}
  const b=s.fly;ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.heading);
  (['left','front','right'] as const).forEach((side,i)=>{const a=SENSOR_ANGLES[side],d=b.sensors[`${side}Distance`]+b.radius;ctx.strokeStyle=['#79cfe9','#e8eddf','#eeb16b'][i];ctx.globalAlpha=.5;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*d,Math.sin(a)*d);ctx.stroke();ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,2,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();});ctx.globalAlpha=1;
  ctx.strokeStyle='#d4ba86';ctx.lineWidth=1.1;const phase=s.metrics.distance*.35;
  for(const side of [-1,1])for(let i=0;i<3;i++){const swing=Math.sin(phase+(i+(side>0?1:0))*Math.PI)*1.3;ctx.beginPath();ctx.moveTo(3-i*3,side*2);ctx.lineTo(4-i*4+swing,side*5);ctx.lineTo(6-i*6+swing,side*8);ctx.stroke();}
  ctx.fillStyle='#af8054';ctx.beginPath();ctx.ellipse(-3,0,6,3.2,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#4f3326';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-2-i*2,-2.7);ctx.lineTo(-2-i*2,2.7);ctx.stroke();}
  ctx.fillStyle='rgba(177,218,230,.45)';ctx.strokeStyle='#adced9';ctx.lineWidth=.7;for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(-3,side*3.6,6,2.7,side*.25,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#82674d';ctx.beginPath();ctx.ellipse(1.5,0,3.3,3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bca275';ctx.beginPath();ctx.ellipse(5,0,2.2,2.6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c14e49';for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(5.6,side*1.8,1.15,.9,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();ctx.strokeStyle='#7bdbcc';ctx.lineWidth=1;ctx.setLineDash([2,3]);ctx.beginPath();ctx.arc(b.position.x,b.position.y,14,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#acc6d2';ctx.font='11px monospace';ctx.fillText('START',e.entry.x-16,e.entry.y+29);ctx.fillStyle='#81d7c3';ctx.fillText('VIRTUAL FLY 01',b.position.x+18,b.position.y-12);
}
export function FlyCanvas({sim,showPath,comparisons,onSelect,onPerformance}:{sim:FlySimulation;showPath:boolean;comparisons:FlyResult[];onSelect:()=>void;onPerformance:(p:PaintStats)=>void}){
  const ref=useRef<HTMLCanvasElement>(null),latest=useRef({sim,showPath,comparisons,onPerformance});latest.current={sim,showPath,comparisons,onPerformance};
  const stats=useRef({start:0,count:0,ms:0,ticks:0});
  const paint=()=>{const c=ref.current,ctx=c?.getContext('2d');if(!c||!ctx)return;const begin=performance.now(),p=latest.current;ctx.setTransform(c.width/p.sim.environment.width,0,0,c.height/p.sim.environment.height,0,0);drawFlyArena(ctx,p.sim,p.showPath,p.comparisons);const stat=stats.current;if(!stat.start){stat.start=begin;stat.ticks=p.sim.ticks;}stat.count++;stat.ms+=performance.now()-begin;if(begin-stat.start>=1000){p.onPerformance({fps:1000*stat.count/(begin-stat.start),paintMs:stat.ms/stat.count,physicsStepsPerSecond:Math.max(0,1000*(p.sim.ticks-stat.ticks)/(begin-stat.start))});stats.current={start:begin,count:0,ms:0,ticks:p.sim.ticks};}};
  useEffect(()=>{paint();});
  useEffect(()=>{const c=ref.current!;const resize=()=>{const bounds=c.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);c.width=Math.round(bounds.width*ratio);c.height=Math.round(bounds.height*ratio);paint();};const observer=new ResizeObserver(resize);observer.observe(c);resize();return()=>observer.disconnect();},[]);
  return <canvas ref={ref} style={{aspectRatio:'720 / 480'}} role="img" aria-label="Virtual fly in experimental arena. Three rays represent engineering tactile proximity channels." onClick={onSelect}/>;
}
