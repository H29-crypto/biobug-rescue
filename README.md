# BioBug Rescue

Autonomous insect-scale exploration, simulated for places conventional robots struggle to reach.

## Problem

Collapsed structures and hazardous confined spaces can leave rescuers with little information about inaccessible areas. Future small robotic platforms could help gather that information before people enter.

## Solution

A browser simulation of coordinated BioBugs that explore, share a map, detect simulated life and gas signals, and present grounded mission facts to a human operator. This is a hackathon software prototype, not deployed rescue hardware.

## Demo

Open the app, choose **ENTER RESCUE**, and press **DEPLOY SWARM**. Presentation Mode defaults to four coordinated BioBugs, seed 2026, Rule-Based navigation. Discoveries appear beside the map; scorecards show coverage, confirmed survivors, hazards and simulated time. **RESET DEMO** restores this exact configuration, clears the mission and Commander history, and returns to the opening screen.

Use **TECHNICAL VIEW** for the controller explanation and measured evidence. Pause before changing controllers. Full three-minute script and recovery checklist: [docs/DEMO.md](docs/DEMO.md).

## Virtual Fly Lab

The opening screen now offers a second, isolated experience: **ENTER LAB** (`#virtual-fly`). One illustrated virtual fly walks in five deterministic arenas with Rule-Based or MaleCNS-derived control. Inspect live sensory/neural readouts, compare paths from identical starts, export telemetry, or pause for independent stimulation. Rescue remains at `#rescue` with its existing behavior.

The lab reuses the same loaded backend and 295-neuron structural graph. Its sensory mapping, activity and movement are explicitly engineering models. Start the existing backend for MaleCNS; Rule-Based works offline. Run `npm run compare:fly -- 30` for reproducible real-backend experiments. See [Virtual Fly Lab architecture, evidence, results and limitations](docs/VIRTUAL_FLY_LAB.md).

## 3D Rescue View

Choose **3D RESCUE VIEW** for a game-like structural cutaway of the same live mission. It includes procedural damaged concrete, rubble, six-legged insect models, distance-driven walking animation, observed discovery beacons and a shared-map inset. **OVERHEAD** supports drag-to-orbit and scroll-to-zoom; **FOLLOW BIOBUG** tracks the selected agent. Select agents on the scene or roster. **FOCUS SCENE** enlarges the scene; Escape exits focus.

This is a visual representation of the existing 2D simulation. Bodies, heights and leg animation are illustrative; no new physics, sensing, neural dynamics or hardware claims are introduced. **MISSION FOG OFF** reveals terrain only, never hidden targets. Three.js loads only when this view is opened. Unsupported or lost WebGL falls back to the live 2D map. See [3D implementation and validation](docs/3D_RESCUE_VIEW.md).

## Architecture

```text
Rescue environment → BioBug sensors → Navigation
                                      ├─ Rule-Based
                                      └─ MaleCNS structure → Simulated dynamics → Motor decoder
                                                ↓
BioBug swarm → Shared rescue map → AI Rescue Commander → Human operator
```

React + TypeScript + Vite own the interface; Canvas draws the map. `src/simulation/` owns fixed-step movement, sensing, coordination and discoveries. `backend/connectome/` loads and queries sparse structural data and runs bounded neural experiments. `backend/commander/` validates and grounds advisory AI responses. Presentation state does not change the simulation algorithms.

## MaleCNS Integration

**MaleCNS-connectome-based computational controller**: real MaleCNS v1.0 structural connectivity with simulated neural dynamics, engineering sensory mapping and an engineering motor decoder. This is not a biologically accurate fly-brain simulation.

The recorded selected dataset contains **166,606 neurons, 25,574,615 directed connections and 124,144,950 contacts**. Selection excludes empty or `tbc` superclasses; these are not universal counts of the full CNS. The configured ProLN→DNa02 control graph contains **295 neurons, 280 edges and 2,308 contacts**. Technical View distinguishes live backend counts from recorded inspection evidence and labels simulated activity separately.

See [dataset provenance](docs/MALECNS.md), [pathways](docs/MALECNS_PATHWAYS.md), [dynamics](docs/MALECNS_DYNAMICS.md) and [controller](docs/MALECNS_CONTROLLER.md).

## AI Rescue Commander

OpenAI Responses API selects facts from an allowlisted mission snapshot; the backend validates selections and renders grounded structured responses. AI never controls the swarm. Quick actions cover summaries, survivors, hazards and MaleCNS. **SYSTEM SUMMARY** remains available without OpenAI or the backend.

Keys belong only in the backend environment. Requests send observed telemetry and the question, not hidden targets or connectome matrices. Prior live validation: three accepted requests, mean **3.02 s**, nearest-rank p95 **4.61 s**; this small sample is not a latency guarantee. [Integration and evidence](docs/AI_RESCUE_COMMANDER.md).

## Measured Results

| Experiment | Rule-Based | MaleCNS |
| --- | ---: | ---: |
| Historical 120 s single-agent average coverage, five seeds | 40.41% | 37.28% |
| Seed-2026 four-agent rescue: both survivors confirmed | 25.75 s | 37.50 s |
| Same rescue: coverage after 60 simulated seconds | 76.16% | 56.50% |

The single-agent experiment predates the rescue scenario. Rescue results use one fixed designed map, coordinated agents and actual backend responses. Times are simulated time. MaleCNS is an experimental research controller, not claimed to outperform conventional navigation.

Sources: [controller comparison](docs/MALECNS_CONTROLLER_COMPARISON.json), [rescue experiment](docs/RESCUE_EXPERIMENT.json). The compact presentation fixture is tested against these reports.

## What Is Real vs Simulated

| Category | Components |
| --- | --- |
| Real data | MaleCNS structural connectome |
| Real software | Swarm simulation, connectome processing, neural dynamics engine, rescue sensing simulation, AI Commander |
| Simulated | BioBug bodies, rescue environment, life/gas sensors, neural activity |
| Future hardware | Insect-scale robotic or biohybrid platform; not demonstrated here |

## Running Locally

Node.js 22.12+ and Python 3.11+ are recommended for the existing toolchain. From the project root:

```powershell
npm install
npm run demo
```

Open the Vite URL (normally http://127.0.0.1:5173). Rule-Based rescue and System Summary work independently of the backend.

In a second terminal, for MaleCNS and AI:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.lock.txt
.\.venv\Scripts\python -m connectome.download
# Optional AI key: enter privately in this terminal, not in source files.
$env:OPENAI_API_KEY = Read-Host 'OpenAI API key' -MaskInput
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

`-MaskInput` requires PowerShell 7. Existing installs can skip setup/download. The pinned source files total about 1.89 GB; backend startup may take several minutes. Wait for **MALECNS READY**. The UI cannot distinguish an unreachable server from a server still doing its blocking startup, and says so explicitly. See [backend instructions](backend/README.md).

Production preview: `npm run build`, then `npm run preview -- --port 5173`. Stop another server on that port first.

## Tests

```powershell
npm test
npm run build
cd backend
.\.venv\Scripts\python -m pytest -q
```

Frontend checks cover physics, controller contracts, swarm coordination, rescue evidence, Commander failure isolation and presentation defaults/reset/data provenance. Python tests cover data parsing, sparse graphs, API contracts, pathways, dynamics and Commander grounding. The optional full-data integration test is enabled with `MALECNS_INTEGRATION=1`.

## Limitations

One deliberately designed map; simplified sensing and localization; no hardware or clinical validation. Coverage is grid-based and exploration is not guaranteed complete. MaleCNS dynamics and sensor/motor mappings are engineering assumptions. Network delays hold neural movement; backend failure pauses it visibly. Startup blocks backend endpoints until data load completes. AI needs network access and a backend key, can fail, and remains advisory. Scenario totals are known demo objectives; target positions remain hidden until sensing.

## Future Work

Evaluate generalization across environments and investigate hardware feasibility in separately scoped work. No additional research, training, sensor types, hardware integration or deployment features are part of this presentation milestone.

## Data / Research Attribution

MaleCNS v1.0 from the [official Janelia project](https://male-cns.janelia.org/), released June 8, 2026; data licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Berg et al. (2026), *Sexual dimorphism in the complete Drosophila male central nervous system connectome*, Cell, [doi:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015). Selection, sparse conversion and engineering dynamics are our transformations. Full sources, checksums, scope and citation: [MALECNS.md](docs/MALECNS.md).
