import { useEffect, useRef } from 'react';
import type { BioBug, Environment } from '../domain/types';
import { drawEnvironment } from '../rendering/drawEnvironment';
import { drawBioBug } from '../rendering/drawBioBug';

export function EnvironmentCanvas({ environment, bug, reveal, debug }: { environment: Environment; bug: BioBug; reveal: boolean; debug: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ environment, bug, reveal, debug });
  useEffect(() => {
    latest.current = { environment, bug, reveal, debug };
    const canvas = ref.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(canvas.width / environment.width, 0, 0, canvas.height / environment.height, 0, 0);
    drawEnvironment(ctx, environment, reveal); drawBioBug(ctx, bug, debug);
  }, [environment, bug, reveal, debug]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const { environment, bug, reveal, debug } = latest.current;
      const bounds = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(canvas.width / environment.width, 0, 0, canvas.height / environment.height, 0, 0);
      drawEnvironment(ctx, environment, reveal); drawBioBug(ctx, bug, debug);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ aspectRatio: `${environment.width} / ${environment.height}` }} role="img" aria-label={`Disaster map with BioBug #1, walls, debris, and ${reveal ? 'all terrain visible in inspection mode' : 'movement-driven fog of war'}. Survivor and hazard markers appear in explored cells.`}>BioBug #1 explores a disaster map. Live position and sensor readings are available in the inspector.</canvas>;
}
