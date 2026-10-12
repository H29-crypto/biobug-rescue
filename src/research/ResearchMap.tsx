import { useId, useState } from 'react';
import type { Environment } from '../domain/types';
import type { ResearchFrame } from '../simulation/researchExperiment';

export function ResearchMap({ terrain, frame, label }: { terrain: Environment; frame?: ResearchFrame; label: string }) {
  const mask = useId().replace(/:/g, ''), [selected, select] = useState(0);
  const grid = terrain.exploration, agent = frame?.agents[selected];
  return <>
    <svg className="research-map" viewBox={`0 0 ${terrain.width} ${terrain.height}`} role="img"
      aria-label={`${label}: ${frame?.coverage.toFixed(1) ?? '0'} percent mapped at ${frame?.time ?? 0} simulated seconds. Shaded areas have not been observed.`}>
      <defs><mask id={mask}><rect width={terrain.width} height={terrain.height} fill="black"/>
        {frame?.explored.map((known, index) => known && <rect key={index} x={index % grid.columns * grid.cellSize}
          y={Math.floor(index / grid.columns) * grid.cellSize} width={grid.cellSize} height={grid.cellSize} fill="white"/>)}
      </mask></defs>
      <rect width={terrain.width} height={terrain.height} fill="#ece9de"/>
      <g mask={`url(#${mask})`}>
        <rect width={terrain.width} height={terrain.height} fill="#faf9f3"/>
        {terrain.obstacles.map(o => <rect key={o.id} x={o.x} y={o.y} width={o.width} height={o.height}
          fill={o.kind === 'wall' ? '#b7ae96' : '#c9b491'} stroke="#93896f" strokeWidth=".6"/>)}
        {Array.from({ length: grid.columns + 1 }, (_, i) => <path key={`x${i}`} d={`M${i * grid.cellSize} 0V${terrain.height}`} stroke="#a5a694" opacity=".15"/>)}
        {Array.from({ length: grid.rows + 1 }, (_, i) => <path key={`y${i}`} d={`M0 ${i * grid.cellSize}H${terrain.width}`} stroke="#a5a694" opacity=".15"/>)}
      </g>
      <rect x={terrain.entry.x - 12} y={terrain.entry.y - 12} width="24" height="24" fill="none" stroke="#927044"/>
      <text x={terrain.entry.x} y={terrain.entry.y + 32} textAnchor="middle" fill="#927044" fontSize="12">ENTRY</text>
      {agent && agent.path.length > 0 && <polyline points={[agent.position, ...agent.path].map(p => `${p.x},${p.y}`).join(' ')}
        stroke={['#a9683f','#527443','#52768e','#99834e'][selected % 4]} strokeWidth="2" strokeDasharray="6 5" fill="none" opacity=".8"/>}
      {frame?.discoveries.map(d => <g key={d.id} transform={`translate(${d.estimatedPosition.x},${d.estimatedPosition.y})`}>
        <circle r="15" fill="#fffef8" stroke={d.kind === 'gas' ? '#926b39' : '#426c50'} strokeWidth="2"/>
        <text textAnchor="middle" y="5" fill={d.kind === 'gas' ? '#926b39' : '#426c50'} fontSize="16">{d.kind === 'gas' ? '!' : d.status === 'confirmed' ? '+' : '?'}</text>
      </g>)}
      {frame?.agents.map((a, i) => <g key={a.id} transform={`translate(${a.position.x},${a.position.y})`}>
        {selected === i && <circle r="17" stroke={['#a9683f','#527443','#52768e','#99834e'][i % 4]} fill="none" opacity=".6"/>}
        <path d="M12 0L-8 -7L-4 0L-8 7Z" transform={`rotate(${a.heading * 180 / Math.PI})`} fill={['#a9683f','#527443','#52768e','#99834e'][i % 4]}/>
        <text y="-21" textAnchor="middle" fill={['#a9683f','#527443','#52768e','#99834e'][i % 4]} fontSize="12">{i + 1}</text>
      </g>)}
      {!frame && <text x="400" y="240" textAnchor="middle" fill="#838b78" fontSize="18">Run a paired experiment to reveal the map</text>}
    </svg>
    <div className="research-roster" role="group" aria-label={`${label} agent inspection`}>
      {frame?.agents.map((a, i) => <button key={a.id} aria-pressed={selected === i} onClick={() => select(i)}><i style={{ background: a.color }}/>{i + 1}</button>)}
      <span>{agent ? 'Selected agent’s planned route' : 'Observed map only'}</span>
    </div>
    <div className="research-decision"><p>{agent?.decision ?? 'Both planners start with the same observations.'}</p>
      {agent?.information && <small>{agent.information.marginalCells} new cells expected · {agent.information.travelCost} world units to frontier · utility {agent.information.utility.toFixed(2)}</small>}
    </div>
  </>;
}
