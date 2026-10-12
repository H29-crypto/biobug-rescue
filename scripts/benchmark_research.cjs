const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const load = require('../tests/compile.cjs')();
const { createResearchTrial, stepResearchTrial, researchTrialResult, summarizePairs, researchResultsCsv, EXPERIMENT_VERSION } = load('researchExperiment');
const args = process.argv.slice(2);
if (args.some(a => !['--quick', '--publish'].includes(a))) throw new Error('Usage: npm run benchmark:research -- [--quick] [--publish]');
if (args.includes('--quick') && args.includes('--publish')) throw new Error('Quick smoke runs cannot replace published evidence');
const quick = args.includes('--quick');
// Frozen before the first measured suite. Do not select seeds based on results.
const seeds = quick ? [2026] : [17, 42, 101, 2026, 9001];
const scenarios = ['residential', 'warehouse', 'corridors'];
const duration = quick ? 5 : 60, runs = [];
for (const scenario of scenarios) for (const seed of seeds) for (const planner of ['nearest', 'information']) {
  const trial = createResearchTrial({ scenario, seed, duration, count: 4 }, planner);
  while (!stepResearchTrial(trial, 600)) {}
  const result = researchTrialResult(trial); runs.push(result);
  console.log(`${scenario} / ${seed} / ${planner}: ${result.coverage.toFixed(2)}% mapped; ${result.confirmed}/2 model targets; ${result.completedAt ?? 'unfinished'} s`);
}
const sourceFiles = ['src/domain/types.ts', 'src/scenarios/earthquake.ts', 'src/scenarios/research.ts',
  ...fs.readdirSync('src/simulation').filter(f => f.endsWith('.ts')).sort().map(f => `src/simulation/${f}`),
  'scripts/benchmark_research.cjs'];
// Hash canonical text so the frozen evidence is reproducible across LF/CRLF checkouts.
const sha256 = Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n*$/, '\n')).digest('hex')]));
const report = {
  schema: EXPERIMENT_VERSION, generatedAt: new Date().toISOString(),
  sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: sha256, runtime: process.version,
  protocol: { scenarios, seeds, duration, count: 4, fixedStepHz: 60, observationIntervalSeconds: 1,
    controller: 'rule-based', comparison: 'nearest frontier versus marginal-information frontier',
    scenarioVersion: 'research-maps-v1', bootstrapResamples: 4000, bootstrapSeed: 2026,
    interval: '95% percentile bootstrap of paired coverage differences; seed-block resampling for pooled result',
    failurePolicy: 'Keep every run; unfinished completion time is null, never excluded or imputed.',
    studyType: 'Exploratory synthetic benchmark, not a held-out or hardware validation study.' },
  summaries: [...scenarios, 'all'].map(scenario => summarizePairs(runs, scenario)), runs,
};
fs.mkdirSync('work/research', { recursive: true });
fs.writeFileSync('work/research/benchmark.json', JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync('work/research/benchmark.csv', researchResultsCsv(runs));
if (args.includes('--publish')) {
  fs.mkdirSync('src/research', { recursive: true });
  fs.writeFileSync('src/research/benchmark.json', JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync('docs/RESEARCH_BENCHMARK.csv', researchResultsCsv(runs));
}
console.log(JSON.stringify(report.summaries, null, 2));
