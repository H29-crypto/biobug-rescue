from __future__ import annotations
from collections.abc import Iterator
from pathlib import Path
import numpy as np
import pyarrow as pa


def batches(path: Path, columns: list[str]) -> Iterator[pa.RecordBatch]:
    # Arrow IPC reads/decompresses one record batch at a time, not the full table.
    with pa.OSFile(str(path), "rb") as source:
        schema = pa.ipc.open_file(source).schema
        missing = set(columns) - set(schema.names)
        if missing:
            raise ValueError(f"{path.name}: missing columns {sorted(missing)}")
        source.seek(0)
        indices = [schema.get_field_index(name) for name in columns]
        reader = pa.ipc.open_file(source, options=pa.ipc.IpcReadOptions(included_fields=indices))
        for index in range(reader.num_record_batches):
            yield reader.get_batch(index)


def integer_column(batch: pa.RecordBatch | pa.Table, name: str, positive: bool = True) -> np.ndarray:
    column = batch.column(name)
    if not pa.types.is_integer(column.type) or column.null_count:
        raise ValueError(f"{name} must be non-null integer data")
    values = column.to_numpy(zero_copy_only=False)
    if np.any(values <= 0) if positive else np.any(values < 0):
        raise ValueError(f"{name} contains invalid {'nonpositive' if positive else 'negative'} values")
    return values


def match_ids(ids: np.ndarray, values: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    positions = np.searchsorted(ids, values)
    if not len(ids):
        return positions, np.zeros(len(values), dtype=bool)
    valid = (positions < len(ids)) & (ids[np.minimum(positions, len(ids) - 1)] == values)
    return positions, valid
