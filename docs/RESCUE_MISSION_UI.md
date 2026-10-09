# Guided rescue mission interface

Historical UI milestone: its abstract survivor reports were subsequently replaced in the unified rescue scene by [thermal observations](THERMAL_RESCUE.md). The earlier validation results below describe that previous state.

Implemented 3 October 2026. Open `http://127.0.0.1:5173/#virtual-lab`, choose Collapsed Building Rescue.

The mission opens with a three-step briefing: deploy, observe, review. Start/pause/resume, new mission and export are the main controls. The 3D environment sits beside observed findings and the selected insect's sensor readings. No hidden survivor or hazard totals appear in the main counters. A discovered location is not presented as an extracted person, a confidence score is not a medical probability, and an empty findings list does not imply the building is safe.

Mission settings contain team size, controller, coordination and appearance. Neural activity and AI assistance open on demand. The existing anatomical viewer still follows the selected agent's accepted samples; rule-based mode displays structure only. Research telemetry and the event log are collapsed. The assistant is mounted only when opened and does not issue requests merely because the mission starts.

Export findings downloads a JSON file from the existing allowlisted mission snapshot. This is a local report, not a message to an external rescue team. Browser verification produced a report at simulated time 95 seconds with two observed survivor reports and two hazard reports.

Scientific scope is explained beside the mission: the real MaleCNS tactile structural circuit supports an engineered controller with simulated dynamics. Rescue signals are separate distance/visibility-based software sensors. Biological smell, vision, physical flight, realistic rubble mechanics, uncertain communications and extraction were not added in this UI milestone. Manual steering/waypoints remain in the Supervised Insect Arena, not the swarm rescue view.

Files: `src/unified-lab/RescueLab.tsx`, `MissionFindings.tsx`, `mission.css`, `tests/mission_ui.cjs`, `package.json`. Existing controller, simulation, backend, anatomical renderer and other lab scenes are unchanged.

Validation: 133 frontend checks passed and production build passed. Three new checks exercise the findings component against actual deterministic mission observations, absence of hidden initial identities, separation of confirmation from extraction, read-only rendering, and the empty observation-only export. Browser checks exercised start/pause, actual discoveries, survivor detail inspection and report download.

Run locally from the project folder:

```powershell
npm run build
npm run preview -- --port 5173
```

The default rule-based rescue mission works without the Python backend. For neural mode, also run the existing backend from `backend/` using `.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000`.

Additional browser checks: the optional neuron panel loaded all 295 real skeletons in structure-only mode; layouts at 390 and 1280 px had no horizontal overflow.
