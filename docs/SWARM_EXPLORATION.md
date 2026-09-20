# Milestone 4 — Swarm exploration

BioBug Rescue now supports one to eight BioBugs on the same map, with four deployed by default. UI presets are 1, 2, 4 and 8. Agents have independent sensors, pose, seeded controller memory, neural decoder memory, readouts and local metrics. They share one monotonically revealed terrain map. Survivor/hazard **detection** remains Milestone 5; visible scenario markers are still only a consequence of explored terrain. AI Rescue Commander and presentation polish remain Milestones 6 and 7.

## Architecture

- `src/simulation/swarm.ts`: deployment, shared mission clock, per-agent simulations, navigation/peer arbitration, agent selection and swarm snapshots.
- `src/simulation/frontiers.ts`: revealed-terrain navigation graph, deterministic frontier reservation and shortest grid routes.
- `src/simulation/swarmNeuralLoop.ts`: bounded, non-overlapping HTTP batches and whole-swarm failure handling.
- Existing `engine.ts`/`movement.ts`: retain local controllers and physical wall/debris collision; optional command and movement-permission hooks allow the swarm layer to arbitrate.
- `SwarmPanel.tsx`, `EnvironmentCanvas.tsx`, `drawBioBug.ts`: colored agents, selected-agent ring, click/roster selection, selected sensor rays and optional dashed frontier route, shared and individual metrics.
- `POST /connectome/control-batch`: one to eight uniquely named sensory inputs evaluated with the existing cached MaleCNS graph and weights. No per-agent full-dataset loading.

The one-agent swarm reproduces the previous rule-based trajectory exactly. The old comparison CLI and neural lab remain usable. All agents use the chosen controller mode; switching controller mode preserves their poses and the shared map, while invalidating old neural commands. Selection changes only the inspector/telemetry, not the simulation. Swarm distance and personal coverage span both controller modes; the selected agent's local controller table still separates modes.

## Deployment and physical safety

Agents start in a compact, deterministic grid around the original `(90,480)` entry, spaced at least 22 units apart and individually checked against walls/debris. Every agent retains radius 7 and starts heading 270°. No agent is teleported into a distant unexplored room. Deployment fails rather than placing an invalid agent. Changing deployment size resets the mission and is disabled while running. Reset preserves size, coordination setting and controller mode while clearing all positions, fog, assignments, requests and metrics.

The fixed physics step remains 1/60 second. Physical update priority rotates by one agent each step, deterministically. Before accepting a movement, the original wall/debris detector must pass and the proposed swept segment must stay at least `radius_i + radius_j + 0.25` units from every other agent's current center. This prevents tunneling and overlaps, including crossing paths. Sequential checks are conservative; there is no simultaneous optimization of all trajectories.

An engineering separation rule also turns in place away from the closest agent within 32 units and within ±108° ahead. It commits to that turn for 0.6 simulated seconds before reconsidering, so separation and local steering cannot alternate every frame at the angular boundary. It applies in independent and coordinated modes. The swept collision guard remains authoritative even if separation fails. Inter-agent signals are deliberately **not** presented as a new biological MaleCNS sensory mapping.

## Shared exploration and honest knowledge boundaries

Agents reveal terrain through the existing radius-75, line-of-sight fog logic. Their discoveries immediately update a single shared boolean exploration grid. Communication is modeled as instantaneous, perfect broadcast; there is no radio range, delay, packet loss, connectivity graph or hardware implementation.

The planner does not receive the omniscient `accessibleCells` scoring denominator. It builds a navigation graph only from already revealed cells whose centers have body clearance. Cardinal adjacent known cells are connected only when the segment is safe for the body. Geometry queries classify revealed terrain and local clearance; unknown cells are never included as traversable route nodes. Tests change obstacles in an unseen distant region and verify identical assignments.

A frontier is a known traversable cell bordering an unknown cell. Each agent is assigned a distinct reachable frontier. Assignments prefer targets at least 60 units from already reserved targets; when the known frontier is too small, unique but closer targets are allowed. Breadth-first routes minimize grid steps. Candidate cell IDs and seeded deployment make ties deterministic. Planning repeats every two simulated seconds and rotates assignment priority. It does not assign targets based on hidden survivors, hazards or unexplored geometry.

Near a route waypoint (within 12 units), the agent advances to the next waypoint. Navigation uses a capped ±1.5 rad/s heading correction and turns in place for heading error greater than 0.8 radians. It only adjusts otherwise unobstructed forward exploration. Strong local avoidance turns (angular magnitude over 0.8 rad/s) or a raw front distance below 22 units take priority. Missing/unreachable frontiers fall back to local exploration rather than using an oracle route.

## Where MaleCNS ends and coordination begins

```text
Each agent's real-time simulated obstacle distances
  → existing ENGINEERING SENSOR MAPPING
  → real MaleCNS ProLN–DNa02 topology
  → existing unsigned SIMULATED NEURAL ACTIVITY
  → independent DNa02 peaks
  → existing ENGINEERING MOTOR DECODER (local proposal)
  → ENGINEERING SWARM COORDINATION (frontier heading / peer separation)
  → wall, debris and peer collision checks
  → accepted physical movement and shared fog update
```

The existing 295-neuron, 280-edge, 2,308-contact graph, ProLN input mapping, weight normalization and unsigned 20-step/three-step-pulse experiments remain unchanged. The backend shares immutable structure/weights, while each input is evaluated from its own zero state; activity is never pooled across BioBugs. This is not a biological model of insect cooperation.

The local telemetry displays the selected agent's neural/decoder proposal. The roster separately explains whether local avoidance, frontier navigation, peer separation or a physical safety hold is currently applied. A frontier direction is not attributed to MaleCNS. Because local avoidance takes priority, a reserved target is an intention, not a guarantee that the agent will reach it.

## Batching, synchronization and failures

Every 0.2 simulated seconds, one POST carries all deployed agents' ID-tagged stimuli. The backend validates 1–8 inputs, unique IDs and bounded finite stimulus values, reuses one extracted graph/weight matrix, and returns separately tagged responses. The client validates every response and matches by ID, not response order. Duplicate, missing, wrong-stimulus or invalid readouts are rejected before application.

The world waits at the decision boundary until the complete batch succeeds, then advances all agents together. There is one outstanding request, no per-frame HTTP and no queue of stale observations. A four-agent, 60-second run therefore makes 300 batches and 1,200 neural decisions. Eight agents still make 300 batches, with 2,400 neural decisions. The nominal rate is five batches per **simulated** second; wall time includes waiting and rendering.

Pause, reset, redeploy, switching modes and unmount invalidate old results. Selecting another agent does not invalidate an otherwise valid batch. A timeout (four seconds), missing backend or malformed response pauses **the entire swarm**, shows CONNECTOME OFFLINE, clears commands/readouts and increments the batch failure counter. It never silently runs a rule-based swarm while labeling it MaleCNS. Start retries explicitly after restoration; Rule-Based remains available without the backend.

## Metrics

- Shared coverage: union of revealed reachable cells, using the existing collision-aware denominator for scoring only.
- Personal coverage: cells observed by that agent across both modes; agents' personal coverage can overlap.
- New shared cells: credit for previously unknown cells revealed during movement, excluding initial deployment observations. It includes visible obstacle cells, so it is not itself the reachable-cell coverage numerator. Rotating update priority resolves simultaneous discovery credit deterministically.
- Total distance: sum of accepted distance across all agents and both modes.
- Peer safety holds: final swept-body rejections. Proactive separation turns are not counted as blocked movement.
- Local blocked attempts include wall/debris and peer collision rejections; local turn/stuck semantics remain documented in `MALECNS_CONTROLLER.md`.
- Neural batch attempts/failures and measured successful batch mean/nearest-rank p95 latency. The local telemetry latency is the enclosing batch's latency, not an isolated neuron computation time.
- Comparison redundancy: `100*(1 - shared_reachable_observed / sum_personal_reachable_observed)`, including deployment observations. This measures duplicate observation, not wasted travel or communication.

## Reproducible validation and comparison

```powershell
npm test
npm run build
npm run preview -- --port 5173
# In another terminal:
cd backend
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000 --no-access-log
```

Wait for dataset startup. From the project root:

```powershell
npm run compare:swarms -- 60
```

The comparison runs seeds 2026–2028 in both modes: one independent BioBug, four independent BioBugs, four coordinated BioBugs and eight coordinated BioBugs. Seed 2026 repeats every configuration to verify exact non-timing metrics and final poses. Every fixed step asserts valid wall clearance and inter-agent separation. Neural runs use real HTTP against the downloaded MaleCNS graph. Fresh connections avoid the Node keepalive idle race documented in Milestone 3D; these are headless throughput timings, not browser FPS measurements.

More agents see more terrain at deployment, so the report includes both initial coverage and movement-driven coverage gain. Same-size independent/coordinated comparisons use identical positions, headings, agent seeds and duration. The map does not vary by seed. Full results are recorded in `SWARM_COMPARISON.json`.

The first stress batch exposed a peer-steering arbitration defect: when the separation cone ended, the local controller could turn back into it on the next frame. Thousands of turn transitions and stalled translation resulted in some configurations. A 0.6-second peer-turn commitment was added, with a regression test for this boundary case, and the complete same-seed comparison was rerun. The original measurements remain in `SWARM_COMPARISON_INITIAL.json`. This was an explicit stability correction, not a change to MaleCNS structure, dynamics or local motor-decoder parameters. The final comparison must be read alongside the remaining congestion and exploration limitations; it does not establish optimal coordination.

## Limitations

This is a centralized shared-map engineering coordinator with independent local controllers, not decentralized biological emergence. Instant communication, exact localization and ideal terrain sensing simplify the problem. Narrow passages can cause congestion, repeated separation turns or local deadlocks; there is no optimal multi-agent path solver, dynamic priority negotiation or rescue unsticking routine. Greedy reservations are not globally optimal; target reassignment can cause route changes. Local obstacle avoidance can prevent frontier progress, especially with MaleCNS. More agents or coordination do not guarantee higher coverage. The collision guard prevents overlap but cannot guarantee mission completion. There is no survivor/hazard detection, AI commander, training or altered structural connectome in this milestone.

## Measured results

Final runs used three seeds (2026–2028), each for 60 simulated seconds on the same map. The eight configurations for seed 2026 also repeated exactly for non-timing metrics and final poses: 24 primary runs plus eight repeat runs. Every fixed step checked wall clearance and inter-agent separation. Coverage below is the mean percentage of reachable cells revealed.

| Deployment | Initial coverage | Rule-based final coverage | MaleCNS final coverage |
| --- | ---: | ---: | ---: |
| 1 independent | 3.93% | 28.21% | 22.88% |
| 4 independent | 5.13% | 55.74% | 60.99% |
| 4 coordinated | 5.13% | 71.55% | 53.08% |
| 8 coordinated | 5.60% | 60.75% | 26.18% |

Coordination improved the four-agent rule-based mean by 15.81 percentage points, but reduced the four-agent MaleCNS mean by 7.91 points. Eight-agent congestion was substantial. The default remains four agents; eight is a stress configuration, not a demonstrated improvement. No result establishes optimal exploration or biologically accurate swarm behavior.

MaleCNS runs completed 300 batches per run, containing 300, 1,200 or 2,400 independent agent decisions for one, four or eight agents respectively. Mean batch latency was 11.40 ms for one agent, 17.24 ms for four independent agents, 19.80 ms for four coordinated agents and 27.68 ms for eight coordinated agents. The corresponding averages of per-run p95 latency were 17.08, 33.20, 34.56 and 47.52 ms. These are local benchmark measurements, not guaranteed deployment performance.

The peer-turn commitment reduced rapid turn transitions but did not uniformly improve exploration. Compared with the retained initial results, four-agent coordinated MaleCNS coverage increased from 40.76% to 53.08%; eight-agent coordinated MaleCNS coverage decreased from 47.68% to 26.18%, and eight-agent rule-based coverage decreased from 78.67% to 60.75%. Average eight-agent stuck events increased to 42 for MaleCNS and 28 for rule-based control. Both original and final reports are retained so this tradeoff is visible.

## Verification completed

- Frontend: all 34 checks passed (9 simulation, 14 controller, 11 swarm).
- Backend: 94 tests passed, one optional full-source test skipped, two existing dependency warnings.
- TypeScript and Vite production build passed; Git whitespace validation passed.
- Real-data comparisons used the unchanged 295-neuron, 280-edge, 2,308-contact MaleCNS pathway graph through the running backend, not mock neural responses.
- Browser checks covered running and pausing, resetting, switching controllers, changing agent count, roster selection, selected-agent sensor/readout display, coordination controls and preservation of aggregate distance across controller switches.
- A live four-agent MaleCNS browser run reached 38.3 simulated seconds in 43.869 wall-clock seconds, with 38.1% shared coverage, 192 batches, zero batch failures, 33.0 ms mean batch latency and 52.1 ms p95 latency. This individual browser observation is separate from the seeded comparison averages above.
- Unit tests cover stale batch rejection and whole-swarm pause on backend failure. A manual browser disconnection test was not performed in this milestone.

Survivor and hazard markers remain visibility-only. Detection and rescue behavior belong to Milestone 5.
