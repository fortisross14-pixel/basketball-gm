// Stylised 3/4-view arena model with interactive hotspots (inline SVG, no photos).
import { motion } from 'framer-motion';

export type ArenaZone = 'access' | 'seating' | 'scoreboard' | 'vip' | 'concessions' | 'parking';

export interface ZoneMarker {
  zone: ArenaZone;
  label: string;
  value: string; // short status, e.g. "Level 2"
  building?: number | null; // construction progress 0..1 when works are under way
}

const POS: Record<ArenaZone, { x: number; y: number; lx: number; ly: number; anchor: 'start' | 'end' }> = {
  scoreboard: { x: 500, y: 176, lx: 500, ly: 44, anchor: 'start' },
  vip: { x: 360, y: 168, lx: 150, ly: 92, anchor: 'start' },
  seating: { x: 690, y: 330, lx: 880, ly: 214, anchor: 'end' },
  concessions: { x: 255, y: 360, lx: 70, ly: 300, anchor: 'start' },
  access: { x: 500, y: 512, lx: 560, ly: 590, anchor: 'start' },
  parking: { x: 860, y: 520, lx: 930, ly: 445, anchor: 'end' },
};

const ZONE_TINT: Record<ArenaZone, string> = {
  scoreboard: '#36d1ff', vip: '#ffd23f', seating: '#ff8a1f', concessions: '#34d399', access: '#a78bfa', parking: '#60a5fa',
};

export function ArenaModel({ markers, selected, onSelect, colors, seatsFill }: {
  markers: ZoneMarker[];
  selected: ArenaZone | null;
  onSelect: (z: ArenaZone) => void;
  colors: [string, string];
  seatsFill: { general: number; lower: number; premium: number }; // 0..1 occupancy
}) {
  const [c1] = colors;
  const sel = (z: ArenaZone) => selected === z;
  const glow = (z: ArenaZone) => (sel(z) ? { filter: `drop-shadow(0 0 14px ${ZONE_TINT[z]})` } : undefined);
  const tint = (z: ArenaZone, base: string) => (sel(z) ? ZONE_TINT[z] : base);
  return (
    <motion.svg
      viewBox="0 0 1000 620"
      className="arena-model"
      role="img"
      aria-label="Arena model. Select a hotspot to manage that part of the arena."
      initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(6px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <defs>
        <radialGradient id="am-floor" cx="50%" cy="55%" r="60%">
          <stop offset="0" stopColor="#1b3a7a" />
          <stop offset="1" stopColor="#060d24" />
        </radialGradient>
        <linearGradient id="am-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a4b92" />
          <stop offset="1" stopColor="#0e1d44" />
        </linearGradient>
        <linearGradient id="am-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16306a" />
          <stop offset="1" stopColor="#0a1533" />
        </linearGradient>
        <linearGradient id="am-court" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0a35c" />
          <stop offset="1" stopColor="#b87333" />
        </linearGradient>
        <linearGradient id="am-board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1a3d" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <pattern id="am-rows" width="10" height="6" patternUnits="userSpaceOnUse">
          <rect width="10" height="6" fill="transparent" />
          <rect y="0" width="10" height="2" fill="rgba(255,255,255,0.08)" />
        </pattern>
        <pattern id="am-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="rgba(251,191,36,0.10)" />
          <rect width="5" height="12" fill="rgba(251,191,36,0.35)" />
        </pattern>
        <radialGradient id="am-light" cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#9ccfff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#9ccfff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground */}
      <rect width="1000" height="620" fill="url(#am-floor)" />
      <g opacity="0.55">
        {Array.from({ length: 14 }, (_, i) => <line key={i} x1={i * 80 - 200} y1="620" x2={i * 80 + 200} y2="0" stroke="#7aa7ff" strokeOpacity="0.05" strokeWidth="30" />)}
      </g>

      {/* parking lot */}
      <g onClick={() => onSelect('parking')} style={{ cursor: 'pointer', ...glow('parking') }}>
        <path d="M760 470 L990 440 L990 612 L720 612 Z" fill={tint('parking', '#0f1f45')} fillOpacity={sel('parking') ? 0.35 : 1} stroke="#2a4b92" />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={770 + i * 25} y1={480 - i * 3} x2={752 + i * 27} y2={600} stroke="#9fb1d8" strokeOpacity="0.35" strokeWidth="2" />)}
        {[[800, 540], [850, 520], [905, 560], [950, 500]].map(([x, y], i) => <rect key={i} x={x} y={y} width="22" height="12" rx="3" fill={['#ef4444', '#f8fafc', '#3b82f6', '#facc15'][i]} opacity="0.85" />)}
      </g>

      {/* building shell */}
      <ellipse cx="500" cy="330" rx="430" ry="235" fill="url(#am-wall)" stroke="#36d1ff" strokeOpacity="0.25" strokeWidth="2" />
      <ellipse cx="500" cy="318" rx="430" ry="222" fill="url(#am-roof)" />
      {/* glass facade band */}
      <path d="M78 330 Q500 600 922 330" fill="none" stroke="#36d1ff" strokeOpacity="0.35" strokeWidth="10" strokeDasharray="22 10" />

      {/* concourse with concessions */}
      <g onClick={() => onSelect('concessions')} style={{ cursor: 'pointer', ...glow('concessions') }}>
        <ellipse cx="500" cy="318" rx="395" ry="198" fill={tint('concessions', '#13285c')} fillOpacity={sel('concessions') ? 0.3 : 1} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x = 500 + Math.cos(a) * 372;
          const y = 318 + Math.sin(a) * 184;
          return <g key={i}><rect x={x - 10} y={y - 6} width="20" height="12" rx="2" fill="#34d399" opacity="0.75" /><rect x={x - 10} y={y - 9} width="20" height="4" rx="1" fill="#f8fafc" opacity="0.8" /></g>;
        })}
      </g>

      {/* seating bowl */}
      <g onClick={() => onSelect('seating')} style={{ cursor: 'pointer', ...glow('seating') }}>
        <ellipse cx="500" cy="318" rx="350" ry="172" fill={tint('seating', '#1d3f8f')} fillOpacity={sel('seating') ? 0.45 : 1} />
        <ellipse cx="500" cy="318" rx="350" ry="172" fill="url(#am-rows)" />
        <ellipse cx="500" cy="318" rx="350" ry="172" fill={c1} opacity={0.1 + seatsFill.general * 0.25} />
        <ellipse cx="500" cy="318" rx="262" ry="128" fill={tint('seating', '#2752b0')} fillOpacity={sel('seating') ? 0.55 : 1} />
        <ellipse cx="500" cy="318" rx="262" ry="128" fill="url(#am-rows)" />
        <ellipse cx="500" cy="318" rx="262" ry="128" fill={c1} opacity={0.1 + seatsFill.lower * 0.3} />
        <ellipse cx="500" cy="318" rx="200" ry="96" fill={tint('seating', '#ff8a1f')} fillOpacity={0.35 + seatsFill.premium * 0.4} />
      </g>

      {/* VIP suites ring segment (upper rim) */}
      <g onClick={() => onSelect('vip')} style={{ cursor: 'pointer', ...glow('vip') }}>
        <path d="M230 205 Q500 100 770 205" fill="none" stroke={tint('vip', '#ffd23f')} strokeOpacity={sel('vip') ? 1 : 0.7} strokeWidth="16" />
        {Array.from({ length: 14 }, (_, i) => {
          const t = (i + 0.5) / 14;
          const x = 230 + t * 540;
          const y = 205 - Math.sin(t * Math.PI) * 52;
          return <rect key={i} x={x - 9} y={y - 5} width="16" height="10" rx="2" fill="#fff7cc" opacity="0.9" />;
        })}
      </g>

      {/* court */}
      <g>
        <ellipse cx="500" cy="318" rx="160" ry="74" fill="#081230" />
        <path d="M385 285 L615 285 L645 352 L355 352 Z" fill="url(#am-court)" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" />
        <line x1="500" y1="285" x2="500" y2="352" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" />
        <ellipse cx="500" cy="318" rx="20" ry="10" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" />
        <path d="M370 300 Q410 318 365 338" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />
        <path d="M630 300 Q590 318 635 338" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />
        <rect x="365" y="308" width="30" height="20" fill={c1} opacity="0.7" transform="skewX(-12)" />
        <rect x="640" y="308" width="30" height="20" fill={c1} opacity="0.7" transform="skewX(12)" />
      </g>

      {/* light cone */}
      <ellipse cx="500" cy="300" rx="300" ry="150" fill="url(#am-light)" pointerEvents="none" />

      {/* scoreboard (hanging) */}
      <g onClick={() => onSelect('scoreboard')} style={{ cursor: 'pointer', ...glow('scoreboard') }}>
        <line x1="470" y1="70" x2="470" y2="150" stroke="#9fb1d8" strokeOpacity="0.5" />
        <line x1="530" y1="70" x2="530" y2="150" stroke="#9fb1d8" strokeOpacity="0.5" />
        <path d="M440 150 L560 150 L575 172 L425 172 Z" fill="#0f2350" stroke={tint('scoreboard', '#36d1ff')} strokeWidth="2" />
        <rect x="425" y="172" width="150" height="58" rx="3" fill="url(#am-board)" stroke={tint('scoreboard', '#36d1ff')} strokeWidth="2.5" />
        <text x="462" y="210" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="900" fontStyle="italic" fontSize="26" fill="#ff8a1f">87</text>
        <text x="538" y="210" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="900" fontStyle="italic" fontSize="26" fill="#36d1ff">84</text>
        <text x="500" y="196" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="700" fontSize="12" fill="#9fb1d8">Q4</text>
        <path d="M425 230 L575 230 L560 246 L440 246 Z" fill="#0b1a3d" stroke={tint('scoreboard', '#36d1ff')} strokeOpacity="0.6" />
      </g>

      {/* access gates */}
      <g onClick={() => onSelect('access')} style={{ cursor: 'pointer', ...glow('access') }}>
        {[[500, 540], [180, 460], [820, 460]].map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x - 34} ${y} L${x - 26} ${y - 26} L${x + 26} ${y - 26} L${x + 34} ${y} Z`} fill={tint('access', '#1e3a8a')} stroke={tint('access', '#a78bfa')} strokeWidth="2" />
            <rect x={x - 18} y={y - 20} width="36" height="16" fill="#e0e7ff" opacity="0.8" />
            <path d={`M${x} ${y + 30} L${x} ${y + 8}`} stroke={tint('access', '#a78bfa')} strokeWidth="3" markerEnd="" />
            <path d={`M${x - 7} ${y + 16} L${x} ${y + 6} L${x + 7} ${y + 16}`} fill="none" stroke={tint('access', '#a78bfa')} strokeWidth="3" />
          </g>
        ))}
      </g>

      {/* construction overlays + hotspots */}
      {markers.map((m, i) => {
        const p = POS[m.zone];
        const col = ZONE_TINT[m.zone];
        const active = sel(m.zone);
        const lw = Math.max(110, m.label.length * 8.5 + 20);
        const lx = p.anchor === 'end' ? p.lx - lw : p.lx;
        return (
          <motion.g key={m.zone} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + i * 0.08, type: 'spring', stiffness: 380, damping: 18 }} style={{ originX: `${p.x}px`, originY: `${p.y}px`, cursor: 'pointer' }} onClick={() => onSelect(m.zone)}>
            {m.building != null && (
              <g pointerEvents="none">
                <circle cx={p.x} cy={p.y} r="34" fill="url(#am-hatch)" opacity="0.9" />
                <circle cx={p.x} cy={p.y} r="28" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="5" />
                <circle cx={p.x} cy={p.y} r="28" fill="none" stroke="#fbbf24" strokeWidth="5" strokeDasharray={`${2 * Math.PI * 28 * m.building} 999`} transform={`rotate(-90 ${p.x} ${p.y})`} strokeLinecap="round" />
              </g>
            )}
            <line x1={p.x} y1={p.y} x2={p.anchor === 'end' ? p.lx : lx} y2={p.ly} stroke={col} strokeWidth={active ? 2.5 : 1.6} strokeDasharray={active ? undefined : '4 4'} opacity="0.9" />
            <circle cx={p.x} cy={p.y} r="16" fill={col} opacity="0.25" className="am-pulse" />
            <circle cx={p.x} cy={p.y} r="9" fill={active ? '#fff' : col} stroke="#05102a" strokeWidth="3" />
            <g transform={`translate(${lx}, ${p.ly - 17})`}>
              <rect width={lw} height="38" rx="3" fill={active ? col : 'rgba(6,14,36,0.88)'} stroke={col} strokeWidth="1.5" />
              <text x="10" y="16" fontFamily="'Barlow Condensed'" fontWeight="800" fontStyle="italic" fontSize="15" fill={active ? '#05102a' : '#fff'} style={{ textTransform: 'uppercase' }}>{m.label}</text>
              <text x="10" y="31" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="11" fill={active ? '#05102a' : '#9fb1d8'}>{m.building != null ? `Works ${Math.round(m.building * 100)}%` : m.value}</text>
            </g>
          </motion.g>
        );
      })}
    </motion.svg>
  );
}
