// Procedural club emblems. Every club in the core universe is fictional, so each
// gets a deterministic SVG crest (shape + colour pattern + mascot glyph). A
// licensed logo pack can override this by setting `club.logoUrl`.
import { useId } from 'react';
import { useSheet, SheetCell } from './sheets';
import type { Club } from '../../engine/types';

type Glyph = 'ball' | 'star' | 'crown' | 'wave' | 'mountain' | 'tower' | 'flame' | 'wing' | 'anchor' | 'tree' | 'bolt' | 'sun' | 'shield' | 'helmet' | 'horns' | 'paw' | 'eye' | 'pick' | 'wheel' | 'leaf';

const GLYPH_RULES: [RegExp, Glyph][] = [
  [/hawk|eagle|gull|sokol|falcon|owl|navigator|ícaro|wing/i, 'wing'],
  [/mariner|harbor|harbour|port|bahía|bahia|marin|costa|atlánt|yam/i, 'anchor'],
  [/laker|ría|ria|wave|túria|turia|ebro|duero|tormes|miño|bluewater|otter|isar/i, 'wave'],
  [/titan|imperial|capital|monarch|king|meneghini|crown|real/i, 'crown'],
  [/knight|vytis|castell|caballero|torri|tower|murall|acueducto|giralda/i, 'tower'],
  [/teide|summit|peak|redstone|mountain|pirineo|naranco|cantábr|cascade/i, 'mountain'],
  [/sun|sol|sunridge|lumière|lumiere|indalo/i, 'sun'],
  [/fire|flame|forger|iron|cierzo|anatolia/i, 'flame'],
  [/timber|olivo|oak|acorn|maple|olivar|huerta|tree|bernesga/i, 'tree'],
  [/bison|bull|horns|miners|toledo|navajas/i, 'horns'],
  [/wolf|paw|cat|lion|celtas|gorri|verds|penya/i, 'paw'],
  [/engineer|tech|prairie/i, 'wheel'],
  [/miner|pick/i, 'pick'],
  [/rocher|bosph|sokoli|giant/i, 'star'],
  [/bolt|storm|thunder|light/i, 'bolt'],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function glyphFor(c: Pick<Club, 'name' | 'nickname'>): Glyph {
  const text = `${c.nickname} ${c.name}`;
  for (const [re, g] of GLYPH_RULES) if (re.test(text)) return g;
  const pool: Glyph[] = ['ball', 'star', 'shield', 'bolt', 'helmet', 'eye', 'leaf'];
  return pool[hash(c.name) % pool.length];
}

function lum(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const SHAPES = {
  shield: 'M50 4 L92 16 L88 58 Q82 84 50 97 Q18 84 12 58 L8 16 Z',
  roundel: 'M50 4 A46 46 0 1 1 49.99 4 Z',
  hex: 'M50 3 L91 26 L91 74 L50 97 L9 74 L9 26 Z',
  badge: 'M14 8 L86 8 Q92 8 92 14 L92 62 Q92 80 50 97 Q8 80 8 62 L8 14 Q8 8 14 8 Z',
  diamond: 'M50 3 L95 42 L50 97 L5 42 Z',
} as const;
type ShapeKey = keyof typeof SHAPES;
const SHAPE_ORDER: ShapeKey[] = ['shield', 'roundel', 'hex', 'badge', 'diamond'];
const GLYPH_ORDER: Glyph[] = ['ball', 'star', 'crown', 'wave', 'mountain', 'tower', 'flame', 'wing', 'anchor', 'tree', 'bolt', 'sun', 'shield', 'helmet', 'horns', 'paw', 'eye', 'pick', 'wheel', 'leaf'];

function GlyphPath({ g, fill, stroke }: { g: Glyph; fill: string; stroke: string }) {
  const s = { fill, stroke, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (g) {
    case 'ball': return <g {...s}><circle cx="50" cy="48" r="20" /><path d="M30 48 H70 M50 28 V68 M36 34 Q46 48 36 62 M64 34 Q54 48 64 62" fill="none" stroke={stroke} /></g>;
    case 'star': return <path {...s} d="M50 24 L57 41 L75 42 L61 53 L66 71 L50 61 L34 71 L39 53 L25 42 L43 41 Z" />;
    case 'crown': return <path {...s} d="M27 64 L24 34 L38 46 L50 28 L62 46 L76 34 L73 64 Z M28 70 H72" />;
    case 'wave': return <path {...s} fill="none" strokeWidth={4} d="M24 44 Q32 34 40 44 T56 44 T72 44 M24 58 Q32 48 40 58 T56 58 T72 58" />;
    case 'mountain': return <path {...s} d="M22 68 L40 36 L48 48 L56 30 L78 68 Z" />;
    case 'tower': return <path {...s} d="M34 70 V40 H30 V30 H37 V35 H44 V30 H56 V35 H63 V30 H70 V40 H66 V70 Z M46 70 V58 Q50 52 54 58 V70" />;
    case 'flame': return <path {...s} d="M50 24 Q66 40 62 56 Q60 70 50 72 Q38 70 37 58 Q36 48 45 42 Q44 52 50 54 Q54 44 50 24 Z" />;
    case 'wing': return <path {...s} d="M24 60 Q30 36 56 32 Q70 30 78 36 Q66 38 62 44 Q72 44 76 48 Q64 50 58 54 Q64 58 66 62 Q50 60 42 66 Q34 70 24 60 Z" />;
    case 'anchor': return <g {...s} fill="none" strokeWidth={4}><circle cx="50" cy="30" r="5" /><path d="M50 35 V70 M38 44 H62 M30 58 Q32 70 50 70 Q68 70 70 58" /></g>;
    case 'tree': return <path {...s} d="M50 24 L68 50 H58 L72 64 H54 V74 H46 V64 H28 L42 50 H32 Z" />;
    case 'bolt': return <path {...s} d="M56 22 L32 54 H48 L42 76 L68 42 H52 Z" />;
    case 'sun': return <g {...s}><circle cx="50" cy="50" r="12" /><path fill="none" strokeWidth={4} d="M50 26 V32 M50 68 V74 M26 50 H32 M68 50 H74 M33 33 L37 37 M63 63 L67 67 M33 67 L37 63 M63 37 L67 33" /></g>;
    case 'shield': return <path {...s} d="M50 26 L70 32 Q70 58 50 72 Q30 58 30 32 Z M50 32 V66 M36 44 H64" />;
    case 'helmet': return <path {...s} d="M30 60 Q28 34 50 30 Q72 34 70 60 L62 60 L62 50 H38 V60 Z M50 30 V20" />;
    case 'horns': return <path {...s} d="M26 34 Q30 48 42 50 L42 66 Q50 72 58 66 L58 50 Q70 48 74 34 Q66 42 58 42 Q50 38 42 42 Q34 42 26 34 Z" />;
    case 'paw': return <g {...s}><ellipse cx="50" cy="58" rx="13" ry="11" /><circle cx="35" cy="42" r="5" /><circle cx="45" cy="34" r="5" /><circle cx="55" cy="34" r="5" /><circle cx="65" cy="42" r="5" /></g>;
    case 'eye': return <g {...s}><path d="M24 50 Q50 26 76 50 Q50 74 24 50 Z" /><circle cx="50" cy="50" r="8" fill={stroke} /></g>;
    case 'pick': return <path {...s} fill="none" strokeWidth={4} d="M30 36 Q50 22 70 36 M50 30 L50 74" />;
    case 'wheel': return <g {...s} fill="none" strokeWidth={3.5}><circle cx="50" cy="50" r="18" /><circle cx="50" cy="50" r="5" fill={stroke} /><path d="M50 26 V32 M50 68 V74 M26 50 H32 M68 50 H74 M33 33 L37 37 M63 63 L67 67 M33 67 L37 63 M63 37 L67 33" /></g>;
    case 'leaf': return <path {...s} d="M28 70 Q26 36 70 28 Q74 62 40 66 M30 68 L58 40" />;
  }
}

export function ClubLogo({ club, size = 32, title }: { club: Pick<Club, 'id' | 'name' | 'nickname' | 'abbrev' | 'colors'> & { logoUrl?: string }; size?: number; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const sheet = useSheet('emblems');
  if (club.logoUrl) {
    // built-in badges are stored relative to the site ('badges/x.webp'); uploads are data: or full URLs
    const src = /^(data:|https?:|\/)/.test(club.logoUrl) ? club.logoUrl : `${import.meta.env.BASE_URL}${club.logoUrl}`;
    return <img src={src} width={size} height={size} alt={club.name} loading="lazy" style={{ objectFit: 'contain', flex: 'none', filter: size >= 40 ? 'drop-shadow(0 3px 6px rgba(0,0,0,.45))' : undefined }} />;
  }
  const h = hash(club.name);
  const shapeKey = (['shield', 'roundel', 'hex', 'badge', 'diamond'] as ShapeKey[])[h % 5];
  const pattern = (h >> 3) % 5; // 0 solid, 1 diagonal, 2 halves, 3 band, 4 ring
  const a = club.colors[0];
  let b = club.colors[1];
  if (Math.abs(lum(a) - lum(b)) < 0.15) b = lum(a) > 0.5 ? '#111827' : '#f8fafc';
  const ink = lum(a) > 0.6 ? shade(a, -0.75) : '#ffffff';
  const glyph = glyphFor(club);
  const path = SHAPES[shapeKey];
  const showText = size >= 56;
  if (sheet) {
    // emblems.png: frames in cells 0-4, symbols from cell 5 in GLYPH_ORDER
    return (
      <span role="img" aria-label={title ?? `${club.name} emblem`} style={{ width: size, height: size, position: 'relative', display: 'block', flex: 'none', filter: size >= 40 ? 'drop-shadow(0 3px 6px rgba(0,0,0,.45))' : undefined }}>
        <SheetCell sheet="emblems" data={sheet} index={SHAPE_ORDER.indexOf(shapeKey)} tint={{ r: a, g: b }} style={{ position: 'absolute', inset: 0 }} />
        <SheetCell sheet="emblems" data={sheet} index={5 + GLYPH_ORDER.indexOf(glyph)} mono style={{ position: 'absolute', left: '22%', top: '20%', width: '56%', height: '56%', color: ink }} />
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title ?? `${club.name} emblem`} style={{ display: 'block', flex: 'none', filter: size >= 40 ? 'drop-shadow(0 3px 6px rgba(0,0,0,.45))' : undefined }}>
      <defs>
        <clipPath id={`c${uid}`}><path d={path} /></clipPath>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(a, 0.12)} />
          <stop offset="1" stopColor={shade(a, -0.14)} />
        </linearGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${uid})`}>
        <rect width="100" height="100" fill={`url(#g${uid})`} />
        {pattern === 1 && <path d="M0 100 L100 0 L100 100 Z" fill={b} opacity="0.92" />}
        {pattern === 2 && <rect x="50" width="50" height="100" fill={b} opacity="0.92" />}
        {pattern === 3 && <rect y="64" width="100" height="20" fill={b} opacity="0.95" />}
        {pattern === 4 && <circle cx="50" cy="50" r="38" fill="none" stroke={b} strokeWidth="6" />}
        <rect width="100" height="100" fill={`url(#s${uid})`} />
      </g>
      <path d={path} fill="none" stroke={b} strokeWidth="5" />
      <path d={path} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.2" />
      <g transform={showText ? 'translate(0,-6)' : undefined}>
        <GlyphPath g={glyph} fill={pattern === 2 || pattern === 1 ? 'rgba(255,255,255,.95)' : ink} stroke={pattern === 2 || pattern === 1 ? '#111827' : b} />
      </g>
      {showText && (
        <g>
          <rect x="18" y="72" width="64" height="15" rx="2" fill="#0b1220" opacity="0.85" />
          <text x="50" y="83.5" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="800" fontStyle="italic" fontSize="13" fill="#fff" letterSpacing="1">{club.abbrev}</text>
        </g>
      )}
    </svg>
  );
}
