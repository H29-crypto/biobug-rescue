from __future__ import annotations
import argparse
import json
from pathlib import Path
from .loader import load_connectome
from .metadata import DEFAULT_DATA_DIR


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect real MaleCNS structural data; no neural dynamics")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--json", action="store_true", help="Print the complete machine-readable report")
    parser.add_argument("--report", type=Path, help="Save the complete measured report, including all types")
    parser.add_argument("--all-types", action="store_true", help="Print all loaded type labels, not only a preview")
    parser.add_argument("--neuron", type=int)
    parser.add_argument("--edge", type=int, nargs=2, metavar=("PRE", "POST"))
    parser.add_argument("--subgraph", type=int, nargs="+")
    parser.add_argument("--strict", action="store_true", help="Exit nonzero for exact-version count discrepancies")
    args = parser.parse_args()
    try:
        loaded = load_connectome(args.data_dir)
        report = loaded.report
        queries = {}
        if args.neuron is not None:
            queries["neuron"] = loaded.graph.neuron(args.neuron)
        if args.edge:
            queries["edge"] = {"body_pre": args.edge[0], "body_post": args.edge[1], "contacts": loaded.graph.edge(*args.edge)}
        if args.subgraph is not None:
            graph = loaded.graph.subgraph(args.subgraph)
            queries["subgraph"] = {"body_ids": graph.body_ids.tolist(), "edges": graph.adjacency.nnz, "contacts": int(graph.adjacency.sum())}
        report["queries"] = queries
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        if args.json:
            print(json.dumps(report, indent=2, allow_nan=False))
        else:
            print(f"MaleCNS dataset version: {report['version']}")
            print(f"Scope: {report['scope']}")
            for name in ["neurons", "connected_neurons", "edges", "synaptic_contacts"]:
                print(f"{name}: {report[name]:,}")
            print(f"Load time (including checksum verification): {report['load_seconds']:.3f} seconds")
            print("Memory (bytes):", json.dumps(report["memory"]))
            types = report["annotations"]["types"]
            print(f"Available neuron types: {len(types):,}")
            print(", ".join(types if args.all_types else types[:30]))
            if not args.all_types:
                print("Use --all-types or --report FILE for the complete type inventory.")
            print("Neurotransmitter annotations:", json.dumps(report["annotations"]["neurotransmitters"]))
            print("Coordinates:", json.dumps(report["annotations"]["coordinates"]))
            print("Source statistics:", json.dumps(report["source_statistics"]))
            print("Validation:", json.dumps(report["validation"], indent=2))
            if queries:
                print("Queries:", json.dumps(queries, indent=2, allow_nan=False))
        if args.strict and report["validation"]["status"] == "discrepancy":
            raise SystemExit(2)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"Cannot inspect connectome: {error}\n")


if __name__ == "__main__":
    main()
