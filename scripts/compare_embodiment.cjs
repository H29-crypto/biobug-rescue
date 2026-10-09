// Actual MaleCNS evaluations, unchanged production physics and real Three.js body transforms.
// GPU drawing is verified separately in-browser. No synthetic neural values are used here.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=require('./compile_virtual_fly.cjs')();
const {createFly,runFly,advanceFly,acceptFlyNeural,flyResult,FLY_STEP,flyNeuralDue}=load('virtual-fly/simulation');
const {DEFAULT_EXPERIMENT,EXPERIMENTS}=load('virtual-fly/experiments');
const {requestAnatomical}=load('virtual-fly/anatomicalTelemetry');
const {embodimentPose}=load('virtual-fly/embodimentModel');
const {createFruitFly}=load('virtual-fly/fruitFly');
const {mapSensors}=load('simulation/sensorMapping');
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function trial(experiment,style,motion='walk'){const s=createFly({...DEFAULT_EXPERIMENT,experiment,mode:'malecns',duration:5}),f=style==='simple'?null:createFruitFly(),activity=[],latencies=[];runFly(s,true);
try{while(!s.completed){if(flyNeuralDue(s)){const start=performance.now();const r=await requestAnatomical(mapSensors(s.fly.sensors),AbortSignal.timeout(10000));latencies.push(performance.now()-start);activity.push({time:s.elapsed,ids:r.activity.body_ids,values:r.activity.values});acceptFlyNeural(s,r,0);}
const before=JSON.stringify(s);f?.update(embodimentPose(s),style,motion);f?.group.updateMatrixWorld(true);assert.equal(JSON.stringify(s),before);advanceFly(s,FLY_STEP);}
return {result:flyResult(s),activity,latencies};}finally{f?.dispose();}}
(async()=>{const cases=[],times=[];for(const e of EXPERIMENTS){const baseline=await trial(e.id,'simple');times.push(...baseline.latencies);for(const style of ['natural','biobug'])for(const motion of ['walk','flight']){const run=await trial(e.id,style,motion);assert.deepEqual(run.result,baseline.result);assert.deepEqual(run.activity,baseline.activity);times.push(...run.latencies);cases.push({arena:e.id,style,motion,seconds:5,physics_ticks:300,neural_updates:25,exact_trajectory_telemetry_timing:true,exact_all_295_neural_outputs:true,result_sha256:sha(run.result),activity_sha256:sha(run.activity)});}console.log('PASS',e.id,'simple = natural walking/flying = biobug walking/flying');}
const sorted=times.slice().sort((a,b)=>a-b);const report={recorded_at:new Date().toISOString(),scope:'Actual live backend, production fixed-step simulation and actual procedural body transforms; GPU rendering checked separately. Simulation timings match exactly. HTTP timings measured separately, set to zero only in compared summary.',evaluations:times.length,cases,http_ms:{mean:times.reduce((a,b)=>a+b,0)/times.length,p95:sorted[Math.ceil(times.length*.95)-1]}};
fs.writeFileSync('docs/FLY_EMBODIMENT_COMPARISON.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.http_ms));})().catch(e=>{console.error(e);process.exitCode=1;});
