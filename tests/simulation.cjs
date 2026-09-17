const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Compile only the pure simulation modules; no browser, runtime globals or app test hooks.
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'work', 'simulation-tests');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
for (const directory of ['domain', 'scenarios', 'simulation']) {
  fs.mkdirSync(path.join(output, directory), { recursive: true });
  for (const file of fs.readdirSync(path.join(root, 'src', directory)).filter(f => f.endsWith('.ts'))) {
    const source = fs.readFileSync(path.join(root, 'src', directory, file), 'utf8');
    fs.writeFileSync(path.join(output, directory, file.replace(/\.ts$/, '.js')), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
}
const { createSimulation, advance, setRunning, snapshot } = require(path.join(output, 'simulation/engine.js'));
const { isPositionValid, canTravel } = require(path.join(output, 'simulation/collision.js'));
const { rayDistance } = require(path.join(output, 'simulation/sensors.js'));
const { revealExploration, coverage, isExplored } = require(path.join(output, 'simulation/exploration.js'));
const { move } = require(path.join(output, 'simulation/movement.js'));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }

test('initial state, fog and unimplemented detection', () => {
  const s = createSimulation();
  assert.equal(s.running, false); assert.equal(s.bug.state, 'stopped');
  assert(coverage(s.environment, s.accessible) > 0 && coverage(s.environment, s.accessible) < 10);
  assert(!isExplored(s.environment, s.environment.survivors[0].position));
  assert(!isExplored(s.environment, s.environment.hazards[0].position));
  assert.equal(s.bug.controller, undefined);
});
test('circle collision rejects walls, debris, boundaries, and large steps', () => {
  const { environment: e } = createSimulation();
  assert(!isPositionValid(e, {x:45,y:200}, 7));
  assert(!isPositionValid(e, {x:150,y:140}, 7));
  assert(!isPositionValid(e, {x:3,y:300}, 7));
  assert(!canTravel(e, {x:220,y:300}, {x:290,y:300}, 7));
  assert(!canTravel(e, {x:100,y:140}, {x:200,y:140}, 7));
  assert(canTravel(e, {x:90,y:480}, {x:90,y:450}, 7));
});
test('ray distances find walls, debris and map boundaries', () => {
  const { environment: e } = createSimulation();
  assert(Math.abs(rayDistance(e, {x:90,y:300}, Math.PI, 85) - 34) < 1e-6);
  assert(Math.abs(rayDistance(e, {x:100,y:140}, 0, 85) - 25) < 1e-6);
  assert.equal(rayDistance({...e, obstacles:[]}, {x:10,y:10}, Math.PI, 85), 10);
});
test('line-of-sight fog does not reveal free cells through a wall', () => {
  const e = { id:'test',name:'test',width:100,height:100,entry:{x:10,y:50},survivors:[],hazards:[],obstacles:[{id:'wall',kind:'wall',x:40,y:0,width:10,height:100}],exploration:{columns:10,rows:10,cellSize:10,explored:Array(100).fill(false)}};
  revealExploration(e,{x:25,y:55});
  assert(isExplored(e,{x:35,y:55})); assert(!isExplored(e,{x:65,y:55}));
});
test('movement supports left/right rotation, stopping and collision rejection', () => {
  const s = createSimulation(), origin = {...s.bug.position}, heading = s.bug.heading;
  move(s.environment,s.bug,{forward:0,angular:-1},.1); assert(s.bug.heading < heading);
  move(s.environment,s.bug,{forward:0,angular:1},.1); assert(Math.abs(s.bug.heading-heading)<1e-8);
  assert.deepEqual(s.bug.position,origin);
  s.bug.position={x:230,y:300}; s.bug.heading=0;
  assert.equal(move(s.environment,s.bug,{forward:100,angular:0},1),false);
  assert.equal(s.bug.state,'blocked'); assert.deepEqual(s.bug.position,{x:230,y:300});
});
test('same simulated duration is independent of 30/60/144 Hz frames', () => {
  const run = hz => {const s=createSimulation();setRunning(s,true);for(let i=0;i<hz*20;i++)advance(s,1/hz);return s;};
  const baseline=run(60);
  for(const hz of [30,144]) {const s=run(hz);assert.deepEqual(s.bug,baseline.bug);assert.deepEqual(s.environment.exploration,baseline.environment.exploration);}
});
test('ten-minute run stays collision-free and makes exploration progress', () => {
  const s=createSimulation(), initial=coverage(s.environment,s.accessible);setRunning(s,true);
  let blocked=0, minimum=Infinity, maximum=0;
  for(let i=0;i<36000;i++) {
    advance(s,1/60); assert(isPositionValid(s.environment,s.bug.position,s.bug.radius));
    if(s.bug.state==='blocked') blocked++;
    for(const d of [s.bug.sensors.frontDistance,s.bug.sensors.leftDistance,s.bug.sensors.rightDistance]) assert(d>=0 && d<=85);
    minimum=Math.min(minimum,s.bug.sensors.frontDistance);maximum=Math.max(maximum,s.bug.sensors.frontDistance);
  }
  assert(blocked>0);assert(maximum-minimum>20);assert(coverage(s.environment,s.accessible)>initial+20);
  assert.equal(s.environment.survivors[0].status,'undetected'); assert.equal(s.environment.hazards[0].discovered,false);
  console.log(`  Coverage ${initial.toFixed(1)}% → ${coverage(s.environment,s.accessible).toFixed(1)}%; blocked/turning steps: ${blocked}`);
});
test('pause freezes time, sensors, position, controller and fog; reset is repeatable', () => {
  const s=createSimulation();setRunning(s,true);for(let i=0;i<600;i++)advance(s,1/60);setRunning(s,false);
  const before=JSON.stringify(s);advance(s,2);assert.equal(JSON.stringify(s),before);
  assert.deepEqual(snapshot(createSimulation()),snapshot(createSimulation()));
});
test('large frame gaps are clamped and do not teleport', () => {
  const s=createSimulation();setRunning(s,true);advance(s,600);assert(s.elapsed<=.101);
  assert(Math.hypot(s.bug.position.x-90,s.bug.position.y-480)<5);
});
console.log(`${passed} simulation checks passed.`);
