from __future__ import annotations
from dataclasses import dataclass
import gc
from pathlib import Path
import threading
import time
import numpy as np
import psutil
from .download import verify_file
from .edges import load_edges, load_body_stats
from .graph import ConnectomeGraph
from .metadata import DEFAULT_DATA_DIR, load_manifest, load_metadata, source_paths
from .neurons import annotation_summary, load_neurons
from .validation import validate_counts


@dataclass
class LoadedConnectome:
    graph: ConnectomeGraph
    report: dict

    def status(self) -> dict:
        return {key: self.report[key] for key in ["dataset", "version", "neurons", "edges", "synaptic_contacts", "loaded", "scope", "load_seconds", "memory", "validation"]}


def load_connectome(data_dir: Path = DEFAULT_DATA_DIR, *, manifest: dict | None = None) -> LoadedConnectome:
    start = time.perf_counter()
    process = psutil.Process()
    peak = [process.memory_info().rss]
    baseline = peak[0]
    stop = threading.Event()
    def sample():
        while not stop.wait(.02):
            peak[0] = max(peak[0], process.memory_info().rss)
    monitor = threading.Thread(target=sample, daemon=True)
    monitor.start()
    try:
        manifest = manifest or load_manifest()
        paths = source_paths(data_dir, manifest)
        receipts = [verify_file(paths[item["role"]], item) for item in manifest["files"]]
        metadata = load_metadata(paths["metadata"], manifest)
        table, ids, selection = load_neurons(paths["annotations"], paths["neurotransmitters"])
        adjacency, edge_stats = load_edges(paths["edges"], ids)
        body_stats = load_body_stats(paths["body_stats"])
        graph = ConnectomeGraph(table, ids, adjacency)
        annotations = annotation_summary(table)
        has_outgoing = np.diff(adjacency.indptr) > 0
        has_incoming = np.bincount(adjacency.indices, minlength=len(ids)) > 0
        measured = {"neurons": len(ids), "connected_neurons": int((has_incoming | has_outgoing).sum()),
                    "isolated_neurons": int((~(has_incoming | has_outgoing)).sum()), "edges": adjacency.nnz,
                    "synaptic_contacts": int(adjacency.data.sum(dtype=np.int64)), "superclasses": len(annotations["superclasses"])}
        validation = validate_counts(metadata, body_stats, edge_stats, measured, manifest)
        gc.collect()
        rss = process.memory_info().rss
        peak[0] = max(peak[0], rss)
        memory = {"csr_bytes": adjacency.data.nbytes + adjacency.indices.nbytes + adjacency.indptr.nbytes,
                  "neuron_arrow_bytes": table.nbytes, "body_id_array_bytes": ids.nbytes,
                  "process_rss_bytes": rss, "baseline_rss_bytes": baseline, "sampled_peak_rss_bytes": peak[0]}
        memory["retained_array_bytes"] = memory["csr_bytes"] + memory["neuron_arrow_bytes"] + memory["body_id_array_bytes"]
        return LoadedConnectome(graph, {"dataset": manifest["dataset"], "version": metadata["tag"], "loaded": True,
            "scope": selection["selection"], **measured, "source_statistics": {**selection, **edge_stats, "body_stats": body_stats},
            "annotations": annotations, "voxel_size": metadata.get("voxelSize"), "voxel_units": metadata.get("voxelUnits"),
            "source_metadata": {k: metadata.get(k) for k in ["dataset", "tag", "description", "lastDatabaseEdit", "totalPreCount", "totalPostCount"]},
            "sources": receipts, "memory": memory, "load_seconds": round(time.perf_counter() - start, 6), "validation": validation})
    finally:
        stop.set()
        monitor.join()
