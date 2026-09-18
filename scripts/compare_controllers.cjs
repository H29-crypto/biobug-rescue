// The same TS simulation/decoder as the browser, driven at fixed simulation boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('../tests/compile.cjs')();
const { createSimulation, switchController, setRunning, advance, neuralDue, acceptNeural, snapshot } = load('engine');
const { mapSensors } = load('sensorMapping');
const { parseNeuralResponse } = load('neuralClient');
async function requestNeural(stimulus, signal) {
  // Separate Node benchmarks can leave a pooled socket idle during baseline runs.
  // Close each connection explicitly so reuse cannot race the server's keepalive timeout.
  const result = await fetch('http://127.0.0.1:8000/connectome/control', { method:'POST', signal,
    headers:{'Content-Type':'application/json','Connection':'close'}, body:JSON.stringify(stimulus) });
  if (!result.ok) throw Error(`Connectome HTTP ${result.status}`);
  return parseNeuralResponse(await result.json(),stimulus);
}
const { isPositionValid } = load('collision');
const duration = Number(process.argv[2] || 120);
if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(duration*5)) throw Error('Duration must be 0.2–600 seconds, a multiple of 0.2');
const seeds = [2026,2027,2028,2029,2030];
async function run(mode, seed) {
  const s = createSimulation(seed); switchController(s,mode); setRunning(s,true);
  const started = performance.now();
  let graph;
  for (let tick=0; tick<Math.round(duration*60); tick++) {
    if (neuralDue(s)) {
      const start = performance.now();
      const result = await requestNeural(mapSensors(s.bug.sensors), AbortSignal.timeout(4000));
      graph = result.graph;
      acceptNeural(s,result,performance.now()-start);
    }
    advance(s,1/60);
    assert(isPositionValid(s.environment,s.bug.position,s.bug.radius),'collision invariant');
  }
  const metrics = snapshot(s).controllerMetrics[mode];
  assert(Math.abs(metrics.elapsed-duration)<1e-6);
  return { seed, mode, metrics, finalPosition: s.bug.position, finalHeading: s.bug.heading,
    wallSeconds: (performance.now()-started)/1000, graph };
}
(async () => {
  const runs = [];
  // Warm extraction once; measured decision latencies still include actual HTTP transport.
  const cold = performance.now();
  const warmup = await requestNeural({left:0,front:0,right:0},AbortSignal.timeout(15000));
  const coldRequestMs = performance.now()-cold;
  for (const seed of seeds) {
    for (const mode of ['rule-based','malecns']) {
      const result = await run(mode,seed), repeat = await run(mode,seed);
      const deterministic = r => ({ ...r.metrics, meanApiMs: 0, p95ApiMs: 0 });
      assert.deepEqual(deterministic(result),deterministic(repeat));
      assert.deepEqual(result.finalPosition,repeat.finalPosition); assert.equal(result.finalHeading,repeat.finalHeading);
      runs.push(result);
      console.log(`${mode} seed ${seed}: ${result.metrics.coverage.toFixed(2)}% coverage; ${result.metrics.blocked} blocked; ${result.metrics.neuralDecisions} neural decisions`);
    }
  }
  const averages = Object.fromEntries(['rule-based','malecns'].map(mode => {
    const selected = runs.filter(r=>r.mode===mode);
    const keys = ['coverage','distance','turns','blocked','stuck','neuralDecisions','fallbackPercent','meanApiMs','p95ApiMs','meanAsymmetry'];
    return [mode,Object.fromEntries(keys.map(key=>[key,selected.reduce((a,r)=>a+r.metrics[key],0)/selected.length]))];
  }));
  const report = { recordedAt: new Date().toISOString(), duration, seeds, graph: warmup.graph, model: warmup.model,
    semantics: '5 decisions/s simulated time; world held during requests; 20 abstract updates from rest, 3-step pulse, peak readouts; real HTTP; repetitions match all non-timing metrics and final pose.',
    latencyNote: 'Warm sequential loopback HTTP with a new connection for each request, including response validation. Average p95 is the mean of per-run p95 values, not pooled p95. Browser frame scheduling measured separately.',
    coldRequestMs, repeatedExactly: true, runs, averages };
  const output = path.resolve(__dirname,'../docs/MALECNS_CONTROLLER_COMPARISON.json');
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(averages,null,2)); console.log(output);
})().catch(error=>{console.error(error);process.exitCode=1;});
