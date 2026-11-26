// Custom line icons for navigation and HUD (24x24 grid, currentColor).
import type { CSSProperties } from 'react';
import { useSheet, SheetCell } from './sheets';

export type IconName =
  | 'today' | 'calendar' | 'club' | 'team' | 'arena' | 'results' | 'legacy' | 'settings' | 'search' | 'play' | 'coin'
  | 'owner' | 'fans' | 'menu' | 'close' | 'chevronRight' | 'chevronDown' | 'whistle' | 'money' | 'megaphone' | 'contract'
  | 'board' | 'news' | 'players' | 'tactics' | 'training' | 'staff' | 'medical' | 'market' | 'academy' | 'ticket' | 'store'
  | 'food' | 'standings' | 'fixtures' | 'bracket' | 'stats' | 'rules' | 'trophy' | 'bolt' | 'alert' | 'check' | 'clock';

const P: Record<IconName, string> = {
  today: 'M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4 M8 13h4 M8 16h8',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 4v4 M16 4v4 M8 14h2 M12 14h2 M16 14h2 M8 17h2 M12 17h2',
  club: 'M3 21h18 M5 21V9l7-5 7 5v12 M9 21v-6h6v6 M9 11h.01 M15 11h.01',
  team: 'M8 3l4 2 4-2 4 3-2 4-2-1v12H8V9l-2 1-2-4z',
  arena: 'M2 12c0-4 4.5-7 10-7s10 3 10 7-4.5 7-10 7S2 16 2 12z M6 12c0-2 2.7-3.5 6-3.5s6 1.5 6 3.5-2.7 3.5-6 3.5S6 14 6 12z M12 5v3.5 M12 15.5V19',
  results: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  legacy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-4.3-4.3',
  play: 'M7 4l13 8-13 8z',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v10 M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.3c0 3 6 1.7 6 4.7 0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5',
  owner: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5 M12 14.5l-1.5 3 1.5 3.5 1.5-3.5z',
  fans: 'M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 20c0-3 2.2-5 5-5s5 2 5 5 M12 20c0-3 2.2-5 5-5s5 2 5 5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M18 6L6 18',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  whistle: 'M3 12a6 6 0 0 0 11.6 2H21V9h-8.6A6 6 0 0 0 3 12z M9 12h.01',
  money: 'M3 6h18v12H3z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 9v.01 M18 15v.01',
  megaphone: 'M3 10v4h3l7 4V6L6 10z M17 9a4 4 0 0 1 0 6 M19.5 6.5a8 8 0 0 1 0 11',
  contract: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h4',
  board: 'M4 21V8h16v13 M2 8h20 M8 8V4h8v4 M8 13h8 M8 17h5',
  news: 'M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z M17 9h3v10a2 2 0 0 1-2 2 M8 9h5 M8 13h5 M8 17h3',
  players: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5 M17 3.5a4 4 0 0 1 0 7.5 M22 21c0-3-1.6-5.2-4-6',
  tactics: 'M3 4h18v16H3z M12 4v16 M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M6 8l2 2 M8 8l-2 2 M16 14l2 2 M18 14l-2 2',
  training: 'M6 7v10 M18 7v10 M3 9v6 M21 9v6 M6 12h12',
  staff: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M5 21c0-4 3-7 7-7s7 3 7 7 M12 14l1 3-1 4-1-4z',
  medical: 'M4 7h16v13H4z M9 7V4h6v3 M12 10v7 M8.5 13.5h7',
  market: 'M7 7h10l4 4-4 4H7l-4-4z M7 7v8 M17 7v8 M11 11h2',
  academy: 'M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5 M22 9v6',
  ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M14 7v10',
  store: 'M4 9l1-5h14l1 5 M4 9h16v11H4z M4 9a3 3 0 0 0 5.3 1.8A3 3 0 0 0 12 12a3 3 0 0 0 2.7-1.2A3 3 0 0 0 20 9 M10 20v-5h4v5',
  food: 'M7 3v8 M5 3v5a2 2 0 0 0 4 0V3 M7 11v10 M17 3c-2 0-3 2.5-3 6s1.5 4 3 4v8',
  standings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v16',
  fixtures: 'M5 4h14v16H5z M9 8h6 M9 12h6 M9 16h3',
  bracket: 'M3 5h5v4H3z M3 15h5v4H3z M16 10h5v4h-5z M8 7h3v10H8 M11 12h5',
  stats: 'M4 19h16 M7 16v-5 M12 16V7 M17 16v-8',
  rules: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',
  trophy: 'M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  check: 'M4 12l5 5L20 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
};

const FILLED: Partial<Record<IconName, boolean>> = { play: true, bolt: true };

// icons.png cell for each icon in the art request (others stay vector)
const ICON_CELL: Partial<Record<IconName, number>> = {
  today: 0, calendar: 1, club: 2, team: 3, arena: 4, results: 5, legacy: 6, settings: 7,
  players: 8, tactics: 9, training: 10, staff: 11, medical: 12, market: 13, academy: 14, contract: 15,
  money: 16, megaphone: 17, board: 18, news: 19, coin: 20, ticket: 21, store: 22, food: 23,
  standings: 24, fixtures: 25, bracket: 26, stats: 27, rules: 28, trophy: 29, owner: 30, fans: 31,
};

export function Icon({ name, size = 20, style, className }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  const sheet = useSheet('icons');
  const cell = ICON_CELL[name];
  if (sheet && cell != null) return <SheetCell sheet="icons" data={sheet} index={cell} mono className={className} style={{ width: size, height: size, flex: 'none', ...style }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flex: 'none', ...style }}
      fill={FILLED[name] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}

/** Generic player silhouette for cards (no faces in this pass). */
export function Silhouette({ jersey, color }: { jersey: number; color: string }) {
  return (
    <svg viewBox="0 0 100 110" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sil${jersey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="30" r="16" fill={`url(#sil${jersey})`} />
      <path d="M18 110 Q20 62 50 54 Q80 62 82 110 Z" fill={`url(#sil${jersey})`} />
      <path d="M33 62 L40 58 Q50 70 60 58 L67 62 L64 110 H36 Z" fill={color} opacity="0.85" />
      <text x="50" y="94" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="800" fontSize="22" fill="#fff" opacity="0.92">{jersey}</text>
    </svg>
  );
}

export function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="bmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffc14d" /><stop offset="1" stopColor="#e2650a" /></linearGradient>
      </defs>
      <path d="M50 4 L92 16 L88 58 Q82 84 50 97 Q18 84 12 58 L8 16 Z" fill="#0b1734" stroke="url(#bmg)" strokeWidth="6" />
      <circle cx="50" cy="48" r="22" fill="url(#bmg)" />
      <path d="M28 48 H72 M50 26 V70 M35 33 Q46 48 35 63 M65 33 Q54 48 65 63" stroke="#4a1d00" strokeWidth="3" fill="none" />
      <text x="50" y="88" textAnchor="middle" fontFamily="'Barlow Condensed'" fontWeight="900" fontStyle="italic" fontSize="15" fill="#fff">BD</text>
    </svg>
  );
}
