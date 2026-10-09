import * as THREE from 'three';
import {createFruitFly} from '../virtual-fly/fruitFly';
import type {BodyStyle,MotionStyle} from '../virtual-fly/embodimentModel';
import {createInsect} from '../rendering/rescue3d/insect';
import type {MissionVisual,RescueVisualOptions} from '../rendering/rescue3d/scene';
export interface RescueAppearance {body:BodyStyle;motion:MotionStyle}
/** Adapts a copied rescue render frame, never a simulation, to the shared lab body. */
export function rescueVisuals(settings:()=>RescueAppearance):RescueVisualOptions {
  return {compactLabels:true,followHeight:()=>settings().body!=='simple'&&settings().motion==='flight'?17:5,createAgent(color):MissionVisual{
    const group=new THREE.Group(),fly=createFruitFly(),simple=createInsect(color);
    const ring=new THREE.Mesh(new THREE.RingGeometry(12.5,13.3,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.6;group.add(fly.group,simple.group,ring);
    // The shared rescue scene disposes all geometry/materials through its scene traversal.
    return {group,update(distance,selected,frame,index){const look=settings(),agent=frame.agents[index];
      simple.group.visible=look.body==='simple';fly.group.visible=look.body!=='simple';ring.visible=selected&&look.body!=='simple';
      if(look.body==='simple')simple.update(distance,selected);
      else fly.update({x:0,z:0,yaw:0,distance,time:agent.sampleTime??frame.elapsed,speed:agent.bug.speed,running:frame.running??agent.bug.state!=='stopped',moving:agent.bug.state==='exploring',waiting:false},look.body,agent.motion??look.motion);
      if(agent.altitude!==undefined){fly.group.position.y=0;ring.position.y=.6-(agent.altitude-3);}
    }};
  }};
}
