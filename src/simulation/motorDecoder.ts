import type { Sensors } from '../domain/types';
import type { MotorCommand } from './controller';
import type { Stimulus } from './sensorMapping';
export type Action = 'FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'STOP';
export interface DecoderMemory { turn: -1 | 0 | 1; hold: number; randomState: number }
export interface Decision { action: Action; delta: number; fallback: boolean; reason: string; command: MotorCommand }
export const DEADBAND = .035;
export const createDecoder = (seed = 2026): DecoderMemory => ({ turn: 0, hold: 0, randomState: seed >>> 0 });
/** ENGINEERING MOTOR DECODER. Positive screen angular velocity turns RIGHT.
 * A positive L-R response steers away from the left obstacle, not a biological turn claim.
 */
export function decodeMotor(left: number, right: number, input: Stimulus, sensors: Sensors, speed: number, memory: DecoderMemory): Decision {
  if (![left, right].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Invalid DNa02 readout');
  const delta = left - right;
  let turn: -1 | 0 | 1 = 0, fallback = false;
  let reason = 'DNa02 difference is inside the deadband; continue forward.';
  if (memory.hold > 0) {
    turn = memory.turn; memory.hold--;
    reason = 'Engineering turn commitment prevents rapid direction reversal.';
  } else if (Math.abs(delta) > DEADBAND) {
    turn = delta > 0 ? 1 : -1;
    reason = `DNa02-${delta > 0 ? 'L' : 'R'} peak is stronger; engineering decoder steers ${turn > 0 ? 'right' : 'left'}, away from that obstacle signal.`;
  } else if (input.front >= .5) {
    fallback = true;
    const space = sensors.leftDistance - sensors.rightDistance;
    if (Math.abs(space) < 3) {
      memory.randomState = (Math.imul(1664525, memory.randomState) + 1013904223) >>> 0;
      turn = memory.randomState / 4294967296 < .5 ? -1 : 1;
      reason = 'Approximately symmetric DNa02 activity and free space; engineering decoder uses a seeded tie-break.';
    } else {
      turn = space > 0 ? -1 : 1;
      reason = 'Approximately symmetric DNa02 activity at a frontal obstacle; engineering decoder selects the clearer side.';
    }
  }
  if (turn && memory.hold === 0 && turn !== memory.turn) memory.hold = 2;
  memory.turn = turn;
  return { action: turn === 0 ? 'FORWARD' : turn > 0 ? 'TURN_RIGHT' : 'TURN_LEFT', delta, fallback, reason,
    command: { forward: turn ? (input.front >= .5 ? 0 : speed * .45) : speed, angular: turn * 1.9 } };
}
