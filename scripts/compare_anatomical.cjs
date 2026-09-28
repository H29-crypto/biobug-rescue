// Real backend, fixed physics ticks. Wall-clock timings are measured separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const load=require('./compile_virtual_fly.cjs')();
const {createFly,runFly,advanceFly,acceptFlyNeural,flyResult,FLY_STEP,flyNeuralDue}=load('virtual-fly/simulation');
const {DEFAULT_EXPERIMENT,EXPERIMENTS}=load('virtual-fly/experiments');
const {AnatomicalHistory,parseAnatomicalResponse}=load('virtual-fly/anatomicalTelemetry');
const {parseNeuralResponse}=load('simulation/neuralClient');
const {mapSensors}=load('simulation/sensorMapping');
const manifest=require('../public/malecns/manifest.json');
const {visibleNeuron}=load('virtual-fly/anatomyModel');
const times=[],evaluations=[],payloads=[];
async function trial(experiment,viewer,rich=true){const s=createFly({...DEFAULT_EXPERIMENT,mode:'malecns',experiment,duration:5}),history=new AnatomicalHistory();runFly(s,true);
while(!s.completed){if(flyNeuralDue(s)){const input=mapSensors(s.fly.sensors),start=performance.now();const http=await fetch(`http://127.0.0.1:8000/connectome/control?include_activity=${rich}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(10000)});assert(http.ok);const text=await http.text(),raw=JSON.parse(text);if(rich){times.push(performance.now()-start);evaluations.push(raw.evaluation_seconds*1000);payloads.push(Buffer.byteLength(text));}const response=rich?parseAnatomicalResponse(raw,input):parseNeuralResponse(raw,input);acceptFlyNeural(s,response,0);}
if(viewer){const before=JSON.stringify(s);history.observe(s);const selected=manifest.neurons[s.ticks%manifest.neurons.length];history.trace(selected.body_id);for(const n of manifest.neurons)visibleNeuron(n,'all',false,history.value(n.body_id));assert.equal(JSON.stringify(s),before);}
advanceFly(s,FLY_STEP);}return flyResult(s);}
const stats=a=>({samples:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:a.slice().sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1]});
(async()=>{const cases=[];for(const e of EXPERIMENTS){const off=await trial(e.id,false),on=await trial(e.id,true),legacy=await trial(e.id,false,false);assert.deepEqual(on,off);assert.deepEqual(legacy,off);cases.push({experiment:e.id,seconds:5,neural_updates:off.telemetry.length,viewer_off_on_exact:true,legacy_response_exact:true,result_sha256:crypto.createHash('sha256').update(JSON.stringify(off)).digest('hex')});console.log('PASS',e.id,'viewer OFF/ON and original response exactly equal');}
const report={source:'Live local MaleCNS v1.0 API; actual 295-neuron structural controller',scope:'Fixed-step production simulation + production viewer observer/filters/history; browser GPU rendering verified separately. Timing fields held at zero only for deterministic result comparison.',graph_sha256:manifest.graph_sha256,cases,neural_round_trip_ms:stats(times),evaluation_ms:stats(evaluations),response_bytes:stats(payloads)};fs.writeFileSync('docs/MALECNS_ANATOMICAL_VALIDATION.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
