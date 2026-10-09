# Virtual Fly visual embodiment

Implemented 28 September 2026. **Visual only**. Natural Fly and BioBug / Cyborg Fly share an original procedural Three.js body. Simple / Fallback retains the original Canvas fly and is used automatically if WebGL fails. No reference image was available in the task context; the written description guided the model.

## Body and flight display

The body has a tan head, brown thorax, tapered segmented abdomen, two faceted red compound eyes, two translucent veined wings, six articulated legs, antennae/aristae, halteres and bristles. BioBug adds a small thorax board, pale component, copper supports/leads, tiny sensor and steady indicator. Hardware is a visibility toggle on the shared body and has no controller connection. This is illustrative anatomy, not scanned morphology or a biomechanics model.

**Motion display → Flying** is the default for both 3D styles. Walking remains selectable. Flight adds a display-only vertical offset, gentle hover/pitch, folded lower legs, spread wings, rapid wing animation, faint wing-sweep silhouettes, and a wider, softer floor shadow. The follow camera tracks the displayed altitude. Wing animation is an illustrative 11 Hz for readability at the 30 FPS display budget, not a biological frequency measurement.

The existing planar path, heading, obstacle sensing and collisions remain authoritative. There is no flight physics, altitude sensor, lift calculation, or ability to fly over obstacles. Pause, completion and neural waiting freeze the sampled pose. Step advances the animation through the existing simulation time. Walking restores the original gait and removes the wing sweeps. Simple keeps its original Canvas appearance.

The anatomical viewer is unchanged. The user confirmed the reported external-browser neuron coloring issue was resolved.

## Rendering architecture

`FlyEmbodiment.tsx` owns body style and motion style as local presentation state. Selecting them never calls simulation configure/reset or changes experiment state. `embodimentPose` makes a detached scalar snapshot of position, heading, time, distance, speed and pause/wait flags. The renderer receives no simulation object.

`fruitFly.ts` uses shared spheres/cylinders/boxes, a lathed abdomen, torus bands, faceted eyes, custom wing surfaces, and batched bristles/veins. There are no external meshes or new dependencies. Wing sweeps reuse the existing wing geometry with a single extra material. `embodimentScene.ts` adds lights, the actual arena footprints, a procedural 16 KiB shadow texture, orbit/zoom, follow camera and overview. No shadow-map pass or postprocessing is used. Display pixel ratio is capped at 1.5 and rendering at 30 FPS. Owned geometry, materials, texture, observer, controls and renderer are disposed when the scene exits.

Animation is a pure sampled pose function. Distance drives walking leg tripods; simulated time drives wings, hover and antenna motion. Heading maps to Three.js yaw as `-heading`, with simulation y mapped to world z. No independent animation clock, random state, neural requests, or physics integration is introduced. Camera interaction remains available while paused. The original **2D Arena · Sensors & Paths** view remains available below the body.

## Behavior preservation and tests

`FLY_EMBODIMENT_BASELINE.json` records normalized-LF SHA256 hashes of every previously tracked `src/` and `backend/` file except the presentation container `VirtualFlyLab.tsx`, against starting commit `3a6d389`. All hashes still match, including simulation, scheduler, controller, neural dynamics, motor decoder, sensory mapping, telemetry, original Canvas fallback, anatomical viewer and BioBug Rescue.

`npm run compare:embodiment` uses the actual live MaleCNS backend and production simulation, not synthetic neural responses. Five arenas each run Simple, Natural walking/flying and BioBug walking/flying for five simulated seconds with seed 2026: **625 evaluations**, 25 decisions and 300 physics ticks per run. The actual procedural model transforms run between physics updates. Trajectories, final poses, telemetry, decisions, simulated timing, and all 295 neural activity values match exactly. Per-case hashes are in `FLY_EMBODIMENT_COMPARISON.json`.

Wall-clock HTTP timings are nondeterministic and are measured separately; only latency summary fields are normalized to zero in compared results. This run measured 22.76 ms mean and 30.40 ms p95. Rendering load can affect wall-clock throughput, but the fixed 60 Hz physics and five decisions per simulated second remain unchanged.

The full frontend suite passed: **104 checks**, including eight embodiment checks. Coverage includes protected file hashes, detached snapshots, heading mapping, model geometry, pause/wait freezing, flight/walk reversal, all five rule-based arenas across styles and live switches, resource disposal, and scene lifecycle. The scene test uses actual Three.js scene/model code with GPU/DOM adapters stubbed. Real browser rendering was verified separately. The TypeScript/Vite production build passed; the existing vendor chunk warning above 500 kB remains. Backend files were unchanged and hash-verified; backend unit tests were not rerun for this display-only change.

Browser checks confirmed a real MaleCNS left-obstacle step at **0.20 s**, position **113.68, 240.77**, heading **21.77 degrees**, and DNa02 L/R **0.0716 / 0.0263**. Switching Walking/Flying while paused preserved the values and sample. `FLY_FLIGHT.png` shows Natural flight beside colored anatomy; `FLY_NATURAL.png` and `FLY_BIOBUG.png` preserve the earlier walking previews.

## Measured cost

Local Chromium production preview with the full anatomical viewer present. These are local snapshots, not hardware-independent guarantees. CPU submission is not GPU execution time. Counts vary with visible arena walls and frustum.

| Display | FPS | Frame interval | CPU submission | Draw calls | Triangles |
|---|---:|---:|---:|---:|---:|
| Natural walking, open arena (earlier sample) | 30.0 | 33.33 ms | 1.03 ms | 66 | 9,080 |
| BioBug walking, open arena (earlier sample) | 30.0 | 33.33 ms | 1.17 ms | 77 | 11,124 |
| Natural walking, left obstacle (earlier sample) | 30.0 | 33.34 ms | 1.24 ms | 67 | 9,092 |
| Natural flying, left obstacle | 30.0 | 33.33 ms | 2.48 ms | 79 | 9,596 |

The six translucent wing-sweep meshes add 12 draw calls and 504 triangles through double-sided transparent passes. Unique geometry stays **100.3 KiB**, plus the **16 KiB** shadow texture. These figures exclude framebuffers, driver memory, browser heap and the separate anatomical viewer. Hardware buffers remain allocated while hidden for immediate mode switching. Latest warm scene setup measured 28 ms, excluding lazy-module download. No extra backend allocation or neural evaluation is introduced by the display.

## Files and reproduction

Existing file changes: `VirtualFlyLab.tsx` integrates the display and clarifies labels; `package.json` adds tests/comparison command. New implementation files under `src/virtual-fly/`: `FlyEmbodiment.tsx`, `embodimentModel.ts`, `fruitFly.ts`, `embodimentScene.ts`, `embodiment.css`.

Validation: `tests/embodiment.cjs`, `scripts/compare_embodiment.cjs`, the baseline/comparison JSON reports, this document and the three screenshots under `docs/`.

```powershell
npm test
npm run build
# With the existing real MaleCNS backend on 127.0.0.1:8000:
npm run compare:embodiment
```

Open `http://127.0.0.1:5173/#virtual-fly`, select a body style, and use **Motion display**. Flying is the 3D default. Start/Resume animates; Pause freezes. Nothing was committed automatically.
