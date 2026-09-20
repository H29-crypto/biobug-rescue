const assert=require('node:assert/strict');
const load=require('./compile.cjs')();
const {createSwarm,runSwarm,advanceSwarm,swarmSnapshot,switchSwarm,clearOfPeers}=load('swarm');
const {createSimulation,setRunning,advance,acceptNeural}=load('engine');
const {isPositionValid}=load('collision');
const {assignFrontiers}=load('frontiers');
const {SwarmNeuralLoop,parseBatch}=load('swarmNeuralLoop');
const {CONTROL_MODEL}=load('neuralClient');
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
function safe(s){
  for(const a of s.agents){assert(isPositionValid(a.simulation.environment,a.simulation.bug.position,7));
    for(const b of s.agents)if(a!==b)assert(Math.hypot(a.simulation.bug.position.x-b.simulation.bug.position.x,a.simulation.bug.position.y-b.simulation.bug.position.y)>=14.249999);
  }
}
const response=input=>({dataset:'MaleCNS',version:'v1.0',model:CONTROL_MODEL,stimulus:input.stimulus,structural_unchanged:true,
 graph:{neurons:295,edges:280,structural_contacts:2308,structural_sha256:'a'.repeat(64)},dna02:{L:{id:'523769',side_field:'somaSide',peak:.1},R:{id:'10360',side_field:'somaSide',peak:.1}},input_active:1,top_intermediate_types:[],evaluation_seconds:.001});
test('deploy 1–8 independent agents safely with one shared map',()=>{
  for(const n of [1,2,4,8]){const s=createSwarm(n);safe(s);assert.equal(new Set(s.agents.map(a=>a.simulation.bug.id)).size,n);
    assert.equal(new Set(s.agents.map(a=>a.simulation.memory)).size,n);assert.equal(new Set(s.agents.map(a=>a.simulation.decoder)).size,n);
    assert.equal(new Set(s.agents.map(a=>a.simulation.environment)).size,1);
  }
  for(const n of [0,9,1.5])assert.throws(()=>createSwarm(n));
});
test('single-agent mode reproduces the existing baseline',()=>{
  const swarm=createSwarm(1),single=createSimulation();runSwarm(swarm,true);setRunning(single,true);
  for(let i=0;i<1200;i++){advanceSwarm(swarm,1/60);advance(single,1/60);}
  assert.deepEqual(swarm.agents[0].simulation.bug,single.bug);assert.deepEqual(swarm.agents[0].simulation.environment.exploration,single.environment.exploration);
});
test('frontier assignments are distinct and do not use unseen geometry',()=>{
  const s=createSwarm(4),env=s.agents[0].simulation.environment,positions=s.agents.map(a=>a.simulation.bug.position);
  const plans=assignFrontiers(env,positions,7);const targets=plans.filter(Boolean).map(p=>p.target);
  assert(targets.length>1);assert.equal(new Set(targets).size,targets.length);
  const changed={...env,obstacles:[...env.obstacles,{id:'hidden',kind:'debris',x:600,y:80,width:50,height:50}]};
  assert.deepEqual(assignFrontiers(changed,positions,7),plans);
  for(const p of plans.filter(Boolean))for(const point of p.path){const index=Math.floor(point.y/20)*40+Math.floor(point.x/20);assert(env.exploration.explored[index]);}
});
test('swarm deterministic across frame rates and all agents remain separated',()=>{
  const run=hz=>{const s=createSwarm(4);runSwarm(s,true);for(let i=0;i<hz*20;i++){advanceSwarm(s,1/hz);safe(s);}return s;};
  const a=run(60),b=run(30);assert.deepEqual(a.agents,b.agents);assert.equal(a.elapsed,b.elapsed);
  assert(swarmSnapshot(a).explored>swarmSnapshot(createSwarm(4)).explored);
});
test('shared discoveries are monotonic and every agent sees the same fog',()=>{
  const s=createSwarm(8),env=s.agents[0].simulation.environment;let before=[...env.exploration.explored];runSwarm(s,true);
  for(let i=0;i<1200;i++){advanceSwarm(s,1/60);safe(s);assert(before.every((known,j)=>!known||env.exploration.explored[j]));before=[...env.exploration.explored];}
  assert(s.agents.reduce((n,a)=>n+a.novelCells,0)>0);
  assert.equal(env.survivors[0].status,'undetected');assert.equal(env.hazards[0].discovered,false);
});
test('peer collision guard rejects tunneling',()=>{
  const s=createSwarm(2),a=s.agents[0].simulation.bug,b=s.agents[1].simulation.bug;
  b.position={x:100,y:100};assert(!clearOfPeers({x:50,y:100},{x:150,y:100},a,[b]));assert(clearOfPeers({x:50,y:50},{x:150,y:50},a,[b]));
});
test('pause, switch, selection and reset retain or clear the intended state',()=>{
  const s=createSwarm(4);runSwarm(s,true);for(let i=0;i<120;i++)advanceSwarm(s,1/60);runSwarm(s,false);
  const before=JSON.stringify(s);advanceSwarm(s,1);assert.equal(JSON.stringify(s),before);
  const poses=s.agents.map(a=>({...a.simulation.bug.position})),fog=[...s.agents[0].simulation.environment.exploration.explored];
  const prior=swarmSnapshot(s);
  switchSwarm(s,'malecns');s.selected=2;assert.equal(swarmSnapshot(s).bug.id,'BioBug #3');
  assert.equal(swarmSnapshot(s).swarmMetrics.distance,prior.swarmMetrics.distance);
  assert.deepEqual(swarmSnapshot(s).agents.map(a=>a.ownCoverage),prior.agents.map(a=>a.ownCoverage));
  assert.deepEqual(s.agents.map(a=>a.simulation.bug.position),poses);assert.deepEqual(s.agents[0].simulation.environment.exploration.explored,fog);
  const reset=createSwarm(4);assert.equal(reset.elapsed,0);assert(reset.agents.every(a=>a.novelCells===0&&a.simulation.neural.response===null));
});
test('batch routing uses IDs, rejecting duplicate/missing/malformed responses',()=>{
  const inputs=[{id:'a',stimulus:{left:1,front:0,right:0}},{id:'b',stimulus:{left:0,front:0,right:1}}];
  const results=inputs.map(input=>({id:input.id,response:response(input)}));
  assert.deepEqual(parseBatch({results:[...results].reverse()},inputs),results.map(r=>r.response));
  assert.throws(()=>parseBatch({results:[results[0],results[0]]},inputs));
  assert.throws(()=>parseBatch({results:[results[0]]},inputs));results[1].response.dna02.R.peak=NaN;assert.throws(()=>parseBatch({results},inputs));
});
test('one batch controls all agents, world waits, stale reset result discarded',async()=>{
  let s=createSwarm(4);switchSwarm(s,'malecns');runSwarm(s,true);let resolve,calls=0;
  const loop=new SwarmNeuralLoop(inputs=>{calls++;return new Promise(r=>resolve=()=>r(inputs.map(response)));});
  const pending=loop.pump(s,()=>s);await loop.pump(s,()=>s);advanceSwarm(s,.1);assert.equal(s.elapsed,0);assert.equal(calls,1);
  resolve();await pending;for(let i=0;i<12;i++)advanceSwarm(s,1/60);assert(Math.abs(s.elapsed-.2)<1e-9);
  assert(s.agents.every(a=>a.simulation.metrics.malecns.neuralDecisions===1));
  const old=s,next=loop.pump(s,()=>s);s=createSwarm(4);resolve();await next;assert(s.agents.every(a=>!a.simulation.neural.response));assert.equal(old.batchRequests,2);loop.dispose();
});
test('batch failure pauses the entire swarm visibly',async()=>{
  const s=createSwarm(4);switchSwarm(s,'malecns');runSwarm(s,true);const loop=new SwarmNeuralLoop(async()=>{throw Error('offline');});
  await loop.pump(s,()=>s);assert.equal(s.running,false);assert.equal(s.batchFailures,1);assert(s.agents.every(a=>a.simulation.neural.status==='offline'&&!a.simulation.running));loop.dispose();
});
test('peer separation commitment prevents boundary arbitration chatter',()=>{
  const s=createSwarm(2,2026,false);switchSwarm(s,'malecns');
  s.agents[0].simulation.bug.position={x:100,y:300};s.agents[0].simulation.bug.heading=0;
  s.agents[1].simulation.bug.position={x:95,y:321};s.agents[1].simulation.bug.heading=0;
  runSwarm(s,true);
  for(let i=0;i<360;i++){
    if(i%12===0)for(let j=0;j<2;j++){
      const r=response({stimulus:{left:1,front:0,right:0}});r.dna02.L.peak=.3;r.dna02.R.peak=0;
      acceptNeural(s.agents[j].simulation,r,1);
      if(j===1)s.agents[j].simulation.neural.decision.command={forward:0,angular:0};
    }
    advanceSwarm(s,1/60);safe(s);
  }
  assert(s.agents[0].simulation.metrics.malecns.turns<30,'Should not reverse each physics frame at separation boundary');
});
(async()=>{for(const [name,fn]of tests){await fn();console.log(`PASS ${name}`);}console.log(`${tests.length} swarm checks passed.`);})().catch(e=>{console.error(e);process.exitCode=1;});
