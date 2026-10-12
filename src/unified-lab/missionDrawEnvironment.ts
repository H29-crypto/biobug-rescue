import type { Environment } from '../domain/types';
import type { MapTheme } from '../rendering/missionPalette';
// Palette inlined (mirrors missionPalette.ts / tokens.css) so this file stays dependency-free:
// tests/rescue.cjs transpiles and evaluates it in isolation.
const MX = { floor: '#16202a', grid: '#1c2733', explored: '#1a2c36', wall: '#4a5a6c', wallEdge: '#62758a', debris: '#2b2721',
  blocked: '#f5b83d', fog: 'rgba(8, 11, 15, 0.82)', muted: '#9aa7b4', faint: '#6b7888', explore: '#22d3ee' } as const;
const MX_FONT_UI = '"Inter", "Segoe UI", system-ui, sans-serif', MX_FONT_MONO = '"JetBrains Mono", Consolas, "Liberation Mono", monospace';

export function drawEnvironment(ctx: CanvasRenderingContext2D, env: Environment, reveal: boolean, theme: MapTheme = 'light') {
  if (theme === 'mission') { drawMissionEnvironment(ctx, env, reveal); return; }
  const { width, height, exploration } = env;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#152328'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#203138'; ctx.lineWidth = 0.6;
  for (let x = 0; x <= width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  for (const obstacle of env.obstacles) {
    const { x, y, width: w, height: h, kind } = obstacle;
    if((obstacle.baseAltitude??0)>0){ctx.save();ctx.fillStyle='#59677a55';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#97a6b7';ctx.setLineDash([5,5]);ctx.strokeRect(x,y,w,h);ctx.restore();continue;}
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
  ctx.strokeStyle = '#79c8e8'; ctx.lineWidth = 2; ctx.strokeRect(env.entry.x - 12, env.entry.y - 12, 24, 24);
  ctx.fillStyle = '#96d9f1'; ctx.font = '10px monospace'; ctx.fillText('ENTRY', env.entry.x, env.entry.y + 29);
  if (!reveal && !visible(588, 220)) { ctx.fillStyle = '#596875'; ctx.font = '12px monospace'; ctx.fillText('UNEXPLORED', 588, 220); }
}

/**
 * Dark mission theme. Terrain only: like the light renderer it never draws
 * targets or hazards (those come from operator estimates in EnvironmentCanvas).
 * Layers: floor + grid, explored cells (cyan tint), obstacles, fog over unknown
 * cells (floor plan stays faintly visible), cyan frontier edge, entry.
 */
function drawMissionEnvironment(ctx: CanvasRenderingContext2D, env: Environment, reveal: boolean) {
  const { width, height, exploration } = env, { columns, rows, cellSize, explored } = exploration;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = MX.floor; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = MX.grid; ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  const known = (c: number, r: number) => c >= 0 && r >= 0 && c < columns && r < rows && explored[r * columns + c];
  ctx.fillStyle = MX.explored;
  explored.forEach((k, i) => { if (k) ctx.fillRect(i % columns * cellSize, Math.floor(i / columns) * cellSize, cellSize, cellSize); });
  for (const obstacle of env.obstacles) {
    const { x, y, width: w, height: h, kind } = obstacle;
    if ((obstacle.baseAltitude ?? 0) > 0) { ctx.save(); ctx.fillStyle = '#2b3a4a66'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = MX.wallEdge; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); ctx.restore(); continue; }
    if (kind === 'wall') {
      ctx.fillStyle = MX.wall; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = MX.wallEdge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else {
      // Debris / blocked passage: dark fill with restrained amber hatching.
      ctx.save(); ctx.fillStyle = MX.debris; ctx.fillRect(x, y, w, h);
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = MX.blocked; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
      for (let d = -h; d < w; d += 7) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = MX.blocked; ctx.globalAlpha = 0.75; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
    }
  }
  if (!reveal) {
    ctx.fillStyle = MX.fog;
    explored.forEach((k, i) => { if (!k) ctx.fillRect(i % columns * cellSize, Math.floor(i / columns) * cellSize, cellSize, cellSize); });
    // Frontier: cyan edge where explored cells meet fog.
    ctx.save(); ctx.strokeStyle = MX.explore; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath();
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      const a = known(c, r), x = c * cellSize, y = r * cellSize;
      if (c + 1 < columns && a !== known(c + 1, r)) { ctx.moveTo(x + cellSize, y); ctx.lineTo(x + cellSize, y + cellSize); }
      if (r + 1 < rows && a !== known(c, r + 1)) { ctx.moveTo(x, y + cellSize); ctx.lineTo(x + cellSize, y + cellSize); }
    }
    ctx.stroke(); ctx.restore();
  }
  const visible = (x: number, y: number) => reveal || explored[Math.floor(y / cellSize) * columns + Math.floor(x / cellSize)];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.strokeStyle = MX.explore; ctx.lineWidth = 2; ctx.strokeRect(env.entry.x - 12, env.entry.y - 12, 24, 24);
  ctx.fillStyle = MX.explore; ctx.globalAlpha = 0.18; ctx.fillRect(env.entry.x - 12, env.entry.y - 12, 24, 24); ctx.restore();
  ctx.fillStyle = MX.muted; ctx.font = `600 10px ${MX_FONT_MONO}`; ctx.fillText('ENTRY', env.entry.x, env.entry.y + 29);
  if (!reveal && !visible(588, 220)) { ctx.fillStyle = MX.faint; ctx.font = `500 12px ${MX_FONT_UI}`; ctx.fillText('Unexplored', 588, 220); }
}

