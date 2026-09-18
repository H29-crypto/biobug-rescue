const assert = require('node:assert/strict');
const load = require('./compile.cjs')();
const { mapSensors, proximity } = load('sensorMapping');
const { decodeMotor, createDecoder } = load('motorDecoder');
const { parseNeuralResponse, CONTROL_MODEL } = load('neuralClient');
const { NeuralLoop } = load('neuralLoop');
const { createSimulation, switchController, setRunning, advance, acceptNeural, snapshot } = load('engine');
const { isPositionValid } = load('collision');
const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const response = (stimulus={left:0,front:0,right:0}, L=.2, R=.05) => ({ dataset:'MaleCNS',version:'v1.0',model:CONTROL_MODEL,
  structural_unchanged:true,stimulus,graph:{neurons:295,edges:280,structural_contacts:2308,structural_sha256:'a'.repeat(64)},
  dna02:{L:{id:'523769',side_field:'somaSide',peak:L},R:{id:'10360',side_field:'somaSide',peak:R}},input_active:1,top_intermediate_types:[],evaluation_seconds:.001 });
const active = () => { const s=createSimulation();switchController(s,'malecns');setRunning(s,true);return s; };
const sensors = {leftDistance:85,frontDistance:85,rightDistance:85};
test('smooth bounded mapping preserves raw sensors and anatomical side',()=>{
  const s=createSimulation(), before={...s.bug.sensors};
  const distant=mapSensors({...before,leftDistance:85,rightDistance:85});
  const left=mapSensors({...before,leftDistance:2,rightDistance:85});
  const right=mapSensors({...before,leftDistance:85,rightDistance:2});
  assert(left.left>distant.left);assert.equal(left.right,0);assert(right.right>distant.right);assert.equal(right.left,0);
  assert.deepEqual(s.bug.sensors,before);assert.equal(proximity(-1),1);assert.equal(proximity(100),0);assert.throws(()=>proximity(NaN));
});
test('strong differentials steer away with screen-space orientation',()=>{
  const l=decodeMotor(.2,.05,{left:1,front:0,right:0},sensors,42,createDecoder());
  const r=decodeMotor(.05,.2,{left:0,front:0,right:1},sensors,42,createDecoder());
  assert.equal(l.action,'TURN_RIGHT');assert(l.command.angular>0);assert.equal(r.action,'TURN_LEFT');assert(r.command.angular<0);
});
test('front symmetry selects clearer side and seeded ties deterministically',()=>{
  const a=decodeMotor(.14,.14,{left:0,front:1,right:0},{...sensors,leftDistance:80,rightDistance:10},42,createDecoder());
  assert(a.fallback);assert.equal(a.action,'TURN_LEFT');assert.equal(a.command.forward,0);
  const tie=seed=>decodeMotor(.14,.14,{left:0,front:1,right:0},sensors,42,createDecoder(seed));
  assert.deepEqual(tie(42),tie(42));assert(tie(42).reason.includes('seeded'));
});
test('deadband and commitment prevent rapid reversal',()=>{
  const memory=createDecoder();
  for(const sign of [-1,1,-1,1])assert.equal(decodeMotor(.1+sign*.01,.1,{left:0,front:0,right:0},sensors,42,memory).action,'FORWARD');
  assert.equal(decodeMotor(.3,0,{left:1,front:0,right:0},sensors,42,memory).action,'TURN_RIGHT');
  assert.equal(decodeMotor(0,.3,{left:0,front:0,right:1},sensors,42,memory).action,'TURN_RIGHT');
  assert.equal(decodeMotor(0,.3,{left:0,front:0,right:1},sensors,42,memory).action,'TURN_RIGHT');
  assert.equal(decodeMotor(0,.3,{left:0,front:0,right:1},sensors,42,memory).action,'TURN_LEFT');
});
test('API contract validates exact stimulus, finite readouts, structure and anatomical sides',()=>{
  const input={left:0,front:0,right:0}, good=response(input);assert.deepEqual(parseNeuralResponse(good,input),good);
  for(const change of [r=>r.dna02.L.peak=NaN,r=>r.dna02.R.peak=2,r=>r.dna02.L.side_field='rootSide',r=>r.stimulus.left=.5,r=>r.structural_unchanged=false,r=>r.model='fake',r=>r.dna02.R.id=r.dna02.L.id]){
    const r=structuredClone(good);change(r);assert.throws(()=>parseNeuralResponse(r,input));
  }
  assert.throws(()=>parseNeuralResponse(null,input));
});
test('collision remains authoritative even over a forward neural proposal',()=>{
  const s=active();s.bug.position={x:230,y:300};s.bug.heading=0;
  acceptNeural(s,response(undefined,0,0),1);
  s.neural.decision.command.forward=1000;
  const before={...s.bug.position};advance(s,1/60);
  assert.deepEqual(s.bug.position,before);assert.equal(s.metrics.malecns.blocked,1);assert(isPositionValid(s.environment,s.bug.position,s.bug.radius));
});
test('no movement before response; precisely twelve physics steps per decision',()=>{
  const s=active();advance(s,.1);assert.equal(s.elapsed,0);
  acceptNeural(s,response(),1);
  for(let i=0;i<20;i++)advance(s,1/60);
  assert(Math.abs(s.elapsed-.2)<1e-9);assert(s.metrics.malecns.distance>0);assert.equal(s.metrics.malecns.neuralDecisions,1);
});
test('switch preserves position/fog while invalidating commands; reset clears state',()=>{
  const s=active();acceptNeural(s,response(),1);advance(s,.1);
  const pose={...s.bug.position}, fog=[...s.environment.exploration.explored];
  switchController(s,'rule-based');assert.deepEqual(s.bug.position,pose);assert.deepEqual(s.environment.exploration.explored,fog);
  assert.equal(s.neural.decision,null);advance(s,.1);assert(s.metrics['rule-based'].distance>0);
  const fresh=createSimulation();switchController(fresh,'malecns');assert.equal(fresh.metrics.malecns.neuralDecisions,0);assert.equal(fresh.decoder.hold,0);assert.equal(fresh.neural.response,null);
});
test('backend failure is visible and pauses without silent mode fallback',async()=>{
  const s=active(), loop=new NeuralLoop(async()=>{throw Error('offline fixture');});
  await loop.pump(s,()=>s);assert.equal(s.running,false);assert.equal(s.mode,'malecns');assert.equal(s.neural.status,'offline');assert(s.neural.error.includes('offline fixture'));assert.equal(s.metrics.malecns.backendFailures,1);loop.dispose();
});
test('one in-flight request, stale reset response rejected, subsequent run succeeds',async()=>{
  let resolve,calls=0;const loop=new NeuralLoop(input=>{calls++;return new Promise(r=>resolve=()=>r(response(input)));});
  let s=active();const old=s;const pending=loop.pump(s,()=>s);
  await loop.pump(s,()=>s);assert.equal(calls,1);
  loop.cancel();s=active();await loop.pump(s,()=>s);assert.equal(calls,1);
  resolve();await pending;assert.equal(s.neural.response,null);assert.equal(old.neural.response,null);
  const next=loop.pump(s,()=>s);resolve();await next;assert.equal(s.metrics.malecns.neuralDecisions,1);loop.dispose();
});
test('pause and mode switch reject in-flight responses',async()=>{
  for(const mutate of [s=>setRunning(s,false),s=>switchController(s,'rule-based')]){
    const s=active();let resolve;const loop=new NeuralLoop(input=>new Promise(r=>resolve=()=>r(response(input))));
    const pending=loop.pump(s,()=>s);mutate(s);resolve();await pending;
    assert.equal(s.neural.response,null);assert.equal(s.metrics.malecns.neuralDecisions,0);loop.dispose();
  }
});
test('turn and blocked counters represent events separately; latency quantile measured',()=>{
  const s=active();acceptNeural(s,response(),10);for(let i=0;i<12;i++)advance(s,1/60);
  acceptNeural(s,response(),30);for(let i=0;i<12;i++)advance(s,1/60);
  const m=snapshot(s).controllerMetrics.malecns;assert.equal(m.turns,1);assert.equal(m.blocked,0);assert.equal(m.meanApiMs,20);assert.equal(m.p95ApiMs,30);
});
test('request timeout visibly pauses and releases the scheduler',async()=>{
  const s=active();
  const loop=new NeuralLoop((_,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')))));
  await loop.pump(s,()=>s);
  assert.equal(s.running,false);assert.equal(s.neural.status,'offline');assert(s.neural.error.includes('4 seconds'));assert.equal(s.metrics.malecns.backendFailures,1);loop.dispose();
});
test('stuck windows count stalled translation, not ordinary turn frames',()=>{
  const s=active();
  for(let i=0;i<600;i++) {
    if(i%12===0) {acceptNeural(s,response(),1);s.neural.decision.command={forward:0,angular:1.9};}
    advance(s,1/60);
  }
  assert.equal(s.metrics.malecns.stuck,1);assert.equal(s.metrics.malecns.blocked,0);
});
(async()=>{for(const [name,fn] of tests){await fn();console.log(`PASS ${name}`);}console.log(`${tests.length} controller checks passed.`);})().catch(e=>{console.error(e);process.exitCode=1;});
