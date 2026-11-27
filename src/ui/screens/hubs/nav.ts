// Single source of truth for the navigation structure: sections (rail) → hub → subsections.
import type { IconName } from '../../art/icons';

export interface SubSection {
  to: string;
  label: string;
  icon: IconName;
  blurb: string;
}

export interface Section {
  id: string;
  label: string;
  icon: IconName;
  /** Where the rail item goes (the section hub, or a single page). */
  to: string;
  /** Hub route (when the section has subsections). */
  hub?: string;
  /** Path prefixes that belong to this section. */
  prefixes: string[];
  tagline?: string;
  items?: SubSection[];
}

export const SECTIONS: Section[] = [
  { id: 'today', label: 'Today', icon: 'today', to: '/today', prefixes: ['/today'] },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', to: '/calendar', prefixes: ['/calendar'] },
  {
    id: 'club', label: 'Club', icon: 'club', to: '/club', hub: '/club', prefixes: ['/club/'], tagline: 'Money, fans, partners and the people you answer to',
    items: [
      { to: '/club/finance', label: 'Finance', icon: 'money', blurb: 'Cash, budgets, profit & loss, forecasts and loans.' },
      { to: '/club/marketing', label: 'Marketing & Fans', icon: 'megaphone', blurb: 'Grow your five fan segments with campaigns.' },
      { to: '/club/commercial', label: 'Sponsors & TV', icon: 'coin', blurb: 'Partners on the kit and court, media rights.' },
      { to: '/club/contracts', label: 'Contracts', icon: 'contract', blurb: 'Payroll sheet, renewals and releases.' },
      { to: '/club/board', label: 'Board', icon: 'board', blurb: 'Objectives, trust and how you are rated.' },
      { to: '/club/licence', label: 'Promotion Licence', icon: 'rules', blurb: 'Seats and guarantees the league above demands, and your plan.' },
      { to: '/club/media', label: 'News & Media', icon: 'news', blurb: 'The newsroom and the delegation log.' },
    ],
  },
  {
    id: 'team', label: 'Team', icon: 'team', to: '/team', hub: '/team', prefixes: ['/team/', '/player/', '/staff/'], tagline: 'The squad, the game plan and the people who build it',
    items: [
      { to: '/team/players', label: 'Players', icon: 'players', blurb: 'Your squad: form, morale, roles and registration.' },
      { to: '/team/tactics', label: 'Tactics', icon: 'tactics', blurb: 'Systems, rotation and the game plan.' },
      { to: '/team/training', label: 'Training', icon: 'training', blurb: 'Weekly focus, intensity and development.' },
      { to: '/team/preseason', label: 'Preseason', icon: 'calendar', blurb: 'Friendlies and the summer training camp.' },
      { to: '/team/staff', label: 'Coaching Staff', icon: 'staff', blurb: 'Head coach, assistants and operations.' },
      { to: '/team/medical', label: 'Medical & Support', icon: 'medical', blurb: 'Injuries, fatigue and return-to-play.' },
      { to: '/team/market', label: 'Transfers & Scouting', icon: 'market', blurb: 'Free agents, bids, shortlist and scouts.' },
      { to: '/team/academy', label: 'Academy', icon: 'academy', blurb: 'Youth prospects and the homegrown pipeline.' },
    ],
  },
  {
    id: 'infra', label: 'Infrastructure', icon: 'arena', to: '/infrastructure', hub: '/infrastructure', prefixes: ['/infrastructure/'], tagline: 'Your arena, training base, stores and offices',
    items: [
      { to: '/infrastructure/arena', label: 'Arena', icon: 'arena', blurb: 'Ticket prices and arena upgrades.' },
      { to: '/infrastructure/sports', label: 'Sports Facilities', icon: 'training', blurb: 'Training ground, gym, locker rooms, academy residence.' },
      { to: '/infrastructure/commercial/merchandise', label: 'Merchandise', icon: 'store', blurb: 'Stock, suppliers, prices and the club stores.' },
      { to: '/infrastructure/commercial/food', label: 'Food & Drink', icon: 'food', blurb: 'Matchday food concepts, menus and the arena restaurant.' },
      { to: '/infrastructure/club-facilities', label: 'Club Facilities', icon: 'board', blurb: 'PR office, press room and corporate offices.' },
    ],
  },
  {
    id: 'results', label: 'Results', icon: 'results', to: '/results', hub: '/results', prefixes: ['/results/', '/game/', '/clubs/'], tagline: 'Tables, fixtures, competitions and numbers',
    items: [
      { to: '/results/standings', label: 'Standings', icon: 'standings', blurb: 'League tables and the European groups.' },
      { to: '/results/schedule', label: 'Fixtures & Results', icon: 'fixtures', blurb: 'Every game, past and upcoming.' },
      { to: '/results/competitions', label: 'Competitions', icon: 'bracket', blurb: 'Copa, playoffs and continental brackets.' },
      { to: '/results/stats', label: 'Statistics', icon: 'stats', blurb: 'League leaders and team numbers.' },
      { to: '/results/rules', label: 'Rules', icon: 'rules', blurb: 'The versioned ruleset and licensing.' },
    ],
  },
  { id: 'legacy', label: 'Legacy', icon: 'legacy', to: '/legacy', prefixes: ['/legacy', '/career'] },
  { id: 'settings', label: 'Settings', icon: 'settings', to: '/settings', prefixes: ['/settings'] },
];

export function sectionOf(path: string): Section | undefined {
  return SECTIONS.find((s) => s.hub === path || s.prefixes.some((p) => path === p || path.startsWith(p)));
}

/** 0 = hub or single page, 1 = subsection, 2 = detail (player / club / game pages). */
export function depthOf(path: string): number {
  const s = sectionOf(path);
  if (!s || !s.items) return 0;
  if (path === s.hub) return 0;
  if (s.items.some((i) => path === i.to || path.startsWith(`${i.to}/`))) return 1;
  return 2;
}

export function subsectionOf(path: string) {
  const s = sectionOf(path);
  const item = s?.items?.find((i) => path === i.to || path.startsWith(`${i.to}/`));
  return { section: s, item, index: item && s?.items ? s.items.indexOf(item) : -1 };
}

/** Searchable page index (global search): direct routes with keywords. */
export const PAGE_INDEX: { to: string; label: string; keywords: string }[] = [
  ...SECTIONS.flatMap((s) => [
    { to: s.to, label: s.label, keywords: s.tagline ?? '' },
    ...(s.items ?? []).map((i) => ({ to: i.to, label: i.label, keywords: `${s.label} ${i.blurb}` })),
  ]),
  { to: '/business/merchandise', label: 'Merchandise', keywords: 'shop store jerseys scarves caps keychains stock orders supplier merch' },
  { to: '/business/food', label: 'Food & Drink', keywords: 'restaurant kiosk grill lounge concessions menu catering bar food drink' },
  { to: '/business/tickets', label: 'Ticket prices', keywords: 'tickets seats season tickets prices gate attendance' },
  { to: '/club/commercial', label: 'Sponsors & TV overview', keywords: 'money naming rights sponsor shirt arena fence app digital members tv cash fundraising' },
  { to: '/team/tactics/lineup', label: 'Lineup & Minutes', keywords: 'starters rotation bench minutes lineup' },
  { to: '/team/tactics/feedback', label: 'Coach feedback', keywords: 'coach feedback analysis suggestions' },
  { to: '/team/preseason', label: 'Preseason & training camp', keywords: 'friendly friendlies camp training camp summer tour trip preseason cohesion' },
  { to: '/career', label: 'Career offers', keywords: 'job offers career clubs interested' },
  { to: '/club/licence', label: 'Promotion licence', keywords: 'licence license promotion seats guarantee elite' },
  { to: '/club/commercial/media', label: 'Media rights', keywords: 'tv broadcaster streaming rights' },
];
