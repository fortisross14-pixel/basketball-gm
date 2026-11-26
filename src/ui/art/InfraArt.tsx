// Small broadcast-style illustrations for infrastructure tiles and cards.
export type InfraArtKind = 'arena' | 'sports' | 'commercial' | 'offices' | 'training' | 'academy' | 'lockerRoom' | 'medical' | 'store' | 'online' | 'city' | 'outlet' | 'airport' | 'food' | 'pr' | 'corporate';

const S = { stroke: 'currentColor', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function InfraArt({ kind, size = 96, accent = '#ff8a1f' }: { kind: InfraArtKind; size?: number; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block', color: '#cfe4ff', filter: `drop-shadow(0 0 10px ${accent}55)` }}>
      <defs>
        <linearGradient id={`ia-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.95" />
          <stop offset="1" stopColor={accent} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="86" rx="40" ry="6" fill="#000" opacity="0.35" />
      {art(kind, `url(#ia-${kind})`)}
    </svg>
  );
}

function art(kind: InfraArtKind, fill: string) {
  switch (kind) {
    case 'arena':
      return <g><ellipse cx="50" cy="52" rx="40" ry="24" fill={fill} opacity="0.35" /><ellipse cx="50" cy="48" rx="40" ry="24" {...S} /><ellipse cx="50" cy="48" rx="26" ry="14" {...S} /><rect x="40" y="43" width="20" height="10" fill={fill} stroke="currentColor" strokeWidth="1.6" /><path d="M10 48 V62 Q50 90 90 62 V48" {...S} /><rect x="44" y="20" width="12" height="9" fill={fill} /><path d="M47 20 V12 M53 20 V12" {...S} /></g>;
    case 'sports': case 'training':
      return <g><rect x="16" y="30" width="68" height="40" rx="3" fill={fill} opacity="0.3" /><rect x="16" y="30" width="68" height="40" rx="3" {...S} /><line x1="50" y1="30" x2="50" y2="70" {...S} /><circle cx="50" cy="50" r="8" {...S} /><path d="M16 42 h8 v16 h-8 M84 42 h-8 v16 h8" {...S} /><path d="M26 18 h48 M34 18 v6 M66 18 v6 M30 24 h8 M62 24 h8" {...S} stroke="#ffd23f" /></g>;
    case 'academy':
      return <g><path d="M20 46 L50 30 L80 46 V78 H20 Z" fill={fill} opacity="0.35" /><path d="M20 46 L50 30 L80 46 V78 H20 Z" {...S} /><rect x="30" y="52" width="10" height="10" {...S} /><rect x="60" y="52" width="10" height="10" {...S} /><path d="M45 78 V64 h10 V78" {...S} /><path d="M38 22 L50 16 L62 22 L50 28 Z" fill="#ffd23f" /><path d="M44 25 V30 Q50 33 56 30 V25" {...S} /></g>;
    case 'lockerRoom':
      return <g>{[18, 34, 50, 66].map((x) => <g key={x}><rect x={x} y="24" width="15" height="52" rx="2" fill={fill} opacity="0.35" /><rect x={x} y="24" width="15" height="52" rx="2" {...S} /><path d={`M${x + 4} 32 h7 M${x + 4} 36 h7`} {...S} /><circle cx={x + 11} cy="54" r="1.6" fill="currentColor" /></g>)}</g>;
    case 'medical':
      return <g><rect x="22" y="26" width="56" height="50" rx="6" fill={fill} opacity="0.35" /><rect x="22" y="26" width="56" height="50" rx="6" {...S} /><path d="M50 36 V66 M35 51 H65" stroke="#fff" strokeWidth="7" strokeLinecap="round" /></g>;
    case 'commercial': case 'store':
      return <g><path d="M18 40 L24 22 H76 L82 40 Z" fill={fill} /><path d="M18 40 L24 22 H76 L82 40 Z" {...S} /><path d="M18 40 Q26 48 34 40 Q42 48 50 40 Q58 48 66 40 Q74 48 82 40" {...S} /><rect x="22" y="44" width="56" height="34" {...S} /><rect x="30" y="52" width="18" height="26" {...S} /><rect x="54" y="52" width="16" height="12" fill={fill} opacity="0.4" stroke="currentColor" strokeWidth="1.6" /></g>;
    case 'online':
      return <g><rect x="18" y="24" width="64" height="42" rx="4" fill={fill} opacity="0.3" /><rect x="18" y="24" width="64" height="42" rx="4" {...S} /><path d="M10 72 H90" {...S} /><path d="M38 38 h6 l4 14 h12 l3 -10 H46" {...S} /><circle cx="50" cy="58" r="2" fill="currentColor" /><circle cx="59" cy="58" r="2" fill="currentColor" /></g>;
    case 'city':
      return <g><rect x="14" y="40" width="20" height="38" fill={fill} opacity="0.3" {...{ stroke: 'currentColor', strokeWidth: 2 }} /><rect x="38" y="24" width="24" height="54" fill={fill} opacity="0.55" stroke="currentColor" strokeWidth="2" /><rect x="66" y="34" width="20" height="44" fill={fill} opacity="0.3" stroke="currentColor" strokeWidth="2" /><path d="M44 32 h12 M44 40 h12 M44 48 h12" {...S} /><rect x="44" y="62" width="12" height="16" fill="#ffd23f" /></g>;
    case 'outlet':
      return <g><path d="M14 44 H86 V78 H14 Z" fill={fill} opacity="0.35" /><path d="M14 44 H86 V78 H14 Z" {...S} /><path d="M10 44 L20 28 H80 L90 44" {...S} /><text x="50" y="66" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="900" fontStyle="italic" fontSize="20" fill="#fff">-30%</text></g>;
    case 'airport':
      return <g><path d="M14 56 L50 48 L86 40 L84 46 L58 54 L62 72 L56 74 L46 57 L26 62 L22 70 L18 70 Z" fill={fill} /><path d="M14 56 L50 48 L86 40 L84 46 L58 54 L62 72 L56 74 L46 57 L26 62 L22 70 L18 70 Z" {...S} /><path d="M10 80 H90" {...S} /></g>;
    case 'food':
      return <g><path d="M20 50 H80 Q78 74 50 76 Q22 74 20 50 Z" fill={fill} opacity="0.55" /><path d="M20 50 H80 Q78 74 50 76 Q22 74 20 50 Z" {...S} /><path d="M36 40 Q32 32 38 24 M50 40 Q46 30 52 22 M64 40 Q60 32 66 24" {...S} /></g>;
    case 'offices': case 'corporate':
      return <g><rect x="24" y="18" width="52" height="60" fill={fill} opacity="0.35" /><rect x="24" y="18" width="52" height="60" {...S} />{[26, 38, 50].map((y) => <g key={y}><rect x="32" y={y} width="10" height="7" {...S} /><rect x="45" y={y} width="10" height="7" {...S} /><rect x="58" y={y} width="10" height="7" {...S} /></g>)}<rect x="44" y="64" width="12" height="14" fill="#ffd23f" /></g>;
    case 'pr':
      return <g><rect x="22" y="56" width="56" height="20" rx="2" fill={fill} opacity="0.4" /><rect x="22" y="56" width="56" height="20" rx="2" {...S} /><rect x="40" y="26" width="20" height="24" rx="10" fill={fill} /><rect x="40" y="26" width="20" height="24" rx="10" {...S} /><path d="M34 42 Q34 54 50 54 Q66 54 66 42 M50 54 V56" {...S} /><path d="M16 30 Q10 40 16 50 M84 30 Q90 40 84 50" {...S} stroke="#ffd23f" /></g>;
  }
}
