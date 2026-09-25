const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const load = require('./compile.cjs')();
const { createDemo, discoveryNotices, parseReadiness, canSelectController } = load('presentation');
const { createSwarm, runSwarm, advanceSwarm, swarmSnapshot, switchSwarm } = load('swarm');
const { CommanderClient } = load('commanderClient');
const { buildMissionSnapshot, systemSummary } = load('commanderSnapshot');
const evidence = require('../src/presentation/evidence.json');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
test('Presentation defaults use deterministic four-agent coordinated Rule-Based simulation', () => {
  const s = createDemo(); assert.equal(s.seed, 2026); assert.equal(s.agents.length, 4); assert(s.coordinated); assert(!s.running);
  assert(s.agents.every(a => a.simulation.mode === 'rule-based')); assert.equal(s.elapsed, 0);
});
test('Reset Demo factory clears a changed mission and restores identical initial state', () => {
  let s = createDemo(); const initial = swarmSnapshot(s); runSwarm(s, true);
  for (let i=0;i<600;i++) advanceSwarm(s,1/60);
  runSwarm(s,false); switchSwarm(s,'malecns'); s.coordinated=false;
  assert(s.rescue.events.length); s=createDemo(); assert.deepEqual(swarmSnapshot(s),initial);
});
test('Presentation uses unchanged simulation: complete 60-second parity and expected event timings', () => {
  const a=createDemo(), b=createSwarm(4,2026,true); runSwarm(a,true);runSwarm(b,true);
  for(let i=0;i<3600;i++){advanceSwarm(a,1/60);advanceSwarm(b,1/60);}
  assert.deepEqual(swarmSnapshot(a),swarmSnapshot(b));
  const run=evidence.rescue.find(r=>r.mode==='rule-based');
  assert(Math.abs(a.rescue.completedAt-run.completedAt)<1e-8);
  assert(Math.abs(swarmSnapshot(a).explored-run.coverage)<1e-8);
  assert(Math.abs(a.rescue.events.find(e=>e.type==='GAS HAZARD DETECTED').timestamp-run.firstHazard)<1e-8);
});
test('Discovery notices expose observed sectors only and distinguish second confirmation', () => {
  const s=createDemo(); assert.deepEqual(discoveryNotices(s.rescue.events),[]);runSwarm(s,true);
  for(let i=0;i<1800;i++)advanceSwarm(s,1/60);
  const notices=discoveryNotices(s.rescue.events);assert(notices.some(n=>n.title==='SECOND SURVIVOR CONFIRMED'));
  assert(notices.length<=3);assert(!JSON.stringify(notices).includes('Position'));
});
test('MaleCNS readiness validates loaded data and blocks unsafe controller switching', () => {
  for(const value of [null,{}, {loaded:false}, {...evidence.dataset,loaded:true,edges:NaN}])assert.equal(parseReadiness(value),null);
  const data={...evidence.dataset,loaded:true};assert.deepEqual(parseReadiness(data),data);
  for(const state of ['loading','unavailable'])assert(!canSelectController('malecns',false,state));
  assert(canSelectController('malecns',false,'ready'));assert(!canSelectController('malecns',true,'ready'));
  assert(canSelectController('rule-based',false,'unavailable'));
});
test('Technical numbers and comparison fixture exactly match original measured reports', () => {
  const status=require('../docs/MALECNS_API_STATUS.json');const comparison=require('../docs/MALECNS_CONTROLLER_COMPARISON.json');const rescue=require('../docs/RESCUE_EXPERIMENT.json');
  for(const k of Object.keys(evidence.dataset))assert.deepEqual(evidence.dataset[k],status[k]);
  for(const k of Object.keys(evidence.graph))assert.deepEqual(evidence.graph[k],comparison.graph[k]);
  for(const mode of ['rule-based','malecns'])assert.equal(evidence.single.coverage[mode],comparison.averages[mode].coverage);
  for(const row of evidence.rescue){const original=rescue.runs.find(r=>r.mode===row.mode&&r.count===4&&r.seed===2026);for(const k of Object.keys(row))assert.deepEqual(row[k],original[k]);}
});
test('Offline AI retains deterministic summary and never blocks mission',async()=>{
  const s=createDemo();runSwarm(s,true);const c=new CommanderClient(async()=>{throw Error('offline');});
  await c.ask(()=>buildMissionSnapshot(s),'Mission summary');assert(c.offline);
  assert(systemSummary(buildMissionSnapshot(s)).includes('0 survivors confirmed'));advanceSwarm(s,.1);assert(s.elapsed>0);c.dispose();
});
// Render actual React components server-side: effects do not make network requests.
const output=path.resolve('work/presentation-tests');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}');
function compile(dir){for(const e of fs.readdirSync(path.join('src',dir),{withFileTypes:true})){const rel=path.join(dir,e.name),out=path.join(output,rel);if(e.isDirectory()){fs.mkdirSync(out,{recursive:true});compile(rel);}else if(/\.tsx?$/.test(e.name)){fs.writeFileSync(out.replace(/\.tsx?$/,'.js'),ts.transpileModule(fs.readFileSync(path.join('src',rel),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText);}else fs.copyFileSync(path.join('src',rel),out);}}
compile('');require.extensions['.css']=()=>{};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
test('Actual opening view hides debug controls and undiscovered target markers',()=>{
  const App=require(path.join(output,'App.js')).default;const html=renderToStaticMarkup(React.createElement(App));
  for(const label of ['DEPLOY SWARM','4 BioBugs Ready','RESET DEMO','PRESENTATION MODE','TECHNICAL VIEW','SYSTEM SUMMARY'])assert(html.includes(label));
  for(const hidden of ['Inspect terrain','Sensor rays','S-01','S-02','H-01','H-02','Sector C2','Sector A2','pathway explorer'])assert(!html.includes(hidden),hidden);
});
test('Measured-results React view renders actual evidence without winner labels',()=>{
  const {MeasuredResults}=require(path.join(output,'components/JudgeContext.js'));const html=renderToStaticMarkup(React.createElement(MeasuredResults));
  for(const value of ['40.41','37.28','25.75','76.16','37.50','56.50'])assert(html.includes(value));assert(!html.includes('winner'));
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS',name);}console.log(`${tests.length} presentation checks passed`);})().catch(e=>{console.error(e);process.exitCode=1;});
