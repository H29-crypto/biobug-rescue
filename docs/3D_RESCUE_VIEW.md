# 3D Rescue View

A third display choice alongside Presentation Mode and Technical View. It renders the existing mission with Three.js 0.180.0; it is not a separate physics or biological simulator.

## Try it

From the project root: `npm run demo`. For the production build: `npm run build`, then `npm run preview -- --port 5173`.

1. Open **3D RESCUE VIEW** and **DEPLOY SWARM**.
2. Drag the scene to orbit, scroll to zoom, or use the + / − buttons.
3. Choose **FOLLOW BIOBUG** and select BUG 01–04 using the roster or by clicking an insect. The camera follows the actual position and heading.
4. **MISSION FOG** dims unmapped areas. Turn it off to inspect the full terrain; detections still appear only after sensing.
5. **FOCUS SCENE** enlarges the view and includes Pause/Resume. Exit Focus or Escape restores the embedded layout.
6. Switch back to Presentation or Technical View without resetting progress. Reset Demo retains its original behavior: canonical paused four-agent Rule-Based mission and Presentation Mode.

## What is rendered

- Original wall and debris footprints, extruded into a damaged structural cutaway.
- Procedural concrete texture, broken wall heights, exposed reinforcement and rubble. Decorative damage lies within existing obstacle footprints.
- Six-legged, insect-like models with colored identification lights and a selected-agent ring. Gait follows actual distance traveled; pause and neural waits do not produce fake walking.
- Shared exploration shading, live 2D minimap and sensor distances.
- Beacons at observed **estimated** survivor/gas positions, labeled by discovery status and sector. These are observations, not physical humans or simulated gas plumes at hidden ground truth.

Building heights, body appearance and gait are illustrative. The world is still a 2D navigation plane, and visual scale is not a calibrated insect/hardware model. The view does not establish realistic insect biomechanics or biologically accurate neural activity.

## Architecture and safeguards

- `src/components/Rescue3D.tsx`: UI, camera controls, selection, focus view, renderer lifecycle and live 2D fallback.
- `src/rendering/rescue3d/model.ts`: explicit environment projection excluding hidden target arrays, X/Y→X/Z transform, deterministic decoration random stream and exploration texture update.
- `src/rendering/rescue3d/insect.ts`: procedural body and articulated leg geometry; visual gait depends on actual translation.
- `src/rendering/rescue3d/scene.ts`: lighting, geometry, materials, cameras and observed markers. It has no callback to advance physics or command navigation.
- `src/components/rescue3d.css`: responsive HUD, inset map, controls and focus layout.

Three.js and the scene load dynamically on first use. Pixel ratio is capped at 1.5. Static geometry is retained; transforms and exploration texture data update in place. Unmount cancels animation, disconnects resize/listeners, disposes controls/geometries/materials/textures and releases the graphics context. A lost context or renderer initialization error displays the live 2D map and a clear fallback message.

## Validation

- Existing **64** frontend checks passed; **7** additional 3D checks passed.
- New checks cover hidden-data exclusion, all heading quadrants, exploration/reset texture values, six-leg gait and pause stability, isolated visual randomness, obstacle geometry, actual scene construction, estimate-only markers, camera calls, resource disposal and 30-second simulation equivalence.
- Scene integration tests use real Three.js geometry/math with a stub GPU/DOM adapter. They do **not** claim actual WebGL rendering verification.
- TypeScript and Vite production build passed. The on-demand scene bundle is approximately 524 kB / 134 kB gzip; Vite emits its standard >500 kB chunk warning. The normal interface does not load that bundle until 3D is selected.
- Local production preview responds on http://127.0.0.1:5173.
- Automated browser visual verification was blocked because the browser automation tool failed to initialize (missing runtime path). Actual GPU appearance, frame rate and interactive camera usability still need a browser smoke check. No screenshots or frame-rate results are fabricated.

No backend, core simulation, collision, sensing, swarm algorithm or MaleCNS controller files were changed. The existing scientific labeling and offline Commander behavior remain.

Three.js reference: [official documentation](https://threejs.org/docs/). Geometry and textures are procedural project code; no external model or texture downloads are required at runtime.
