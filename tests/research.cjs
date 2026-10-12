const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./compile.cjs')();
const { assignInformationFrontiers, observeNavigationMap, informationFootprint, planInformationFrontiers } = load('informationPlanner');
const { createResearchTrial, stepResearchTrial, researchTrialResult, summarizePairs, bootstrapMeanInterval,
  exportResearchReplay, researchResultsCsv, researchTerrain } = load('researchExperiment');
const { createResearchEnvironment, SCENARIOS } = require('../work/controller-tests/scenarios/research.js');
const { accessibleCells, cellCenter } = load('exploration');
const { isPositionValid, canTravel } = load('collision');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const config = { scenario: 'residential', seed: 2026, duration: 3, count: 4 };
function run(config, planner, batch = 60) {
  const trial = createResearchTrial(config, planner);
  while (!stepResearchTrial(trial, batch)) {}
  return trial;
}
test('Scenario seeds reproduce geometry and targets; all targets are reachable and separated from deployment', () => {
  for (const scenario of SCENARIOS) for (const seed of [0, 17, 2026, 0xffffffff]) {
    const a = createResearchEnvironment(scenario.id, seed), b = createResearchEnvironment(scenario.id, seed);
    assert.deepEqual(a, b); assert.notDeepEqual(a, createResearchEnvironment(scenario.id, (seed + 1) >>> 0));
    a.exploration.explored[0] = true; assert.equal(b.exploration.explored[0], false);
    const accessible = accessibleCells(a, 8);
    for (const target of [...a.survivors, ...a.hazards]) {
      const index = Math.floor(target.position.y / 20) * 40 + Math.floor(target.position.x / 20);
      assert(accessible[index]); assert(isPositionValid(a, target.position, 8));
      assert(Math.hypot(target.position.x - a.entry.x, target.position.y - a.entry.y) > 180);
    }
    assert.equal(a.obstacles.find(o => o.id === 'south').width, 720);
  }
});
test('Information policy cannot read hidden targets, unknown geometry or scoring reachability', () => {
  const trial = createResearchTrial(config, 'information'), env = trial.swarm.agents[0].simulation.environment;
  const positions = trial.swarm.agents.map(a => a.simulation.bug.position);
  const before = observeNavigationMap(env, positions, 7);
  const hidden = structuredClone(env); hidden.obstacles.push({ id: 'hidden', x: 650, y: 80, width: 30, height: 30, kind: 'wall' });
  Object.defineProperty(hidden, 'survivors', { get() { throw Error('Target truth accessed'); } });
  Object.defineProperty(hidden, 'hazards', { get() { throw Error('Hazard truth accessed'); } });
  const after = observeNavigationMap(hidden, positions, 7);
  assert.deepEqual(after, before); assert.deepEqual(planInformationFrontiers(after), planInformationFrontiers(before));
  assert.deepEqual(Object.keys(after).sort(), ['columns', 'rows', 'cellSize', 'known', 'free', 'links', 'starts'].sort());
});
test('Known walls block predicted information; empty and fully observed maps have no assignments', () => {
  const columns = 9, rows = 5;
  const known = Array.from({ length: columns * rows }, (_, i) => i % columns <= 4);
  const free = known.map((v, i) => v && i % columns < 4);
  const map = { columns, rows, cellSize: 20, known, free, links: known.map(() => []), starts: [21] };
  assert(!informationFootprint(map, 21).includes(23)); // wall at column 4 between col 3 and col 5
  assert.deepEqual(planInformationFrontiers({ ...map, known: known.map(() => true) }), [null]);
  assert.deepEqual(planInformationFrontiers({ ...map, starts: [] }), []);
});
test('Assignments reserve distinct reachable frontiers and marginal gain never exceeds total gain', () => {
  const trial = run({ ...config, duration: 8 }, 'information');
  const env = trial.swarm.agents[0].simulation.environment;
  const positions = trial.swarm.agents.map(a => a.simulation.bug.position);
  const plans = assignInformationFrontiers(env, positions, 7);
  const targets = plans.filter(Boolean).map(p => p.target);
  assert.equal(targets.length, new Set(targets).size); assert(targets.length > 0);
  plans.forEach((plan, i) => {
    if (!plan) return;
    assert(plan.marginalCells <= plan.expectedCells); assert(Number.isFinite(plan.utility));
    let previous = positions[i];
    for (const point of plan.path) {
      assert(canTravel(env, previous, point, 7));
      assert(env.exploration.explored[Math.floor(point.y / 20) * 40 + Math.floor(point.x / 20)]);
      previous = point;
    }
    assert.deepEqual(plan.path.at(-1), cellCenter(env, plan.target));
  });
});
test('Paired worlds have identical starts without mutable aliases', () => {
  const a = createResearchTrial(config, 'nearest'), b = createResearchTrial(config, 'information');
  assert.deepEqual(a.frames[0], b.frames[0]);
  assert.deepEqual(a.swarm.rescue.targets, b.swarm.rescue.targets);
  a.swarm.rescue.targets[0].groundTruthPosition.x = 0;
  a.swarm.agents[0].simulation.environment.obstacles[0].x = 0;
  assert.notEqual(b.swarm.rescue.targets[0].groundTruthPosition.x, 0);
  assert.notEqual(b.swarm.agents[0].simulation.environment.obstacles[0].x, 0);
});
test('Physics, observations and trajectory digests are independent of worker batch size', () => {
  for (const planner of ['nearest', 'information']) {
    const a = run(config, planner, 1), b = run(config, planner, 7), c = run(config, planner, 600);
    assert.deepEqual(researchTrialResult(a), researchTrialResult(b)); assert.deepEqual(a.frames, c.frames);
    assert.deepEqual(researchTrialResult(a), researchTrialResult(c));
    assert.equal(a.frames.length, config.duration + 1); assert.equal(a.frames.at(-1).time, config.duration);
    assert.equal(a.swarm.running, false);
  }
});
test('All environments preserve obstacle and peer separation with eight agents under both planners', () => {
  for (const scenario of SCENARIOS) for (const planner of ['nearest', 'information']) {
    const trial = createResearchTrial({ ...config, scenario: scenario.id, count: 8, duration: 4 }, planner);
    let done = false;
    while (!done) {
      done = stepResearchTrial(trial, 1);
      const agents = trial.swarm.agents;
      for (let i = 0; i < agents.length; i++) {
        const { bug, environment } = agents[i].simulation; assert(isPositionValid(environment, bug.position, bug.radius));
        for (let j = i + 1; j < agents.length; j++) {
          const peer = agents[j].simulation.bug;
          assert(Math.hypot(bug.position.x - peer.position.x, bug.position.y - peer.position.y) >= bug.radius + peer.radius + .249);
        }
      }
    }
  }
});
test('Exported observations are detached and contain no hidden mission truth', () => {
  const a = run(config, 'nearest'), b = run(config, 'information');
  const frames = { nearest: a.frames, information: b.frames };
  const report = exportResearchReplay(config, frames, [researchTrialResult(a), researchTrialResult(b)]);
  const json = JSON.stringify(report);
  for (const key of ['groundTruthPosition', 'targets', 'survivors', 'accessible']) assert(!json.includes(`"${key}"`));
  assert.deepEqual(researchTerrain(config).survivors, []); assert.deepEqual(researchTerrain(config).hazards, []);
  const x = a.swarm.agents[0].simulation.bug.position.x;
  a.frames.at(-1).agents[0].position.x = -100; assert.equal(a.swarm.agents[0].simulation.bug.position.x, x);
  assert.equal(researchTrialResult(a).completedAt, null);
  const csv = researchResultsCsv(report.runs); assert.equal(csv.trim().split('\n').length, 3);
  assert(!csv.includes('null')); assert(!csv.includes('NaN'));
});
test('Configuration rejects invalid or unbounded worker workloads and incomplete trial results', () => {
  for (const patch of [{ seed: -1 }, { seed: NaN }, { seed: 2 ** 32 }, { count: 1 }, { count: 9 }, { duration: 0 }, { duration: 181 }, { duration: 2.5 }, { scenario: 'invented' }]) {
    assert.throws(() => createResearchTrial({ ...config, ...patch }, 'nearest'));
  }
  assert.throws(() => createResearchTrial(config, 'invented'));
  const trial = createResearchTrial(config, 'nearest');
  assert.throws(() => stepResearchTrial(trial, 0)); assert.throws(() => researchTrialResult(trial), /unfinished/);
});
test('Paired statistics preserve incomplete missions and reject missing/duplicate/unbalanced pairs', () => {
  const fixture = researchTrialResult(run(config, 'nearest'));
  const runs = [17, 42].flatMap((seed, i) => ['nearest', 'information'].map(planner => ({ ...fixture,
    config: { ...config, seed }, planner, coverage: planner === 'nearest' ? 20 : 22 + i * 2,
    coverageAuc: planner === 'nearest' ? 10 : 12, completedAt: planner === 'information' && i === 0 ? 2 : null })));
  const stats = summarizePairs(runs);
  assert.equal(stats.deltaCoverage, 3); assert.equal(stats.deltaAuc, 2); assert.deepEqual(stats.bootstrap95, [2, 4]);
  assert.equal(stats.informationCompletions, 1); assert.equal(stats.baselineCompletions, 0); assert.equal(stats.pairs, 2);
  assert.throws(() => summarizePairs(runs.slice(1)), /both planners/);
  assert.throws(() => summarizePairs([...runs, runs[0]]), /Duplicate/);
  assert.throws(() => summarizePairs(runs.map((r, i) => i === 0 ? { ...r, config: { ...r.config, duration: 4 } } : r)), /protocols/);
  assert.throws(() => summarizePairs([...runs, ...runs.slice(0, 2).map(r => ({ ...r, config: { ...r.config, scenario: 'warehouse' } }))]), /same scenarios/);
  assert.equal(bootstrapMeanInterval([1]), null); assert.deepEqual(bootstrapMeanInterval([4, 4, 4]), [4, 4]);
  assert.deepEqual(bootstrapMeanInterval([-3, 5, 10]), bootstrapMeanInterval([-3, 5, 10]));
});
test('Recorded study has all 30 runs, verifiable source fingerprints and reproducible summaries', () => {
  const report = require('../src/research/benchmark.json');
  assert.equal(report.runs.length, 30);
  for (const summary of report.summaries) assert.deepEqual(summarizePairs(report.runs, summary.scenario), summary);
  for (const [file, expected] of Object.entries(report.sourceSha256)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex'), expected,
      `${file}: implementation changed; regenerate the research evidence with npm run benchmark:research -- --publish`);
  }
  const recorded = report.runs.find(r => r.planner === 'information' && r.config.scenario === 'residential' && r.config.seed === 2026);
  assert.deepEqual(researchTrialResult(run(recorded.config, recorded.planner)), recorded);
});
test('Worker pause/resume, invalid requests and restart never publish a partial pair as completed', () => {
  const filename = path.resolve('src/research/experiment.worker.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let timers = new Map(), next = 0; const messages = [], scope = {};
  vm.runInNewContext(code, { exports: {}, self: scope, require: () => load('researchExperiment'),
    postMessage: message => messages.push(message), setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id) });
  const send = data => scope.onmessage({ data });
  const tick = () => { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); };
  send({ type: 'start', config }); assert.equal(messages.length, 1); assert.equal(timers.size, 1);
  send({ type: 'pause' }); tick(); assert.equal(messages.length, 1); assert.equal(timers.size, 0);
  send({ type: 'resume' }); send({ type: 'resume' }); assert.equal(timers.size, 1); tick();
  assert.equal(messages.at(-1).frames.nearest.time, 1);
  send({ type: 'start', config: { ...config, duration: 1 } });
  assert.equal(timers.size, 1); assert.equal(messages.at(-1).frames.nearest.time, 0); tick();
  assert.equal(messages.at(-1).type, 'complete'); assert.equal(messages.at(-1).runs.length, 2);
  send({ type: 'start', config: { ...config, duration: 999 } }); assert.equal(messages.at(-1).type, 'error');
  assert.equal(timers.size, 0);
});
for (const [name, fn] of tests) { fn(); console.log('PASS', name); }
console.log(`${tests.length} research checks passed`);

