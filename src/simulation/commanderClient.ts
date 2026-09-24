import type { MissionSnapshot } from './commanderSnapshot';
export const QUICK_QUESTIONS=['Mission summary','Where are survivors?','What are the hazards?','What should rescuers inspect first?','Explain MaleCNS'];
export interface Brief {situationSummary:string;priorities:{priority:'HIGH'|'MEDIUM'|'LOW';title:string;reason:string;sector:string|null}[];keyFindings:string[];answer:string;uncertainties:string[];suggestedOperatorActions:string[]}
export interface Metrics {latencyMs:number;meanLatencyMs:number;p95LatencyMs:number;successfulRequests:number;snapshotBytes:number;meanSnapshotBytes:number;approxRequestBytes:number;responseBytes:number}
export interface Reply {status:'online'|'offline';model:string;missionTime:number;error?:string;brief?:Brief;metrics?:Metrics}
export interface Entry {time:number;question:string;brief:Brief}
export function parseCommander(raw:unknown):Reply {
  const r=raw as Reply, text=(s:unknown)=>typeof s==='string'&&s.length<=5000, list=(a:unknown)=>Array.isArray(a)&&a.length<=8&&a.every(text);
  if(!r||!['online','offline'].includes(r.status)||!text(r.model)||!Number.isFinite(r.missionTime))throw Error('Invalid Commander envelope');
  if(r.status==='offline')return {status:'offline',model:r.model,missionTime:r.missionTime,error:'AI COMMANDER OFFLINE'};
  const b=r.brief,m=r.metrics;
  if(!b||!text(b.situationSummary)||!text(b.answer)||!list(b.keyFindings)||!list(b.uncertainties)||!list(b.suggestedOperatorActions)||
    !Array.isArray(b.priorities)||b.priorities.length>4||!b.priorities.every(p=>['HIGH','MEDIUM','LOW'].includes(p.priority)&&text(p.title)&&text(p.reason)&&(p.sector===null||/^[A-D][1-4]$/.test(p.sector)))||
    !m||!['latencyMs','meanLatencyMs','p95LatencyMs','successfulRequests','snapshotBytes','meanSnapshotBytes','approxRequestBytes','responseBytes'].every(k=>Number.isFinite(m[k as keyof Metrics])&&m[k as keyof Metrics]>=0))throw Error('Invalid Commander response');
  return r;
}
export async function requestCommander(snapshot:MissionSnapshot,question:string,signal:AbortSignal) {
  const r=await fetch('http://127.0.0.1:8000/commander/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot,question}),signal});
  if(!r.ok)throw Error('Commander unavailable');return parseCommander(await r.json());
}
/** Read-only async client: no navigation/control callback exists. One in-flight request, bounded history. */
export class CommanderClient {
  history:Entry[]=[];reply:Reply|null=null;busy=false;auto=false;offline=false;
  private disposed=false;private pending:AbortController|null=null;private lastRequest=-Infinity;
  private signature='';private due:number|null=null;
  constructor(private request=requestCommander,private now=()=>performance.now()){}
  get cooldownMs(){return Math.max(0,5000-(this.now()-this.lastRequest));}
  dispose(){this.disposed=true;this.pending?.abort();this.due=null;}
  observe(snapshot:MissionSnapshot){
    const signature=JSON.stringify([snapshot.recentEvents,snapshot.completedAt]);
    if(signature!==this.signature){this.signature=signature;if(snapshot.recentEvents.length)this.due=this.now()+4000;}
  }
  async tick(current:()=>MissionSnapshot,update:()=>void){
    const s=current();this.observe(s);
    if(this.auto&&this.due!==null&&this.now()>=this.due&&this.now()-this.lastRequest>=15000&&!this.busy){this.due=null;await this.ask(current,'Mission event update',update);}
  }
  async ask(current:()=>MissionSnapshot,question:string,update:()=>void=()=>{}) {
    if(this.disposed||this.busy||this.now()-this.lastRequest<5000)return;
    // Detach completely from the mutable mission. The current snapshot is captured at click/request time.
    const snapshot=JSON.parse(JSON.stringify(current())) as MissionSnapshot;
    this.busy=true;this.lastRequest=this.now();this.due=null;const abort=new AbortController();this.pending=abort;update();
    const timeout=setTimeout(()=>abort.abort(),25000);
    try {
      const reply=parseCommander(await this.request(snapshot,question.slice(0,500),abort.signal));
      if(!this.disposed&&!abort.signal.aborted){this.reply=reply;this.offline=reply.status==='offline';if(reply.brief&&reply.status==='online'){this.history=[{time:snapshot.missionTime,question,brief:reply.brief},...this.history].slice(0,8);}else this.auto=false;}
    }catch{if(!this.disposed){this.offline=true;this.auto=false;this.reply=null;}}
    finally{clearTimeout(timeout);this.pending=null;this.busy=false;if(!this.disposed)update();}
  }
}
