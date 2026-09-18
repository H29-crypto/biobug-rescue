import type { Sensors } from '../domain/types';
import { SENSOR_RANGE } from './sensors';
export interface Stimulus { left: number; front: number; right: number }
/** ENGINEERING SENSOR MAPPING: smoothstep of bounded proximity; raw distances stay intact. */
export function proximity(distance: number): number {
  if (!Number.isFinite(distance)) throw new Error('Invalid obstacle distance');
  const x = Math.max(0, Math.min(1, 1 - distance / SENSOR_RANGE));
  return x*x*(3 - 2*x);
}
export function mapSensors(sensors: Sensors): Stimulus {
  return { left: proximity(sensors.leftDistance), front: proximity(sensors.frontDistance), right: proximity(sensors.rightDistance) };
}
