import {lazy,Suspense,useState} from 'react';
import './unified-lab.css';
const Experiments=lazy(()=>import('../virtual-fly/VirtualFlyLab'));
const RescueLab=lazy(()=>import('./RescueLab'));
const SupervisedLab=lazy(()=>import('../supervised-lab/SupervisedLab'));
export default function UnifiedLab({initial='rescue'}:{initial?:'rescue'|'experiment'}){
  const [scenario,setScenario]=useState<'rescue'|'experiment'|'supervised'>(initial);
  return <div className="unified-lab"><nav className="lab-scenarios" aria-label="Virtual lab scenario">
    <div><strong>VIRTUAL BIOBUG LAB</strong><span>One platform · three experiment settings</span></div>
    <div role="group" aria-label="Scenario"><button aria-pressed={scenario==='supervised'} onClick={()=>setScenario('supervised')}>SUPERVISED INSECT ARENA</button><button aria-pressed={scenario==='rescue'} onClick={()=>setScenario('rescue')}>COLLAPSED BUILDING RESCUE</button><button aria-pressed={scenario==='experiment'} onClick={()=>setScenario('experiment')}>CONTROLLED FLY EXPERIMENTS</button></div>
    <small>Changing scenario closes its run. Returning starts fresh.</small>
  </nav><Suspense fallback={<p className="experience-loading">Loading lab scenario…</p>}>{scenario==='rescue'?<RescueLab/>:scenario==='supervised'?<SupervisedLab/>:<Experiments/>}</Suspense></div>;
}
