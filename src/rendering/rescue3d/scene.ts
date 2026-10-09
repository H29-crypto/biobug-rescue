import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createInsect } from './insect';
import { ReceivedMotionPlayback, visualRandom, worldPose, writeExploration } from './model';
import type { CameraMode, SceneEnvironment, SceneFrame } from './model';

export interface RescueScene {
  update:(frame:SceneFrame)=>void;
  camera:(mode:CameraMode)=>void;
  home:()=>void;
  zoom:(factor:number)=>void;
  fog:(enabled:boolean)=>void;
  dispose:()=>void;
}
export interface MissionVisual { group:THREE.Group; update:(distance:number,selected:boolean,frame:SceneFrame,index:number)=>void }
export interface RescueVisualOptions { createAgent?:(color:string)=>MissionVisual; followHeight?:()=>number; compactLabels?:boolean; isPicking?:()=>boolean; onDestination?:(point:{x:number;y:number})=>void }
/** This renderer owns only visual state. It cannot advance physics; destination callbacks carry operator input only. */
export function createRescueScene(host:HTMLDivElement,env:SceneEnvironment,onSelect:(index:number)=>void,onFailure:()=>void,visualOptions:RescueVisualOptions={}):RescueScene {
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.domElement.setAttribute('aria-label','Interactive 3D rescue scene. Drag to orbit and scroll to zoom. Select a BioBug using the buttons below.');
  renderer.domElement.setAttribute('role','img');
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0b1319');scene.fog=new THREE.FogExp2('#0b1319',.00048);
  const camera=new THREE.PerspectiveCamera(43,1,1,3200);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI*.46;controls.minDistance=45;controls.maxDistance=2000;controls.enablePan=true;
  const hemisphere=new THREE.HemisphereLight(0xc4e4ed,0x555141,2.7);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xffe2af,3.5);sun.position.set(100,650,-200);sun.target.position.set(400,0,280);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-650,right:650,top:650,bottom:-650,near:1,far:1400});sun.shadow.bias=-.0005;sun.shadow.normalBias=.6;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0x79c8ee,1.5);fill.position.set(800,200,600);scene.add(fill);
  const exploration=new Uint8Array(env.exploration.columns*env.exploration.rows*4);writeExploration(exploration,env.exploration.explored);
  const fogTexture=new THREE.DataTexture(exploration,env.exploration.columns,env.exploration.rows,THREE.RGBAFormat);
  fogTexture.minFilter=THREE.NearestFilter;fogTexture.magFilter=THREE.NearestFilter;fogTexture.needsUpdate=true;
  const fogEnabled={value:1};
  function mapped(material:THREE.MeshStandardMaterial) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.rescueFog={value:fogTexture};shader.uniforms.rescueFogEnabled=fogEnabled;
      shader.vertexShader='varying vec2 rescueMapUV;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 rescueWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
rescueWorld = instanceMatrix * rescueWorld;
#endif
rescueWorld = modelMatrix * rescueWorld;
rescueMapUV = rescueWorld.xz / vec2(${env.width.toFixed(1)}, ${env.height.toFixed(1)});
#include <project_vertex>`);
      shader.fragmentShader='uniform sampler2D rescueFog; uniform float rescueFogEnabled; varying vec2 rescueMapUV;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float rescueKnown = texture2D(rescueFog, clamp(rescueMapUV, 0.0, 1.0)).r;
float rescueVisibility = mix(1.0, rescueKnown, rescueFogEnabled);
outgoingLight = mix(vec3(0.012, 0.024, 0.031), outgoingLight, 0.025 + 0.975 * rescueVisibility);
#include <opaque_fragment>`);
    };
    return material;
  }
  const concreteCanvas=document.createElement('canvas');concreteCanvas.width=concreteCanvas.height=256;
  const ctx=concreteCanvas.getContext('2d')!;const rand=visualRandom(8302);
  ctx.fillStyle='#7e827a';ctx.fillRect(0,0,256,256);
  for(let i=0;i<9000;i++){const n=Math.floor(85+rand()*95);ctx.fillStyle=`rgba(${n},${n},${n-6},.3)`;ctx.fillRect(rand()*256,rand()*256,1+rand()*3,1+rand()*2);}
  ctx.strokeStyle='#555d56';ctx.lineWidth=.7;
  for(let i=0;i<12;i++){let x=rand()*256,y=rand()*256;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=rand()*22-9;y+=rand()*20-5;ctx.lineTo(x,y);}ctx.stroke();}
  const concreteTexture=new THREE.CanvasTexture(concreteCanvas);concreteTexture.wrapS=concreteTexture.wrapT=THREE.RepeatWrapping;concreteTexture.repeat.set(3,3);concreteTexture.colorSpace=THREE.SRGBColorSpace;
  const floorMaterial=mapped(new THREE.MeshStandardMaterial({color:0x83887e,map:concreteTexture,roughness:.98,metalness:.05}));
  const wallMaterial=mapped(new THREE.MeshStandardMaterial({color:0xb6b3a5,map:concreteTexture,roughness:.93}));
  const wallDark=mapped(new THREE.MeshStandardMaterial({color:0x797665,roughness:.98}));
  const steelMaterial=mapped(new THREE.MeshStandardMaterial({color:0x5d4737,metalness:.75,roughness:.78}));
  const rubbleMaterial=mapped(new THREE.MeshStandardMaterial({color:0x99917e,roughness:1}));
  const boxGeometry=new THREE.BoxGeometry(1,1,1);
  function box(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material){const mesh=new THREE.Mesh(boxGeometry,material);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;}
  box(env.width+24,16,env.height+24,env.width/2,-12,env.height/2,new THREE.MeshStandardMaterial({color:0x202e34,roughness:.9,metalness:.3}));
  box(env.width,5,env.height,env.width/2,-2.5,env.height/2,floorMaterial);
  // Every solid footprint is taken from the existing obstacle geometry. Decorative
  // damage stays inside it, so agents never appear to walk through added rubble.
  for(const obstacle of env.obstacles){
    const {x,y,width:w,height:d}=obstacle;
    if(obstacle.elevation!==undefined){
      const base=obstacle.baseAltitude??0;
      const material=base>0?mapped(new THREE.MeshStandardMaterial({color:0xc6b694,roughness:.9,transparent:true,opacity:.45})):obstacle.kind==='wall'?wallMaterial:rubbleMaterial;
      box(w,obstacle.elevation,d,x+w/2,base+obstacle.elevation/2,y+d/2,material);
      continue;
    }
    if(obstacle.kind==='wall'){
      const horizontal=w>d,length=Math.max(w,d),parts=Math.ceil(length/18);
      box(w,10,d,x+w/2,5,y+d/2,wallDark);
      for(let i=0;i<parts;i++){
        const h=24+rand()*17,step=length/parts;
        box(horizontal?step:w,h,horizontal?d:step,x+(horizontal?(i+.5)*step:w/2),h/2,y+(horizontal?d/2:(i+.5)*step),wallMaterial);
        if(i%4===1){const rod=box(1,12,1,x+(horizontal?(i+.5)*step:w/2),h+4,y+(horizontal?d/2:(i+.5)*step),steelMaterial);rod.rotation.z=(rand()-.5)*.3;}
      }
    } else {
      box(w,5,d,x+w/2,2.5,y+d/2,wallDark);
      for(let i=0;i<14;i++){
        const size=3+rand()*Math.min(w,d)*.23;
        const chunk=new THREE.Mesh(new THREE.DodecahedronGeometry(size,0),rubbleMaterial);
        chunk.position.set(x+size+rand()*(w-size*2),size*.6,y+size+rand()*(d-size*2));chunk.rotation.set(rand()*2,rand()*2,rand()*2);chunk.scale.y=.6+rand()*.5;chunk.castShadow=true;chunk.receiveShadow=true;scene.add(chunk);
      }
      const beam=box(w*.75,4,d*.16,x+w/2,10,y+d/2,steelMaterial);beam.rotation.y=(rand()-.5)*.25;
    }
  }
  // Surface joints, not new obstacles.
  const floorLines:number[]=[];
  for(let x=0;x<=env.width;x+=40)floorLines.push(x,.06,0,x,.06,env.height);
  for(let z=0;z<=env.height;z+=40)floorLines.push(0,.06,z,env.width,.06,z);
  const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(floorLines,3));
  const grid=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:0x749995,transparent:true,opacity:.07}));scene.add(grid);
  function label(text:string,color:string,width=128){
    const c=document.createElement('canvas');c.width=256;c.height=64;const cctx=c.getContext('2d')!;
    cctx.fillStyle='rgba(7,18,23,.86)';cctx.fillRect(0,0,256,64);cctx.fillStyle=color;cctx.font='bold 25px monospace';cctx.textAlign='center';cctx.fillText(text,128,40);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(width,width/4,1);return sprite;
  }
  const entryRing=new THREE.Mesh(new THREE.RingGeometry(20,22,48),new THREE.MeshBasicMaterial({color:0x9ecfce,side:THREE.DoubleSide}));entryRing.rotation.x=-Math.PI/2;entryRing.position.set(env.entry.x,.4,env.entry.y);scene.add(entryRing);
  const entryLabel=label('INSERTION POINT','#aadcd5',76);entryLabel.position.set(env.entry.x,3,env.entry.y+34);scene.add(entryLabel);
  // Sector plates sit on the plinth, so they do not suggest discovered locations.
  for(let i=0;i<4;i++){const t=label(String(i+1),'#7a969e',25);t.position.set((i+.5)*env.width/4,0,-20);scene.add(t);const l=label('ABCD'[i],'#7a969e',25);l.position.set(-20,0,(i+.5)*env.height/4);scene.add(l);}
  const agents:MissionVisual[]=[],agentLabels:THREE.Sprite[]=[];
  const discoveries=new Map<string,{group:THREE.Group,label:THREE.Sprite,status:string}>();
  let frame:SceneFrame|null=null,mode:CameraMode='overview',disposed=false,raf=0,previous=performance.now(),followDistance=1;
  const playback=new ReceivedMotionPlayback();
  const followTarget=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function home(){mode='overview';controls.enabled=true;const distance=Math.max(env.width/camera.aspect,env.height)*1.5;controls.target.set(env.width/2,0,env.height/2);camera.position.set(env.width/2+distance*.25,distance*.9,env.height/2+distance*.8);camera.lookAt(controls.target);controls.update();}
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(w<=0||h<=0)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();home();
  function update(next:SceneFrame){
    frame=next;
    if(writeExploration(exploration,next.explored))fogTexture.needsUpdate=true;
    while(agents.length<next.agents.length){const i=agents.length,visual=(visualOptions.createAgent??createInsect)(next.agents[i].color);agents.push(visual);scene.add(visual.group);const badge=label(`BUG ${String(i+1).padStart(2,'0')}`,next.agents[i].color,37);scene.add(badge);agentLabels.push(badge);}
    if(!next.agents.some(a=>a.motionSamples?.length))drawAgents(next);
    for(const d of next.discoveries){
      let item=discoveries.get(d.id);
      if(!item){const group=new THREE.Group(),color=d.kind==='gas'?0xffbc62:0x79e4c0;
        const ring=new THREE.Mesh(new THREE.RingGeometry(14,16,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85}));ring.rotation.x=-Math.PI/2;ring.position.y=.9;group.add(ring);
        const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,28,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7}));beacon.position.y=14;group.add(beacon);
        const tag=label('',d.kind==='gas'?'#ffca7d':'#9affe0',75);tag.position.y=38;group.add(tag);
        item={group,label:tag,status:''};discoveries.set(d.id,item);scene.add(group);
      }
      // Only estimates from the public discovery projection are ever rendered.
      item.group.position.set(d.estimatedPosition.x,0,d.estimatedPosition.y);
      const text=`${d.kind==='gas'?'GAS':d.id.startsWith('T-')?'HEAT ?':d.status==='confirmed'?'LIFE +':'SIGNAL ?'} / ${d.sector}`;
      if(item.status!==text){const texture=item.label.material.map! as THREE.CanvasTexture;const c=texture.image as HTMLCanvasElement;const context=c.getContext('2d')!;context.clearRect(0,0,256,64);context.fillStyle='rgba(7,18,23,.9)';context.fillRect(0,0,256,64);context.fillStyle=d.kind==='gas'?'#ffca7d':'#9affe0';context.font='bold 23px monospace';context.textAlign='center';context.fillText(text,128,40);texture.needsUpdate=true;item.status=text;}
    }
    for(const [id,item] of discoveries)if(!next.discoveries.some(d=>d.id===id))item.group.visible=false;
  }
  function drawAgents(next:SceneFrame){
    agents.forEach((visual,i)=>{
      const agent=next.agents[i];visual.group.visible=!!agent;agentLabels[i].visible=!!agent;
      if(!agent)return;const pose=worldPose(agent.bug);visual.group.position.set(pose.x,(agent.altitude??3)-3,pose.z);visual.group.rotation.y=pose.yaw;visual.update(agent.distance,i===next.selected,next,i);
      const labelScale=visualOptions.compactLabels?.45:1;
      agentLabels[i].position.set(pose.x,(agent.altitude??3)-3+17+(agent.altitude!==undefined?5:visualOptions.followHeight?.()??5),pose.z);agentLabels[i].scale.set((i===next.selected?44:34)*labelScale,(i===next.selected?11:8.5)*labelScale,1);
    });
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);if(visualOptions.isPicking?.()){const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point))visualOptions.onDestination?.({x:point.x,y:point.z});return;}const hits=raycaster.intersectObjects(agents.filter(a=>a.group.visible).map(a=>a.group),true);if(hits.length){let object:THREE.Object3D|null=hits[0].object;while(object){const index=agents.findIndex(a=>a.group===object);if(index>=0){onSelect(index);break;}object=object.parent;}}};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const contextLost=(event:Event)=>{event.preventDefault();onFailure();};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  function render(now:number){
    if(disposed)return;const delta=Math.min((now-previous)/1000,.1);previous=now;
    const displayFrame=frame?.agents.some(a=>a.motionSamples?.length)?playback.update(frame,delta):frame;if(displayFrame&&displayFrame!==frame)drawAgents(displayFrame);
    if(visualOptions.compactLabels){discoveries.forEach(item=>{const width=mode==='follow'?25:75;item.label.scale.set(width,width/4,1);});entryLabel.visible=mode==='overview';agentLabels.forEach((label,i)=>{label.visible=!!frame?.agents[i]&&(mode==='overview'||i===frame.selected);});}
    if(mode==='follow'&&displayFrame?.agents[displayFrame.selected]){
      const agent=displayFrame.agents[displayFrame.selected],bug=agent.bug,altitude=(agent.altitude??3)-3;
      followTarget.set(bug.position.x,altitude+(agent.altitude!==undefined?5:visualOptions.followHeight?.()??5),bug.position.y);
      desiredCamera.set(bug.position.x-Math.cos(bug.heading)*100*followDistance,altitude+83*followDistance,bug.position.y-Math.sin(bug.heading)*100*followDistance);
      camera.position.lerp(desiredCamera,1-Math.exp(-delta*5));controls.target.lerp(followTarget,1-Math.exp(-delta*7));camera.up.copy(up);camera.lookAt(controls.target);
    }else controls.update();
    try { renderer.render(scene,camera); } catch { onFailure(); return; }
    raf=requestAnimationFrame(render);
  }
  raf=requestAnimationFrame(render);
  return {update,camera(next){mode=next;controls.enabled=next==='overview';if(next==='overview')home();},home,zoom(factor){if(mode==='follow'){followDistance=THREE.MathUtils.clamp(followDistance*factor,.65,2.5);}else {camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}},fog(enabled){fogEnabled.value=enabled?1:0;},dispose(){
    disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',contextLost);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>([fogTexture,concreteTexture]);
    scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}if(object instanceof THREE.Sprite)materials.add(object.material);});
    materials.forEach(m=>{const map=(m as THREE.MeshStandardMaterial).map;if(map)textures.add(map);m.dispose();});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  }};
}
