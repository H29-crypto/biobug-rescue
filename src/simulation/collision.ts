import type { Environment, Vec2 } from '../domain/types';

export function isPositionValid(env: Environment, p: Vec2, radius: number): boolean {
  if (p.x < radius || p.y < radius || p.x > env.width - radius || p.y > env.height - radius) return false;
  return env.obstacles.every(o => {
    const x = Math.max(o.x, Math.min(p.x, o.x + o.width));
    const y = Math.max(o.y, Math.min(p.y, o.y + o.height));
    return Math.hypot(p.x - x, p.y - y) > radius;
  });
}

/** Subdivide translations to prevent crossing thin walls, even for a large input delta. */
export function canTravel(env: Environment, from: Vec2, to: Vec2, radius: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, radius / 2)));
  for (let i = 1; i <= steps; i++) {
    if (!isPositionValid(env, { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, radius)) return false;
  }
  return true;
}
