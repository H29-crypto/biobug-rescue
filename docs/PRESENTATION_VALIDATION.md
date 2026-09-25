# Milestone 7 validation

Validated 2026-09-25. Presentation polish only; existing movement, sensing, coordination, neural dynamics and backend modules are unchanged.

- `npm test`: **64 checks passed** (55 existing + 9 presentation).
- `npm run build`: **passed**, TypeScript and Vite production bundle; final JS 316.56 kB / gzip 99.54 kB.
- Backend: **119 passed, 1 optional integration test skipped**, one existing Starlette/AnyIO deprecation warning.
- Backend command in this sandbox: `.\.venv\Scripts\python -m pytest -q -p no:cacheprovider --basetemp=../work/pytest-m7-20260925`. The first standard invocation had 23 setup errors due solely to denied access to the pre-existing system pytest temp directory; a fresh workspace temp directory resolved them without code changes. Use a fresh path for subsequent sandbox runs.
- `git diff --check`: passed.

## Browser checks

The local production app at http://127.0.0.1:5173 was opened and exercised:

- Opening state: four agents, Rule-Based, coordinated, seed 2026, timer zero, no discoveries, 5.1% entry coverage.
- Deploy: live movement, map exploration, detected markers and notifications; both survivors confirmed at 25.75 simulated seconds.
- Technical View: actual live dataset counts and ready state; recorded comparison values render correctly.
- Pause → MaleCNS → Resume: actual 295-neuron / 280-edge / 2,308-contact response and changing DNa02 readouts; switches and deployment controls disabled while running.
- Reset after MaleCNS activity: restores canonical Presentation Mode, no discoveries, empty briefing history and paused Rule-Based deployment.
- Page reload: same default state.
- Desktop (1440 px) and mobile (390 px) viewport checks: no horizontal document overflow; responsive map/sidebar layout.

Offline AI, invalid/unloaded MaleCNS status, switching gates, hidden-target exclusion, evidence provenance, and complete 60-second simulation equivalence are covered by automated tests. This milestone did not repeat paid live AI calls or rerun the large recorded controller experiments; their existing reports remain explicitly labeled recorded evidence. The live backend was already running during browser checks.

## Changed files

- `src/App.tsx`: Presentation/Technical View shell, scorecard, deployment/reset, discoveries, readiness and guarded controls.
- `src/presentation.css`: responsive presentation layout, stable notification area and compact Commander.
- `src/components/JudgeContext.tsx`: measured comparisons, real/simulated distinction, architecture and potential applications.
- `src/components/CommanderPanel.tsx`: compact mode, four quick actions, explicit analyzing state; existing client/fallback retained.
- `src/components/ControllerPanel.tsx`: clear stimulus/readout/movement labels and collapsed diagnostic details.
- `src/hooks/useSimulation.ts`: canonical demo initialization and reset callback, using the existing swarm factory.
- `src/hooks/useReadiness.ts`: bounded status polling, cancellation and explicit unavailable state.
- `src/simulation/presentation.ts`: presentation helpers and canonical defaults; no physics or controller logic.
- `src/presentation/evidence.json`: compact report projection, without target positions; checked against original sources.
- `tests/presentation.cjs`: nine behavioral and rendered-component checks.
- `package.json`: demo alias and presentation test command.
- `README.md`, `docs/DEMO.md`, `docs/PRESENTATION_VALIDATION.md`: judge guide, exact demo/recovery sequence and validation record.
