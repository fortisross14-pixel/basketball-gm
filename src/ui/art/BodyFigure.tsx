// Player figure: no face, but body frame, relative height and skin tone,
// so a glance tells you if he is a slender guard or a heavy centre.
import type { Body } from '../../engine/extras';
import { useSheet, SheetCell } from './sheets';

const FRAMES = ['slender', 'lean', 'athletic', 'strong', 'heavy'] as const;

export function BodyFigure(props: { body: Body; jersey: number; kit: string; trim: string; scaleHeight?: boolean }) {
  const sheet = useSheet('bodies');
  if (sheet) {
    // bodies.png: row-major, height band (short < 1.93 m, medium < 2.06 m, tall) × frame
    const band = props.body.heightCm < 193 ? 0 : props.body.heightCm < 206 ? 1 : 2;
    const idx = band * 5 + FRAMES.indexOf(props.body.frame);
    return <SheetCell sheet="bodies" data={sheet} index={idx} tint={{ r: props.kit, g: props.trim, b: props.body.skin }} style={{ height: '100%', aspectRatio: '1 / 2', display: 'block', margin: '0 auto' }} />;
  }
  return <DrawnBody {...props} />;
}

function DrawnBody({ body, jersey, kit, trim, scaleHeight = true }: { body: Body; jersey: number; kit: string; trim: string; scaleHeight?: boolean }) {
  // 175 cm → 0.86, 220 cm → 1.0 of the frame height
  const hs = scaleHeight ? Math.max(0.82, Math.min(1, 0.86 + ((body.heightCm - 175) / 45) * 0.14)) : 1;
  const wdt = body.width;
  const cx = 50;
  const top = 110 - 104 * hs; // feet anchored at the bottom
  const u = (v: number) => top + v * hs; // vertical unit from head (0) to feet (104)
  const sw = 22 * wdt; // half shoulder width
  const hw = 15 * wdt; // half hip width
  const armW = 6.5 * wdt;
  const legW = 8 * wdt;
  const skin = body.skin;
  const shade = 'rgba(0,0,0,.22)';
  return (
    <svg viewBox="0 0 100 112" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`kit${jersey}${kit}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={kit} />
          <stop offset="1" stopColor={kit} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={109} rx={24 * wdt} ry={3} fill="rgba(0,0,0,.35)" />
      {/* legs */}
      <path d={`M${cx - hw + 2} ${u(62)} L${cx - hw + 3} ${u(100)} L${cx - hw + 3 + legW} ${u(100)} L${cx - 1} ${u(64)} Z`} fill={skin} />
      <path d={`M${cx + hw - 2} ${u(62)} L${cx + hw - 3} ${u(100)} L${cx + hw - 3 - legW} ${u(100)} L${cx + 1} ${u(64)} Z`} fill={skin} />
      <path d={`M${cx - hw + 2} ${u(62)} L${cx - hw + 3} ${u(100)} L${cx - hw + 3 + legW * 0.4} ${u(100)} Z`} fill={shade} />
      {/* shoes */}
      <rect x={cx - hw + 1} y={u(99)} width={legW + 4} height={4.5} rx={2} fill="#f1f5f9" />
      <rect x={cx + hw - legW - 5} y={u(99)} width={legW + 4} height={4.5} rx={2} fill="#f1f5f9" />
      {/* shorts */}
      <path d={`M${cx - hw} ${u(54)} L${cx + hw} ${u(54)} L${cx + hw + 1} ${u(76)} L${cx + 2} ${u(76)} L${cx} ${u(68)} L${cx - 2} ${u(76)} L${cx - hw - 1} ${u(76)} Z`} fill={`url(#kit${jersey}${kit})`} />
      <rect x={cx - hw - 1} y={u(73.5)} width={2 * hw + 2} height={2.5} fill={trim} opacity="0.85" />
      {/* arms */}
      <path d={`M${cx - sw + 1} ${u(20)} Q${cx - sw - 5} ${u(36)} ${cx - sw - 3} ${u(56)} L${cx - sw - 3 + armW} ${u(57)} Q${cx - sw + 2} ${u(38)} ${cx - sw + armW + 1} ${u(24)} Z`} fill={skin} />
      <path d={`M${cx + sw - 1} ${u(20)} Q${cx + sw + 5} ${u(36)} ${cx + sw + 3} ${u(56)} L${cx + sw + 3 - armW} ${u(57)} Q${cx + sw - 2} ${u(38)} ${cx + sw - armW - 1} ${u(24)} Z`} fill={skin} />
      {/* jersey (tank top) */}
      <path d={`M${cx - sw + 1} ${u(19)} L${cx - 8} ${u(16)} Q${cx} ${u(23)} ${cx + 8} ${u(16)} L${cx + sw - 1} ${u(19)} L${cx + sw - 6} ${u(26)} L${cx + hw} ${u(56)} L${cx - hw} ${u(56)} L${cx - sw + 6} ${u(26)} Z`} fill={`url(#kit${jersey}${kit})`} />
      <path d={`M${cx - 8} ${u(16)} Q${cx} ${u(23)} ${cx + 8} ${u(16)}`} fill="none" stroke={trim} strokeWidth="1.6" />
      <text x={cx} y={u(44)} textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="800" fontSize={14 * Math.min(1.1, wdt)} fill={trim} opacity="0.95">{jersey}</text>
      {/* neck + head (no face) */}
      <rect x={cx - 3.8} y={u(10)} width={7.6} height={8} fill={skin} />
      <ellipse cx={cx} cy={u(6.5)} rx={7.2} ry={8.2} fill={skin} />
      <ellipse cx={cx - 2.5} cy={u(3.5)} rx={3} ry={2} fill="rgba(255,255,255,.18)" />
    </svg>
  );
}
