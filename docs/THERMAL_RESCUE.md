# Thermal observations in the rescue lab

Implemented 3 October 2026. Open `http://127.0.0.1:5173/#virtual-lab` and choose Collapsed Building Rescue. Deploy the team, pause, select a heat report and export findings.

## What the simulation represents

A proposed carried thermal sensor reports unidentified surface warmth. This is an engineering sensor model, not biological fruit-fly human recognition or a new MaleCNS sensory pathway. Heat alone does not identify a person, animal, heartbeat or living survivor. Operator review and real-world confirmation would still be required. This milestone does not implement extraction or communication with an external rescue team.

The visibility constraint follows the basic limitation explained by [FLIR: Can thermal imaging see through walls?](https://www.flir.com/discover/home-outdoor/can-thermal-imaging-see-through-walls/). The numerical settings below are illustrative project assumptions, not published sensor specifications or evidence that this hardware fits on a fruit fly.

## Model assumptions and limitations

- Four thermal samples per simulated second, a 120-degree forward field of view, and maximum range 110 world units. Walls and debris occlude the source center. This is a 2D line-of-sight approximation, not heat transport through rubble or a rendered infrared camera.
- Ambient temperature is fixed at 22 °C. Sources associated with scenario occupants and warm equipment use 32 °C; warm rubble uses 36 °C. Apparent temperature has deterministic ±0.3 °C jitter. Detection requires at least 2 °C contrast and signal 0.12; signal decreases linearly with distance and scales with contrast, capped at one. These are synthetic settings, with no emissivity, atmospheric, metabolic or physiological model.
- Warm equipment and rubble are intentional distractors. Their internal identities and occupant IDs never appear in the public heat report. The same sensing rules apply to every source.
- Three consecutive readings from an insect mark repeated observations, never confirmed life. Losing view clears that insect's current reading while retaining historical reports. Reports show their age in simulated time.
- A separately assumed range and positioning aid estimates coordinates with quantized range/bearing and bounded injected errors. A monocular thermal reading alone does not supply this position. The reported radius is a conservative engineering error bound in world units, not a statistical confidence interval or meters. The detail panel contains a labeled schematic; map markers indicate estimate centers.
- Cross-agent association uses internal source keys. This idealized association does not solve real-world target tracking, duplicate rejection, localization or communications. Source positions and temperatures are static.
- Existing movement, neural dynamics, obstacle mapping and flight appearance are preserved. Heat observations do not steer agents or feed the MaleCNS controller. The original standalone BioBug Rescue retains its legacy abstract life-signal model; this thermal model applies to Collapsed Building Rescue in the unified lab. Other lab scenes are unchanged.

## Implementation

`src/unified-lab/thermal.ts` owns sampling and observations. `thermalMission.ts` produces detached, anonymous public mission views and Commander snapshots. The optional post-tick observer in `src/simulation/swarm.ts` runs only after completed physics ticks, so pause and waiting for neural responses also freeze thermal sensing.

`useRescueLab.ts`, `RescueLab.tsx`, `ThermalFindings.tsx`, `MissionFindings.tsx` and `mission.css` present readings, heat history and gas findings. The existing Canvas and 3D marker renderers label thermal IDs as `HEAT ?`. No confirmed-survivor events or legacy survivor identities are exposed in this mission's UI or exports.

`src/simulation/commanderSnapshot.ts` and `backend/commander/{models,grounding}.py` support optional thermal reports. The backend rejects thermal packets that claim confirmed survivors or mission completion, validates observation references/times, and adds mandatory heat uncertainty to grounded AI responses. The API check uses a mocked provider and makes no paid model call.

Protected-file baseline manifests record an explicit thermal migration with previous and updated hashes. The observer, report contract and marker labels changed intentionally; neural and physical models did not.

## Reproduction

```powershell
npm test
npm run build
node scripts/check_thermal_mission.cjs
cd backend
.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp ../work/pytest-thermal-fresh
```

Use a fresh, disposable workspace path for pytest's `--basetemp`. The report script writes `docs/THERMAL_MISSION_REPORT.json` using an actual four-agent seeded run at 60 Hz for 120 simulated seconds. This run produced four heat reports, zero survivor reports and no mission completion. Exported locations are estimates only.

Validation includes occlusion, field of view, low contrast, warm distractors, bounded localization errors, interrupted observations, current versus historical readings, no hidden identity leakage, API grounding and rejection of confirmation claims. Complete swarm state matches exactly with thermal sampling on/off; thermal observations match at 30, 60 and 144 render updates per second. Pause, reset and waiting for MaleCNS responses are covered.

Results: all 141 frontend checks passed; the full backend run passed 140 tests with one opt-in downloaded-data integration test skipped. The subsequently added thermal HTTP test passed in a focused run of all ten thermal backend tests. Production TypeScript/Vite build passed. Starlette emitted an existing AnyIO deprecation warning. Actual generated UTF-8 report data validated against the backend schema. Browser testing exercised a 110-second mission, pause, four heat reports, two gas hazards and uncertain heat detail. The export button was exercised, but the in-app browser did not deliver a download event and no new downloaded file was verified; the report payload itself is validated through the reproducible script and regression tests. No browser console errors were recorded. The anatomical panel still displayed its correctly labeled structure-only state in rule-based mode; no new neural response was invented for heat.


Current rescue operator controls, backpack limitations and altitude navigation are documented in [RESCUE_OPERATIONS.md](RESCUE_OPERATIONS.md). Earlier visual-only flight descriptions refer to the previous milestone.
