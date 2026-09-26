# Virtual Fly Lab — MVP

Experimental connectome-driven simulation. Implemented and validated on 27 September 2026 (local time). BioBug Rescue remains a separate experience. No automatic commit was made.

## 1. Research question

How much closed-loop insect-like behavior can a virtual body produce when simulated sensory input propagates through a selected circuit derived from the real MaleCNS structural connectome? This MVP makes that loop inspectable and reproducible. It does not establish biological accuracy.

## 2. Architecture and protection of Rescue

The original Rescue implementation is mounted unchanged behind `#rescue`. `#virtual-fly` lazy-loads a separate lab; the root URL offers both experiences. Leaving either unmounts its component and cancels its animation and pending requests. Re-entry creates a fresh paused run. Experiments are not persisted across navigation.

Before implementation, all **71 frontend checks** passed and the backend had **119 passed, 1 skipped**, with one existing dependency deprecation warning. SHA-256 digests of **85 existing Rescue/shared backend/source/test files** are recorded in [VIRTUAL_FLY_RESCUE_BASELINE.json](VIRTUAL_FLY_RESCUE_BASELINE.json). A new regression check requires those exact bytes, including the pre-existing 3D implementation. The new shell replaces only the entrypoint; no Rescue controller, swarm, sensors, mission, presentation, Commander, or historical benchmark logic was changed.

Safely reused, without refactoring: sensor ray casting, collision-aware movement, accessible-cell geometry, seeded conventional controller, sensory mapping, motor decoder, validated neural HTTP transport, read-only readiness polling, and an independently mounted DynamicsLab. Each mutable helper receives newly allocated lab state. Rescue's mission loop, fog/discoveries, swarm coordinator and Commander are not mounted inside the lab.

```text
Experiences → Rescue App (unchanged)
            → VirtualFlyLab
                experiments → independent arena and initial state
                simulation → one VirtualFly, controller/decoder, history
                neuralLoop → one cancellable request at a time
                trials → separate deterministic paired runs
                stimulation → paused, non-mutating circuit probes
                FlyCanvas → geometry, insect illustration, rays and paths
                      ↓
            existing shared FastAPI /connectome/control
                      ↓
            cached immutable two-hop structural graph
```

The backend loads MaleCNS once. Every request uses independent transient activity arrays; no lab session or second dataset is introduced. Walking decisions reset neural activity to rest, while the lab retains its own latest readouts/history and motor commitment state. This is continuous sensory/body feedback, not continuously persistent neural dynamics.

## 3. MaleCNS data used

Reuses the official MaleCNS **v1.0** release already installed in this project. [Official download](https://male-cns.janelia.org/download/), **CC BY 4.0**. Existing provenance: [MALECNS.md](MALECNS.md), exact file/checksum manifest `backend/connectome/sources.json`, and [pathway investigation](MALECNS_PATHWAYS.md). No new biological mapping or literature claim was introduced in this milestone.

Citation retained from the dataset investigation: Berg et al. (2026), *Sexual dimorphism in the complete Drosophila male central nervous system connectome*, Cell, [doi:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015).

The actual running status returned **166,606 selected neurons, 25,574,615 directed neuron-pair connections, 124,144,950 contacts**. These selected-graph counts are not universal whole-CNS counts. The browser receives compact responses, never the full connectivity matrix.

## 4. Selected neural populations

The existing controller graph is the union of all directed one- and two-hop routes from annotation-selected ProLN tactile inputs to DNa02, retaining all selected input/target cells even when route-isolated. It is not an induced graph or the small visualization sample.

- **295 neurons, 280 directed edges, 2,308 structural contacts**.
- **266 inputs**: `class=mechanosensory_tactile`, `entryNerve=ProLN`; rootSide L=151 and R=115. Only 146 sources have outgoing edges in the route graph.
- **27 intermediates**, selected by real route connectivity.
- **2 targets**: type DNa02; somaSide L ID **523769**, R ID **10360**.
- Structural hash: `fda9df339350f4420439a90556330275d5ac4cb127a411c3d2e3f74cc2527c6c`.

The graph fingerprint stayed unchanged through the real paired experiments. Transmitter annotations exist but this controller uses unsigned weights, not assumed receptor-specific effects.

## 5. Virtual sensory model

Three geometry-derived ray distances extend up to 85 world units from the body boundary: left −60°, front 0°, right +60° relative to heading. These are engineering proximity channels described as simulated tactile input, not reconstructed mechanoreceptors or literal physical contact.

For distance d, x=clamp(1−d/85,0,1), stimulus=x²(3−2x). The existing sensory mapping encodes ProLN rootSide L as min(1,left+0.5·front), R as min(1,right+0.5·front), unknown as zero. There is no bilateral population balancing. Body velocity is recorded; no proprioceptive neural pathway is added.

## 6. Neural dynamics reused

Model identifier: `unsigned-incoming-log-20-steps-3-pulse-from-rest-v1`.

```text
B[i,j] = log(1 + structural_contacts[i,j])
W[i,j] = B[i,j] / max(1, sum_k B[k,j])
a[0] = 0
a[t+1] = clip(0.75*a[t] + 0.20*W.T@a[t] + 0.50*I[t], 0, 1)
```

Run 20 abstract updates with input present for the first three. Record each DNa02 peak and the API's reported intermediate activity summaries. These dimensionless activations are computational results, not measured firing rates. Top intermediates aggregate the returned top-type summaries, not a complete physiological inventory.

At five decisions per simulated second the lab samples current geometry, waits for the validated response, then advances twelve 1/60-second physics steps. Rendering stays independent. HTTP waiting time is excluded from simulated time, so wall-clock duration is longer. Pause/reset/navigation invalidate pending responses; errors or a four-second timeout visibly pause the lab without switching controllers. Version/model/echoed stimulus/finite peaks/sides/intact-structure flags are validated by the existing transport.

## 7. Engineering motor decoder

Reuses the existing decoder unchanged. Difference = DNa02-L peak minus DNa02-R peak. Outside a 0.035 deadband, positive difference proposes a clockwise/right turn; negative proposes left. A new turn direction is committed for two further neural decisions. Inside the deadband with front input ≥0.5, select the clearer geometric side, using a seeded tie-break if clearances differ by less than three units. This frontal fallback is counted and explicitly attributed to engineering.

Turn speed is 1.9 radians/s. Forward speed is 42 units/s, reduced to 45% during turns, or zero during turns with strong frontal input. Collision checking remains authoritative. Pause, waits, failures and completion stop the body. DNa02 laterality does not itself establish a biological turning direction.

## 8. Virtual body, live view and manual stimulation

One independently allocated VirtualFly has position, heading, actual velocity, turning state, sensors, neural readout, controller/decoder memory and experiment state. A radius-seven circle supplies collision geometry. Wings, red eyes, body markings and distance-driven six-leg illustration are decorative Canvas graphics; there is no leg or muscle physics and no flight.

The live panel and inspector expose sample time, sensory channels, actual DNa02 IDs/peaks, reported intermediates, motor state, position, speed, seed and elapsed time. Path traces, decision telemetry and paired results can be exported as JSON. Baseline neural fields are null, never invented zero-valued measurements. Empty activity after a valid response is distinguished from no measurement.

Paused **Experimental Stimulation** sends chosen left/front/right inputs through the real endpoint and a fresh decoder, retaining current geometric clearance only for the decoder fallback. It does not alter the body or walking controller. The existing stepwise DynamicsLab is separately mounted below it; starting movement/comparison closes and cancels manual tools.

## 9. Reproducible experiments

All five start at (110,240), heading 0, with fixed geometry in a 720×480 arena, default seed 2026 and default duration 30 simulated seconds. UI also offers 60/120 seconds. Reset clears body, path, telemetry, metrics, decoder and comparison results. Changing environment/controller/seed/duration also resets. Reproduction assumes the same configuration and uninterrupted run; manual pause/resume deliberately obtains a fresh decision.

A: empty interior with perimeter walls; B/C: mirrored left/right obstacles; D: frontal obstacle; E: narrow corridor with end wall. Exact rectangles live in `src/virtual-fly/experiments.ts`. Open arena still has boundary walls. There are no survivor, hazard, swarm, vision or olfactory experiments.

Coverage is the fraction of reachable 30-unit cell centers visited by the body, including the starting cell. It differs from Rescue fog coverage and cannot be compared across differently sized reachable arenas as a general performance score. Turns count entries into turning bouts; collision attempts are rejected translations, not wall contacts measured by physical sensors. Decision telemetry is sampled every 0.2 simulated seconds; final totals are stored separately.

## 10. Evidence levels

| Category | Meaning in this MVP |
| --- | --- |
| REAL DATA | MaleCNS IDs, annotated laterality, directed edges and structural contacts |
| DOCUMENTED ANNOTATION | Exact ProLN/tactile and DNa02 annotation matches; not proof of the model's complete function |
| INFERRED | Interpreting the selected structural route as relevant to virtual obstacle responses |
| ENGINEERING MODEL | Ray sensors, transduction, activity equation, unsigned normalization, motor signs, commitment/fallback, kinematics and illustrations |

The interface displays these labels plus a visible limitations panel and the full environment→sensor→structure→dynamics→decoder→body→environment loop.

## 11. Actual results and validation

[Raw experiment evidence](VIRTUAL_FLY_EXPERIMENTS.json) includes actual status, graph metadata, per-decision telemetry, paths and summaries. Five paired experiments were each repeated: **20 trial executions**, including **1,500 actual neural requests** across ten MaleCNS runs. All non-latency results, paths and telemetry matched exactly on repeat. Execution took **9.519 wall seconds** in the accelerated CLI; this excludes initial dataset load and the warmed graph construction.

Each row below is a 30-s run, seed 2026. Distances are arbitrary world units. All runs had **zero blocked movements and zero collision attempts**.

| Arena | Controller | Distance | Turn bouts | Moving time (s) | Visited area | HTTP mean / p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| open | Rule-Based | 1162.00 | 3 | 27.67 | 17.21% | Not measured |
| open | MaleCNS-derived | 1206.24 | 2 | 29.60 | 15.26% | 3.16 / 4.10 |
| left | Rule-Based | 1126.30 | 4 | 26.82 | 16.00% | Not measured |
| left | MaleCNS-derived | 1182.30 | 4 | 29.80 | 17.67% | 3.59 / 7.14 |
| right | Rule-Based | 1162.00 | 3 | 27.67 | 17.67% | Not measured |
| right | MaleCNS-derived | 1182.30 | 4 | 29.80 | 18.00% | 2.98 / 5.72 |
| front | Rule-Based | 1063.30 | 6 | 25.32 | 16.01% | Not measured |
| front | MaleCNS-derived | 1147.86 | 5 | 29.20 | 16.34% | 3.43 / 5.80 |
| corridor | Rule-Based | 954.10 | 9 | 22.72 | 67.50% | Not measured |
| corridor | MaleCNS-derived | 1011.36 | 13 | 27.60 | 85.00% | 2.85 / 4.85 |

| MaleCNS arena | Peak L | Peak R | Mean absolute L−R | Frontal fallback decisions |
| --- | ---: | ---: | ---: | ---: |
| open | 0.1003 | 0.1592 | 0.0049 | 1 |
| left | 0.1129 | 0.1806 | 0.0079 | 0 |
| right | 0.1943 | 0.1193 | 0.0082 | 0 |
| front | 0.1026 | 0.1631 | 0.0089 | 3 |
| corridor | 0.2551 | 0.2537 | 0.0232 | 2 |

### Performance and memory

CLI HTTP means ranged **2.85–3.59 ms**, p95 **4.10–7.14 ms**. These small, warm, local samples are not deployment latency guarantees. Interactive browser results are recorded separately in [VIRTUAL_FLY_BROWSER_VALIDATION.json](VIRTUAL_FLY_BROWSER_VALIDATION.json); browser HTTP timing includes browser scheduling/CORS overhead and should not be conflated with accelerated CLI timing.

The same backend process (PID 12308) had RSS **576,229,376 bytes before / 573,210,624 after** the CLI suite (~549.54 / 546.66 MiB). This does not imply a precise negative allocation: RSS varies with caches and memory management. The cached graph reports **111,860 structural-array bytes**; no second full dataset or backend process is created. Initial warm graph construction took 0.914 s.

The Node runner had RSS **113,336,320 → 220,860,416 bytes**, with sampled peak 219,721,728 bytes (the ending snapshot exceeded the 100-ms samples). These figures include the TypeScript compiler, retained JSON histories, HTTP/runtime caches and repeated trials; they are not isolated frontend allocation measurements. The browser displays actual serialized path/telemetry bytes, explicitly not browser heap. Whole-browser heap/GPU memory was not isolated. Normal experiments bound duration to 120 seconds and telemetry to 601 rows.

Interactive browser samples showed **35.9–42.9 Canvas paints/s**, **0.23–0.32 ms mean paint time**, and an active physics sample of **59.9 fixed steps per wall second**. Extra neural/status updates can repaint between the ~30-Hz UI refreshes. The final corridor run used 150 real responses (mean **13.54 ms**, p95 **28.70 ms**) and **98.5 KiB serialized path/telemetry**. These are observed samples, not sustained FPS or isolated heap benchmarks. Paused physics correctly reads zero. Browser frontal paired results exactly matched CLI behavior, with its own HTTP timing of 4.70/6.30 ms.

### Tests

- Before: 71 existing frontend checks; backend 119 passed, 1 skipped, one existing dependency warning.
- After: **88 frontend checks passed** (all 71 existing + 17 new Virtual Fly checks).
- Backend rerun: **119 passed, 1 skipped**, same existing Starlette/AnyIO deprecation warning.
- Production TypeScript/Vite build passes. The pre-existing lazy Three.js scene still produces a >500-kB chunk advisory. The new lab chunk is ~33 kB minified (~11 kB gzip).
- New checks cover frozen Rescue bytes, independent allocations, five arenas, geometry-dependent sensing, reset, frame-rate determinism, closed-loop changes, exact neural cadence, pending-request cancellation, visible failure, paired-run isolation, stimulation isolation and export semantics.
- Actual backend paired runs separately validate the real data and model; unit transport fixtures are not presented as real experimental evidence.

### Unexpected behavior and interpretation

The neural controller traveled farther but visited fewer cells in the open arena (15.26% vs 17.21%). It made more turning bouts in the corridor (13 vs 9). Distance, coverage and turn count are different measurements, not a winner ranking. Mirrored obstacles do not imply mirrored neural readouts: annotated population sizes and structural routes differ by side. Seeded baseline wandering can also break path symmetry. Frontal fallbacks contributed to measured neural-controller behavior and must not be credited to structural connectivity alone. Zero collision attempts reflect this geometry and collision guard, not validated biological locomotion.

## 12. Scientific limitations

The model uses a small selected route union, not full MaleCNS dynamics. Structural contacts are neither synaptic efficacy nor receptor-specific sign. Activity starts at rest for every decision; there is no continuous neural memory, validated timescale or physiological calibration. Virtual rays activate annotation-selected populations through an engineering mapping. DNa02 outputs are proxies coupled to an engineered decoder; these experiments do not show DNa02 alone determines biological turning. Body size, speed, sensing range and geometry use arbitrary units. Six drawn legs supply no proprioception or biomechanics.

Only one seed and five short canonical arenas were measured here, and baseline and neural controllers have different decision cadences. Paths therefore cannot establish general superiority or biological fidelity. This is not a complete brain, a reconstruction of consciousness, measured neural physiology, a physical insect-control system, or hardware validation.

## 13. Future work and reproducibility

Recommended next investigation: **proprioceptive pathways**, first auditing MaleCNS annotations and published functional evidence to identify what joint/body state could responsibly be represented. Treat it as a separate evidence investigation before selecting new pathways or changing dynamics. No proprioception, vision, olfaction, flight, training, biomechanics or biological interface was added in this milestone.

From the project directory:

```powershell
npm run dev
# Open http://127.0.0.1:5173/ and choose ENTER LAB.
# Rule-Based works without the backend.
```

In a separate terminal, with the existing downloaded dataset and Python environment:

```powershell
cd backend
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
# Wait for startup/data load; the lab shows MALECNS READY.
```

Validation/reproduction from project root:

```powershell
npm test
npm run build
npm run compare:fly -- 30
# Optional RSS snapshot of an existing backend PID:
# npm run compare:fly -- 30 <backendPID>
```

`compare:fly` overwrites only the lab experiment report. It does not change historical Rescue benchmarks. The backend PID is optional and Windows process RSS collection uses the existing backend Python environment. Tests in `backend/` use `.\.venv\Scripts\python -m pytest -q`.

## File inventory for this milestone

Modified existing files: `src/main.tsx` (experience shell), `package.json` (new test/comparison scripts), `README.md` (entry instructions and lab link). Existing prior 3D work remains uncommitted and was not reimplemented here.

Added: `src/Experiences.tsx`, `src/experiences.css`; `src/virtual-fly/{VirtualFlyLab.tsx,FlyCanvas.tsx,StimulationLab.tsx,useFlySimulation.ts,experiments.ts,simulation.ts,neuralLoop.ts,trials.ts,stimulation.ts,fly-lab.css}`; `scripts/{compile_virtual_fly.cjs,compare_virtual_fly.cjs}`; `tests/virtual_fly.cjs`; this document and `docs/VIRTUAL_FLY_{RESCUE_BASELINE,EXPERIMENTS,BROWSER_VALIDATION}.json`. Browser screenshots are local validation artifacts under `work/`.
