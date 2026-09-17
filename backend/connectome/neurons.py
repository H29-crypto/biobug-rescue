from __future__ import annotations
from pathlib import Path
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
from .columnar import batches, integer_column

SELECTION = "nonempty superclass excluding any superclass containing 'tbc' (authors' counting rule); no status or type filter"


def load_neurons(annotation_path: Path, nt_path: Path) -> tuple[pa.Table, np.ndarray, dict]:
    table = feather.read_table(annotation_path)
    required = {"bodyId", "superclass", "type", "status", "somaLocation", "tosomaLocation"}
    if missing := required - set(table.column_names):
        raise ValueError(f"Annotations missing columns: {sorted(missing)}")
    raw_ids = integer_column(table, "bodyId")
    if len(np.unique(raw_ids)) != len(raw_ids):
        raise ValueError("Duplicate neuron bodyId in annotations")
    raw_count = table.num_rows
    superclass = pc.fill_null(table["superclass"], "")
    mask = pc.and_(pc.not_equal(superclass, ""), pc.invert(pc.match_substring(superclass, "tbc")))
    table = table.filter(mask)
    if not table.num_rows:
        raise ValueError("No neurons match the documented superclass selection")
    table = table.take(pc.sort_indices(table, sort_keys=[("bodyId", "ascending")]))
    ids = table["bodyId"].to_numpy().copy()
    with pa.OSFile(str(nt_path), "rb") as source:
        nt_columns = pa.ipc.open_file(source).schema.names
    required_nt = {"body", "predicted_nt", "consensus_nt", "ground_truth"}
    if not required_nt.issubset(nt_columns):
        raise ValueError("Neurotransmitter table missing required columns")
    selected_batches = []
    nt_source_rows = 0
    for batch in batches(nt_path, nt_columns):
        integer_column(batch, "body")
        nt_source_rows += batch.num_rows
        selected_batches.append(batch.filter(pc.is_in(batch["body"], value_set=pa.array(ids))))
    nt = pa.Table.from_batches(selected_batches)
    nt_ids = nt["body"].to_numpy()
    if len(np.unique(nt_ids)) != len(nt_ids):
        raise ValueError("Duplicate neurotransmitter body IDs")
    index = pc.index_in(table["bodyId"], value_set=nt["body"])
    for column in nt.column_names:
        if column != "body":
            if column in table.column_names:
                raise ValueError(f"Ambiguous annotation column: {column}")
            table = table.append_column(column, pc.take(nt[column], index))
    for name in ["somaLocation", "tosomaLocation"]:
        if not pa.types.is_list(table[name].type):
            raise ValueError(f"{name} must be a list of coordinate triples")
        lengths = pc.drop_null(pc.list_value_length(table[name])).to_numpy()
        if np.any(lengths != 3):
            raise ValueError(f"{name} contains a coordinate that is not a triple")
    return table, ids, {"annotation_body_records": raw_count, "excluded_annotation_records": raw_count - len(ids),
                        "neurotransmitter_source_records": nt_source_rows, "neurons_missing_nt_record": index.null_count,
                        "selection": SELECTION}


def values(table: pa.Table, column: str) -> list[str]:
    return sorted(value for value in pc.unique(pc.drop_null(table[column])).to_pylist() if value != "")


def annotation_summary(table: pa.Table) -> dict:
    nt = {}
    for column in ["predicted_nt", "celltype_predicted_nt", "consensus_nt", "ground_truth"]:
        if column in table.column_names:
            nt[column] = {str(row["values"]): row["counts"] for row in pc.value_counts(table[column]).to_pylist()}
    return {"columns": table.column_names, "types": values(table, "type"), "superclasses": values(table, "superclass"),
            "neurotransmitters": nt,
            "coordinates": {name: {"available": table.num_rows - table[name].null_count, "missing": table[name].null_count}
                            for name in ["somaLocation", "tosomaLocation"]}}
