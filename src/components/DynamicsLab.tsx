import { useEffect, useRef, useState } from 'react';
import './dynamics.css';

type Stimulus = { left: number; front: number; right: number };
type Neuron = { id: string; type: string | null; class: string | null; side: string | null; side_field: string; role: string; consensus_nt: string | null; predicted_nt: string | null; predicted_nt_confidence: number | null; activity: number };
type Aggregate = { label: string; count: number; active: number; sum: number; mean: number };
type Trace = { step: number; input_on: boolean; dna02: Record<'L' | 'R', { id: string; activation: number }>; active_neurons: number; max_activity: number; roles: Record<'source' | 'intermediate' | 'target', { neurons: number; active: number; mean: number; sum: number }>; top_neurons: Neuron[]; top_intermediates: Neuron[]; by_side: Aggregate[]; by_class: Aggregate[]; by_type: Aggregate[] };
type Experiment = {
  dataset: string; version: string;
  graph: { neurons: number; edges: number; structural_contacts: number; source_neurons: number; intermediate_neurons: number; sources_with_outgoing_route_edges: number; structural_sha256: string; structural_array_bytes: number; build_seconds: number; selection: string };
  engineering_model: { parameters: { decay: number; gain: number; input_gain: number; nt_confidence_threshold: number; sign_mode: string; transformation: string }; input_mapping: string; sign_rule: string; weight_rule: string; sign_counts: Record<string, number> };
  trace: Trace[];
  summary: { dna02: Record<'L' | 'R', { id: string; peak: number; cumulative: number; final: number }>; peak_active_neurons: number; dominant_intermediate_types: { type: string; cumulative_activity: number }[]; structural_unchanged: boolean };
  weight_examples: { source: string; target: string; structural_contact_count: number; simulation_weight: number; presynaptic_nt: string | null; sign_reason: string }[];
  performance: { seconds_per_step: number; api_handler_seconds: number; cold_graph_build: boolean; simulation_weight_bytes: number };
  scientific_note: string;
};
const PRESETS: { name: string; stimulus: Stimulus }[] = [
  { name: 'LEFT STIMULUS', stimulus: { left: 1, front: 0, right: 0 } },
  { name: 'RIGHT STIMULUS', stimulus: { left: 0, front: 0, right: 1 } },
  { name: 'FRONT STIMULUS', stimulus: { left: 0, front: 1, right: 0 } },
  { name: 'SYMMETRIC STIMULUS', stimulus: { left: 1, front: 0, right: 1 } },
  { name: 'NO STIMULUS', stimulus: { left: 0, front: 0, right: 0 } },
];
const fixed = (value: number) => value.toFixed(6);

function NeuronsTable({ neurons }: { neurons: Neuron[] }) {
  return neurons.length ? <div className="dynamics-table"><table><thead><tr><th>REAL ID / type</th><th>REAL side field</th><th>REAL NT prediction</th><th>MODEL activity</th></tr></thead><tbody>{neurons.map(n => <tr key={n.id}><td>{n.id}<small>{n.type || 'Unannotated'}</small></td><td>{n.side_field}: {n.side || 'missing'}</td><td>Consensus: {n.consensus_nt || 'missing'}<small>Body: {n.predicted_nt || 'missing'} · confidence: {n.predicted_nt_confidence == null ? 'missing' : n.predicted_nt_confidence.toFixed(3)}</small></td><td>{fixed(n.activity)}</td></tr>)}</tbody></table></div> : <p className="dynamics-muted">No neurons above the activity threshold at this step.</p>;
}

function ActivityChart({ experiment, step }: { experiment: Experiment; step: number }) {
  const traces = experiment.trace;
  const max = Math.max(.001, ...traces.flatMap(t => [t.dna02.L.activation, t.dna02.R.activation]));
  const x = (s: number) => 48 + s / Math.max(1, traces.length - 1) * 700;
  const y = (value: number) => 185 - value / max * 150;
  return <svg viewBox="0 0 800 225" className="dynamics-chart" role="img" aria-label="DNa02 simulated activity across abstract time steps. Left soma in mint, right soma in amber. Vertical axis auto-scaled.">
    {[0, .5, 1].map(f => <g key={f}><line x1={48} x2={750} y1={y(max * f)} y2={y(max * f)} stroke="#30483f"/><text x={42} y={y(max * f) + 4} textAnchor="end">{(max * f).toFixed(4)}</text></g>)}
    <line x1={x(step)} x2={x(step)} y1={30} y2={190} stroke="#e1e9e0" strokeDasharray="4 5"/>
    {(['L', 'R'] as const).map(side => <polyline key={side} points={traces.map(t => `${x(t.step)},${y(t.dna02[side].activation)}`).join(' ')} fill="none" stroke={side === 'L' ? '#92e2b9' : '#e5b475'} strokeWidth={3} strokeDasharray={side === 'R' ? '7 3' : undefined}/>)}
    <text x={48} y={212}>0 · resting state</text><text x={748} y={212} textAnchor="end">{traces.length - 1} abstract steps · auto-scaled activity</text>
  </svg>;
}

export function DynamicsLab() {
  const [stimulus, setStimulus] = useState<Stimulus>({ left: 1, front: 0, right: 0 });
  const [steps, setSteps] = useState(10);
  const [pulseSteps, setPulseSteps] = useState(3);
  const [signMode, setSignMode] = useState('unsigned');
  const [transformation, setTransformation] = useState('incoming_log');
  const [injection, setInjection] = useState(true);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    if (!playing || !experiment) return;
    const timer = window.setInterval(() => setStep(value => {
      if (value >= experiment.trace.length - 1) { setPlaying(false); return value; }
      return value + 1;
    }), 400);
    return () => window.clearInterval(timer);
  }, [playing, experiment]);
  const clear = () => { setExperiment(null); setPlaying(false); setStep(0); setError(''); };
  async function run() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    clear(); setLoading(true);
    const start = performance.now();
    try {
      const response = await fetch('http://127.0.0.1:8000/connectome/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ stimulus, steps, pulse_steps: pulseSteps, injection_enabled: injection,
          parameters: { sign_mode: signMode, transformation } }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { detail?: unknown };
        throw new Error(typeof body.detail === 'string' ? body.detail : `Experiment failed (HTTP ${response.status}). Check backend data and parameters.`);
      }
      const result = await response.json() as Experiment;
      if (!controller.signal.aborted) { setExperiment(result); setElapsed(performance.now() - start); setStep(0); setPlaying(true); }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to run experiment.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const frame = experiment?.trace[step];
  return <section className="dynamics-lab" aria-label="Neural dynamics lab">
    <div className="dynamics-heading"><div><p className="eyebrow">EXPERIMENTAL · MILESTONE 3C</p><h2>Neural dynamics lab</h2></div><span>ENGINEERING MODEL</span></div>
    <p>Inject a simulated tactile pulse into the real ProLN route network and inspect both DNa02 readouts. The inputs here are manual experiment controls. The moving BioBug is not connected.</p>
    <div className="dynamics-boundaries"><div><b>REAL DATA</b><p>Neuron IDs, annotations, anatomical sides, structural edges, contact counts and transmitter predictions.</p></div><div><b>ENGINEERING MODEL</b><p>Stimulus mapping, transformed weights, assumed signs, decay, gain and bounded activity. No measured membrane dynamics.</p></div></div>
    <div className="dynamics-presets" aria-label="Experiment presets">{PRESETS.map(preset => <button disabled={loading} key={preset.name} onClick={() => { clear(); setStimulus(preset.stimulus); }}>{preset.name}</button>)}</div>
    <fieldset disabled={loading} className="dynamics-controls"><legend>Engineering stimulus · normalized 0–1</legend>
      <div className="dynamics-sliders">{(['left', 'front', 'right'] as const).map(side => <label key={side}>{side[0].toUpperCase() + side.slice(1)} tactile stimulus <output>{stimulus[side].toFixed(2)}</output><input type="range" min={0} max={1} step={.05} value={stimulus[side]} onChange={event => { clear(); setStimulus({ ...stimulus, [side]: Number(event.target.value) }); }}/></label>)}</div>
      <div className="dynamics-settings"><label>Simulation steps<input type="number" min={1} max={200} value={steps} onChange={event => { clear(); setSteps(Math.min(200, Math.max(1, Math.round(Number(event.target.value))))); }}/></label>
        <label>Stimulus pulse steps<input type="number" min={0} max={200} value={pulseSteps} onChange={event => { clear(); setPulseSteps(Math.min(200, Math.max(0, Math.round(Number(event.target.value))))); }}/></label>
        <label>Engineering sign model<select value={signMode} onChange={event => { clear(); setSignMode(event.target.value); }}><option value="unsigned">Unsigned baseline</option><option value="predicted">Experimental NT signs · ambiguous = 0</option></select></label>
        <label>Engineering weight transform<select value={transformation} onChange={event => { clear(); setTransformation(event.target.value); }}><option value="incoming_log">Incoming-normalized log contacts</option><option value="global_log">Global-normalized log contacts</option></select></label>
      </div>
      <label className="dynamics-check"><input type="checkbox" checked={injection} onChange={event => { clear(); setInjection(event.target.checked); }}/>Enable input injection</label>
    </fieldset>
    <p className="dynamics-muted">Model defaults: decay 0.25 · gain 0.20 · input gain 0.50 · resting activity 0 · bounds [0, 1]. Front contributes 0.5 to each anatomical root-side input. A pulse longer than the run remains on throughout that run.</p>
    <button className="dynamics-run" disabled={loading} onClick={() => { void run(); }}>{loading ? 'BUILDING / RUNNING EXPERIMENT…' : 'RUN EXPERIMENT'}</button>
    {loading && <p role="status">The first request extracts the two-hop graph from MaleCNS. Later experiments reuse its immutable structure.</p>}
    {error && <p role="alert" className="dynamics-error">{error} Start the local backend on port 8000, then retry. The BioBug simulation remains independent.</p>}
    {experiment && frame && <div className="dynamics-results">
      <p className="dynamics-real-summary"><b>REAL {experiment.dataset} {experiment.version}</b> · {experiment.graph.neurons} neurons · {experiment.graph.edges} structural edges · {experiment.graph.structural_contacts.toLocaleString()} contacts · Structure {experiment.summary.structural_unchanged ? 'unchanged' : 'CHECK FAILED'}</p>
      <p className="dynamics-muted">Full two-hop route union with all {experiment.graph.source_neurons} annotated inputs retained; {experiment.graph.sources_with_outgoing_route_edges} have outgoing edges in this route graph. This differs from the sampled graph above.</p>
      <div className="dynamics-playback"><button onClick={() => { if (step === experiment.trace.length - 1) setStep(0); setPlaying(value => !value); }}>{playing ? 'Pause trace' : 'Play trace'}</button><label>Experiment step {frame.step}<input type="range" min={0} max={experiment.trace.length - 1} value={step} onChange={event => { setPlaying(false); setStep(Number(event.target.value)); }}/></label><span>{frame.input_on ? 'Stimulus pulse on' : 'No input injected'} · {frame.active_neurons} active neurons</span></div>
      <div className="dynamics-flow"><div><b>INJECTED INPUT</b><small>ENGINEERING MAPPING</small><p>L {stimulus.left} / F {stimulus.front} / R {stimulus.right}</p></div><span>→</span><div><b>ProLN tactile</b><small>MODEL mean activity</small><strong>{fixed(frame.roles.source.mean)}</strong><p>{frame.roles.source.active}/{frame.roles.source.neurons} active</p></div><span>→</span><div><b>Real route intermediates</b><small>MODEL mean activity</small><strong>{fixed(frame.roles.intermediate.mean)}</strong><p>{frame.roles.intermediate.active}/{frame.roles.intermediate.neurons} active</p></div><span>→</span><div><b>DNa02 readouts</b><small>ENGINEERING ACTIVITY</small><p>Detailed below · no motor decoder</p></div></div>
      <div className="dynamics-readouts">{(['L', 'R'] as const).map(side => <div key={side} className={side === 'L' ? 'left' : 'right'}><h3>DNa02-{side}</h3><small>REAL body {frame.dna02[side].id} · somaSide {side}</small><strong>{fixed(frame.dna02[side].activation)}</strong><p>MODEL activation · peak {fixed(experiment.summary.dna02[side].peak)}<br/>Cumulative {fixed(experiment.summary.dna02[side].cumulative)} activity-steps</p></div>)}</div>
      <ActivityChart experiment={experiment} step={step}/>
      <p className="dynamics-muted">Mint: somaSide L · Amber dashed: somaSide R. Playback displays a completed deterministic trace, not live fly physiology or a movement command.</p>
      <h3>Active intermediates at step {step}</h3><NeuronsTable neurons={frame.top_intermediates}/>
      <details className="dynamics-detail"><summary>Top active neurons and anatomical aggregates</summary><NeuronsTable neurons={frame.top_neurons}/><div className="dynamics-table"><table><thead><tr><th>REAL side field / label</th><th>MODEL active</th><th>MODEL activity sum</th></tr></thead><tbody>{frame.by_side.map(group => <tr key={group.label}><td>{group.label}</td><td>{group.active}/{group.count}</td><td>{fixed(group.sum)}</td></tr>)}</tbody></table></div><p>Top types: {frame.by_type.filter(group => group.sum > 0).map(group => `${group.label}: ${fixed(group.sum)}`).join(' · ') || 'No activity'}</p><p>Classes: {frame.by_class.filter(group => group.sum > 0).map(group => `${group.label}: ${fixed(group.sum)}`).join(' · ') || 'No activity'}</p></details>
      <details className="dynamics-detail"><summary>Structural contacts versus engineering weights</summary><p>{experiment.engineering_model.weight_rule}</p><div className="dynamics-table"><table><thead><tr><th>REAL edge</th><th>REAL contacts</th><th>MODEL weight</th><th>REAL presynaptic consensus NT</th></tr></thead><tbody>{experiment.weight_examples.map(edge => <tr key={`${edge.source}-${edge.target}`}><td>{edge.source} → {edge.target}</td><td>{edge.structural_contact_count}</td><td>{fixed(edge.simulation_weight)}</td><td title={edge.sign_reason}>{edge.presynaptic_nt || 'missing'}</td></tr>)}</tbody></table></div><p>Up to 20 examples, ranked by absolute simulation weight. Full graph counts are shown above.</p></details>
      <details className="dynamics-detail"><summary>Model, sign assumptions and performance</summary><p>{experiment.engineering_model.sign_rule}</p><p>Engineering body-confidence threshold: {experiment.engineering_model.parameters.nt_confidence_threshold}. This threshold is not a measured synaptic-sign probability.</p><p>Neuron signs: {Object.entries(experiment.engineering_model.sign_counts).map(([sign, count]) => `${sign}: ${count}`).join(' · ')}</p><p>{experiment.engineering_model.input_mapping}</p><code>a[t+1] = clip((1−decay) a[t] + gain Wᵀ a[t] + input_gain I[t], 0, 1)</code><p>Core step: {(experiment.performance.seconds_per_step * 1000).toFixed(3)} ms · API handler: {(experiment.performance.api_handler_seconds * 1000).toFixed(1)} ms · Browser round trip: {elapsed.toFixed(1)} ms{experiment.performance.cold_graph_build ? ' (includes cold extraction)' : ''}</p><p>Bounded structural arrays: {(experiment.graph.structural_array_bytes / 1024).toFixed(1)} KiB · Simulation matrix: {(experiment.performance.simulation_weight_bytes / 1024).toFixed(1)} KiB. Excludes the loaded full connectome and response objects.</p></details>
      <p className="dynamics-science">{experiment.scientific_note}</p>
    </div>}
  </section>;
}
