# Anatomical activity across lab scenes

Verified 2026-10-03 against the local MaleCNS backend and the production browser build.

All three unified lab scenes use the same anatomical renderer, with their own accepted activity history:

| Scene | Verified coverage | Activity source |
| --- | --- | --- |
| Controlled Fly Experiments | Open, left, right, front, corridor | Current fly's accepted control response |
| Collapsed Building Rescue | 1, 2, 4, 8 agents | Selected agent's accepted batch response, routed by ID |
| Supervised Insect Arena | Contact control, operator takeover, resumed autonomy | Current fly's accepted response; historical during operator control |

The viewer displays the selected 295-neuron controller, with 280 structural edges and 2,308 contacts. These are measured response metadata, not the full MaleCNS CNS. Real neuron identities and morphology support simulated dynamics; this is not recorded neural activity or a biologically validated brain simulation. Rescue target/hazard detection and coordination remain engineered systems, not additional neural populations in this viewer. Walking/flying display styles share the same telemetry.

## Presentation fixes

### Follow-up: neurons appear static or disconnected from movement

The inspected rescue mission was paused in rule-based mode, and the local neural backend was stopped. Static morphology was expected, but the unconditional "LIVE SIMULATED ACTIVITY" headline was misleading. The headline now follows the actual sample state, and the panel explains population hue, activity brightness and white selection highlighting. Active-only filtering is disabled without a sample and cannot hide all anatomy in structure-only mode.

The rescue panel now offers a nearby MaleCNS switch (while paused and backend-ready) and run/pause controls. It displays observed body state and movement arbitration separately from the neural proposal. Pausing clears the simulation's pending decision by design, so the read-only per-agent observer now retains the proposal belonging to its accepted sample. This fixes the previously misleading STOP/NO SAMPLE proposal beside held neural colors. Controller changes/reset clear the observation. No physics, dynamics, sensor mapping or scheduler was changed.

Revalidation: 74 actual backend evaluations across ten scene configurations matched neuron IDs, activity values and DNa02 peaks. The full frontend suite passed 142 checks; a subsequently added paused-proposal regression passed along with all six unified-lab checks. Production build passed. Browser testing confirmed changing readings, structure-only guidance, pause and per-agent selection: at the same paused time BioBug #1 showed DNa02 peaks 0.0622/0.1358 and BioBug #2 showed 0.0245/0.0296. These are observed synthetic-dynamics outputs, not physiological measurements.

- Scene and agent identity appear inside the anatomical panel, alongside the number of nonzero sampled values.
- Supervised anatomy is visible by default and can be hidden.
- Live, pending, paused, manual, offline, missing-sample, loading and error states are distinguished. Held samples are explicitly historical.
- Rule-based mode displays structure only. Invalid graph/neuron identity or unavailable geometry disables activity readouts and traces.
- Applied body action is distinguished from the rescue neural motor proposal; guidance/safety overrides may replace a proposal.
- Zero activity remains zero; in the open-arena test all five samples were zero. Obstacle trials produced nonzero values. White selection highlighting is not activity.

No controller, dynamics, sensory mapping, scheduling, movement or backend implementation changed for this verification. The protected anatomical component's presentation-only hash migration is recorded in `FLY_EMBODIMENT_BASELINE.json`, retaining the prior hash.

## Reproduction and evidence

Start the existing backend from `backend/`:

```powershell
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

From the project root:

```powershell
npm test
npm run build
npm run check:anatomy-scenes
npm run preview -- --port 5173
```

Open `http://127.0.0.1:5173/#virtual-lab`. Select MaleCNS in each scene. In supervised mode select the controller and apply a new trial. Rule-based mode intentionally shows no simulated neural overlay.

Results: all 130 frontend checks passed, production build passed, and 74 accepted evaluations were checked against the real manifest and controller readouts. `ANATOMY_SCENE_CHECK.json` records the measured graph, cases and activity counts. Its script asserts exact per-neuron values, DNa02 peaks, independent agent histories, held manual history, resume and read-only presentation. Existing regression tests also cover pending-response cancellation, viewer on/off simulation parity, body-style parity and reset isolation.

Browser checks confirmed all three scenes load real skeletons. Rescue showed live activity for agent 1 and the correct separate history after selecting agent 2 while paused. A corridor step showed 295 nonzero values and DNa02 L/R peaks of 0.1673/0.1652 at body time 0.20 s. Supervised mode changed from live to historical on takeover, then resumed new live evaluations. Scene switching started a clean history. Checks used the in-app browser; no separate external-browser session was tested in this pass.
