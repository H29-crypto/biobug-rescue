"""Reproducible candidate pathway inspection of the real, loaded MaleCNS graph."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import time
import psutil
from .annotations import POPULATIONS, get_population, inventory
from .loader import load_connectome
from .metadata import DEFAULT_DATA_DIR
from .pathway_analysis import PathwayAnalyzer

DEFAULT_SOURCES = ('tactile', 'front_leg_tactile', 'proprioceptive', 'chordotonal', 'head_mechanosensory', 'head_bristle', 'visual', 'olfactory')
DEFAULT_TARGETS = ('DNa01', 'DNa02', 'DNg13', 'DNp09', 'MDN', 'leg_motor')


def write_json(path: Path, value: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description='Inspect real MaleCNS structural pathways. No neural dynamics or BioBug control.')
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument('--source', choices=DEFAULT_SOURCES)
    parser.add_argument('--target', choices=[p.id for p in POPULATIONS if p.role != 'sensory'])
    parser.add_argument('--report', type=Path, help='Save full measured analysis, annotation predicates and all selected IDs')
    parser.add_argument('--export', type=Path, help='Save a bounded real subgraph (uses --source/--target or tactile/DNa02)')
    args = parser.parse_args()
    try:
        print('Loading checksum-verified MaleCNS source data...', flush=True)
        loaded = load_connectome(args.data_dir)
        started = time.perf_counter()
        analyzer = PathwayAnalyzer(loaded.graph)
        populations = [p.describe(loaded.graph.neurons, include_ids=True) for p in POPULATIONS]
        print(f"{loaded.report['dataset']} {loaded.report['version']}: {len(loaded.graph.body_ids):,} neurons; {analyzer.a.nnz:,} edges", flush=True)
        for role in ('sensory', 'descending', 'motor'):
            print(f'Candidate {role} populations:')
            for p in populations:
                if p['role'] == role:
                    print(f"  {p['id']}: {p['count']:,} [{p['evidence']}] {p['side_field']}={p['laterality']}")
        relationships = []
        for source_id in (args.source,) if args.source else DEFAULT_SOURCES:
            for target_id in (args.target,) if args.target else DEFAULT_TARGETS:
                source, target = get_population(source_id), get_population(target_id)
                result = analyzer.analyze(source.mask(loaded.graph.neurons), target.mask(loaded.graph.neurons))
                result.update(source=source_id, target=target_id, evidence='INFERRED',
                              evidence_note='Measured structural routes; their navigation/behavioral relevance is an interpretation.',
                              laterality=analyzer.lateral_summary(source, target))
                relationships.append(result)
                summary = '; '.join(f"{h['hops']}h: {h['reachable_targets_exact']}/{result['target_count']} targets, {h['route_edges']:,} edges, {h['contact_sum_unique_route_edges']:,} contacts" for h in result['hops'])
                print(f'{source_id} -> {target_id}: {summary}', flush=True)
        example = analyzer.export(args.source or 'tactile', args.target or 'DNa02')
        elapsed = time.perf_counter() - started
        report = {'dataset': loaded.report['dataset'], 'version': loaded.report['version'],
                  'loaded_graph': loaded.status(), 'annotation_inventory': inventory(loaded.graph.neurons),
                  'populations': populations, 'relationships': relationships, 'example_subgraph': example,
                  'analysis_seconds': round(elapsed, 3), 'process_rss_after_analysis_bytes': psutil.Process().memory_info().rss,
                  'analysis_row_index_bytes': analyzer.rows.nbytes,
                  'scope': 'Directed 1, 2 and 3-hop structural walks; no exhaustive path enumeration; unchanged integer synaptic-contact weights.',
                  'engineering_mapping': 'Any FRONT/LEFT/RIGHT simulated obstacle signals and future motor decoding are ENGINEERING MAPPINGS, not connected or implemented.'}
        if args.report:
            write_json(args.report, report)
        if args.export:
            write_json(args.export, example)
        print(f"Load: {loaded.report['load_seconds']:.2f}s; analysis: {elapsed:.2f}s; RSS: {report['process_rss_after_analysis_bytes'] / 2**20:.2f} MiB")
        print('Contact totals count each participating edge once per hop length, not effective physiological strength.')
        print('Full report includes strongest intermediate types, explicit anatomical side fields and all population IDs.')
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'Cannot inspect pathways: {error}\n')


if __name__ == '__main__':
    main()
