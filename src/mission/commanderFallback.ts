import type { MissionSnapshot } from '../simulation/commanderSnapshot';

/** Deterministic, offline guidance built only from observed snapshot facts. Not AI output. */
export function offlineUncertainties(s: MissionSnapshot): string[] {
  const out: string[] = [];
  const possible = s.survivors.filter(d => d.status === 'possible');
  for (const d of possible) out.push(`Possible life signal in Sector ${d.sector} is unconfirmed (${d.observations} observation${d.observations === 1 ? '' : 's'}, confidence ${(d.confidence * 100).toFixed(0)}%).`);
  if (s.swarm.coverage < 100) out.push(`${(100 - s.swarm.coverage).toFixed(1)}% of reachable area is unexplored; undetected survivors or hazards may remain.`);
  if (s.hazards.length) out.push('Gas extents are sensor estimates; boundaries are approximate.');
  if (!out.length) out.push('No open uncertainties in observed data. Ground truth is not visible to the operator.');
  return out;
}

export function offlinePriority(s: MissionSnapshot): { title: string; reason: string } {
  const possible = [...s.survivors.filter(d => d.status === 'possible')].sort((a, b) => b.confidence - a.confidence)[0];
  if (possible) return { title: `Confirm life signal · Sector ${possible.sector}`, reason: `Highest-confidence unconfirmed signal, first detected by ${possible.detectedBy}. A second independent reading is needed to confirm.` };
  const gas = s.hazards.find(h => h.status === 'high gas');
  if (s.missionTime === 0) return { title: 'Deploy the swarm', reason: 'No observations yet. Start the mission to begin mapping.' };
  if (s.swarm.coverage < 100) return { title: 'Continue frontier exploration', reason: `Coverage is ${s.swarm.coverage.toFixed(1)}%. Keep agents on unexplored frontiers${gas ? `, routing around the high-gas area in Sector ${gas.sector}` : ''}.` };
  return { title: 'Review results', reason: 'Reachable area is fully explored. Open View Results to review findings.' };
}

