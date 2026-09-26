# BioBug Rescue — three-minute judge demo

This is a software simulation. No physical insects or robotic rescue platform are deployed. Prepare the backend before presenting; do not spend presentation time downloading or loading MaleCNS.

## Startup and API key

From the project root, first-time frontend setup is `npm install`. Start with `npm run demo`; open the URL printed by Vite, normally http://127.0.0.1:5173.

In another PowerShell 7 terminal:

```powershell
cd backend
# First time only:
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.lock.txt
.\.venv\Scripts\python -m connectome.download
# Optional live AI, entered privately (never in frontend configuration):
$env:OPENAI_API_KEY = Read-Host 'OpenAI API key' -MaskInput
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
```

For an existing installation, skip creation, installation and download. On Unix use `.venv/bin/python` and your shell's private environment setup. The key applies to that terminal's backend process only. A page refresh does not configure a missing backend key.

For a production bundle run `npm run build` then `npm run preview -- --port 5173` from the root. Do not run dev and preview on the same port. `npm run demo` is a simple alias, not a multi-process manager.

## Preflight

1. Allow several minutes for backend loading; check the terminal says application startup complete.
2. Open Technical View. Wait for **MALECNS READY**. This comes from a validated `/connectome/status` response, not saved counts. Loading/unreachable states disable MaleCNS selection. Blocking backend startup cannot be distinguished from an absent server over HTTP; the UI says “unavailable / still starting” and retries every five seconds.
3. For AI, optionally inspect `http://127.0.0.1:8000/commander/status`. `configured: true` means a key exists, not that a request will succeed. Test Mission summary if a live request is wanted; this sends observed mission telemetry to OpenAI.
4. Press **RESET DEMO**. Verify four BioBugs, Rule-Based, coordinated, timer 0.0 s, zero discoveries and fog. Initial coverage is about 5.1% because the entry area is already visible.
5. Keep the browser foreground. Throttled/background frames or network waits can make simulated time slower than wall time. Use the mission timer for expected events.

## Exact presentation sequence

| Wall time budget | Action and narration |
| --- | --- |
| 0:00–0:15 | Opening screen: “Small simulated explorers map places conventional robots may struggle to reach.” Point out Simulation prototype. |
| 0:15–0:50 | Click DEPLOY SWARM once. Watch fog reveal and discovery notifications. Explain that agents share observations, not hidden positions. Both survivors should confirm by 25.75 simulated seconds. |
| 0:50–1:15 | Click Where are survivors? or Mission summary. Continue watching the map while AI works. Mention SYSTEM SUMMARY if offline. At 60 simulated seconds, coverage is 76.16%; pause near that time to discuss results. |
| 1:15–2:15 | Pause, open TECHNICAL VIEW, explain Environment sensors → Controller → Movement. If MALECNS READY, choose MALECNS and Resume mission. Scroll to telemetry: engineering stimulus → real topology → simulated DNa02 activity → engineering motor decoder. Switching preserves position and discoveries; this mixed run is not the recorded comparison experiment. |
| 2:15–2:45 | Pause. Show measured results, with no winner claim. Show WHAT IS REAL? and HOW IT WORKS. Structural anatomy is real; bodies, rescue signals and neural activity are simulated. |
| 2:45–3:00 | Open WHY BIOBUG? Discuss potential applications/users. Close with the human operator making decisions. RESET DEMO prepares the next judge. |

Controller changes are disabled while running. Presentation/Technical View toggles do not reset progress or change algorithms. Changing deployment size resets the mission; use RESET DEMO to restore the canonical four-agent configuration.

## Expected deterministic Rule-Based events

Four coordinated agents, seed 2026; measured in simulated seconds:

| Event | Time |
| --- | ---: |
| First gas hazard | 4.75 s |
| First possible life signal | 6.75 s |
| First survivor confirmed | 7.75 s |
| Both survivors confirmed | 25.75 s |
| At 60 s | 2 gas hazards detected; 76.16% coverage |

The actual event stream supplies notification sectors. Do not substitute scripted markers. Reports: `RESCUE_EXPERIMENT.json`. MaleCNS's separate recorded seed-2026 rescue completed at 37.50 s with 56.50% coverage at 60 s; the historical five-seed single-agent averages are 40.41% Rule-Based and 37.28% MaleCNS. These experiments have different scopes.

## Recovery

- **OpenAI unavailable:** keep presenting. SYSTEM SUMMARY is deterministic and remains visible. Quick actions may be retried after the short cooldown. Check key/network/backend after the demo. Never describe System Summary as live AI.
- **MaleCNS loading or absent:** show recorded structural evidence, explicitly marked recorded. Continue the live Rule-Based rescue. Do not claim recorded data indicates readiness. The selector enables only after a validated live status response.
- **MaleCNS disconnects during movement:** existing controller failure pauses motion visibly. Pause if necessary, choose Rule-Based in Technical View and Resume, or RESET DEMO. No silent controller substitution occurs. Resume with MaleCNS is disabled until readiness returns.
- **Accidental mode/view change:** view toggles preserve state; controller switching requires pause. RESET DEMO clears all mission/controller/Commander state and restores the canonical opening screen.
- **Page refresh:** returns to the same paused four-agent seed-2026 default; progress is not persisted. Deploy again. Backend and its environment are separate.
- **Frontend startup problem:** run `npm run build`, then `npm run preview -- --port 5173`. Follow Vite's printed URL if the port is occupied; backend CORS supports localhost ports 5173/5174/4173/4174.

## Verification / backup

Run `npm test`, `npm run build`, and backend `.\.venv\Scripts\python -m pytest -q`. Presentation tests compare a complete 60-second run to the untouched simulation engine, validate defaults/reset, exclude hidden locations, check offline AI/controller gates, and compare displayed evidence with original reports.

The offline backup is the working Rule-Based simulation, deterministic System Summary, and labeled recorded measurements. No fabricated screenshots, video, neural activity or AI responses are used.

## Optional 3D segment

After deployment, choose **3D RESCUE VIEW**. Use **FOLLOW BIOBUG**, select an insect from the roster, and **FOCUS SCENE** for a game-like close-up. Escape exits focus. Return to Presentation or Technical View to continue the same mission. The camera follows real simulation state; the insect model and building heights are illustrative. Terrain inspection does not reveal hidden survivors or hazards. If WebGL fails, the view provides the live 2D map.
