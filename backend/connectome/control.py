"""Compact stateless sensory experiments for the engineering movement decoder.

Same unsigned 20-step / 3-step pulse as the lab; no motor semantics live here.
"""
import time
import numpy as np
from .dynamics import DynamicsEngine, SimulationParameters, Stimulus, fingerprint


class ControlEngine:
    def __init__(self, engine: DynamicsEngine):
        self.engine = engine
        self.weights, _ = engine.simulation_weights(SimulationParameters())
        self.transpose = self.weights.T.tocsr()
        self.summary = engine.graph.summary()

    def evaluate(self, stimulus: Stimulus):
        started = time.perf_counter()
        e = self.engine
        if fingerprint(e.graph.structural) != e.graph.structural_sha256:
            raise ValueError('Structural graph changed')
        activity = np.zeros(len(e.records))
        peak = activity.copy()
        cumulative = activity.copy()
        injected = e.input_vector(stimulus)
        for step in range(1, 21):
            activity = np.clip(.75*activity + .20*(self.transpose @ activity)
                               + (.5*injected if step <= 3 else 0.), 0., 1.)
            peak = np.maximum(peak, activity)
            cumulative += activity
        if not np.isfinite(activity).all() or fingerprint(e.graph.structural) != e.graph.structural_sha256:
            raise ValueError('Invalid activity or changed structure')
        by_type = {}
        for i in e.intermediates:
            label = e.records[i].get('type') or '(missing)'
            by_type[label] = by_type.get(label, 0.) + float(cumulative[i])
        return {'dataset': 'MaleCNS', 'version': 'v1.0', 'graph': self.summary,
                'model': 'unsigned-incoming-log-20-steps-3-pulse-from-rest-v1',
                'stimulus': stimulus.model_dump(), 'structural_unchanged': True,
                'dna02': {side: {'id': str(e.records[i]['bodyId']), 'side_field': 'somaSide',
                                'peak': float(peak[i])} for side, i in e.targets.items()},
                'input_active': int((injected > 0).sum()),
                'top_intermediate_types': [{'type': label, 'cumulative_activity': value}
                    for label, value in sorted(by_type.items(), key=lambda x: (-x[1], x[0]))[:5] if value > 1e-9],
                'evaluation_seconds': time.perf_counter()-started}
