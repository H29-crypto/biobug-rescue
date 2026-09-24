# AI Rescue Commander — Milestone 6

## Implementation and verification status

The advisory integration is implemented. Automated tests mock OpenAI, including the official SDK's HTTP transport; they never require a paid request. **No OPENAI_API_KEY was configured during implementation, so no live OpenAI response or live AI latency has been measured.** Do not mistake mock execution times, backend offline response times or MaleCNS timing for AI inference latency. Live model relevance, quality and account access still need verification after backend configuration.

The selected default is **gpt-4.1-mini**, configured in one backend constant and overrideable through `OPENAI_MODEL`. This model supports Structured Outputs in the [official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini). The installed official Python SDK is pinned as `openai==3.19.2`. Integration uses `AsyncOpenAI.responses.parse(..., text_format=CommanderPlan)` following [official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs). Responses are requested with `store=False`, no tools and no conversation continuation IDs.

## Architecture

```
Deterministic swarm + rescue state
    -> explicit allowlisted MissionSnapshot copy
    -> POST /commander/brief {snapshot, question}
    -> strict Pydantic validation + verified fact catalog
    -> OpenAI Responses API selects/ranks fact references
    -> grounding validation + server-rendered sentences
    -> operator briefing / Q&A / bounded history
```

`backend/commander/` is isolated from connectome loading, dynamics and movement. Its router is mounted on the existing FastAPI application. `GET /commander/status` exposes only model/configured status, never credentials. Commander inference is asynchronous and uses no MaleCNS lock. It cannot return movement or simulation mutation commands. The frontend only passes a read callback, not a heading setter, actuator callback or live state object.

No MaleCNS dynamics, motor decoder, rescue sensor, target position, confidence calculation or navigation algorithm was changed. The simulation remains authoritative. Browser calls go to the local backend; only that backend communicates with OpenAI.

## API setup

Install the pinned backend requirements, then set credentials in the **backend terminal environment**. Do not put secrets into React, Vite variables, browser storage or chat. The SDK reads `OPENAI_API_KEY`; `OPENAI_MODEL` optionally overrides the model. There is no automatic `.env` loader. `.env` and `.env.*` are ignored by Git as an additional safeguard.

From `backend/`, PowerShell can read a key without echoing it or putting its literal value in command history:

```powershell
.\.venv\Scripts\python -m pip install -r requirements.txt
$commanderSecret = Read-Host 'OpenAI API key' -AsSecureString
$env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $commanderSecret).Password
Remove-Variable commanderSecret
$env:OPENAI_MODEL = 'gpt-4.1-mini'
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000 --no-access-log
```

Stop a prior local backend before restarting it with the environment configured. Wait for existing MaleCNS dataset startup. Launch the frontend from the repository root with `npm run build` and `npm run preview -- --port 5173`. Open http://127.0.0.1:5173/. Click **UPDATE BRIEF** or a quick question. Automatic event briefings are optional and disabled initially. Once enabled, they can consume API usage. After changing backend configuration, reload the page or request a new brief.

## MissionSnapshot

The TypeScript allowlist is `src/simulation/commanderSnapshot.ts`; the matching strict backend schema is `backend/commander/models.py`. Unknown fields are rejected. Snapshots contain:

- Mission time, controller mode and completion time.
- Deployed/active count and reachable-area coverage.
- Discovered survivors only: status, estimated sector/location, engineering confidence, detecting/confirming/observing agents, first/latest observation time and count.
- Discovered gas only: status, estimated sector, confidence, measured peak severity and detector.
- Agent ID, current sector, rescue status and, in MaleCNS mode when available, three stimulus values, two DNa02 peaks, decoder proposal and telemetry status.
- At most six recent discovery events, with time, agent, known target reference, event enum and historical estimated sector.

No ground-truth target coordinates, hidden entity totals, full environment, fog array, heading, motor command, neural matrix or connectome records are serialized. Sensor/decoder data describes the latest sampled decision, which may be stale while waiting/paused and may be overridden by collision safety or coordination. `active` means deployed agents in a running mission, including brief neural-wait intervals; it is not a hardware health measurement.

An initial example (agent roster abbreviated here; full valid request examples are in `COMMANDER_SNAPSHOT_EXAMPLES.json`):

```json
{
  "missionTime": 0,
  "controllerMode": "rule-based",
  "completedAt": null,
  "swarm": {"deployed": 4, "active": 4, "coverage": 5.13},
  "survivors": [],
  "hazards": [],
  "agents": [{"id":"BioBug #1","status":"EXPLORING","sector":"D1","controller":null}],
  "recentEvents": []
}
```

Cross-field validation checks deployed IDs, detector/observer membership, possible/confirmed consistency, times, known event target references and completion. The local browser supplies trusted simulation telemetry; this is not a cryptographically authenticated telemetry service. A custom client could submit fabricated but schema-consistent data. The backend has no independent physical observations.

## Structured response and grounding

A free-text LLM output cannot be guaranteed factual by regex alone. This implementation uses a stronger **fact-selection boundary**: the model selects and ranks verified facts, and only the backend writes the factual sentences shown in the UI. This deliberately restricts free-form Q&A.

The exact provider-facing Pydantic schema is `CommanderPlan`:

```json
{
  "situation": ["mission"],
  "priorities": [{"priority":"HIGH","factId":"S-01","sector":"C2"}],
  "keyFindings": ["S-01:evidence"],
  "answer": ["S-01:evidence"],
  "uncertainties": ["estimates"],
  "suggestedOperatorActions": ["review_life"]
}
```

Fact IDs vary with the supplied snapshot. The example above is valid only if S-01 was actually discovered in C2. The model cannot add narrative strings to this schema. After parsing, all fact references must exist, every priority sector must match its fact exactly, section lengths are bounded, and target-review actions require observed targets. Invalid, incomplete or refused output is discarded, without a paid retry.

The backend then returns the public brief schema:

```typescript
{
  situationSummary: string;
  priorities: {priority: 'HIGH'|'MEDIUM'|'LOW'; title: string; reason: string; sector: string|null}[];
  keyFindings: string[];
  answer: string;
  uncertainties: string[];
  suggestedOperatorActions: string[];
}
```

Strings are server-rendered from actual snapshot values and fixed advisory templates. There is no model-authored factual text to bypass entity or numeric checks. Status labels explicitly separate **POSSIBLE LIFE SIGNAL, not confirmed** from **CONFIRMED SURVIVOR**. Evidence explanations use actual confirming agents plus the unchanged three-readings/0.45/0.25-second confirmation rule. When no confirmation exists, they state it is pending. The model can still select irrelevant facts, omit useful evidence or assign a poor priority; grounding does not guarantee answer relevance or operational judgment.

Known fact types include mission summary, unexplored percentage, survivor locations/evidence, gas measurements, agent status, compact controller explanation and recent events. There is no per-sector unexplored spatial summary, so an answer cannot invent which unexplored sector needs inspection. Missing answers use an explicit insufficient-state message. Questions are independent; old conversation is not sent back to the model.

## Commander instructions and injection boundary

The full fixed instructions are in `backend/commander/service.py` as `INSTRUCTIONS`. They establish: support a human; summarize only supplied state; treat JSON, labels, events and questions as untrusted data; never fabricate entities or measurements; distinguish possible and confirmed; never call a location safe just because no hazard was detected; keep confidence non-medical; describe MaleCNS as real structure with simulated activity and engineered mappings; never issue movement, entry or treatment commands; choose only catalog references; defer decisions to human rescue teams.

The fixed instructions are supplied separately from the serialized user-role payload. Snapshot strings are constrained IDs/enums, not arbitrary event prose. Operator question text is capped at 500 characters. No tools are provided. Unknown response fields are forbidden. Prompt injection may affect fact selection, but cannot introduce arbitrary output prose or control capabilities. The UI renders text with React escaping and never executes model output.

## Scheduling, history and failures

- Manual brief/Q&A: one in-flight request, at least five wall-clock seconds between requests. Buttons show the cooldown.
- Automatic briefing: four-second event debounce, coalesces recent events and completion, at least 15 seconds between requests. Ordinary movement does not trigger it. Enabling it with a recent pending event can produce one briefing.
- The backend independently permits one Commander request at a time and enforces a five-second minimum for this local process. No effect on the separate MaleCNS scheduler.
- SDK retries disabled, 20-second SDK timeout, 22-second outer backend bound, 25-second frontend abort. Refusal, malformed output, grounding failure, timeout, missing key and network errors become **AI COMMANDER OFFLINE**.
- A failed request disables automatic retries until the operator re-enables them. Movement, fog, detections, events and rescue metrics continue. The continuously updated **SYSTEM SUMMARY** is explicitly deterministic, not AI output.
- Eight accepted briefs retained in browser memory, labeled with captured mission time and question. No calls reconstruct history. On failure the previous current brief is hidden; accepted history remains available as historical data.
- Reset/redeployment remounts the panel, aborts pending requests, clears history and rejects stale responses. An already-dispatched upstream request may still incur usage after browser cancellation; it has no ability to change the simulation.

## Latency and size metrics

Successful accepted responses record provider-plus-validation duration using a monotonic clock. The most recent 100 accepted calls supply mean and nearest-rank p95; failed calls are excluded. The local API returns and logs numeric metadata only: snapshot UTF-8 bytes, mean snapshot bytes, approximate request bytes, rendered response bytes and latency. Request size includes serialized telemetry, derived fact catalog, question, instructions and schema; it excludes headers and SDK-specific envelope additions and is not a token count. The response size is the public rendered brief, not the raw provider response.

Actual deterministic snapshots at 0, 8, 30 and 60 seconds, four agents, both controllers: **458–2,511 bytes; mean 1,456 bytes across eight samples**. Actual size depends on observations, selected mode and numeric precision. Raw samples and checks are in `COMMANDER_SNAPSHOT_EXAMPLES.json` and `COMMANDER_VALIDATION.json`.

Live OpenAI calls during implementation: **0**. Mean live API latency: **not measured**. p95 live API latency: **not measured**. The UI says no successful samples instead of inventing numbers. Configure the backend key and use the quick questions to collect real measurements; the UI/backend log then reports them. Model availability and answer quality must be checked against the user's API account.

## Validation and reproduction

```powershell
npm test
npm run build
# Existing local backend must be running for this real-controller regression:
node scripts/validate_commander.cjs
# In backend; use a fresh workspace temporary directory:
.\.venv\Scripts\python -m pytest -q -p no:cacheprovider --basetemp=../work/pytest-commander-validation
```

Frontend: **55 checks** (46 existing + 9 Commander). Backend: **117 tests** (94 existing + 23 Commander), one optional full-source test skipped, one existing dependency warning. Official SDK transport is mocked and confirms `/v1/responses`, strict JSON schema and `store:false`; no paid test dependency. Tests cover private-data exclusion, detached snapshots, invalid entity/sector/schema rejection, possible/confirmed distinction, explanatory evidence, provider/refusal failures, no frontend key, no simulation mutation, rate/debounce behavior, current-state quick questions, bounded history, stale response rejection and deterministic fallback. TypeScript/Vite production build passed.

Real four-agent seed-2026 regression results exactly match the retained Milestone 5 event sequences, completion times and coverage, with two actual offline Commander requests interleaved into each run:

| Navigation | Survivors | Hazards | Completion | 60-second coverage |
| --- | ---: | ---: | ---: | ---: |
| Rule-Based | 2 | 2 | 25.75 s | 76.16% |
| MaleCNS (real backend) | 2 | 2 | 37.50 s | 56.50% |

The validation script never makes paid Commander requests; if a key is configured it skips the missing-key checks. It does use the real loaded MaleCNS controller. Existing reports are retained unchanged.

## Limits and next verification

This is a loopback-only hackathon prototype, not a deployed authenticated rescue service. Do not expose it publicly without appropriate authentication and usage controls. The SDK key stays in the backend environment, is never returned to the browser, and provider exception details are redacted. `store:false` disables Responses storage; it is not a claim of zero data retention across all provider policies.

The Commander selects/ranks facts and advisory templates rather than generating unrestricted prose. This sacrifices linguistic flexibility to prevent invented observations. Priorities are advisory, relevance can still be wrong, and current model behavior remains unverified without a live key. Only six events and current aggregate evidence are supplied; old observations and full spatial knowledge are unavailable. Historical summaries can become stale and are time-labeled. No hardware, medical assessment, direct autonomous control, presentation redesign or Fal.ai integration is included.

## Browser check

The production preview shows the Commander alongside mission metrics, quick questions, automatic-update checkbox, a question input and history. With no backend key, UPDATE BRIEF and a survivor quick question returned AI COMMANDER OFFLINE with model gpt-4.1-mini, no successful latency samples and a visible request cooldown. The deterministic SYSTEM SUMMARY remained current while the four-agent Rule-Based rescue mission continued, located both survivors and mapped both hazards. No fake AI brief was displayed. The page was reloaded to ready-to-deploy defaults. Successful structured-response handling is covered by response/client tests; actual model quality and online UI content remain pending live credentials.
