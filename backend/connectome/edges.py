from __future__ import annotations
from pathlib import Path
import numpy as np
from scipy import sparse
from .columnar import batches, integer_column, match_ids


def edge_batches(path: Path, ids: np.ndarray):
    for batch in batches(path, ["body_pre", "body_post", "weight"]):
        pre = integer_column(batch, "body_pre")
        post = integer_column(batch, "body_post")
        weight = integer_column(batch, "weight")
        rows, pre_known = match_ids(ids, pre)
        cols, post_known = match_ids(ids, post)
        yield rows, cols, weight, pre_known & post_known


def load_edges(path: Path, ids: np.ndarray) -> tuple[sparse.csr_matrix, dict]:
    counts = {"source_edge_rows": 0, "source_synaptic_contacts": 0, "selected_edge_rows": 0,
              "selected_synaptic_contacts": 0, "excluded_edge_rows": 0, "excluded_synaptic_contacts": 0}
    # Pass one counts output; pass two fills preallocated numeric arrays. Never edge dictionaries.
    for _, _, weights, keep in edge_batches(path, ids):
        counts["source_edge_rows"] += len(weights)
        counts["source_synaptic_contacts"] += int(weights.sum(dtype=np.int64))
        counts["selected_edge_rows"] += int(keep.sum())
        counts["selected_synaptic_contacts"] += int(weights[keep].sum(dtype=np.int64))
    size = counts["selected_edge_rows"]
    row = np.empty(size, dtype=np.int32)
    col = np.empty(size, dtype=np.int32)
    data = np.empty(size, dtype=np.int64)
    offset = 0
    for rows, cols, weights, keep in edge_batches(path, ids):
        count = int(keep.sum())
        row[offset:offset + count] = rows[keep]
        col[offset:offset + count] = cols[keep]
        data[offset:offset + count] = weights[keep]
        offset += count
    if offset != size:
        raise ValueError("Edge file changed between passes")
    adjacency = sparse.coo_matrix((data, (row, col)), shape=(len(ids), len(ids)), dtype=np.int64).tocsr()
    adjacency.sum_duplicates()
    adjacency.sort_indices()
    if int(adjacency.data.sum(dtype=np.int64)) != counts["selected_synaptic_contacts"]:
        raise ValueError("Sparse conversion changed the number of synaptic contacts")
    counts["duplicate_selected_pairs_coalesced"] = size - adjacency.nnz
    counts["excluded_edge_rows"] = counts["source_edge_rows"] - size
    counts["excluded_synaptic_contacts"] = counts["source_synaptic_contacts"] - counts["selected_synaptic_contacts"]
    return adjacency, counts


def load_body_stats(path: Path) -> dict:
    totals = {"records": 0, "pre": 0, "post": 0, "downstream": 0}
    for batch in batches(path, ["body", "pre", "post", "downstream"]):
        integer_column(batch, "body")
        totals["records"] += batch.num_rows
        for name in ["pre", "post", "downstream"]:
            totals[name] += int(integer_column(batch, name, positive=False).sum(dtype=np.int64))
    return totals
