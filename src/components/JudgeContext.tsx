import evidence from '../presentation/evidence.json';

export function MeasuredResults() {
  return <section className="measured-results card"><p className="eyebrow">MEASURED RESULTS / RECORDED EXPERIMENTS</p><h2>Two controllers, transparent results.</h2>
    <p>{evidence.single.seconds}-second single-agent averages · {evidence.single.seeds.length} seeds · historical navigation benchmark.</p>
    <div className="results-scroll"><table><thead><tr><th>Controller</th><th>Single-agent coverage</th><th>Both survivors</th><th>Rescue coverage at 60 s</th></tr></thead><tbody>{evidence.rescue.map(run => <tr key={run.mode}><th>{run.mode === 'rule-based' ? 'Rule-Based' : 'MaleCNS'}</th><td>{evidence.single.coverage[run.mode as keyof typeof evidence.single.coverage].toFixed(2)}%</td><td>{run.completedAt.toFixed(2)} s</td><td>{run.coverage.toFixed(2)}%</td></tr>)}</tbody></table></div>
    <p>Rescue results: 4 coordinated agents, seed 2026, one fixed map. Times are simulated time, not wall-clock performance. Earlier single-agent results use the pre-rescue benchmark.</p>
    <p>MaleCNS is an experimental research controller, not claimed to outperform conventional navigation.</p>
    <details><summary>Measurement provenance</summary>{evidence.sources.map(s => <p key={s}><code>{s}</code></p>)}<p>The presentation fixture is checked against these original reports by the test suite.</p></details>
  </section>;
}
export function JudgeContext() {
  return <section className="judge-context" aria-label="Project context">
    <details><summary>WHAT IS REAL?</summary><div className="truth-grid">
      <div><h3>REAL DATA</h3><p>MaleCNS structural connectome</p></div>
      <div><h3>REAL SOFTWARE</h3><p>Swarm simulation · Connectome processing · Neural dynamics engine · Rescue sensing simulation · AI Commander</p></div>
      <div><h3>SIMULATED</h3><p>BioBug bodies · Rescue environment · Life/gas sensors · Neural activity</p></div>
      <div><h3>FUTURE HARDWARE</h3><p>Insect-scale robotic or biohybrid platform. No physical deployment demonstrated.</p></div>
    </div></details>
    <details><summary>HOW IT WORKS</summary><div className="architecture" aria-label="System architecture">
      <div>Rescue environment</div><span>↓</span><div>BioBug sensors</div><span>↓</span><div>Navigation</div>
      <div className="architecture-branches"><div>Rule-Based<br/><span>Engineering navigation</span></div><div>MaleCNS<br/>↓<br/>Real connectome<br/>↓<br/>Simulated dynamics<br/>↓<br/>Engineering motor decoder</div></div>
      <span>↓</span><div>BioBug swarm → Shared rescue map</div><span>↓</span><div>AI Rescue Commander → Human operator</div>
    </div></details>
    <details><summary>WHY BIOBUG? / POTENTIAL APPLICATIONS</summary><div className="truth-grid"><div><h3>PLACES TO REACH</h3><p>Collapsed structures · Narrow tunnels · Underground infrastructure · Industrial inspection · Hazardous confined spaces</p></div><div><h3>POTENTIAL USERS</h3><p>Search-and-rescue teams · Firefighters · Disaster-response organizations · Industrial safety teams</p></div></div><p>Future applications to investigate; this prototype demonstrates simulated exploration and operator support.</p></details>
  </section>;
}
