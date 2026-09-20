const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=require('../tests/compile.cjs')();
const {createSwarm,runSwarm,advanceSwarm,swarmSnapshot,switchSwarm}=load('swarm');
const {neuralDue}=load('engine');
const {isPositionValid}=load('collision');
const {SwarmNeuralLoop,parseBatch}=load('swarmNeuralLoop');
const duration=Number(process.argv[2]||60);
if(!Number.isFinite(duration)||duration<1||duration>300||!Number.isInteger(duration*5))throw Error('Duration must be 1–300 seconds in 0.2-second increments');
const scenarios=[{count:1,coordinated:false},{count:4,coordinated:false},{count:4,coordinated:true},{count:8,coordinated:true}];
let graph;
async function request(inputs,signal){
  const r=await fetch('http://127.0.0.1:8000/connectome/control-batch',{method:'POST',signal,headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({agents:inputs})});
  if(!r.ok)throw Error(`HTTP ${r.status}`);const results=parseBatch(await r.json(),inputs);graph=results[0].graph;return results;
}
async function run(mode,seed,scenario){
  const s=createSwarm(scenario.count,seed,scenario.coordinated),initial=swarmSnapshot(s).explored;
  switchSwarm(s,mode);runSwarm(s,true);const loop=new SwarmNeuralLoop(request),started=performance.now();
  for(let tick=0;tick<Math.round(duration*60);tick++){
    if(s.agents.some(a=>neuralDue(a.simulation))){await loop.pump(s,()=>s);assert(s.running,'Neural batch failed; comparison aborted');}
    advanceSwarm(s,1/60);
    for(let i=0;i<s.agents.length;i++){
      const a=s.agents[i].simulation;assert(isPositionValid(a.environment,a.bug.position,a.bug.radius));
      for(let j=i+1;j<s.agents.length;j++){const b=s.agents[j].simulation.bug;assert(Math.hypot(a.bug.position.x-b.position.x,a.bug.position.y-b.position.y)>=a.bug.radius+b.radius+.249999);}
    }
  }
  loop.dispose();const view=swarmSnapshot(s),metrics=s.agents.map(a=>a.simulation.metrics[mode]);
  const observed=s.agents.reduce((n,a)=>n+a.simulation.controllerExplored[mode].filter((v,i)=>v&&a.simulation.accessible[i]).length,0);
  const union=s.agents[0].simulation.environment.exploration.explored.filter((v,i)=>v&&s.agents[0].simulation.accessible[i]).length;
  assert(Math.abs(s.elapsed-duration)<1e-6);
  return {mode,seed,...scenario,initialCoverage:initial,coverage:view.explored,coverageGain:view.explored-initial,
    distance:view.swarmMetrics.distance,blockedAttempts:metrics.reduce((n,m)=>n+m.blocked,0),peerBlocks:view.swarmMetrics.peerBlocks,
    turns:metrics.reduce((n,m)=>n+m.turns,0),stuck:metrics.reduce((n,m)=>n+m.stuck,0),redundantObservationPercent:observed?100*(1-union/observed):0,
    neuralDecisions:metrics.reduce((n,m)=>n+m.neuralDecisions,0),batchRequests:s.batchRequests,batchFailures:s.batchFailures,
    meanBatchMs:view.swarmMetrics.meanBatchMs,p95BatchMs:view.swarmMetrics.p95BatchMs,wallSeconds:(performance.now()-started)/1000,
    poses:s.agents.map(a=>({id:a.simulation.bug.id,position:a.simulation.bug.position,heading:a.simulation.bug.heading})),
    novelCells:s.agents.map(a=>a.novelCells)};
}
(async()=>{
  const coldStart=performance.now();await request([{id:'warmup',stimulus:{left:0,front:0,right:0}}],AbortSignal.timeout(15000));const coldRequestMs=performance.now()-coldStart;
  const runs=[];
  for(const seed of [2026,2027,2028])for(const mode of ['rule-based','malecns'])for(const scenario of scenarios){
    const r=await run(mode,seed,scenario);
    if(seed===2026){const repeat=await run(mode,seed,scenario);const stable=({meanBatchMs,p95BatchMs,wallSeconds,...other})=>other;assert.deepEqual(stable(r),stable(repeat));}
    runs.push(r);console.log(`${mode} seed=${seed} n=${scenario.count} coordination=${scenario.coordinated}: ${r.coverage.toFixed(2)}% coverage, ${r.peerBlocks} peer holds, ${r.batchRequests} batches`);
  }
  const averages=[];
  for(const mode of ['rule-based','malecns'])for(const scenario of scenarios){const selected=runs.filter(r=>r.mode===mode&&r.count===scenario.count&&r.coordinated===scenario.coordinated);
    const values={};for(const key of ['initialCoverage','coverage','coverageGain','distance','blockedAttempts','peerBlocks','turns','stuck','redundantObservationPercent','neuralDecisions','batchRequests','meanBatchMs','p95BatchMs'])values[key]=selected.reduce((n,r)=>n+r[key],0)/selected.length;
    averages.push({mode,...scenario,...values});
  }
  const report={recordedAt:new Date().toISOString(),duration,seeds:[2026,2027,2028],graph,coldRequestMs,
    repeatedSeed2026Exactly:true,notes:'All runs use the same map and entry-area deployment; more agents reveal more initial cells. Coordination affects navigation only; local avoidance remains primary. Peer separation is on for independent and coordinated swarms. Real HTTP batches; fresh benchmark connections. Mean p95 values are averages of per-run percentiles, not pooled percentiles. No claim of swarm biological realism.',runs,averages};
  fs.writeFileSync(path.resolve(__dirname,'../docs/SWARM_COMPARISON.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(averages,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
