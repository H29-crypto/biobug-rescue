from __future__ import annotations


def validate_counts(metadata: dict, body_stats: dict, edge_stats: dict, measured: dict, manifest: dict) -> dict:
    checks = []
    def compare(name, actual, expected, source, *, reference_only=False, note=""):
        checks.append({"name": name, "actual": actual, "expected": expected,
                       "delta": actual - expected if expected is not None else None,
                       "status": "reference" if reference_only else "unavailable" if expected is None else "pass" if actual == expected else "discrepancy",
                       "source": source, "note": note})
    compare("all_segment_presynaptic_sites", body_stats["pre"], metadata.get("totalPreCount"), "Neuprint_Meta_debug.json:totalPreCount")
    compare("all_segment_postsynaptic_sites", body_stats["post"], metadata.get("totalPostCount"), "Neuprint_Meta_debug.json:totalPostCount")
    compare("full_graph_contacts_vs_segment_downstream", edge_stats["source_synaptic_contacts"], body_stats["downstream"], "body-stats:downstream sum")
    compare("csr_contacts_vs_selected_source", measured["synaptic_contacts"], edge_stats["selected_synaptic_contacts"], "selected source edge weight sum")
    reference = manifest.get("reference_notebook", {})
    for name, key in [("connected_neurons", "connected_neurons"), ("edges", "edges"), ("superclasses", "valid_superclasses")]:
        if key in reference:
            compare(f"authors_notebook_{name}", measured[name], reference[key], reference["url"], reference_only=True,
                    note=f"Notebook uses {reference['dataset_version']}; loaded release is {manifest['version']}. Delta is reported, not treated as an exact-version invariant.")
    warnings = ["The loaded graph excludes annotation records without an accepted superclass and edges with either endpoint outside that selection.",
                "Published neuron totals depend on proofreading, superclass and connection thresholds; metadata's rounded description is not an exact validation target."]
    if reference:
        warnings.append("The authors' reference notebook is v0.9, not v1.0; see explicit reference deltas.")
    if edge_stats["duplicate_selected_pairs_coalesced"]:
        warnings.append(f"Coalesced {edge_stats['duplicate_selected_pairs_coalesced']} duplicate source pairs by summing contact counts.")
    return {"status": "discrepancy" if any(c["status"] == "discrepancy" for c in checks) else "passed_with_scope_notes",
            "checks": checks, "warnings": warnings}
