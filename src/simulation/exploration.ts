import type { Environment, Vec2 } from '../domain/types';
import { canTravel, isPositionValid } from './collision';
import { rayDistance } from './sensors';
export const EXPLORATION_RADIUS = 75;
export function cellCenter(env: Environment, index: number): Vec2 {
  const grid = env.exploration;
  return { x: (index % grid.columns + .5) * grid.cellSize, y: (Math.floor(index / grid.columns) + .5) * grid.cellSize };
}
/** Flood fill is only a coverage denominator; it is never used by the controller. */
export function accessibleCells(env: Environment, radius: number): boolean[] {
  const { columns, rows } = env.exploration;
  const free = Array.from({ length: columns * rows }, (_, i) => isPositionValid(env, cellCenter(env, i), radius));
  const reachable = free.map(() => false);
  const start = free.findIndex((valid, i) => valid && Math.hypot(cellCenter(env, i).x - env.entry.x, cellCenter(env, i).y - env.entry.y) <= env.exploration.cellSize && canTravel(env, env.entry, cellCenter(env, i), radius));
  if (start < 0) return reachable;
  const queue = [start]; reachable[start] = true;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], x = index % columns, y = Math.floor(index / columns);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const next = ny * columns + nx;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || !free[next] || reachable[next]) continue;
      if (canTravel(env, cellCenter(env, index), cellCenter(env, next), radius)) { reachable[next] = true; queue.push(next); }
    }
  }
  return reachable;
}
export function revealExploration(env: Environment, position: Vec2): void {
  env.exploration.explored.forEach((known, index) => {
    if (known) return;
    const center = cellCenter(env, index), distance = Math.hypot(center.x - position.x, center.y - position.y);
    if (distance > EXPLORATION_RADIUS) return;
    const hit = rayDistance(env, position, Math.atan2(center.y - position.y, center.x - position.x), distance);
    // Reveal the first obstacle cell itself, but never reveal a free cell behind it.
    const solid = !isPositionValid(env, center, 0);
    if (hit >= distance - (solid ? env.exploration.cellSize / 2 : .001)) env.exploration.explored[index] = true;
  });
}
export function isExplored(env: Environment, position: Vec2): boolean {
  const grid = env.exploration;
  return grid.explored[Math.floor(position.y / grid.cellSize) * grid.columns + Math.floor(position.x / grid.cellSize)] ?? false;
}
export function coverage(env: Environment, accessible: boolean[]): number {
  const total = accessible.filter(Boolean).length;
  return total ? accessible.filter((value, i) => value && env.exploration.explored[i]).length / total * 100 : 0;
}
