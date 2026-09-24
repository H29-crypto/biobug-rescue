# MaleCNS structural-data backend

This backend loads the official MaleCNS v1.0 structural connectome and provides structural pathway analysis, a manual experimental dynamics lab, and compact sensory experiments for the optional MaleCNS movement mode. Simulated activity feeds a separately labeled frontend engineering motor decoder. See `../docs/MALECNS.md` for provenance, selection rules, exact source filenames, measured counts, annotation details and limitations; see `../docs/MALECNS_DYNAMICS.md` for the activity model and `../docs/MALECNS_CONTROLLER.md` for movement integration.

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

## Experimental dynamics (Milestone 3C)

With the backend running, use the Neural dynamics lab inside the frontend pathway explorer, or POST JSON:

```powershell
$body = '{"stimulus":{"left":0.8,"right":0.2,"front":0.6},"steps":10,"pulse_steps":3,"parameters":{"sign_mode":"unsigned"}}'
Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $body http://127.0.0.1:8000/connectome/simulate
.\.venv\Scripts\python -m connectome.dynamics_experiment --report ../docs/MALECNS_DYNAMICS_EXPERIMENTS.json
.\.venv\Scripts\python -m connectome.dynamics_experiment --hops 3 --report ../docs/MALECNS_DYNAMICS_3HOP.json
```

The API only simulates the complete two-hop ProLN→DNa02 route union, lazily extracted once after the existing full-data load. Three-hop expansion is CLI-only and capped at 5,000 nodes/100,000 edges, with explicit refusal rather than truncation. Requests run independently from zero, validate finite bounded stimulus/parameters, enforce gain < decay, cap steps at 200 and top-k at 20, and never mutate structural counts or control BioBug. POST CORS supports the existing local Vite origins. The API serializes extraction/experiments with the existing analysis lock; returned handler time excludes JSON serialization/network time.

`dynamics_experiment` defaults to 20 steps, pulse_steps=3 and both unsigned and experimental predicted-sign modes for all five presets. It repeats each run and verifies exact trace/summary equality. See `../docs/MALECNS_DYNAMICS.md` for units, sparse orientation, NT assumptions, graph selection, all measured results and reproducible validation. The older structural-only descriptions above refer to Milestone 3B; these dynamics are a separate engineering layer.

## Milestone 3D: compact control experiments

`POST /connectome/control` accepts `{ "left": 0.5, "front": 0.2, "right": 0 }` and returns real graph metadata, independent DNa02 peak readouts and top intermediate types from a stateless unsigned 20-step / three-step pulse experiment. It reuses the extracted graph and cached engineering sparse weights. Sensor mapping and motor semantics live in the frontend; this endpoint does not claim biological steering. Invalid inputs return 422, unavailable data 503. `GET /connectome/control-network` returns all bounded controller nodes/edges, retaining original contacts separately from engineering weights. The manual `/connectome/simulate` endpoint remains available with its experimental sign options.

Use `--no-access-log` with uvicorn during the many-request comparison to keep console output manageable. From the project root, `npm run compare:controllers -- 120` drives the shared TypeScript simulator through actual HTTP. See `../docs/MALECNS_CONTROLLER.md` for the control loop and measured results. BioBug movement now uses this separate endpoint only when MaleCNS mode is explicitly selected; older milestone descriptions above are historical.

## Milestone 4: bounded swarm batches

`POST /connectome/control-batch` accepts `{ "agents": [{ "id": "BioBug #1", "stimulus": { "left": 0.5, "front": 0, "right": 0 } }] }`. Supply 1–8 unique nonempty IDs (up to 64 characters). Response `results` contains each ID and its independent compact `response`. One cached graph/weight matrix serves all agents; every evaluation starts from zero. No shared neural state, new biological mapping or swarm planner is implemented in Python. The frontend handles engineering coordination and stops the entire swarm on a failed batch. Existing single-agent and lab endpoints remain available. Run `npm run compare:swarms -- 60` from the project root with this backend running.

## Advisory Commander

`GET /commander/status` and `POST /commander/brief` are isolated in `commander/`. The latter accepts `{snapshot, question}` and returns a grounded brief or an explicit offline status. Set backend-only `OPENAI_API_KEY`; optional `OPENAI_MODEL` defaults to `gpt-4.1-mini`. No key is required for local simulation, MaleCNS control or automated tests. See [AI Rescue Commander](../docs/AI_RESCUE_COMMANDER.md) for secure PowerShell setup, schemas and measurement limitations.
