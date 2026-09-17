# BioBug Rescue

A browser-based, bio-inspired search-and-rescue simulation. This is a hackathon demonstration, not an accurate insect brain model or a real rescue system.

## Run locally

Requires Node.js 22.12+ (verified with Node.js 24).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production validation: `npm run build`. Preview the build with `npm run preview`.

## Architecture

- `src/domain/types.ts`: shared, framework-independent contracts for the environment, agents, sensors, neurons, discoveries, and swarm.
- `src/scenarios/earthquake.ts`: deterministic scenario factory; world geometry and initially unexplored terrain.
- `src/rendering/drawEnvironment.ts`: Canvas-only drawing, independent of React. World coordinates remain stable when the screen resizes.
- `src/components/EnvironmentCanvas.tsx`: React-to-Canvas lifecycle, responsive sizing, device pixel ratio, and cleanup.
- `src/App.tsx`: mission interface and view state.
- `src/simulation/`: fixed-step world updates, collision detection, obstacle sensing, rule-based steering, and exploration.
- Future `src/controllers/`: pure neural activation updates and motor output conversion.

React owns controls and summarized state. The simulation owns mutable world state and a fixed timestep; Canvas renders snapshots. Rendering must never advance the simulation. Keep true environment data separate from discovered knowledge; exploration radius and wall occlusion determine what the shared exploration grid reveals. An inspection toggle is a development view and never updates discovery data.

## MVP

One deterministic collapsed-building scenario, a small swarm, collision-safe movement, progressive shared fog of war, simulated survivor/hazard sensing, and coordinated exploration. Select a BioBug to inspect sensor values, sensory/interneuron/motor activity, and movement outputs. Show coverage, discoveries, and elapsed mission time. Provide pause, resume, and reset. The eventual Rescue Commander is a local rule-based summary panel; no backend, API keys, or OpenAI integration.

Success means the swarm reveals reachable space over time without crossing walls, discoveries persist and are shared, neural activity visibly responds to sensors, and reset reproduces the initial scenario.

## Data structures

All definitions are in `src/domain/types.ts`. Positions and dimensions use world units; heading uses radians; elapsed time uses seconds. A grid uses row-major index `row * columns + column`. Rectangular walls and debris will be solid obstacles.

| Structure | Main fields and purpose |
| --- | --- |
| Environment | ID, name, dimensions, obstacle rectangles, exploration grid, survivors, hazards, entry point. Ground-truth scene plus initial knowledge. |
| BioBug | ID, position, heading, radius, speed, behavior state, sensors, optional future neural controller. One live agent. |
| Sensors | Front/left/right distances in world units and normalized obstacle signals; hazard/survivor/neural cue fields are reserved and remain zero. |
| NeuralController | Sensory, interneuron, and motor neurons with IDs, activation and bias; directed weighted synapses; left/right motor outputs. Planned activation range 0–1; weights may be signed. |
| Survivor | ID, position, undetected/possible/confirmed status, optional discovering bug ID. |
| Hazard | ID, position, influence radius, gas/heat/unstable category, normalized severity, discovery flag. |
| Swarm | Agent array, shared exploration grid, timestamped discovery records, elapsed simulation time. |

The neural controller is connectome-inspired. It does not reproduce an identified biological connectome. Future integration should make sharedExploration the canonical mission knowledge grid rather than maintain two independently mutable copies.

## Small milestones

1. **Environment scene — implemented.** React + TypeScript + Vite; responsive Canvas; walls, debris, seeded unexplored areas, one possible survivor, one gas hazard; legend and static scenario statistics. Inspection toggle reveals geometry without changing coverage. No agents or simulation loop.
2. **Single-agent exploration — implemented.** One BioBug with fixed-step movement, rule-based obstacle avoidance, three ray sensors, collision safety, actual occluded exploration, live inspector, Start/Pause/Reset and debug rays.
3. **Survivor/hazard detection — not started.** Add actual entity sensing, discovery events and mission knowledge beyond simple marker visibility. Obstacle sensing and fog were moved into milestone 2 by the current scope.
4. **Neural control.** Implement sensory-to-interneuron-to-motor activation and differential steering. Add selected-agent panel and neural visualization. Verify a changed obstacle input changes motor outputs.
5. **Shared swarm exploration.** Add several agents, shared discoveries and frontier assignment with local separation. Compare coverage with independent agents using the same scenario and seed.
6. **Mission demo polish.** Pause/resume/reset, live statistics, local Rescue Commander summaries, responsive presentation and repeatable end-to-end demo. Test reset, selection and long-running stability.

## Milestone 2 behavior

Click Start to run, Pause to freeze, or Reset to rebuild the initial world without a page reload. Reset also clears inspection/debug toggles, the random seed, heading, clock, controller memory and fog. The deployment radius starts explored (3.9% of reachable cells). Inspect full map is a renderer-only override; mission statistics and marker counts retain actual exploration state.

- `requestAnimationFrame` supplies elapsed time to a 1/60-second accumulator. Catch-up is capped at 0.1 seconds per frame to avoid jumps after tab suspension.
- The bug has a radius of 7 world units and moves at 42 units/second. Circle/rectangle and map-boundary checks reject invalid moves. Translations are subdivided into at most radius/2 increments to prevent tunneling.
- Front/left/right rays use exact ray/rectangle intersections at 0 and ±60 degrees, up to 85 units from the body edge. Values update after movement as well as before steering.
- A front distance below 22 units causes an in-place turn toward the freer side. A committed turn duration prevents corner oscillation; seed 2026 controls ties, turn duration and gentle wandering. Blocked denotes obstacle-avoidance turning or a rejected movement.
- Exploration reveals cell centers within 75 units with line of sight. The first obstacle cell can also be revealed. Coverage is the explored fraction of a four-neighbor flood-filled grid reachable by the circular body from entry. Flood fill only computes the denominator; the controller has no route planner or knowledge of the full map.
- Survivor/hazard visibility follows the explored cell mask. Their detection fields remain undetected/false; the UI calls them visible markers, not detected entities.

## Limitations

The 20-unit grid approximates accessible area and fog; thin walls and corners can produce coarse visual edges, and narrow passages may be undercounted. Simple local steering can revisit rooms or stall in a small region and does not guarantee complete coverage. At very low frame rates, dropping excess catch-up time deliberately slows simulated time. Only one bug is supported in the current UI. The retained NeuralController and Swarm types are future contracts, with no neural execution, coordination, entity detection, backend or AI services.

## Validation

`npm test` runs nine checks covering initial state, walls/debris/bounds, large-step collision safety, ray distances, occlusion, rotation/stopping, 30/60/144 Hz determinism, pause/reset initialization and frame-gap handling. A ten-minute simulation checks every position and sensor range; coverage grew from 3.9% to 67.1% without collisions. `npm run build` validates TypeScript and the production bundle. Browser checks verified live movement/readings, Pause, Reset and inspection without coverage changes.

## Validation environment
Production build and browser rendering were verified. The Codex Windows sandbox blocks esbuild ancestor-directory access during development dependency optimization. If this affects your dev session, run npm run build followed by npm run preview to view the verified production app locally.


