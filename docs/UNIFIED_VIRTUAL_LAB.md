# Unified Virtual BioBug Lab

This milestone combines the existing rescue mission and Virtual Fly Lab under one lab shell. Open `/#virtual-lab` for **Collapsed Building Rescue**, or choose **Controlled Fly Experiments** for the existing single-fly arenas. The legacy `/#rescue` presentation and `/#virtual-fly` link remain available. Switching scenarios closes the active run and starts fresh on return, as stated beside the controls.

## Features

- Original collapsed-building geometry shown as a textured 3D cutaway with rubble, damaged walls, rebar, exploration shading, mission markers and a shared 2D minimap.
- 1, 2, 4 or 8 coordinated agents; Natural Fly, BioBug/Cyborg and simple bodies; visual flying or walking.
- Overview/orbit, selected-agent follow, zoom, scene focus and terrain inspection. Turning mission fog off does not reveal hidden survivors or hazards.
- Existing frontier exploration, peer separation, survivor confirmation, gas detection, mission events and AI Rescue Commander.
- An anatomical inspector for any agent selected through the roster, dropdown or map. Each agent has a separate bounded history of its actual accepted activity samples.
- The original controlled lab experiments, stimulation tools and reproducible comparisons.

Body/motion/camera/selection changes preserve mission progress. Pause freezes simulation and body animation. Agent count changes and Reset Mission redeploy the swarm and clear discoveries/history. Controller and coordination changes require pause. The default is four coordinated agents with Rule-Based control; MaleCNS requires the loaded backend. Rule-Based shows structure only, without invented neural firing.

## Architecture and scientific boundary

`useRescueLab` uses the existing `createSwarm`, `advanceSwarm`, `SwarmNeuralLoop`, detection system and mission snapshot builder. No rescue dynamics, paths, controller equations, motor decoder, neural dynamics, sensing or detection thresholds were rewritten. The new hook owns a separate lab session; legacy Rescue is unaffected.

The existing `/connectome/control-batch` accepts optional `include_activity=true`, default false for compatibility. The response includes the per-neuron peak already computed in each agent's normal control evaluation. There is one batch request per decision, containing one evaluation per agent. No extra request is made when selecting an agent or opening the inspector. Complete batch IDs and all activity arrays are validated before any acceptance. Existing cancellation/generation guards reject stale responses. Histories copy the arrays and retain at most 180 accepted samples per agent.

`AnatomicalPanel` extracts the existing anatomy presentation into a shared component; the original `AnatomicalViewer` wrapper still supplies the single-fly history. Each rescue agent has independent activity; neuron IDs refer to the same real structural controller graph, not separate biological brains.

The rescue renderer has an optional agent factory and camera target height, retaining its original defaults for legacy Rescue. The lab factory reuses the fruit-fly model and reads only public render snapshots. Rendered target markers use sensor-estimated discoveries, never hidden ground truth. The scene disposes all attached geometries/materials on unmount.

The MaleCNS controller uses real structural connectivity with simulated dynamics. Swarm coordination, peer separation, survivor detection, and gas detection are engineering systems; they are not claimed to emerge from the connectome. Flight, wingbeats, body anatomy and building heights are illustrative. Navigation, collisions and sensing remain planar; flying does not permit crossing walls or rubble.

## Validation records

The two existing content-hash baselines have narrowly documented migrations for the shared renderer entry points, anatomy presentation, experience routing and optional API field. Previous and replacement hashes are retained in their `unified_lab_migration` sections. All other protected core files retain their previous hashes. This update does not treat intentional presentation/API extension as a promise that every source byte remains unchanged.

`tests/unified_lab.cjs` checks batch routing and malformed data, independent/bounded histories, stale pause/reset response rejection, exact 60-second mission parity while switching body styles, hidden target protection, and eight-agent animation freezing. `backend/tests/test_rescue_lab.py` compares optional activity batches with original control results for eight agents and counts exactly one evaluation per agent. Existing frontend/backend suites are also run.

`npm run compare:rescue-lab` uses the actual local MaleCNS dataset. It compares original Rescue batches with Natural/walking and BioBug/flying for 1, 4 and 8 agents over three simulated seconds each. Full mission state and trajectories must match; all 295 neural values and sample timestamps must also match between the two visual variants. HTTP latency is normalized to zero in compared state and nondeterministic evaluation duration is excluded. No expected result is substituted. Results are written to `docs/UNIFIED_LAB_COMPARISON.json` only after every comparison passes.

## Files and running

New: `src/unified-lab/` (scenario shell, rescue page, session hook, activity observer/parser, model adapter and scoped CSS), `scripts/compile_unified_lab.cjs`, `scripts/compare_rescue_lab.cjs`, frontend/backend integration tests and this document.

Shared changes: `src/Experiences.tsx`, `src/components/Rescue3D.tsx`, `src/rendering/rescue3d/scene.ts`, `src/virtual-fly/AnatomicalViewer.tsx`, `backend/connectome/api.py`, package scripts, and documented baseline migrations. Earlier uncommitted fly embodiment work is retained.

```powershell
# Frontend, from project root:
npm run dev
# Backend, in a second terminal from project root:
backend/.venv/Scripts/python.exe -m uvicorn connectome.api:app --app-dir backend --host 127.0.0.1 --port 8000
# Validation:
npm test
npm run build
npm run compare:rescue-lab
```

Backend startup loads the real dataset and may take several minutes. The UI polls readiness; Rule-Based works while loading. No automatic commit was made.
## Completed verification (29 September 2026 local time)

- Frontend: **109 checks passed** (104 existing plus five unified-lab checks).
- Backend: **131 passed, one opt-in integration test skipped**. Nonfatal warnings: a dependency deprecation and an unwritable pytest cache; tests completed successfully using the workspace basetemp.
- TypeScript/Vite production build passed.
- Real dataset comparison: **585 evaluations passed**, with exact mission-state/trajectory equality for 1, 4 and 8 agents and exact full activity histories across walking/flying. See `UNIFIED_LAB_COMPARISON.json`; its timestamp is UTC.
- Browser: the four-agent Rule-Based mission confirmed both survivors and detected both hazards; the second survivor was confirmed at approximately 25.7 simulated seconds. A MaleCNS run showed separate accepted histories: at body time 7.68 s, agent 1 had zero left/right DNa02 peaks while agent 3 had 0.0417 / 0.0996. Changing selection preserved the paused time and batch count (39).
- Browser checks cover detailed flying models, follow camera, live anatomy, controller readiness and responsive panel layout. Renderer defaults for legacy Rescue are covered by its existing scene tests. The original single-fly wrapper continues to use its own experiment history.

Performance boundary: the lab renders up to eight procedural fruit flies plus a single selected-agent anatomy viewer; it does not create eight anatomy scenes or download a full connectivity matrix to the browser. The existing rescue renderer retains its shadow pass and DPR cap. No hardware-independent FPS target is claimed. Lower detail (Simple), 2D map and hiding the neuron panel remain available. Every visual/observer path tested leaves simulated behavior unchanged.
Follow mode uses compact selected-agent labels and hides the insertion-point label so clustered deployment labels do not cover the bodies. Overview retains all roster labels. Both choices remain purely visual; legacy Rescue uses its original labels.


Current rescue operator controls, backpack limitations and altitude navigation are documented in [RESCUE_OPERATIONS.md](RESCUE_OPERATIONS.md). Earlier visual-only flight descriptions refer to the previous milestone.
