export type Evidence = 'DOCUMENTED' | 'INFERRED';

export interface Population {
  id: string;
  label: string;
  role: 'sensory' | 'descending' | 'motor';
  count: number;
  evidence: Evidence;
  evidence_note: string;
  sources: string[];
}

export interface PopulationsResponse {
  dataset: string;
  version: string;
  populations: Population[];
}

export interface PathwayNode {
  id: string;
  type: string | null;
  class: string | null;
  superclass: string | null;
  side: string | null;
  side_field: string | null;
  region: string | null;
  neurotransmitter: string | null;
  role: 'sensory' | 'intermediate' | 'downstream';
  layer: number;
  evidence: Evidence;
}

export interface PathwayEdge {
  source: string;
  target: string;
  weight: number;
}

export interface PathwayResponse {
  dataset: string;
  version: string;
  source_population: Pick<Population, 'id' | 'label' | 'count' | 'evidence'>;
  target_population: Pick<Population, 'id' | 'label' | 'count' | 'evidence'>;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  summary: {
    min_hops: number | null;
    reachable_targets: number;
    node_count: number;
    edge_count: number;
    truncated: boolean;
    selection: string;
  };
  scientific_note: string;
}
