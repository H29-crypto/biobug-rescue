import type { BioBug, Environment } from '../domain/types';
import { createEarthquakeEnvironment } from '../scenarios/earthquake';
import { accessibleCells, coverage, revealExploration } from './exploration';
import { chooseTurn, control, createControllerMemory } from './controller';
import type { ControllerMemory } from './controller';
import { move } from './movement';
import { sense } from './sensors';
export interface Simulation { environment: Environment; bug: BioBug; memory: ControllerMemory; accessible: boolean[]; elapsed: number; running: boolean; accumulator: number }
export const FIXED_STEP = 1 / 60;
export function createSimulation(): Simulation {
  const environment = createEarthquakeEnvironment();
  const bug: BioBug = { id: 'BioBug #1', position: { ...environment.entry }, heading: Math.PI * 1.5, radius: 7, speed: 42, state: 'stopped',
    sensors: { obstacleLeft: 0, obstacleFront: 0, obstacleRight: 0, frontDistance: 0, leftDistance: 0, rightDistance: 0, hazard: 0, survivorCue: 0, unexploredDirection: 0 } };
  sense(environment, bug); revealExploration(environment, bug.position);
  return { environment, bug, memory: createControllerMemory(), accessible: accessibleCells(environment, bug.radius), elapsed: 0, running: false, accumulator: 0 };
}
export function setRunning(sim: Simulation, running: boolean): void {
  sim.running = running; sim.accumulator = 0;
  sim.bug.state = running ? (sim.memory.turnRemaining > 0 ? 'blocked' : 'exploring') : 'stopped';
}
export function advance(sim: Simulation, delta: number): void {
  if (!sim.running || !Number.isFinite(delta) || delta <= 0) return;
  // Drop excess time after background-tab suspension; never teleport on resume.
  sim.accumulator += Math.min(delta, .1);
  while (sim.accumulator + 1e-10 >= FIXED_STEP) {
    sense(sim.environment, sim.bug);
    const command = control(sim.bug, sim.memory, FIXED_STEP);
    if (!move(sim.environment, sim.bug, command, FIXED_STEP)) chooseTurn(sim.bug, sim.memory);
    sense(sim.environment, sim.bug);
    revealExploration(sim.environment, sim.bug.position);
    sim.elapsed += FIXED_STEP; sim.accumulator = Math.max(0, sim.accumulator - FIXED_STEP);
  }
}
export function snapshot(sim: Simulation) {
  return { environment: { ...sim.environment, exploration: { ...sim.environment.exploration, explored: [...sim.environment.exploration.explored] } },
    bug: { ...sim.bug, position: { ...sim.bug.position }, sensors: { ...sim.bug.sensors } }, running: sim.running, elapsed: sim.elapsed, explored: coverage(sim.environment, sim.accessible) };
}
