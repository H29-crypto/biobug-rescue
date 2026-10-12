import type { Environment, Vec2 } from '../domain/types';
import { canTravel, isPositionValid } from './collision';
import { cellCenter, EXPLORATION_RADIUS } from './exploration';
import { neighbors } from './frontiers';
import type { Assignment } from './frontiers';

/** The policy cannot inspect targets or unrevealed geometry. Collision queries in
 * the adapter below establish traversability of observed cells/edges only. */
export interface ObservedMap {
  columns: number;
  rows: number;
  cellSize: number;
  known: boolean[];
  free: boolean[];
  links: number[][];
  starts: (number | null)[];
}
export interface InformationAssignment extends Assignment {
  expectedCells: number;
  marginalCells: number;
  travelCost: number;
  utility: number;
}
const center = (map: ObservedMap, index: number): Vec2 => ({
  x: (index % map.columns + .5) * map.cellSize,
  y: (Math.floor(index / map.columns) + .5) * map.cellSize,
});

export function observeNavigationMap(env: Environment, positions: Vec2[], radius: number): ObservedMap {
  const { columns, rows, cellSize, explored } = env.exploration;
  const known = [...explored];
  const free = known.map((seen, i) => seen && isPositionValid(env, cellCenter(env, i), radius + 1));
  const links = free.map((valid, i) => valid ? neighbors(env, i).filter(j =>
    free[j] && canTravel(env, cellCenter(env, i), cellCenter(env, j), radius + 1)) : []);
  const starts = positions.map(position => free.map((valid, i) => ({ i,
    distance: valid ? Math.hypot(center({ columns, cellSize } as ObservedMap, i).x - position.x,
      center({ columns, cellSize } as ObservedMap, i).y - position.y) : Infinity,
  })).filter(v => v.distance <= 40).sort((a, b) => a.distance - b.distance || a.i - b.i)
    .find(v => canTravel(env, position, cellCenter(env, v.i), radius))?.i ?? null);
  return { columns, rows, cellSize, known, free, links, starts };
}

function adjacent(map: ObservedMap, index: number): number[] {
  const x = index % map.columns, y = Math.floor(index / map.columns);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < map.columns && b < map.rows)
    .map(([a, b]) => b * map.columns + a);
}

/** Optimistic information proxy, not Bayesian entropy or calibrated visibility.
 * Unknown cells within sensing range count once. A known occupied cell blocks
 * the ray; unknown cells do not. This function never asks the world for a ray. */
export function informationFootprint(map: ObservedMap, target: number): number[] {
  const origin = center(map, target), cells: number[] = [];
  const reach = Math.ceil(EXPLORATION_RADIUS / map.cellSize);
  const tx = target % map.columns, ty = Math.floor(target / map.columns);
  for (let y = Math.max(0, ty - reach); y <= Math.min(map.rows - 1, ty + reach); y++) {
    for (let x = Math.max(0, tx - reach); x <= Math.min(map.columns - 1, tx + reach); x++) {
      const index = y * map.columns + x;
      if (map.known[index]) continue;
      const point = center(map, index), distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      if (distance > EXPLORATION_RADIUS) continue;
      const steps = Math.ceil(distance / (map.cellSize / 3));
      let blocked = false;
      for (let step = 1; step < steps; step++) {
        const sx = Math.floor((origin.x + (point.x - origin.x) * step / steps) / map.cellSize);
        const sy = Math.floor((origin.y + (point.y - origin.y) * step / steps) / map.cellSize);
        const sample = sy * map.columns + sx;
        if (map.known[sample] && !map.free[sample]) { blocked = true; break; }
      }
      if (!blocked) cells.push(index);
    }
  }
  return cells;
}

/** Deterministic sequential allocation inspired by information-aware exploration.
 * This is our own heuristic, not a reproduction of coExplore's Hungarian solver.
 * Rotating priority + marginal gain reduce duplicate sensing commitments. */
export function planInformationFrontiers(map: ObservedMap, priority = 0): (InformationAssignment | null)[] {
  const frontiers = map.free.map((free, i) => free && adjacent(map, i).some(j => !map.known[j]));
  const footprints = new Map<number, number[]>();
  frontiers.forEach((frontier, i) => { if (frontier) footprints.set(i, informationFootprint(map, i)); });
  const assignments: (InformationAssignment | null)[] = map.starts.map(() => null);
  const reserved = new Set<number>(), promised = new Set<number>();
  for (let offset = 0; offset < map.starts.length; offset++) {
    const agent = ((priority + offset) % map.starts.length + map.starts.length) % map.starts.length;
    const start = map.starts[agent];
    if (start === null) continue;
    const parent = new Int32Array(map.known.length).fill(-1);
    const depth = new Int32Array(map.known.length).fill(-1);
    const queue = [start]; depth[start] = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const next of map.links[queue[cursor]]) {
        if (depth[next] !== -1) continue;
        depth[next] = depth[queue[cursor]] + 1; parent[next] = queue[cursor]; queue.push(next);
      }
    }
    const candidates = queue.filter(i => frontiers[i] && !reserved.has(i)).map(target => {
      const footprint = footprints.get(target)!;
      const marginalCells = footprint.filter(i => !promised.has(i)).length;
      const travelCost = depth[target] * map.cellSize;
      return { target, expectedCells: footprint.length, marginalCells, travelCost,
        utility: marginalCells / (1 + travelCost / EXPLORATION_RADIUS) };
    });
    candidates.sort((a, b) => b.utility - a.utility || a.travelCost - b.travelCost || a.target - b.target);
    const best = candidates[0];
    if (!best) continue;
    const indices = [best.target];
    while (indices[indices.length - 1] !== start) indices.push(parent[indices[indices.length - 1]]);
    assignments[agent] = { ...best, path: indices.reverse().map(i => center(map, i)) };
    reserved.add(best.target);
    footprints.get(best.target)!.forEach(i => promised.add(i));
  }
  return assignments;
}

export function assignInformationFrontiers(env: Environment, positions: Vec2[], radius: number, priority = 0) {
  return planInformationFrontiers(observeNavigationMap(env, positions, radius), priority);
}
