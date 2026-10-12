import type { Environment, Obstacle, Vec2 } from '../domain/types';
import { accessibleCells, cellCenter } from '../simulation/exploration';
import { createEarthquakeEnvironment } from './earthquake';

export const SCENARIOS = [
  { id: 'residential', name: 'Residential collapse', description: 'Rooms, rubble and offset doorways.' },
  { id: 'warehouse', name: 'Warehouse rubble', description: 'Open space interrupted by scattered debris.' },
  { id: 'corridors', name: 'Narrow passages', description: 'Alternating doorways and long detours.' },
] as const;
export type ScenarioId = typeof SCENARIOS[number]['id'];
export const SCENARIO_VERSION = 'research-maps-v1';

/** Mulberry32, isolated from controller randomness. */
export function randomSequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const wall = (id: string, x: number, y: number, width: number, height: number): Obstacle =>
  ({ id, x, y, width, height, kind: 'wall' });
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Seed changes rubble and hidden target placement, not just controller tie-breaks.
 * Offline reachability is used for scenario construction and scoring only. */
export function createResearchEnvironment(id: ScenarioId, seed: number): Environment {
  const scenario = SCENARIOS.find(s => s.id === id);
  if (!scenario) throw new Error('Unknown research scenario');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  const rng = randomSequence(seed ^ 0xB10B0626);
  const env = createEarthquakeEnvironment();
  env.id = `${SCENARIO_VERSION}:${id}:${seed}`; env.name = scenario.name;
  // Seal the benchmark perimeter: outside space does not inflate coverage.
  const boundary = [wall('north', 40, 40, 720, 16), wall('south', 40, 504, 720, 16),
    wall('west', 40, 40, 16, 480), wall('east', 744, 40, 16, 480)];
  if (id === 'residential') {
    env.obstacles = [...boundary, ...env.obstacles.filter(o => !['north', 'south', 'west', 'east', 'south-entry'].includes(o.id))
      .map(o => o.kind === 'debris' ? { ...o, x: o.x + Math.floor(rng() * 17) - 8, y: o.y + Math.floor(rng() * 17) - 8 } : o)];
  } else if (id === 'warehouse') {
    env.obstacles = [...boundary];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      env.obstacles.push({ id: `rubble-${row}-${col}`, kind: 'debris',
        x: 145 + col * 110 + Math.floor(rng() * 25), y: 110 + row * 115 + Math.floor(rng() * 30),
        width: 28 + Math.floor(rng() * 28), height: 25 + Math.floor(rng() * 28) });
    }
  } else {
    env.obstacles = [...boundary];
    for (let i = 0; i < 3; i++) {
      const gap = (i % 2 ? 365 : 125) + Math.floor(rng() * 31);
      env.obstacles.push(wall(`partition-${i}-top`, 220 + i * 180, 56, 16, gap - 56),
        wall(`partition-${i}-bottom`, 220 + i * 180, gap + 80, 16, 504 - gap - 80));
    }
  }
  const accessible = accessibleCells(env, 8);
  const candidates = accessible.flatMap((valid, i) => valid ? [cellCenter(env, i)] : [])
    .filter(p => distance(p, env.entry) > 180);
  // Fisher-Yates avoids engine-dependent random comparator sorting.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const targets: Vec2[] = [];
  for (const point of candidates) {
    if (targets.every(target => distance(target, point) >= 110)) targets.push(point);
    if (targets.length === 4) break;
  }
  if (targets.length !== 4) throw new Error('Scenario has insufficient reachable target positions');
  env.survivors = targets.slice(0, 2).map((position, i) => ({ id: `S-0${i + 1}`, position, status: 'undetected' }));
  env.hazards = targets.slice(2).map((position, i) => ({ id: `H-0${i + 1}`, position, radius: 35, kind: 'gas', severity: .8, discovered: false }));
  return env;
}
