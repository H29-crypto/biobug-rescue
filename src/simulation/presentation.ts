import { createSwarm } from './swarm';
import type { RescueEvent } from './rescue';
import type { ControllerMode } from './engine';

export const DEMO = Object.freeze({ seed: 2026, count: 4, coordinated: true });
export const createDemo = () => createSwarm(DEMO.count, DEMO.seed, DEMO.coordinated);
export type Readiness = 'loading' | 'ready' | 'unavailable';
export function canSelectController(mode: ControllerMode, running: boolean, readiness: Readiness) {
  return !running && (mode === 'rule-based' || readiness === 'ready');
}
export function discoveryNotices(events: RescueEvent[]) {
  let confirmed = 0;
  return events.filter(e => ['GAS HAZARD DETECTED', 'POSSIBLE LIFE SIGNAL', 'SURVIVOR LOCATED'].includes(e.type))
    .map(e => ({ time: e.timestamp, sector: e.sector, kind: e.type === 'GAS HAZARD DETECTED' ? 'gas' : 'life',
      title: e.type === 'SURVIVOR LOCATED' ? (++confirmed === 2 ? 'SECOND SURVIVOR CONFIRMED' : 'SURVIVOR CONFIRMED') : e.type })).slice(-3).reverse();
}
export interface DatasetStatus { dataset: string; version: string; neurons: number; edges: number; synaptic_contacts: number; loaded: true }
export function parseReadiness(value: unknown): DatasetStatus | null {
  const s = value as DatasetStatus;
  return s?.loaded === true && s.dataset === 'MaleCNS' && typeof s.version === 'string' &&
    [s.neurons, s.edges, s.synaptic_contacts].every(n => Number.isSafeInteger(n) && n > 0) ? s : null;
}
