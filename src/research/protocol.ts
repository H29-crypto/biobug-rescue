import type { ExperimentConfig, ResearchFrame, TrialResult } from '../simulation/researchExperiment';
import type { PlannerMode } from '../simulation/swarm';

export type WorkerCommand = { type: 'start'; config: ExperimentConfig } | { type: 'pause' | 'resume' };
export type WorkerUpdate =
  | { type: 'frames'; frames: Record<PlannerMode, ResearchFrame> }
  | { type: 'complete'; runs: TrialResult[] }
  | { type: 'error'; message: string };
