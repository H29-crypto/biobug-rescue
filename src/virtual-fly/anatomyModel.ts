export interface MorphologyNeuron {
  body_id:string;population:'ProLN'|'intermediate'|'DNa02';type:string|null;
  annotation:{class:string|null;superclass:string;entryNerve:string|null;rootSide:string|null;somaSide:string|null};
  available:boolean;node_count:number;segment_count:number;segment_offset:number;
  incoming_edges:number;outgoing_edges:number;incoming_contacts:number;outgoing_contacts:number;
  bounding_box:{min:number[];max:number[]}|null;
}
export interface MorphologyManifest {
  dataset:'MaleCNS';version:'v1.0';requested:number;available:number;graph_sha256:string;
  node_count:number;segment_count:number;swc_bytes:number;
  transform:{scale:number;center_native:number[];render_unit:string;axis_matrix:number[][]};
  binary:{file:string;bytes:number;sha256:string};neurons:MorphologyNeuron[];
}
export type PopulationFilter='all'|'ProLN'|'intermediate'|'DNa02';
export function validateManifest(raw:unknown):MorphologyManifest{
  const m=raw as MorphologyManifest;
  if(!m||m.dataset!=='MaleCNS'||m.version!=='v1.0'||m.requested!==295||!Array.isArray(m.neurons)||m.neurons.length!==295||
    new Set(m.neurons.map(n=>n.body_id)).size!==295||!m.binary||m.binary.file!=='skeletons.bin'||
    !/^[a-f0-9]{64}$/.test(m.graph_sha256)||!/^[a-f0-9]{64}$/.test(m.binary.sha256)||m.binary.bytes!==m.segment_count*24||
    m.transform?.scale!==.008||!Array.isArray(m.transform.center_native)||m.transform.center_native.length!==3||!m.transform.center_native.every(Number.isFinite)||
    JSON.stringify(m.transform.axis_matrix)!=='[[1,0,0],[0,1,0],[0,0,1]]')throw Error('Invalid MaleCNS morphology manifest');
  let offset=0,nodes=0,available=0;
  for(const n of m.neurons){
    if(!/^\d+$/.test(n.body_id)||!['ProLN','intermediate','DNa02'].includes(n.population)||n.segment_offset!==offset||
      ![n.node_count,n.segment_count,n.incoming_edges,n.outgoing_edges,n.incoming_contacts,n.outgoing_contacts].every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('Invalid neuron geometry range');
    if(n.available){available++;offset+=n.segment_count;nodes+=n.node_count;}
    else if(n.segment_count!==0)throw Error('Missing neuron has geometry');
  }
  if(offset!==m.segment_count||nodes!==m.node_count||available!==m.available)throw Error('Inconsistent morphology totals');
  return m;
}
export const ACTIVE_THRESHOLD=1e-9;
export function visibleNeuron(n:MorphologyNeuron,filter:PopulationFilter,activeOnly:boolean,value:number|null){
  return n.available&&(filter==='all'||n.population===filter)&&(!activeOnly||(value!==null&&value>ACTIVE_THRESHOLD));
}
