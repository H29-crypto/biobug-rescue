import { useState } from 'react';
import { EnvironmentCanvas } from './components/EnvironmentCanvas';
import { useSimulation } from './hooks/useSimulation';
import { isExplored } from './simulation/exploration';

export default function App() {
  const { environment, bug, explored, running, elapsed, toggle, reset } = useSimulation();
  const [reveal, setReveal] = useState(false);
  const [debug, setDebug] = useState(false);
  const survivorVisible = isExplored(environment, environment.survivors[0].position);
  const hazardVisible = isExplored(environment, environment.hazards[0].position);
  const resetMission = () => { reset(); setReveal(false); setDebug(false); };
  return <div className="app">
    <header><a className="brand" href="./"><span className="brand-icon">✳</span> BioBug<span>Rescue</span></a><div className="header-note">AUTONOMOUS SEARCH & RESCUE</div><span className="badge">SIMULATION / M02</span></header>
    <main>
      <div className="heading"><div><p className="eyebrow">MISSION CONTROL <span>/</span> EARTHQUAKE RESPONSE</p><h1>Into the unknown.</h1><p className="subtitle">Small explorers. A clearer picture. A better chance of rescue.</p></div><div className="status"><span/> {running ? 'Exploration active' : elapsed > 0 ? 'Mission paused' : 'Ready to deploy'}</div></div>
      <div className="workspace"><section className="map-panel" aria-labelledby="map-title">
        <div className="panel-heading"><div><span className="eyebrow">SECTOR 01</span><h2 id="map-title">Collapsed residential building</h2></div><span className="mono">TOP VIEW</span></div>
        <div className="map-toolbar"><span><i className="dot"/> {reveal ? 'Inspection view · all terrain' : 'Shared exploration view'}</span><button aria-pressed={reveal} onClick={() => setReveal(v => !v)}>{reveal ? 'Restore fog of war' : 'Inspect full map'}</button></div>
        <div className="simulation-controls"><button onClick={toggle}>{running ? 'Pause' : 'Start'}</button><button onClick={resetMission}>Reset</button><button aria-pressed={debug} onClick={() => setDebug(v => !v)}>Sensor rays {debug ? 'on' : 'off'}</button><span className="mono">{elapsed.toFixed(1)} s</span></div><EnvironmentCanvas environment={environment} bug={bug} reveal={reveal} debug={debug}/>
        <div className="legend"><span><i className="key wall"/>Wall</span><span><i className="key debris"/>Debris</span><span><i className="key fog"/>Unexplored</span><span className="green">＋ Possible survivor</span><span className="amber">△ Hazard</span></div>
      </section><aside>
        <section className="card"><p className="eyebrow">MISSION OVERVIEW</p><h2>Live exploration</h2><div className="coverage"><strong>{explored.toFixed(1)}<small>%</small></strong><span>accessible area explored</span></div><div className="progress"><div style={{width: `${explored}%`}}/></div><p className="muted">Coverage counts reachable free-space cells. Inspection does not change mission knowledge.</p><dl><div><dt>Visible survivor markers</dt><dd className="green">{survivorVisible ? '01' : '00'}</dd></div><div><dt>Visible hazard markers</dt><dd className="amber">{hazardVisible ? '01' : '00'}</dd></div><div><dt>BioBugs deployed</dt><dd>01</dd></div></dl></section>
        <section className="card inspector"><p className="eyebrow">BIOBUG INSPECTOR</p><h2>BioBug #1</h2><dl><div><dt>Status</dt><dd className="green">{bug.state}</dd></div><div><dt>Heading</dt><dd>{(bug.heading * 180 / Math.PI).toFixed(1)}°</dd></div><div><dt>Front sensor</dt><dd>{bug.sensors.frontDistance.toFixed(1)} u</dd></div><div><dt>Left sensor</dt><dd>{bug.sensors.leftDistance.toFixed(1)} u</dd></div><div><dt>Right sensor</dt><dd>{bug.sensors.rightDistance.toFixed(1)} u</dd></div><div><dt>Position (x, y)</dt><dd>{bug.position.x.toFixed(1)}, {bug.position.y.toFixed(1)}</dd></div></dl><p className="muted">Distances from body edge · range 85 u.<br/>Heading: 0° east, 90° south.</p></section>
        <section className="card"><p className="eyebrow">FIELD OBSERVATIONS</p>{!survivorVisible && !hazardVisible && <p className="muted">No markers in explored space yet.</p>}{survivorVisible &&<div className="observation"><span className="marker green">＋</span><div><h3>Possible survivor <small>S-01</small></h3><p>Scenario marker revealed by exploration.</p></div></div>}{hazardVisible && <div className="observation"><span className="marker amber">△</span><div><h3>Gas hazard <small>H-01</small></h3><p>Scenario marker revealed by exploration.</p></div></div>}<p className="muted">Marker visibility only; detection is not implemented.</p></section>
        <section className="stage"><span className="eyebrow">BUILD MILESTONE 02</span><h2>One bug. Real exploration.</h2><p>A rule-based explorer senses obstacles and reveals reachable space. Neural control and swarm coordination come later.</p><span className="stage-tag">AUTONOMOUS EXPLORATION</span></section>
      </aside></div>
      <footer><span>Bio-inspired research demo · Not a model of a real insect brain.</span><span>LOCAL SIMULATION <span className="green">●</span></span></footer>
    </main>
  </div>;
}

