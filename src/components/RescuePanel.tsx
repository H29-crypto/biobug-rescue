import type { rescueView } from '../simulation/rescue';
import './rescue.css';
export const missionTime=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
interface Props { rescue:ReturnType<typeof rescueView>; selected:string|null; onSelect:(id:string)=>void; elapsed:number; coverage:number; count:number; running:boolean }
export function RescuePanel({rescue,selected,onSelect,elapsed,coverage,count,running}:Props) {
  const discovery=rescue.discoveries.find(d=>d.id===selected),latest=rescue.events.at(-1);
  return <section className="card rescue-panel" aria-label="Rescue mission">
    <p className="eyebrow">COLLAPSED STRUCTURE SEARCH · DEMO SEED 2026</p>
    <h2>{rescue.completedAt!==null?'MISSION OBJECTIVE COMPLETE':running?'MISSION ACTIVE':elapsed?'MISSION PAUSED':`${count} BioBugs Ready`}</h2>
    <p>Locate all survivors · Map hazards · Explore the structure</p>
    <div className="rescue-stats"><span><strong>{rescue.confirmed}</strong> survivors located</span><span><strong>{rescue.possible}</strong> possible life signals</span><span><strong>{rescue.hazards}</strong> hazards mapped</span><span><strong>{coverage.toFixed(1)}%</strong> area explored</span><span><strong>{missionTime(elapsed)}</strong> mission time</span><span><strong>{count} / {count}</strong> deployed · {running?'active':elapsed?'paused':'ready'}</span></div>
    {rescue.completedAt!==null&&<p className="green">All survivors located at {missionTime(rescue.completedAt)}. Exploration may continue.</p>}
    {latest&&<div className="rescue-notice" key={rescue.events.length}>{latest.type} · Sector {latest.sector} <small>{missionTime(latest.timestamp)} · {latest.bugId}</small></div>}
    <h3>Shared discoveries</h3>
    {!rescue.discoveries.length&&<p className="muted">No rescue signals detected. Terrain visibility does not reveal targets.</p>}
    <div className="discovery-list">{rescue.discoveries.map(d=><button key={d.id} aria-pressed={selected===d.id} onClick={()=>onSelect(d.id)}>{d.kind==='gas'?'☣':d.status==='confirmed'?'＋':'?'} {d.status.toUpperCase()} · Sector {d.sector}<small>Confidence {Math.round(d.confidence*100)}% · Priority {d.priority}/100</small></button>)}</div>
    {discovery&&<div className="discovery-detail"><h3>{discovery.kind==='life'?'Life signal':'Gas hazard'} · Sector {discovery.sector}</h3><dl>
      <div><dt>Status</dt><dd>{discovery.status}</dd></div><div><dt>Detected by</dt><dd>{discovery.detectedBy}</dd></div>
      <div><dt>Confirmed by ({discovery.confirmedBy.length})</dt><dd>{discovery.confirmedBy.join(', ')||'Awaiting sustained readings'}</dd></div>
      <div><dt>Observers</dt><dd>{discovery.observers.join(', ')}</dd></div><div><dt>Confidence</dt><dd>{Math.round(discovery.confidence*100)}%</dd></div>
      <div><dt>Estimated position</dt><dd>{discovery.estimatedPosition.x.toFixed(1)}, {discovery.estimatedPosition.y.toFixed(1)}</dd></div>
      <div><dt>First detected / latest</dt><dd>{missionTime(discovery.firstDetected)} / {missionTime(discovery.latestObservation)}</dd></div>
      <div><dt>Readings / peak signal</dt><dd>{discovery.observations} / {discovery.peakSignal.toFixed(2)}</dd></div>
    </dl></div>}
    <h3>Mission events</h3><ol className="mission-events">{rescue.events.slice().reverse().map((e,i)=><li key={rescue.events.length-i}><time>{missionTime(e.timestamp)}</time><span>{e.type} — Sector {e.sector}<small>{e.bugId} · confidence {Math.round(e.confidence*100)}%</small></span></li>)}</ol>
    <p className="muted">Software simulation of future insect-scale rescue sensing; no real survivor-detection hardware. Confidence and priority are engineering aids, not medical probabilities or rescue-team judgment. MaleCNS neural telemetry is separate.</p>
  </section>;
}
