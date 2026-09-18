# BioBug Rescue

A browser-based, bio-inspired search-and-rescue simulation. This is a hackathon demonstration, not an accurate insect brain model or a real rescue system.

## Run locally

Requires Node.js 22.12+ (verified with Node.js 24).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production validation: `npm run build`. Preview the build with `npm run preview`.

## Architecture

- `src/domain/types.ts`: shared, framework-independent contracts for the environment, agents, sensors, neurons, discoveries, and swarm.
- `src/scenarios/earthquake.ts`: deterministic scenario factory; world geometry and initially unexplored terrain.
- `src/rendering/drawEnvironment.ts`: Canvas-only drawing, independent of React. World coordinates remain stable when the screen resizes.
- `src/components/EnvironmentCanvas.tsx`: React-to-Canvas lifecycle, responsive sizing, device pixel ratio, and cleanup.
- `src/App.tsx`: mission interface and view state.
- `src/simulation/`: fixed-step world updates, collision detection, obstacle sensing, rule-based steering, and exploration.
- Future `src/controllers/`: pure neural activation updates and motor output conversion.

React owns controls and summarized state. The simulation owns mutable world state and a fixed timestep; Canvas renders snapshots. Rendering must never advance the simulation. Keep true environment data separate from discovered knowledge; exploration radius and wall occlusion determine what the shared exploration grid reveals. An inspection toggle is a development view and never updates discovery data.

## MVP

One deterministic collapsed-building scenario, a small swarm, collision-safe movement, progressive shared fog of war, simulated survivor/hazard sensing, and coordinated exploration. Select a BioBug to inspect sensor values, sensory/interneuron/motor activity, and movement outputs. Show coverage, discoveries, and elapsed mission time. Provide pause, resume, and reset. The eventual Rescue Commander is a local rule-based summary panel; no backend, API keys, or OpenAI integration.

Success means the swarm reveals reachable space over time without crossing walls, discoveries persist and are shared, neural activity visibly responds to sensors, and reset reproduces the initial scenario.

## Data structures

All definitions are in `src/domain/types.ts`. Positions and dimensions use world units; heading uses radians; elapsed time uses seconds. A grid uses row-major index `row * columns + column`. Rectangular walls and debris will be solid obstacles.

| Structure | Main fields and purpose |
| --- | --- |
| Environment | ID, name, dimensions, obstacle rectangles, exploration grid, survivors, hazards, entry point. Ground-truth scene plus initial knowledge. |
| BioBug | ID, position, heading, radius, speed, behavior state, sensors, optional future neural controller. One live agent. |
| Sensors | Front/left/right distances in world units and normalized obstacle signals; hazard/survivor/neural cue fields are reserved and remain zero. |
| NeuralController | Sensory, interneuron, and motor neurons with IDs, activation and bias; directed weighted synapses; left/right motor outputs. Planned activation range 0–1; weights may be signed. |
| Survivor | ID, position, undetected/possible/confirmed status, optional discovering bug ID. |
| Hazard | ID, position, influence radius, gas/heat/unstable category, normalized severity, discovery flag. |
| Swarm | Agent array, shared exploration grid, timestamped discovery records, elapsed simulation time. |

The unused NeuralController type is a legacy design contract. Current research uses the real MaleCNS structural connectome; no neural controller executes in the application. Future integration should make sharedExploration the canonical mission knowledge grid rather than maintain two independently mutable copies.

## Original roadmap (Milestone 3 superseded by MaleCNS investigation below)

1. **Environment scene — implemented.** React + TypeScript + Vite; responsive Canvas; walls, debris, seeded unexplored areas, one possible survivor, one gas hazard; legend and static scenario statistics. Inspection toggle reveals geometry without changing coverage. No agents or simulation loop.
2. **Single-agent exploration — implemented.** One BioBug with fixed-step movement, rule-based obstacle avoidance, three ray sensors, collision safety, actual occluded exploration, live inspector, Start/Pause/Reset and debug rays.
3. **Survivor/hazard detection — not started.** Add actual entity sensing, discovery events and mission knowledge beyond simple marker visibility. Obstacle sensing and fog were moved into milestone 2 by the current scope.
4. **Neural control.** Implement sensory-to-interneuron-to-motor activation and differential steering. Add selected-agent panel and neural visualization. Verify a changed obstacle input changes motor outputs.
5. **Shared swarm exploration.** Add several agents, shared discoveries and frontier assignment with local separation. Compare coverage with independent agents using the same scenario and seed.
6. **Mission demo polish.** Pause/resume/reset, live statistics, local Rescue Commander summaries, responsive presentation and repeatable end-to-end demo. Test reset, selection and long-running stability.

## Milestone 2 behavior

Click Start to run, Pause to freeze, or Reset to rebuild the initial world without a page reload. Reset also clears inspection/debug toggles, the random seed, heading, clock, controller memory and fog. The deployment radius starts explored (3.9% of reachable cells). Inspect full map is a renderer-only override; mission statistics and marker counts retain actual exploration state.

- `requestAnimationFrame` supplies elapsed time to a 1/60-second accumulator. Catch-up is capped at 0.1 seconds per frame to avoid jumps after tab suspension.
- The bug has a radius of 7 world units and moves at 42 units/second. Circle/rectangle and map-boundary checks reject invalid moves. Translations are subdivided into at most radius/2 increments to prevent tunneling.
- Front/left/right rays use exact ray/rectangle intersections at 0 and ±60 degrees, up to 85 units from the body edge. Values update after movement as well as before steering.
- A front distance below 22 units causes an in-place turn toward the freer side. A committed turn duration prevents corner oscillation; seed 2026 controls ties, turn duration and gentle wandering. Blocked denotes obstacle-avoidance turning or a rejected movement.
- Exploration reveals cell centers within 75 units with line of sight. The first obstacle cell can also be revealed. Coverage is the explored fraction of a four-neighbor flood-filled grid reachable by the circular body from entry. Flood fill only computes the denominator; the controller has no route planner or knowledge of the full map.
- Survivor/hazard visibility follows the explored cell mask. Their detection fields remain undetected/false; the UI calls them visible markers, not detected entities.

## Limitations

The 20-unit grid approximates accessible area and fog; thin walls and corners can produce coarse visual edges, and narrow passages may be undercounted. Simple local steering can revisit rooms or stall in a small region and does not guarantee complete coverage. At very low frame rates, dropping excess catch-up time deliberately slows simulated time. Only one bug is supported in the current UI. The retained NeuralController and Swarm types are future contracts, with no neural execution, coordination, entity detection or AI services. The independent MaleCNS backend serves structural inspection only.

## Validation

`npm test` runs nine checks covering initial state, walls/debris/bounds, large-step collision safety, ray distances, occlusion, rotation/stopping, 30/60/144 Hz determinism, pause/reset initialization and frame-gap handling. A ten-minute simulation checks every position and sensor range; coverage grew from 3.9% to 67.1% without collisions. `npm run build` validates TypeScript and the production bundle. Browser checks verified live movement/readings, Pause, Reset and inspection without coverage changes.

## Validation environment
Production build and browser rendering were verified. The Codex Windows sandbox blocks esbuild ancestor-directory access during development dependency optimization. If this affects your dev session, run npm run build followed by npm run preview to view the verified production app locally.



## MaleCNS investigation (independent backend)

The next milestone now investigates the actual published MaleCNS v1.0 structural connectome. `backend/` contains a standalone Python/FastAPI loader and sparse graph query API; `docs/MALECNS.md` records sources, license, files, measured results, validation and reproduction commands. The frontend's Milestone 2 rule-based controller is unchanged. No neural dynamics or sensor-to-neuron mapping is implemented. Future work must be described as a MaleCNS-connectome-based computational controller, not a biologically accurate fly-brain simulation. The earlier milestone list is historical; the data-investigation milestone supersedes its former Milestone 3 priority.

## Milestone 3B: static pathway investigation

The development panel **MaleCNS pathway explorer** inspects annotation-selected populations and a bounded real subgraph. Start the backend in a second terminal, expand the panel below the simulation, then select populations and click **Load subgraph**. The BioBug still uses its existing rule-based controller, independently of this panel.

```powershell
cd backend
.\.venv\Scripts\python -m connectome.pathways --report ../docs/MALECNS_PATHWAYS_ANALYSIS.json --export ../docs/MALECNS_PATHWAY_SUBGRAPH.json
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

For a faster focused analysis, use `python -m connectome.pathways --source front_leg_tactile --target DNa02 --report data/front-leg-DNa02.json`. All commands load and checksum-verify the real dataset first. Initial load can take several minutes depending on disk and memory; allow startup to finish.

`docs/MALECNS_PATHWAYS.md` documents actual annotations, exact population predicates and IDs, measured 1/2/3-hop structural routes, explicit side fields, evidence levels and limitations. The JSON analysis includes all candidate IDs and results for 48 population pairs. `backend/connectome/annotations.py` provides reusable exact annotation queries; `pathway_analysis.py` uses sparse reachability and vectorized contact aggregation; `pathways.py` is the CLI. The API adds `/connectome/populations` and `/connectome/pathway-subgraph`. Graph exports retain measured contact counts and contain at most 80 nodes/160 edges (viewer defaults: 32/64). No graph weights, sensors or movement behavior are changed.

DOCUMENTED refers to explicit annotations or published type-level function; INFERRED refers to functional interpretations of structural routes; ENGINEERING MAPPING refers to any future simulation input/output interface. The panel has no activity animation, neural dynamics or motor decoder.

## Milestone 3C: experimental neural dynamics lab

The pathway explorer now includes **Neural dynamics lab**: five manual stimulus presets, sliders, pulse duration, unsigned/transmitter-based sign modes, engineering weight transforms and an activity trace with independent DNa02-L/R readouts. The moving BioBug remains on its rule-based controller; no sensor or motor connection to this experiment exists.

`backend/connectome/dynamics.py` extracts the complete bounded route union and keeps structural contacts separate from normalized log-contact simulation weights. The default graph has 295 neurons, 280 edges and 2,308 contacts, including all 266 annotated ProLN inputs. The experiment starts at zero on every request. `POST /connectome/simulate` returns compact step traces and real metadata with engineering labels. Default API/UI runs use 10 steps; the recorded comparison uses 20 steps and a three-step pulse.

From `backend/`:

```powershell
.\.venv\Scripts\python -m connectome.dynamics_experiment --report ../docs/MALECNS_DYNAMICS_EXPERIMENTS.json
# Optional offline expansion, never on each browser frame:
.\.venv\Scripts\python -m connectome.dynamics_experiment --hops 3 --report ../docs/MALECNS_DYNAMICS_3HOP.json
```

Read `docs/MALECNS_DYNAMICS.md` for the exact equation, sign assumptions, measured preset results, performance and limitations. This is a controller research model using real MaleCNS structure with simulated neural dynamics, not a biologically accurate fly brain. Earlier milestones describe their historical scope.
