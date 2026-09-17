import { useState } from 'react';
import { EnvironmentCanvas } from './components/EnvironmentCanvas';
import { createEarthquakeEnvironment } from './scenarios/earthquake';

export default function App() {
  const [environment] = useState(createEarthquakeEnvironment);
  const [reveal, setReveal] = useState(false);
  const explored = Math.round(environment.exploration.explored.filter(Boolean).length / environment.exploration.explored.length * 100);
  return <div className="app">
    <header><a className="brand" href="./"><span className="brand-icon">✳</span> BioBug<span>Rescue</span></a><div className="header-note">AUTONOMOUS SEARCH & RESCUE</div><span className="badge">SIMULATION / M01</span></header>
    <main>
      <div className="heading"><div><p className="eyebrow">MISSION CONTROL <span>/</span> EARTHQUAKE RESPONSE</p><h1>Into the unknown.</h1><p className="subtitle">Small explorers. A clearer picture. A better chance of rescue.</p></div><div className="status"><span/> Environment ready</div></div>
      <div className="workspace"><section className="map-panel" aria-labelledby="map-title">
        <div className="panel-heading"><div><span className="eyebrow">SECTOR 01</span><h2 id="map-title">Collapsed residential building</h2></div><span className="mono">TOP VIEW</span></div>
        <div className="map-toolbar"><span><i className="dot"/> {reveal ? 'Inspection view · all terrain' : 'Shared exploration view'}</span><button aria-pressed={reveal} onClick={() => setReveal(v => !v)}>{reveal ? 'Restore fog of war' : 'Inspect full map'}</button></div>
        <EnvironmentCanvas environment={environment} reveal={reveal}/>
        <div className="legend"><span><i className="key wall"/>Wall</span><span><i className="key debris"/>Debris</span><span><i className="key fog"/>Unexplored</span><span className="green">＋ Possible survivor</span><span className="amber">△ Hazard</span></div>
      </section><aside>
        <section className="card"><p className="eyebrow">MISSION OVERVIEW</p><h2>Initial assessment</h2><div className="coverage"><strong>{explored}<small>%</small></strong><span>area explored</span></div><div className="progress"><div style={{width: `${explored}%`}}/></div><p className="muted">Seeded exploration mask for the first scene. Live exploration comes next.</p><dl><div><dt>Possible survivors</dt><dd className="green">01</dd></div><div><dt>Detected hazards</dt><dd className="amber">01</dd></div><div><dt>BioBugs deployed</dt><dd>00</dd></div></dl></section>
        <section className="card"><p className="eyebrow">FIELD OBSERVATIONS</p><div className="observation"><span className="marker green">＋</span><div><h3>Possible survivor <small>S-01</small></h3><p>Simulated signal near the west corridor.</p></div></div><div className="observation"><span className="marker amber">△</span><div><h3>Gas hazard <small>H-01</small></h3><p>Simulated gas pocket in the south passage.</p></div></div></section>
        <section className="stage"><span className="eyebrow">BUILD MILESTONE 01</span><h2>The environment comes first.</h2><p>Walls, debris, discoveries, and fog of war are in place. Agent movement and neural activity will arrive in later milestones.</p><span className="stage-tag">STATIC SCENE</span></section>
      </aside></div>
      <footer><span>Bio-inspired research demo · Not a model of a real insect brain.</span><span>LOCAL SIMULATION <span className="green">●</span></span></footer>
    </main>
  </div>;
}
