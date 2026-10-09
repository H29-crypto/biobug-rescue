import * as THREE from 'three';
import { embodimentAnimation } from './embodimentModel';
import type { BodyStyle, EmbodimentPose, MotionStyle } from './embodimentModel';

/** Original procedural fruit fly. Illustrative anatomy, never a MaleCNS morphology asset. */
export function createFruitFly() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.name = 'illustrative-fruit-fly'; group.add(body);
  const geometry = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const keep = <T extends THREE.BufferGeometry>(g: T): T => { geometry.add(g); return g; };
  const mat = (color: number, roughness = .65, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  };
  const tan = mat(0xb6884f), thorax = mat(0x9b703f), dark = mat(0x493021), legMat = mat(0x805329);
  const red = mat(0xa91e16, .38), ochre = mat(0xcda968), black = mat(0x263735, .43, .25);
  const copper = mat(0xbc935e, .42, .55), ceramic = mat(0xd6dfd4, .55);
  const sphere = keep(new THREE.SphereGeometry(1, 20, 12));
  const cylinder = keep(new THREE.CylinderGeometry(.72, 1, 1, 6));
  const cube = keep(new THREE.BoxGeometry(1, 1, 1));
  function ellipsoid(parent: THREE.Object3D, material: THREE.Material, position: number[], scale: number[], meshGeometry: THREE.BufferGeometry = sphere) {
    const mesh = new THREE.Mesh(meshGeometry, material);
    mesh.position.fromArray(position); mesh.scale.fromArray(scale); parent.add(mesh); return mesh;
  }
  function rod(parent: THREE.Object3D, a: number[], b: number[], radius: number, material = legMat) {
    const start = new THREE.Vector3().fromArray(a), end = new THREE.Vector3().fromArray(b);
    const mesh = new THREE.Mesh(cylinder, material);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    mesh.scale.set(radius, start.distanceTo(end), radius); parent.add(mesh); return mesh;
  }

  // Tapered abdomen with separate dark cuticular bands, not a metallic shell.
  const profile = [[2.0,0],[2.5,1],[2.75,2.5],[2.65,4],[2.25,5.5],[1.65,7],[.8,8.5],[.12,9.5]];
  const abdomen = new THREE.Mesh(keep(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)), 28)), tan);
  abdomen.rotation.z = Math.PI / 2; abdomen.scale.x = .78; abdomen.position.set(-1.5,3.7,0); body.add(abdomen);
  for (const [r, x] of [[2.72,2.6],[2.62,4.1],[2.22,5.6],[1.62,7.05],[.78,8.5]]) {
    const band = new THREE.Mesh(keep(new THREE.TorusGeometry(r,.115,5,28)), dark);
    band.rotation.y = Math.PI/2; band.scale.y = .78; band.position.set(-1.5-x,3.7,0); body.add(band);
  }
  ellipsoid(body,thorax,[0,4.4,0],[3.25,2.35,2.25]);
  ellipsoid(body,ochre,[4.0,4.15,0],[2.15,1.75,2.05]);
  ellipsoid(body,dark,[5.6,3.25,0],[.55,.5,.65]); // small mouthparts
  const eyeGeometry = keep(new THREE.IcosahedronGeometry(1,3));
  red.flatShading = true;
  for (const side of [-1,1]) {
    ellipsoid(body,red,[4.45,4.4,side*1.65],[1.55,1.56,.92],eyeGeometry);
    // Small haltere behind each wing base.
    rod(body,[-2,4.2,side*2],[-3.3,4.7,side*3.0],.09);
    ellipsoid(body,ochre,[-3.3,4.7,side*3.0],[.27,.29,.27]);
  }

  const legs: { root: THREE.Group; lower: THREE.Group }[] = [];
  for (const side of [-1,1]) for (let i=0;i<3;i++) {
    const root = new THREE.Group(); root.name = `leg-${side}-${i}`;
    root.position.set(1.8-i*1.9,3.65,side*1.65); body.add(root);
    const fore = (1-i)*2.2;
    const knee = [fore,.1,side*2.4];
    rod(root,[0,0,0],knee,.24);
    ellipsoid(root,tan,knee,[.28,.28,.28]);
    const lower = new THREE.Group(); lower.position.fromArray(knee); root.add(lower);
    const ankle = [fore*.75,-3.0,side*2.2];
    rod(lower,[0,0,0],ankle,.14);
    const toe = [ankle[0]+.95,ankle[1]-.42,ankle[2]+side*.48];
    rod(lower,ankle,toe,.075,dark);
    rod(lower,toe,[toe[0]+.55,toe[1],toe[2]+side*.2],.045,dark);
    legs.push({root,lower});
  }

  const wingMaterial = new THREE.MeshStandardMaterial({ color:0xd7e1d9, transparent:true, opacity:.31,
    roughness:.32, metalness:.06, side:THREE.DoubleSide, depthWrite:false }); materials.add(wingMaterial);
  const veinMaterial = new THREE.LineBasicMaterial({ color:0x8b9688, transparent:true, opacity:.65 }); materials.add(veinMaterial);
  const outline = new THREE.SplineCurve([new THREE.Vector2(0,0),new THREE.Vector2(-3,1.9),new THREE.Vector2(-8,3.5),
    new THREE.Vector2(-13,3.3),new THREE.Vector2(-14.5,1.8),new THREE.Vector2(-12,.35),new THREE.Vector2(-6,-.45),new THREE.Vector2(0,0)]);
  const shape = new THREE.Shape(outline.getPoints(44));
  const wingGeometry = keep(new THREE.ShapeGeometry(shape)); wingGeometry.rotateX(Math.PI/2);
  const veins = [[0,0,-12,2.5],[0,0,-13,1.4],[-2,.5,-10,.25],[-3,1.0,-8,3.3],[-6,1.3,-7,3.5],[-8,1,-10,3.6],[-10,.8,-12,3.0]];
  const veinGeometry = keep(new THREE.BufferGeometry().setFromPoints(veins.flatMap(([a,b,c,d])=>[new THREE.Vector3(a,.018,b),new THREE.Vector3(c,.018,d)])));
  const wings: THREE.Group[] = [];
  for (const side of [-1,1]) {
    const wing = new THREE.Group(); wing.position.set(-.2,6.0,side*1.7); wing.scale.z=side; wing.rotation.y=-side*.14;
    wing.add(new THREE.Mesh(wingGeometry,wingMaterial),new THREE.LineSegments(veinGeometry,veinMaterial)); body.add(wing); wings.push(wing);
  }
  // Faint wing-sweep silhouettes keep fast flight readable at the 30 FPS display budget.
  const blurMaterial = new THREE.MeshBasicMaterial({color:0xeaf4ec,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}); materials.add(blurMaterial);
  const wingSweep = new THREE.Group(); wingSweep.name='flight-wing-sweep';body.add(wingSweep);
  for(const side of [-1,1])for(const angle of [-.4,0,.4]){
    const sweep=new THREE.Mesh(wingGeometry,blurMaterial);sweep.position.set(-.2,6,side*1.7);sweep.scale.z=side;
    sweep.rotation.set(0,side*1.12,angle,'YZX');wingSweep.add(sweep);
  }

  // Fine bristles share one line buffer, including feather-like antennal aristae.
  const hairPoints: THREE.Vector3[]=[];
  for(let i=0;i<34;i++){
    const angle=i*2.39996, x=Math.sin(i*1.3)*2.4, z=Math.sin(angle)*1.9;
    const y=4.5+Math.sqrt(Math.max(0,1-x*x/10-z*z/5))*2.2;
    hairPoints.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x-.35,y+.55,z*1.15));
  }
  const hairMaterial = new THREE.LineBasicMaterial({color:0x483623,transparent:true,opacity:.7}); materials.add(hairMaterial);
  body.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(hairPoints)),hairMaterial));
  const antennae: THREE.Group[]=[];
  for(const side of [-1,1]){
    const antenna=new THREE.Group(); antenna.position.set(5.6,4.55,side*.65);body.add(antenna);antennae.push(antenna);
    rod(antenna,[0,0,0],[1,.25,side*.25],.12);
    ellipsoid(antenna,ochre,[1,.25,side*.25],[.34,.20,.18]);
    rod(antenna,[1,.25,side*.25],[1.8,1.05,side*.58],.045,dark);
    const points=[];
    for(let i=0;i<5;i++)points.push(new THREE.Vector3(1.1+i*.14,.4+i*.13,side*(.3+i*.05)),new THREE.Vector3(.85+i*.14,.65+i*.13,side*(.5+i*.05)));
    antenna.add(new THREE.LineSegments(keep(new THREE.BufferGeometry().setFromPoints(points)),hairMaterial));
  }

  const hardware = new THREE.Group(); hardware.name='lightweight-instrumentation'; body.add(hardware);
  ellipsoid(hardware,black,[.3,6.8,0],[2.05,.55,1.55],cube);
  ellipsoid(hardware,copper,[.3,6.48,0],[2.35,.1,1.85],cube);
  ellipsoid(hardware,ceramic,[.55,7.09,0],[1.1,.055,.95],cube);
  for(const side of [-1,1]){
    rod(hardware,[-.4,6.55,side*.8],[-.65,5.55,side*2.1],.075,copper);
    ellipsoid(hardware,black,[-.65,5.5,side*2.1],[.23,.12,.3]);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.9,6.7,side*.65),new THREE.Vector3(1.7,6.2,side*1.7),new THREE.Vector3(2.1,5.45,side*1.9)]);
    hardware.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve,10,.045,5,false)),copper));
  }
  const led=mat(0x90d9b2,.3);led.emissive.set(0x3d8059);led.emissiveIntensity=.5;
  ellipsoid(hardware,led,[-.32,7.12,.53],[.12,.07,.12]);
  ellipsoid(hardware,black,[1.43,6.7,0],[.28,.23,.3]);

  return {
    group, legs, wings, hardware, wingSweep,
    update(p: EmbodimentPose, style: BodyStyle, motion: MotionStyle = 'walk') {
      const a=embodimentAnimation(p,motion), flying=motion==='flight';
      group.position.set(p.x,a.altitude,p.z);group.rotation.y=p.yaw;
      body.position.y=a.bob;body.rotation.z=a.pitch;hardware.visible=style==='biobug';wingSweep.visible=flying;
      legs.forEach((leg,i)=>{leg.root.rotation.y=a.legs[i].swing;leg.lower.rotation.x=a.legs[i].lift;});
      wings.forEach((wing,i)=>{const side=i?1:-1;wing.rotation.set(flying?0:side*(.06+a.wing),flying?side*1.12:-side*.14,flying?a.wing:0,'YZX');});
      antennae.forEach((antenna,i)=>{antenna.rotation.y=(i?1:-1)*a.antenna;});
    },
    dispose(){geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},
  };
}
export type FruitFly = ReturnType<typeof createFruitFly>;
