import { createResearchTrial, stepResearchTrial, researchTrialResult } from '../simulation/researchExperiment';
import type { ResearchTrial } from '../simulation/researchExperiment';
import type { WorkerCommand, WorkerUpdate } from './protocol';

let trials: [ResearchTrial, ResearchTrial] | null = null;
let paused = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const send = (message: WorkerUpdate) => postMessage(message);
function publish() {
  if (!trials) return;
  send({ type: 'frames', frames: { nearest: trials[0].frames.at(-1)!, information: trials[1].frames.at(-1)! } });
}
function tick() {
  timer = null;
  if (!trials || paused) return;
  try {
    const leftDone = stepResearchTrial(trials[0]);
    const rightDone = stepResearchTrial(trials[1]);
    publish();
    if (leftDone && rightDone) {
      send({ type: 'complete', runs: trials.map(researchTrialResult) }); trials = null;
    } else timer = setTimeout(tick, 25);
  } catch (error) {
    trials = null; send({ type: 'error', message: error instanceof Error ? error.message : 'Experiment failed' });
  }
}
self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  try {
    if (event.data.type === 'start') {
      if (timer !== null) clearTimeout(timer);
      trials = [createResearchTrial(event.data.config, 'nearest'), createResearchTrial(event.data.config, 'information')];
      paused = false; publish(); timer = setTimeout(tick, 25);
    } else if (event.data.type === 'pause') {
      paused = true;
    } else if (event.data.type === 'resume') {
      paused = false;
      if (trials && timer === null) timer = setTimeout(tick, 25);
    }
  } catch (error) {
    if (timer !== null) clearTimeout(timer);
    timer = null; trials = null;
    send({ type: 'error', message: error instanceof Error ? error.message : 'Invalid experiment' });
  }
};
