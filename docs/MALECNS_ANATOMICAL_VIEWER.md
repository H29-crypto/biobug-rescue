# MaleCNS live anatomical activity viewer

Implemented 28 September 2026. This supersedes the **availability findings** of the earlier morphology audit, which remains an historical record. The viewer renders real MaleCNS skeletons with simulated activity from the existing Virtual Fly controller. It is not measured physiology or a biologically accurate fly brain simulation.

## Official assets and reproducibility

Release: **MaleCNS v1.0**, Janelia/FlyEM. License: **CC BY 4.0**, attribution to the MaleCNS dataset creators. See the [official download documentation](https://male-cns.janelia.org/download/) and the project's `MALECNS.md` for the dataset citation. Geometry is a transformed derivative; the source files remain unchanged.

Each selected neuron was downloaded from:

```text
https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{bodyId}.swc
```

For example: [DNa02-R, body 10360](https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/10360.swc) and [DNa02-L, body 523769](https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/523769.swc). Only the 295 requested per-neuron files were acquired; no bulk skeleton archive, synapse-coordinate table or CNS mesh was downloaded.

| Population | Requested | Available and mapped |
|---|---:|---:|
| ProLN tactile inputs | 266 | 266 |
| Intermediates in the selected structural pathways | 27 | 27 |
| DNa02 | 2 | 2 |
| Total | 295 | 295 |

There are **306,597 SWC nodes, 306,284 parent-child segments and 313 roots**. Multiple rooted components are retained, not artificially joined. Missing files: **0**. Malformed files: **0**. The official headers declare coarse skeletons; this app performs no additional decimation.

Raw SWCs occupy **10,466,844 bytes** and live under `backend/data/morphology/v1.0/` (ignored by Git). `public/malecns/skeletons.bin` contains **7,350,816 bytes** of little-endian float32 endpoint coordinates. The public manifest occupies **422,955 bytes**; a duplicate is retained at `docs/MALECNS_MORPHOLOGY_MANIFEST.json`. Public assets are suitable for inclusion with this local application; ignored raw files can be reacquired. No data is uploaded.

Run from the repository root, after the existing official connectome tables have been downloaded:

```powershell
backend/.venv/Scripts/python scripts/acquire_morphology.py
```

This uses six concurrent per-neuron downloads with bounded reads, TLS verification and retries. Existing SWCs are parsed again without overwriting them. The initial acquisition, parsing and fresh full-connectome verification took **98.864 seconds**; this includes metadata loading and is not a pure network-download benchmark. Manifest rows record body ID, controller population, annotations, source URL, local SWC path, SHA-256, source header, byte count, availability, node/segment/root counts, bounding box, segment offset and structural degrees/contact counts. The exact graph identity is:

```text
fda9df339350f4420439a90556330275d5ac4cb127a411c3d2e3f74cc2527c6c
```

The selected graph still has 295 neurons, 280 neuron-to-neuron edges and 2,308 contacts. Structural edges are not SWC segments. Inspection degrees and contact counts refer to this selected controller, not the whole CNS.

## Parsing and coordinates

`backend/connectome/morphology.py` validates nonempty seven-column SWC data, finite coordinates and radii, integral unique positive node IDs, integral type/parent IDs, nonnegative radii, valid parent references, at least one root and acyclic parent chains. Parent order does not matter. Every valid parent-child pair becomes one line segment; no missing branch is fabricated. Tests independently reparse every acquired SWC, verify source and binary hashes, and compare each transformed endpoint exactly at float32 precision.

Native coordinates use **8 nm units in the MaleCNS EM frame**. They are not mirrored or independently laid out. The original SWCs preserve their coordinates and radii. Rendering uses one common transform:

```text
render_xyz_micrometers = (native_xyz - common_bbox_center_native) * 0.008
axis transform = identity 3 x 3 matrix
```

The common center is `[48320, 39104, 71136]` in native units, also stored in the manifest. It is the midpoint of the union bounding box across all available skeletons. Float32 rounding applies only to the derived render buffer. Camera presets are labeled **XY/XZ/YZ**, not unverified anatomical front/side/top. The viewer renders centerlines; SWC radii are validated but are not rendered as neurite diameters.

## Rendering and interaction

`AnatomicalViewer.tsx` loads the manifest and geometry, validates counts/ranges and verifies the binary SHA-256 before constructing the scene. `anatomyScene.ts` batches all 306,284 segments into one Three.js `LineSegments` object and one draw call. No React component or cylinder is created per segment. A per-vertex neuron index references a 295-entry RGBA float texture containing activity, visibility, selection and population.

Rotate, pan, zoom, reset and coordinate-plane cameras use OrbitControls. Raycasting maps a clicked segment back to its manifest body ID. The dropdown provides an accessible selection alternative. All/ProLN/intermediate/DNa02 filters and Active Only update the texture. DNa02 readout buttons isolate the two output neurons. Hidden populations remain allocated and their vertices are still submitted; filtering is not geometry decimation. All 295 skeletons fit in the current buffers, so no fabricated or reduced morphology is required.

Activity brightness uses the fixed monotonic scale `log(1 + 10000 * activity) / log(10001)`. Values below `1e-9` are excluded by Active Only. The numerical readouts and trace use the original activity, without logarithmic rescaling. A white highlight indicates **selection**, independently of activity. There are no random pulses, particles or invented synapse locations. The selected-neuron trace uses a fixed 0–1 axis and at most 180 accepted decisions (36 simulated seconds at 5 Hz); numeric history values occupy at most 424,800 bytes before JavaScript object overhead.

The visible labels distinguish **REAL** morphology/identity/structural connectivity, **SIMULATED** neural activity and **ENGINEERED** sensory transduction/motor decoding. An asset or WebGL failure reports an explicit error instead of substituting anatomy. Controller graph/ID mismatch disables the activity overlay.

## One evaluation, two consumers

`POST /connectome/control?include_activity=true` adds:

```text
activity.statistic = "peak-over-20-steps-from-rest"
activity.body_ids = [actual body IDs in controller order]
activity.values = [per-neuron peaks from this evaluation]
```

The activity values come directly from the same existing `peak` array used for the DNa02 motor readouts. There is no second evaluation or backend neural session. Default responses and the Rescue batch endpoint keep their previous contract. Tests verify one evaluation per request and exact equality of all old response fields except wall-clock execution time.

The controller's equations, weights, sensory mapping, motor decoder, 60 Hz physics and five decisions per simulated second are unchanged. Each decision remains an independent 20-step evaluation from rest with the existing three-step input pulse. **These displayed peaks are not instantaneous or continuous membrane activity.** The panel holds each accepted sample until the next decision; it does not animate an unsupported within-evaluation propagation sequence.

Virtual Fly uses the richer response whether the panel is enabled or disabled. The read-only `AnatomicalHistory` observer records accepted responses and their simulation timestamps, so toggling the viewer cannot change requests or controller state. Stale responses are rejected by the existing generation checks. Pause freezes the last activity sample while camera/inspection remain usable. `STEP NEURAL UPDATE` requests exactly one normal evaluation, advances its existing 12 physics ticks (0.20 simulated seconds), then pauses. Errors/timeouts hold physics and report a failure; no rule-based fallback is introduced.

## Validation

`npm test`: **96 checks passed**, including all existing Rescue, controller, swarm, survivor/hazard, Commander, presentation, 3D and Virtual Fly checks plus eight new anatomical checks. Backend suite: **130 passed**, with the optional full-data integration test skipped in that standard invocation. The integration test was then enabled explicitly and **passed against the actual downloaded release**. Production TypeScript/Vite build passed; Vite retains a nonfatal warning for the shared Three.js/OrbitControls bundle above 500 kB.

`npm run compare:anatomical` calls the real running backend in all five arenas, seed 2026, five simulated seconds per run. Each arena runs viewer OFF, viewer ON and the original response format: **375 actual controller evaluations** in total. Paths, poses, decisions, sensory telemetry, DNa02 readouts and simulation summaries match **exactly**. Wall-clock latency fields are set to zero only for equality comparison; actual timings are measured separately. The ON path exercises the production observer, history and filter logic; browser GPU drawing is checked separately through the UI, not asserted by this headless script. Results and hashes are saved in `MALECNS_ANATOMICAL_VALIDATION.json`.

The byte-identity Rescue regression guard remains in place. Only its two shared backend hashes were amended for the authorized additive telemetry API, recording old/new hashes and the reason. All other protected Rescue files retain their baseline hashes. No commit was created.

Re-run validation:

```powershell
npm test
npm run build
Push-Location backend
.venv/Scripts/python -m pytest -q -p no:cacheprovider
$env:MALECNS_INTEGRATION='1'
.venv/Scripts/python -m pytest tests/test_real_data.py -q -p no:cacheprovider
Pop-Location
npm run compare:anatomical
backend/.venv/Scripts/python scripts/measure_anatomical_backend.py
```

## Measured performance

Production preview, Windows, embedded Chromium, all 295 neurons and all segments enabled. These are local observations, not hardware-independent guarantees. Browser observations are saved in `MALECNS_ANATOMICAL_BROWSER_PERFORMANCE.txt`.

| Measurement | Result |
|---|---:|
| Position buffer | 7,350,816 bytes |
| Per-vertex neuron-index buffer | 2,450,272 bytes |
| 295-neuron RGBA float texture | 4,720 bytes |
| Total geometry/activity GPU allocation estimate | **9,805,808 bytes (9.81 MB)** |
| Fetch + SHA verification + scene setup | **345 ms**, warm local load |
| Average FPS over 1,853 frame intervals | **59.0 FPS** |
| Mean frame interval over that session | **16.94 ms** |
| Last measurement window | 58.0 FPS / 17.24 ms; p95 17.10 ms |
| CPU render submission, last window | 0.34 ms |
| Draw calls | **1** |
| Browser neural HTTP mean / p95, 93 accepted samples | **38.26 / 68.10 ms** |
| Headless live API mean / p95, 250 rich responses | **24.81 / 16.69 ms** |
| Neural calculation mean / p95 in those 250 responses | 4.43 / 5.90 ms |

The HTTP mean can exceed p95 because the measurement includes a small number of slower initialization/outlier requests. Initial automation observations included ~1 FPS intervals; the later visible session above is reported separately. Foreground state, scheduling, other processes and warm caches affect timings. Session FPS is measured over actual frame intervals, not inferred from a configured target. GPU byte counts exclude driver overhead, framebuffer storage, shaders and total VRAM. CPU arrays hold a similar geometry footprint. CPU submission time is not GPU execution time. Filtered neurons retain their GPU allocation. All 295 render at the measured rate without extra decimation or reduced-level fallback.

`measure_anatomical_backend.py` independently loaded the full real dataset and controller in **163.27 s** during this busy session. Its process used **555,405,312 bytes RSS** after loading. For the same mixed stimulus, the default response retained 8,660 Python-tracked bytes; the activity response retained 33,935 bytes: **25,275 bytes additional per response**, without a second matrix or dynamics engine. Compact JSON grew from 1,530 to 7,504 bytes. RSS samples after warm evaluations were 555,679,744 and 555,704,320 bytes respectively; that 24,576-byte difference is an observation, not a causal or stable memory guarantee. Traced peak allocations were 130,224 and 129,867 bytes; these are dominated by the existing calculation. No per-request history persists in the backend. Full measurement data and scope are in `MALECNS_ANATOMICAL_BACKEND_MEMORY.json`. The separately running API was also observed at approximately 574 MB working set.

## Local launch

In one terminal at the repository root:

```powershell
backend/.venv/Scripts/python -m uvicorn connectome.api:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173/#virtual-fly`, select **MALECNS-DERIVED**, choose an arena, then start or step. The panel also shows structure offline in Rule-Based mode. For a production preview use `npm run build` then `npm run preview -- --port 5173`. This session used the production preview because the sandbox denied an ancestor-directory read needed by Vite's development dependency optimizer; the production application loaded successfully.

## Scientific limitations

Only the existing 295-neuron controller is shown, not the complete MaleCNS connectome. Official skeletons are coarse centerlines and may contain multiple components. Matching a same-release body ID to a source filename establishes data identity, not independent biological verification of every traced branch. Annotation-derived sensory groupings and structural paths do not establish the biological function of this computational loop. The existing unsigned dynamics, engineering proximity rays and DNa02-to-movement decoder are retained. No new neurotransmitter dynamics, biomechanics, learning, neural pathways, survivor detection or Rescue behavior were introduced. No whole-CNS mesh or synapse coordinates are present; no artificial brain envelope is drawn.
