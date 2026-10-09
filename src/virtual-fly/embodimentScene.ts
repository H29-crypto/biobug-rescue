import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFruitFly } from './fruitFly';
import { embodimentAnimation } from './embodimentModel';
import type { BodyStyle, EmbodimentPose, MotionStyle } from './embodimentModel';

export interface VisualArena {width:number;height:number;obstacles:{x:number;y:number;width:number;height:number}[]}
export interface EmbodimentPerformance {fps:number;frameMs:number;cpuMs:number;drawCalls:number;triangles:number;geometryBytes:number;setupMs:number}

export function createEmbodimentScene(host:HTMLDivElement, arena:VisualArena, initial:EmbodimentPose,
  onStats:(stats:EmbodimentPerformance)=>void, onFailure:()=>void) {
  const started=performance.now();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0xdce0d4);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.setAttribute('aria-label','Illustrative 3D fruit fly following the actual experiment position and heading. Drag to orbit; scroll to zoom.');
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,3000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.enablePan=false;controls.minDistance=27;controls.maxDistance=1100;
  controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xf8fff8,0x716450,2.1));
  const key=new THREE.DirectionalLight(0xfff0d4,2.5);key.position.set(10,60,35);scene.add(key);
  const rim=new THREE.DirectionalLight(0xe0f2ff,1.8);rim.position.set(-40,25,-30);scene.add(rim);
  const floorGeometry=new THREE.PlaneGeometry(arena.width,arena.height);
  const floorMaterial=new THREE.MeshStandardMaterial({color:0xc9d0c0,roughness:.93});
  const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.set(arena.width/2,-.3,arena.height/2);scene.add(floor);
  const gridPoints:THREE.Vector3[]=[];
  for(let x=0;x<=arena.width;x+=10)gridPoints.push(new THREE.Vector3(x,-.26,0),new THREE.Vector3(x,-.26,arena.height));
  for(let z=0;z<=arena.height;z+=10)gridPoints.push(new THREE.Vector3(0,-.26,z),new THREE.Vector3(arena.width,-.26,z));
  const gridGeometry=new THREE.BufferGeometry().setFromPoints(gridPoints);
  const gridMaterial=new THREE.LineBasicMaterial({color:0x899c8c,transparent:true,opacity:.25});scene.add(new THREE.LineSegments(gridGeometry,gridMaterial));
  const wallGeometry=new THREE.BoxGeometry(1,1,1),wallMaterial=new THREE.MeshStandardMaterial({color:0x8b9b92,roughness:.8});
  for(const o of arena.obstacles){const mesh=new THREE.Mesh(wallGeometry,wallMaterial);mesh.position.set(o.x+o.width/2,2,o.y+o.height/2);mesh.scale.set(o.width,4,o.height);scene.add(mesh);}
  // A small contact shadow instead of a second shadow-map rendering pass.
  const shadowPixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++)shadowPixels[(y*64+x)*4+3]=Math.round(70*Math.max(0,1-Math.hypot((x-31.5)/31.5,(y-31.5)/31.5))**2);
  const shadowTexture=new THREE.DataTexture(shadowPixels,64,64);shadowTexture.needsUpdate=true;
  const shadowGeometry=new THREE.PlaneGeometry(28,18),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const fly=createFruitFly();scene.add(fly.group);
  let pose={...initial},style:BodyStyle='biobug',motion:MotionStyle='walk',overview=false,disposed=false;
  const target=new THREE.Vector3(pose.x,3,pose.z),previousTarget=target.clone();
  function preset(next:'follow'|'overview'){
    overview=next==='overview';
    const point=overview?new THREE.Vector3(arena.width/2,0,arena.height/2):new THREE.Vector3(pose.x,3+embodimentAnimation(pose,motion).altitude,pose.z);
    controls.target.copy(point);previousTarget.copy(point);
    camera.position.copy(point).add(overview?new THREE.Vector3(210,680,440):new THREE.Vector3(26,23,34));
    controls.update();
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();preset('follow');
  const lost=(event:Event)=>{event.preventDefault();onFailure();};renderer.domElement.addEventListener('webglcontextlost',lost);
  const geometries=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if((o as THREE.Mesh).geometry)geometries.add((o as THREE.Mesh).geometry);});
  let geometryBytes=0;geometries.forEach(g=>{for(const attribute of Object.values(g.attributes))geometryBytes+=attribute.array.byteLength;geometryBytes+=g.index?.array.byteLength??0;});
  const setupMs=performance.now()-started;
  let frame=0,lastRender=0,windowStart=performance.now(),count=0,cpu=0;
  const render=(now:number)=>{
    if(disposed)return;
    // Independent display budget only: no timers or callbacks into the controller.
    if(now-lastRender>=1000/30-1){
      lastRender=now;const start=performance.now();
      fly.update(pose,style,motion);
      const altitude=embodimentAnimation(pose,motion).altitude;
      shadow.position.set(pose.x-2*Math.cos(-pose.yaw),-.17,pose.z-2*Math.sin(-pose.yaw));shadow.rotation.z=-pose.yaw;
      shadow.scale.setScalar(1+altitude*.035);shadowMaterial.opacity=1/(1+altitude*.055);
      if(!overview){target.set(pose.x,3+altitude,pose.z);camera.position.add(target.clone().sub(previousTarget));controls.target.copy(target);previousTarget.copy(target);}
      controls.update();renderer.render(scene,camera);cpu+=performance.now()-start;count++;
      if(now-windowStart>=1000){const elapsed=now-windowStart;
        onStats({fps:1000*count/elapsed,frameMs:elapsed/count,cpuMs:cpu/count,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryBytes,setupMs});
        windowStart=now;count=0;cpu=0;
      }
    }
    frame=requestAnimationFrame(render);
  };
  frame=requestAnimationFrame(render);
  return {
    update(next:EmbodimentPose,nextStyle:BodyStyle,nextMotion:MotionStyle='walk'){pose={...next};style=nextStyle;motion=nextMotion;},preset,
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();fly.dispose();
      [floorGeometry,gridGeometry,wallGeometry,shadowGeometry].forEach(g=>g.dispose());
      [floorMaterial,gridMaterial,wallMaterial,shadowMaterial].forEach(m=>m.dispose());shadowTexture.dispose();
      renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
  };
}
export type EmbodimentScene=ReturnType<typeof createEmbodimentScene>;
