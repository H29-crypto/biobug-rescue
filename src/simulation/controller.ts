import type { BioBug } from '../domain/types';
export interface ControllerMemory { turnRemaining: number; turnSign: number; randomState: number; wander: number; wanderRemaining: number }
export interface MotorCommand { forward: number; angular: number }
export const createControllerMemory = (): ControllerMemory => ({ turnRemaining: 0, turnSign: 1, randomState: 2026, wander: 0, wanderRemaining: 0 });
function random(memory: ControllerMemory): number {
  memory.randomState = (Math.imul(1664525, memory.randomState) + 1013904223) >>> 0;
  return memory.randomState / 4294967296;
}
export function chooseTurn(bug: BioBug, memory: ControllerMemory): void {
  const difference = bug.sensors.leftDistance - bug.sensors.rightDistance;
  memory.turnSign = Math.abs(difference) < 3 ? (random(memory) < .5 ? -1 : 1) : (difference > 0 ? -1 : 1);
  // Commit to a turn to avoid left/right oscillation near corners.
  memory.turnRemaining = .55 + random(memory) * .6;
}
export function control(bug: BioBug, memory: ControllerMemory, dt: number): MotorCommand {
  if (memory.turnRemaining <= 0 && bug.sensors.frontDistance < 22) chooseTurn(bug, memory);
  if (memory.turnRemaining > 0) {
    memory.turnRemaining = Math.max(0, memory.turnRemaining - dt);
    bug.state = 'blocked';
    return { forward: 0, angular: memory.turnSign * 1.9 };
  }
  memory.wanderRemaining -= dt;
  if (memory.wanderRemaining <= 0) {
    memory.wander = (random(memory) - .5) * .65;
    memory.wanderRemaining = 1 + random(memory) * 2;
  }
  bug.state = 'exploring';
  return { forward: bug.speed, angular: memory.wander };
}
