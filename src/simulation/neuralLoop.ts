import { acceptNeural, failNeural, neuralDue } from './engine';
import type { Simulation } from './engine';
import { mapSensors } from './sensorMapping';
import { requestNeural } from './neuralClient';
/** One in-flight request across pause/reset/switch. Obsolete results never affect a new epoch. */
export class NeuralLoop {
  private pending: AbortController | null = null;
  private disposed = false;
  constructor(private request = requestNeural, private now = () => performance.now()) {}
  cancel() { this.pending?.abort(); }
  dispose() { this.disposed = true; this.cancel(); }
  async pump(sim: Simulation, current: () => Simulation, update: () => void = () => {}) {
    if (this.disposed || this.pending || !neuralDue(sim)) return;
    const abort = new AbortController(), generation = sim.generation, started = this.now();
    this.pending = abort; sim.neural.status = 'waiting'; update();
    const valid = () => !this.disposed && current() === sim && sim.generation === generation && sim.running && sim.mode === 'malecns';
    const timeout = setTimeout(() => abort.abort(), 4000);
    try {
      const result = await this.request(mapSensors(sim.bug.sensors), abort.signal);
      if (abort.signal.aborted) throw new Error('Request expired');
      if (valid()) acceptNeural(sim, result, this.now()-started);
    } catch (error) {
      if (valid()) failNeural(sim, abort.signal.aborted ? 'Request cancelled or exceeded 4 seconds.' : String(error));
    } finally {
      clearTimeout(timeout); this.pending = null;
      if (!this.disposed) update();
    }
  }
}
