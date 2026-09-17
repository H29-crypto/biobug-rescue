from __future__ import annotations
from dataclasses import dataclass
import math
import numpy as np
import pyarrow as pa
from scipy import sparse


def json_value(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    return value


@dataclass
class ConnectomeGraph:
    neurons: pa.Table
    body_ids: np.ndarray
    adjacency: sparse.csr_matrix

    def index(self, body_id: int) -> int:
        index = int(np.searchsorted(self.body_ids, body_id))
        if index >= len(self.body_ids) or int(self.body_ids[index]) != body_id:
            raise KeyError(f"Neuron {body_id} is not in the selected graph")
        return index

    def neuron(self, body_id: int) -> dict:
        return json_value(self.neurons.slice(self.index(body_id), 1).to_pylist()[0])

    def edge(self, pre: int, post: int) -> int:
        return int(self.adjacency[self.index(pre), self.index(post)])

    def find_neurons(self, *, neuron_type: str | None = None, limit: int = 20) -> pa.Table:
        import pyarrow.compute as pc
        if not 1 <= limit <= 10000:
            raise ValueError("limit must be 1..10000")
        table = self.neurons
        if neuron_type is not None:
            table = table.filter(pc.equal(table["type"], neuron_type))
        return table.slice(0, limit)

    def outgoing(self, body_id: int, limit: int = 20) -> dict[str, np.ndarray]:
        if not 1 <= limit <= 10000:
            raise ValueError("limit must be 1..10000")
        index = self.index(body_id)
        begin, end = self.adjacency.indptr[index:index + 2]
        end = min(end, begin + limit)
        return {"body_post": self.body_ids[self.adjacency.indices[begin:end]], "weight": self.adjacency.data[begin:end].copy()}

    def subgraph(self, body_ids: list[int] | np.ndarray) -> ConnectomeGraph:
        # Sorted IDs keep binary search consistent and make the row/column mapping explicit.
        requested = np.asarray(body_ids)
        if requested.size and (requested.dtype.kind not in "iu" or np.any(requested > np.iinfo(np.int64).max)):
            raise ValueError("Subgraph IDs must be exact signed-64-bit integers")
        requested = requested.astype(np.int64)
        if requested.ndim != 1 or len(np.unique(requested)) != len(requested):
            raise ValueError("Subgraph IDs must be a one-dimensional unique list")
        requested = np.sort(requested)
        indices = np.array([self.index(int(body)) for body in requested], dtype=np.int64)
        adjacency = self.adjacency[indices, :][:, indices].tocsr()
        return ConnectomeGraph(self.neurons.take(pa.array(indices)), requested, adjacency)

