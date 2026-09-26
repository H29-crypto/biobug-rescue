import * as THREE from 'three';
import { gaitPhase } from './model';

export interface InsectVisual { group:THREE.Group; legs:THREE.Group[]; ring:THREE.Mesh; body:THREE.Group; phase:number; update:(distance:number,selected:boolean)=>void }
export function createInsect(color:string):InsectVisual {
  const group=new THREE.Group(),body=new THREE.Group();group.add(body);
  const shell=new THREE.MeshStandardMaterial({color:0x31453e,roughness:.36,metalness:.55});
  const chitin=new THREE.MeshStandardMaterial({color:0x151e1c,roughness:.62,metalness:.25});
  const joint=new THREE.MeshStandardMaterial({color:0x939b8a,roughness:.46,metalness:.7});
  const accent=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3,roughness:.28});
  const sphere=new THREE.SphereGeometry(1,16,10);
  function ellipsoid(parent:THREE.Group,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
    const mesh=new THREE.Mesh(sphere,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
  }
  ellipsoid(body,shell,-4.8,5,0,5.7,3.1,3.8);
  ellipsoid(body,chitin,1.1,5.6,0,3.4,2.8,3.1);
  ellipsoid(body,shell,5.1,5.1,0,2.5,2.2,2.8);
  ellipsoid(body,accent,6.5,5.6,-1.7,.65,.7,.65);ellipsoid(body,accent,6.5,5.6,1.7,.65,.7,.65);
  const module=new THREE.Mesh(new THREE.BoxGeometry(4.8,1.25,3.6),joint);module.position.set(-1,8.1,0);body.add(module);
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(3.6,.25,.6),accent);stripe.position.set(-1,8.85,0);body.add(stripe);
  // Small seam down the wing case, with no claim of a biological body model.
  const seam=new THREE.Mesh(new THREE.BoxGeometry(7,.25,.18),chitin);seam.position.set(-5,7.9,0);body.add(seam);
  function segment(parent:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.7,r,a.distanceTo(b),6),mat);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=true;parent.add(mesh);
  }
  const legs:THREE.Group[]=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const leg=new THREE.Group();leg.position.set(3-i*3.6,4.8,side*2.2);body.add(leg);legs.push(leg);
    const knee=new THREE.Vector3((1-i)*2.4,1.5,side*4.1),foot=new THREE.Vector3((1-i)*4.1,-4.4,side*7);
    segment(leg,new THREE.Vector3(),knee,.5,joint);segment(leg,knee,foot,.38,chitin);
    ellipsoid(leg,joint,knee.x,knee.y,knee.z,.7,.7,.7);
  }
  for(const side of [-1,1]){
    segment(body,new THREE.Vector3(6,6,side*1.6),new THREE.Vector3(10,8.4,side*3.1),.18,joint);
    segment(body,new THREE.Vector3(10,8.4,side*3.1),new THREE.Vector3(13,7.5,side*4.2),.12,chitin);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(12.5,13.3,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.7;group.add(ring);
  const result:InsectVisual={group,body,legs,ring,phase:0,update(distance,selected){
    result.phase=distance*.32;
    legs.forEach((leg,j)=>{const side=j<3?-1:1;const phase=gaitPhase(distance,j%3,side);leg.rotation.y=Math.sin(phase)*.35;leg.rotation.x=Math.max(0,Math.cos(phase))*.3*side;});
    body.position.y=Math.sin(distance*.64)*.18;
    ring.visible=selected;
  }};
  return result;
}
