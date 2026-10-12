# Coordinated exploration: an exploratory software study

Recorded 12 October 2026. This study compares two frontier assignment policies in the same existing BioBug movement and sensing engine. It does not compare neural controllers, claim biological realism, or validate a rescue device. All measurements are simulation outputs.

## Question and implementation

Can a team observe more reachable floor when it chooses frontiers by predicted information gain and travel cost, rather than proximity alone?

The baseline is the existing coordinated nearest-frontier planner. The experimental planner uses only a navigation adapter containing observed cells, their free/occupied classification, traversable observed edges and agent starting cells. Its policy function receives neither hidden targets nor the world geometry. Offline ground truth is used to generate reachable scenarios and calculate coverage, not to score frontier utility.

For each reachable frontier, an optimistic sensing footprint includes unknown cell centers within the existing 75-world-unit exploration radius. Known occupied cells block footprint rays; unknown cells do not. This is an unknown-cell count, not Bayesian entropy or a calibrated sensor visibility estimate. Breadth-first search supplies known-grid path length. For agent *i* and frontier *f*:

`utility(i, f) = unclaimed_unknown_cells(f) / (1 + known_path_length(i, f) / 75)`

Agents are allocated sequentially with rotating priority. Each assigned footprint reduces the marginal gain offered to subsequent agents; frontier destinations are reserved. Ties break deterministically by distance then cell index. The policy is an independent heuristic inspired by information-aware exploration; it is not a reproduction of coExplore's assignment solver. Local steering, collision rules, sensing and coordination cadence remain common to both policies.

Implementation: [informationPlanner.ts](../src/simulation/informationPlanner.ts), [scenario generator](../src/scenarios/research.ts), [trial runner and statistics](../src/simulation/researchExperiment.ts).

## Frozen protocol

The scenario/seed/duration protocol was fixed before the first complete suite; no seeds or unfinished runs were removed after viewing the results. The suite was designed with the implementation and is **exploratory, not held-out validation**.

| Parameter | Value |
| --- | --- |
| Scenario families | Residential collapse; warehouse rubble; narrow passages |
| Seeds per family | 17, 42, 101, 2026, 9001 |
| Policies | Coordinated nearest frontier; marginal-information frontier |
| Team, duration | 4 agents; 60 simulated seconds |
| Physics / recording | 60 Hz fixed steps; 1 Hz observation frames |
| Total | 30 runs, 15 matched scenario/seed pairs |
| Local controller | Rule-based in both arms |
| Primary outcome | Percentage of reachable grid cells observed at 60 seconds |
| Interval | 4,000 percentile-bootstrap resamples, PRNG seed 2026 |

World dimensions are 800 × 560 simulation units. A sealed perimeter excludes outside-floor exploration. Seeds vary debris, doorway positions where applicable, and hidden target placement. Scenario generation uses a separate deterministic PRNG from controller randomness. Each world has two reachable model life targets and two gas sources, separated from the entry and from one another. These abstract channels are inherited from the legacy rescue engine; the newer thermal mission has different observation semantics and is not part of this benchmark.

For each scenario, the interval resamples the five paired differences. The pooled interval resamples **five seed blocks**, each containing all three scenario differences; it does not treat the 15 pairs as independently sampled worlds. An interval from five blocks has limited resolution and does not represent field reliability. This is an equally weighted mean over the chosen families, not a population estimate over collapsed buildings.

## Recorded results

| Environment | Nearest coverage | Information coverage | Difference, percentage points | 95% interval | Completed A / B |
| --- | ---: | ---: | ---: | --- | --- |
| Residential | 84.83% | 95.61% | +10.78 | [3.73, 18.46] | 2/5 · 5/5 |
| Warehouse | 93.11% | 99.84% | +6.73 | [3.34, 10.15] | 4/5 · 5/5 |
| Narrow passages | 23.03% | 26.77% | +3.73 | [1.16, 7.76] | 0/5 · 0/5 |
| Pooled | 66.99% | 74.07% | **+7.08** | [6.02, 8.40] | 6/15 · 10/15 |

The information policy had higher final coverage in all 15 recorded pairs. Both methods remained poor in narrow passages. “Completed” means both model life targets received the engine's required repeated strong readings; it does not mean full map coverage, verified people, or physical extraction. Unfinished completion times remain `null` in JSON and blank in CSV, rather than being discarded or treated as 60-second successes.

Secondary diagnostics include time-averaged coverage (1 Hz trapezoidal area divided by duration), distance in world units, peer-block counts, and cross-agent observed-map overlap `1 − union(personal_observed_cells) / sum(personal_observed_cells)`. Overlap includes common starting observations; it is not a communication-cost or path-efficiency estimate. Trajectory digests are non-cryptographic FNV summaries of positions/headings quantized to 10⁻⁶, useful for replay parity rather than file authenticity.

Machine-readable evidence: [all 30 CSV rows](RESEARCH_BENCHMARK.csv), [JSON protocol, source SHA-256 hashes, summaries and results](../src/research/benchmark.json). Source hashes identify the measured working-tree files; `sourceBaseCommit` is their pre-change base, not a claim that that commit already contained this implementation.

## Reproduction

```sh
npm ci
npm test
npm run benchmark:research
```

The benchmark writes `work/research/benchmark.json` and `.csv`. Add `-- --publish` to deliberately replace the checked-in report; `-- --quick` runs a five-second smoke suite and cannot publish. Runtime and generation timestamp can differ while measured trajectories and metrics match. To regenerate the architectural home illustration, run `node scripts/render_field_atlas.cjs`; it exports sampled routes and terrain, without hidden targets.

In the app, open **Research & evidence**, choose a configuration, and select **Run comparison**. Both arms execute in a Web Worker. Pause freezes the experiment, the slider replays received frames, and reset terminates the previous worker. Completed runs export CSV and replay JSON. A configuration change starts fresh. Exported replays contain observations and results, not hidden target positions.

The browser and CLI 60-second residential/2026 trial were checked for identical metrics and trajectory digests: baseline `9d201260`, information `859897ae`. Their final coverage was 80.38585209% and 90.67524116%, respectively. The automated suite additionally verifies chunk-size invariance, worker pause/resume/cancellation, route validity, collision constraints, target secrecy and refusal of incomplete statistical pairs.

## Literature and what it supports

| Source | Relevance to this implementation | Boundary |
| --- | --- | --- |
| Scheler & Dietrich, [coExplore](https://arxiv.org/abs/2303.17459), 2023 | Frontier information and path cost motivate the explicit score. | Different assignment algorithm; no paper result reused. |
| Gao et al., [Meeting-Merging-Mission](https://arxiv.org/abs/2109.07764), 2021/2022 | Communication limits and duplication motivate stating map-sharing assumptions and reporting overlap. | This study assumes instantaneous shared maps; rendezvous is not implemented. |
| Bai et al., [cyborg-insect swarm navigation](https://pubmed.ncbi.nlm.nih.gov/39762294/), 2025 | Physical swarm experiments motivate evaluating obstruction and variable environments. | External cockroach hardware; no such hardware is built here. |
| Ariyanto et al., [feedback-controlled cyborg navigation](https://pubmed.ncbi.nlm.nih.gov/38449606/), 2024 | Sensor feedback and thermopile sensing motivate separating observation from operator interpretation. | Our deterministic signals do not reproduce their sensors or classifier. |
| Cole, Bozkurt & Lobaton, [inertial localization](https://pubmed.ncbi.nlm.nih.gov/32796611/), 2020 | Localization research exposes perfect pose as a major assumption to challenge next. | No inertial odometry or transferred accuracy claim. |

The linked papers were checked on arXiv and PubMed on 12 October 2026. The in-app bibliography also records a finding, implementation connection and limitation for each source. Machine-readable references: [research.bib](research.bib).

## Limits and next experiments

The study has only three synthetic map families and five seed blocks. Motion, exact pose, uniform sensing radius and immediate map sharing are engineering assumptions. Heuristics can stall or allocate poorly; there is no completeness guarantee. Sensor confirmation rules are not human detection. No new live MaleCNS evaluation, hardware trial, API latency trial or human-subject study was performed in this work.

Useful next work is a separately frozen held-out map suite, more seed blocks, localization and communication perturbations, and ablations that remove information gain or overlap discount individually. Those experiments are not claimed as completed. The existing rescue presentation retains its historical controller and dataset fixtures; its older numbers are separate from this study.
