const assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const load=require('../scripts/compile_unified_lab.cjs')();
const {MissionFindings}=load('unified-lab/MissionFindings');
const {createSwarm,runSwarm,advanceSwarm,swarmSnapshot}=load('simulation/swarm');
const {buildMissionSnapshot}=load('simulation/commanderSnapshot');
const s=createSwarm(4),render=(selected=null)=>renderToStaticMarkup(React.createElement(MissionFindings,{discoveries:swarmSnapshot(s).rescue.discoveries,selected,onSelect:()=>{}}));
const empty=render();assert(empty.includes('Waiting for the first signal'));for(const target of s.rescue.targets)assert(!empty.includes(target.id));
console.log('PASS initial mission findings do not expose hidden target identities');
runSwarm(s,true);for(let i=0;i<3600;i++)advanceSwarm(s,1/60);
assert(s.rescue.discoveries.length>0);const before=JSON.stringify(s);
for(const d of s.rescue.discoveries){const html=render(d.id);assert(html.includes(`Sector ${d.sector}`));assert(html.includes(d.detectedBy));assert(html.includes('not a medical probability'));assert(html.includes('Estimated location'));if(d.kind==='life'&&d.status==='confirmed')assert(html.includes('no person has been extracted'));}
assert.equal(JSON.stringify(s),before);console.log('PASS observed findings render actual evidence, distinguish detection from extraction and preserve state');
const report=buildMissionSnapshot(createSwarm(4));assert.deepEqual(report.survivors,[]);assert.deepEqual(report.hazards,[]);assert(!JSON.stringify(report).includes('groundTruthPosition'));console.log('PASS fresh mission export contains no undiscovered survivors or hazards');
