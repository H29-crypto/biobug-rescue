import type { BioBug } from '../domain/types';
import { SENSOR_ANGLES } from '../simulation/sensors';
export function drawBioBug(ctx: CanvasRenderingContext2D, bug: BioBug, debug: boolean, color='#58dfba', selected=false): void {
  ctx.save(); ctx.translate(bug.position.x, bug.position.y);
  if(selected){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();}
  if (debug) {
    for (const [angle, distance] of [[SENSOR_ANGLES.front, bug.sensors.frontDistance], [SENSOR_ANGLES.left, bug.sensors.leftDistance], [SENSOR_ANGLES.right, bug.sensors.rightDistance]]) {
      ctx.strokeStyle = '#8acee899'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(Math.cos(bug.heading + angle) * bug.radius, Math.sin(bug.heading + angle) * bug.radius);
      ctx.lineTo(Math.cos(bug.heading + angle) * (distance + bug.radius), Math.sin(bug.heading + angle) * (distance + bug.radius)); ctx.stroke();
    }
  }
  ctx.save(); ctx.rotate(bug.heading);
  ctx.strokeStyle = '#b8f7e3'; ctx.lineWidth = 1.5;
  for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x - 3, -11); ctx.lineTo(x, 0); ctx.lineTo(x - 3, 11); ctx.stroke(); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff4cc'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#081418dd'; ctx.fillRect(-39, 17, 78, 17); ctx.fillStyle = '#a7ffe1'; ctx.fillText(bug.id, 0, 26); ctx.restore();
}
