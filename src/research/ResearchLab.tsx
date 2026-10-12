import { useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS } from '../scenarios/research';
import type { ScenarioId } from '../scenarios/research';
import { PLANNERS, PLANNER_LABELS, exportResearchReplay, researchResultsCsv, researchTerrain, validateExperimentConfig } from '../simulation/researchExperiment';
import type { ExperimentConfig, ResearchFrame, TrialResult } from '../simulation/researchExperiment';
import type { PlannerMode } from '../simulation/swarm';
import type { WorkerCommand, WorkerUpdate } from './protocol';
import { RESEARCH_SOURCES } from './sources';
import { ResearchMap } from './ResearchMap';
import benchmark from './benchmark.json';
import './research.css';

const DEFAULT: ExperimentConfig = { scenario: 'residential', seed: 2026, duration: 60, count: 4 };
const emptyFrames = (): Record<PlannerMode, ResearchFrame[]> => ({ nearest: [], information: [] });
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CoverageChart({ frames, duration, cursor }: { frames: Record<PlannerMode, ResearchFrame[]>; duration: number; cursor: number }) {
  return <svg className="research-chart" viewBox="0 0 720 200" role="img" aria-label="Coverage over simulated time. Green is information gain; blue is nearest frontier.">
    {[0, 25, 50, 75, 100].map(value => <g key={value}><path d={`M42 ${170 - value * 1.5}H700`} stroke="#dce1d5"/>
      <text x="32" y={174 - value * 1.5} textAnchor="end" fill="#75836c" fontSize="10">{value}%</text></g>)}
    {PLANNERS.map(planner => <polyline key={planner} fill="none" stroke={planner === 'nearest' ? '#52768e' : '#527443'} strokeWidth="2.5"
      points={frames[planner].map(frame => `${42 + frame.time / duration * 658},${170 - frame.coverage * 1.5}`).join(' ')}/>)}
    <path d={`M${42 + cursor / duration * 658} 20V170`} stroke="#b09262" strokeDasharray="4 4"/>
    <text x="42" y="192" fill="#75836c" fontSize="11">0 s</text><text x="700" y="192" textAnchor="end" fill="#75836c" fontSize="11">{duration} simulated seconds</text>
  </svg>;
}

export default function ResearchLab() {
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT);
  const [seedText, setSeedText] = useState(String(DEFAULT.seed));
  const [status, setStatus] = useState<'ready' | 'running' | 'paused' | 'done' | 'error'>('ready');
  const [error, setError] = useState('');
  const [frames, setFrames] = useState(emptyFrames);
  const [runs, setRuns] = useState<TrialResult[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null), generation = useRef(0);
  const active = status === 'running' || status === 'paused';
  const terrain = useMemo(() => researchTerrain(config), [config]);
  const latest = frames.nearest.length - 1;
  const index = cursor === null ? latest : Math.min(cursor, latest);
  const currentTime = frames.nearest[index]?.time ?? 0;
  const overall = benchmark.summaries.find(s => s.scenario === 'all')!;
  useEffect(() => () => { generation.current++; worker.current?.terminate(); }, []);
  function reset() {
    generation.current++; worker.current?.terminate(); worker.current = null;
    setFrames(emptyFrames()); setRuns([]); setCursor(null); setStatus('ready'); setError('');
  }
  function updateConfig(change: Partial<ExperimentConfig>) { reset(); setConfig(previous => ({ ...previous, ...change })); }
  function start() {
    reset();
    try {
      if (!/^\d+$/.test(seedText)) throw new Error('Enter an integer seed from 0 to 4294967295.');
      const next = { ...config, seed: Number(seedText) }; validateExperimentConfig(next); setConfig(next);
      const id = generation.current;
      const instance = new Worker(new URL('./experiment.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      const fail = (message: string) => {
        if (id !== generation.current) return;
        setError(message); setStatus('error'); instance.terminate(); worker.current = null;
      };
      instance.onerror = () => fail('The experiment worker could not run. Reset and retry; the recorded study below remains available.');
      instance.onmessage = (event: MessageEvent<WorkerUpdate>) => {
        if (id !== generation.current) return;
        const message = event.data;
        if (message.type === 'frames') setFrames(previous => ({
          nearest: [...previous.nearest, message.frames.nearest], information: [...previous.information, message.frames.information],
        }));
        else if (message.type === 'complete') { setRuns(message.runs); setStatus('done'); instance.terminate(); worker.current = null; }
        else fail(message.message);
      };
      setStatus('running'); instance.postMessage({ type: 'start', config: next } satisfies WorkerCommand);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start'); setStatus('error'); }
  }
  function pauseResume() {
    if (!worker.current) return;
    const paused = status === 'running';
    worker.current.postMessage({ type: paused ? 'pause' : 'resume' } satisfies WorkerCommand);
    setStatus(paused ? 'paused' : 'running'); setCursor(null);
  }
  return <main className="research-page">
    <div className="research-topline"><a href="#">✳ BIOBUG <span>/ RESEARCH</span></a><a href="#rescue">Open rescue mission ↗</a></div>
    <section className="research-hero">
      <div><p className="research-eyebrow">COMPARATIVE STUDY / 01</p><h1>Coordinated<br/><em>exploration.</em></h1>
        <p>Compare two search strategies on identical terrain. Follow their decisions, replay the experiment, and examine the evidence.</p></div>
      <div className="research-study-stamp"><strong>{benchmark.runs.length}</strong><span>RECORDED TRIALS</span><p>3 environments · {benchmark.protocol.seeds.length} seeds<br/>4 agents · 60 simulated seconds</p><small>Exploratory software benchmark</small></div>
    </section>
    <section className="research-workbench" aria-labelledby="experiment-title">
      <div className="research-section-heading"><div><p className="research-eyebrow">01 / EXPERIMENT</p><h2 id="experiment-title">Exploration, compared.</h2></div>
        <span className={`research-status ${status}`} role="status">{status === 'running' ? 'COMPUTING LIVE' : status === 'done' ? 'COMPLETE · REPLAY READY' : status.toUpperCase()}</span></div>
      <form className="research-controls" onSubmit={event => { event.preventDefault(); if (!active) start(); }}>
        <label>Environment<select disabled={active} value={config.scenario} onChange={e => updateConfig({ scenario: e.target.value as ScenarioId })}>{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Seed<input aria-label="Experiment seed" disabled={active} inputMode="numeric" value={seedText} onChange={e => { reset(); setSeedText(e.target.value); }}/></label>
        <label>Duration<select disabled={active} value={config.duration} onChange={e => updateConfig({ duration: Number(e.target.value) })}>{[30, 60, 120].map(n => <option key={n} value={n}>{n} sim s</option>)}</select></label>
        <label>Agents<select disabled={active} value={config.count} onChange={e => updateConfig({ count: Number(e.target.value) })}>{[2, 4, 8].map(n => <option key={n}>{n}</option>)}</select></label>
        {active ? <button type="button" className="research-primary" onClick={pauseResume}>{status === 'running' ? 'Pause experiment' : 'Resume experiment'}</button> : <button className="research-primary" type="submit">{status === 'done' ? 'Run again ↗' : 'Run comparison ↗'}</button>}
        <button type="button" onClick={reset}>Reset</button>
      </form>
      {error && <p className="research-error" role="alert">{error}</p>}
      <p className="research-context">Same terrain, sensors and local controller. Different frontier assignments. All times are simulated.</p>
      <div className="research-maps">{PLANNERS.map((planner, i) => {
        const frame = frames[planner][index];
        return <section className={`research-map-card ${planner}`} key={planner} aria-label={PLANNER_LABELS[planner]}>
          <div className="research-map-heading"><div><span>{i === 0 ? 'A / BASELINE' : 'B / EXPERIMENTAL'}</span><h3>{PLANNER_LABELS[planner]}</h3></div><strong>{frame?.coverage.toFixed(1) ?? '—'}<small>% mapped</small></strong></div>
          <ResearchMap terrain={terrain} frame={frame} label={PLANNER_LABELS[planner]}/>
          <div className="research-map-footer"><span>{frame?.confirmed ?? 0}/2 model targets confirmed</span><span>{frame?.hazards ?? 0}/2 gas sources observed</span></div>
        </section>;
      })}</div>
      <div className="research-replay"><label htmlFor="replay-time">{cursor === null ? 'LATEST FRAME' : 'REPLAY'} <strong>{currentTime.toFixed(0)} s</strong></label>
        <input id="replay-time" type="range" min="0" max={Math.max(0, latest)} value={Math.max(0, index)} disabled={latest < 1 || status === 'running'} onChange={e => setCursor(Number(e.target.value))}/>
        <button disabled={latest < 0} onClick={() => setCursor(null)}>Latest</button>
      </div>
      <div className="research-analysis"><div><h3>Coverage over time</h3><CoverageChart frames={frames} duration={config.duration} cursor={currentTime}/></div>
        <div className="research-run-results"><p className="research-eyebrow">PAIRED RESULT</p>{runs.length === 2 ? <>
          <strong>{signed(runs[1].coverage - runs[0].coverage)} <small>percentage points</small></strong>
          <p>Information gain minus nearest frontier at {config.duration} s. One pair cannot establish general performance.</p>
          <p>Both model targets confirmed:<br/>A: {runs[0].completedAt === null ? 'unfinished' : `${runs[0].completedAt.toFixed(2)} s`} · B: {runs[1].completedAt === null ? 'unfinished' : `${runs[1].completedAt.toFixed(2)} s`}</p>
          <div className="research-downloads"><button onClick={() => download('biobug-replay.json', JSON.stringify(exportResearchReplay(config, frames, runs), null, 2), 'application/json')}>Export replay JSON</button>
            <button onClick={() => download('biobug-pair.csv', researchResultsCsv(runs), 'text/csv')}>Export CSV</button></div>
        </> : <p>Complete both runs to export measured results. Pause to inspect earlier frames; reset cancels the experiment.</p>}</div>
      </div>
      <p className="research-note">“Confirmed” means three consecutive strong readings under this abstract sensor model. It does not verify a person or survival. Hidden targets never appear on these maps before sensing.</p>
    </section>

    <section className="research-evidence" aria-labelledby="evidence-title"><div className="research-section-heading"><div><p className="research-eyebrow">02 / RESULTS</p><h2 id="evidence-title">The recorded study.</h2></div>
      <button onClick={() => download('biobug-benchmark.json', JSON.stringify(benchmark, null, 2), 'application/json')}>Download full study ↓</button></div>
      <p>Frozen suite: seeds {benchmark.protocol.seeds.join(', ')}. {overall.pairs} paired comparisons, including every unfinished mission. Recorded results below are separate from your live experiment.</p>
      <div className="research-table-wrap"><table><caption>60-second coverage and completion across five seeds per environment</caption><thead><tr><th scope="col">Environment</th><th scope="col">Nearest</th><th scope="col">Information</th><th scope="col">Difference · 95% interval</th><th scope="col">Complete A / B</th></tr></thead><tbody>
        {benchmark.summaries.map(row => <tr key={row.scenario}><th scope="row">{row.scenario === 'all' ? 'All environments' : SCENARIOS.find(s => s.id === row.scenario)?.name}</th><td>{row.baselineCoverage.toFixed(2)}%</td><td>{row.informationCoverage.toFixed(2)}%</td><td>{signed(row.deltaCoverage)} pp <small>{row.bootstrap95 ? `[${signed(row.bootstrap95[0])}, ${signed(row.bootstrap95[1])}]` : 'insufficient pairs'}</small></td><td>{row.baselineCompletions}/{row.pairs} · {row.informationCompletions}/{row.pairs}</td></tr>)}
      </tbody></table></div>
      <p className="research-note">Percentile bootstrap, 4,000 resamples. Pooled intervals resample seed blocks across all environments. Five seeds are a small sample; these intervals describe this synthetic suite, not field reliability. Coverage is the fraction of reachable grid cells observed.</p>
      <details className="research-method"><summary>Method, assumptions and reproduction</summary><div>
        <p>Utility = marginal unknown cells / (1 + shortest known path / sensing radius). Already reserved sensing footprints are discounted. Agent priority rotates. Local avoidance and physical collision checks retain authority.</p>
        <p>The map generator changes debris and hidden target placements. Both planners use independent copies of the same environment. Target locations and the reachable-cell scoring denominator are excluded from the information policy’s inputs.</p>
        <p>Assumptions: perfect agent pose, instantaneous map sharing, deterministic abstract sensing, rigid 2D obstacles, no localization drift, no biological variability. MaleCNS is a separate research controller and is not evaluated by this suite.</p>
        <p>Coverage AUC is a time average using one-second trapezoidal samples. Cross-agent overlap measures repeated map observations between agents, not repeated steps within one agent. Missing completion times remain null.</p>
        <code>npm run benchmark:research -- --publish</code><p>The export contains every run, paired summaries, protocol, runtime and SHA-256 source fingerprints.</p>
      </div></details>
    </section>
    <section className="research-literature" aria-labelledby="literature-title"><div className="research-section-heading"><div><p className="research-eyebrow">03 / BIBLIOGRAPHY</p><h2 id="literature-title">Selected literature.</h2></div><span>Verified 12 October 2026</span></div>
      <div className="research-source-grid">{RESEARCH_SOURCES.map(source => <article key={source.id}>
        <span className="research-source-tag">{source.index}</span><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3><small>{source.citation}</small>
        <p>{source.finding}</p><details><summary>Implementation & limitations</summary><dl><div><dt>In BioBug</dt><dd>{source.application}</dd></div><div><dt>Evidence boundary</dt><dd>{source.boundary}</dd></div></dl></details>
      </article>)}</div>
    </section>
    <footer className="research-footer"><span>Real software. Reproducible experiments. Explicit assumptions.</span><span>SOFTWARE PROTOTYPE / NO HARDWARE VALIDATION</span></footer>
  </main>;
}
