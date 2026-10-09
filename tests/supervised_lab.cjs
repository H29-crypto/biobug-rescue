const assert=require('node:assert/strict');
const load=require('../scripts/compile_unified_lab.cjs')();
const m=load('supervised-lab/model');
const {SupervisedNeuralLoop}=load('supervised-lab/neural');
const {isPositionValid,canTravel}=load('simulation/collision');
const {CONTROL_MODEL}=load('simulation/neuralClient');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const tick=(s,n=1)=>{for(let i=0;i<n;i++)m.advanceSupervised(s,1/60);};
function response(stimulus){return {dataset:'MaleCNS',version:'v1.0',model:CONTROL_MODEL,stimulus,structural_unchanged:true,graph:{neurons:2,edges:1,structural_contacts:3,structural_sha256:'a'.repeat(64)},dna02:{L:{id:'523769',side_field:'somaSide',peak:.1},R:{id:'10360',side_field:'somaSide',peak:.03}},input_active:1,top_intermediate_types:[],evaluation_seconds:0,activity:{statistic:'peak-over-20-steps-from-rest',body_ids:['523769','10360'],values:[.1,.03]}};}
test('Contact probes respond only within their short geometric reach and preserve the legacy arena',()=>{
  const s=m.createSupervised();assert.deepEqual(s.contact,{left:0,front:0,right:0});s.sim.fly.position={x:194,y:240};m.observeContact(s);assert(s.contact.front>0&&s.contact.front<1);
  s.sim.fly.heading=Math.PI;m.observeContact(s);assert.equal(s.contact.front,0);
  assert.equal(load('virtual-fly/simulation').createFly({experiment:'front',mode:'rule-based',seed:2026,duration:30}).environment.obstacles.length,5);
});
test('Operator control suspends autonomy, accelerates gradually, rejects nonfinite inputs and releases on timeout',()=>{
  const s=m.createSupervised();m.setRunning(s,true);m.takeControl(s);m.steer(s,1,0);tick(s);assert.equal(s.speed,1.5);assert.throws(()=>m.steer(s,NaN,0));tick(s,90);assert.equal(s.speed,0);assert.equal(s.authority,'operator');m.resumeAutonomy(s);assert.equal(s.authority,'explore');
});
test('Held forward input cannot penetrate walls; body contact and feedback are reported',()=>{
  const s=m.createSupervised();m.setRunning(s,true);m.takeControl(s);let contact=false;
  for(let i=0;i<400;i++){m.steer(s,1,0);tick(s);contact ||= s.bodyContact;assert(isPositionValid(s.sim.environment,s.sim.fly.position,s.sim.fly.radius));}
  assert(contact);assert(s.sim.metrics.collisionAttempts>0);assert(s.sim.fly.position.x<198);assert.equal(s.sim.fly.velocity,0);assert(s.contact.front>.95);
});
test('Rear body collisions are reported separately and never fabricated as frontal feeler input',()=>{
  const s=m.createSupervised();s.sim.fly.position={x:42,y:240};m.setRunning(s,true);m.takeControl(s);
  for(let i=0;i<90;i++){m.steer(s,-1,0);tick(s);}assert(s.bodyContact);assert.equal(s.contact.front,0);m.transmit(s);assert(s.packet.bodyContact);
});
test('Known-arena waypoint planner routes around obstacles and reaches the requested goal',()=>{
  const s=m.createSupervised();assert(m.setWaypoint(s,{x:560,y:240}));assert(s.route.length>1);m.setRunning(s,true);
  for(let i=0;i<6000&&s.routeStatus!=='Waypoint reached.';i++){tick(s);assert(isPositionValid(s.sim.environment,s.sim.fly.position,s.sim.fly.radius));}
  assert.equal(s.routeStatus,'Waypoint reached.');assert(Math.hypot(s.sim.fly.position.x-560,s.sim.fly.position.y-240)<4);
  assert(!m.setWaypoint(s,{x:390,y:200}));assert.equal(s.authority,'waypoint');
});
test('Radio loss freezes copied telemetry, blocks commands and permits onboard exploration',()=>{
  const s=m.createSupervised();m.setRunning(s,true);tick(s,60);m.setLink(s,false);const packet=JSON.stringify(s.packet),position={...s.sim.fly.position};tick(s,120);
  assert.equal(JSON.stringify(s.packet),packet);assert.notDeepEqual(s.sim.fly.position,position);assert(!m.takeControl(s));assert(!m.setWaypoint(s,{x:600,y:400}));m.setLink(s,true);assert(s.packet.time>JSON.parse(packet).time);assert.notEqual(s.packet.position,s.sim.fly.position);
});
test('Radio loss and focus-release surrogate stop operator input; pause freezes all state',()=>{
  const s=m.createSupervised();m.setRunning(s,true);m.takeControl(s);m.steer(s,1,1);tick(s,12);m.setLink(s,false);const p={...s.sim.fly.position};tick(s,60);assert.deepEqual(s.sim.fly.position,p);m.setLink(s,true);m.steer(s,1,1);tick(s);m.release(s);assert.equal(s.angular,0);m.setRunning(s,false);const before=JSON.stringify(s);tick(s,100);assert.equal(JSON.stringify(s),before);
});
test('Radio connectivity alone never changes the autonomous body trajectory',()=>{
  const a=m.createSupervised(),b=m.createSupervised();m.setRunning(a,true);m.setRunning(b,true);
  for(let i=0;i<600;i++){if(i===70)m.setLink(b,false);if(i===230)m.setLink(b,true);tick(a);tick(b);}assert.deepEqual(a.sim.fly,b.sim.fly);assert.deepEqual(a.sim.path,b.sim.path);
});
test('Resume replans from the operator-adjusted pose instead of following stale route segments',()=>{
  const s=m.createSupervised();m.setWaypoint(s,{x:560,y:240});m.takeControl(s);s.sim.fly.position={x:560,y:380};assert(m.resumeAutonomy(s));let previous=s.sim.fly.position;for(const next of s.route){assert(canTravel(s.sim.environment,previous,next,s.sim.fly.radius));previous=next;}assert.equal(s.authority,'waypoint');
});
test('Fixed-step trajectories match for different frame batching and rendering does not mutate state',()=>{
  const a=m.createSupervised(),b=m.createSupervised();m.setRunning(a,true);m.setRunning(b,true);
  for(let i=0;i<600;i++){tick(a);const before=JSON.stringify(a);load('virtual-fly/embodimentModel').embodimentPose(a.sim);assert.equal(JSON.stringify(a),before);}
  for(let i=0;i<300;i++)m.advanceSupervised(b,1/30);
  assert.deepEqual(a.sim.fly,b.sim.fly);assert.deepEqual(a.sim.path,b.sim.path);assert.equal(a.sim.elapsed,b.sim.elapsed);
});
test('Operator takeover, pause, reset and disposal reject late neural responses',async()=>{
  for(const change of ['takeover','pause','reset','dispose']){
    const old=m.createSupervised('malecns');let current=old,resolve;m.setRunning(old,true);
    const loop=new SupervisedNeuralLoop(input=>new Promise(r=>resolve=()=>r(response(input))));const pending=loop.pump(old,()=>current);
    if(change==='takeover')m.takeControl(old);if(change==='pause')m.setRunning(old,false);if(change==='reset')current=m.createSupervised('malecns');if(change==='dispose')loop.dispose();resolve();await pending;
    assert.equal(old.history.samples.length,0);assert.equal(current.history.samples.length,0);loop.dispose();
  }
});
test('MaleCNS receives contact stimulus, exposes real response values and never blocks manual guidance',async()=>{
  const s=m.createSupervised('malecns');s.sim.fly.position={x:194,y:240};m.observeContact(s);m.setRunning(s,true);let sent;
  const loop=new SupervisedNeuralLoop(async input=>{sent={...input};return response(input);});await loop.pump(s,()=>s);assert.deepEqual(sent,s.contact);assert(sent.front>0);assert.equal(s.history.samples.length,1);assert.equal(s.history.value('523769'),.1);
  tick(s);assert.equal(s.source,'MaleCNS + engineering decoder');m.takeControl(s);m.steer(s,0,1);tick(s,30);assert.equal(s.history.samples.length,1);assert(s.sim.elapsed>.2);loop.dispose();
});
test('Malformed neural telemetry fails closed without inventing activity',async()=>{
  const s=m.createSupervised('malecns');m.setRunning(s,true);const loop=new SupervisedNeuralLoop(async input=>({...response(input),activity:{}}));await loop.pump(s,()=>s);assert(!s.sim.running);assert.equal(s.sim.neural.status,'offline');assert.equal(s.history.samples.length,0);m.takeControl(s);m.setRunning(s,true);m.steer(s,1,0);tick(s);assert(s.sim.fly.velocity>0);loop.dispose();
});
(async()=>{for(const [n,f]of tests){await f();console.log('PASS',n);}console.log(`${tests.length} supervised arena checks passed`);})().catch(e=>{console.error(e);process.exitCode=1;});
