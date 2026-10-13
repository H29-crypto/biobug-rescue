import { Component, lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import App from './App';
import { FieldAtlas } from './components/FieldAtlas';
import './experiences.css';

const UnifiedLab = lazy(() => import('./unified-lab/UnifiedLab'));
const ResearchLab = lazy(() => import('./research/ResearchLab'));
class ExperienceLoadBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error:Error) { console.error('Unable to load this experience.',error); }
  render() {
    if(!this.state.failed)return this.props.children;
    return <section className="experience-error" role="alert" aria-labelledby="experience-error-title">
      <p className="field-kicker">THIS SECTION DID NOT LOAD</p>
      <h1 id="experience-error-title">The experience could not open.</h1>
      <p>A page asset may be out of date or temporarily unavailable. Reload to try again, or continue to another section.</p>
      <div><button className="field-primary" onClick={()=>window.location.reload()}>Reload this page</button><a href="#rescue">Open Rescue</a><a href="#research">Open Research &amp; Evidence</a></div>
    </section>;
  }
}
function selectedExperience() {
  return location.hash === '#research' ? 'research' : location.hash === '#rescue' ? 'rescue'
    : location.hash === '#virtual-fly' ? 'experiment' : location.hash === '#virtual-lab' ? 'lab' : 'home';
}
export default function Experiences() {
  const [experience, setExperience] = useState(selectedExperience);
  useEffect(() => {
    const change = () => { setExperience(selectedExperience()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return <div className="field-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView(); }}>Skip to content</a>
    <header className="field-header">
      <a href="#" className="field-brand" aria-label="BioBug home"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 7V33M14 14L6 9M14 20H4M14 26L6 32M26 14L34 9M26 20H36M26 26L34 32"/><ellipse cx="20" cy="21" rx="7" ry="12"/><circle cx="20" cy="6" r="3"/></svg><span>BioBug<small>EXPLORATION RESEARCH</small></span></a>
      <nav aria-label="Main navigation"><a href="#rescue" aria-current={experience === 'rescue' ? 'page' : undefined}>Rescue</a><a href="#virtual-lab" aria-current={['lab', 'experiment'].includes(experience) ? 'page' : undefined}>Virtual lab</a><a href="#research" aria-current={experience === 'research' ? 'page' : undefined}>Research & evidence</a></nav>
      <span className="field-edition">FIELD NOTES <span>№ 001 / 2026</span></span>
    </header>
    <div id="main-content" tabIndex={-1}>
      {experience === 'home' ? <main className="field-home">
        <section className="field-intro"><div className="field-intro-copy"><p className="field-kicker">BIOLOGY INSPIRES. EVIDENCE GUIDES.</p><h1>Exploring the<br/>unreachable.</h1><p className="field-deck">Small autonomous explorers.<br/>A shared view of what lies beyond.</p><p className="field-description">A research platform for insect-inspired rescue. Explore an unknown structure, inspect neural activity, and test the decisions that guide a swarm.</p><div className="field-actions"><a className="field-primary" href="#rescue">Explore the simulation <span>↗</span></a><a href="#research">Read the evidence <span>→</span></a></div></div>
          <figure className="field-atlas"><FieldAtlas/><figcaption><span>FIG. 01 — A SHARED FIELD OF VIEW</span><span>Measured simulation · 4 agents · 60 s</span></figcaption></figure></section>
        <section className="field-index" aria-label="Explore the project"><a href="#rescue"><span className="field-index-number">01</span><div><h2>A mission to understand.</h2><p>Deploy a swarm. Follow the discoveries.</p><span>Rescue simulation ↗</span></div></a><a href="#virtual-lab"><span className="field-index-number">02</span><div><h2>A circuit to explore.</h2><p>Real connectivity. Simulated activity.</p><span>Virtual laboratory ↗</span></div></a><a href="#research"><span className="field-index-number">03</span><div><h2>A result to reproduce.</h2><p>Three environments. Thirty recorded trials.</p><span>Methods & evidence ↗</span></div></a></section>
        <section className="field-principle"><p className="field-kicker">THE RESEARCH QUESTION</p><h2>How can a small team<br/>reveal more of an unknown space?</h2><div><p>We connect biological structure with explicit engineering models, then compare exploration strategies under the same conditions.</p><p>Open methods, visible assumptions, and results you can run again.</p><a href="#research">Explore the comparative study →</a></div></section>
        <footer className="field-home-footer"><span>BioBug / Independent research prototype</span><span>Simulated bodies and sensing. No physical rescue deployment.</span><a href="https://github.com/H29-crypto/biobug-rescue" target="_blank" rel="noreferrer">Source code ↗</a></footer>
      </main> : experience === 'rescue' ? <App/> : <Suspense fallback={<div className="experience-loading">Opening the laboratory…</div>}>
        {experience === 'research' ? <ResearchLab/> : <UnifiedLab key={experience} initial={experience === 'experiment' ? 'experiment' : 'rescue'}/>}
      </Suspense>}
    </div>
  </div>;
}
