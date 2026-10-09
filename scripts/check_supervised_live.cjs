// Requires the existing local MaleCNS backend. Never substitutes fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./compile_unified_lab.cjs')(),m=load('supervised-lab/model');
const {SupervisedNeuralLoop}=load('supervised-lab/neural');
const {requestAnatomical}=load('virtual-fly/anatomicalTelemetry');
async function trial(){
  const s=m.createSupervised('malecns');s.sim.fly.position={x:194,y:240};m.observeContact(s);m.setRunning(s,true);
  const loop=new SupervisedNeuralLoop();
  try{for(let i=0;i<120;i++){await loop.pump(s,()=>s);assert(s.sim.running,s.sim.neural.error);const before=s.sim.ticks;m.advanceSupervised(s,1/60);assert.equal(s.sim.ticks,before+1);}
    const samples=s.history.samples.length;assert.equal(samples,10);assert.equal(s.history.ids.length,295);
    m.takeControl(s);m.steer(s,0,1);for(let i=0;i<12;i++){await loop.pump(s,()=>s);m.advanceSupervised(s,1/60);}assert.equal(s.history.samples.length,samples);
    m.resumeAutonomy(s);await loop.pump(s,()=>s);assert.equal(s.history.samples.length,samples+1);
    return {position:s.sim.fly.position,heading:s.sim.fly.heading,time:s.sim.elapsed,path:s.sim.path,activity:s.history.samples,graph:s.sim.neural.response.graph};
  }finally{loop.dispose();}
}
(async()=>{
  const first=await trial(),second=await trial();assert.deepEqual(first,second);
  const probes=[];for(const stimulus of [{left:0,front:0,right:0},{left:0,front:1,right:0},{left:1,front:0,right:0}]){
    const response=await requestAnatomical(stimulus,AbortSignal.timeout(4000));probes.push({stimulus,left:response.dna02.L.peak,right:response.dna02.R.peak,active:response.activity.values.filter(v=>v>0).length});
  }
  const report={recorded_at:new Date().toISOString(),dataset:'MaleCNS v1.0',evaluations:25,graph:first.graph,identical_repeated_contact_trials:true,operator_suspends_neural_requests:true,resume_produces_new_sample:true,trial_simulated_seconds:first.time,contact_probes:probes,note:'Body input mapping and kinematics are engineering models. Probe comparisons measure this computational circuit, not biological validation.'};
  fs.writeFileSync('docs/SUPERVISED_LIVE_CHECK.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
