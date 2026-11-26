// Head-and-shoulders portrait. Uses the modular art pack (public/art/portrait/...) when it is
// installed — greyscale parts tinted in the browser — and a procedural SVG face otherwise.
// Both are driven by the same stable Look, so a person is recognisable on every screen.
import type { CSSProperties } from 'react';
import type { Look } from '../../engine/looks';
import { useSheet, SheetCell } from './sheets';

interface Props {
  look: Look;
  colors: [string, string];
  size?: number; // width in px (height = 1.25 × width)
  title?: string;
  round?: boolean;
}


export function Portrait({ look, colors, size = 48, title, round }: Props) {
  const sheet = useSheet('faces');
  const style: CSSProperties = { width: size, height: round ? size : size * 1.25, flex: 'none', position: 'relative', overflow: 'hidden', borderRadius: round ? '50%' : 4, background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${colors[0]} 45%, #0a1530), #070e24)` };
  // the same person always gets the same cell of faces.png: players rows 1-3, staff row 4
  const staff = look.outfit !== 'jersey';
  const idx = staff ? 24 + ((look.head * 7 + look.hair * 3 + look.eyes) % 8) : (look.head * 31 + look.hair * 7 + look.beard * 3 + look.nose) % 24;
  return (
    <span className="portrait" style={style} title={title} role="img" aria-label={title ?? 'Portrait'}>
      {sheet ? <SheetCell sheet="faces" data={sheet} index={idx} tint={{ r: colors[0], g: colors[1], b: look.skin }} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: round ? '100%' : '80%' }} /> : <FallbackFace look={look} colors={colors} />}
    </span>
  );
}

// ------------------------------------------------------------------ procedural fallback
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

function FallbackFace({ look, colors }: { look: Look; colors: [string, string] }) {
  const skin = look.skin;
  const dark = shade(skin, 0.78);
  const hair = look.hairColor;
  const wide = { slender: 0.86, lean: 0.93, athletic: 1, strong: 1.08, heavy: 1.16 }[look.frame];
  const headRx = 15 + ((look.head - 1) % 4) * 0.9;
  const headRy = 19 + Math.floor((look.head - 1) / 4) * 0.9;
  const cx = 50, cy = 50;
  const eyeY = cy - 1 + (look.eyes % 3) * 0.6;
  const eyeDx = 6 + (look.eyes % 4) * 0.5;
  const browY = eyeY - 5 - (look.brows % 3) * 0.6;
  const browTilt = (look.brows % 4) - 1.5;
  const mouthY = cy + 11 + (look.mouth % 3) * 0.5;
  const mouthW = 4 + (look.mouth % 4) * 0.8;
  const smile = (look.mouth % 3) - 0.6;
  const shoulders = 38 * wide;
  const top = cy - headRy;
  return (
    <svg viewBox="0 0 100 125" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      {/* shoulders & outfit */}
      <path d={`M${50 - shoulders} 125 Q${50 - shoulders} 92 ${50 - 14} 86 L${50 + 14} 86 Q${50 + shoulders} 92 ${50 + shoulders} 125 Z`} fill={look.outfit === 'suit' ? '#1b2333' : colors[0]} />
      {look.outfit === 'jersey' && <>
        <path d={`M${50 - shoulders * 0.62} 125 Q${50 - shoulders * 0.55} 100 ${50 - 16} 90 L${50 - 11} 87 Q50 99 ${50 + 11} 87 L${50 + 16} 90 Q${50 + shoulders * 0.55} 100 ${50 + shoulders * 0.62} 125 Z`} fill={shade(colors[0].length === 7 ? colors[0] : '#336699', 0.85)} opacity="0.5" />
        <path d="M39 87 Q50 100 61 87" fill="none" stroke={colors[1]} strokeWidth="2.6" />
        <path d={`M${50 - shoulders} 118 Q${50 - shoulders + 4} 98 ${50 - shoulders * 0.62} 96`} fill="none" stroke={colors[1]} strokeWidth="2.2" />
        <path d={`M${50 + shoulders} 118 Q${50 + shoulders - 4} 98 ${50 + shoulders * 0.62} 96`} fill="none" stroke={colors[1]} strokeWidth="2.2" />
        {/* bare arms/shoulders around the tank top */}
        <path d={`M${50 - shoulders} 125 Q${50 - shoulders} 100 ${50 - shoulders * 0.66} 95 L${50 - shoulders * 0.62} 125 Z`} fill={skin} />
        <path d={`M${50 + shoulders} 125 Q${50 + shoulders} 100 ${50 + shoulders * 0.66} 95 L${50 + shoulders * 0.62} 125 Z`} fill={skin} />
      </>}
      {look.outfit === 'suit' && <>
        <path d="M42 86 L50 104 L58 86 Z" fill="#f3f4f6" />
        <path d="M48.5 90 L51.5 90 L53 108 L50 112 L47 108 Z" fill={colors[0]} />
        <path d="M42 86 L50 104 L46 108 L38 92 Z M58 86 L50 104 L54 108 L62 92 Z" fill="#111827" opacity="0.7" />
      </>}
      {look.outfit === 'polo' && <path d="M42 86 L50 96 L58 86 L55 84 L50 90 L45 84 Z" fill={colors[1]} />}
      {/* neck */}
      <path d={`M${50 - 6.5 * wide} 70 L${50 - 7 * wide} 88 Q50 93 ${50 + 7 * wide} 88 L${50 + 6.5 * wide} 70 Z`} fill={dark} />
      {/* ears */}
      <ellipse cx={cx - headRx + 0.5} cy={cy + 1} rx="3.2" ry="5" fill={dark} />
      <ellipse cx={cx + headRx - 0.5} cy={cy + 1} rx="3.2" ry="5" fill={dark} />
      {look.extra === 'earring' && <circle cx={cx - headRx + 0.5} cy={cy + 6} r="1.2" fill="#ffd23f" />}
      {/* hair behind (afro / long) */}
      {[4, 13, 18].includes(look.hair) && <ellipse cx={cx} cy={cy - 6} rx={headRx + 6} ry={headRy + 3} fill={hair} />}
      {/* head */}
      <ellipse cx={cx} cy={cy} rx={headRx} ry={headRy} fill={skin} />
      <ellipse cx={cx + 5} cy={cy + 3} rx={headRx * 0.7} ry={headRy * 0.85} fill="#000" opacity="0.06" />
      {/* beard */}
      {look.beard > 0 && <Beard kind={look.beard} cx={cx} cy={cy} rx={headRx} ry={headRy} color={hair} />}
      {/* eyes / brows / nose / mouth */}
      <ellipse cx={cx - eyeDx} cy={eyeY} rx="2.1" ry="1.5" fill="#1a1410" />
      <ellipse cx={cx + eyeDx} cy={eyeY} rx="2.1" ry="1.5" fill="#1a1410" />
      <circle cx={cx - eyeDx + 0.6} cy={eyeY - 0.5} r="0.5" fill="#fff" opacity="0.8" />
      <circle cx={cx + eyeDx + 0.6} cy={eyeY - 0.5} r="0.5" fill="#fff" opacity="0.8" />
      <path d={`M${cx - eyeDx - 3.2} ${browY + browTilt * 0.4} L${cx - eyeDx + 3} ${browY - browTilt * 0.4}`} stroke={shade(hair, 0.9)} strokeWidth={1.4 + (look.brows % 2) * 0.6} strokeLinecap="round" />
      <path d={`M${cx + eyeDx - 3} ${browY - browTilt * 0.4} L${cx + eyeDx + 3.2} ${browY + browTilt * 0.4}`} stroke={shade(hair, 0.9)} strokeWidth={1.4 + (look.brows % 2) * 0.6} strokeLinecap="round" />
      <path d={`M${cx - 0.5} ${eyeY + 2} Q${cx - 2.5 - (look.nose % 3)} ${eyeY + 8 + (look.nose % 2)} ${cx + 1.5} ${eyeY + 9 + (look.nose % 2)}`} fill="none" stroke={shade(skin, 0.6)} strokeWidth="1.2" strokeLinecap="round" />
      <path d={`M${cx - mouthW} ${mouthY} Q${cx} ${mouthY + smile * 2.2} ${cx + mouthW} ${mouthY}`} fill="none" stroke={shade(skin, 0.45)} strokeWidth="1.5" strokeLinecap="round" />
      {/* hair on top */}
      {look.hair > 0 && <Hair kind={look.hair} cx={cx} top={top} rx={headRx} color={hair} />}
      {look.extra === 'headband' && <rect x={cx - headRx} y={top + 7} width={headRx * 2} height="3.6" rx="1.5" fill={colors[1]} />}
      {(look.extra === 'glasses-1' || look.extra === 'glasses-2') && (
        <g fill="none" stroke="#111" strokeWidth="1.1">
          {look.extra === 'glasses-1' ? <><circle cx={cx - eyeDx} cy={eyeY} r="3.8" /><circle cx={cx + eyeDx} cy={eyeY} r="3.8" /></> : <><rect x={cx - eyeDx - 4.2} y={eyeY - 3} width="8.4" height="6" rx="1.2" /><rect x={cx + eyeDx - 4.2} y={eyeY - 3} width="8.4" height="6" rx="1.2" /></>}
          <path d={`M${cx - eyeDx + 4} ${eyeY} L${cx + eyeDx - 4} ${eyeY}`} />
        </g>
      )}
      {look.extra === 'goggles' && <rect x={cx - eyeDx - 5} y={eyeY - 3.5} width={eyeDx * 2 + 10} height="7" rx="3.5" fill="rgba(54,209,255,.35)" stroke="#0b1324" strokeWidth="1.2" />}
    </svg>
  );
}

function Hair({ kind, cx, top, rx, color }: { kind: number; cx: number; top: number; rx: number; color: string }) {
  const k = kind % 12;
  switch (k) {
    case 0: return <path d={`M${cx - rx} ${top + 12} Q${cx} ${top - 4} ${cx + rx} ${top + 12} Q${cx} ${top + 4} ${cx - rx} ${top + 12} Z`} fill={color} opacity="0.85" />; // buzz
    case 1: return <path d={`M${cx - rx - 0.5} ${top + 14} Q${cx - rx} ${top - 2} ${cx} ${top - 2} Q${cx + rx} ${top - 2} ${cx + rx + 0.5} ${top + 14} Q${cx + 4} ${top + 5} ${cx - rx - 0.5} ${top + 14} Z`} fill={color} />; // crop
    case 2: return <rect x={cx - rx * 0.8} y={top - 9} width={rx * 1.6} height="15" rx="4" fill={color} />; // high top
    case 3: return <ellipse cx={cx} cy={top + 4} rx={rx + 5} ry="11" fill={color} />; // afro top
    case 4: return <g fill={color}>{[-10, -5, 0, 5, 10].map((d) => <circle key={d} cx={cx + d} cy={top + 3 + Math.abs(d) * 0.25} r="4.2" />)}</g>; // curls
    case 5: return <g fill={color}><path d={`M${cx - rx} ${top + 12} Q${cx} ${top - 3} ${cx + rx} ${top + 12} Q${cx} ${top + 3} ${cx - rx} ${top + 12} Z`} /><circle cx={cx} cy={top - 3} r="5" /></g>; // bun
    case 6: return <path d={`M${cx - rx - 1} ${top + 16} Q${cx - rx} ${top - 1} ${cx + 2} ${top} Q${cx + rx + 1} ${top + 2} ${cx + rx + 1} ${top + 14} L${cx + rx - 4} ${top + 6} Q${cx - 2} ${top + 2} ${cx - rx - 1} ${top + 16} Z`} fill={color} />; // side part
    case 7: return <g stroke={color} strokeWidth="2.6" strokeLinecap="round">{[-12, -8, -4, 0, 4, 8, 12].map((d) => <path key={d} d={`M${cx + d * 0.9} ${top + 2} L${cx + d * 1.25} ${top + 22}`} />)}<path d={`M${cx - rx} ${top + 8} Q${cx} ${top - 3} ${cx + rx} ${top + 8}`} fill={color} stroke="none" /></g>; // braids/locs
    case 8: return <path d={`M${cx - rx} ${top + 14} Q${cx - rx + 1} ${top + 4} ${cx - rx + 6} ${top + 5} M${cx + rx} ${top + 14} Q${cx + rx - 1} ${top + 4} ${cx + rx - 6} ${top + 5}`} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" />; // receding
    case 9: return <path d={`M${cx - rx - 1} ${top + 18} Q${cx - rx - 2} ${top - 3} ${cx} ${top - 3} Q${cx + rx + 2} ${top - 3} ${cx + rx + 1} ${top + 18} Q${cx + rx - 2} ${top + 6} ${cx} ${top + 6} Q${cx - rx + 2} ${top + 6} ${cx - rx - 1} ${top + 18} Z`} fill={color} />; // full medium
    case 10: return <path d={`M${cx - rx} ${top + 10} Q${cx} ${top - 6} ${cx + rx} ${top + 10} L${cx + rx - 3} ${top + 6} Q${cx} ${top + 1} ${cx - rx + 3} ${top + 6} Z`} fill={color} />; // fade
    default: return <path d={`M${cx - rx} ${top + 11} Q${cx - 4} ${top - 5} ${cx + rx} ${top + 9} Q${cx} ${top + 3} ${cx - rx} ${top + 11} Z`} fill={color} />; // swept
  }
}

function Beard({ kind, cx, cy, rx, ry, color }: { kind: number; cx: number; cy: number; rx: number; ry: number; color: string }) {
  const k = kind % 5;
  if (k === 0) return <path d={`M${cx - rx + 2} ${cy + 2} Q${cx - rx + 3} ${cy + ry} ${cx} ${cy + ry} Q${cx + rx - 3} ${cy + ry} ${cx + rx - 2} ${cy + 2} Q${cx} ${cy + 12} ${cx - rx + 2} ${cy + 2} Z`} fill={color} opacity="0.35" />; // stubble
  if (k === 1) return <path d={`M${cx - 5} ${cy + 13} Q${cx} ${cy + ry + 2} ${cx + 5} ${cy + 13} Q${cx} ${cy + 16} ${cx - 5} ${cy + 13} Z`} fill={color} />; // goatee
  if (k === 2) return <path d={`M${cx - rx + 1} ${cy} Q${cx - rx + 2} ${cy + ry + 3} ${cx} ${cy + ry + 3} Q${cx + rx - 2} ${cy + ry + 3} ${cx + rx - 1} ${cy} Q${cx} ${cy + 14} ${cx - rx + 1} ${cy} Z`} fill={color} />; // full
  if (k === 3) return <path d={`M${cx - 6} ${cy + 9.5} Q${cx} ${cy + 7} ${cx + 6} ${cy + 9.5} Q${cx} ${cy + 11} ${cx - 6} ${cy + 9.5} Z`} fill={color} />; // moustache
  return <g fill={color}><path d={`M${cx - 6} ${cy + 9.5} Q${cx} ${cy + 7} ${cx + 6} ${cy + 9.5} Q${cx} ${cy + 11} ${cx - 6} ${cy + 9.5} Z`} /><path d={`M${cx - 4} ${cy + 14} Q${cx} ${cy + ry + 1} ${cx + 4} ${cy + 14} Z`} /></g>; // moustache + chin
}
