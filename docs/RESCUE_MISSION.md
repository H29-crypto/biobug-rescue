# Milestone 5: Rescue mission

This is a software simulation of future insect-scale rescue sensing. It does not demonstrate real survivor-detection hardware. Confidence and priority are engineering simulation metrics, not medical probabilities or replacements for rescue-team judgment.

## Scope and architecture

The default is four coordinated BioBugs, Rule-Based navigation, seed **2026**. The existing obstacle sensors, movement, separation, collision guards, frontier coordinator, MaleCNS structure, neural dynamics, decoder and HTTP batching are unchanged. `simulation/rescue.ts` provides a separate mission layer. `SwarmSimulation.rescue` owns private targets, observation tracks, sensor payloads, shared discoveries and events. It samples only after successful fixed-step simulation progress; pause and backend waiting freeze mission sensing and time.

The UI receives an explicit operator projection: no ground-truth target arrays, private tracks or truth positions. The terrain renderer never draws survivors or hazards, including full-map inspection. Canvas markers and accessible discovery buttons use only `estimatedPosition` from actual discoveries. Debug navigation rays do not reveal targets. This separation prevents accidental UI disclosure; it is not a security boundary against someone inspecting the bundled JavaScript.

## Deterministic scenario (ground truth for experiment authors only)

The existing 800 x 560 collapsed-building map retains walls, rubble, narrow passages and obstructed rooms. Locations are carefully designed fixed positions, not random per seed. Tests flood-fill reachable space and verify body-clearance routes to all four targets. All are more than 150 world units from deployment (90,480).

| Target | Type | Ground-truth position | Truth sector |
| --- | --- | --- | --- |
| S-01 | Survivor | (207,305) | C2 |
| S-02 | Survivor | (350,120) | A2 |
| H-01 | Gas | (440,462) | D3 |
| H-02 | Gas | (110,300) | C1 |

These coordinates are intentionally documented here, but never displayed as hidden targets in the operator UI. Sector letters A-D run north to south; numbers 1-4 run west to east. Each sector is 200 x 140 units. Estimates near a boundary can change sector.

## Sensors and signal model

Each BioBug has separate rescue readings (`life`, `gas`, `exposed`, rescue status), independent of its navigation sensors and neural telemetry. These are abstract engineering sensors, not existing hardware. No heat sensor is implemented.

Every **0.25 simulated seconds** (4 Hz), for each target:

```
radius = 85 units for life, 100 units for gas
signal = clamp(1 - distance / radius, 0, 1)
if a wall/debris blocks the straight sensor-to-target ray: signal = 0
```

Each channel reports the strongest current target signal of its own type. The initial readings are zero until the first sample. There is no random signal noise. The life sensor represents an abstract life-indicator payload; gas is a simplified radial field with hard occlusion, not fluid diffusion or calibrated concentration. Scenario hazard radius/severity fields are legacy metadata; the explicit rescue configuration defines operational sensing, and severity derives from measured signal.

Detection requires signal **>= 0.20**. Effective unobstructed warning distances are therefore 68 units (life) and 80 units (gas); fog visibility alone never detects a target.

## Confirmation and confidence

A first threshold crossing creates a shared possible life signal or gas warning. For each target/agent pair, confirmation requires **three consecutive samples** at signal **>= 0.45** (life) or **>= 0.65** (gas). These span 0.50 seconds from first strong sample to third, with 0.25-second sampling cadence. Any intervening weak or absent sample resets that agent's streak. Different agents cannot combine isolated strong samples to bypass this requirement.

One agent can confirm alone. Another agent's sustained readings append an independent confirmation and an event. A target produces one first-detection event and at most one confirmation event per agent, avoiding per-frame notification spam. Confirmation is retained as historical evidence. All observations above detection threshold update the estimate, observer list, latest time and confidence.

The bounded confidence candidate is:

```
0.20
+ 0.30 * peak signal
+ 0.15 * min(observations / 8, 1)
+ 0.10 * min(time since first detection / 2 seconds, 1)
+ 0.10 * min((distinct observers - 1) / 2, 1)
+ 0.10 * clamp(1 - current estimate residual / 40 units, 0, 1)
+ 0.05 if any agent has confirmed
```

Confidence is the maximum prior/candidate score, capped at 0.99. The residual compares the incoming estimate with the previous shared estimate. Time since discovery includes gaps; it is not a substitute for the consecutive-reading confirmation rule. Historical confidence never decays, so latest-observation time is displayed explicitly. This deliberately simple score is not calibrated and should not be interpreted as biological or medical certainty.

## Localization and association

The simulated sensor provides a bearing relative to the BioBug heading, quantized to 30-degree bins. Range inferred from signal is quantized to 10 units with a 5-unit minimum. The estimated point is reconstructed from BioBug position, heading, measured relative bearing and measured range, then clamped to the map bounds. It does not copy the target coordinates into a discovery.

The shared estimate is a running mean for the first 12 observations, then an exponential average with weight 1/12. Multiple observations can improve accuracy but improvement is not guaranteed. The sensor model internally uses target truth to synthesize a quantized directional reading; direction cannot be inferred from scalar signal alone. Exact localization/known agent poses and perfect internal target identity association are simulation assumptions, not demonstrated capabilities. Estimates may fall inside walls or shift across sectors; no truth-based snapping is performed. Events store immutable copies of the estimate at their occurrence. Raw errors in `RESCUE_EXPERIMENT.json` compare estimates against truth offline only.

## Behavior and mission UI

A possible life signal puts the detecting BioBug's rescue payload into **INVESTIGATING** while it continues normal navigation and gathers evidence. No pursuit or movement bias is added. Other agents continue exploring. A current gas signal >= 0.65 displays **HAZARD EXPOSURE**, taking precedence over the investigation label. Exposure is visible telemetry, not physical damage or avoidance; sustained strong gas also creates a high-concentration event. No rescue input is routed into MaleCNS.

Engineering priority is `round(100 * clamp(0.7 * confidence + 0.3 if a discovered gas estimate is within 120 units, 0, 1))` for life signals. Gas severity/priority is `round(100 * peak signal)`. Only discovered estimates enter proximity priority, so it does not leak hidden hazards.

The mission dashboard shows confirmed/possible survivors, hazards mapped, coverage, deployed/active count, time, discovery details and a reverse-chronological event log. Map markers and equivalent keyboard-accessible buttons select details: type, state, discoverer, confirming agents, confidence, estimated coordinates/sector, first/latest times and observations. A persistent quiet banner keeps the latest event visible near the map. All-survivor confirmation marks the objective complete, records completion time, and lets exploration continue; 100% coverage and all hazards are not required for that objective.

Reset or deployment-count change clears sensor readings, tracks, estimates, events, completion, selections and mission progress. Navigation mode and coordination preference are preserved. Switching controllers without reset preserves mission discoveries and time. Backend failure still pauses all agents without Rule-Based fallback.

## Reproduce

From the repository root:

```powershell
npm test
npm run build
npm run preview -- --port 5173
```

For MaleCNS, in a second terminal:

```powershell
cd backend
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000 --no-access-log
```

Wait for dataset startup, open http://127.0.0.1:5173/, retain four BioBugs/Rule-Based/coordinated defaults, and click **DEPLOY SWARM**. Events use simulated time, not wall-clock time. Reset reproduces the mission. To compare one/four agents with both controllers:

```powershell
npm run compare:rescue -- 60
# Optional frontend-only comparison:
npm run compare:rescue -- 60 --rule-only
```

The experiment runs each configuration twice and requires exact equality of all recorded non-wall-time results, including events and estimates. Every fixed step verifies wall clearance and inter-agent separation. MaleCNS uses the real loaded backend; there are no mocked experiment responses. One fixed scenario/seed is a demo reproducibility check, not statistical evidence of general rescue performance. Prior Milestone 4 reports remain unchanged.

## Validation

All 46 frontend checks passed, including 12 new rescue checks and all 34 existing navigation/controller/swarm checks. Backend: 94 passed, one optional full-source test skipped, two existing dependency warnings. The first backend invocation hit the Windows temporary-folder permission restriction; a fresh workspace temporary directory and disabled cache resolved it without code changes:

```powershell
# From backend, use a fresh unique test folder under work:
.\.venv\Scripts\python -m pytest -q -p no:cacheprovider --basetemp=../work/pytest-rescue-20260925-a
```

The new checks cover hidden UI projections and terrain rendering, distance/occlusion, independent channels, thresholds, temporal reset, multi-agent confirmation, estimate/truth separation, immutable events, sectors, reachable targets, collision-safe deterministic demo, pause, controller switching and reset. Production TypeScript/Vite build passes.

## Limitations

No real hardware, medical assessment, gas diffusion, false positives, localization noise distribution, physical communication delays, heat/fire simulation, pursuit, rescue action, AI commander, LLM or OpenAI API. Target identities are perfectly associated internally. The UI cannot display ground-truth positions, but source inspection can recover the fixed scenario. Observation averaging and confidence are heuristic; long periods without readings do not reduce confidence. Navigation congestion and MaleCNS exploration limitations from Milestone 4 remain. Four agents are the intended demo; more agents need not improve outcomes. Mission success means locating the simulated survivors, not rescuing them.

## Measured 60-second demo results

| Controller | Agents | First life (s) | First confirmation (s) | First gas (s) | Survivors | Hazards | Coverage | Contributors | Completion (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rule-based | 1 | 5.25 | 6.25 | 4.25 | 1 | 1 | 24.08% | 1 | Not reached |
| rule-based | 4 | 6.75 | 7.75 | 4.75 | 2 | 2 | 76.16% | 3 | 25.75 |
| malecns | 1 | 18.50 | 19.50 | 14.75 | 1 | 1 | 16.09% | 1 | Not reached |
| malecns | 4 | 18.50 | 19.50 | 11.75 | 2 | 2 | 56.50% | 2 | 37.50 |

Final localization errors (world units; not meters):

| Controller / agents | Target | Error |
| --- | --- | ---: |
| rule-based / 1 | H-02 | 1.878 |
| rule-based / 1 | S-01 | 2.257 |
| rule-based / 4 | H-02 | 1.194 |
| rule-based / 4 | S-01 | 0.982 |
| rule-based / 4 | H-01 | 4.423 |
| rule-based / 4 | S-02 | 0.514 |
| malecns / 1 | H-02 | 2.790 |
| malecns / 1 | S-01 | 2.744 |
| malecns / 4 | H-02 | 1.346 |
| malecns / 4 | S-01 | 0.610 |
| malecns / 4 | H-01 | 1.424 |
| malecns / 4 | S-02 | 0.466 |

Four-agent Rule-Based total distance: 5241.60 units. The raw report includes estimates, immutable events, all distances and contributors. Both MaleCNS configurations completed 300 batches per run with zero failures. Every configuration repeated exactly.

## Browser verification

The production preview was exercised in the in-app browser. Full-terrain inspection before deployment kept rescue counters and discovery lists empty. The four-agent Rule-Based run showed two survivors, two hazards and completion at displayed time 00:25; survivor details showed BioBug #3 detecting and BioBug #2 independently confirming. Clicking the Canvas marker in sector A2 selected its estimated-location details. Reset removed all discoveries, event history and completion.

A separate live four-agent MaleCNS run showed both survivors and both hazards, with objective completion at displayed time 00:37. Neural batches advanced normally with zero failures during the inspected run; the browser error log was empty. The browser was reset to four coordinated Rule-Based agents ready to deploy. Displayed timestamps round down to whole seconds; use the experiment JSON for precise simulated times. Browser wall-clock presentation speed depends on tab scheduling and backend latency.
