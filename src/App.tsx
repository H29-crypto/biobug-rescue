import { useState } from 'react';
import { EnvironmentCanvas } from './components/EnvironmentCanvas';
import { PathwayExplorer } from './components/PathwayExplorer';
import { useSimulation } from './hooks/useSimulation';
import { RescuePanel } from './components/RescuePanel';
import { ControllerPanel } from './components/ControllerPanel';
import { SwarmPanel } from './components/SwarmPanel';

export default function App() {
  const simulation = useSimulation();
  const { environment, bug, explored, running, elapsed, toggle, reset, mode, selectController } = simulation;
  const [reveal, setReveal] = useState(false);
  const [debug, setDebug] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<string|null>(null);
  const resetMission = () => { reset(); setReveal(false); setDebug(false); setSelectedDiscovery(null); };
  const missionStatus = mode === 'malecns' && simulation.neural.status === 'offline' ? 'CONNECTOME OFFLINE · paused'
    : mode === 'malecns' && simulation.neural.status === 'waiting' ? 'Waiting for connectome · motion held'
    : running ? 'MISSION ACTIVE' : elapsed > 0 ? 'Mission paused' : 'Ready to deploy';
  return <div className="app">
    <header><a className="brand" href="./"><span className="brand-icon">✳</span> BioBug<span>Rescue</span></a><div className="header-note">AUTONOMOUS SEARCH & RESCUE</div><span className="badge">SIMULATION / M05</span></header>
    <main>
      <div className="heading"><div><p className="eyebrow">MISSION CONTROL <span>/</span> EARTHQUAKE RESPONSE</p><h1>Into the unknown.</h1><p className="subtitle">Small explorers. A clearer picture. A better chance of rescue.</p></div><div className="status"><span/> {missionStatus}</div></div>
      <div className="mission-ticker" role="status">{simulation.rescue.completedAt!==null ? "MISSION OBJECTIVE COMPLETE" : simulation.rescue.events.at(-1)?.type ?? "COLLAPSED STRUCTURE SEARCH"}<span>{simulation.rescue.events.at(-1) ? `Sector ${simulation.rescue.events.at(-1)!.sector} / ` : ""}{simulation.rescue.confirmed} survivors located / {simulation.rescue.hazards} hazards mapped</span></div>
      <div className="workspace"><section className="map-panel" aria-labelledby="map-title">
        <div className="panel-heading"><div><span className="eyebrow">SECTOR 01</span><h2 id="map-title">Collapsed residential building</h2></div><span className="mono">TOP VIEW</span></div>
        <div className="map-toolbar"><span><i className="dot"/> {reveal ? 'Inspection view · all terrain' : 'Shared exploration view'}</span><button aria-pressed={reveal} onClick={() => setReveal(v => !v)}>{reveal ? 'Restore fog of war' : 'Inspect full map'}</button></div>
        <div className="controller-picker" role="group" aria-label="Controller"><span>Controller (all BioBugs)</span><button aria-pressed={mode === 'rule-based'} onClick={() => selectController('rule-based')}>Rule-Based</button><button aria-pressed={mode === 'malecns'} onClick={() => selectController('malecns')}>MaleCNS</button>{mode === 'malecns' && <small>Unsigned model · engineering motor decoder</small>}</div>
        <div className="deployment-controls"><label>Deployment (resets mission)<select aria-label="BioBug count" value={simulation.agents.length} disabled={running} onChange={e => { simulation.deploy(Number(e.target.value)); setReveal(false); setSelectedDiscovery(null); }} >{[1,2,4,8].map(n => <option key={n} value={n}>{n} BioBug{n > 1 ? 's' : ''}</option>)}</select></label><label><input type="checkbox" checked={simulation.coordinated} onChange={e => simulation.setCoordinated(e.target.checked)}/>Coordinated frontiers</label></div><div className="simulation-controls"><button onClick={toggle}>{running ? 'Pause' : elapsed ? 'Resume mission' : 'DEPLOY SWARM'}</button><button onClick={resetMission}>Reset</button><button aria-pressed={debug} onClick={() => setDebug(v => !v)}>Sensor rays {debug ? 'on' : 'off'}</button><span className="mono">{elapsed.toFixed(1)} s</span></div><EnvironmentCanvas discoveries={simulation.rescue.discoveries} onDiscovery={setSelectedDiscovery} environment={environment} agents={simulation.agents} selected={simulation.selected} onSelect={simulation.selectBug} reveal={reveal} debug={debug}/>
        <div className="legend"><span><i className="key wall"/>Wall</span><span><i className="key debris"/>Debris</span><span><i className="key fog"/>Unexplored</span><span className="green">＋ Possible survivor</span><span className="amber">△ Hazard</span></div>
      </section><aside>
        <section className="card"><p className="eyebrow">MISSION OVERVIEW</p><h2>Rescue mission</h2><div className="coverage"><strong>{explored.toFixed(1)}<small>%</small></strong><span>accessible area explored</span></div><div className="progress"><div style={{width: `${explored}%`}}/></div><p className="muted">Coverage counts reachable free-space cells. Inspection does not change mission knowledge.</p><dl><div><dt>Life signals</dt><dd className="green">{simulation.rescue.confirmed} confirmed / {simulation.rescue.possible} possible</dd></div><div><dt>Hazards detected</dt><dd className="amber">{simulation.rescue.hazards}</dd></div><div><dt>BioBugs deployed</dt><dd>{String(simulation.agents.length).padStart(2,'0')}</dd></div></dl></section>
        <section className="card inspector"><p className="eyebrow">BIOBUG INSPECTOR</p><h2>{bug.id}</h2><dl><div><dt>Status</dt><dd className="green">{bug.state}</dd></div><div><dt>Heading</dt><dd>{(bug.heading * 180 / Math.PI).toFixed(1)}°</dd></div><div><dt>Front sensor</dt><dd>{bug.sensors.frontDistance.toFixed(1)} u</dd></div><div><dt>Left sensor</dt><dd>{bug.sensors.leftDistance.toFixed(1)} u</dd></div><div><dt>Right sensor</dt><dd>{bug.sensors.rightDistance.toFixed(1)} u</dd></div><div><dt>Position (x, y)</dt><dd>{bug.position.x.toFixed(1)}, {bug.position.y.toFixed(1)}</dd></div></dl><p className="muted">Distances from body edge · range 85 u.<br/>Heading: 0° east, 90° south.</p></section>
        <section className="card"><p className="eyebrow">SELECTED BIOBUG / RESCUE PAYLOAD</p><h2>{simulation.rescue.reading.status}</h2><dl><div><dt>Life signal</dt><dd>{simulation.rescue.reading.life.toFixed(2)}</dd></div><div><dt>Gas signal</dt><dd>{simulation.rescue.reading.gas.toFixed(2)}</dd></div><div><dt>Hazard exposure</dt><dd>{simulation.rescue.reading.exposed?'HIGH GAS':'No strong gas reading'}</dd></div></dl><p className="muted">Simulated engineering sensors / 4 readings per second. Investigating means collecting evidence while navigation continues.</p></section>
        <section className="stage"><span className="eyebrow">BUILD MILESTONE 05</span><h2>Find signals. Share discoveries.</h2><p>Survivors require sustained strong life readings. Shared markers show estimated locations, never hidden target coordinates.</p><span className="stage-tag">SIMULATED RESCUE SENSING</span></section>
      </aside></div>
      <RescuePanel rescue={simulation.rescue} selected={selectedDiscovery} onSelect={setSelectedDiscovery} elapsed={elapsed} coverage={explored} count={simulation.agents.length} running={running}/><SwarmPanel view={simulation} onSelect={simulation.selectBug}/><p className="selected-telemetry-label">Selected agent: {bug.id} · local controller telemetry</p><ControllerPanel view={simulation}/><PathwayExplorer/>
      <footer><span>Bio-inspired research demo · Not a model of a real insect brain.</span><span>LOCAL SIMULATION <span className="green">●</span></span></footer>
    </main>
  </div>;
}
