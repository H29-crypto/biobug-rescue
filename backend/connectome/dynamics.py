"""Experimental bounded rate dynamics; real structure is an immutable input.

All weights, signs, time steps and activity values in this module are engineering
choices. Nothing here controls BioBug or estimates biological membrane dynamics.
"""
from __future__ import annotations
from dataclasses import dataclass
import hashlib
import time
from typing import Literal
import numpy as np
import pyarrow as pa
from pydantic import BaseModel, ConfigDict, Field, model_validator
from scipy import sparse
from .annotations import counts, get_population
from .graph import ConnectomeGraph, json_value
from .pathway_analysis import PathwayAnalyzer

PRESETS = {
    'LEFT STIMULUS': {'left': 1., 'front': 0., 'right': 0.},
    'RIGHT STIMULUS': {'left': 0., 'front': 0., 'right': 1.},
    'FRONT STIMULUS': {'left': 0., 'front': 1., 'right': 0.},
    'SYMMETRIC STIMULUS': {'left': 1., 'front': 0., 'right': 1.},
    'NO STIMULUS': {'left': 0., 'front': 0., 'right': 0.},
}

class Stimulus(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    left: float = Field(default=0., ge=0, le=1)
    front: float = Field(default=0., ge=0, le=1)
    right: float = Field(default=0., ge=0, le=1)

class SimulationParameters(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    decay: float = Field(default=.25, gt=0, le=1)
    gain: float = Field(default=.20, ge=0, le=1)
    input_gain: float = Field(default=.5, ge=0, le=1)
    transformation: Literal['incoming_log', 'global_log'] = 'incoming_log'
    sign_mode: Literal['unsigned', 'predicted'] = 'unsigned'
    unknown_sign: Literal['zero', 'positive'] = 'zero'
    nt_confidence_threshold: float = Field(default=.8, ge=0, le=1)

    @model_validator(mode='after')
    def stable_gain(self):
        if self.gain >= self.decay:
            raise ValueError('gain must be less than decay for a contractive unforced model')
        return self

class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    stimulus: Stimulus = Field(default_factory=Stimulus)
    steps: int = Field(default=10, ge=1, le=200, strict=True)
    pulse_steps: int = Field(default=3, ge=0, le=200, strict=True)
    injection_enabled: bool = True
    top_k: int = Field(default=8, ge=1, le=20, strict=True)
    parameters: SimulationParameters = Field(default_factory=SimulationParameters)


def array_bytes(matrix):
    return matrix.data.nbytes + matrix.indices.nbytes + matrix.indptr.nbytes


def fingerprint(graph: ConnectomeGraph) -> str:
    digest = hashlib.sha256()
    for array in (graph.body_ids, graph.adjacency.indptr, graph.adjacency.indices, graph.adjacency.data):
        digest.update(array.tobytes())
    with pa.BufferOutputStream() as stream:
        with pa.ipc.new_stream(stream, graph.neurons.schema) as writer:
            writer.write_table(graph.neurons)
        digest.update(stream.getvalue().to_pybytes())
    return digest.hexdigest()


@dataclass(frozen=True)
class DynamicsGraph:
    structural: ConnectomeGraph
    source_mask: np.ndarray
    target_mask: np.ndarray
    max_hops: int
    build_seconds: float
    structural_sha256: str

    def summary(self):
        graph = self.structural
        return {'neurons': len(graph.body_ids), 'edges': graph.adjacency.nnz,
                'structural_contacts': int(graph.adjacency.data.sum()), 'max_hops': self.max_hops,
                'source_neurons': int(self.source_mask.sum()), 'target_neurons': int(self.target_mask.sum()),
                'sources_with_outgoing_route_edges': int((self.source_mask & (np.diff(graph.adjacency.indptr) > 0)).sum()),
                'intermediate_neurons': int((~self.source_mask & ~self.target_mask).sum()),
                'structural_sha256': self.structural_sha256, 'build_seconds': self.build_seconds,
                'structural_array_bytes': array_bytes(graph.adjacency) + graph.body_ids.nbytes + graph.neurons.nbytes,
                'selection': 'Union of all directed ProLN-tactile-to-DNa02 walks of length 1..max_hops. Retain all annotated ProLN tactile inputs and both DNa02 targets, including route-isolated inputs. Not an induced graph or the small visualization sample.',
                'nt_annotations': {field: counts(graph.neurons, field) for field in ('predicted_nt', 'consensus_nt')},
                'source_laterality': counts(graph.neurons.filter(pa.array(self.source_mask)), 'rootSide'),
                'target_laterality': counts(graph.neurons.filter(pa.array(self.target_mask)), 'somaSide')}


def build_dynamics_graph(graph: ConnectomeGraph, max_hops: int = 2) -> DynamicsGraph:
    started = time.perf_counter()
    if max_hops not in (2, 3):
        raise ValueError('Dynamics extraction supports 2 hops, or 3 hops for offline experiments')
    sm = get_population('front_leg_tactile').mask(graph.neurons)
    tm = get_population('DNa02').mask(graph.neurons)
    if not sm.any() or tm.sum() != 2:
        raise ValueError('Need annotated ProLN tactile cells and exactly two descending DNa02 cells')
    sides = graph.neurons.filter(pa.array(tm))['somaSide'].to_pylist()
    if set(sides) != {'L', 'R'}:
        raise ValueError('DNa02 records must have one actual somaSide L and one R')
    analyzer = PathwayAnalyzer(graph)
    forward = analyzer.frontiers(sm, max_hops)
    backward = analyzer.frontiers(tm, max_hops, reverse=True)
    on_routes = np.zeros(graph.adjacency.nnz, dtype=bool)
    for h in range(1, max_hops + 1):
        for layer in range(h):
            on_routes |= forward[layer][analyzer.rows] & backward[h-layer-1][analyzer.cols]
    positions = np.flatnonzero(on_routes)
    kept = sm | tm
    kept[analyzer.rows[positions]] = True
    kept[analyzer.cols[positions]] = True
    selected = np.flatnonzero(kept)
    if len(selected) > 5000 or len(positions) > 100000:
        raise ValueError('Dynamics graph exceeds 5,000 nodes/100,000 edges; refusing silent truncation')
    indices = np.full(len(graph.body_ids), -1, dtype=np.int32)
    indices[selected] = np.arange(len(selected))
    adjacency = sparse.csr_matrix((analyzer.weights[positions].copy(),
                                  (indices[analyzer.rows[positions]], indices[analyzer.cols[positions]])),
                                 shape=(len(selected), len(selected)))
    bounded = ConnectomeGraph(graph.neurons.take(pa.array(selected)), graph.body_ids[selected].copy(), adjacency)
    source_mask, target_mask = sm[selected].copy(), tm[selected].copy()
    # Freeze copies only. Never change the parent's arrays or its write flags.
    for array in (bounded.body_ids, adjacency.data, adjacency.indices, adjacency.indptr, source_mask, target_mask):
        array.flags.writeable = False
    return DynamicsGraph(bounded, source_mask, target_mask, max_hops,
                         round(time.perf_counter()-started, 6), fingerprint(bounded))


def transmitter_sign(record: dict, parameters: SimulationParameters) -> tuple[float, str]:
    if parameters.sign_mode == 'unsigned':
        return 1., 'unsigned structural baseline; no transmitter effect inferred'
    nt = record.get('consensus_nt')
    confidence = record.get('predicted_nt_confidence')
    supported = (record.get('predicted_nt') == nt and isinstance(confidence, (float, int))
                 and np.isfinite(confidence) and confidence >= parameters.nt_confidence_threshold)
    if supported and nt in ('acetylcholine', 'gaba'):
        return (1. if nt == 'acetylcholine' else -1.), f'ENGINEERING assumed {nt} sign; agreeing body/consensus prediction above threshold, no receptor validation'
    return (0. if parameters.unknown_sign == 'zero' else 1.), 'ENGINEERING fallback: ambiguous/unsupported NT or insufficient agreeing body confidence'


class DynamicsEngine:
    def __init__(self, graph: DynamicsGraph):
        self.graph = graph
        self.records = json_value(graph.structural.neurons.to_pylist())
        self.rows = np.repeat(np.arange(len(self.records)), np.diff(graph.structural.adjacency.indptr))
        self.cols = graph.structural.adjacency.indices
        self.sources = np.flatnonzero(graph.source_mask)
        self.intermediates = np.flatnonzero(~graph.source_mask & ~graph.target_mask)
        self.targets = {r['somaSide']: i for i,r in enumerate(self.records) if graph.target_mask[i]}
        self.roles = ['source' if graph.source_mask[i] else 'target' if graph.target_mask[i] else 'intermediate' for i in range(len(self.records))]
        self.side_fields = ['rootSide' if graph.source_mask[i] else 'somaSide' for i in range(len(self.records))]
        self.groups = {}
        for kind in ('side', 'class', 'type'):
            labels = [f"{self.side_fields[i]}:{r.get(self.side_fields[i]) or '(missing)'}" if kind == 'side' else r.get(kind) or '(missing)' for i,r in enumerate(self.records)]
            self.groups[kind] = {label: np.array([i for i,v in enumerate(labels) if v == label]) for label in sorted(set(labels))}

    def simulation_weights(self, parameters: SimulationParameters):
        base = np.log1p(self.graph.structural.adjacency.data.astype(np.float64))
        incoming = np.bincount(self.cols, weights=base, minlength=len(self.records))
        divisor = np.maximum(1., incoming[self.cols]) if parameters.transformation == 'incoming_log' else max(1., float(incoming.max(initial=0)))
        magnitudes = base / divisor
        signs_and_reasons = [transmitter_sign(r, parameters) for r in self.records]
        signs = np.array([value[0] for value in signs_and_reasons])
        structural = self.graph.structural.adjacency
        weights = sparse.csr_matrix((magnitudes * signs[self.rows], structural.indices.copy(), structural.indptr.copy()), shape=structural.shape)
        return weights, signs_and_reasons

    def input_vector(self, stimulus: Stimulus, enabled: bool = True):
        vector = np.zeros(len(self.records))
        if enabled:
            for i in self.sources:
                side = self.records[i].get('rootSide')
                if side in ('L', 'R'):
                    vector[i] = min(1., (stimulus.left if side == 'L' else stimulus.right) + .5 * stimulus.front)
        return vector

    def node(self, index: int):
        r = self.records[index]
        field = self.side_fields[index]
        return {'id': str(r['bodyId']), 'type': r.get('type'), 'class': r.get('class'),
                'superclass': r.get('superclass'), 'side': r.get(field), 'side_field': field,
                'role': self.roles[index], 'consensus_nt': r.get('consensus_nt'), 'predicted_nt': r.get('predicted_nt'),
                'predicted_nt_confidence': r.get('predicted_nt_confidence'), 'entryNerve': r.get('entryNerve')}

    def rank(self, activity, indices, top_k):
        # IDs break exact ties reproducibly. Zero values are not described as active.
        candidates = indices[activity[indices] > 1e-9]
        order = sorted(candidates, key=lambda i: (-activity[i], int(self.records[i]['bodyId'])))[:top_k]
        return [{**self.node(int(i)), 'activity': float(activity[i])} for i in order]

    def aggregates(self, activity, kind, top_k=None):
        values = [{'label': label, 'count': len(indices), 'active': int((activity[indices] > 1e-9).sum()),
                   'sum': float(activity[indices].sum()), 'mean': float(activity[indices].mean())}
                  for label,indices in self.groups[kind].items()]
        values.sort(key=lambda item: (-item['sum'], item['label']))
        return values if top_k is None else values[:top_k]

    def simulate(self, request: SimulationRequest) -> dict:
        started = time.perf_counter()
        if fingerprint(self.graph.structural) != self.graph.structural_sha256:
            raise ValueError('Structural graph fingerprint changed before simulation')
        weights, signs = self.simulation_weights(request.parameters)
        n = len(self.records)
        activity = np.zeros(n, dtype=np.float64)
        stimulus = self.input_vector(request.stimulus, request.injection_enabled)
        trace = []
        cumulative = np.zeros(n)
        peak = np.zeros(n)
        core_seconds = 0.
        active_peak = 0
        p = request.parameters
        for step in range(request.steps + 1):
            if step:
                tick = time.perf_counter()
                injected = stimulus if step <= request.pulse_steps else 0.
                activity = np.clip((1-p.decay)*activity + p.gain*(weights.T @ activity) + p.input_gain*injected, 0., 1.)
                core_seconds += time.perf_counter()-tick
                if not np.isfinite(activity).all():
                    raise ValueError('Non-finite simulated activity')
            cumulative += activity
            peak = np.maximum(peak, activity)
            active = int((activity > 1e-9).sum()); active_peak = max(active_peak, active)
            roles = {role: {'neurons': len(indices), 'active': int((activity[indices] > 1e-9).sum()),
                            'sum': float(activity[indices].sum()), 'mean': float(activity[indices].mean()) if len(indices) else 0.}
                     for role,indices in [('source',self.sources),('intermediate',self.intermediates),('target',np.array(list(self.targets.values())))]}
            trace.append({'step': step, 'input_on': bool(request.injection_enabled and step > 0 and step <= request.pulse_steps and stimulus.any()),
                          'dna02': {side: {'id': str(self.records[index]['bodyId']), 'activation': float(activity[index]), 'side_field': 'somaSide'} for side,index in self.targets.items()},
                          'active_neurons': active, 'max_activity': float(activity.max(initial=0)), 'roles': roles,
                          'top_neurons': self.rank(activity, np.arange(n), request.top_k),
                          'top_intermediates': self.rank(activity, self.intermediates, request.top_k),
                          'by_side': self.aggregates(activity,'side'), 'by_class': self.aggregates(activity,'class',request.top_k),
                          'by_type': self.aggregates(activity,'type',request.top_k)})
        intact = fingerprint(self.graph.structural) == self.graph.structural_sha256
        if not intact:
            raise ValueError('Structural graph changed during simulation')
        intermediate_types = {}
        for i in self.intermediates:
            label = self.records[i].get('type') or '(missing)'
            intermediate_types[label] = intermediate_types.get(label, 0.) + float(cumulative[i])
        dominant = sorted(intermediate_types.items(), key=lambda pair: (-pair[1],pair[0]))[:request.top_k]
        sign_counts = {str(value): sum(sign==value for sign,_ in signs) for value in (-1.,0.,1.)}
        sample_edges = sorted(range(weights.nnz), key=lambda edge: (-abs(weights.data[edge]),int(self.rows[edge]),int(self.cols[edge])))[:20]
        elapsed = time.perf_counter()-started
        return {'dataset': 'MaleCNS', 'version': 'v1.0', 'graph': self.graph.summary(),
                'engineering_model': {'equation': 'a[t+1]=clip((1-decay)*a[t]+gain*W.T@a[t]+input_gain*I[t],0,1); a[0]=0',
                    'parameters': p.model_dump(), 'request': request.model_dump(), 'active_threshold': 1e-9,
                    'input_mapping': 'ProLN root L receives min(1,left+0.5*front), root R min(1,right+0.5*front), unknown side receives 0. Equal per-cell input; no bilateral population-size balancing. Pulse applies on transitions 0->1 through pulse_steps-1->pulse_steps.',
                    'weight_rule': 'ENGINEERING: log1p(Cpre,post), normalized by max(1,incoming column log sum) or the largest such column sum; multiplied by presynaptic assumed sign. Structural contacts unchanged.',
                    'sign_rule': 'Unsigned: all +1. Predicted: only agreeing body/consensus acetylcholine (+1) or gaba (-1) with finite body confidence >= threshold; all other cells use explicit zero/positive fallback. Glutamate and modulators are ambiguous; no receptor-specific effect is known.',
                    'sign_counts': sign_counts, 'time_unit': 'abstract simulation step, not biological seconds',
                    'cumulative_unit': 'sum of activation samples including resting step 0; arbitrary activity-step units'},
                'readout_neurons': {side:self.node(index) for side,index in self.targets.items()},
                'summary': {'dna02': {side:{'id':str(self.records[index]['bodyId']), 'peak':float(peak[index]), 'cumulative':float(cumulative[index]), 'final':float(activity[index])} for side,index in self.targets.items()},
                            'peak_active_neurons':active_peak, 'dominant_intermediate_types':[{'type':label,'cumulative_activity':value} for label,value in dominant if value>1e-9],
                            'structural_unchanged':intact},
                'trace': trace,
                'weight_examples': [{'source':str(self.records[self.rows[e]]['bodyId']), 'target':str(self.records[self.cols[e]]['bodyId']),
                                     'structural_contact_count':int(self.graph.structural.adjacency.data[e]), 'simulation_weight':float(weights.data[e]),
                                     'presynaptic_nt':self.records[self.rows[e]].get('consensus_nt'), 'sign_reason':signs[self.rows[e]][1]} for e in sample_edges],
                'performance': {'simulation_seconds':core_seconds, 'seconds_per_step':core_seconds/request.steps,
                                'experiment_with_reporting_seconds':elapsed, 'simulation_weight_bytes':array_bytes(weights),
                                'state_vector_bytes':activity.nbytes, 'numeric_working_arrays_bytes':array_bytes(weights)+self.rows.nbytes+activity.nbytes*5,
                                'memory_note':'Numeric bytes exclude Python metadata/JSON and full connectome residency; CLI reports process RSS separately.'},
                'scientific_note':'Controller research using the real MaleCNS structural connectome with simulated neural dynamics. ENGINEERING activity, weights, signs and inputs are not measured physiology. No BioBug movement integration and no inference that DNa02 activity proves turning.'}
