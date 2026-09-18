import type { BioBug, Environment } from '../domain/types';
import { createEarthquakeEnvironment } from '../scenarios/earthquake';
import { accessibleCells, coverage, revealExploration } from './exploration';
import { chooseTurn, control, createControllerMemory } from './controller';
import type { ControllerMemory } from './controller';
import { move } from './movement';
import { sense } from './sensors';
import { createDecoder, decodeMotor } from './motorDecoder';
import type { DecoderMemory, Decision } from './motorDecoder';
import type { NeuralResponse } from './neuralClient';
import { createMetrics, summarizeMetrics } from './metrics';
import type { ControllerMetrics } from './metrics';
export type ControllerMode = 'rule-based' | 'malecns';
export const NEURAL_PERIOD = .2;
export interface Simulation {
  environment: Environment; bug: BioBug; memory: ControllerMemory; accessible: boolean[]; elapsed: number; running: boolean; accumulator: number;
  mode: ControllerMode; seed: number; generation: number; decoder: DecoderMemory; nextDecision: number;
  neural: { status: 'idle' | 'waiting' | 'ready' | 'offline'; error: string; response: NeuralResponse | null; decision: Decision | null; trace: string[] };
  metrics: Record<ControllerMode, ControllerMetrics>; controllerExplored: Record<ControllerMode, boolean[]>;
  lastTurn: number; stationaryTime: number; stationaryDistance: number;
}
export const FIXED_STEP = 1 / 60;
export function createSimulation(seed = 2026): Simulation {
  const environment = createEarthquakeEnvironment();
  const bug: BioBug = { id: 'BioBug #1', position: { ...environment.entry }, heading: Math.PI * 1.5, radius: 7, speed: 42, state: 'stopped',
    sensors: { obstacleLeft: 0, obstacleFront: 0, obstacleRight: 0, frontDistance: 0, leftDistance: 0, rightDistance: 0, hazard: 0, survivorCue: 0, unexploredDirection: 0 } };
  sense(environment, bug); revealExploration(environment, bug.position);
  const memory = createControllerMemory(); memory.randomState = seed >>> 0;
  const accessible = accessibleCells(environment, bug.radius), initial = coverage(environment, accessible);
  return { environment, bug, memory, accessible, elapsed: 0, running: false, accumulator: 0,
    seed, mode: 'rule-based', generation: 0, decoder: createDecoder(seed), nextDecision: 0,
    neural: { status: 'idle', error: '', response: null, decision: null, trace: [] },
    metrics: { 'rule-based': { ...createMetrics(), coverage: initial }, malecns: { ...createMetrics(), coverage: initial } },
    controllerExplored: { 'rule-based': [...environment.exploration.explored], malecns: [...environment.exploration.explored] },
    lastTurn: 0, stationaryTime: 0, stationaryDistance: 0 };
}
export function switchController(sim: Simulation, mode: ControllerMode): void {
  if (sim.mode === mode) return;
  sim.mode = mode; sim.generation++; sim.accumulator = 0;
  sim.memory = createControllerMemory(); sim.memory.randomState = sim.seed >>> 0;
  sim.decoder = createDecoder(sim.seed); sim.nextDecision = sim.elapsed;
  sim.neural = { status: 'idle', error: '', response: null, decision: null, trace: [] };
  sim.lastTurn = 0; sim.stationaryTime = 0; sim.stationaryDistance = 0;
}
export function neuralDue(sim: Simulation): boolean {
  return sim.running && sim.mode === 'malecns' && sim.elapsed + 1e-9 >= sim.nextDecision;
}
export function acceptNeural(sim: Simulation, response: NeuralResponse, latency: number): void {
  const decision = decodeMotor(response.dna02.L.peak, response.dna02.R.peak, response.stimulus, sim.bug.sensors, sim.bug.speed, sim.decoder);
  sim.neural = { status: 'ready', error: '', response, decision, trace: [
    `Engineering sensor mapping: left ${response.stimulus.left.toFixed(3)}, front ${response.stimulus.front.toFixed(3)}, right ${response.stimulus.right.toFixed(3)}.`,
    'Stimulus propagated through the real ProLN–DNa02 structural subgraph using simulated dynamics.',
    `DNa02 peak L ${response.dna02.L.peak.toFixed(6)}; R ${response.dna02.R.peak.toFixed(6)}.`, decision.reason] };
  sim.nextDecision = sim.elapsed + NEURAL_PERIOD;
  const m = sim.metrics.malecns; m.neuralDecisions++; m.fallbacks += Number(decision.fallback);
  m.asymmetrySum += Math.abs(decision.delta); m.latencies.push(latency);
}
export function failNeural(sim: Simulation, error: string): void {
  setRunning(sim, false); sim.metrics.malecns.backendFailures++;
  sim.neural.status = 'offline'; sim.neural.error = error; sim.neural.decision = null; sim.neural.response = null;
  sim.neural.trace = ['CONNECTOME OFFLINE — mission paused. Retry Start or select Rule-Based.'];
}
export function setRunning(sim: Simulation, running: boolean): void {
  sim.running = running; sim.accumulator = 0;
  sim.generation++;
  if (sim.mode === 'malecns') { sim.nextDecision = sim.elapsed; sim.neural.decision = null;
    if (sim.neural.status !== 'offline' || running) sim.neural.status = 'idle'; }
  sim.bug.state = running ? (sim.memory.turnRemaining > 0 ? 'blocked' : 'exploring') : 'stopped';
}
export function advance(sim: Simulation, delta: number): void {
  if (!sim.running || !Number.isFinite(delta) || delta <= 0) return;
  // Drop excess time after background-tab suspension; never teleport on resume.
  sim.accumulator += Math.min(delta, .1);
  while (sim.accumulator + 1e-10 >= FIXED_STEP) {
    // Lockstep sensory decisions: no motion on stale/unavailable results, no latency-dependent trajectory.
    if (sim.mode === 'malecns' && (neuralDue(sim) || !sim.neural.decision)) { sim.accumulator = 0; break; }
    sense(sim.environment, sim.bug);
    const command = sim.mode === 'rule-based' ? control(sim.bug, sim.memory, FIXED_STEP) : sim.neural.decision!.command;
    if (sim.mode === 'malecns') sim.bug.state = command.forward ? 'exploring' : 'blocked';
    const before = { ...sim.bug.position }, m = sim.metrics[sim.mode];
    const turn = Math.abs(command.angular) > .8 ? Math.sign(command.angular) : 0;
    if (turn && turn !== sim.lastTurn) m.turns++;
    sim.lastTurn = turn;
    if (!move(sim.environment, sim.bug, command, FIXED_STEP)) {
      m.blocked++;
      if (sim.mode === 'rule-based') chooseTurn(sim.bug, sim.memory);
    }
    const distance = Math.hypot(sim.bug.position.x-before.x, sim.bug.position.y-before.y);
    m.distance += distance; m.elapsed += FIXED_STEP;
    sim.stationaryTime += FIXED_STEP; sim.stationaryDistance += distance;
    if (sim.stationaryTime + 1e-9 >= 10) {
      if (sim.stationaryDistance < sim.bug.radius) m.stuck++;
      sim.stationaryTime = 0; sim.stationaryDistance = 0;
    }
    sense(sim.environment, sim.bug);
    revealExploration(sim.environment, sim.bug.position);
    const attributed = { ...sim.environment, exploration: { ...sim.environment.exploration, explored: sim.controllerExplored[sim.mode] } };
    revealExploration(attributed, sim.bug.position);
    m.coverage = coverage(attributed, sim.accessible);
    sim.elapsed += FIXED_STEP; sim.accumulator = Math.max(0, sim.accumulator - FIXED_STEP);
  }
}
export function snapshot(sim: Simulation) {
  return { environment: { ...sim.environment, exploration: { ...sim.environment.exploration, explored: [...sim.environment.exploration.explored] } },
    bug: { ...sim.bug, position: { ...sim.bug.position }, sensors: { ...sim.bug.sensors } }, running: sim.running, elapsed: sim.elapsed, explored: coverage(sim.environment, sim.accessible),
    mode: sim.mode, neural: { ...sim.neural }, controllerMetrics: { 'rule-based': summarizeMetrics(sim.metrics['rule-based']), malecns: summarizeMetrics(sim.metrics.malecns) } };
}
