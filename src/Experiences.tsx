import { lazy, Suspense, useEffect, useState } from 'react';
import App from './App';
import './experiences.css';
const VirtualFlyLab=lazy(()=>import('./virtual-fly/VirtualFlyLab'));
function selectedExperience(){return location.hash==='#rescue'?'rescue':location.hash==='#virtual-fly'?'lab':'home';}
export default function Experiences(){
  const [experience,setExperience]=useState(selectedExperience);
  useEffect(()=>{const change=()=>setExperience(selectedExperience());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  if(experience!=='home')return <><div className="experience-return"><a href="#">← CHOOSE EXPERIENCE</a><span>Leaving closes the active run. Re-entry starts fresh.</span></div>{experience==='rescue'?<App/>:<Suspense fallback={<div className="experience-loading">Loading Virtual Fly Lab…</div>}><VirtualFlyLab/></Suspense>}</>;
  return <main className="experience-home"><p className="experience-wordmark">✳ BIOBUG</p><p className="experience-kicker">ONE PLATFORM / TWO INDEPENDENT EXPERIENCES</p><h1>Choose your perspective.</h1><p className="experience-intro">Explore a rescue mission—or investigate the computational loop behind a single virtual insect.</p><div className="experience-choices"><section><span className="experience-number">01 / MISSION</span><div className="experience-symbol">⌖</div><h2>BioBug Rescue</h2><p>Search-and-rescue swarm simulation. Explore, share discoveries and brief a human operator.</p><a href="#rescue">ENTER RESCUE <span>↗</span></a><small>Presentation · Technical · 3D Rescue View</small></section><section><span className="experience-number">02 / EXPERIMENT</span><div className="experience-symbol">⌬</div><h2>Virtual Fly Lab</h2><p>Experimental MaleCNS-driven virtual insect. Observe sensory inputs, neural readouts and walking behavior.</p><a href="#virtual-fly">ENTER LAB <span>↗</span></a><small>One fly · Controlled arenas · Reproducible experiments</small></section></div><p className="experience-footnote">Real structural connectivity. Simulated bodies and neural dynamics. No physical hardware deployment or biological fidelity claim.</p></main>;
}
