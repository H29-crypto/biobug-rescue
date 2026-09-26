import { useState } from 'react';
import Rescue3D from './components/Rescue3D';
import { CommanderPanel } from './components/CommanderPanel';
import { EnvironmentCanvas } from './components/EnvironmentCanvas';
import { PathwayExplorer } from './components/PathwayExplorer';
import { RescuePanel } from './components/RescuePanel';
import { ControllerPanel } from './components/ControllerPanel';
import { SwarmPanel } from './components/SwarmPanel';
import { JudgeContext, MeasuredResults } from './components/JudgeContext';
import { useSimulation } from './hooks/useSimulation';
import { useReadiness } from './hooks/useReadiness';
import { canSelectController, discoveryNotices } from './simulation/presentation';
import evidence from './presentation/evidence.json';
import './presentation.css';

export default function App() {
  const simulation = useSimulation();
  const { environment, running, elapsed, mode } = simulation;
  const readiness = useReadiness();
  const [technical, setTechnical] = useState(false);
  const [threeD, setThreeD] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [debug, setDebug] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<string | null>(null);
  const resetDemo = () => { simulation.resetDemo(); setThreeD(false); setTechnical(false); setReveal(false); setDebug(false); setSelectedDiscovery(null); };
  const notices = discoveryNotices(simulation.rescue.events);
  const opening = elapsed === 0 && !running;
  const blocked = mode === 'malecns' && readiness.state !== 'ready';
  const status = mode === 'malecns' && simulation.neural.status === 'offline' ? 'MALECNS OFFLINE · MISSION PAUSED'
    : mode === 'malecns' && simulation.neural.status === 'waiting' ? 'AWAITING NEURAL RESPONSE · MOTION HELD'
    : running ? 'MISSION ACTIVE' : elapsed > 0 ? 'MISSION PAUSED' : 'READY TO DEPLOY';
  const dataset = readiness.data ?? evidence.dataset;
  return <div className="app judge-app">
    <header><a className="brand" href="./"><span className="brand-icon">✳</span> BioBug<span>Rescue</span></a>
      <nav aria-label="Display mode"><button aria-pressed={!technical && !threeD} onClick={() => { setThreeD(false); setTechnical(false); setReveal(false); setDebug(false); }}>PRESENTATION MODE</button><button aria-pressed={technical} onClick={() => {setThreeD(false);setTechnical(true);}}>TECHNICAL VIEW</button><button aria-pressed={threeD} onClick={() => {setThreeD(true);setTechnical(false);setReveal(false);setDebug(false);}}>3D RESCUE VIEW</button></nav>
      <button className="reset-demo" onClick={resetDemo}>RESET DEMO</button></header>
    <main>
      <div className="judge-heading"><div><p className="eyebrow">SIMULATION PROTOTYPE / EARTHQUAKE RESPONSE</p><h1>{opening ? 'BIOBUG RESCUE' : 'Every discovery matters.'}</h1><p className="subtitle">Autonomous insect-scale exploration for places conventional robots struggle to reach.</p></div><span className="status">{status}</span></div>
      <section className="scorecard" aria-label="Mission scorecard">
        {[
          ['BIOBUGS', `${simulation.agents.length} / ${simulation.agents.length}`],
          ['AREA MAPPED', `${simulation.explored.toFixed(1)}%`],
          ['SURVIVORS', `${simulation.rescue.confirmed} / 2`],
          ['HAZARDS', `${simulation.rescue.hazards} / 2`],
          ['MISSION TIME', `${elapsed.toFixed(1)} s`],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <div className="judge-workspace"><section className="map-panel" aria-labelledby="map-title">
        <div className="panel-heading"><div><p className="eyebrow">COLLAPSED STRUCTURE SEARCH</p><h2 id="map-title">{opening ? `${simulation.agents.length} BioBugs Ready` : 'Shared rescue map'}</h2></div><button className="deploy-button" disabled={blocked && !running} onClick={simulation.toggle}>{running ? 'PAUSE MISSION' : elapsed ? 'RESUME MISSION' : 'DEPLOY SWARM'}</button></div>
        <div className="mission-config"><span>{mode === 'rule-based' ? 'Rule-Based' : 'MaleCNS experimental'} · {simulation.coordinated ? 'Coordinated' : 'Independent'} · Seed 2026</span><span>Simulation prototype</span></div>
        {threeD ? <Rescue3D key={simulation.missionRevision} environment={environment} agents={simulation.agents} selected={simulation.selected} discoveries={simulation.rescue.discoveries} elapsed={elapsed} running={running} onSelect={simulation.selectBug} onDiscovery={setSelectedDiscovery} resumeDisabled={blocked && !running} onToggle={simulation.toggle} onExit={() => setThreeD(false)}/> : <EnvironmentCanvas discoveries={simulation.rescue.discoveries} onDiscovery={setSelectedDiscovery} environment={environment} agents={simulation.agents} selected={simulation.selected} onSelect={simulation.selectBug} reveal={technical && reveal} debug={technical && debug}/>}
        <div className="legend"><span><i className="key wall"/>Walls</span><span><i className="key debris"/>Debris</span><span><i className="key fog"/>Unexplored</span><span className="green">? Life signal / + Confirmed</span><span className="amber">! Gas hazard</span></div>
      </section><aside className="judge-sidebar">
        <section className="discovery-feed card" aria-label="Discovery notifications"><p className="eyebrow">LIVE DISCOVERIES</p><div role="status" aria-live="polite" aria-atomic="true">{notices.length ? notices.map(n => <div className={`discovery-notice ${n.kind}`} key={`${n.time}-${n.title}-${n.sector}`}><strong>{n.title}</strong><span>Sector {n.sector} <small>{n.time.toFixed(2)} s</small></span></div>) : <p>Deploy the swarm to search for life signals and gas hazards. Locations appear only after sensing.</p>}</div></section>
        <CommanderPanel key={simulation.missionRevision} compact={!technical} getSnapshot={simulation.commanderSnapshot}/>
      </aside></div>
      {(blocked || simulation.neural.status === 'offline') && mode === 'malecns' && <p className="recovery" role="alert">MaleCNS is unavailable. Motion is held. Pause if needed and choose Rule-Based in Technical View, or RESET DEMO to restart the rescue presentation.</p>}
      <p className="mission-caption">Scenario objectives: 2 survivors and 2 gas hazards. Markers are sensor estimates; totals are demo objectives, not sensed knowledge. {simulation.rescue.completedAt !== null && <strong className="green">Both survivors confirmed at {simulation.rescue.completedAt.toFixed(2)} s.</strong>}</p>
      {technical && <section className="technical-section" aria-label="BioBug autonomy">
        <div className="technical-title"><div><p className="eyebrow">BIOBUG AUTONOMY</p><h2>Environment sensors → Controller → Movement</h2></div><span className={`readiness ${readiness.state}`} role="status">{readiness.state === 'ready' ? 'MALECNS READY' : readiness.state === 'loading' ? 'LOADING MALECNS...' : 'MALECNS UNAVAILABLE / STILL STARTING'}</span></div>
        <p className="muted">Backend startup may take several minutes. Readiness is checked every 5 seconds. Pause before switching controllers; switching retains mission progress. Reset Demo restores the default rescue configuration.</p>
        <div className="technical-controls"><div role="group" aria-label="Controller">{(['rule-based', 'malecns'] as const).map(m => <button key={m} aria-pressed={mode === m} disabled={!canSelectController(m, running, readiness.state)} onClick={() => { if (canSelectController(m, running, readiness.state)) simulation.selectController(m); }}>{m === 'rule-based' ? 'RULE-BASED' : 'MALECNS'}</button>)}</div>
          <label>BioBugs <select value={simulation.agents.length} disabled={running} onChange={e => { simulation.deploy(Number(e.target.value)); setSelectedDiscovery(null); }}>{[1, 2, 4, 8].map(n => <option key={n}>{n}</option>)}</select></label>
          <label><input type="checkbox" disabled={running} checked={simulation.coordinated} onChange={e => simulation.setCoordinated(e.target.checked)}/> Coordination</label>
          <button aria-pressed={reveal} onClick={() => setReveal(!reveal)}>Inspect terrain</button><button aria-pressed={debug} onClick={() => setDebug(!debug)}>Sensor rays</button>
        </div>
        <div className="structure-grid"><section className="card"><p className="eyebrow">REAL DATA / MALECNS {dataset.version}</p><h2>Real MaleCNS structure</h2><p>{dataset.neurons.toLocaleString('en-US')} selected neurons<br/>{dataset.edges.toLocaleString('en-US')} directed connections<br/>{dataset.synaptic_contacts.toLocaleString('en-US')} contacts</p><small>{readiness.data ? 'Live loaded backend counts' : 'Recorded dataset inspection · backend not ready'}</small></section>
          <section className="card"><p className="eyebrow">CONTROL SUBGRAPH / REAL DATA</p><h2>ProLN → intermediates → DNa02</h2><p>{(simulation.neural.response?.graph.neurons ?? evidence.graph.neurons).toLocaleString()} neurons<br/>{(simulation.neural.response?.graph.edges ?? evidence.graph.edges).toLocaleString()} edges<br/>{(simulation.neural.response?.graph.structural_contacts ?? evidence.graph.structural_contacts).toLocaleString('en-US')} contacts</p><small>{simulation.neural.response ? 'Latest actual controller response' : 'Recorded configured control graph · no live activity yet'}</small></section></div>
        <p className="science-note">MaleCNS-connectome-based computational controller: real structural connectivity with simulated neural dynamics. This is not a biologically accurate fly-brain simulation.</p>
        <ControllerPanel view={simulation}/><MeasuredResults/>
        <details className="advanced-tools"><summary>Advanced tools · agent telemetry, rescue evidence and pathway experiments</summary><SwarmPanel view={simulation} onSelect={simulation.selectBug}/><RescuePanel rescue={simulation.rescue} selected={selectedDiscovery} onSelect={setSelectedDiscovery} elapsed={elapsed} coverage={simulation.explored} count={simulation.agents.length} running={running}/><PathwayExplorer/></details>
      </section>}
      <JudgeContext/>
      <footer><span>Simulation prototype · Potential applications, no current hardware deployment.</span><span>HUMAN OPERATORS MAKE RESCUE DECISIONS</span></footer>
    </main>
  </div>;
}
