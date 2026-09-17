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
- `src/scenarios/earthquake.ts`: deterministic scenario factory; world geometry and initial discoveries.
- `src/rendering/drawEnvironment.ts`: Canvas-only drawing, independent of React. World coordinates remain stable when the screen resizes.
- `src/components/EnvironmentCanvas.tsx`: React-to-Canvas lifecycle, responsive sizing, device pixel ratio, and cleanup.
- `src/App.tsx`: mission interface and view state.
- Future `src/simulation/`: fixed-step world updates, collision detection, sensing, and swarm coordination.
- Future `src/controllers/`: pure neural activation updates and motor output conversion.

React owns controls and summarized state. The simulation will own mutable world state and a fixed timestep; Canvas will render snapshots. Rendering must never advance the simulation. Keep true environment data separate from discovered knowledge; sensor range and wall occlusion will determine what the shared exploration grid reveals. An inspection toggle is a development view and never updates discovery data.

## MVP

One deterministic collapsed-building scenario, a small swarm, collision-safe movement, progressive shared fog of war, simulated survivor/hazard sensing, and coordinated exploration. Select a BioBug to inspect sensor values, sensory/interneuron/motor activity, and movement outputs. Show coverage, discoveries, and elapsed mission time. Provide pause, resume, and reset. The eventual Rescue Commander is a local rule-based summary panel; no backend, API keys, or OpenAI integration.

Success means the swarm reveals reachable space over time without crossing walls, discoveries persist and are shared, neural activity visibly responds to sensors, and reset reproduces the initial scenario.

## Data structures

All definitions are in `src/domain/types.ts`. Positions and dimensions use world units; heading uses radians; elapsed time uses seconds. A grid uses row-major index `row * columns + column`. Rectangular walls and debris will be solid obstacles.

| Structure | Main fields and purpose |
| --- | --- |
| Environment | ID, name, dimensions, obstacle rectangles, exploration grid, survivors, hazards, entry point. Ground-truth scene plus initial knowledge. |
| BioBug | ID, position, heading, radius, speed, behavior state, sensors, neural controller. Contract only in milestone 1. |
| Sensors | Normalized 0–1 obstacle signals (left/front/right), hazard, survivor cue, unexplored-direction signal. |
| NeuralController | Sensory, interneuron, and motor neurons with IDs, activation and bias; directed weighted synapses; left/right motor outputs. Planned activation range 0–1; weights may be signed. |
| Survivor | ID, position, undetected/possible/confirmed status, optional discovering bug ID. |
| Hazard | ID, position, influence radius, gas/heat/unstable category, normalized severity, discovery flag. |
| Swarm | Agent array, shared exploration grid, timestamped discovery records, elapsed simulation time. |

The neural controller is connectome-inspired. It does not reproduce an identified biological connectome. Future integration should make sharedExploration the canonical mission knowledge grid rather than maintain two independently mutable copies.

## Small milestones

1. **Environment scene — implemented.** React + TypeScript + Vite; responsive Canvas; walls, debris, seeded unexplored areas, one possible survivor, one gas hazard; legend and static scenario statistics. Inspection toggle reveals geometry without changing coverage. No agents or simulation loop.
2. **Single-agent movement.** Add fixed timestep, one BioBug, simple temporary motor commands, obstacle collision and world bounds. Verify no wall tunneling, including large frame delays.
3. **Sensing and exploration.** Add range-limited, occluded sensors, progressive grid revelation, and survivor/hazard detection. Begin with an unknown map except the deployment zone. Verify hidden entities remain hidden through walls.
4. **Neural control.** Implement sensory-to-interneuron-to-motor activation and differential steering. Add selected-agent panel and neural visualization. Verify a changed obstacle input changes motor outputs.
5. **Shared swarm exploration.** Add several agents, shared discoveries and frontier assignment with local separation. Compare coverage with independent agents using the same scenario and seed.
6. **Mission demo polish.** Pause/resume/reset, live statistics, local Rescue Commander summaries, responsive presentation and repeatable end-to-end demo. Test reset, selection and long-running stability.

## Milestone 1 limitations

The explored region and discovery markers are pre-seeded fixtures to demonstrate the visual language. No sensing, rescue confirmation, agent deployment, neural execution, or AI commander is implemented. The full-map toggle reveals hidden obstacles solely for inspection. All assets are local; no external fonts or services are required.

## Validation environment
Production build and browser rendering were verified. The Codex Windows sandbox blocks esbuild ancestor-directory access during development dependency optimization. If this affects your dev session, run npm run build followed by npm run preview to view the verified production app locally.

