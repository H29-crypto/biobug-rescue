import type { Environment, Vec2 } from '../domain/types';
import { SCENARIO_VERSION, createResearchEnvironment, randomSequence } from '../scenarios/research';
import type { ScenarioId } from '../scenarios/research';
import { coverage } from './exploration';
import { FIXED_STEP } from './engine';
import { advanceSwarm, createSwarm, runSwarm, AGENT_COLORS } from './swarm';
import type { PlannerMode, SwarmSimulation } from './swarm';
import type { RescueDiscovery } from './rescue';
import type { InformationAssignment } from './informationPlanner';

export const EXPERIMENT_VERSION = 'frontier-study-v1';
export const PLANNERS: PlannerMode[] = ['nearest', 'information'];
export const PLANNER_LABELS: Record<PlannerMode, string> = {
  nearest: 'Nearest frontier', information: 'Information gain',
};
export interface ExperimentConfig { scenario: ScenarioId; seed: number; duration: number; count: number }
export interface ResearchFrame {
  time: number;
  coverage: number;
  confirmed: number;
  hazards: number;
  explored: boolean[];
  agents: { id: string; position: Vec2; heading: number; color: string; path: Vec2[];
    decision: string; information: { expectedCells: number; marginalCells: number; travelCost: number; utility: number } | null }[];
  discoveries: RescueDiscovery[];
}
export interface TrialResult {
  planner: PlannerMode;
  config: ExperimentConfig;
  coverage: number;
  coverageAuc: number;
  confirmed: number;
  hazards: number;
  completedAt: number | null;
  firstSignalAt: number | null;
  distance: number;
  peerBlocks: number;
  overlap: number;
  trajectoryDigest: string;
}
export interface ResearchTrial {
  swarm: SwarmSimulation;
  config: ExperimentConfig;
  planner: PlannerMode;
  frames: ResearchFrame[];
  coverageIntegral: number;
  lastCoverage: number;
  lastSampleTime: number;
  digest: number;
}
export interface PairedSummary {
  scenario: ScenarioId | 'all';
  pairs: number;
  baselineCoverage: number;
  informationCoverage: number;
  deltaCoverage: number;
  deltaAuc: number;
  bootstrap95: [number, number] | null;
  baselineCompletions: number;
  informationCompletions: number;
  improvedPairs: number;
}

export function validateExperimentConfig(config: ExperimentConfig): void {
  if (!config || !['residential', 'warehouse', 'corridors'].includes(config.scenario)) throw new Error('Invalid scenario');
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) throw new Error('Seed must be 0–4294967295');
  if (!Number.isInteger(config.duration) || config.duration < 1 || config.duration > 180) throw new Error('Duration must be 1–180 simulated seconds');
  if (!Number.isInteger(config.count) || config.count < 2 || config.count > 8) throw new Error('Research trials require 2–8 agents');
}
export function createResearchTrial(config: ExperimentConfig, planner: PlannerMode): ResearchTrial {
  validateExperimentConfig(config);
  if (!PLANNERS.includes(planner)) throw new Error('Invalid planner');
  const environment = createResearchEnvironment(config.scenario, config.seed);
  const swarm = createSwarm(config.count, config.seed, true, { environment, planner });
  const trial: ResearchTrial = { swarm, config: { ...config }, planner, frames: [], coverageIntegral: 0,
    lastCoverage: coverage(environment, swarm.agents[0].simulation.accessible), lastSampleTime: 0, digest: 2166136261 };
  trial.frames.push(captureResearchFrame(trial));
  runSwarm(swarm, true);
  return trial;
}

export function captureResearchFrame(trial: ResearchTrial): ResearchFrame {
  const { swarm } = trial, sim = swarm.agents[0].simulation;
  return { time: Number(swarm.elapsed.toFixed(6)), coverage: coverage(sim.environment, sim.accessible),
    confirmed: swarm.rescue.discoveries.filter(d => d.status === 'confirmed').length,
    hazards: swarm.rescue.discoveries.filter(d => d.kind === 'gas').length,
    explored: [...sim.environment.exploration.explored],
    agents: swarm.agents.map((agent, index) => {
      const a = agent.assignment as InformationAssignment | null;
      return { id: agent.simulation.bug.id, position: { ...agent.simulation.bug.position }, heading: agent.simulation.bug.heading,
        color: AGENT_COLORS[index], path: a?.path.map(p => ({ ...p })) ?? [], decision: agent.coordination,
        information: a && 'expectedCells' in a ? { expectedCells: a.expectedCells, marginalCells: a.marginalCells,
          travelCost: a.travelCost, utility: a.utility } : null };
    }),
    discoveries: swarm.rescue.discoveries.map(d => ({ ...d, estimatedPosition: { ...d.estimatedPosition },
      observers: [...d.observers], confirmedBy: [...d.confirmedBy] })),
  };
}

/** Advances integer physics ticks. Worker chunk size cannot change the trajectory. */
export function stepResearchTrial(trial: ResearchTrial, ticks = 60): boolean {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 600) throw new Error('Tick batch must be 1–600');
  const totalTicks = trial.config.duration * 60;
  for (let i = 0; i < ticks && trial.swarm.ticks < totalTicks; i++) {
    advanceSwarm(trial.swarm, FIXED_STEP);
    // Stable, non-cryptographic digest of the entire quantized trajectory.
    for (const agent of trial.swarm.agents) {
      for (const value of [agent.simulation.bug.position.x, agent.simulation.bug.position.y, agent.simulation.bug.heading]) {
        trial.digest = Math.imul(trial.digest ^ Math.round(value * 1e6), 16777619) >>> 0;
      }
    }
    if (trial.swarm.ticks % 60 === 0 || trial.swarm.ticks === totalTicks) {
      const frame = captureResearchFrame(trial);
      trial.coverageIntegral += (trial.lastCoverage + frame.coverage) / 2 * (frame.time - trial.lastSampleTime);
      trial.lastCoverage = frame.coverage; trial.lastSampleTime = frame.time;
      trial.frames.push(frame);
    }
  }
  if (trial.swarm.ticks === totalTicks) runSwarm(trial.swarm, false);
  return trial.swarm.ticks === totalTicks;
}
export function researchTrialResult(trial: ResearchTrial): TrialResult {
  if (trial.swarm.ticks !== trial.config.duration * 60) throw new Error('Cannot report an unfinished trial');
  const { swarm } = trial, accessible = swarm.agents[0].simulation.accessible;
  const personal = swarm.agents.map(a => a.simulation.controllerExplored['rule-based']);
  const union = accessible.filter((valid, i) => valid && personal.some(cells => cells[i])).length;
  const sum = personal.reduce((n, cells) => n + cells.filter((seen, i) => seen && accessible[i]).length, 0);
  return { planner: trial.planner, config: { ...trial.config }, coverage: trial.lastCoverage,
    coverageAuc: trial.coverageIntegral / trial.config.duration,
    confirmed: swarm.rescue.discoveries.filter(d => d.status === 'confirmed').length,
    hazards: swarm.rescue.discoveries.filter(d => d.kind === 'gas').length,
    completedAt: swarm.rescue.completedAt === null ? null : Number(swarm.rescue.completedAt.toFixed(6)),
    firstSignalAt: swarm.rescue.events.find(e => e.type === 'POSSIBLE LIFE SIGNAL')?.timestamp ?? null,
    distance: swarm.agents.reduce((n, a) => n + a.simulation.metrics['rule-based'].distance, 0),
    peerBlocks: swarm.agents.reduce((n, a) => n + a.peerBlocks, 0),
    overlap: sum ? 1 - union / sum : 0,
    trajectoryDigest: trial.digest.toString(16).padStart(8, '0') };
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
export function bootstrapMeanInterval(values: number[], seed = 2026, repetitions = 4000): [number, number] | null {
  if (values.length < 2) return null;
  if (values.some(value => !Number.isFinite(value))) throw new Error('Bootstrap requires finite observations');
  if (!Number.isInteger(repetitions) || repetitions < 100) throw new Error('At least 100 bootstrap resamples required');
  const random = randomSequence(seed), means: number[] = [];
  for (let b = 0; b < repetitions; b++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(random() * values.length)];
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(.025 * (repetitions - 1))], means[Math.ceil(.975 * (repetitions - 1))]];
}

/** Refuse missing, duplicate or incompatible pairs: dropping failures biases results.
 * Pooled CI resamples seed blocks, preserving all scenario pairs within a seed. */
export function summarizePairs(runs: TrialResult[], scenario: ScenarioId | 'all' = 'all'): PairedSummary {
  const selected = runs.filter(r => scenario === 'all' || r.config.scenario === scenario);
  if (!selected.length) throw new Error('No trials to summarize');
  const protocols = new Set(selected.map(r => `${r.config.duration}:${r.config.count}`));
  if (protocols.size !== 1) throw new Error('Cannot pool different experiment protocols');
  const pairs = new Map<string, Partial<Record<PlannerMode, TrialResult>>>();
  for (const run of selected) {
    validateExperimentConfig(run.config);
    if (!PLANNERS.includes(run.planner) || !Number.isFinite(run.coverage) || !Number.isFinite(run.coverageAuc)) throw new Error('Invalid trial metrics');
    const key = `${run.config.scenario}:${run.config.seed}`, pair = pairs.get(key) ?? {};
    if (pair[run.planner]) throw new Error(`Duplicate trial: ${key}:${run.planner}`);
    pair[run.planner] = run; pairs.set(key, pair);
  }
  const complete = [...pairs.values()].map(pair => {
    if (!pair.nearest || !pair.information) throw new Error('Every scenario/seed needs both planners');
    return { nearest: pair.nearest, information: pair.information };
  });
  const blocks = new Map<number, { scenarios: string[]; values: number[] }>();
  for (const pair of complete) {
    const block = blocks.get(pair.nearest.config.seed) ?? { scenarios: [], values: [] };
    block.scenarios.push(pair.nearest.config.scenario); block.values.push(pair.information.coverage - pair.nearest.coverage);
    blocks.set(pair.nearest.config.seed, block);
  }
  if (new Set([...blocks.values()].map(b => b.scenarios.sort().join(','))).size !== 1) throw new Error('Seed blocks must contain the same scenarios');
  return { scenario, pairs: complete.length,
    baselineCoverage: average(complete.map(p => p.nearest.coverage)),
    informationCoverage: average(complete.map(p => p.information.coverage)),
    deltaCoverage: average(complete.map(p => p.information.coverage - p.nearest.coverage)),
    deltaAuc: average(complete.map(p => p.information.coverageAuc - p.nearest.coverageAuc)),
    bootstrap95: bootstrapMeanInterval([...blocks.values()].map(b => average(b.values))),
    baselineCompletions: complete.filter(p => p.nearest.completedAt !== null).length,
    informationCompletions: complete.filter(p => p.information.completedAt !== null).length,
    improvedPairs: complete.filter(p => p.information.coverage > p.nearest.coverage).length };
}

/** Public replay contains observations, never hidden target positions or world state. */
export function exportResearchReplay(config: ExperimentConfig, frames: Record<PlannerMode, ResearchFrame[]>, runs: TrialResult[]) {
  return { schema: EXPERIMENT_VERSION, scenarioVersion: SCENARIO_VERSION, config,
    scope: 'Software simulation; model confirmations are not evidence of human survival.',
    frames, runs };
}
export function researchResultsCsv(runs: TrialResult[]): string {
  const header = 'scenario,seed,planner,agents,duration_s,coverage_pct,coverage_auc_pct,confirmed_model_targets,hazards,completed_at_s,first_signal_at_s,distance_world_units,peer_blocks,cross_agent_overlap,trajectory_digest';
  return [header, ...runs.map(r => [r.config.scenario, r.config.seed, r.planner, r.config.count, r.config.duration,
    r.coverage, r.coverageAuc, r.confirmed, r.hazards, r.completedAt ?? '', r.firstSignalAt ?? '', r.distance,
    r.peerBlocks, r.overlap, r.trajectoryDigest].join(','))].join('\n') + '\n';
}
export function researchTerrain(config: ExperimentConfig): Environment {
  const env = createResearchEnvironment(config.scenario, config.seed);
  return { ...env, survivors: [], hazards: [] };
}
