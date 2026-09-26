const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const output=path.resolve('work/3d-tests');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}');
for(const name of ['model','insect','scene'])fs.writeFileSync(path.join(output,`${name}.js`),ts.transpileModule(fs.readFileSync(`src/rendering/rescue3d/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const {worldPose,gaitPhase,writeExploration,sceneEnvironment,visualRandom}=require(path.join(output,'model.js'));
const {createInsect}=require(path.join(output,'insect.js'));const THREE=require('three');
const load=require('./compile.cjs')(),{createSwarm,runSwarm,advanceSwarm,swarmSnapshot}=load('swarm');
const tests=[];function test(name,fn){tests.push([name,fn]);}
test('3D environment projection excludes and detaches hidden target data',()=>{const s=createSwarm();const e=s.agents[0].simulation.environment;const projected=sceneEnvironment(e);assert(!('survivors'in projected));assert(!('hazards'in projected));projected.entry.x=0;projected.obstacles[0].x=0;projected.exploration.explored[0]=true;assert.notEqual(e.entry.x,0);assert.notEqual(e.obstacles[0].x,0);assert.notEqual(e.exploration.explored[0],true);});
test('Simulation headings map correctly to Three X/Z space in all quadrants',()=>{for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const p=worldPose({position:{x:123,y:456},heading});const direction=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw);assert.equal(p.x,123);assert.equal(p.z,456);assert(Math.abs(direction.x-Math.cos(heading))<1e-10);assert(Math.abs(direction.z-Math.sin(heading))<1e-10);}});
test('Exploration texture matches observed cells and clears on reset',()=>{const data=new Uint8Array(12);assert(writeExploration(data,[true,false,true]));assert.deepEqual([...data],[255,255,255,255,0,0,0,255,255,255,255,255]);assert(!writeExploration(data,[true,false,true]));assert(writeExploration(data,[false,false,false]));assert.deepEqual([...data],[0,0,0,255,0,0,0,255,0,0,0,255]);});
test('Insect gait has six articulated legs, freezes at unchanged distance and alternates tripods',()=>{const bug=createInsect('#79d7ad');assert.equal(bug.legs.length,6);bug.update(20,true);const poses=bug.legs.map(l=>l.rotation.toArray());assert(bug.ring.visible);bug.update(20,false);assert.deepEqual(bug.legs.map(l=>l.rotation.toArray()),poses);assert(!bug.ring.visible);bug.update(23,true);assert.notDeepEqual(bug.legs.map(l=>l.rotation.toArray()),poses);assert.equal(Math.abs(gaitPhase(0,0,-1)-gaitPhase(0,0,1)),Math.PI);});
test('Decorative random stream is deterministic and isolated from mission state',()=>{const a=visualRandom(42),b=visualRandom(42);for(let i=0;i<100;i++)assert.equal(a(),b());const s=createSwarm(),before=JSON.stringify(s);for(let i=0;i<200;i++)a();assert.equal(JSON.stringify(s),before);});
// Exercise the real scene graph, transforms and lifecycle with only the GPU/DOM
// adapter stubbed. This is not a substitute for a WebGL/browser visual check.
let capturedScene,draw,renderer,resizeCallback;let disposedGeometry=0,disposedMaterial=0;
const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},clearRect(){}};
function canvas(){return {width:0,height:0,getContext:()=>ctx,setAttribute(){},addEventListener(){},removeEventListener(){},remove(){},getBoundingClientRect:()=>({left:0,top:0,width:960,height:640})};}
global.document={createElement:()=>canvas()};global.window={devicePixelRatio:1};global.ResizeObserver=class{constructor(fn){resizeCallback=fn;}observe(){}disconnect(){this.disconnected=true;}};global.requestAnimationFrame=fn=>{draw=fn;return 1;};global.cancelAnimationFrame=()=>{};
class FakeRenderer{constructor(){renderer=this;this.domElement=canvas();this.shadowMap={};}setPixelRatio(){}setSize(){}render(s){capturedScene=s;}dispose(){this.disposed=true;}forceContextLoss(){this.contextReleased=true;}}
class FakeControls{constructor(camera){this.target=new THREE.Vector3();this.camera=camera;}update(){}dispose(){}}
const Module=require('node:module');const sceneModule=new Module(path.join(output,'scene.js'),module);sceneModule.filename=path.join(output,'scene.js');sceneModule.paths=module.paths;sceneModule.require=id=>id==='three'?{...THREE,WebGLRenderer:FakeRenderer}:id.includes('OrbitControls')?{OrbitControls:FakeControls}:require(path.resolve(output,id));sceneModule._compile(fs.readFileSync(sceneModule.filename,'utf8'),sceneModule.filename);
const host={clientWidth:960,clientHeight:640,appendChild(){}};
test('Actual scene reads real snapshots without altering a 30-second mission or exposing targets',()=>{
  const a=createSwarm(),b=createSwarm();const scene=sceneModule.exports.createRescueScene(host,sceneEnvironment(a.agents[0].simulation.environment),()=>{},()=>{});
  let view=swarmSnapshot(a);scene.update({...view,discoveries:view.rescue.discoveries,explored:view.environment.exploration.explored});draw(performance.now()+50);
  assert(capturedScene);assert.equal(capturedScene.children.filter(x=>x.type==='Group').length,4);
  // Vertical wall dimensions must stay inside the real collision footprint.
  const walls=capturedScene.children.filter(x=>x.isMesh&&x.position.x===257&&x.position.z>=40&&x.position.z<210);assert(walls.some(w=>w.scale.x===14&&w.scale.z<=18));
  runSwarm(a,true);runSwarm(b,true);
  for(let i=0;i<1800;i++){advanceSwarm(a,1/60);advanceSwarm(b,1/60);if(i%6===0){view=swarmSnapshot(a);scene.update({...view,discoveries:view.rescue.discoveries,explored:view.environment.exploration.explored});}}
  assert.deepEqual(swarmSnapshot(a),swarmSnapshot(b));
  view=swarmSnapshot(a);scene.update({...view,discoveries:view.rescue.discoveries,explored:view.environment.exploration.explored});
  const groups=capturedScene.children.filter(x=>x.type==='Group');assert.equal(groups.length,4+view.rescue.discoveries.length);
  scene.dispose();assert(renderer.disposed);
});
test('Scene creates only observed estimate markers, handles camera changes and disposes GPU assets',()=>{
  const s=createSwarm();runSwarm(s,true);for(let i=0;i<1800;i++)advanceSwarm(s,1/60);const view=swarmSnapshot(s);
  const scene=sceneModule.exports.createRescueScene(host,sceneEnvironment(view.environment),()=>{},()=>{});
  scene.update({agents:view.agents,selected:view.selected,discoveries:view.rescue.discoveries,elapsed:view.elapsed,explored:view.environment.exploration.explored});draw(performance.now()+50);
  const groups=capturedScene.children.filter(x=>x.type==='Group');assert.equal(groups.length,4+view.rescue.discoveries.length);
  for(const d of view.rescue.discoveries)assert(groups.some(g=>g.position.x===d.estimatedPosition.x&&g.position.z===d.estimatedPosition.y));
  capturedScene.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>disposedGeometry++);if(o.material&&!Array.isArray(o.material))o.material.addEventListener('dispose',()=>disposedMaterial++);});
  scene.camera('follow');scene.zoom(.8);draw(performance.now()+100);scene.fog(false);scene.camera('overview');scene.home();resizeCallback();scene.dispose();assert(disposedGeometry>0);assert(disposedMaterial>0);assert(renderer.disposed);
});
for(const [name,fn]of tests){fn();console.log('PASS',name);}console.log(`${tests.length} 3D checks passed`);
