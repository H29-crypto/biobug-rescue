import type { swarmSnapshot } from '../simulation/swarm';
import './swarm.css';
type View=ReturnType<typeof swarmSnapshot>;
export function SwarmPanel({view,onSelect}:{view:View;onSelect:(index:number)=>void}) {
  const m=view.swarmMetrics;
  return <section className="swarm-panel" aria-label="Swarm exploration"><p className="eyebrow">MILESTONE 4 · SHARED EXPLORATION</p><h2>One map. {view.agents.length} explorers.</h2>
    <p className="muted">{view.coordinated&&view.agents.length>1?'ENGINEERING SWARM COORDINATION · agents reserve distinct frontiers and route through revealed terrain.':'Independent local exploration · agents still share the map and avoid each other.'} Local obstacle avoidance takes priority. Radio sharing is instantaneous in this simulation.</p>
    <div className="swarm-totals"><span>Shared coverage <b>{view.explored.toFixed(1)}%</b></span><span>Total distance <b>{m.distance.toFixed(1)} u</b></span><span>Peer safety holds <b>{m.peerBlocks}</b></span><span>Neural batch requests <b>{m.batchRequests}</b></span><span>Batch mean / p95 <b>{m.meanBatchMs.toFixed(1)} / {m.p95BatchMs.toFixed(1)} ms</b></span><span>Batch failures <b>{m.batchFailures}</b></span></div>
    <div className="swarm-roster">{view.agents.map((a,i)=><button key={a.bug.id} className="agent-card" aria-pressed={view.selected===i} onClick={()=>onSelect(i)} style={{borderColor:view.selected===i?a.color:undefined}}>
      <strong style={{color:a.color}}>{a.bug.id} {view.selected===i?'· SELECTED':''}</strong><span>{a.bug.state} · {a.ownCoverage.toFixed(1)}% personal coverage</span><span>{a.distance.toFixed(1)} u · {a.novelCells} new shared cells</span><span>{a.target===null?'No frontier reservation':`Frontier cell ${a.target}`} · {a.neuralStatus}</span><small>{a.coordination}</small>
    </button>)}</div>
    <p className="muted">Select a BioBug here or on the map. Inspector and neural telemetry follow the selection. New-cell credit excludes deployment observations and uses rotating update priority; personal coverage can overlap. Survivor/hazard markers are visibility only—detection is Milestone 5.</p>
  </section>;
}
