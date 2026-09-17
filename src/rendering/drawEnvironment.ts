import type { Environment } from '../domain/types';

export function drawEnvironment(ctx: CanvasRenderingContext2D, env: Environment, reveal: boolean) {
  const { width, height, exploration } = env;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#152328'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#203138'; ctx.lineWidth = 0.6;
  for (let x = 0; x <= width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  for (const obstacle of env.obstacles) {
    const { x, y, width: w, height: h, kind } = obstacle;
    ctx.fillStyle = kind === 'wall' ? '#6c7e82' : '#82735a';
    ctx.strokeStyle = kind === 'wall' ? '#97a6a7' : '#b6a17c';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (kind === 'debris') {
      ctx.beginPath(); ctx.moveTo(x, y + h * .65); ctx.lineTo(x + w * .4, y + h * .3); ctx.lineTo(x + w, y + h * .6); ctx.stroke();
    }
  }
  if (!reveal) {
    ctx.fillStyle = '#0b131b';
    exploration.explored.forEach((known, i) => {
      if (!known) ctx.fillRect(i % exploration.columns * exploration.cellSize, Math.floor(i / exploration.columns) * exploration.cellSize, exploration.cellSize, exploration.cellSize);
    });
  }
  const visible = (x: number, y: number) => reveal || exploration.explored[Math.floor(y / exploration.cellSize) * exploration.columns + Math.floor(x / exploration.cellSize)];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const hazard of env.hazards) {
    const { x, y } = hazard.position;
    if (!visible(x, y)) continue;
    ctx.fillStyle = '#f1b95916'; ctx.strokeStyle = '#efb85c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, hazard.radius, 0, Math.PI * 2); ctx.fill(); ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#edb75e'; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y + 10); ctx.lineTo(x - 12, y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#162127'; ctx.font = 'bold 15px monospace'; ctx.fillText('!', x, y + 3);
    ctx.fillStyle = '#efc984'; ctx.font = '10px monospace'; ctx.fillText('H-01 / GAS', x, y + 48);
  }
  for (const survivor of env.survivors) {
    const { x, y } = survivor.position;
    if (!visible(x, y)) continue;
    ctx.strokeStyle = '#70e2bb'; ctx.fillStyle = '#70e2bb18'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#90f5cf'; ctx.fillRect(x - 2, y - 9, 4, 18); ctx.fillRect(x - 9, y - 2, 18, 4);
    ctx.font = '10px monospace'; ctx.fillText('S-01 / POSSIBLE', x, y + 35);
  }
  ctx.strokeStyle = '#79c8e8'; ctx.lineWidth = 2; ctx.strokeRect(env.entry.x - 12, env.entry.y - 12, 24, 24);
  ctx.fillStyle = '#96d9f1'; ctx.font = '10px monospace'; ctx.fillText('ENTRY', env.entry.x, env.entry.y + 29);
  if (!reveal && !visible(588, 220)) { ctx.fillStyle = '#596875'; ctx.font = '12px monospace'; ctx.fillText('UNEXPLORED', 588, 220); }
}


