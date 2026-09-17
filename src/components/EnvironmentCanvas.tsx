import { useEffect, useRef } from 'react';
import type { Environment } from '../domain/types';
import { drawEnvironment } from '../rendering/drawEnvironment';

export function EnvironmentCanvas({ environment, reveal }: { environment: Environment; reveal: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(canvas.width / environment.width, 0, 0, canvas.height / environment.height, 0, 0);
      drawEnvironment(ctx, environment, reveal);
    };
    const observer = new ResizeObserver(render); observer.observe(canvas); render();
    window.addEventListener('resize', render);
    return () => { observer.disconnect(); window.removeEventListener('resize', render); };
  }, [environment, reveal]);
  return <canvas ref={ref} style={{ aspectRatio: `${environment.width} / ${environment.height}` }} role="img" aria-label={`Collapsed building map with walls, debris, one possible survivor, one gas hazard, and ${reveal ? 'all terrain visible in inspection mode' : 'unexplored areas hidden'}. No agents deployed.`}>Disaster environment map. One possible survivor and one gas hazard are marked in the explored area.</canvas>;
}
