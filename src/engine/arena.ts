import type { ArenaProject, Club, FacilityKey, ProjectKind, SeatZone, World } from './types';
import { absDay } from './types';
import { addNews, book, hold, isUser, nextId } from './world';
import { tier } from './economy';
import { takeLoan } from './finance';

export const FACILITY_INFO: Record<FacilityKey, { label: string; group: 'stadium' | 'stores' | 'restaurants' | 'performance' | 'community'; effect: string; tradeoff: string; baseCost: number; weeks: number; upkeep: number }> = {
  concessions: { label: 'Concession stands', group: 'restaurants', effect: 'Raises spend per attendee and venue experience.', tradeoff: 'Staffing costs and upfront capex.', baseCost: 60000, weeks: 4, upkeep: 6000 },
  restaurant: { label: 'Arena restaurant & bar', group: 'restaurants', effect: 'Adds matchday dining revenue and non-game-day events.', tradeoff: 'Operating cost; needs attendance to pay off.', baseCost: 140000, weeks: 8, upkeep: 15000 },
  hospitality: { label: 'VIP hospitality lounge', group: 'restaurants', effect: 'Premium-seat and suite revenue, corporate partner appeal.', tradeoff: 'Expensive; perceived loss of local identity if overdone.', baseCost: 220000, weeks: 10, upkeep: 22000 },
  store: { label: 'Arena team store', group: 'stores', effect: 'Merchandise conversion of attending fans.', tradeoff: 'Stock risk grows with the store.', baseCost: 80000, weeks: 5, upkeep: 8000 },
  onlineStore: { label: 'Online store & fulfilment', group: 'stores', effect: 'Merch sales to regional, national, international and digital fans.', tradeoff: 'Requires a real fanbase beyond the city to pay off.', baseCost: 50000, weeks: 4, upkeep: 7000 },
  videoboard: { label: 'Videoboard & sound', group: 'stadium', effect: 'Atmosphere, attendance interest and court/LED sponsor value.', tradeoff: 'No direct revenue.', baseCost: 120000, weeks: 6, upkeep: 6000 },
  lockerRoom: { label: 'Locker room & recovery', group: 'performance', effect: 'Player morale, free-agent pitch and injury recovery.', tradeoff: 'Benefits invisible in the short term.', baseCost: 90000, weeks: 6, upkeep: 5000 },
  training: { label: 'Practice gym & analytics lab', group: 'performance', effect: 'Player development speed and staff effectiveness.', tradeoff: 'Ongoing staffing cost.', baseCost: 150000, weeks: 10, upkeep: 14000 },
  medical: { label: 'Medical & rehab centre', group: 'performance', effect: 'Lower injury risk and faster returns.', tradeoff: 'Specialist staff costs.', baseCost: 110000, weeks: 8, upkeep: 12000 },
  academy: { label: 'Youth academy & residence', group: 'community', effect: 'Quality of the youth intake; homegrown pipeline; local brand.', tradeoff: 'Long maturation and uncertain prospects.', baseCost: 160000, weeks: 14, upkeep: 30000 },
  accessibility: { label: 'Accessibility, transit & safety', group: 'stadium', effect: 'Attendance, civic goodwill and licence eligibility.', tradeoff: 'Limited direct revenue.', baseCost: 70000, weeks: 6, upkeep: 3000 },
  parking: { label: 'Parking & fan zone', group: 'stadium', effect: 'Attendance from the region; matchday spend.', tradeoff: 'Land and upkeep.', baseCost: 90000, weeks: 8, upkeep: 6000 },
};

export const FACILITY_KEYS = Object.keys(FACILITY_INFO) as FacilityKey[];
export const MAX_LEVEL = 5;

const TIER_COST: Record<number, number> = { 0: 3, 1: 2.4, 2: 1, 3: 0.7 };

export interface ProjectOption {
  kind: ProjectKind;
  facility?: FacilityKey;
  label: string;
  description: string;
  cost: number;
  weeks: number;
  disruption: number;
  seatsDelta?: Partial<Record<SeatZone, number>>;
  suitesDelta?: number;
  newArenaSeats?: Record<SeatZone, number>;
  newArenaSuites?: number;
  annualUpkeep: number;
  needsBoard: boolean;
  blocked?: string;
}

export function capacity(c: Club) {
  return c.arena.seats.general + c.arena.seats.lower + c.arena.seats.premium;
}

export function projectOptions(w: World, c: Club): ProjectOption[] {
  const t = tier(w, c);
  const m = TIER_COST[t];
  const active = w.projects[c.id] ?? [];
  const busy = (k: ProjectKind, f?: FacilityKey) => active.some((p) => p.kind === k && p.facility === f);
  const cap = capacity(c);
  const revenueProxy = Math.max(300000, c.finances.cash + 1);
  const opts: ProjectOption[] = [];
  const seatCost = (n: number, per: number) => Math.round(n * per * m);
  opts.push({
    kind: 'expandGeneral', label: 'Expand general seating (+500)', description: 'Add 500 upper-bowl seats. More inventory and atmosphere; risk of empty-seat optics.',
    cost: seatCost(500, 520), weeks: 12, disruption: 0.15, seatsDelta: { general: 500 }, annualUpkeep: 8000, needsBoard: false,
  });
  opts.push({
    kind: 'expandLower', label: 'Lower-bowl seating (+250)', description: 'Better seats close to the court at mid-tier prices.',
    cost: seatCost(250, 900), weeks: 10, disruption: 0.12, seatsDelta: { lower: 250 }, annualUpkeep: 6000, needsBoard: false,
  });
  opts.push({
    kind: 'premiumSeats', label: 'Courtside & club seats (+80)', description: 'High-margin premium seats with hospitality access.',
    cost: seatCost(80, 2600), weeks: 8, disruption: 0.05, seatsDelta: { premium: 80 }, annualUpkeep: 6000, needsBoard: false,
  });
  opts.push({
    kind: 'suites', label: 'Corporate suites (+4)', description: 'Season-long corporate boxes. Demand depends on city economy and club prestige.',
    cost: Math.round(4 * 70000 * m), weeks: 14, disruption: 0.06, suitesDelta: 4, annualUpkeep: 10000, needsBoard: false,
  });
  for (const f of FACILITY_KEYS) {
    const lvl = c.arena.levels[f];
    const info = FACILITY_INFO[f];
    opts.push({
      kind: 'facility', facility: f, label: `${info.label} → level ${lvl + 1}`, description: `${info.effect} Trade-off: ${info.tradeoff}`,
      cost: Math.round(info.baseCost * Math.pow(1.6, lvl) * m), weeks: info.weeks + lvl * 2, disruption: f === 'concessions' || f === 'accessibility' ? 0.04 : 0,
      annualUpkeep: info.upkeep * (lvl + 1), needsBoard: false, blocked: lvl >= MAX_LEVEL ? 'Maximum level reached' : busy('facility', f) ? 'Already under construction' : undefined,
    });
  }
  opts.push({
    kind: 'renovation', label: 'Full arena renovation', description: 'Restore arena condition to 100 and refresh the venue (+interest).',
    cost: Math.round(cap * 60 * m), weeks: 10, disruption: 0.3, annualUpkeep: 0, needsBoard: false,
  });
  const newSeats = { general: Math.round(Math.max(cap * 1.8, 5500) * 0.62 / 100) * 100, lower: Math.round(Math.max(cap * 1.8, 5500) * 0.3 / 100) * 100, premium: Math.round(Math.max(cap * 1.8, 5500) * 0.08 / 10) * 10 };
  opts.push({
    kind: 'newArena', label: `New arena (${newSeats.general + newSeats.lower + newSeats.premium} seats, owned)`,
    description: 'A club-owned modern arena: no rent, naming rights at full value, 20 suites, upgraded facilities. A career-defining project.',
    cost: Math.round((newSeats.general + newSeats.lower + newSeats.premium) * 2400 * Math.max(1, m * 0.8)), weeks: 70, disruption: 0,
    newArenaSeats: newSeats, newArenaSuites: 20, annualUpkeep: 120000, needsBoard: true,
  });
  for (const o of opts) {
    if (o.kind !== 'facility' && busy(o.kind)) o.blocked = 'Already under construction';
    if (o.cost > revenueProxy * 0.6 || o.kind === 'newArena') o.needsBoard = true;
  }
  return opts;
}

/** ROI forecast: incremental annual revenue estimate for a project. */
export function projectRoi(w: World, c: Club, o: ProjectOption): { annual: number; paybackYears: number | null; notes: string } {
  const t = tier(w, c);
  const homeGames = c.leagueId ? w.rules.leagues[c.leagueId].teams - 1 : 8;
  let annual = 0;
  let notes = '';
  const fill = Math.min(1, avgOccupancy(w, c) + 0.05);
  if (o.seatsDelta) {
    const z = Object.keys(o.seatsDelta)[0] as SeatZone;
    const n = o.seatsDelta[z]!;
    const util = fill > 0.9 ? 0.85 : fill > 0.75 ? 0.5 : 0.15;
    annual = n * util * c.ticketing.prices[z] * homeGames;
    notes = fill > 0.9 ? 'You sell out regularly: new seats should fill.' : fill > 0.75 ? 'Partial demand: some new seats will stay empty.' : 'You rarely fill the arena: expansion will mostly add empty seats.';
  } else if (o.suitesDelta) {
    annual = o.suitesDelta * c.ticketing.suitePrice * 0.6;
    notes = 'Suite demand depends on the corporate market of your city.';
  } else if (o.kind === 'facility' && o.facility) {
    const att = avgAttendance(w, c) * homeGames;
    switch (o.facility) {
      case 'concessions': annual = att * 0.5; notes = 'About €0.50 more net spend per attendee.'; break;
      case 'restaurant': annual = att * 0.4 + 15000; notes = 'Dining revenue plus non-game-day events.'; break;
      case 'hospitality': annual = c.arena.seats.premium * homeGames * 6 + c.arena.suites * 3000; notes = 'Driven by premium seats and suites.'; break;
      case 'store': annual = att * 0.35; notes = 'Better merch conversion among attending fans.'; break;
      case 'onlineStore': annual = (c.fans.national + c.fans.international + c.fans.digital * 0.1) * 0.4; notes = 'Reaches fans beyond the city.'; break;
      default: annual = 0; notes = 'Sporting/brand benefit rather than direct revenue.';
    }
  } else if (o.kind === 'newArena') {
    annual = (c.arena.owned ? 0 : c.arena.rentPerGame * homeGames) + (o.newArenaSeats ? (capacity({ arena: { seats: o.newArenaSeats } } as Club) - capacity(c)) * fill * 0.6 * c.ticketing.prices.general * homeGames : 0);
    notes = 'Removes rent, unlocks naming rights and grows capacity — only valuable if demand follows.';
  } else if (o.kind === 'renovation') {
    annual = avgAttendance(w, c) * homeGames * 0.4;
    notes = 'Condition affects attendance interest.';
  }
  annual = Math.round(annual - o.annualUpkeep);
  const paybackYears = annual > 0 ? Math.round((o.cost / annual) * 10) / 10 : null;
  void t;
  return { annual, paybackYears, notes };
}

export function avgAttendance(w: World, c: Club): number {
  const games = w.fixtures.filter((f) => f.played && f.homeId === c.id && f.result && !f.neutral);
  if (!games.length) {
    const last = c.history[c.history.length - 1];
    return last?.attendance ?? capacity(c) * 0.6;
  }
  return games.reduce((a, f) => a + (f.result?.attendance ?? 0), 0) / games.length;
}

export function avgOccupancy(w: World, c: Club): number {
  return avgAttendance(w, c) / Math.max(1, capacity(c));
}

export function startProject(w: World, c: Club, o: ProjectOption, financing: 'cash' | 'loan'): { ok: boolean; reason?: string } {
  if (o.blocked) return { ok: false, reason: o.blocked };
  if (financing === 'cash' && c.finances.cash < o.cost * 0.3) return { ok: false, reason: 'Not enough cash for the 30% down payment. Use a loan or wait.' };
  if (financing === 'loan') {
    const res = takeLoan(w, c, o.cost * 0.8, 5, `Construction loan: ${o.label}`);
    if (!res.ok) return res;
  }
  const now = absDay(w);
  const p: ArenaProject = {
    id: nextId(w),
    kind: o.kind,
    facility: o.facility,
    label: o.label,
    cost: o.cost,
    paid: 0,
    startDay: now,
    endDay: now + o.weeks * 7,
    disruption: o.disruption,
    financing,
    seatsDelta: o.seatsDelta,
    suitesDelta: o.suitesDelta,
    newArenaSeats: o.newArenaSeats,
    newArenaSuites: o.newArenaSuites,
  };
  // 30% down payment, rest paid weekly during construction
  const down = Math.round(o.cost * 0.3);
  book(w, c, 'construction', -down);
  p.paid = down;
  (w.projects[c.id] ??= []).push(p);
  if (isUser(w, c.id)) addNews(w, `${c.name} begin work: ${o.label}`, `Construction will take about ${o.weeks} weeks. Cost: €${Math.round(o.cost / 1000)}k.`, { tags: ['club'], clubIds: [c.id] });
  return { ok: true };
}

/** Weekly construction progress & completion. */
export function weeklyProjects(w: World, c: Club) {
  const list = w.projects[c.id];
  if (!list?.length) return;
  const now = absDay(w);
  for (const p of [...list]) {
    const totalWeeks = Math.max(1, (p.endDay - p.startDay) / 7);
    const instalment = Math.round((p.cost - Math.round(p.cost * 0.3)) / totalWeeks);
    if (p.paid < p.cost) {
      const pay = Math.min(instalment, p.cost - p.paid);
      book(w, c, 'construction', -pay);
      p.paid += pay;
    }
    if (now >= p.endDay) {
      completeProject(w, c, p);
      list.splice(list.indexOf(p), 1);
    }
  }
}

function completeProject(w: World, c: Club, p: ArenaProject) {
  if (p.paid < p.cost) book(w, c, 'construction', -(p.cost - p.paid));
  if (p.seatsDelta) for (const [z, n] of Object.entries(p.seatsDelta)) c.arena.seats[z as SeatZone] += n!;
  if (p.suitesDelta) c.arena.suites += p.suitesDelta;
  if (p.kind === 'facility' && p.facility) c.arena.levels[p.facility] = Math.min(MAX_LEVEL, c.arena.levels[p.facility] + 1);
  if (p.kind === 'renovation') {
    c.arena.condition = 100;
    c.fans.hype = Math.min(100, c.fans.hype + 5);
  }
  if (p.kind === 'newArena' && p.newArenaSeats) {
    c.arena.seats = { ...p.newArenaSeats };
    c.arena.suites = p.newArenaSuites ?? 20;
    c.arena.owned = true;
    c.arena.rentPerGame = 0;
    c.arena.condition = 100;
    c.arena.opened = w.season;
    c.arena.name = `${c.city} Arena`;
    for (const k of ['concessions', 'store', 'videoboard', 'accessibility', 'parking', 'hospitality'] as FacilityKey[]) c.arena.levels[k] = Math.max(c.arena.levels[k], 3);
    c.fans.hype = Math.min(100, c.fans.hype + 25);
    c.prestige = Math.min(100, c.prestige + 3);
    addNews(w, `A new home: ${c.arena.name} opens its doors`, `${c.name} inaugurate their new owned arena with ${capacity(c)} seats.`, { tags: ['club', 'milestone'], clubIds: [c.id], importance: 3 });
  }
  if (isUser(w, c.id)) {
    addNews(w, `Project complete: ${p.label}`, 'The works have finished and the new facilities are open.', { tags: ['club'], clubIds: [c.id], importance: 2 });
    hold(w, 'projectComplete', `Project complete: ${p.label}`);
  }
}

const SEAT_UPKEEP: Record<number, number> = { 0: 14, 1: 11, 2: 5.5, 3: 3.5 };
const UPKEEP_SCALE: Record<number, number> = { 0: 1.3, 1: 1, 2: 0.4, 3: 0.22 };

/** Annual maintenance needed to keep the arena in its current condition. */
export function maintenanceNeed(w: World, c: Club): number {
  const t = tier(w, c);
  const facilities = FACILITY_KEYS.reduce((a, k) => a + FACILITY_INFO[k].upkeep * c.arena.levels[k], 0) * UPKEEP_SCALE[t];
  return Math.round((capacity(c) * SEAT_UPKEEP[t] + facilities + c.arena.suites * 2500) / 1000) * 1000;
}

/** Monthly condition decay vs maintenance budget. */
export function monthlyArenaUpkeep(w: World, c: Club) {
  const needed = maintenanceNeed(w, c) / 12;
  const budget = c.finances.budget.maintenance / 12;
  book(w, c, 'maintenance', -Math.round(budget));
  const ratio = budget / Math.max(1, needed);
  c.arena.condition = Math.max(0, Math.min(100, c.arena.condition + (ratio - 1) * 3 - 0.6));
}

/** AI clubs reinvest surplus cash into their venue. */
export function aiInvest(w: World, c: Club, revenue: number) {
  if (c.foreign || c.finances.cash < revenue * 0.35) return;
  const opts = projectOptions(w, c).filter((o) => !o.blocked && o.kind !== 'newArena' && o.cost < c.finances.cash * 0.5);
  const occ = avgOccupancy(w, c);
  const prefer = opts.filter((o) => (occ > 0.92 && (o.kind === 'expandGeneral' || o.kind === 'expandLower')) || (o.kind === 'facility' && ['training', 'lockerRoom', 'medical', 'store', 'concessions', 'academy'].includes(o.facility!)));
  const pick = prefer.sort((a, b) => a.cost - b.cost)[0];
  if (pick) startProject(w, c, pick, 'cash');
}
