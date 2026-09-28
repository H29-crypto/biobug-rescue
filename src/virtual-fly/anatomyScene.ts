import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {visibleNeuron} from './anatomyModel';
import type {MorphologyManifest,PopulationFilter} from './anatomyModel';
export interface AnatomyPerformance {fps:number;frameMs:number;p95FrameMs:number;renderSubmitMs:number;geometryBytes:number;renderedNeurons:number;renderedNodes:number;renderedSegments:number;drawCalls:number;sessionFps:number;sessionFrameMs:number;frames:number;visibility:string}
export function createAnatomyScene(host:HTMLDivElement,manifest:MorphologyManifest,positions:Float32Array,onSelect:(id:string)=>void,onPerformance:(p:AnatomyPerformance)=>void,onFailure:()=>void){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x07141e);
  renderer.domElement.setAttribute('aria-label','Real MaleCNS skeletons. Drag to rotate; right-drag to pan; scroll to zoom.');
  renderer.domElement.setAttribute('role','img');host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,10000);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const indices=new Float32Array(manifest.segment_count*2);
  manifest.neurons.forEach((n,i)=>indices.fill(i,n.segment_offset*2,(n.segment_offset+n.segment_count)*2));
  geometry.setAttribute('neuronIndex',new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const bounds=geometry.boundingBox!,center=bounds.getCenter(new THREE.Vector3()),radius=geometry.boundingSphere!.radius;
  const texels=new Float32Array(manifest.neurons.length*4);
  const texture=new THREE.DataTexture(texels,manifest.neurons.length,1,THREE.RGBAFormat,THREE.FloatType);
  texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{activity:{value:texture},count:{value:manifest.neurons.length}},
    vertexShader:`attribute float neuronIndex; uniform sampler2D activity; uniform float count; varying vec4 tone;
    void main(){vec4 t=texture2D(activity,vec2((neuronIndex+0.5)/count,0.5));
      float strength=log(1.0+10000.0*t.r)/log(10001.0);
      vec3 base=t.a<0.5?vec3(0.32,0.88,0.77):(t.a<1.5?vec3(0.66,0.55,1.0):vec3(1.0,0.72,0.32));
      tone=vec4(mix(base,vec3(1.0),t.b*0.7)*(0.38+0.62*strength),t.g*(t.b>0.5?1.0:0.16+0.84*strength));
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec4 tone; void main(){if(tone.a<0.001)discard;gl_FragColor=tone;}`});
  const lines=new THREE.LineSegments(geometry,material);scene.add(lines);
  let filter:PopulationFilter='all',activeOnly=false,selected='',values:Record<string,number>={},disposed=false;
  let visible=manifest.neurons.map(()=>true),visibleCount=0,visibleNodes=0,visibleSegments=0;
  function update(next:Record<string,number>,nextFilter:PopulationFilter,only:boolean,id:string){
    values=next;filter=nextFilter;activeOnly=only;selected=id;visibleCount=visibleNodes=visibleSegments=0;
    manifest.neurons.forEach((n,i)=>{const v=values[n.body_id]??null;visible[i]=visibleNeuron(n,filter,activeOnly,v);
      texels[i*4]=v??0;texels[i*4+1]=Number(visible[i]);texels[i*4+2]=Number(n.body_id===selected);texels[i*4+3]=n.population==='ProLN'?0:n.population==='intermediate'?1:2;
      if(visible[i]){visibleCount++;visibleNodes+=n.node_count;visibleSegments+=n.segment_count;}});
    texture.needsUpdate=true;
  }
  function preset(plane:'oblique'|'XY'|'XZ'|'YZ'='oblique'){
    controls.target.copy(center);const direction=plane==='XY'?new THREE.Vector3(0,0,1):plane==='XZ'?new THREE.Vector3(0,1,0):plane==='YZ'?new THREE.Vector3(1,0,0):new THREE.Vector3(.35,1,.25).normalize();
    camera.up.set(0,0,-1);if(plane==='XY')camera.up.set(0,-1,0);
    camera.position.copy(center).addScaledVector(direction,radius*3.4);camera.near=Math.max(.01,radius/1000);camera.far=radius*100;camera.updateProjectionMatrix();controls.update();
  }
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);});resize.observe(host);preset();
  const ray=new THREE.Raycaster();ray.params.Line={threshold:radius*.006};let down={x:0,y:0};
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pick=(e:PointerEvent)=>{if(e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
    const box=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1),camera);
    const hits=ray.intersectObject(lines);for(const hit of hits){const i=indices[hit.index??0];if(visible[i]){onSelect(manifest.neurons[i].body_id);break;}}
  };
  const lost=(e:Event)=>{e.preventDefault();onFailure();};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pick);renderer.domElement.addEventListener('webglcontextlost',lost);
  let frame=0,previous=0,windowStart=performance.now(),intervals:number[]=[],submits:number[]=[],totalInterval=0,totalFrames=0;
  const geometryBytes=positions.byteLength+indices.byteLength+texels.byteLength;
  const render=(now:number)=>{if(disposed)return;const start=performance.now();controls.update();renderer.render(scene,camera);
    submits.push(performance.now()-start);if(previous){intervals.push(now-previous);totalInterval+=now-previous;totalFrames++;}previous=now;
    if(now-windowStart>=1000&&intervals.length){const sorted=intervals.slice().sort((a,b)=>a-b),mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
      onPerformance({fps:1000/mean,frameMs:mean,p95FrameMs:sorted[Math.ceil(sorted.length*.95)-1],renderSubmitMs:submits.reduce((a,b)=>a+b,0)/submits.length,geometryBytes,
        renderedNeurons:visibleCount,renderedNodes:visibleNodes,renderedSegments:visibleSegments,drawCalls:renderer.info.render.calls,
        sessionFps:1000*totalFrames/totalInterval,sessionFrameMs:totalInterval/totalFrames,frames:totalFrames,visibility:document.visibilityState});intervals=[];submits=[];windowStart=now;}
    frame=requestAnimationFrame(render);};
  update({},'all',false,'');frame=requestAnimationFrame(render);
  return {update,preset,dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();geometry.dispose();material.dispose();texture.dispose();
    renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pick);renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.domElement.remove();}};
}
export type AnatomyScene=ReturnType<typeof createAnatomyScene>;
