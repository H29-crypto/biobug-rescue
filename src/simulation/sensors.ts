import type { BioBug, Environment, Vec2 } from '../domain/types';
export const SENSOR_RANGE = 85;
export const SENSOR_ANGLES = { front: 0, left: -Math.PI / 3, right: Math.PI / 3 };

/** Exact ray/axis-aligned rectangle intersections, measured from the sensor origin. */
export function rayDistance(env: Environment, origin: Vec2, angle: number, range: number): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let nearest = range;
  if (dx > 1e-9) nearest = Math.min(nearest, (env.width - origin.x) / dx);
  if (dx < -1e-9) nearest = Math.min(nearest, -origin.x / dx);
  if (dy > 1e-9) nearest = Math.min(nearest, (env.height - origin.y) / dy);
  if (dy < -1e-9) nearest = Math.min(nearest, -origin.y / dy);
  for (const rect of env.obstacles) {
    let near = 0, far = nearest;
    for (const [value, direction, min, max] of [[origin.x, dx, rect.x, rect.x + rect.width], [origin.y, dy, rect.y, rect.y + rect.height]]) {
      if (Math.abs(direction) < 1e-9) { if (value < min || value > max) far = -1; }
      else {
        const a = (min - value) / direction, b = (max - value) / direction;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far && far >= 0) nearest = Math.min(nearest, near);
  }
  return Math.max(0, nearest);
}

export function sense(env: Environment, bug: BioBug): void {
  const distance = (offset: number) => Math.max(0, rayDistance(env, bug.position, bug.heading + offset, SENSOR_RANGE + bug.radius) - bug.radius);
  const front = distance(SENSOR_ANGLES.front), left = distance(SENSOR_ANGLES.left), right = distance(SENSOR_ANGLES.right);
  bug.sensors = { ...bug.sensors, frontDistance: front, leftDistance: left, rightDistance: right,
    obstacleFront: 1 - front / SENSOR_RANGE, obstacleLeft: 1 - left / SENSOR_RANGE, obstacleRight: 1 - right / SENSOR_RANGE };
}
