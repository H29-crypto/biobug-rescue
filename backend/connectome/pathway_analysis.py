"""Bounded structural graph analysis. No activations, rates, or neural dynamics."""
from __future__ import annotations
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
from .annotations import Population, get_population, laterality
from .graph import ConnectomeGraph


class PathwayAnalyzer:
    def __init__(self, graph: ConnectomeGraph):
        self.graph = graph
        self.a = graph.adjacency
        self.rows = np.repeat(np.arange(len(graph.body_ids), dtype=np.int32), np.diff(self.a.indptr))
        self.cols = self.a.indices
        self.weights = self.a.data
        self._frontiers = {}
        types = pc.dictionary_encode(pc.fill_null(graph.neurons['type'], '(untyped)')).combine_chunks()
        self.type_codes = types.indices.to_numpy()
        self.type_labels = types.dictionary.to_pylist()

    def frontiers(self, mask: np.ndarray, hops: int, *, reverse: bool = False) -> list[np.ndarray]:
        if not 1 <= hops <= 3:
            raise ValueError('Bounded analysis supports 1..3 hops')
        mask = np.asarray(mask, dtype=bool)
        if mask.shape != (len(self.graph.body_ids),):
            raise ValueError('Population mask must match graph size')
        key = (mask.tobytes(), hops, reverse)
        if key not in self._frontiers:
            layers = [mask.copy()]
            operator = self.a if reverse else self.a.T
            for _ in range(hops):
                # Positive contact weights are used only to test existence of an edge.
                layers.append(np.asarray(operator @ layers[-1].astype(np.int64)).ravel() > 0)
            self._frontiers[key] = layers
        return self._frontiers[key]

    def analyze(self, sources: np.ndarray, targets: np.ndarray, max_hops: int = 3) -> dict:
        forward = self.frontiers(sources, max_hops)
        backward = self.frontiers(targets, max_hops, reverse=True)
        seen_targets = sources & targets
        results = []
        min_hops = 0 if seen_targets.any() else None
        for hops in range(1, max_hops + 1):
            reached = forward[hops] & targets
            newly_reached = reached & ~seen_targets
            if min_hops is None and reached.any():
                min_hops = hops
            seen_targets |= reached
            on_routes = np.zeros(self.a.nnz, dtype=bool)
            intermediate = np.zeros(len(sources), dtype=bool)
            for layer in range(hops):
                on_routes |= forward[layer][self.rows] & backward[hops - layer - 1][self.cols]
                if layer:
                    intermediate |= forward[layer] & backward[hops - layer]
            intermediate &= ~sources & ~targets
            positions = np.flatnonzero(on_routes)
            support = np.bincount(self.rows[positions], weights=self.weights[positions], minlength=len(sources))
            support += np.bincount(self.cols[positions], weights=self.weights[positions], minlength=len(sources))
            type_support = np.bincount(self.type_codes[intermediate], weights=support[intermediate], minlength=len(self.type_labels))
            type_count = np.bincount(self.type_codes[intermediate], minlength=len(self.type_labels))
            ranked = sorted(np.flatnonzero(type_support), key=lambda i: (-type_support[i], self.type_labels[i]))[:10]
            results.append({'hops': hops, 'reachable_targets_exact': int(reached.sum()),
                            'new_targets_at_shortest_hop': int(newly_reached.sum()), 'reachable_targets_within_hops': int(seen_targets.sum()),
                            'all_reachable_neurons_exact': int(forward[hops].sum()),
                            'route_edges': len(positions), 'contact_sum_unique_route_edges': int(self.weights[positions].sum()),
                            'intermediate_neurons': int(intermediate.sum()),
                            'strongest_intermediate_types': [{'type': self.type_labels[i], 'neurons': int(type_count[i]),
                                'incident_contact_sum': int(type_support[i])} for i in ranked]})
        return {'source_count': int(sources.sum()), 'target_count': int(targets.sum()), 'min_hops': min_hops,
                'reachable_targets': int(seen_targets.sum()), 'hops': results,
                'metric_definition': 'For exact h-hop directed walks (nodes may repeat), sum each distinct participating edge contact count once. This is a structural aggregate, not effective strength, activity, probability or a causal effect. Intermediate support sums incident contacts; one edge can support two different intermediate types.'}

    def lateral_summary(self, source: Population, target: Population, max_hops: int = 3) -> list[dict]:
        source_mask, target_mask = source.mask(self.graph.neurons), target.mask(self.graph.neurons)
        output = []
        for source_side in ('L', 'R'):
            sm = source_mask & pc.fill_null(pc.equal(self.graph.neurons[source.side_field], source_side), False).to_numpy()
            forward = self.frontiers(sm, max_hops)
            for target_side in ('L', 'R'):
                tm = target_mask & pc.fill_null(pc.equal(self.graph.neurons[target.side_field], target_side), False).to_numpy()
                edge_mask = sm[self.rows] & tm[self.cols]
                reached = np.zeros(len(sm), dtype=bool)
                hops = []
                for h in range(1, max_hops + 1):
                    reached |= forward[h] & tm
                    hops.append({'hops': h, 'exact_reachable_targets': int((forward[h] & tm).sum()), 'cumulative_reachable_targets': int(reached.sum())})
                output.append({'source_side': source_side, 'source_side_field': source.side_field, 'source_count': int(sm.sum()),
                               'target_side': target_side, 'target_side_field': target.side_field, 'target_count': int(tm.sum()),
                               'direct_edges': int(edge_mask.sum()), 'direct_contacts': int(self.weights[edge_mask].sum()), 'hops': hops})
        return output

    def representative_routes(self, sources: np.ndarray, targets: np.ndarray, max_hops: int = 3, max_nodes: int = 32, max_edges: int = 64):
        if not 4 <= max_nodes <= 80 or not 3 <= max_edges <= 160:
            raise ValueError('Visualization bounds: 4..80 nodes and 3..160 edges')
        if not 1 <= max_hops <= 3:
            raise ValueError('Bounded analysis supports 1..3 hops')
        # Widest shortest route per source: a static max/min contact ranking, not neural propagation.
        capacity = [np.where(targets, np.iinfo(np.int64).max, 0).astype(np.int64)]
        for _ in range(max_hops):
            candidates = np.minimum(self.weights, capacity[-1][self.cols])
            best = np.zeros(len(sources), dtype=np.int64)
            np.maximum.at(best, self.rows, candidates)
            capacity.append(best)
        ranked = []
        for index in np.flatnonzero(sources & ~targets):
            for h in range(1, max_hops + 1):
                if capacity[h][index] > 0:
                    ranked.append((int(capacity[h][index]), h, int(index)))
                    break
        ranked.sort(key=lambda row: (-row[0], row[1], int(self.graph.body_ids[row[2]])))
        nodes, edges, routes = set(), {}, []
        layers = {}
        for score, h, index in ranked:
            route = [index]
            route_edges = []
            current = index
            for remaining in range(h, 0, -1):
                start, end = self.a.indptr[current:current + 2]
                edge_ids = np.arange(start, end)
                available = np.minimum(self.weights[edge_ids], capacity[remaining - 1][self.cols[edge_ids]])
                choices = edge_ids[available == capacity[remaining][current]]
                chosen = min(choices, key=lambda edge: (-int(self.weights[edge]), int(self.graph.body_ids[self.cols[edge]])))
                nxt = int(self.cols[chosen]); route_edges.append((current, nxt, int(self.weights[chosen]))); route.append(nxt); current = nxt
            if len(nodes | set(route)) > max_nodes or len(set(edges) | {(u, v) for u, v, _ in route_edges}) > max_edges:
                continue
            nodes.update(route)
            for layer, node in enumerate(route):
                layers[node] = min(layers.get(node, layer), layer)
            for u, v, weight in route_edges:
                edges[u, v] = weight
            routes.append({'neuron_ids': [int(self.graph.body_ids[i]) for i in route], 'hops': h, 'bottleneck_contacts': score})
            if len(nodes) >= max_nodes or len(edges) >= max_edges:
                break
        return nodes, edges, layers, routes, len(routes) < len(ranked)

    def export(self, source_id: str = 'tactile', target_id: str = 'DNa02', max_nodes: int = 32, max_edges: int = 64) -> dict:
        source, target = get_population(source_id), get_population(target_id)
        if source.role != 'sensory' or target.role not in ('descending', 'motor'):
            raise ValueError('Choose a sensory source and a descending/motor target')
        sm, tm = source.mask(self.graph.neurons), target.mask(self.graph.neurons)
        forward = self.frontiers(sm, 3)
        min_hops = next((h for h in range(1, 4) if (forward[h] & tm).any()), None)
        reachable = np.logical_or.reduce(forward[1:]) & tm
        nodes, edges, layers, routes, truncated = self.representative_routes(sm, tm, max_nodes=max_nodes, max_edges=max_edges)
        output_nodes = []
        for index in sorted(nodes, key=lambda i: (layers[i], int(self.graph.body_ids[i]))):
            record = self.graph.neuron(int(self.graph.body_ids[index]))
            role = 'sensory' if sm[index] else 'downstream' if tm[index] else 'intermediate'
            basis = source.side_field if role == 'sensory' else target.side_field if role == 'downstream' else 'somaSide'
            side = laterality(record, basis)
            region = '; '.join(f'{key}={record[key]}' for key in ('somaNeuromere', 'entryNerve', 'exitNerve') if record.get(key)) or None
            output_nodes.append({'id': str(record['bodyId']), 'type': record.get('type'), 'class': record.get('class'),
                'superclass': record.get('superclass'), 'side': side['side'], 'side_field': basis, 'region': region,
                'neurotransmitter': record.get('consensus_nt'), 'role': role, 'layer': layers[index],
                'evidence': source.evidence if role == 'sensory' else target.evidence if role == 'downstream' else 'INFERRED'})
        return {'dataset': 'MaleCNS', 'version': 'v1.0', 'source_population': source.describe(self.graph.neurons),
                'target_population': target.describe(self.graph.neurons), 'nodes': output_nodes,
                'edges': [{'source': str(self.graph.body_ids[u]), 'target': str(self.graph.body_ids[v]), 'weight': w} for (u, v), w in sorted(edges.items())],
                'summary': {'min_hops': min_hops, 'reachable_targets': int(reachable.sum()), 'node_count': len(nodes), 'edge_count': len(edges),
                    'truncated': truncated, 'selection': 'Union of widest shortest routes per source, ranked by minimum edge contact count, then hop count and body ID. Display bounds omit other real routes; all displayed weights are unchanged source counts.'},
                'representative_routes': routes,
                'scientific_note': 'Real MaleCNS structural connectivity. Route roles are analytical assignments; contact counts do not imply neural activity or behavioral causation. Simulated inputs and future motor decoding are ENGINEERING MAPPINGS, not connected or implemented.'}
