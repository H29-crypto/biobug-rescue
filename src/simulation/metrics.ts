export interface ControllerMetrics {
  elapsed: number; distance: number; turns: number; blocked: number; stuck: number; coverage: number;
  neuralDecisions: number; backendFailures: number; fallbacks: number; asymmetrySum: number; latencies: number[];
}
export const createMetrics = (): ControllerMetrics => ({ elapsed: 0, distance: 0, turns: 0, blocked: 0, stuck: 0, coverage: 0,
  neuralDecisions: 0, backendFailures: 0, fallbacks: 0, asymmetrySum: 0, latencies: [] });
export function summarizeMetrics(m: ControllerMetrics) {
  const ordered = [...m.latencies].sort((a,b) => a-b);
  return { ...m, latencies: undefined, meanApiMs: ordered.length ? ordered.reduce((a,b) => a+b,0)/ordered.length : 0,
    p95ApiMs: ordered.length ? ordered[Math.ceil(ordered.length*.95)-1] : 0,
    meanAsymmetry: m.neuralDecisions ? m.asymmetrySum/m.neuralDecisions : 0,
    fallbackPercent: m.neuralDecisions ? 100*m.fallbacks/m.neuralDecisions : 0 };
}
