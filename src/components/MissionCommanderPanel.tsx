import { useEffect, useRef, useState } from 'react';
import type { MissionSnapshot } from '../simulation/commanderSnapshot';
import { systemSummary } from '../simulation/commanderSnapshot';
import { CommanderClient, QUICK_QUESTIONS } from '../simulation/commanderClient';
import { missionTime } from './RescuePanel';
import './commander.css';
import { offlinePriority, offlineUncertainties } from '../mission/commanderFallback';
export function MissionCommanderPanel({getSnapshot, compact=false, variant='default'}:{getSnapshot:()=>MissionSnapshot; compact?:boolean; variant?:'default'|'mission'}) {
  const current=useRef(getSnapshot);current.current=getSnapshot;
  const client=useRef<CommanderClient|null>(null);
  const [,render]=useState(0),[question,setQuestion]=useState(''),[configured,setConfigured]=useState<boolean|null>(null);
  const [model,setModel]=useState('backend configured model');
  const refresh=()=>render(v=>v+1);
  useEffect(()=>{
    const c=new CommanderClient();client.current=c;let active=true;
    const abort=new AbortController();
    void fetch('http://127.0.0.1:8000/commander/status',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(r=>{if(active){setConfigured(r.configured===true);setModel(typeof r.model==='string'?r.model:'unknown');}}).catch(()=>{if(active)setConfigured(false);});
    const timer=setInterval(()=>{void c.tick(()=>current.current(),refresh);refresh();},500);
    return()=>{active=false;abort.abort();clearInterval(timer);c.dispose();};
  },[]);
  const c=client.current,s=getSnapshot(),brief=c?.reply?.status==='online'?c.reply.brief:null;
  const ask=(q:string)=>{void client.current?.ask(()=>current.current(),q,refresh);};
  if(variant==='mission'){
    const offline=c?.offline||(configured===false&&c?.reply?.status!=='online');
    const uncertainties=brief?.uncertainties?.length?brief.uncertainties:offlineUncertainties(s);
    const top=brief?.priorities?.[0];const fb=offlinePriority(s);
    const state=c?.busy?'analyzing':brief?'online':offline?'offline':'idle';
    return <section className="mx-cmd" aria-label="AI Rescue Commander">
      <header className="mx-cmd__head"><div><p className="mx-overline">AI RESCUE COMMANDER</p><h2>Operator briefing</h2></div>
        <span className={`mx-chip mx-cmd__state is-${state}`}>{state==='analyzing'?'Analyzing…':state==='online'?'AI brief':state==='offline'?'Offline · rule summary':'Rule summary'}</span></header>
      <p className="mx-cmd__note">Advisory only. AI cannot control BioBugs; human operators decide.</p>
      <div className="mx-cmd__section system-summary"><h3><span aria-hidden="true">◉</span> SYSTEM SUMMARY</h3><p>{brief?.situationSummary??systemSummary(s)}</p>
        {brief&&<small className="mx-mono">AI snapshot {missionTime(c!.reply!.missionTime)} · {c?.reply?.model??model}</small>}</div>
      <div className="mx-cmd__section mx-cmd__section--uncertain"><h3><span aria-hidden="true">?</span> Uncertainties</h3><ul>{uncertainties.map((v,i)=><li key={i}>{v}</li>)}</ul></div>
      <div className="mx-cmd__section mx-cmd__section--priority"><h3><span aria-hidden="true">➜</span> Suggested next priority</h3>
        <p className="mx-cmd__priority">{top?`${top.priority}${top.sector?` · Sector ${top.sector}`:''}`:fb.title}</p><p>{top?top.reason:fb.reason}</p>
        {!top&&<small>Deterministic rule from observed facts · not AI output</small>}</div>
      <div className="mx-cmd__ask"><p className="mx-overline">ASK THE COMMANDER</p><div className="commander-questions">{QUICK_QUESTIONS.map(q=><button className="mx-btn mx-btn--ghost" disabled={c?.busy||(c?.cooldownMs??0)>0} key={q} onClick={()=>ask(q)}>{q}</button>)}</div>
        {(c?.cooldownMs??0)>0&&<small>Next request in {Math.ceil(c!.cooldownMs/1000)} s.</small>}
        {brief?.answer&&<div className="mx-cmd__answer"><h3>Answer</h3><p>{brief.answer}</p></div>}
        <small>Questions send observed mission facts (no ground truth) to OpenAI via the backend.</small></div>
      <details className="mx-cmd__history"><summary>Briefing history ({c?.history.length??0}/8)</summary>{c?.history.map((e,i)=><div key={i}><h3>{missionTime(e.time)} · {e.question}</h3><p>{e.brief.answer}</p></div>)}</details>
    </section>;
  }
  return <section className={`card commander-panel ${compact ? 'commander-compact' : ''}`} aria-label="AI Rescue Commander">
    <p className="eyebrow">AI RESCUE COMMANDER · ADVISORY ONLY</p>
    <h2>{c?.busy?'AI COMMANDER ANALYZING...':c?.offline||(configured===false&&c?.reply?.status!=='online')?'AI COMMANDER OFFLINE':'Operator briefing'}</h2>
    <p className="muted">{c?.reply?.model??model} · mission facts only. AI cannot control BioBugs. Human operators make decisions.</p>
    {!compact&&<button disabled={c?.busy||(c?.cooldownMs??0)>0} onClick={()=>ask('Mission summary')}>UPDATE BRIEF</button>}
    {(c?.cooldownMs??0)>0&&<p className="muted">Next request available in {Math.ceil(c!.cooldownMs/1000)} s.</p>}
    {!compact&&<><label className="commander-auto"><input type="checkbox" checked={c?.auto??false} onChange={e=>{if(client.current){client.current.auto=e.target.checked;refresh();}}}/> Automatic event briefings (at most once / 15 s)</label>
    <p className="muted">Enabling briefings sends observed telemetry and your question to OpenAI through the backend. No hidden targets or connectome matrices are sent.</p></>}
    <div className="system-summary"><strong>SYSTEM SUMMARY</strong><p>{systemSummary(s)}</p></div>
    <div className="commander-questions">{(compact?QUICK_QUESTIONS.filter(q=>q!=='What should rescuers inspect first?'):QUICK_QUESTIONS).map(q=><button disabled={c?.busy||(c?.cooldownMs??0)>0} key={q} onClick={()=>ask(q)}>{q}</button>)}</div>
    {compact&&<small>AI requests send observed mission facts to OpenAI. Advisory only.</small>}
    {brief&&<div className="commander-brief"><p className="eyebrow">AI-SELECTED VERIFIED FACTS · snapshot {missionTime(c!.reply!.missionTime)}</p>
      <h3>Situation</h3><p>{brief.situationSummary}</p><h3>Priorities</h3><ol>{brief.priorities.map((p,i)=><li key={i}><strong>{p.priority}{p.sector?` · Sector ${p.sector}`:''}</strong> {p.reason}</li>)}</ol>
      <h3>Key findings</h3><ul>{brief.keyFindings.map((v,i)=><li key={i}>{v}</li>)}</ul>
      <h3>Answer</h3><p>{brief.answer}</p><h3>Uncertainties</h3><ul>{brief.uncertainties.map((v,i)=><li key={i}>{v}</li>)}</ul>
      <h3>Suggested operator actions</h3><ul>{brief.suggestedOperatorActions.map((v,i)=><li key={i}>{v}</li>)}</ul></div>}
    {!compact&&<>
    <form onSubmit={e=>{e.preventDefault();if(question.trim())ask(question.trim());}}><label>Ask about this mission<textarea value={question} maxLength={500} onChange={e=>setQuestion(e.target.value)} placeholder="Why was the survivor confirmed?"/></label><button disabled={c?.busy||(c?.cooldownMs??0)>0||!question.trim()}>ASK COMMANDER</button></form>
    {c?.reply?.metrics&&<p className="muted">AI latency mean / p95: {c.reply.metrics.meanLatencyMs.toFixed(0)} / {c.reply.metrics.p95LatencyMs.toFixed(0)} ms · {c.reply.metrics.successfulRequests} accepted responses. Snapshot {c.reply.metrics.snapshotBytes} B · approximate request {c.reply.metrics.approxRequestBytes} B · response {c.reply.metrics.responseBytes} B.</p>}
    {!c?.reply?.metrics&&<p className="muted">AI latency: no successful samples yet.</p>}
    </>}
    <details><summary>Briefing history ({c?.history.length??0}/8)</summary>{c?.history.map((e,i)=><div key={i}><h3>{missionTime(e.time)} · {e.question}</h3><p>{e.brief.answer}</p></div>)}</details>
  </section>;
}

