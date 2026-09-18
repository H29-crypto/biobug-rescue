# Milestone 3D — MaleCNS-connectome-based computational controller

BioBug has two selectable modes: the original Rule-Based baseline (default), and MaleCNS. This is a controller using the real MaleCNS structural connectome with simulated neural dynamics. It is **not a biologically accurate fly brain**. Swarm behavior, detection, training and OpenAI integration remain outside this milestone.

## Control path and scientific boundary

```text
Ray distances from the simulated BioBug
  → ENGINEERING SENSOR MAPPING: bounded smooth obstacle proximity
  → ProLN inputs selected using actual MaleCNS annotations and rootSide
  → REAL MALECNS STRUCTURE: complete two-hop ProLN–DNa02 route union
  → SIMULATED NEURAL ACTIVITY: unsigned, normalized log-contact propagation
  → two independent anatomical DNa02 readouts (peaks)
  → ENGINEERING MOTOR DECODER: differential avoidance, deadband, turn commitment
  → existing collision detector
  → physically permitted simulated movement
```

The loaded MaleCNS v1.0 graph provides IDs, annotations, anatomical sides, directed edges and integer contact counts. The controller subgraph has 295 neurons (266 ProLN inputs, 27 intermediates, 2 targets), 280 directed edges and 2,308 contacts. These counts are calculated and returned from the extracted data, not inserted into the live UI. Fingerprint: `fda9df339350f4420439a90556330275d5ac4cb127a411c3d2e3f74cc2527c6c`.

Source definitions, dataset provenance, license and annotation limitations are documented in [MALECNS.md](MALECNS.md), [MALECNS_PATHWAYS.md](MALECNS_PATHWAYS.md) and [MALECNS_DYNAMICS.md](MALECNS_DYNAMICS.md). No new biological mapping is inferred here. Structural counts are frozen and fingerprint-checked before and after each experiment. Simulation weights occupy a separate sparse matrix; a cached transpose speeds repeated updates.

All sensing transduction, stimulus amplitude, rate equation, temporal interpretation, weight transformation, motor action, turn commitment and safety rules are BioBug engineering. Anatomical L/R is **not** a biological turning command. No inference is made that a fly would move as this controller does.

## Sensor mapping and unchanged ProLN encoding

For each raw left/front/right sensor distance `d` (world units from the body edge, range 85):

```text
x = clamp(1 - d/85, 0, 1)
stimulus = x*x*(3 - 2*x)
```

This monotonic smoothstep maps a close obstacle to a strong stimulus, and has zero slope at the endpoints. Raw distances remain available in the inspector. Hazard and survivor signals are not used.

ProLN inputs use precisely the Milestone 3C encoding:

- `rootSide=L`: `min(1, left + 0.5*front)`
- `rootSide=R`: `min(1, right + 0.5*front)`
- unknown root side: zero

There are 151 left and 115 right annotated inputs. Only 146 inputs have outgoing edges in the selected two-hop route network; route-isolated sources still receive input. There is no bilateral size balancing or invented neuron mapping.

## Dynamics and decision timing

The controller is deliberately stateless between sensory decisions. Each decision runs the same unsigned 20-step / three-step pulse experiment used for the Milestone 3C measurements, beginning at zero. DNa02 **peak** values over that experiment are supplied to the motor decoder. These are neither instantaneous biological firing rates nor a continuously evolving fly state.

```text
B[i,j] = log(1 + structural_contacts[i,j])
W[i,j] = B[i,j] / max(1, sum_k B[k,j])
a[0] = 0
a[t+1] = clip(0.75*a[t] + 0.20*W.T@a[t] + 0.50*I[t], 0, 1)
```

Input is present for the first three updates, then zero for the remaining 17. Time steps are abstract. All signs are positive; experimental transmitter signs remain available only in the manual lab. Compact-endpoint tests compare its readouts with the existing lab implementation. The frontend validates version/model, finite bounded peaks, anatomical side fields, distinct IDs, echoed stimulus and intact-structure flag before moving.

Rendering uses requestAnimationFrame. Physics, collision checking and raw ray sensing retain their existing fixed 60 Hz simulation step so the Rule-Based baseline does not change. MaleCNS samples the rays once per 0.2 simulated seconds (five decisions/s). The full graph is loaded once at backend startup; the bounded graph and engineering weights are lazily extracted once and reused.

At a decision boundary the world waits for a valid response. It then advances 12 physics steps using the resulting command. Waiting time is excluded from simulated mission time. This lockstep policy makes the trajectory reproducible independently of HTTP latency; it is a conscious demo tradeoff, not a claim of hard real-time control. Wall-clock duration can exceed simulated duration. The renderer remains responsive while waiting.

There is one in-flight request and no queue. Pause/reset/switch invalidate the request epoch; obsolete responses cannot affect another mission or controller. Requests abort after four seconds. Dataset startup may take around a minute or longer: wait for backend startup before starting MaleCNS. A late response after timeout is rejected. There are no automatic retries that could conceal failures.

## Engineering motor decoder

`src/simulation/motorDecoder.ts` computes `delta = peak_L - peak_R`. Screen heading increases clockwise, so positive angular velocity turns right.

1. During a committed turn, hold its direction for two additional decisions (three decisions total, 0.6 simulated seconds). This prevents immediate left/right reversals.
2. Otherwise, if `abs(delta) > 0.035`, positive delta proposes TURN_RIGHT and negative delta proposes TURN_LEFT. The engineering interpretation is to steer away from the stronger obstacle-side activation.
3. Otherwise, if front stimulus is at least 0.5, invoke a documented engineering fallback: turn toward the larger raw left/right free-space distance. If the distances differ by less than 3 units, use a deterministic seeded tie-break. This choice is not attributed to MaleCNS.
4. Otherwise propose FORWARD. Small differential fluctuations inside the deadband do not change steering direction.

Turns use angular speed 1.9 radians/s. When front stimulus is at least 0.5, turn in place; otherwise turn with 45% forward speed. Forward commands use the existing speed of 42 units/s. Pause, waiting and backend failures stop movement. Turn commitment, fallback and speed selection are engineering additions. An already continuing turn does not start another commitment interval unless its direction changes.

The original collision layer rejects impossible movement regardless of the neural command. A collision does not silently hand control to the Rule-Based algorithm. Blocked attempts are counted and new sensory experiments continue. There is no special rescue/unsticking algorithm added to favor MaleCNS.

## Failure behavior and UI

On unavailable data, transport failure, timeout or invalid response: **CONNECTOME OFFLINE**, pause the mission, clear the command and displayed activity, increment backend failures, and keep MaleCNS selected. The user can retry Start or explicitly choose Rule-Based. There is no silent fallback presented as neural control.

Switching preserves position, heading, elapsed mission time and shared fog; it clears steering memory and neural command state. Each mode retains its own metric counters and visited-cell set. Reset creates a fresh paused mission, preserves the selected mode, clears both metric sets and cancels old results.

The live panel separates REAL MALECNS STRUCTURE, SIMULATED NEURAL ACTIVITY, ENGINEERING SENSOR MAPPING and ENGINEERING MOTOR DECODER. It displays the sampled stimuli, active ProLN input count, real DNa02 IDs/sides, peak bars, top intermediate types by cumulative model activity, deterministic explanation and metrics. It labels the last decision sample so it is not confused with continuously updated raw rays. The manual dynamics lab remains independent.

`GET /connectome/control-network` exposes the entire bounded controller graph for separate JSON inspection: every node, every directed edge, original contact count and separately labeled engineering weight. The existing pathway canvas remains a smaller structural sample.

## Metrics and comparison protocol

- Coverage: reachable cells seen by each controller's own visits, including the initial revealed area. Shared mission fog is separate. On uninterrupted single-mode runs these coincide.
- Distance: accepted displacement summed in world units.
- Turns: entry into a committed turn or a sign reversal, using angular magnitude above 0.8 rad/s. Slow baseline wandering is not a turn event.
- Blocked movement attempts: fixed-step proposals rejected by collision checking; turning in place is not counted as collision.
- Stuck events: disjoint complete 10-second active-controller windows with less than 7 units total traveled. This does not detect repetitive moving loops or poor exploration.
- Elapsed: simulated active time, excluding network waits, pause and inactive-controller time. Switching clears an incomplete stuck-detection window.
- Neural decisions: accepted, valid experiments. Latencies cover request, HTTP transfer, parsing and validation; mean and nearest-rank p95 are calculated from actual samples.
- Fallback percentage: **new** frontal-clearance/tie-break decisions divided by all neural decisions. Continuations under turn commitment are not new fallback selections.
- Asymmetry: mean absolute peak L−R over accepted decisions.

The comparison command pairs seeds 2026–2030 on the exact same earthquake map, entry `(90,480)`, heading 270°, radius 7 and speed 42, for 120 simulated seconds each. The map does not vary by seed; seeds affect the original baseline wander/tie choices and the MaleCNS symmetric-space tie-break only. Every run is repeated and all non-timing metrics plus final position/heading must match exactly. No seed or result is discarded because its coverage is poor. Parameters were fixed before these comparisons and were not optimized for the results.

The CLI uses the same TypeScript simulation, sensor mapping, response validator and motor decoder as React, with actual local HTTP requests to the real loaded dataset. The benchmark opens a new connection per request to avoid a Node pooled-socket idle timeout between baseline runs. Browser fetch uses normal browser transport. An earlier incomplete benchmark stopped with ECONNRESET; it produced no completed report and was rerun in full after that transport correction. Backend access logging is disabled during benchmarks to avoid thousands of console lines. Failures abort the comparison rather than substituting synthetic readouts.

Measured comparison results are saved in [MALECNS_CONTROLLER_COMPARISON.json](MALECNS_CONTROLLER_COMPARISON.json). All five pairs and their repetitions completed. The table below transcribes that report; it does not contain target or estimated scores.

## Measured results — September 18, 2026

Each row is 120 simulated seconds. All positions remained collision-valid in all 20 runs (five seeds × two modes × original/repeat).

| Seed | Controller | Coverage % | Distance u | Turns | Blocked attempts | Stuck | Neural decisions | Fallback % | API mean ms | API p95 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026 | Rule-Based | 54.11 | 3430.00 | 45 | 7 | 0 | 0 | — | — | — |
| 2026 | MaleCNS | 23.48 | 2768.22 | 121 | 0 | 0 | 600 | 9.00 | 6.55 | 8.79 |
| 2027 | Rule-Based | 44.58 | 3825.50 | 33 | 6 | 0 | 0 | — | — | — |
| 2027 | MaleCNS | 52.92 | 3461.57 | 93 | 23 | 0 | 600 | 2.67 | 6.02 | 8.34 |
| 2028 | Rule-Based | 37.90 | 3656.80 | 35 | 4 | 0 | 0 | — | — | — |
| 2028 | MaleCNS | 42.43 | 3390.24 | 98 | 0 | 0 | 600 | 2.67 | 5.76 | 7.56 |
| 2029 | Rule-Based | 18.83 | 2793.70 | 62 | 3 | 0 | 0 | — | — | — |
| 2029 | MaleCNS | 24.20 | 3356.64 | 95 | 24 | 0 | 600 | 3.83 | 5.40 | 6.51 |
| 2030 | Rule-Based | 46.60 | 3799.60 | 35 | 7 | 0 | 0 | — | — | — |
| 2030 | MaleCNS | 43.38 | 3254.93 | 101 | 23 | 0 | 600 | 3.50 | 6.83 | 9.20 |

| Average per run | Rule-Based | MaleCNS |
|---|---:|---:|
| Coverage | 40.41% | 37.28% |
| Distance | 3501.12 u | 3246.32 u |
| Turns | 42.0 | 101.6 |
| Blocked attempts | 5.4 | 14.0 |
| Stuck events | 0 | 0 |
| Neural decisions | 0 | 600 |
| New frontal fallback percentage | N/A | 4.33% |
| Mean API latency | N/A | 6.11 ms |
| Mean of per-run API p95 values | N/A | 8.08 ms |
| Mean absolute DNa02 asymmetry | N/A | 0.033576 |

The p95 aggregate above is an average of five per-run percentiles, not a pooled percentile. Each individual p95 is provided. All completed comparison runs had zero backend failures. Original and repeated runs matched every non-timing metric and final pose exactly. The five primary MaleCNS runs made 3,000 decisions; including verification repeats, 6,000 decisions were evaluated through actual HTTP.

The compact cold request, including extraction, took **1547.42 ms**; graph extraction was **1.43185 s**. Mean warm latency of 6.11 ms is comfortably below the 200 ms control interval on this machine. The headless runner intentionally advances simulated time faster than wall time: MaleCNS 120-second runs took **4.37–5.75 wall seconds**, excluding the cold request. These timings must not be presented as browser rendering performance.

### Live browser check

A separate seed-2026 run from reset was manually paused after **35.205 wall seconds**. The rendered UI reported **34.7 simulated seconds**, **174 decisions** (about **4.94 decisions per wall second**), **16.1% coverage**, **958.8 units** traveled, **29 turns**, **0 blocked attempts**, **0 stuck events**, **0 backend failures**, **7 new fallback decisions (4.0%)**, mean API **11.4 ms**, p95 **21.4 ms**, and mean absolute asymmetry **0.0334**. Values other than wall timing have the UI's displayed precision; this is a browser smoke/performance check, not an additional 120-second comparison seed.

The live readouts changed with actual ray distances: a left obstacle sample produced L>R and TURN_RIGHT; a right obstacle sample produced R>L and TURN_LEFT. Switching to Rule-Based while paused preserved the shown pose `(141.5,499.1)`, heading 304.5°, and shared coverage 16.1%; resuming and switching back to MaleCNS while moving also worked.

The backend process was deliberately stopped during the later live run. The next request visibly produced CONNECTOME OFFLINE, stopped the bug, cleared readouts/command, retained MaleCNS selection and incremented failures to one. Startup unavailability was checked separately. Reset then restored `(90,480)`, 270°, initial 3.9% coverage, zero time and all controller counters, with no residual activity. The backend was restarted after this test.

### Behavior and interpretation

- MaleCNS covered more area on seeds 2027–2029, less on 2026 and 2030, and less on average. This is not evidence of general superiority of either architecture.
- MaleCNS turned about 2.4 times as often and traveled less on average. Seed 2026 showed particularly poor exploration (23.48% versus 54.11%), despite no blocked attempts. Avoiding contact is insufficient for useful exploration.
- Some MaleCNS seeds had 23–24 blocked fixed-step attempts. These are successful collision rejections, not penetration into walls. The sampled/held command can remain unfavorable briefly as geometry changes.
- Turn commitment and a deadband prevent immediate frame-to-frame sign chatter, but do not prove absence of slower oscillation or repeated paths. No quantitative wall-following or oscillation metric was collected, so no claim is made that those behaviors are solved.
- Zero stuck events only means the defined 10-second translation threshold was not crossed. It does not imply good coverage or freedom from repeated moving loops.
- The close-to-deadband average asymmetry and substantially different seed trajectories show sensitivity to engineering thresholds and frontal tie-breaks. DNa02 peaks are obstacle-response signals in this model, not evidence of biological motor semantics.

## Validation

Final checks: **92 backend tests passed**, one optional full-source test skipped, and two existing dependency deprecation warnings. **23 frontend checks passed** (nine existing simulation checks plus fourteen controller checks). Production TypeScript/Vite build and `git diff --check` passed.

The original nine frontend simulation checks remain passing, including the ten-minute collision/coverage run. Fourteen controller checks cover smooth mapping/laterality, validated real-API contract, avoidance orientation, symmetric front fallback, deadband/commitment, authoritative collision rejection, exactly 12 fixed steps per neural decision, controller switching/reset, visible backend failure, no request overlap, obsolete-response rejection, latency counters, four-second timeout and stuck-event windows.

The backend adds nine checks covering compact/lab equivalence on six input combinations, determinism/zero-state/structural immutability, cached engine reuse, complete network export contacts, API validation/CORS, missing data and topology dependence. Removing all structural routes in a fixture removes DNa02 activity despite active inputs. The existing backend tests are preserved; the optional full-source pytest remains skipped by default, while this milestone's comparisons use the real loaded graph directly.

Production TypeScript/Vite build passed. Browser checks exercised movement/readouts, Rule-Based operation, switching, reset, offline startup, disconnection during movement and the rendered telemetry panel. No decoder parameters were changed after observing benchmark outcomes.

## Run locally

From the project root:

```powershell
npm run build
npm run preview -- --port 5173
```

From a second terminal:

```powershell
cd backend
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000 --no-access-log
```

Wait for application startup, open http://127.0.0.1:5173, choose MaleCNS, and press Start. `npm run dev` also works in a normal development environment; the restricted Codex Windows session can block esbuild's dependency prebundling, so the verified build/preview path is provided here.

With the backend loaded, run the comparison from the project root:

```powershell
npm run compare:controllers -- 120
npm test
cd backend
.\.venv\Scripts\python -m pytest -q
```

## Limits

This milestone proves computational participation of measured topology in a simulated obstacle-avoidance loop. It does not prove biological function, accurate fly behavior, general search competence, or superiority to the baseline. Model normalization, route selection, input imbalance, reset-per-decision dynamics and engineering thresholds strongly affect behavior. Symmetric-front direction and committed turns are explicitly engineered. The current sampler can miss rapidly changing obstacles; the collision layer remains authoritative. A long-running lab/structural query shares the backend analysis lock and can delay control, causing a visible timeout pause. Multiple clients share that backend lock; there is no distributed controller service or hard real-time guarantee.
