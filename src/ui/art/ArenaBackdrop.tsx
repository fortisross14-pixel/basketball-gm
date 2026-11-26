// Arena backdrop: makes club progress visible (municipal pavilion → modern arena → continental
// showpiece). Uses public/art/arena/<tier>-<view>.webp (+ optional club-colour mask) when present,
// otherwise a procedural SVG skyline / bowl in the club's colours.
import type { CSSProperties } from 'react';
import type { Club } from '../../engine/types';
import { artUrl, useArt } from './assets';

export type ArenaTier = 'municipal' | 'modern' | 'showpiece';
export type ArenaView = 'exterior' | 'interior';

export function arenaTier(c: Club): ArenaTier {
  const cap = c.arena.seats.general + c.arena.seats.lower + c.arena.seats.premium;
  return cap >= 12000 ? 'showpiece' : cap >= 5000 ? 'modern' : 'municipal';
}

export const TIER_LABEL: Record<ArenaTier, string> = { municipal: 'Municipal pavilion', modern: 'Modern domestic arena', showpiece: 'Continental showpiece' };

export function ArenaBackdrop({ club, view, className, style }: { club: Club; view: ArenaView; className?: string; style?: CSSProperties }) {
  const tier = arenaTier(club);
  const img = useArt(`arena/${tier}-${view}.webp`);
  const mask = useArt(img ? `arena/${tier}-${view}-mask.png` : null);
  return (
    <div className={`arena-backdrop ${className ?? ''}`} style={style} aria-hidden="true" data-tier={tier}>
      {img ? (
        <>
          <img src={img} alt="" />
          {mask && <span className="ab-mask" style={{ background: club.colors[0], WebkitMask: `url(${artUrl(`arena/${tier}-${view}-mask.png`)}) center / cover no-repeat`, mask: `url(${artUrl(`arena/${tier}-${view}-mask.png`)}) center / cover no-repeat` }} />}
        </>
      ) : view === 'exterior' ? <Exterior tier={tier} c={club.colors[0]} c2={club.colors[1]} /> : <Interior tier={tier} c={club.colors[0]} c2={club.colors[1]} />}
    </div>
  );
}

function Windows({ x, y, w, h, cols, rows, lit }: { x: number; y: number; w: number; h: number; cols: number; rows: number; lit: string }) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const on = ((i * 7 + r * 13) % 5) !== 0;
    out.push(<rect key={`${r}-${i}`} x={x + (i * w) / cols + 4} y={y + (r * h) / rows + 4} width={w / cols - 8} height={h / rows - 8} fill={on ? lit : '#0b1430'} opacity={on ? 0.75 : 1} />);
  }
  return <>{out}</>;
}

function Exterior({ tier, c, c2 }: { tier: ArenaTier; c: string; c2: string }) {
  return (
    <svg viewBox="0 0 2560 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <defs>
        <linearGradient id="ab-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050b1d" /><stop offset="0.7" stopColor="#14275a" /><stop offset="1" stopColor="#1e3a7a" /></linearGradient>
        <radialGradient id="ab-glow" cx="0.5" cy="0.75" r="0.5"><stop offset="0" stopColor={c} stopOpacity="0.55" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="2560" height="1080" fill="url(#ab-sky)" />
      <rect width="2560" height="1080" fill="url(#ab-glow)" />
      {/* distant city */}
      {Array.from({ length: 26 }, (_, i) => <rect key={i} x={i * 100} y={560 - ((i * 37) % 160)} width="80" height={520} fill="#0c1838" />)}
      {tier === 'municipal' && (
        <g>
          <rect x="880" y="560" width="800" height="300" fill="#2b3446" />
          <path d="M860 560 L1280 470 L1700 560 Z" fill="#39445a" />
          <Windows x={920} y={600} w={720} h={90} cols={9} rows={1} lit="#ffd9a0" />
          <rect x="1200" y="720" width="160" height="140" fill="#11182a" />
          <rect x="1090" y="530" width="380" height="44" fill={c} />
          <text x="1280" y="562" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="34" fill={c2}>PABELLÓN</text>
        </g>
      )}
      {tier === 'modern' && (
        <g>
          <path d="M640 860 L700 540 Q1280 380 1860 540 L1920 860 Z" fill="#1c2a4a" />
          <path d="M700 540 Q1280 380 1860 540 L1850 590 Q1280 440 710 590 Z" fill={c} opacity="0.9" />
          <Windows x={760} y={620} w={1040} h={200} cols={16} rows={3} lit="#9ed8ff" />
          <rect x="1180" y="760" width="200" height="100" fill="#0b1226" />
          <text x="1280" y="560" textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="44" fill={c2}>ARENA</text>
        </g>
      )}
      {tier === 'showpiece' && (
        <g>
          <ellipse cx="1280" cy="640" rx="820" ry="250" fill="#18264a" />
          <path d="M460 640 Q1280 180 2100 640 Z" fill="#22345f" />
          <path d="M520 620 Q1280 230 2040 620" fill="none" stroke={c} strokeWidth="26" />
          <path d="M600 640 Q1280 300 1960 640" fill="none" stroke={c2} strokeWidth="8" opacity="0.8" />
          <rect x="470" y="640" width="1620" height="220" fill="#16213f" />
          <Windows x={520} y={670} w={1520} h={150} cols={24} rows={2} lit="#ffe7b0" />
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${700 + i * 190} 860 L${640 + i * 190} 150`} stroke="#9ed8ff" strokeWidth="6" opacity="0.08" />)}
        </g>
      )}
      <rect y="860" width="2560" height="220" fill="#070e22" />
      {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={300 + i * 50 + ((i * 17) % 23)} cy={900 + ((i * 29) % 60)} r="7" fill={i % 3 ? '#0f1c3c' : c} opacity="0.7" />)}
      <rect y="700" width="2560" height="380" fill="url(#ab-fade)" />
      <defs><linearGradient id="ab-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050b1d" stopOpacity="0" /><stop offset="1" stopColor="#050b1d" stopOpacity="0.9" /></linearGradient></defs>
    </svg>
  );
}

function Interior({ tier, c, c2 }: { tier: ArenaTier; c: string; c2: string }) {
  const rows = tier === 'municipal' ? 5 : tier === 'modern' ? 9 : 14;
  const top = tier === 'municipal' ? 520 : tier === 'modern' ? 360 : 200;
  return (
    <svg viewBox="0 0 2560 1080" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <rect width="2560" height="1080" fill="#060c20" />
      {/* stands */}
      {Array.from({ length: rows }, (_, r) => {
        const y = top + r * ((700 - top) / rows);
        return (
          <g key={r}>
            <rect x="0" y={y} width="2560" height={(700 - top) / rows - 6} fill={r % 2 ? '#0f1a38' : '#122044'} />
            {Array.from({ length: 64 }, (_, i) => <circle key={i} cx={i * 40 + (r % 2) * 20 + 10} cy={y + 12} r="8" fill={(i + r * 3) % 4 === 0 ? c : (i + r) % 7 === 0 ? c2 : '#2a3a66'} opacity={tier === 'municipal' && (i + r) % 3 === 0 ? 0.15 : 0.75} />)}
          </g>
        );
      })}
      {tier !== 'municipal' && (
        <g>
          <rect x="1080" y={tier === 'showpiece' ? 40 : 120} width="400" height={tier === 'showpiece' ? 220 : 160} rx="12" fill="#0b1226" stroke="#36d1ff" strokeOpacity="0.5" strokeWidth="4" />
          <rect x="1110" y={tier === 'showpiece' ? 70 : 150} width="340" height={tier === 'showpiece' ? 160 : 100} fill={c} opacity="0.35" />
        </g>
      )}
      {tier === 'municipal' && <rect x="1180" y="400" width="200" height="80" fill="#111" stroke="#444" strokeWidth="4" />}
      {/* LED ribbon */}
      <rect y="690" width="2560" height="24" fill={c} opacity={tier === 'municipal' ? 0.3 : 0.85} />
      {/* court */}
      <path d="M200 1080 L640 720 L1920 720 L2360 1080 Z" fill="#b07a45" />
      <path d="M200 1080 L640 720 L1920 720 L2360 1080 Z" fill="none" stroke="#f5e6cf" strokeWidth="6" />
      <path d="M1280 720 L1280 1080" stroke="#f5e6cf" strokeWidth="5" />
      <ellipse cx="1280" cy="880" rx="160" ry="60" fill="none" stroke="#f5e6cf" strokeWidth="5" />
      <ellipse cx="1280" cy="880" rx="70" ry="26" fill={c} opacity="0.8" />
      {tier === 'showpiece' && Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${300 + i * 400} 0 L${700 + i * 260} 720`} stroke="#ffffff" strokeWidth="40" opacity="0.035" />)}
      <rect width="2560" height="1080" fill="url(#ab-vig)" />
      <defs><radialGradient id="ab-vig" cx="0.5" cy="0.6" r="0.75"><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.65" /></radialGradient></defs>
    </svg>
  );
}
