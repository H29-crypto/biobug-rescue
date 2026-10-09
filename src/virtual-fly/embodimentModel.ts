import type { FlySimulation } from './simulation';

export type BodyStyle = 'simple' | 'natural' | 'biobug';
export type MotionStyle = 'walk' | 'flight';
export interface EmbodimentPose {
  x: number; z: number; yaw: number;
  distance: number; time: number; speed: number;
  running: boolean; moving: boolean; waiting: boolean;
}

/** Detached scalar projection. The renderer never receives a writable simulation. */
export function embodimentPose(s: FlySimulation): EmbodimentPose {
  return {
    x: s.fly.position.x, z: s.fly.position.y, yaw: -s.fly.heading,
    distance: s.metrics.distance, time: s.elapsed, speed: s.fly.velocity,
    running: s.running, moving: s.fly.velocity > 0,
    waiting: s.neural.status === 'waiting',
  };
}

/** A pose function, not a second clock. Equal simulation samples give equal animation. */
export function embodimentAnimation(p: EmbodimentPose, motion: MotionStyle = 'walk') {
  const phase = p.distance * .64;
  const flying = motion === 'flight';
  return {
    // Illustrative hover height, not altitude in the physical simulation.
    altitude: flying ? 12 + Math.sin(p.time * 3.2) * .45 : 0,
    pitch: flying ? .08 + Math.sin(p.time * 2.1) * .025 : 0,
    bob: flying ? 0 : Math.sin(phase * 2) * .075,
    // Display-rate wingbeats; deliberately not a biological wingbeat frequency.
    wing: flying ? Math.sin(p.time * Math.PI * 2 * 11) * .6 : Math.sin(p.time * 2.4) * .022,
    antenna: Math.sin(p.time * 1.7) * .035,
    legs: Array.from({ length: 6 }, (_, i) => {
      const side = i < 3 ? -1 : 1;
      const a = phase + ((i % 3 + (side > 0 ? 1 : 0)) % 2) * Math.PI;
      return flying ? { swing: -.2 * side, lift: -.95 * side }
        : { swing: Math.sin(a) * .20, lift: Math.max(0, Math.cos(a)) * .22 * side };
    }),
  };
}
