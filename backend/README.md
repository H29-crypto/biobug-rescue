# MaleCNS structural-data backend

This standalone backend loads the official MaleCNS v1.0 structural connectome. It does not simulate neural dynamics or control BioBug. See `../docs/MALECNS.md` for provenance, selection rules, exact source filenames, measured counts, annotation details and limitations.

From this directory in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.lock.txt
.\.venv\Scripts\python -m connectome.download
.\.venv\Scripts\python -m connectome.inspect --report data/inspection.json --strict
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

With the venv activated, `python -m connectome.inspect` works directly. On Unix use `.venv/bin/python`. The five files total 1,888,818,731 bytes; no credentials are needed. The loader retains the documented neuron-induced graph and reports statistics for excluded source segments separately. Actual counts, source hashes, validation results, memory and load time are printed/saved by the inspector.

Query examples:

```powershell
.\.venv\Scripts\python -m connectome.inspect --neuron 10001 --edge 10352 10351 --subgraph 10352 10351
Invoke-RestMethod http://127.0.0.1:8000/connectome/status
Invoke-RestMethod http://127.0.0.1:8000/connectome/neurons/10001
```

Fast fixture tests: `.\.venv\Scripts\python -m pytest -q`. Add `$env:MALECNS_INTEGRATION='1'` to include the full downloaded-data test. Data, Python environments and caches are ignored by Git. `sources.json` pins official generations and checksums; `requirements.lock.txt` records the installed environment. The frontend needs neither this server nor any API changes to run.

## Static pathway analysis and development viewer

```powershell
.\.venv\Scripts\python -m connectome.pathways --report ../docs/MALECNS_PATHWAYS_ANALYSIS.json --export ../docs/MALECNS_PATHWAY_SUBGRAPH.json
# Optional focused query:
.\.venv\Scripts\python -m connectome.pathways --source front_leg_tactile --target DNa02 --report data/front-leg-DNa02.json
Invoke-RestMethod http://127.0.0.1:8000/connectome/populations
Invoke-RestMethod 'http://127.0.0.1:8000/connectome/pathway-subgraph?source=tactile&target=DNa02&max_nodes=32&max_edges=64'
```

The full CLI compares eight sensory selections against six descending/motor selections at 1, 2 and 3 hops. JSON output includes exact selection predicates, every population ID, annotation inventory, laterality, contact aggregates and strongest intermediate types. All measures are calculated from the loaded graph. No neural activity is propagated. `../docs/MALECNS_PATHWAYS.md` explains the metric and evidence limits.

API requests choose predefined annotation rules, not arbitrary IDs. Bounds are enforced: 4–80 nodes and 3–160 edges. Exports sample the union of widest shortest routes per source; they are not induced or exhaustive subgraphs. Every returned edge retains its original integer contact count. Invalid populations, roles or bounds return 422; unloaded data returns 503. Expensive exports are serialized and a maximum of 16 response variants are cached. Local CORS allows Vite at localhost/127.0.0.1 ports 5173, 5174, 4173 and 4174. Keep this development server bound to 127.0.0.1.

Run the frontend independently with `npm run dev` from the project root. Expand **MaleCNS pathway explorer** below the simulation. Without the backend, the panel reports unavailable data and the existing BioBug simulation continues normally.
