# MaleCNS experimental neural dynamics — Milestone 3C

This is a deterministic engineering rate model on a bounded graph derived from **real MaleCNS v1.0** structural connectivity. It is not a biological fly-brain simulation. No BioBug sensor, movement, motor decoder, training, swarm, survivor/hazard detection or OpenAI integration is added. Existing BioBug control remains rule-based.

## What is real and what is simulated

| REAL MaleCNS data | ENGINEERING MODEL |
| --- | --- |
| Body IDs, exact annotations, rootSide/somaSide, directed edges and integer synaptic contact counts | Graph extraction bound, route roles, normalization, assumed transmitter signs, injected signals, gain/decay, nonlinear clipping and activity values |
| Body-level predicted NT, confidence and consensus NT | Confidence threshold and interpretation as an excitatory/inhibitory effect |
| DNa02 body/type/soma-side identities | Separate DNa02 activity readouts; no interpretation as turn commands |

Data source: [official MaleCNS download](https://male-cns.janelia.org/download/), v1.0, CC BY 4.0. Berg et al. (2026), *Sexual dimorphism in the complete Drosophila male central nervous system connectome*, Cell, [doi:10.1016/j.cell.2026.08.015](https://doi.org/10.1016/j.cell.2026.08.015). The full file provenance, hashes and selection rule remain in [MALECNS.md](MALECNS.md). Population evidence is in [MALECNS_PATHWAYS.md](MALECNS_PATHWAYS.md). Derived models retain attribution and do not replace the source data.

## Actual dynamics graph

The graph is the union of every directed ProLN-tactile→DNa02 route of length 1 through the chosen hop bound. Source cells are selected by `class=mechanosensory_tactile AND entryNerve=ProLN`; targets by `type=DNa02 AND superclass=descending_neuron`. No IDs are hand-selected. All selected ProLN inputs and both targets are retained, including input cells with no route within the bound. Intermediates retain their actual annotations, including ascending/descending types; route roles are analytical roles, not renamed biological classes.

| Measurement | Default two-hop graph | Optional three-hop offline graph |
| --- | ---: | ---: |
| Neurons | 295 | 2,931 |
| Directed structural edges | 280 | 36,253 |
| Synaptic contacts | 2,308 | 219,606 |
| ProLN inputs | 266 | 266 |
| Inputs with outgoing route edges | 146 | 266 |
| Intermediates | 27 | 2663 |
| DNa02 targets | 2 | 2 |
| Structural arrays/Arrow bytes | 111,860 | 1,552,586 |
| Measured extraction seconds after full load | 1.065401 | 4.147100 |

The 295-node default graph has 120 route-isolated sensory inputs. Those cells can receive simulated input and contribute to the active-neuron count without influencing either target in this graph. The graph includes the full 280-edge route set, **not** the 24/32-node visualization sample from Milestone 3B. It is a route-union graph rather than an induced subgraph. Hard safety bounds are 5,000 neurons and 100,000 edges; oversize extractions fail explicitly instead of silently dropping edges. Three-hop expansion is CLI-only.

Each bounded CSR is a copy with read-only data, index, pointer and ID arrays. Arrow annotations are retained unchanged. A SHA-256 fingerprint of IDs, CSR and serialized annotations is checked before and after each experiment. The full parent graph is read only by this layer and its write flags are untouched. Simulation weights are a separate floating-point CSR; raw structural counts are never overwritten or signed.

Two-hop structural fingerprint: `fda9df339350f4420439a90556330275d5ac4cb127a411c3d2e3f74cc2527c6c`.
Three-hop structural fingerprint: `0ebd60931f52a25d72552c408b47f0a0c002d8435f16ad7ff9f7b3d44b9218b7`.

## Weight transformation

Let C[i,j] be the original positive integer contact count from presynaptic neuron i to postsynaptic neuron j. Define B[i,j] = log(1 + C[i,j]) for existing edges only. Absent edges remain absent. Two engineering choices are available:

```text
incoming_log (default):
  Z[j] = max(1, sum_i B[i,j])
  W[i,j] = assumed_sign[i] * B[i,j] / Z[j]

global_log:
  Zglobal = max(1, max_j sum_i B[i,j])
  W[i,j] = assumed_sign[i] * B[i,j] / Zglobal
```

Normalization uses the selected bounded graph and is performed before the sign/fallback multiplier. Removing an edge effect via a zero sign does not cause renormalization of the remaining effects. Each postsynaptic column has absolute simulation-weight sum at most 1. This is a numerical design constraint, not synaptic efficacy. A 100-contact edge is not assumed to have 100 times the physiological effect of a one-contact edge.

Both values are accessible: `DynamicsGraph.structural.adjacency` stores immutable integer contacts; `DynamicsEngine.simulation_weights(parameters)` returns the separate engineering matrix. Responses include up to 20 edge examples with `structural_contact_count` and `simulation_weight`, and the frontend labels them separately. The examples are not the complete matrix.

## Transmitter handling

Unsigned baseline is the default: all presynaptic signs are +1, explicitly ignoring transmitter effect. The optional `predicted` mode applies the following engineering policy:

| Condition on actual metadata | Assumed model sign |
| --- | ---: |
| consensus_nt = predicted_nt = acetylcholine; finite predicted_nt_confidence ≥ 0.8 | +1 |
| consensus_nt = predicted_nt = gaba; finite predicted_nt_confidence ≥ 0.8 | −1 |
| Glutamate, modulators, unclear/missing NT, disagreement, missing/low confidence | Explicit fallback: 0 by default |

The threshold is configurable. `unknown_sign=positive` provides an alternative +1 fallback for sensitivity experiments; this is explicitly an assumption and does not relabel unknown neurons as biologically excitatory. `unknown_sign=zero` disables outgoing **simulation** effects for these cells while keeping their structural edges/counts and allowing them to receive activity. Ground-truth/type-level fields are not treated as direct physiological validation of an individual connection.

[Lacin et al., eLife 2019](https://elifesciences.org/articles/43701) examines transmitter identity and notes that glutamate can act with different signs in different neuronal contexts. [Davis et al., eLife 2020](https://elifesciences.org/articles/50901) explicitly discusses receptor-dependent glutamatergic effects. These resources motivate caution; they do not validate our model signs. The loaded annotation table has no postsynaptic receptor-specific effect assignment. Even ACh/GABA sign choices and a confidence cutoff remain engineering assumptions, not inferred physiological constants.

The default graph has consensus labels **280 acetylcholine, 8 gaba, 2 glutamate, 5 unclear**. Body predictions differ: **241 acetylcholine, 8 gaba, 1 glutamate, 3 octopamine, 42 unclear**. Applying the conservative rule yields **230 positive, 8 negative, 57 fallback-zero neurons**. These are whole-graph neuron counts, not counts of functional outgoing edges. The UI shows body prediction/confidence separately from consensus.

## Activity equation and parameters

Rows are presynaptic, so incoming activity uses the transpose of the simulation matrix:

```text
a[0] = 0
a[t+1] = clip((1-decay)*a[t] + gain*(W.T @ a[t]) + input_gain*I[t], 0, 1)
```

All state is freshly allocated per experiment. There is no noise, random seed, persistence from previous experiments or baseline spontaneous drive. The time unit is an abstract step; rates here are dimensionless activity in [0,1], not Hz. Clipping is the bounded nonlinearity, not a measured firing response.

| Parameter | Default | Bounds/meaning |
| --- | ---: | --- |
| decay | 0.25 | 0 < decay ≤ 1; dimensionless per-step leakage |
| gain | 0.20 | 0 ≤ gain < decay; recurrent/input network multiplier |
| input_gain | 0.50 | 0..1; external injection multiplier |
| transformation | incoming_log | Incoming- or global-normalized log contacts |
| sign_mode | unsigned | Optional predicted mode described above |
| unknown_sign | zero | Predicted mode fallback; optional positive |
| nt_confidence_threshold | 0.80 | 0..1; agreeing body/consensus threshold |
| API/UI steps | 10 | 1..200, integers only |
| CLI comparison steps | 20 | Recorded comparisons below |
| pulse_steps | 3 | 0..200; pulse capped by actual run duration |
| injection_enabled | true | False makes the injected vector exactly zero |
| top_k | 8 | 1..20; compact per-step summaries |
| active threshold | 1e-9 | Engineering reporting threshold, not a spike |

Finite parameter validation and clipping bound every activity component. Since ||W.T||∞ ≤ 1 and gain < decay, the unforced update is contractive with factor ≤ 1 − decay + gain < 1, even with signed weights or cycles. The default upper bound is 0.95. Therefore an unforced state decays and a zero initial state with zero stimulus stays exactly zero. This is numerical stability, not a biological stability claim.

## Input injection, laterality and timing

For each annotated ProLN cell, rootSide L receives `min(1, left + 0.5*front)` and rootSide R receives `min(1, right + 0.5*front)`. Unknown/missing side receives zero; a soma label is never substituted for a sensory root label. There are 151 L and 115 R ProLN cells. Equal per-cell drive means unequal group totals; no hidden balancing is applied. This asymmetry may influence model results.

All signals and the 0.5 bilateral front split are **ENGINEERING MAPPINGS**. Ray distance is not biological touch. The actual moving BioBug sensors are not read by this API/UI. The pulse is injected on transitions 0→1 through pulse_steps−1→pulse_steps, then is zero. Step 0 is resting state; with a two-edge route and no direct sensory→DNa02 edge, source activity first appears at step 1, intermediary activity at step 2, and DNa02 at step 3.

**DNa02-L = body 523769, somaSide L; DNa02-R = body 10360, somaSide R.** The IDs are discovered from actual type/superclass/side records and exactly one target of each soma side is required. Sensory rootSide and descending somaSide are different anatomy. Both sensory sides can reach both targets; no turn-left/right decoder or biological avoidance reflex is asserted.

## Measured preset comparisons

All tables below were generated from the real dataset: 20 updates, resting step 0, a three-update pulse, incoming_log, decay 0.25, gain 0.20, input_gain 0.50. Every preset was repeated and traces/summaries matched exactly. Cumulative activity is the discrete sum across all samples (arbitrary activity-step units). It is not probability, distance, spikes or a biological time integral.

| Preset | left | front | right |
| --- | ---: | ---: | ---: |
| LEFT | 1 | 0 | 0 |
| RIGHT | 0 | 0 | 1 |
| FRONT | 0 | 1 | 0 |
| SYMMETRIC | 1 | 0 | 1 |
| NONE | 0 | 0 | 0 |

### Two-hop unsigned model

| Preset | L peak | R peak | L cumulative | R cumulative | Peak active neurons | Dominant intermediate types (cumulative activity) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| LEFT STIMULUS | 0.20140739 | 0.07383368 | 2.33046311 | 0.85432150 | 171 | IN03A084 7.057169; AN06B015 4.168078; DNg34 4.168078 |
| RIGHT STIMULUS | 0.05750345 | 0.18193383 | 0.66536617 | 2.10513666 | 131 | AN03A008 4.810651; AN03B094 4.168078; AN06A015 4.168078 |
| FRONT STIMULUS | 0.14454888 | 0.14279397 | 1.66713865 | 1.64689861 | 295 | IN03A084 5.546160; AN03A008 4.648346; DNg34 4.648346 |
| SYMMETRIC STIMULUS | 0.25891084 | 0.25576751 | 2.99582928 | 2.95945816 | 295 | IN03A084 9.946260; AN03A008 8.336155; DNg34 8.336155 |
| NO STIMULUS | 0.00000000 | 0.00000000 | 0.00000000 | 0.00000000 | 0 | None |

### Two-hop predicted model

| Preset | L peak | R peak | L cumulative | R cumulative | Peak active neurons | Dominant intermediate types (cumulative activity) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| LEFT STIMULUS | 0.01787570 | 0.03823578 | 0.20683783 | 0.44242201 | 171 | IN03A084 7.057169; AN06B015 4.168078; DNg34 4.168078 |
| RIGHT STIMULUS | 0.00000000 | 0.05502220 | 0.00000000 | 0.63665595 | 129 | AN03A008 4.444570; AN03B094 4.168078; AN06A015 4.168078 |
| FRONT STIMULUS | 0.00627910 | 0.05206555 | 0.07241934 | 0.60049235 | 295 | IN03A084 5.546160; DNg34 4.648346; AN03B094 4.648346 |
| SYMMETRIC STIMULUS | 0.01124691 | 0.09325798 | 0.13013673 | 1.07907796 | 295 | IN03A084 9.946260; DNg34 8.336155; AN03B094 8.336155 |
| NO STIMULUS | 0.00000000 | 0.00000000 | 0.00000000 | 0.00000000 | 0 | None |

Type activity is summed across neurons; a multi-cell type can outrank a single-cell type because of population size. Equal or nearly equal cumulative values can produce near-ties in the displayed ordering. Individual top-neuron IDs, type/class aggregates and explicit side-field groups are included at every step in the JSON traces. Missing classes are labeled missing, not invented.

### Optional offline three-hop results

| Mode / preset | L peak | R peak | L cumulative | R cumulative | Peak active |
| --- | ---: | ---: | ---: | ---: | ---: |
| unsigned / LEFT STIMULUS | 0.13312655 | 0.09525642 | 1.44872181 | 1.02884322 | 2347 |
| unsigned / RIGHT STIMULUS | 0.07505470 | 0.12065846 | 0.76470186 | 1.25003384 | 1987 |
| unsigned / FRONT STIMULUS | 0.13457767 | 0.14130007 | 1.39974560 | 1.45379441 | 2931 |
| unsigned / SYMMETRIC STIMULUS | 0.20689649 | 0.21517266 | 2.21320987 | 2.27853335 | 2931 |
| unsigned / NO STIMULUS | 0.00000000 | 0.00000000 | 0.00000000 | 0.00000000 | 0 |
| predicted / LEFT STIMULUS | 0.02084542 | 0.01316884 | 0.23415715 | 0.14441355 | 2011 |
| predicted / RIGHT STIMULUS | 0.01177803 | 0.02491144 | 0.12997957 | 0.26797122 | 1640 |
| predicted / FRONT STIMULUS | 0.02098087 | 0.02545918 | 0.22880281 | 0.26863940 | 2600 |
| predicted / SYMMETRIC STIMULUS | 0.03192936 | 0.03787196 | 0.35714464 | 0.41122924 | 2601 |
| predicted / NO STIMULUS | 0.00000000 | 0.00000000 | 0.00000000 | 0.00000000 | 0 |

### Unexpected and model-dependent findings

- In the unsigned two-hop baseline, left input produces a larger left DNa02 peak and right input a larger right peak. This is a result of this model, graph and encoding, not proof of a steering command.
- Conservative predicted signs substantially change the result: left input has L peak 0.01787570 and R peak 0.03823578; right input leaves L at zero. Inhibition, gated uncertain outputs, clipping and the engineering normalization all contribute. This sensitivity prevents interpreting an unsigned structural asymmetry as robust physiology.
- AN03A008 was strongest by structural contact support in Milestone 3B, but it is not the dominant activated type in every experiment. IN03A084 leads left/front/symmetric runs by summed cumulative activity. Structural support and simulated activity are different measurements.
- DNg34, a descending type, can be an intermediate route node. Some annotated intermediates have unclear or disagreeing transmitter information; assumed signs must not be hidden.
- FRONT and SYMMETRIC differ because front is split by 0.5 per side. Their responses are not exactly a factor of two: clipping makes the source dynamics nonlinear.
- Three-hop expansion changes normalization denominators as well as connectivity. Its outputs need not grow and must not be treated as a controlled experiment adding edges while holding all simulation weights fixed.
- NO STIMULUS is exactly zero in both graph sizes and both sign modes. Inputs can be active even when their structural routes do not reach DNa02 within two hops.

## Performance and memory

Two-hop source load/checksum verification: **103.022 s**. Extraction after load: **1.065 s**. Core matrix-update time across the ten recorded experiments averaged **0.0942 ms/step**, range **0.0670–0.1467 ms/step**. JSON/aggregation work is timed separately.

Two-hop structural arrays and Arrow annotations use **111,860 bytes** (109.24 KiB); the separate simulation CSR uses **4,544 bytes**; one state vector **2,360 bytes**. The reported numeric working arrays are **18,584 bytes**, excluding Python metadata, JSON and temporary allocations. The process still retains the full source connectome: measured end-of-run RSS **534.78 MiB**. This is not peak memory.

Three-hop structural arrays/annotations: **1,552,586 bytes**; extraction **4.147 s**; average core step **0.4531 ms**; end RSS **565.09 MiB**.

Loopback HTTP benchmark, 20 steps: first request including cold extraction **1342.55 ms**. Nine warm requests: median **77.12 ms**, range **27.28–154.33 ms**. Serialized response bodies were **38,354–138,264 bytes**. Every API trace and summary matched its offline CLI reference exactly. Handler time excludes JSON encoding/network; HTTP wall time includes both.

The full dataset load and first extraction dominate startup. For repeated experiments, response aggregation/serialization costs more than the small sparse update. No request occurs per BioBug frame: the lab makes one request, then plays back its compact trace locally. The API uses one process-local immutable dynamics graph and serializes expensive work with the existing lock. Three-hop offline reporting uses more metadata and is not optimized for high-frequency interaction.

## API, CLI and UI

Run from `backend/` with the existing virtual environment:

```powershell
.\.venv\Scripts\python -m uvicorn connectome.api:app --host 127.0.0.1 --port 8000
.\.venv\Scripts\python -m connectome.dynamics_experiment --report ../docs/MALECNS_DYNAMICS_EXPERIMENTS.json
.\.venv\Scripts\python -m connectome.dynamics_experiment --hops 3 --report ../docs/MALECNS_DYNAMICS_3HOP.json
```

POST `/connectome/simulate`:

```json
{
  "stimulus": {
    "left": 0.8,
    "right": 0.2,
    "front": 0.6
  },
  "steps": 10,
  "pulse_steps": 3,
  "injection_enabled": true,
  "parameters": {
    "transformation": "incoming_log",
    "sign_mode": "unsigned",
    "decay": 0.25,
    "gain": 0.2,
    "input_gain": 0.5,
    "unknown_sign": "zero",
    "nt_confidence_threshold": 0.8
  }
}
```

The API enforces two-hop extraction, bounded requests, explicit parameters and independent resting state. It returns graph counts/fingerprint, engineering rules/parameters, DNa02 readouts, per-step top-k/aggregates, weight examples and performance. It never sends the 25-million-edge source graph to React. Invalid/unknown parameters and non-finite inputs are rejected; unavailable source data returns 503.

Run `npm run dev` from the project root (or `npm run build` then `npm run preview`). Open the **MaleCNS pathway explorer**, then **Neural dynamics lab**. Choose a preset or manual slider values, run, and use play/pause or the step slider. Mint is DNa02 somaSide L and amber dashed is R. Charts auto-scale their y-axis with numeric ticks. The structural viewer and original one-bug simulation remain independent.

## Validation and artifacts

- 83 backend fixture tests passed, including 33 new dynamics checks. One optional full-data pytest case remains skipped by default; actual real-data CLI runs on both graph sizes and live API comparisons were performed separately.
- Tests cover route extraction, exact preserved contacts/annotations, read-only arrays/fingerprints, explicit side selection, temporal propagation, no/disabled/zero-duration stimulus, strong inputs over 200 steps, finiteness/bounds, determinism, normalization, unknown/conflicting/low-confidence NT handling, inhibition, validation, stateless API calls and POST CORS.
- All nine existing frontend simulation checks passed, including collision safety, deterministic frame rates, pause/reset and ten-minute exploration. Production TypeScript/Vite build passed.
- During the final restricted-session restart, `npm run dev` hit a filesystem access denial in dependency prebundling. The built application was successfully served and checked with `npm run preview -- --port 5173`; the backend also restarted successfully. This development-server restriction is separate from the passing production build.
- Browser checks verified real 295/280/2308 graph counts, activity playback, explicit body-versus-consensus NT labels, left-input unsigned and right-input predicted-sign results, and zero-input display. BioBug continued exploring while an experiment ran, then Pause/Reset restored its independent mission state.
- [Two-hop measured experiments](MALECNS_DYNAMICS_EXPERIMENTS.json), [three-hop measured experiments](MALECNS_DYNAMICS_3HOP.json), [HTTP measurements](MALECNS_DYNAMICS_API_BENCHMARK.json). Raw data remains ignored by Git; these reports are derived experiment results.

## Scientific limitations

The real connectome supplies anatomical structure and imperfect annotations, not membrane equations, receptor-specific signs, synaptic efficacy, delays, cell-state dynamics, mechanoreceptor transduction, muscle action or environmental behavior. Our induced activity, normalization, pulse encoding, leakage, gain, clipping, fallback rules and time units are engineering choices. The route graph omits most circuitry and selects around a desired target; input population imbalance and unknown signs can dominate results. Zero fallback is a modeling restriction, not evidence that the real cell has no effect. Rate values do not demonstrate turning, locomotion or accurate fly behavior. No parameters were fitted or trained. BioBug control requires a separately authorized milestone and is not implemented here.
