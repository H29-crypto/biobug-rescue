export interface ResearchSource {
  id: string; title: string; citation: string; index: 'arXiv' | 'PubMed'; url: string;
  finding: string; application: string; boundary: string;
}
/** Human-readable evidence ledger. Verified 2026-10-12. No paper's reported
 * hardware performance is used as a measured result for BioBug. */
export const RESEARCH_SOURCES: ResearchSource[] = [
  { id: 'coexplore', index: 'arXiv', url: 'https://arxiv.org/abs/2303.17459',
    title: 'coExplore: Combining multiple rankings for multi-robot exploration',
    citation: 'Scheler & Dietrich · 2023 · arXiv:2303.17459',
    finding: 'Combines frontier rankings with information gain and evaluates multiple simulated environments.',
    application: 'Our planner scores unknown-cell gain against reachable path cost and discounts overlap between agents.',
    boundary: 'An independently implemented heuristic. We do not reproduce the paper’s assignment algorithm or claim its results.' },
  { id: 'communication', index: 'arXiv', url: 'https://arxiv.org/abs/2109.07764',
    title: 'Meeting-Merging-Mission: A Multi-robot Coordinate Framework for Large-Scale Communication-Limited Exploration',
    citation: 'Gao et al. · 2021, revised 2022 · arXiv:2109.07764',
    finding: 'Treats limited communication and redundant exploration as explicit coordination problems.',
    application: 'We report shared-map assumptions and cross-agent map overlap as a diagnostic.',
    boundary: 'This benchmark assumes instantaneous sharing. It does not implement rendezvous or validate a radio protocol.' },
  { id: 'swarm', index: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/39762294/',
    title: 'Swarm navigation of cyborg-insects in unknown obstructed soft terrain',
    citation: 'Bai et al. · Nature Communications 16, 221 · 2025 · PMID 39762294',
    finding: 'Reports experiments coordinating cyborg insects with variable responses to control inputs.',
    application: 'Motivates explicit separation constraints and evaluating more than one environment and seed.',
    boundary: 'Published physical cockroach experiments are external evidence. BioBug has no living insects or physical swarm.' },
  { id: 'sensing', index: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/38449606/',
    title: 'Feedback control of automatic navigation for cyborg cockroach without external motion capture system',
    citation: 'Ariyanto et al. · Heliyon 10, e26987 · 2024 · PMID 38449606',
    finding: 'Combines IMU/ToF feedback with a thermopile-based human-presence classifier in a laboratory platform.',
    application: 'Keep sensing, steering and operator interpretation separate; show only observed target estimates.',
    boundary: 'Our abstract life/gas channels are deterministic simulation models, not a trained or clinically validated detector.' },
  { id: 'localization', index: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/32796611/',
    title: 'Localization of Biobotic Insects Using Low-Cost Inertial Measurement Units',
    citation: 'Cole, Bozkurt & Lobaton · Sensors 20, 4486 · 2020 · PMID 32796611',
    finding: 'Studies inertial trajectory reconstruction with known starting and ending states.',
    application: 'Document perfect agent localization as a benchmark assumption and localization drift as future validation work.',
    boundary: 'We do not implement inertial odometry or transfer the paper’s accuracy to this simulation.' },
];
