import { DynamicsLab } from './DynamicsLab';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PathwayResponse, Population, PopulationsResponse } from './pathways.types';
import './pathways.css';

const API = 'http://127.0.0.1:8000';
const formatCount = (value: number) => value.toLocaleString();
const label = (value: string | null) => value || 'Not annotated';
const datasetVersion = (value: string) => value.startsWith('v') ? value : `v${value}`;

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal });
  if (!response.ok) {
    let detail = `Backend returned HTTP ${response.status}.`;
    try {
      const payload: unknown = await response.json();
      if (payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string') {
        detail = payload.detail;
      }
    } catch { /* Keep the HTTP error when the response is not JSON. */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function PopulationEvidence({ population }: { population: Population | undefined }) {
  if (!population) return null;
  return <div className="pathways-population-evidence">
    <strong>{population.label}</strong> <span className={`pathways-evidence ${population.evidence.toLowerCase()}`}>{population.evidence}</span>
    <p>{population.evidence_note}</p>
    {population.sources.length > 0 && <div className="pathways-sources">{population.sources.map((source, index) =>
      <a href={source} target="_blank" rel="noreferrer" key={source}>Source {index + 1}</a>)}</div>}
  </div>;
}

function StructuralGraph({ graph, selected, onSelect }: { graph: PathwayResponse; selected: string | null; onSelect: (id: string) => void }) {
  const markerId = useId().replace(/:/g, '');
  const layout = useMemo(() => {
    const layers = [...new Set(graph.nodes.map(node => node.layer))].sort((a, b) => a - b);
    const maxPerLayer = Math.max(1, ...layers.map(layer => graph.nodes.filter(node => node.layer === layer).length));
    const height = Math.max(300, maxPerLayer * 70 + 90);
    const width = Math.max(820, layers.length * 220);
    const positions = new Map<string, { x: number; y: number }>();
    layers.forEach((layer, index) => {
      const nodes = graph.nodes.filter(node => node.layer === layer);
      const x = layers.length === 1 ? width / 2 : 100 + index * (width - 200) / (layers.length - 1);
      nodes.forEach((node, row) => positions.set(node.id, { x, y: 70 + (row + 0.5) * (height - 100) / nodes.length }));
    });
    return { layers, positions, height, width };
  }, [graph]);

  return <div className="pathways-graph-scroll" tabIndex={0} aria-label="Scrollable structural graph">
    <svg className="pathways-graph" viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ minWidth: layout.width }} aria-label="Real MaleCNS structural subgraph. Select a neuron for its annotations and measured connections.">
      <defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#72978b"/></marker></defs>
      {layout.layers.map((layer, index) => <text className="pathways-layer" x={layout.layers.length === 1 ? layout.width / 2 : 100 + index * (layout.width - 200) / (layout.layers.length - 1)} y={30} textAnchor="middle" key={layer}>{layer === 0 ? 'SOURCE' : `POSITION ${layer}`}</text>)}
      {graph.edges.map(edge => {
        const from = layout.positions.get(edge.source);
        const to = layout.positions.get(edge.target);
        if (!from || !to) return null;
        const active = edge.source === selected || edge.target === selected;
        const curve = Math.max(35, Math.abs(to.x - from.x) * 0.42);
        return <g className={`pathways-edge${active ? ' selected' : ''}`} key={`${edge.source}-${edge.target}`}>
          <title>{edge.source} → {edge.target}: {formatCount(edge.weight)} measured synaptic contacts</title>
          <path d={`M${from.x + 80},${from.y} C${from.x + 80 + curve},${from.y} ${to.x - 80 - curve},${to.y} ${to.x - 82},${to.y}`} markerEnd={`url(#${markerId})`} strokeWidth={Math.min(4, 0.8 + Math.log2(edge.weight + 1) / 3)} />
          {active && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5} textAnchor="middle">{formatCount(edge.weight)}</text>}
        </g>;
      })}
      {graph.nodes.map(node => {
        const position = layout.positions.get(node.id)!;
        const name = node.type || node.class || node.superclass || 'Unannotated neuron';
        return <g className={`pathways-node ${node.role}${selected === node.id ? ' selected' : ''}`} key={node.id} transform={`translate(${position.x}, ${position.y})`} role="button" tabIndex={0} aria-pressed={selected === node.id} aria-label={`Neuron ${node.id}, ${name}, ${label(node.side)}, ${node.role}. Select to inspect.`} onClick={() => onSelect(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }}>
          <title>{name} · ID {node.id} · {label(node.side)} · {node.evidence}</title>
          <rect x={-80} y={-24} width={160} height={48} rx={7}/>
          <text textAnchor="middle" y={-5}>{name.length > 21 ? `${name.slice(0, 19)}…` : name}</text>
          <text className="pathways-node-id" textAnchor="middle" y={12}>{node.id}{node.side ? ` · ${node.side}` : ''}</text>
        </g>;
      })}
    </svg>
  </div>;
}

export function PathwayExplorer() {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [populations, setPopulations] = useState<Population[]>([]);
  const [populationState, setPopulationState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [source, setSource] = useState('tactile');
  const [target, setTarget] = useState('DNa02');
  const [graph, setGraph] = useState<PathwayResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graphRequest = useRef<{ abort: AbortController; sequence: number } | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setPopulationState('loading');
    setError(null);
    fetchJson<PopulationsResponse>('/connectome/populations', controller.signal).then(data => {
      if (controller.signal.aborted) return;
      const sensory = data.populations.filter(population => population.role === 'sensory');
      const downstream = data.populations.filter(population => population.role !== 'sensory');
      setPopulations(data.populations);
      setSource(value => sensory.some(population => population.id === value) ? value : sensory[0]?.id || '');
      setTarget(value => downstream.some(population => population.id === value) ? value : downstream[0]?.id || '');
      setPopulationState('ready');
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setPopulationState('error');
      setError(cause instanceof Error ? cause.message : 'Could not load populations.');
    });
    return () => controller.abort();
  }, [open, retry]);

  useEffect(() => () => { graphRequest.current?.abort.abort(); }, []);

  function changePopulation(kind: 'source' | 'target', value: string) {
    graphRequest.current?.abort.abort();
    sequence.current += 1;
    setLoading(false);
    setError(null);
    setGraph(null);
    setSelected(null);
    if (kind === 'source') setSource(value); else setTarget(value);
  }

  async function loadGraph() {
    graphRequest.current?.abort.abort();
    const request = { abort: new AbortController(), sequence: ++sequence.current };
    graphRequest.current = request;
    setLoading(true);
    setError(null);
    setGraph(null);
    setSelected(null);
    const params = new URLSearchParams({ source, target, max_nodes: '32', max_edges: '64' });
    try {
      const data = await fetchJson<PathwayResponse>(`/connectome/pathway-subgraph?${params}`, request.abort.signal);
      if (request.abort.signal.aborted || sequence.current !== request.sequence) return;
      setGraph(data);
      setSelected(data.nodes[0]?.id || null);
    } catch (cause: unknown) {
      if (request.abort.signal.aborted || sequence.current !== request.sequence) return;
      setError(cause instanceof Error ? cause.message : 'Could not load the structural graph.');
    } finally {
      if (!request.abort.signal.aborted && sequence.current === request.sequence) setLoading(false);
    }
  }

  const selectedNode = graph?.nodes.find(node => node.id === selected);
  const connectedEdges = graph?.edges.filter(edge => edge.source === selected || edge.target === selected) || [];
  const sourcePopulation = populations.find(population => population.id === source);
  const targetPopulation = populations.find(population => population.id === target);

  return <details className="pathways-panel" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span><span className="eyebrow">DEVELOPMENT · STRUCTURE INSPECTION</span><strong>MaleCNS pathway explorer</strong></span><span className="pathways-summary-note">Read-only research view</span></summary>
    <div className="pathways-body">
      <p className="pathways-intro">Inspect real MaleCNS structural connectivity. Edges show measured contact counts. This inspection view and the manual dynamics lab below are separate from the selected mission controller. Live MaleCNS movement telemetry appears above when that mode is selected.</p>
      <div className="pathways-evidence-key"><span><b>DOCUMENTED</b> Function supported by dataset or publication.</span><span><b>INFERRED</b> Interpretation from annotations or connectivity.</span><span><b>ENGINEERING MAPPING</b> A proposed simulation interface.</span></div>
      <div className="pathways-controls">
        <label>Sensory candidate<select value={source} onChange={event => changePopulation('source', event.target.value)} disabled={populationState !== 'ready'}>{populations.filter(population => population.role === 'sensory').map(population => <option value={population.id} key={population.id}>{population.label} ({formatCount(population.count)})</option>)}</select></label>
        <label>Downstream candidate<select value={target} onChange={event => changePopulation('target', event.target.value)} disabled={populationState !== 'ready'}>{populations.filter(population => population.role !== 'sensory').map(population => <option value={population.id} key={population.id}>{population.label} ({formatCount(population.count)})</option>)}</select></label>
        <button onClick={() => { void loadGraph(); }} disabled={populationState !== 'ready' || !source || !target || loading}>{loading ? 'Loading subgraph…' : graph ? 'Reload subgraph' : 'Load subgraph'}</button>
      </div>
      <div className="pathways-message" aria-live="polite">
        {populationState === 'loading' && <p>Loading annotated populations from the local backend…</p>}
        {populationState === 'ready' && !graph && !loading && !error && <p>Select candidate populations and load a bounded subgraph: up to 3 hops, 32 neurons and 64 connections.</p>}
        {loading && <p>Querying the sparse connectome. The first request may take a moment.</p>}
        {error && <div className="pathways-error" role="alert"><strong>Connectome data unavailable</strong><p>{error}</p><p>Run the MaleCNS backend at <code>{API}</code> with its dataset loaded. The disaster simulation can still run independently.</p>{populationState === 'error' && <button onClick={() => setRetry(value => value + 1)}>Retry backend connection</button>}</div>}
      </div>
      {populationState === 'ready' && <div className="pathways-populations"><PopulationEvidence population={sourcePopulation}/><PopulationEvidence population={targetPopulation}/></div>}
      <div className="pathways-mapping"><strong>ENGINEERING SENSOR MAPPING</strong><span>Front / left / right obstacle signals</span><small>Inspection view · live inputs shown in controller panel</small></div>
      {graph && <section className="pathways-result" aria-label="Loaded MaleCNS subgraph">
        <div className="pathways-result-heading"><strong>REAL {graph.dataset} {datasetVersion(graph.version)} STRUCTURE</strong><span>{formatCount(graph.nodes.length)} neurons · {formatCount(graph.edges.length)} connections shown</span></div>
        <p className="pathways-stats">Shortest route: {graph.summary.min_hops === null ? 'none within the search bound' : `${graph.summary.min_hops} hop${graph.summary.min_hops === 1 ? '' : 's'}`} · Reachable target neurons: {formatCount(graph.summary.reachable_targets)} · {graph.summary.truncated ? 'Bounded sample; additional structure omitted.' : 'Within the configured search bound.'}</p>
        <p className="pathways-selection">{graph.summary.selection} Columns use the earliest position of each neuron across sampled routes.</p>
        {graph.nodes.length > 0 ? <div className="pathways-inspection"><StructuralGraph graph={graph} selected={selected} onSelect={setSelected}/><section className="pathways-inspector" aria-label="Selected neuron annotations">
          <h3>Selected real neuron</h3>
          {selectedNode && <><strong className="pathways-neuron-title">{selectedNode.type || selectedNode.class || 'Unannotated neuron'}</strong><span className={`pathways-evidence ${selectedNode.evidence.toLowerCase()}`}>{selectedNode.evidence}</span><dl>
            <div><dt>Neuron ID</dt><dd>{selectedNode.id}</dd></div>
            <div><dt>Type</dt><dd>{label(selectedNode.type)}</dd></div>
            <div><dt>Class</dt><dd>{label(selectedNode.class)}</dd></div>
            <div><dt>Superclass</dt><dd>{label(selectedNode.superclass)}</dd></div>
            <div><dt>Side</dt><dd>{label(selectedNode.side)}</dd></div>
            <div><dt>Side field</dt><dd>{label(selectedNode.side_field)}</dd></div>
            <div><dt>Region</dt><dd>{label(selectedNode.region)}</dd></div>
            <div><dt>NT prediction</dt><dd>{label(selectedNode.neurotransmitter)}</dd></div>
            <div><dt>Display role</dt><dd>{selectedNode.role}</dd></div>
          </dl><p>Side is anatomical metadata, not a turn command. Display role describes position in this query.</p>
          <h3>Contacts in displayed subgraph</h3><div className="pathways-contacts"><table><thead><tr><th>Direction / other neuron</th><th>Contacts</th></tr></thead><tbody>{connectedEdges.map(edge => <tr key={`${edge.source}-${edge.target}`}><td><button onClick={() => setSelected(edge.source === selected ? edge.target : edge.source)}>{edge.source === selected ? 'Out → ' : 'In ← '}{edge.source === selected ? edge.target : edge.source}</button></td><td>{formatCount(edge.weight)}</td></tr>)}</tbody></table>{connectedEdges.length === 0 && <p>No incident connections in this bounded sample.</p>}</div></>}
        </section></div> : <p className="pathways-empty">No connecting subgraph was returned for this pair within the search bound.</p>}
        <p className="pathways-scientific-note">{graph.scientific_note}</p>
      </section>}
      {!graph && <div className="pathways-placeholder">REAL MaleCNS STRUCTURE<span>{loading ? 'Loading selected subgraph…' : 'Load a subgraph to inspect neurons and their connections.'}</span></div>}
      <div className="pathways-mapping"><strong>ENGINEERING MOTOR DECODER</strong><span>Mission control uses a separate movement decoder</span><small>This sampled structural view does not issue commands</small></div>
      <p className="pathways-footnote">Structural connectivity alone is not an executable or biologically accurate fly-brain simulation. Movement requires the separately labeled engineering sensor mapping, simulated dynamics and motor decoder.</p>
      <DynamicsLab/>
    </div>
  </details>;
}
