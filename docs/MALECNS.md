# MaleCNS v1.0 investigation and structural-data backend

## Scientific scope

This milestone loads and queries **structural connectivity**, not an executable biological brain. It implements no neural dynamics, sensor-to-neuron mapping, motor interpretation, training, or BioBug control changes. The working frontend remains on its existing rule-based controller.

If a later milestone adds dynamics, describe it as **MaleCNS-connectome-based computational controller** or **Controller using the real MaleCNS structural connectome with simulated neural dynamics**. Neither wording establishes biological accuracy. Structural synaptic contact counts are not calibrated functional weights, neurotransmitter predictions are not certainty, and connectivity alone does not specify electrophysiology or behavior.

## Authoritative sources and citation

- Official project: https://male-cns.janelia.org/
- Download documentation: https://male-cns.janelia.org/download/
- Release notes: https://male-cns.janelia.org/release/ — **v1.0, June 8, 2026**.
- neuPrint dataset: `male-cns:v1.0`.
- Official storage prefix: `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/`.
- HTTPS equivalent: `https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/`.
- Machine-readable published metadata: `https://storage.googleapis.com/flyem-male-cns/v1.0/database/neuprint-inputs/Neuprint_Meta_debug.json`.
- Data license: **CC BY 4.0**, linked directly from the official download page: https://creativecommons.org/licenses/by/4.0/. Attribute the original authors/collaboration, retain the license link, and identify transformations when sharing derived data. This does not establish a license for this application's own code.
- Producers: FlyEM at HHMI Janelia; University of Cambridge/MRC Laboratory of Molecular Biology Drosophila Connectomics Group; Google Research Connectomics.
- Published citation: Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2026). *Sexual dimorphism in the complete Drosophila male central nervous system connectome*. **Cell 189(18), 5504–5526.e15**. https://doi.org/10.1016/j.cell.2026.08.015. Publication date September 3, 2026; bibliographic record: https://pubmed.ncbi.nlm.nih.gov/42691995/.
- Accompanying research repository: https://github.com/flyconnectome/2025malecns. Its notebook and README still refer to the **2025 preprint and v0.9**; they are not an exact v1.0 count oracle.
- Pinned counting notebook: https://github.com/flyconnectome/2025malecns/blob/3be84fa8c64fca9fdc76aeb1d5decf008398e3a9/supplemental_data/quantify-neuron-connections.ipynb.

Investigated on September 17–18, 2026. `backend/connectome/sources.json` pins the five downloaded objects by GCS generation, exact byte size and publisher MD5. It also records the notebook reference version separately. Every load verifies file length and MD5, records a SHA-256 fingerprint, and checks the embedded dataset/version. The binaries are ignored by Git; they are downloaded reproducibly rather than copied from a third-party bundle.

## Files, exact sizes, and relevant columns

Sizes below are **bytes from the official GCS object inventory**, not rounded marketing sizes. The five required downloads total **1,888,818,731 bytes** (~1.76 GiB). `docs/malecns-source-catalog.json` preserves generation IDs, checksums and dates. All five core file schemas were read locally. Schemas for the large synaptic point, partner and t-bar tables were inspected with HTTP byte ranges (277,870 bytes in total), without downloading their full contents; their schema inventory is in `docs/malecns-remote-schemas.json`.

| File / source URL | Download bytes | Prototype use | Relevant columns |
| --- | ---: | --- | --- |
| [body-annotations-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather) | 14,483,314 | Downloaded and used | bodyId (int64), superclass, class, subclass, supertype, type, instance, statusLabel, status; somaLocation, tosomaLocation (list<int64>) |
| [body-neurotransmitters-male-cns-v1.0.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-neurotransmitters-male-cns-v1.0.feather) | 43,282,834 | Downloaded and used | body (int64), cell_type, total_nt_predictions, predicted_nt, predicted_nt_confidence, ground_truth, celltype_total_nt_predictions, celltype_predicted_nt, celltype_predicted_nt_confidence, consensus_nt |
| [body-stats-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-stats-male-cns-v1.0-minconf-0.5.feather) | 778,062,826 | Downloaded and used | body, pre, post, status_fine, superclass, class, type, instance, downstream, synweight, rank |
| [connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5-significant-only.feather) | 502,169,298 | Catalogued; not loaded | Published alternative edge/partner subset; not used here (subset semantics not inferred from name alone) |
| [connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5-traced-only.feather) | 508,025,642 | Catalogued; not loaded | Published alternative edge/partner subset; not used here (subset semantics not inferred from name alone) |
| [connectome-weights-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather) | 1,051,241,946 | Downloaded and used | body_pre (int64), body_post (int64), weight (int64 contact count) |
| [syn-partners-male-cns-v1.0-minconf-0.5-significant-only.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/syn-partners-male-cns-v1.0-minconf-0.5-significant-only.feather) | 2,965,702,122 | Catalogued; not loaded | Published alternative edge/partner subset; not used here (subset semantics not inferred from name alone) |
| [syn-partners-male-cns-v1.0-minconf-0.5-traced-only.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/syn-partners-male-cns-v1.0-minconf-0.5-traced-only.feather) | 2,965,367,002 | Catalogued; not loaded | Published alternative edge/partner subset; not used here (subset semantics not inferred from name alone) |
| [syn-partners-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/syn-partners-male-cns-v1.0-minconf-0.5.feather) | 6,777,179,098 | Catalogued; not loaded | x_pre, y_pre, z_pre, body_pre, conf_pre, x_post, y_post, z_post, body_post, conf_post, primary_post |
| [syn-points-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/syn-points-male-cns-v1.0-minconf-0.5.feather) | 13,061,489,098 | Catalogued; not loaded | point_id, x, y, z, kind, conf, sv, body, compartment, major, primary, superprimary, subprimary, optic-lobe column/layer annotations and label columns |
| [tbar-neurotransmitters-male-cns-v1.0.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/tbar-neurotransmitters-male-cns-v1.0.feather) | 2,651,680,218 | Catalogued; not loaded | point_id, x, y, z, conf, sv, body, major, primary, seven nt_*_prob columns, split |
| [Neuprint_Meta_debug.json](https://storage.googleapis.com/flyem-male-cns/v1.0/database/neuprint-inputs/Neuprint_Meta_debug.json) | 1,747,811 | Downloaded and validated | dataset, tag, totalPreCount, totalPostCount, voxelSize, voxelUnits, neuronProperties, roiInfo, lastDatabaseEdit |

### Identity and annotation details

`bodyId` in the annotation table is the segment/neuron identifier. Join it to `body` in the neurotransmitter/body-statistics tables and `body_pre`/`body_post` in edges. These identifiers are kept as int64; array positions are separate contiguous indices. The annotation file has **211,577 records**, including **11,864 records marked Glia**, orphan fragments and incomplete/unclassified objects. Calling all records neurons would be misleading.

The loaded graph applies the authors' counting-notebook rule: keep a nonempty `superclass` that does **not** contain `tbc`; retain isolated selected neurons; keep only edges whose **two endpoints** pass that rule. No additional status, cell-type or weight threshold is imposed. This is an explicitly defined **neuron-induced subgraph of the full segment graph**; it is not the complete graph of all fragments, nor an assertion that every included object is equally well proofread. This selects **166,606 neurons**, with **206 isolated** under the selected connectivity. It excludes 44,971 annotation records and 126,282,069 source edge rows. No IDs or neurons are invented.

All original annotation columns are retained: `assignedOlHex1`, `assignedOlHex2`, `bodyId`, `flywireType`, `group`, `instance`, `somaSide`, `statusLabel`, `superclass`, `type`, `vfbId`, `hemibrainType`, `itoleeHl`, `supertype`, `birthtime`, `mancBodyid`, `mancGroup`, `mancType`, `subclass`, `synonyms`, `class`, `rootSide`, `somaNeuromere`, `trumanHl`, `dimorphism`, `matchingNotes`, `entryNerve`, `mancSerial`, `mcnsSerial`, `serialMotif`, `fruDsx`, `exitNerve`, `receptorType`, `somaLocation`, `tosomaLocation`, and `status`.

There are **11,751 distinct nonempty type labels** in the selected data (including unclear labels; this is not the authors' filtered count of recognized types). The complete available-type list is generated in `docs/MALECNS_INSPECTION.json`, or printed by `python -m connectome.inspect --all-types`. The 21 selected superclasses are: ENS, ascending_neuron, cb_efferent, cb_endocrine, cb_intrinsic, cb_motor, cb_sensory, descending_neuron, efferent_ascending, efferent_descending, ol_intrinsic, ol_sensory, sensory_ascending, sensory_descending, visual_centrifugal, visual_projection, vnc_efferent, vnc_endocrine, vnc_intrinsic, vnc_motor and vnc_sensory.

### Edges and contact counts

An edge is a **directed ordered pair** (`body_pre`, `body_post`). `weight` is its integer synaptic contact count. All exported positive weights are retained. CSR entry `[i,j]` counts contacts from body ID at row `i` to body ID at column `j`. A missing pair has zero contacts; requesting an unknown neuron ID raises an error rather than pretending it is an isolated neuron.

The loader checks integer/non-null IDs and positive integer weights, and sums duplicate pairs with an explicit diagnostic (none were present in the selected real data). The full raw file contains **151,856,684 segment-pair rows**, representing **311,833,243 contacts**. The selected sparse neuron graph has **25,574,615 edges** and **124,144,950 contacts**. A contact count is distinct from the number of presynaptic sites: one presynaptic site may have multiple postsynaptic partners. This prototype does not load individual contact coordinates into memory.

### Neurotransmitters

The downloaded body-neurotransmitter table contains **1,835,518 records**, including segments outside the selected neuron graph. The join is by body ID, never by row order. **166 selected neurons have no matching NT record**; they remain null instead of receiving guessed labels.

Available chemical labels: acetylcholine, glutamate, GABA (`gaba`), dopamine, serotonin, octopamine and histamine. `unclear` is an uncertainty label, not an additional transmitter. Preserve `predicted_nt`, `predicted_nt_confidence`, `celltype_predicted_nt`, `celltype_predicted_nt_confidence`, `ground_truth`, `consensus_nt`, and their prediction counts separately. The meaning and reliability differ; the existence of a field called `ground_truth` is not proof of a direct experimental measurement for every neuron. No excitatory/inhibitory signs are inferred from these fields here.

Measured consensus counts in the selected graph:

| Consensus annotation | Neurons |
| --- | ---: |
| acetylcholine | 103,691 |
| glutamate | 29,298 |
| gaba | 22,053 |
| histamine | 7,891 |
| dopamine | 392 |
| octopamine | 101 |
| serotonin | 48 |
| unclear | 2,966 |
| missing record / null | 166 |

The inspection report also contains complete counts for raw per-body predictions, per-type predictions and `ground_truth`; they are not interchangeable.

### Coordinates

Yes: `somaLocation` is present for **139,659** selected neurons and missing for **26,947**. `tosomaLocation` is present for **995**. Raw list triples are preserved; missing somata are not synthesized. Dataset metadata declares voxel size `[8,8,8]` nanometers. Preserve the source coordinate system; no registration to the BioBug scene is performed.

The official synapse-point/partner exports provide named x/y/z coordinates in **8 nm voxel units**. Full morphology is separately available as per-body SWC files under `gs://flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{bodyId}.swc` (8 nm units), Neuroglancer precomputed skeletons (1 nm units), and JRC2018 unisex-template skeletons (micrometers). These are distinct representations and coordinate spaces. Soma triples do not replace a full neuron skeleton. Skeleton sizes vary per body; they were not bulk-downloaded.

## Validation and actual measurements

The saved measured run is `docs/MALECNS_INSPECTION.json`. Runtime results are calculated from source rows and sparse arrays, not copied from published totals. Published values appear only as separate validation expectations. The API snapshot is `docs/MALECNS_API_STATUS.json`.

| Quantity | Actual loaded value |
| --- | ---: |
| Dataset | MaleCNS v1.0 |
| Selected neurons | 166,606 |
| Selected neurons with at least one edge | 166,400 |
| Selected directed edges | 25,574,615 |
| Selected underlying contacts | 124,144,950 |
| CSR storage | 307,561,808 bytes (293.31 MiB) |
| Arrow neuron/NT table | 57,125,342 bytes (54.48 MiB) |
| Body-ID array | 1,332,848 bytes (1.27 MiB) |
| Total retained numeric/Arrow arrays | 366,019,998 bytes (349.06 MiB) |
| Process RSS after CLI load | 557,375,488 bytes (531.55 MiB) |
| Sampled peak RSS during CLI load | 962,314,240 bytes (917.73 MiB) |
| CLI load, including checksum verification | 71.654 seconds |
| Separate API startup load | 64.008 seconds |

These are measurements on this machine using Python 3.13.2, not performance guarantees. Download time is excluded. Peak RSS is sampled every 20 ms and may miss very brief peaks. Retained-array accounting excludes interpreter, allocator, report dictionaries and temporary working arrays; process RSS includes them. API memory fields are a startup-load snapshot, not a continuous memory monitor. The loader is single-process and uses no edge dictionaries or dense adjacency matrix.

Same-version audits all passed:

- Summed `body-stats.pre`: **45,656,140**, equal to official `totalPreCount`.
- Summed `body-stats.post`: **311,833,243**, equal to official `totalPostCount`.
- Full edge-weight sum: **311,833,243**, equal to summed `body-stats.downstream`.
- Selected CSR-weight sum: **124,144,950**, equal to selected raw edge-weight sum.
- The body-statistics file contains **88,384,522 segment records**. They are audited in batches, not instantiated as neurons.

The pinned authors' **v0.9** notebook reports 166,391 connected neurons and 25,563,426 edges under its superclass rule. Our v1.0 selection differs by **+9 connected neurons**, **+11,189 edges**, and **+1 accepted superclass**. These deltas are visible as cross-version references, not hidden and not labeled failed exact-version invariants. The official v1.0 metadata only gives a rounded `167k` neuron description, so we do not treat that as an exact count. Different published totals can reflect both release changes and neuron-selection rules.

`--strict` exits nonzero for exact-version count discrepancies. Parser errors, wrong versions, invalid weights, and checksum/size failures stop loading. If the API cannot load files, status returns `loaded: false` with null counts and an error; it never falls back to synthetic data. The test suite includes deliberately mismatched counts to ensure discrepancies are reported.

## Reproduce and query

From `biobug-rescue/backend`, using PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.lock.txt
.\.venv\Scripts\python -m connectome.download
.\.venv\Scripts\python -m connectome.inspect --report data/inspection.json --strict
.\.venv\Scripts\python -m connectome.inspect --neuron 10001 --edge 10352 10351 --subgraph 10352 10351
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

With the environment activated, the requested command is simply `python -m connectome.inspect`. On Linux/macOS use `.venv/bin/python`. Use `--data-dir` for CLI data location, or `MALECNS_DATA_DIR` for the API. Cached files are reverified; mismatched files produce a clear failure. Downloads use an atomic `.part` rename and bounded retries, pin the GCS object generation, and require no neuPrint account/token. Reserve roughly 3 GB for data plus the Python environment and some headroom; the huge coordinate/EM tables are not part of the download command.

Read-only API endpoints:

- `GET http://127.0.0.1:8000/connectome/status`
- `GET http://127.0.0.1:8000/connectome/neurons/10001`
- `GET http://127.0.0.1:8000/connectome/neurons?neuron_type=DNp01&limit=20`
- `GET http://127.0.0.1:8000/connectome/edges/10352/10351`
- OpenAPI docs: `http://127.0.0.1:8000/docs`.

Verified real query: `10352 -> 10351` has **2,591** contacts. Its two-node induced subgraph contains **2** directed edges and **2,987** contacts. Query functions operate on real body IDs and never assign invented motor roles. `graph.subgraph([...])` returns a CSR induced graph with an explicit sorted body-ID mapping; incoming and outgoing cross-boundary edges are intentionally excluded.

## Architecture and tests

`backend/connectome/`: `metadata.py` handles pinned source metadata; `download.py` verifies/downloads; `columnar.py` reads Arrow batches; `neurons.py` selects/joins metadata; `edges.py` builds a directed integer CSR graph; `graph.py` supports lookup, type queries, outgoing edges and induced subgraphs; `validation.py` separates measurements from expectations; `loader.py` orchestrates and measures memory/time; `inspect.py` is the CLI; `api.py` is the independent FastAPI server.

The full edge file is scanned twice: first to count selected edges, then to fill preallocated NumPy arrays for COO-to-CSR conversion. Only one Arrow record batch is decoded at a time. The additional segment-statistics file is scanned once for the independent metadata audit. The selected graph and joined annotations are retained; raw fragment graphs are not retained as adjacency structures. Starting additional API workers duplicates the graph, so use one worker for this prototype.

```powershell
# backend/
.\.venv\Scripts\python -m pytest -q
$env:MALECNS_INTEGRATION = '1'
.\.venv\Scripts\python -m pytest -q
# project root
npm test
npm run build
```

Verified: **23 fast backend tests plus the real-data integration test**, **9 unchanged frontend simulation checks**, and **production build** all pass. Backend coverage includes parsing, selection, missing/duplicate IDs, invalid weights, large integer IDs, CSR direction and aggregation, neuron/edge lookup, strict integer subgraph IDs, source integrity, pinned/atomic download behavior, release checks, discrepancy reporting, and loaded/unloaded API status. Two dependency deprecation warnings from Starlette/httpx/AnyIO appear; they do not fail tests. No frontend source files or controller behavior were changed. In the Codex sandbox, pytest may be unable to reuse a temporary directory from an earlier permission session. The final fast test run used a fresh directory under the project work folder via --basetemp and disabled the pytest cache with -p no:cacheprovider; this is a sandbox workaround, not a parser failure.

## Technical limits and next-step boundary

- This is a structural data/query backend, not neural dynamics or a biologically accurate fly-brain simulation.
- The graph deliberately excludes glia/unclassified/tbc annotation records and unselected endpoints; reports distinguish the neuron graph from the audited full segment export.
- Confidence filtering is inherited from the official `minconf-0.5` files. We cannot recover omitted low-confidence contacts from these files.
- Sparse weights are counts, not fitted synaptic conductances, delays, receptor effects or learned policy parameters.
- Missing/unclear neurotransmitter values and missing coordinates remain explicit. Electrical coupling and physiology are not inferred.
- The 20 ms memory sampler is approximate. Cold startup rereads and verifies ~1.76 GiB; there is no derived-graph cache yet. The API finishes loading before accepting requests.
- The prototype is a local read-only API; it is not wired into React. The existing rule-based BioBug remains operational without running Python.
- Reproducibility depends on the original versioned objects remaining accessible; a removed generation fails explicitly rather than silently switching releases.

No sensor mapping, neural dynamics, new motor neurons, controller replacement, swarm, survivor detection, backend-driven movement, OpenAI or training was implemented.

