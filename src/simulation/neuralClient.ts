import type { Stimulus } from './sensorMapping';
export const CONTROL_MODEL = 'unsigned-incoming-log-20-steps-3-pulse-from-rest-v1';
export interface NeuralResponse {
  dataset: string; version: string; model: string; stimulus: Stimulus; structural_unchanged: boolean;
  graph: { neurons: number; edges: number; structural_contacts: number; structural_sha256: string };
  dna02: Record<'L' | 'R', { id: string; side_field: string; peak: number }>;
  input_active: number; top_intermediate_types: { type: string; cumulative_activity: number }[];
  evaluation_seconds: number;
}
export function parseNeuralResponse(raw: unknown, stimulus: Stimulus): NeuralResponse {
  const r = raw as NeuralResponse;
  const unit = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (!r || r.dataset !== 'MaleCNS' || r.version !== 'v1.0' || r.model !== CONTROL_MODEL || r.structural_unchanged !== true ||
      !r.graph || !integer(r.graph.neurons) || !r.graph.neurons || !integer(r.graph.edges) || !integer(r.graph.structural_contacts) ||
      !/^[a-f0-9]{64}$/.test(r.graph.structural_sha256) ||
      !['L','R'].every(s => { const n = r.dna02?.[s as 'L'|'R']; return n && typeof n.id === 'string' && /^\d+$/.test(n.id) && n.side_field === 'somaSide' && unit(n.peak); }) ||
      r.dna02.L.id === r.dna02.R.id || !['left','front','right'].every(s => r.stimulus?.[s as keyof Stimulus] === stimulus[s as keyof Stimulus]) ||
      !integer(r.input_active) || r.input_active > r.graph.neurons || !Array.isArray(r.top_intermediate_types) || r.top_intermediate_types.length > 5 ||
      !r.top_intermediate_types.every(n => typeof n.type === 'string' && Number.isFinite(n.cumulative_activity) && n.cumulative_activity >= 0) ||
      !Number.isFinite(r.evaluation_seconds) || r.evaluation_seconds < 0) throw new Error('Invalid MaleCNS response; movement paused');
  return r;
}
export async function requestNeural(stimulus: Stimulus, signal: AbortSignal): Promise<NeuralResponse> {
  const response = await fetch('http://127.0.0.1:8000/connectome/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stimulus), signal });
  if (!response.ok) throw new Error(`Connectome HTTP ${response.status}`);
  return parseNeuralResponse(await response.json(), stimulus);
}
