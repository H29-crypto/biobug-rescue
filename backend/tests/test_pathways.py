"""Structural pathway behavior on a small explicit graph, independent of MaleCNS downloads."""
from __future__ import annotations

import json
import numpy as np
import pyarrow as pa
import pytest
from fastapi.testclient import TestClient
from scipy.sparse import csr_matrix

from connectome.annotations import counts, get_population, inventory, laterality, query_neurons
from connectome.api import create_app
from connectome.graph import ConnectomeGraph
from connectome.loader import LoadedConnectome
from connectome.pathway_analysis import PathwayAnalyzer


@pytest.fixture
def pathway_graph():
    # These IDs are synthetic test fixtures; no production biological identity is asserted.
    ids = np.arange(10, 101, 10, dtype=np.int64)
    table = pa.table({
        'bodyId': ids,
        'type': ['touch_L', 'touch_R', 'touch_unknown', 'relay_A', 'relay_B',
                 'DNa02', 'DNa02', None, 'DNa02', 'leg_motor'],
        'superclass': ['vnc_sensory'] * 3 + ['vnc_intrinsic'] * 2 +
                      ['descending_neuron'] * 2 + ['vnc_intrinsic', 'cb_intrinsic', 'vnc_motor'],
        'class': ['mechanosensory_tactile'] * 3 + ['interneuron'] * 2 +
                 ['descending'] * 2 + ['interneuron', 'interneuron', 'motor'],
        'subclass': ['bristle'] * 3 + [None] * 6 + ['fl'],
        'rootSide': ['L', 'R', None, 'R', 'L', 'R', 'L', 'L', None, None],
        'somaSide': [None, None, 'R', 'L', 'R', 'L', 'R', None, 'L', 'L'],
        'somaNeuromere': [None] * 3 + ['T1', 'T2', 'LB', 'LB', 'T3', 'LB', 'T1'],
        'entryNerve': ['ProLN'] * 3 + [None] * 7,
        'exitNerve': [None] * 9 + ['ProN'],
        'predicted_nt': ['acetylcholine'] * 10,
        'consensus_nt': ['acetylcholine'] * 4 + ['gaba'] + ['acetylcholine'] * 2 +
                        [None, 'acetylcholine', 'glutamate'],
    })
    links = [(10, 40, 9), (10, 50, 4), (10, 60, 1),
             (20, 40, 5), (20, 50, 7), (30, 80, 12),
             (40, 60, 8), (40, 50, 6), (50, 40, 2), (50, 70, 3),
             (80, 40, 11), (90, 60, 99), (60, 100, 13), (70, 100, 4)]
    rows = [pre // 10 - 1 for pre, _, _ in links]
    cols = [post // 10 - 1 for _, post, _ in links]
    weights = np.array([weight for _, _, weight in links], dtype=np.int64)
    adjacency = csr_matrix((weights, (rows, cols)), shape=(len(ids), len(ids)))
    return ConnectomeGraph(table, ids, adjacency)


def mask(graph, *ids):
    return np.isin(graph.body_ids, ids)


def walk_edges(graph, sources, targets, hops):
    """Tiny exhaustive oracle used only in tests, never against the real graph."""
    finished = []
    for body in sources:
        pending = [(body, [])]
        for _ in range(hops):
            following = []
            for current, edges in pending:
                outgoing = graph.outgoing(current)
                following.extend((int(nxt), edges + [(current, int(nxt))])
                                 for nxt in outgoing['body_post'])
            pending = following
        finished.extend(edges for final, edges in pending if final in targets)
    return {edge for route in finished for edge in route}


def test_annotation_queries_use_exact_values_and_and_constraints(pathway_graph):
    table = pathway_graph.neurons
    selected = query_neurons(table, type='DNa02', superclass='descending_neuron')
    assert selected['bodyId'].to_pylist() == [60, 70]
    assert query_neurons(table, type='DNa')['bodyId'].to_pylist() == []
    assert query_neurons(table, rootSide=('L', 'R'), **{'class': 'mechanosensory_tactile'})['bodyId'].to_pylist() == [10, 20]
    assert query_neurons(table, type=())['bodyId'].to_pylist() == []
    with pytest.raises(ValueError, match='unavailable'):
        query_neurons(table, invented_annotation='walking')


def test_population_selection_reports_loaded_ids_and_anatomy(pathway_graph):
    tactile = get_population('tactile').describe(pathway_graph.neurons, include_ids=True)
    descending = get_population('DNa02').describe(pathway_graph.neurons, include_ids=True)
    assert tactile['count'] == 3
    assert tactile['neuron_ids'] == [10, 20, 30]
    assert tactile['laterality'] == {'L': 1, 'R': 1, '(missing)': 1}
    assert tactile['regions']['entryNerve'] == {'ProLN': 3}
    assert descending['neuron_ids'] == [60, 70]  # The same type on body 90 is not descending.
    assert descending['laterality'] == {'L': 1, 'R': 1}
    assert counts(pathway_graph.neurons, 'absent_field') == {}
    with pytest.raises(ValueError, match='Unknown population'):
        get_population('fabricated_turn_left_neurons')


def test_laterality_never_falls_back_or_interprets_missing_side():
    assert laterality({'rootSide': None, 'somaSide': 'R'}, 'rootSide') == {
        'side': None, 'side_field': 'rootSide', 'raw_value': None}
    assert laterality({'rootSide': 'R', 'somaSide': 'L'}, 'somaSide')['side'] == 'L'
    assert laterality({'rootSide': 'unknown'}, 'rootSide')['side'] is None
    assert laterality({'somaSide': 'M'}, 'somaSide')['side'] == 'M'
    with pytest.raises(ValueError, match='rootSide or somaSide'):
        laterality({'turn': 'left'}, 'turn')


def test_inventory_preserves_availability_and_missing_annotations(pathway_graph):
    report = inventory(pathway_graph.neurons)
    assert report['fields']['type']['non_null'] == 9
    assert report['fields']['consensus_nt']['non_null'] == 9
    assert report['fields']['serialMotif']['available'] is False
    assert report['fields']['serialMotif']['non_null'] == 0
    assert report['fields']['rootSide']['values']['(missing)'] == 3
    assert 'per-neuron neuropil' in report['neuropil_limit']


def test_directed_exact_hops_and_contact_aggregation(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    result = analyzer.analyze(mask(pathway_graph, 10), mask(pathway_graph, 60, 70))
    assert result['min_hops'] == 1
    assert result['reachable_targets'] == 2
    assert [row['reachable_targets_exact'] for row in result['hops']] == [1, 2, 2]
    assert [row['new_targets_at_shortest_hop'] for row in result['hops']] == [1, 1, 0]
    assert [row['contact_sum_unique_route_edges'] for row in result['hops']] == [1, 24, 32]
    assert [row['route_edges'] for row in result['hops']] == [1, 4, 6]
    assert result['hops'][1]['strongest_intermediate_types'] == [
        {'type': 'relay_A', 'neurons': 1, 'incident_contact_sum': 17},
        {'type': 'relay_B', 'neurons': 1, 'incident_contact_sum': 7}]
    # A separate tiny exhaustive walk oracle checks all three exact lengths.
    for row in result['hops']:
        edges = walk_edges(pathway_graph, {10}, {60, 70}, row['hops'])
        assert row['route_edges'] == len(edges)
        assert row['contact_sum_unique_route_edges'] == sum(pathway_graph.edge(*edge) for edge in edges)
    reverse = analyzer.analyze(mask(pathway_graph, 60), mask(pathway_graph, 10))
    assert reverse['min_hops'] is None
    assert reverse['reachable_targets'] == 0
    assert all(row['route_edges'] == 0 for row in reverse['hops'])


def test_cycle_counts_each_contact_edge_once_in_exact_walk(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    result = analyzer.analyze(mask(pathway_graph, 40), mask(pathway_graph, 50))
    # The 3-hop walk 40 -> 50 -> 40 -> 50 traverses weight 6 twice;
    # structural contact aggregation counts that edge only once: 6 + 2.
    assert [row['reachable_targets_exact'] for row in result['hops']] == [1, 0, 1]
    assert result['hops'][2]['route_edges'] == 2
    assert result['hops'][2]['contact_sum_unique_route_edges'] == 8
    assert result['hops'][2]['new_targets_at_shortest_hop'] == 0
    assert 'nodes may repeat' in result['metric_definition']


def test_frontier_bounds_direction_and_three_hop_reach(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    assert analyzer.analyze(mask(pathway_graph, 30), mask(pathway_graph, 60), 2)['reachable_targets'] == 0
    assert analyzer.analyze(mask(pathway_graph, 30), mask(pathway_graph, 60), 3)['min_hops'] == 3
    backwards = analyzer.frontiers(mask(pathway_graph, 60), 1, reverse=True)
    assert pathway_graph.body_ids[backwards[1]].tolist() == [10, 40, 90]
    for hops in (0, 4):
        with pytest.raises(ValueError, match='1..3 hops'):
            analyzer.frontiers(mask(pathway_graph, 10), hops)
    with pytest.raises(ValueError, match='graph size'):
        analyzer.frontiers(np.array([True, False]), 2)


def test_lateral_summary_uses_population_specific_fields(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    rows = analyzer.lateral_summary(get_population('tactile'), get_population('DNa02'))
    assert len(rows) == 4
    by_sides = {(row['source_side'], row['target_side']): row for row in rows}
    ll = by_sides['L', 'L']
    assert ll['source_count'] == ll['target_count'] == 1
    assert ll['source_side_field'] == 'rootSide'
    assert ll['target_side_field'] == 'somaSide'
    assert ll['direct_edges'] == ll['direct_contacts'] == 1
    assert by_sides['L', 'R']['direct_edges'] == 0
    assert by_sides['R', 'L']['hops'][1]['exact_reachable_targets'] == 1
    assert by_sides['R', 'R']['hops'][1]['exact_reachable_targets'] == 1
    # Source 30 has a right soma but lacks rootSide: it is excluded from both sensory sides.
    assert sum(row['source_count'] for row in rows[::2]) == 2


def test_representative_routes_choose_shortest_then_widest_and_preserve_contacts(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    sm = get_population('tactile').mask(pathway_graph.neurons)
    tm = get_population('DNa02').mask(pathway_graph.neurons)
    nodes, edges, _, routes, truncated = analyzer.representative_routes(sm, tm)
    assert routes == [
        {'neuron_ids': [30, 80, 40, 60], 'hops': 3, 'bottleneck_contacts': 8},
        {'neuron_ids': [20, 40, 60], 'hops': 2, 'bottleneck_contacts': 5},
        {'neuron_ids': [10, 60], 'hops': 1, 'bottleneck_contacts': 1}]
    assert len(nodes) == 6
    assert len(edges) == 5
    assert truncated is False
    for (pre, post), weight in edges.items():
        assert weight == pathway_graph.edge(int(pathway_graph.body_ids[pre]), int(pathway_graph.body_ids[post]))
    before = pathway_graph.adjacency.data.copy()
    bounded = analyzer.representative_routes(sm, tm, max_nodes=4, max_edges=3)
    assert len(bounded[0]) == 4
    assert len(bounded[1]) == 3
    assert len(bounded[3]) == 1
    assert bounded[4] is True
    np.testing.assert_array_equal(pathway_graph.adjacency.data, before)


@pytest.mark.parametrize('bounds', [{'max_nodes': 3}, {'max_nodes': 81}, {'max_edges': 2}, {'max_edges': 161}])
def test_export_rejects_unbounded_visualization(pathway_graph, bounds):
    with pytest.raises(ValueError, match='bounds'):
        PathwayAnalyzer(pathway_graph).export(**bounds)


def test_export_has_true_metadata_bounded_edges_and_no_fabricated_side(pathway_graph):
    data = PathwayAnalyzer(pathway_graph).export(max_nodes=4, max_edges=3)
    assert data['summary']['node_count'] == 4
    assert data['summary']['edge_count'] == 3
    assert data['summary']['reachable_targets'] == 2
    assert data['summary']['min_hops'] == 1  # Global reach, not only the bounded sample.
    assert data['summary']['truncated'] is True
    nodes = {node['id']: node for node in data['nodes']}
    assert set(nodes) == {'30', '40', '60', '80'}
    assert nodes['30']['role'] == 'sensory'
    assert nodes['30']['side'] is None
    assert nodes['30']['side_field'] == 'rootSide'
    assert nodes['60']['role'] == 'downstream'
    assert nodes['60']['side'] == 'L'
    assert nodes['60']['side_field'] == 'somaSide'
    assert nodes['80']['neurotransmitter'] is None
    assert nodes['80']['type'] is None
    for edge in data['edges']:
        assert edge['source'] in nodes and edge['target'] in nodes
        assert edge['weight'] == pathway_graph.edge(int(edge['source']), int(edge['target']))
    assert 'ENGINEERING MAPPINGS' in data['scientific_note']
    json.dumps(data, allow_nan=False)


def test_export_rejects_unknown_population_and_reversed_roles(pathway_graph):
    analyzer = PathwayAnalyzer(pathway_graph)
    with pytest.raises(ValueError, match='Unknown population'):
        analyzer.export(source_id='made_up')
    with pytest.raises(ValueError, match='sensory source'):
        analyzer.export(source_id='DNa02', target_id='tactile')


@pytest.fixture
def pathway_client(pathway_graph):
    report = {'dataset': 'MaleCNS', 'version': 'v1.0', 'neurons': len(pathway_graph.body_ids),
              'edges': pathway_graph.adjacency.nnz, 'synaptic_contacts': int(pathway_graph.adjacency.data.sum()),
              'loaded': True, 'scope': 'synthetic unit fixture', 'load_seconds': 0,
              'memory': {}, 'validation': {}}
    loaded = LoadedConnectome(pathway_graph, report)
    with TestClient(create_app(loader=lambda _: loaded)) as client:
        yield client


def test_population_api_returns_counts_from_fixture(pathway_client):
    response = pathway_client.get('/connectome/populations')
    assert response.status_code == 200
    data = response.json()
    assert data['dataset'] == 'MaleCNS'
    assert data['version'] == 'v1.0'
    populations = {row['id']: row for row in data['populations']}
    assert populations['tactile']['count'] == 3
    assert populations['DNa02']['count'] == 2
    assert populations['visual']['count'] == 0
    assert populations['tactile']['evidence'] == 'DOCUMENTED'


def test_pathway_api_returns_bounded_true_graph(pathway_client, pathway_graph):
    response = pathway_client.get('/connectome/pathway-subgraph', params={
        'source': 'tactile', 'target': 'DNa02', 'max_nodes': 4, 'max_edges': 3})
    assert response.status_code == 200
    data = response.json()
    assert len(data['nodes']) == 4
    assert len(data['edges']) == 3
    assert data['source_population']['count'] == 3
    assert data['target_population']['count'] == 2
    for edge in data['edges']:
        assert edge['weight'] == pathway_graph.edge(int(edge['source']), int(edge['target']))
    # Retrieval must not affect the existing graph or status counts.
    assert pathway_client.get('/connectome/status').json()['neurons'] == 10


@pytest.mark.parametrize('params, status', [
    ({'source': 'does-not-exist'}, 422),
    ({'source': 'DNa02', 'target': 'tactile'}, 422),
    ({'max_nodes': 3}, 422),
    ({'max_nodes': 81}, 422),
    ({'max_edges': 2}, 422),
    ({'max_edges': 161}, 422),
])
def test_pathway_api_validates_selection_and_bounds(pathway_client, params, status):
    assert pathway_client.get('/connectome/pathway-subgraph', params=params).status_code == status


def test_pathway_api_reports_missing_dataset():
    def failing_loader(_):
        raise FileNotFoundError('fixture dataset intentionally unavailable')
    with TestClient(create_app(loader=failing_loader)) as client:
        assert client.get('/connectome/populations').status_code == 503
        assert client.get('/connectome/pathway-subgraph').status_code == 503


def test_empty_population_produces_empty_export_not_a_placeholder_graph(pathway_graph):
    # There is no visual sensory neuron in this fixture.
    analyzer = PathwayAnalyzer(pathway_graph)
    result = analyzer.export(source_id='visual', target_id='DNa02')
    assert result['source_population']['count'] == 0
    assert result['target_population']['count'] == 2
    assert result['nodes'] == result['edges'] == result['representative_routes'] == []
    assert result['summary']['reachable_targets'] == 0
    assert result['summary']['min_hops'] is None
    assert result['summary']['truncated'] is False


def test_narrow_annotation_populations_retain_exact_definitions(pathway_graph):
    table = pathway_graph.neurons
    assert get_population('front_leg_tactile').describe(table, include_ids=True)['neuron_ids'] == [10, 20, 30]
    leg = get_population('leg_motor').describe(table, include_ids=True)
    assert leg['neuron_ids'] == [100]
    assert leg['side_field'] == 'somaSide'
    assert leg['laterality'] == {'L': 1}
    assert get_population('chordotonal').describe(table)['count'] == 0


def test_pathway_api_allows_local_development_origin(pathway_client):
    response = pathway_client.get('/connectome/populations', headers={'Origin': 'http://127.0.0.1:5173'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'http://127.0.0.1:5173'
