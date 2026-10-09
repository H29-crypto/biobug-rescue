# Rescue operator and spatial mission model

Implemented priorities 1, 2, 3, 5 and 6 in **Virtual BioBug Lab → Collapsed Building Rescue**. The original standalone Rescue, Controlled Fly Experiments and Supervised Arena engines are preserved. Rule-Based remains available without the Python service. No commit was made.

## Use

Run `npm run dev` from the project directory, open the displayed URL, select Virtual BioBug Lab and Collapsed Building Rescue. For MaleCNS, from `backend/` run `.venv/Scripts/python.exe -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000` and wait for readiness.

Select an insect. Start the mission, choose a revealed map destination, or take operator control. Forward/back/turn buttons send short pulses; stopping or allowing the lease to expire holds the insect. Resume autonomy returns it to exploration from its current position. Take off and land affect actual altitude, independently of body style. A destination must have a route through known cells at the current altitude. New mission clears all tasks and samples; pause freezes every simulated clock.

Choose an observed T-ID and press Investigate. An available autonomous insect is assigned, preferring a different observer. The planner chooses a revealed viewpoint at least 25 units from the reported observation origin and 20–70 units from the estimated source. It scans for nine simulated seconds, reports re-observation or no new observation, and returns to exploration. A 60-second task timeout reports failure. Repeated heat and multiple observers **never verify human/animal identity or survival**. Matching observations uses an internal simulation association rather than an implemented real thermal tracking algorithm. No undiscovered source position is used for task targeting.

## Architecture and scope

`space.ts` owns altitude slices, swept solid collision, ground line of sight and known-map routes. `operations.ts` defines operator, radio, battery, actuator and investigation data. `rescueMission.ts` runs a new fixed 60 Hz rescue engine. `missionNeural.ts` obtains the existing accepted steering responses only for autonomous insects. `useRescueLab.ts` projects received packets to UI and controls. `MissionControls.tsx` displays operator actions and an obstacle → proposal → arbitration → actuation explanation. Optional renderer contracts retain the older 2D mission behavior when altitude is absent.

The controller remains a **MaleCNS-connectome-based computational controller**, using the existing 295-neuron tactile/descending structural subgraph with simulated dynamics. This work adds no neurons, biological smell/vision circuits or calibrated electrical stimulation model. Waypoint planning, separation, altitude commands, thermal sensing, radio and collision safety are engineering models. The visual backpack does not establish hardware feasibility for fruit flies. Its battery is electronics energy, separate from insect metabolism. Exhaustion uses an explicit modeled hold, not a claim of safe behavior in a real animal.

## Reproducible assumptions

| Parameter | Setting |
|---|---|
| Body center altitude | ground 3; cruise 28; maximum 46 units |
| Vertical half extent / XY radius | 3 units / existing insect radius |
| Vertical speed | 16 units/s |
| Walking / horizontal flight speed | 42 / 54 units/s |
| Solid wall / debris height | 52 / 18 units |
| Added overhead slab | underside 38; thickness 8 units |
| Command delivery / actuator delay | 0.35 / 0.12 simulated s |
| Radio packet interval / delivery delay | 0.5 / 0.3 simulated s |
| Missing packet timeout | 1.5 simulated s (including power loss) |
| Manual lease | 0.65 simulated s |
| Actuator gain | deterministic 0.88–1.00 multiplier |
| Battery drain | idle 0.08; sensor 0.03; radio 0.06; active actuation 0.10 percentage points/s |
| Battery reserve | 15% |

Flight is an x/y/yaw/altitude kinematic proxy, not aerodynamics or insect biomechanics. Walking cannot traverse solid debris; flight at cruise can clear low debris but not walls. Takeoff and landing check the full vertical path. Peer collision accounts for altitude separation. Thermal sight uses 3D occlusion and distance to ground sources; the original gas field remains an illustrative 2D field without diffusion/height physics. Exploration is observed ground cells; displayed percentage uses the pre-existing ground-reachable floor denominator, not volumetric search completeness.

Radio loss freezes that insect's displayed pose, sensor values, route, task reports, findings and neural history. Its onboard autonomous task continues; manual guidance expires. Restored contact waits for a delayed packet. Connected peers can still add discoveries. Map merge/broadcast and communication failure are simplified; no RF propagation model. The separate **Operator and simulation diagnostics** log deliberately shows simulator events even during radio loss and is labeled accordingly. The AI snapshot uses received findings and received agent sectors and excludes unavailable neural details. Local exports include operator task/packet records and diagnostics; AI advisory cannot command insects.

Neural calls run in lockstep: simulated time waits for autonomous controller decisions. Network wall time is excluded from trajectories and battery clocks. All agents stop on a visible neural-service failure; no silent controller fallback. Pause, reset and control changes invalidate stale response epochs. Heading/altitude decisions remain separate from animated geometry.

## Verification

`npm test` includes `tests/rescue_operations.cjs`: physical clearance and forbidden landing; delayed commands and manual expiration; radio-loss privacy and recovery; battery reserve/exhaustion; known-map waypoint outcomes; different-observer investigation and deferred reporting; autonomous-only neural batches; pause/resume stale-response rejection; exact 30/60/144 Hz parity; exact Simple/Natural/BioBug embodiment parity.

`node scripts/check_rescue_operations.cjs` exercises the actual local MaleCNS API for two insects, four simulated seconds per body style, recording exact trajectory, timing, battery, delivered activity and report parity in `RESCUE_OPERATIONS_LIVE_CHECK.json`. It does not call the AI service. Protected-file manifests record the authorized optional rendering/type changes, preserving previous hashes in a migration entry. Existing controller and neural-dynamics source files remain protected.

Verified results: 143 existing frontend checks plus 14 operation checks; backend 141 passed / 1 skipped. Live check: 60 actual API batches across three styles, 295 neuron values per sample, exact style parity. The backend suite uses a workspace-local pytest temporary directory to avoid permissions on the default Windows temp tree.

## Changed files for this milestone

- New engine/support: `src/unified-lab/space.ts`, `operations.ts`, `rescueMission.ts`, `missionNeural.ts`, `MissionControls.tsx`.
- Integration: `src/unified-lab/useRescueLab.ts`, `RescueLab.tsx`, `thermal.ts`, `visuals.ts`, `mission.css`.
- Optional render contracts: `src/domain/types.ts`, `src/components/EnvironmentCanvas.tsx`, `Rescue3D.tsx`, `src/rendering/drawEnvironment.ts`, `rescue3d/model.ts`, `rescue3d/scene.ts`.
- Verification: `tests/rescue_operations.cjs`, `scripts/check_rescue_operations.cjs`, `package.json`, authorized baseline migrations, this document, cross-links in the unified/thermal documents, live comparison JSON and preview PNG.

No new dependencies. The rescue code remains lazy-loaded; the final RescueLab chunk is 62.29 kB / 20.48 kB gzip. The existing shared fly geometry, capped pixel ratio and rendering disposal remain in use. No quantitative browser FPS benchmark was performed. Optional height fields leave original standalone Rescue rendering and physics on its prior path.

## Motion-display regression fix — October 4

The initial radio implementation displayed each insect only at two pose updates per simulated second, including wing and leg animation. That caused visible jumps. Radio packets now include at most 64 recorded fixed-step poses. The 3D renderer replays that received trajectory using a 0.8-second buffer and shortest-angle interpolation between adjacent physics poses. It never predicts future positions or joins distant packet endpoints across obstacle corners. The follow camera uses the same smooth displayed pose. Pause and radio loss hold the rendered pose and animation clock. Reconnection resumes from the available received history; it does not invent the missing route. The overhead operator map and numerical/neural telemetry remain raw received data.

Routine React mission UI refreshes are capped at 30 Hz while fixed-step simulation and Three rendering retain their own animation frames. `tests/rescue_motion.cjs` checks continuity with two-Hz packet delivery, heading wrap, corner preservation, no extrapolation, pause/loss/reset/reconnection behavior and observer immutability. Simulation logic, controller output, battery timing and neural activity are unaffected.
