import { useEffect, useRef, useState } from 'react';
import { advance, createSimulation, setRunning, snapshot } from '../simulation/engine';
import type { Simulation } from '../simulation/engine';
export function useSimulation() {
  const ref = useRef<Simulation | null>(null);
  if (!ref.current) ref.current = createSimulation();
  const [view, setView] = useState(() => snapshot(ref.current!));
  useEffect(() => {
    let frame = 0, previous: number | null = null;
    const tick = (time: number) => {
      const sim = ref.current!;
      if (previous !== null && sim.running) { advance(sim, (time - previous) / 1000); setView(snapshot(sim)); }
      previous = time; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return { ...view,
    toggle: () => { const sim = ref.current!; setRunning(sim, !sim.running); setView(snapshot(sim)); },
    reset: () => { ref.current = createSimulation(); setView(snapshot(ref.current)); },
  };
}
