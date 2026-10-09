import type {DecisionExplanation,Investigation} from './operations';
interface Operation {authority:string;task:string;altitude:number;phase:string;battery:number;connected:boolean;age:number;pending:number;explanation:DecisionExplanation|null;investigations:Investigation[]}
interface Props {operation:Operation;running:boolean;picking:boolean;onPick:()=>void;command:(kind:'operator'|'explore'|'flight'|'land')=>void;steer:(forward:number,angular:number)=>void;link:(connected:boolean)=>void}
export function MissionControls({operation:o,running,picking,onPick,command,steer,link}:Props){
 const available=o.connected&&o.battery>0,manual=available&&o.authority==='operator'&&running;
 return <section className="mission-controls" aria-label="Selected insect controls">
  <h3>Guide this insect</h3><p><b>{o.authority.toUpperCase()}</b> · {o.phase} · altitude {o.altitude.toFixed(1)} u</p>
  <p>{o.task}</p><p className="mission-radio" role="status">{o.connected?'Radio connected':'RADIO LOST — last received position'} · packet age {o.age.toFixed(1)} s<br/>Backpack battery {o.battery.toFixed(1)}% <meter min={0} max={100} low={15} value={o.battery}/></p>
  {o.battery<=15&&<p role="alert">Battery reserve: move to clear floor and land. This models electronics, not insect energy.</p>}
  <div className="lab-actions"><button disabled={!available} aria-pressed={picking} onClick={onPick}>{picking?'Cancel destination':'Choose map destination'}</button><button disabled={!available} onClick={()=>command('operator')}>Take operator control</button><button disabled={!available} onClick={()=>command('explore')}>Resume autonomy</button></div>
  <div className="lab-actions"><button disabled={!available||o.phase!=='grounded'} onClick={()=>command('flight')}>Take off</button><button disabled={!available||o.phase==='grounded'||o.phase==='landing'} onClick={()=>command('land')}>Land on clear floor</button></div>
  {picking&&<p role="status">Click a revealed location in the map or 3D floor. An unreachable destination is rejected.</p>}
  <div className="mission-steering" aria-label="Temporary steering pulses"><button disabled={!manual} onClick={()=>steer(0,-1)}>Turn left</button><button disabled={!manual} onClick={()=>steer(1,0)}>Forward</button><button disabled={!manual} onClick={()=>steer(0,1)}>Turn right</button><button disabled={!manual} onClick={()=>steer(-.5,0)}>Back</button><button disabled={!manual} onClick={()=>steer(0,0)}>Stop</button></div>
  <p className="mission-context">Commands arrive after 0.35 simulated seconds. Each steering pulse lasts at most 0.65 s; repeat it to continue. {o.pending} queued. {!running&&'Resume the mission to deliver commands.'}</p>
  <details><summary>Test backpack radio</summary><label><input type="checkbox" checked={!o.connected} onChange={e=>link(!e.target.checked)}/> Simulate radio loss for this insect</label><p>The onboard task continues. Its map, readings and neural overlay hold their last received packet until contact returns.</p></details>
 </section>;
}
const motor=(m:{forward:number;angular:number})=>`${m.forward.toFixed(1)} u/s · ${m.angular.toFixed(2)} rad/s`;
export function DecisionPanel({sample,age}:{sample:DecisionExplanation|null;age:number}){
 return <section className="mission-decisions" aria-label="Movement explanation"><h3>Why did it move?</h3>{!sample?<p>Run the mission to receive a movement explanation.</p>:<><p className="mission-context">Received sample at {sample.time.toFixed(2)} s · packet age {age.toFixed(1)} s</p><ol>
 <li><b>Obstacle inputs</b><p>Left {sample.distances.left.toFixed(1)} · front {sample.distances.front.toFixed(1)} · right {sample.distances.right.toFixed(1)} u</p></li>
 <li><b>{sample.mode==='malecns'?'MaleCNS steering proposal':'Rule-based proposal'}</b><p>{motor(sample.proposal)}</p>{sample.stimulus&&<p>Last accepted mapped inputs: L {sample.stimulus.left.toFixed(3)} / front {sample.stimulus.front.toFixed(3)} / R {sample.stimulus.right.toFixed(3)} · sample {sample.neuralTime?.toFixed(2)??'pending'} s.</p>}{sample.dna02&&<p>Last accepted DNa02 peaks: L {sample.dna02.left.toFixed(3)} / R {sample.dna02.right.toFixed(3)}. These are simulated controller activations, not biological measurements.</p>}</li>
 <li><b>Chosen command</b><p>{sample.reason}</p><p>{motor(sample.chosen)}</p></li>
 <li><b>After actuation and collision checks</b><p>{motor(sample.applied)} · distance {sample.distance.toFixed(3)} u · altitude change {sample.altitudeChange.toFixed(3)} u</p>{sample.blocked&&<p>Translation blocked by solid geometry or a peer.</p>}</li>
 </ol><p className="mission-context">Task guidance, operator pulses and collision safety may override the controller. Backpack actuation adds delay and variable response.</p></>}</section>;
}
