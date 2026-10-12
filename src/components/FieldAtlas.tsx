import atlas from '../research/atlas.json';

/** Architectural field drawing from recorded simulation, not a generated image.
 * The editorial terrain overview is separate from the operator's fogged map. */
export function FieldAtlas() {
  const colors = ['#ad683d', '#3f695c', '#5c7b91', '#8e8059'];
  return <svg viewBox="0 0 800 680" role="img" aria-label={atlas.caption} className="field-atlas-drawing">
    <defs><pattern id="atlas-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#d9d5c9" strokeWidth=".6"/></pattern>
      <pattern id="atlas-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V5" stroke="#bcb39e" strokeWidth="1"/></pattern></defs>
    <rect width="800" height="680" fill="#f5f3ed"/>
    <g stroke="#b0aa99" strokeWidth=".8"><path d="M54 54H746M54 47V61M746 47V61"/><path d="M768 95V576M761 95H775M761 576H775"/></g>
    <g fontFamily="monospace" fontSize="10" letterSpacing="1" fill="#736f63"><text x="400" y="43" textAnchor="middle">RESIDENTIAL STRUCTURE / PLAN VIEW</text><text x="38" y="626">RECONSTRUCTION 01</text><text x="746" y="626" textAnchor="end">SEED 2026</text></g>
    <g transform="translate(0 64)">
      <rect x="40" y="40" width="720" height="480" fill="url(#atlas-grid)"/>
      {atlas.obstacles.map(o => <g key={o.id}><rect x={o.x + 5} y={o.y + 6} width={o.width} height={o.height} fill="#c4bda7" opacity=".25"/>
        <rect x={o.x} y={o.y} width={o.width} height={o.height} fill={o.kind === 'wall' ? '#d0c8b5' : 'url(#atlas-hatch)'} stroke="#a99e85" strokeWidth=".9"/></g>)}
      {atlas.paths.map((path, i) => <g key={path.id}><polyline points={path.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth="1.4" opacity=".72"/>
        <circle cx={path.points.at(-1)!.x} cy={path.points.at(-1)!.y} r="6" fill={colors[i]} stroke="#f5f3ed" strokeWidth="2"/>
      </g>)}
      <circle cx="90" cy="480" r="18" stroke="#ad683d" fill="none" strokeWidth="1"/><path d="M90 498V543H174" stroke="#ad683d" fill="none"/><text x="181" y="547" fontFamily="monospace" fill="#80603e" fontSize="11">ENTRY / FOUR EXPLORERS</text>
    </g>
    <g transform="translate(47 95)" fill="#6d756b"><path d="M0 0L-4 12L0 9L4 12Z"/><text y="-7" textAnchor="middle" fontFamily="monospace" fontSize="10">N</text></g>
    <g stroke="#887c60" transform="translate(546 647)"><path d="M0 0H200M0 -4V4M100 -4V4M200 -4V4"/><text x="200" y="20" textAnchor="end" fill="#736f63" stroke="none" fontSize="9" fontFamily="monospace">WORLD UNITS / 200</text></g>
  </svg>;
}
