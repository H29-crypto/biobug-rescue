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
