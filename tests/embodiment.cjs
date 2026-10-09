const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const THREE=require('three'),load=require('../scripts/compile_virtual_fly.cjs')();
const {createFruitFly}=load('virtual-fly/fruitFly');
const {embodimentPose,embodimentAnimation}=load('virtual-fly/embodimentModel');
const {createFly,runFly,advanceFly,flyResult,FLY_STEP}=load('virtual-fly/simulation');
const {DEFAULT_EXPERIMENT,EXPERIMENTS}=load('virtual-fly/experiments');
const tests=[];const test=(n,f)=>tests.push([n,f]);
function matrices(f){f.group.updateMatrixWorld(true);const out=[];f.group.traverse(o=>out.push(o.matrixWorld.toArray()));return out;}
test('All protected simulation, backend, Rescue, anatomy and fallback files retain original contents',()=>{for(const [file,hash]of Object.entries(require('../docs/FLY_EMBODIMENT_BASELINE.json').sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),hash,file);});
test('Visual snapshot detaches data and maps all four headings correctly',()=>{const s=createFly();for(const heading of [0,Math.PI/2,Math.PI,3*Math.PI/2]){s.fly.heading=heading;const p=embodimentPose(s),dir=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw);assert(Math.abs(dir.x-Math.cos(heading))<1e-12);assert(Math.abs(dir.z-Math.sin(heading))<1e-12);p.x=999;assert.equal(s.fly.position.x,110);}});
test('Shared body has six articulated legs, two wings, optional small hardware and bounded geometry',()=>{const f=createFruitFly(),p=embodimentPose(createFly());assert.equal(f.legs.length,6);assert.equal(f.wings.length,2);f.update(p,'natural');assert(!f.hardware.visible);const before=matrices(f);f.update(p,'biobug');assert(f.hardware.visible);assert.deepEqual(matrices(f),before);let triangles=0;const geometries=new Set();f.group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(o.geometry)geometries.add(o.geometry);});assert(triangles<50000);assert(geometries.size<30);f.dispose();});
test('Animation freezes on pause and waiting, advances only with sampled simulated time/distance',()=>{const s=createFly(),f=createFruitFly();runFly(s,true);for(let i=0;i<100;i++)advanceFly(s,FLY_STEP);f.update(embodimentPose(s),'natural');const frozen=matrices(f);runFly(s,false);for(let i=0;i<60;i++){advanceFly(s,FLY_STEP);f.update(embodimentPose(s),'natural');}assert.deepEqual(matrices(f),frozen);const p=embodimentPose(s);assert.deepEqual(embodimentAnimation(p),embodimentAnimation({...p,running:true,waiting:true}));f.update({...p,time:p.time+.2,distance:p.distance+3},'natural');assert.notDeepEqual(matrices(f),frozen);f.dispose();});
test('All five rule-based trajectories, telemetry and simulated timing match across styles and live switches',()=>{for(const e of EXPERIMENTS){const runs=[];for(const style of ['simple','natural','biobug','natural-flight','biobug-flight','switch']){const s=createFly({...DEFAULT_EXPERIMENT,experiment:e.id,duration:4}),f=createFruitFly();runFly(s,true);while(!s.completed){const before=JSON.stringify(s);if(style!=='simple')f.update(embodimentPose(s),style==='switch'?(s.ticks%2?'natural':'biobug'):style.split('-')[0],style.endsWith('flight')||(style==='switch'&&s.ticks%3)?'flight':'walk');assert.equal(JSON.stringify(s),before);advanceFly(s,FLY_STEP);}runs.push(flyResult(s));f.dispose();}for(const r of runs.slice(1))assert.deepEqual(r,runs[0],e.id);}});
test('Flight spreads wings, folds legs and raises only the display; pause and neural waits freeze every transform',()=>{
  const s=createFly(),f=createFruitFly();runFly(s,true);for(let i=0;i<40;i++)advanceFly(s,FLY_STEP);
  const p=embodimentPose(s),before=JSON.stringify(s);f.update(p,'natural','walk');const grounded=matrices(f);
  f.update(p,'natural','flight');assert(f.group.position.y>11);assert(f.wingSweep.visible);assert(Math.abs(f.wings[0].rotation.y)>1);const flight=matrices(f);
  assert.notDeepEqual(flight,grounded);assert.equal(JSON.stringify(s),before);
  runFly(s,false);f.update(embodimentPose(s),'natural','flight');assert.deepEqual(matrices(f),flight);
  f.update({...p,running:true,waiting:true,speed:0,moving:false},'natural','flight');assert.deepEqual(matrices(f),flight);
  f.update({...p,time:p.time+1/60},'natural','flight');assert.notDeepEqual(matrices(f),flight);
  f.update(p,'natural','walk');assert.deepEqual(matrices(f),grounded);assert(!f.wingSweep.visible);f.dispose();
});
test('Repeated body creation disposes every owned geometry and material once',()=>{const f=createFruitFly(),geometries=new Set(),materials=new Set();f.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});let g=0,m=0;for(const x of geometries)x.addEventListener('dispose',()=>g++);for(const x of materials)x.addEventListener('dispose',()=>m++);f.dispose();assert.equal(g,geometries.size);assert.equal(m,materials.size);});
test('Actual scene copies pose input, keeps camera changes visual, and releases renderer resources',()=>{
  // Real Three.js scene/model; only browser GPU and DOM adapters are stubbed.
  const path=require('node:path'),Module=require('node:module');let draw,renderer,rendered,disconnected=false;
  global.window={devicePixelRatio:1};global.requestAnimationFrame=fn=>{draw=fn;return 1;};global.cancelAnimationFrame=()=>{};
  global.ResizeObserver=class{observe(){}disconnect(){disconnected=true;}};
  class Renderer{constructor(){renderer=this;this.domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};this.info={render:{calls:0,triangles:0}};}setPixelRatio(){}setClearColor(){}setSize(){}render(scene){rendered=scene;}dispose(){this.disposed=true;}forceContextLoss(){this.released=true;}}
  class Controls{constructor(){this.target=new THREE.Vector3();}update(){}dispose(){}}
  const filename=path.resolve('work/virtual-fly-runtime/virtual-fly/embodimentScene.js');
  const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
  mod.require=id=>id==='three'?{...THREE,WebGLRenderer:Renderer}:id.includes('OrbitControls')?{OrbitControls:Controls}:require(path.resolve(path.dirname(filename),id));
  mod._compile(fs.readFileSync(filename,'utf8'),filename);
  const s=createFly(),before=JSON.stringify(s),pose=embodimentPose(s),arena={width:720,height:480,obstacles:s.environment.obstacles.map(o=>({...o}))};
  const view=mod.exports.createEmbodimentScene({clientWidth:600,clientHeight:390,appendChild(){}},arena,pose,()=>{},()=>{});
  view.update(pose,'natural');pose.x=999;draw(performance.now()+100);assert.equal(rendered.getObjectByName('illustrative-fruit-fly').position.x,110);
  view.preset('overview');draw(performance.now()+200);view.preset('follow');view.update(embodimentPose(s),'biobug');draw(performance.now()+300);
  assert.equal(JSON.stringify(s),before);assert(rendered.getObjectByName('lightweight-instrumentation').visible);
  view.dispose();assert(renderer.disposed&&renderer.released&&disconnected);
});
for(const [name,fn]of tests){fn();console.log('PASS',name);}console.log(`${tests.length} embodiment checks passed`);
