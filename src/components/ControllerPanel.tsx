import type { snapshot } from '../simulation/engine';
import { mapSensors } from '../simulation/sensorMapping';
import './controller.css';
type View = ReturnType<typeof snapshot>;
export function ControllerPanel({ view }: { view: View }) {
  const { neural, mode, bug, controllerMetrics } = view;
  const r = neural.response, d = neural.decision;
  const stimulus = r?.stimulus ?? mapSensors(bug.sensors);
  const m = controllerMetrics.malecns;
  return <section className="controller-panel" aria-label="Controller telemetry">
    {mode === 'malecns' && <>
      <div className="controller-title"><div><p className="eyebrow">MALECNS CONTROLLER · MILESTONE 3D</p><h2>Structure in the control loop.</h2></div><span className="badge">{neural.status === 'offline' ? 'CONNECTOME OFFLINE' : neural.status === 'waiting' ? 'WAITING · MOTION HELD' : neural.status === 'ready' ? 'CONNECTOME READY' : 'AWAITING START'}</span></div>
      {neural.status === 'offline' && <p className="controller-error" role="alert">CONNECTOME OFFLINE — mission paused. {neural.error} Press Start to retry or select Rule-Based.</p>}
      <p className="muted">MaleCNS-connectome-based computational controller. Real anatomy, simulated activity, engineered movement. Five decisions per simulated second; motion waits for each result. Readouts are peaks of separate 20-step experiments from rest.</p>
      <div className="control-flow">
        <div><p className="eyebrow">ENGINEERING SENSOR MAPPING</p><h3>Obstacle proximity</h3>{(['left','front','right'] as const).map(side => <label key={side}>{side}<meter min="0" max="1" value={stimulus[side]}/><span>{stimulus[side].toFixed(3)}</span></label>)}<small>{r ? 'Last decision sample' : 'Current sensors · awaiting propagation'} · raw distances remain in the inspector.</small></div>
        <div><p className="eyebrow">REAL MALECNS STRUCTURE</p><h3>ProLN → intermediates → DNa02</h3>{r ? <><strong>{r.graph.neurons} neurons · {r.graph.edges} edges</strong><p>{r.graph.structural_contacts.toLocaleString()} contacts · unchanged</p><small>MaleCNS {r.version} · unsigned propagation</small></> : <p>Counts will appear after loading real data.</p>}</div>
        <div><p className="eyebrow">SIMULATED NEURAL ACTIVITY</p><h3>DNa02 readout</h3>{(['L','R'] as const).map(side => <label key={side}>{side}<meter min="0" max="1" value={r?.dna02[side].peak ?? 0}/><span>{r ? r.dna02[side].peak.toFixed(4) : '—'}</span></label>)}<small>{r ? `Real IDs L ${r.dna02.L.id} / R ${r.dna02.R.id} · somaSide` : 'No readout yet'}</small><p>ProLN input: {r ? `${r.input_active} active` : 'awaiting experiment'}</p></div>
        <div><p className="eyebrow">ENGINEERING MOTOR DECODER</p><h3>{!view.running ? 'STOP · PAUSED' : neural.status === 'waiting' ? 'STOP · WAITING' : d?.action.replaceAll('_',' ') ?? 'STOP'}</h3><p>Delta L − R: {d ? `${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(4)}` : '—'}</p><p>{d?.reason ?? 'No movement command until a valid neural result arrives.'}</p><small>Collision layer may reject the proposed movement.</small></div>
      </div>
      <div className="controller-details"><div><h3>Active intermediate types</h3><p className="muted">Cumulative simulated activity over the latest experiment.</p>{r?.top_intermediate_types.length ? <ul>{r.top_intermediate_types.map(n => <li key={n.type}><span>{n.type}</span><strong>{n.cumulative_activity.toFixed(3)}</strong></li>)}</ul> : <p>No active intermediate types reported.</p>}<a href="http://127.0.0.1:8000/connectome/control-network" target="_blank" rel="noreferrer">Inspect complete controller network (JSON)</a></div><div><h3>Decision trace</h3><ol>{neural.trace.map((line,i) => <li key={i}>{line}</li>)}</ol><p className="muted">Deterministic explanation · no LLM.</p></div></div>
      <div className="neural-metrics"><span>Neural decisions <b>{m.neuralDecisions}</b></span><span>API mean / p95 <b>{m.meanApiMs.toFixed(1)} / {m.p95ApiMs.toFixed(1)} ms</b></span><span>Backend failures <b>{m.backendFailures}</b></span><span>New frontal fallbacks <b>{m.fallbacks} ({m.fallbackPercent.toFixed(1)}%)</b></span><span>Mean |L−R| <b>{m.meanAsymmetry.toFixed(4)}</b></span></div>
    </>}
    <details className="metrics-details" open><summary>Measured controller metrics</summary><p className="muted">Each mode keeps its own visited-cell coverage and counters. Switching preserves position and shared mission fog. Reset clears both modes. Turn count measures committed turn bouts, not frames. Stuck means less than 7 units traveled in a complete 10-second window.</p><div className="metrics-scroll"><table><thead><tr><th>Controller</th><th>Coverage</th><th>Distance</th><th>Turns</th><th>Blocked attempts</th><th>Stuck events</th><th>Simulated time</th></tr></thead><tbody>{(['rule-based','malecns'] as const).map(key => { const v = controllerMetrics[key]; return <tr key={key}><th>{key === 'malecns' ? 'MaleCNS' : 'Rule-Based'}</th><td>{v.coverage.toFixed(1)}%</td><td>{v.distance.toFixed(1)} u</td><td>{v.turns}</td><td>{v.blocked}</td><td>{v.stuck}</td><td>{v.elapsed.toFixed(1)} s</td></tr>; })}</tbody></table></div></details>
  </section>;
}
