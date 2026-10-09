// Real local backend only. This check never substitutes sample/fixture responses.
const assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./compile_unified_lab.cjs')();
const fly=load('virtual-fly/simulation'),{EXPERIMENTS,DEFAULT_EXPERIMENT}=load('virtual-fly/experiments');
const {FlyNeuralLoop}=load('virtual-fly/neuralLoop');
const {anatomyHistory,requestAnatomical}=load('virtual-fly/anatomicalTelemetry');
const {anatomyPresentation:present}=load('virtual-fly/anatomyPresentation');
const swarm=load('simulation/swarm'),{SwarmNeuralLoop}=load('simulation/swarmNeuralLoop');
const {RescueActivity,requestRescueActivity}=load('unified-lab/activity');
const supervised=load('supervised-lab/model'),{SupervisedNeuralLoop}=load('supervised-lab/neural');
const manifest=JSON.parse(fs.readFileSync('public/malecns/manifest.json','utf8'));
const cases=[];let evaluations=0;
function verify(s,h,r){
  const before=JSON.stringify({s,h}),p=present(s,h,manifest);
  assert.equal(p.status,'LIVE / SAMPLED');assert.equal(h.graph,manifest.graph_sha256);
  assert.deepEqual([...h.ids].sort(),manifest.neurons.map(n=>n.body_id).sort());
  assert.deepEqual(h.samples.at(-1).values,r.activity.values);
  for(const side of ['L','R'])assert.equal(p.values[r.dna02[side].id],r.dna02[side].peak);
  assert.equal(JSON.stringify({s,h}),before);evaluations++;
  return p.active;
}
(async()=>{
  const status=await fetch('http://127.0.0.1:8000/connectome/status').then(r=>r.json());assert(status.loaded);
  const warm=await requestAnatomical({left:0,front:1,right:0},AbortSignal.timeout(30000));
  for(const experiment of EXPERIMENTS){
    const s=fly.createFly({...DEFAULT_EXPERIMENT,experiment:experiment.id,mode:'malecns'}),h=anatomyHistory(s),loop=new FlyNeuralLoop(undefined,()=>0),active=[];fly.runFly(s,true);
    try{for(let tick=0;tick<60;tick++){await loop.pump(s,()=>s,()=>h.observe(s));assert(s.running,s.neural.error);if(tick%12===0)active.push(verify(s,h,s.neural.response));fly.advanceFly(s,1/60);}
      fly.runFly(s,false);assert.equal(present(s,h,manifest).status,'PAUSED / LAST SAMPLE');assert.equal(anatomyHistory(fly.createFly(s.config)).samples.length,0);
      cases.push({scene:'controlled',experiment:experiment.id,samples:h.samples.length,active_counts:active});
    }finally{loop.dispose();}
  }
  for(const count of [1,2,4,8]){
    const s=swarm.createSwarm(count),activity=new RescueActivity(),loop=new SwarmNeuralLoop(requestRescueActivity,()=>0);swarm.switchSwarm(s,'malecns');swarm.runSwarm(s,true);
    try{for(let tick=0;tick<36;tick++){await loop.pump(s,()=>s,()=>activity.observe(s));assert(s.running,s.agents[0].simulation.neural.error);if(tick%12===0)for(const a of s.agents){const sim=a.simulation;verify({config:{mode:sim.mode},running:s.running,elapsed:s.elapsed,neural:sim.neural,fly:{turning:sim.neural.decision.action}},activity.get(sim),sim.neural.response);}swarm.advanceSwarm(s,1/60);}
      assert.equal(new Set(s.agents.map(a=>activity.get(a.simulation))).size,count);
      cases.push({scene:'rescue',agents:count,samples_per_agent:s.agents.map(a=>activity.get(a.simulation).samples.length),separate_agent_histories:true});
    }finally{loop.dispose();}
  }
  const s=supervised.createSupervised('malecns'),loop=new SupervisedNeuralLoop();s.sim.fly.position={x:194,y:240};supervised.observeContact(s);supervised.setRunning(s,true);
  try{for(let tick=0;tick<36;tick++){await loop.pump(s,()=>s);assert(s.sim.running,s.sim.neural.error);if(tick%12===0)verify(s.sim,s.history,s.sim.neural.response);supervised.advanceSupervised(s,1/60);}
    const old=JSON.stringify(s.history.samples);supervised.takeControl(s);await loop.pump(s,()=>s);supervised.advanceSupervised(s,1/60);assert.equal(JSON.stringify(s.history.samples),old);assert.equal(present(s.sim,s.history,manifest,'',true).status,'HISTORICAL / OPERATOR');
    supervised.resumeAutonomy(s);await loop.pump(s,()=>s);verify(s.sim,s.history,s.sim.neural.response);
    cases.push({scene:'supervised',samples:s.history.samples.length,manual_history_held:true,resumed_live:true});
  }finally{loop.dispose();}
  const report={recorded_at:new Date().toISOString(),graph:warm.graph,verified_accepted_evaluations:evaluations,manifest_ids_match:true,read_only_presentation:true,cases,scope:'Real backend; production schedulers and accepted per-agent telemetry. Five controlled arenas, rescue 1/2/4/8 agents, supervised contact/manual/resume. UI rendering is checked separately.'};
  fs.writeFileSync('docs/ANATOMY_SCENE_CHECK.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

