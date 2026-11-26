// Merchandise and food-concept art: cells of shop.png (tinted with club colours via shop-map.png),
// otherwise procedural SVG in the club's colours.
import { useSheet, SheetCell } from './sheets';

export type ProductKind = 'jersey-home' | 'jersey-away' | 'scarf' | 'keychain' | 'cap';
export type FoodConcept = 'kiosk' | 'grill' | 'lounge';



const SHOP_INDEX: Record<ProductKind | FoodConcept, number> = { 'jersey-home': 0, 'jersey-away': 1, scarf: 2, cap: 3, keychain: 4, kiosk: 5, grill: 6, lounge: 7 };

export function ProductArt({ kind, colors, size = 72 }: { kind: ProductKind; colors: [string, string]; size?: number }) {
  const sheet = useSheet('shop');
  const [a, b] = kind === 'jersey-away' ? [colors[1], colors[0]] : colors;
  return (
    <span className="product-art" style={{ width: size, height: size, position: 'relative', display: 'inline-block', flex: 'none' }} aria-hidden="true">
      {sheet ? <SheetCell sheet="shop" data={sheet} index={SHOP_INDEX[kind]} tint={{ r: colors[0], g: colors[1] }} style={{ width: '100%', height: '100%' }} /> : <ProductSvg kind={kind} a={a} b={b} />}
    </span>
  );
}

function ProductSvg({ kind, a, b }: { kind: ProductKind; a: string; b: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      {kind.startsWith('jersey') && <>
        <path d="M30 14 L42 10 Q50 20 58 10 L70 14 L82 30 L72 38 L72 90 L28 90 L28 38 L18 30 Z" fill={a} />
        <path d="M42 10 Q50 20 58 10" fill="none" stroke={b} strokeWidth="4" />
        <path d="M28 38 L18 30 M72 38 L82 30" stroke={b} strokeWidth="3" />
        <text x="50" y="66" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="26" fill={b}>{kind === 'jersey-home' ? '10' : '7'}</text>
        <path d="M28 38 L28 90 L72 90 L72 38" fill="#000" opacity="0.08" />
      </>}
      {kind === 'scarf' && <>
        <path d="M14 30 L66 18 L74 34 L22 46 Z" fill={a} />
        <path d="M60 30 L74 34 L86 84 L72 88 Z" fill={a} />
        {[0, 1, 2].map((i) => <path key={i} d={`M${24 + i * 14} ${40 - i * 3.2} L${30 + i * 14} ${38.6 - i * 3.2} L${23 + i * 14} ${24 - i * 3} L${17 + i * 14} ${25.4 - i * 3} Z`} fill={b} />)}
        {[0, 1, 2].map((i) => <rect key={i} x={74 + i * 0.5} y={48 + i * 12} width="12" height="5" transform={`rotate(-14 ${80} ${50 + i * 12})`} fill={b} />)}
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M${73 + i * 3.4} 88 L${72 + i * 3.4} 96`} stroke={a} strokeWidth="2" />)}
      </>}
      {kind === 'keychain' && <>
        <circle cx="50" cy="18" r="9" fill="none" stroke="#c0c6d0" strokeWidth="4" />
        <path d="M50 27 L50 36" stroke="#c0c6d0" strokeWidth="3" />
        <path d="M30 36 L70 36 L70 62 Q70 80 50 90 Q30 80 30 62 Z" fill={a} stroke={b} strokeWidth="4" />
        <path d="M42 56 L50 46 L58 56 L50 66 Z" fill={b} />
      </>}
      {kind === 'cap' && <>
        <path d="M18 62 Q18 26 52 24 Q84 26 84 60 Z" fill={a} />
        <path d="M18 62 Q50 54 96 66 Q72 76 18 66 Z" fill={b} />
        <path d="M51 24 L51 58" stroke={b} strokeWidth="2" opacity="0.6" />
        <circle cx="51" cy="25" r="3" fill={b} />
      </>}
    </svg>
  );
}

export function FoodArt({ concept, color, height = 140 }: { concept: FoodConcept; color: string; height?: number }) {
  const sheet = useSheet('shop');
  return (
    <div className="food-art" style={{ height, position: 'relative', overflow: 'hidden', borderRadius: 4, display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,.25)' }} aria-hidden="true">
      {sheet ? <SheetCell sheet="shop" data={sheet} index={SHOP_INDEX[concept]} tint={{ r: color }} style={{ height: '100%', aspectRatio: '1 / 1' }} /> : <FoodSvg concept={concept} c={color} />}
    </div>
  );
}

function FoodSvg({ concept, c }: { concept: FoodConcept; c: string }) {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" style={{ background: concept === 'lounge' ? '#140d22' : concept === 'grill' ? '#1f130c' : '#0d1a3a' }}>
      <rect width="320" height="180" fill={concept === 'lounge' ? '#140d22' : concept === 'grill' ? '#1f130c' : '#0d1a3a'} />
      {concept === 'kiosk' && <>
        <rect x="60" y="60" width="200" height="90" fill="#e5e7eb" />
        <path d="M50 60 L270 60 L260 36 L60 36 Z" fill={c} />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${60 + i * 26} 60 L${73 + i * 26} 60 L${70 + i * 26} 36 L${62 + i * 26} 36 Z`} fill="#fff" opacity="0.6" />)}
        <rect x="80" y="76" width="160" height="34" fill="#111827" />
        <text x="160" y="99" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="18" fill="#ffd23f">HOT DOG · POPCORN · SODA</text>
        {[0, 1, 2, 3].map((i) => <circle key={i} cx={100 + i * 40} cy="150" r="10" fill="#f59e0b" />)}
      </>}
      {concept === 'grill' && <>
        <rect x="40" y="90" width="240" height="60" fill="#7c4a26" />
        <rect x="40" y="86" width="240" height="8" fill="#a66a3a" />
        {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${70 + i * 36} 86 Q${76 + i * 36} 60 ${70 + i * 36} 44 Q${84 + i * 36} 62 ${78 + i * 36} 86 Z`} fill={i % 2 ? '#f97316' : '#fbbf24'} opacity="0.85" />)}
        <rect x="100" y="20" width="120" height="22" fill={c} />
        <text x="160" y="37" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="16" fill="#fff">LOCAL GRILL</text>
      </>}
      {concept === 'lounge' && <>
        <rect x="0" y="0" width="320" height="70" fill="#1e1436" />
        {Array.from({ length: 5 }, (_, i) => <circle key={i} cx={40 + i * 60} cy="24" r="6" fill="#ffe7b0" opacity="0.8" />)}
        {[0, 1, 2].map((i) => <g key={i}><ellipse cx={70 + i * 90} cy="128" rx="34" ry="10" fill="#e5e7eb" /><rect x={66 + i * 90} y="128" width="8" height="30" fill="#9ca3af" /><circle cx={58 + i * 90} cy="122" r="3" fill={c} /></g>)}
        <rect x="0" y="70" width="320" height="6" fill={c} opacity="0.8" />
      </>}
    </svg>
  );
}
