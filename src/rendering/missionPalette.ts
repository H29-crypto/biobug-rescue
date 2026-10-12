/** Canvas palette for the dark mission theme. Mirrors src/mission/tokens.css (--mx-*). */
export const MX = {
  bg: '#0e141b', floor: '#16202a', grid: '#1c2733', explored: '#1a2c36',
  wall: '#4a5a6c', wallEdge: '#62758a', debris: '#2b2721', blocked: '#f5b83d',
  fog: 'rgba(8, 11, 15, 0.82)', text: '#e6edf3', muted: '#9aa7b4', faint: '#6b7888',
  explore: '#22d3ee', uncertain: '#f5b83d', hazard: '#f05252', confirmed: '#34d399',
  pill: 'rgba(11, 15, 20, 0.9)',
} as const;
export const MX_FONT_UI = '"Inter", "Segoe UI", system-ui, sans-serif';
export const MX_FONT_MONO = '"JetBrains Mono", Consolas, "Liberation Mono", monospace';
export type MapTheme = 'light' | 'mission';
/** Rounded label pill used for agent IDs and marker labels. */
export function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, font = `600 10px ${MX_FONT_MONO}`) {
  ctx.save(); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12, h = 16;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x - w / 2, y - h / 2, w, h, 4); else ctx.rect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = MX.pill; ctx.fill(); ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = color; ctx.fillText(text, x, y + 0.5); ctx.restore();
}

