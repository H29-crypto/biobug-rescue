# Supervised single-insect arena

Open `/#virtual-lab`, then **Supervised insect arena**. This is a separate, two-minute single-fly trial. Existing collapsed-building rescue and controlled experiments remain available. Changing scenarios discards the current run, as the navigation states.

## Operator workflow

1. Leave the rule-based baseline selected, or choose MaleCNS and click **New trial / apply controller**. MaleCNS requires the existing local Python backend.
2. Click **Start / resume simulation**. Automatic exploration begins.
3. Click open ground on the known-arena map, or enter X/Y coordinates and **Assign waypoint**. The route avoids collision geometry. Blocked/unreachable destinations leave the previous command intact.
4. Click **Take control**, focus the steering pad, and hold WASD/arrows or a direction button. Automatic guidance is suspended. Space, key/pointer release, lost focus, or radio loss releases steering. Commands have a 0.35 simulated-second lease.
5. Click **Resume autonomy** to restore the previous exploration/waypoint mode. **Explore automatically** explicitly clears the old waypoint.
6. **Simulate radio loss** freezes received backpack telemetry and disables new operator commands. Onboard automatic guidance continues. Restoring the radio transmits a fresh packet; it does not replay old commands.
7. **Pause simulation** is a simulator control, not a guaranteed biological stop command. Hiding the browser tab also pauses the trial.

## Architecture and scientific scope

`src/supervised-lab/model.ts` owns its state and body integration, reusing existing geometry, controller primitives and the fly render snapshot. It never calls the old fly/rescue advance functions. `neural.ts` owns at most one neural request. Generation and identity checks reject stale replies after mode changes, pause, reset or unmount. `SupervisedLab.tsx` provides the UI and animation loop, and `supervised.css` scopes its layout. The unified scenario shell lazily loads it.

No existing simulation, neural dynamics, backend, motor decoder, anatomical renderer or embodiment geometry was changed in this milestone. No content-hash baseline needed migration. No new package dependency or automatic commit was added.

### Body and sensing

- The body remains a planar disk with swept collision checks. New linear/angular acceleration limits are 90 world units/s² and 8 rad/s². Commands use the existing 42 world units/s and 1.9 rad/s limits; these are engineering choices, not measured Drosophila values.
- Three short virtual contact probes extend ten world units beyond the body at 0 and ±45 degrees. Their geometric overlap/compression produces bounded signals. They are not validated antenna/leg receptor models. Rear body collisions remain a separate signal and are never labeled frontal probe activation.
- Reported speed and angular velocity provide simplified body feedback. There are no joint angles, muscles, force sensors, friction, slopes, slipping, articulated contact mechanics or biological proprioceptive pathways yet. Six-leg animation is still procedural and follows distance traveled.
- The rule-based baseline retains its engineering proximity sensing. MaleCNS receives the short-contact signals in this arena only. This is a new, explicitly hypothetical sensory mapping into the existing ProLN tactile selection, not a discovery that three probes match actual receptor anatomy.

### Guidance and neural attribution

- Automatic exploration uses the selected baseline or MaleCNS computational controller. The MaleCNS circuit is unchanged: 295 neurons, 280 edges, 2,308 structural contacts.
- Waypoint routing uses known arena geometry and collision-checked graph edges. It is an engineering planner, not a learned map or unknown-world exploration. Strong contact in MaleCNS waypoint mode gives its response precedence; body-contact recovery is a separate engineered maneuver. Arrival is held within a four-world-unit tolerance; general-purpose navigation success is not guaranteed.
- Operator control supplies body-level velocity requests and suspends neural evaluations. It is an idealized guidance interface, not a claimed real electrode targeting protocol. Operator input is not labeled neural activity. The applied command source is always displayed.
- Physics waits for a valid neural response; the 10-second wall-clock timeout allows the first structural graph build. Failures pause the simulation without switching controllers. Manual control remains usable. Simulated time stays fixed at 60 Hz with neural decisions every 12 ticks.
- The anatomical inspector displays only accepted backend activity and labels the last sample as historical during operator control. It is a research instrument, not a neural recording device inside the backpack.

### Backpack

Position, speed, turning, contact, mode and an illustrative power budget are copied into packets every 0.2 simulated seconds while connected, plus immediate control-state synchronization. Disconnected packets do not alias live state. Position has no localization noise in this baseline. Radio loss is a user-operated fault switch; attenuation, packet latency, radio propagation and delayed-command queues are not modeled. The displayed power budget assumes ten active minutes and is not a validated hardware specification or payload claim.

The scene, map, source badge, event log and neural inspector intentionally show research ground truth. Only the received-packet panel represents the simulated radio view. A fully restricted operator view is a later milestone.

## Verification

`npm test` includes `tests/supervised_lab.cjs`. The dedicated suite covers short-range sensing, rear-contact attribution, manual takeover, acceleration/deadman release, wall collisions, successful routing around two barriers, invalid destinations, disconnected packet isolation, pause, deterministic frame batching, stale neural responses, contact input delivery, manual independence and malformed-response failure.

`node scripts/check_supervised_live.cjs` runs against the real local MaleCNS backend. It repeats an identical contact trial, compares all sampled paths and neural histories, checks that takeover suppresses requests and resume adds a new sample, and compares zero/front/left stimulus probes. It writes `SUPERVISED_LIVE_CHECK.json` only after success. These are computational checks, not validation against living flies.

To run from the project root:

```powershell
npm run dev
# Separate terminal for MaleCNS:
backend/.venv/Scripts/python.exe -m uvicorn connectome.api:app --app-dir backend --host 127.0.0.1 --port 8000
```

To test a production build:

```powershell
npm run build
npm run preview -- --port 5173
```

Physical flight, multisensory neural pathway expansion and backpack-based survivor recognition remain subsequent milestones.

## Completed checks (29 September 2026)

- All 109 existing frontend checks passed; all 13 new supervised-arena checks passed (122 total). The final dedicated run includes rear-contact attribution, replanning after operator displacement, and exact trajectory invariance when only radio connectivity changes.
- The production TypeScript/Vite build passed, and `git diff --check` passed. The new lazy-loaded arena chunk is about 21.3 kB before compression (8.0 kB gzip), reusing the existing Three.js renderer. No new hardware-independent FPS claim is made.
- The saved live report contains 25 actual MaleCNS evaluations. Two repeated trials had identical sampled trajectories and full neural activity histories. Operator takeover suspended requests; resuming produced a new accepted sample. Zero stimulus produced zero activity; front-only stimulus produced DNa02 L/R peaks 0.14454887797114419 / 0.14279396982187398; left-only stimulus produced 0.20140739329541207 / 0.07383367905113165.
- Browser checks verified waypoint motion, takeover, disabled commands and frozen telemetry during disconnection, reconnection, resume, pause, and a live MaleCNS trial with accepted anatomical samples. At 5.4 simulated seconds the inspector showed evaluation 27, sample time 5.2 s; operator takeover subsequently displayed historical-sample attribution.
- The first cold neural request exceeded the original four-second timeout while building the structural subgraph. The arena now permits ten seconds while holding physics; the live check then passed. Other modes retain their existing scheduling.
- The sandbox blocked Vite's development dependency scan from reading a parent directory. Browser validation therefore used the successful production build and Vite preview. This did not require changing application dependencies or permissions.
- Backend source was unchanged by this milestone; the Python suite was not rerun. Existing pending changes from earlier milestones were preserved. Nothing was committed.
