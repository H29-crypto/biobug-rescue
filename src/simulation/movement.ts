import type { BioBug, Environment } from '../domain/types';
import { canTravel } from './collision';
import type { MotorCommand } from './controller';
export function move(env: Environment, bug: BioBug, command: MotorCommand, dt: number, permit?: (from: BioBug['position'], to: BioBug['position']) => boolean): boolean {
  bug.heading = ((bug.heading + command.angular * dt) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const next = { x: bug.position.x + Math.cos(bug.heading) * command.forward * dt, y: bug.position.y + Math.sin(bug.heading) * command.forward * dt };
  if (!canTravel(env, bug.position, next, bug.radius) || (permit && !permit(bug.position, next))) { bug.state = 'blocked'; return false; }
  bug.position = next;
  return true;
}
