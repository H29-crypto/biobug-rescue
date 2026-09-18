import { useEffect, useRef, useState } from 'react';
import { advance, createSimulation, setRunning, snapshot, switchController } from '../simulation/engine';
import type { Simulation, ControllerMode } from '../simulation/engine';
import { NeuralLoop } from '../simulation/neuralLoop';
export function useSimulation() {
  const ref = useRef<Simulation | null>(null);
  if (!ref.current) ref.current = createSimulation();
  const [view, setView] = useState(() => snapshot(ref.current!));
  const loop = useRef<NeuralLoop | null>(null);
  useEffect(() => {
    let frame = 0, previous: number | null = null;
    const controller = new NeuralLoop(); loop.current = controller;
    const tick = (time: number) => {
      const sim = ref.current!;
      if (previous !== null && sim.running) { advance(sim, (time - previous) / 1000); setView(snapshot(sim)); }
      void controller.pump(sim, () => ref.current!, () => setView(snapshot(ref.current!)));
      previous = time; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); controller.dispose(); };
  }, []);
  return { ...view,
    toggle: () => { const sim = ref.current!; loop.current?.cancel(); setRunning(sim, !sim.running); setView(snapshot(sim)); },
    reset: () => { loop.current?.cancel(); const mode = ref.current!.mode; ref.current = createSimulation(); switchController(ref.current, mode); setView(snapshot(ref.current)); },
    selectController: (mode: ControllerMode) => { if (ref.current!.mode !== mode) { loop.current?.cancel(); switchController(ref.current!, mode); setView(snapshot(ref.current!)); } },
  };
}
