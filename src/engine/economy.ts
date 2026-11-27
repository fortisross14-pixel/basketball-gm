// Club economy: demand, ticketing, matchday spend, merchandise, sponsors, TV.
// Pure-ish calculation functions; periodic booking lives in finance.ts.

import type { Club, CompType, SeatZone, SponsorSlot, World, BroadcasterKind, MerchLine, Fanbase } from './types';
import { SEAT_ZONES } from './types';
import { clamp } from './rng';
import { club as getClub, roster, tierOf, comp as getComp } from './world';
import { buildCalendar } from './calendar';
import { annualShopForecast, offDayIncome } from './shop';
import { arenaStoreFactor } from './facilities';

// ---------------------------------------------------------------------------
// Reference values by tier (1 = Élite … 3 = Plata, 0 = foreign)
// ---------------------------------------------------------------------------
export const REF_PRICE: Record<number, Record<SeatZone, number>> = {
  0: { general: 28, lower: 50, premium: 120 },
  1: { general: 22, lower: 40, premium: 90 },
  2: { general: 11, lower: 18, premium: 38 },
  3: { general: 7, lower: 11, premium: 22 },
};
// every zone is price-elastic (>1): no zone rewards unlimited price rises
const ELASTICITY: Record<SeatZone, number> = { general: 1.35, lower: 1.25, premium: 1.2 };

/** Demand collapses beyond ~2.5x the price fans consider fair. */
function priceDemand(ref: number, price: number, e: number): number {
  const p = Math.max(1, price);
  let d = Math.pow(ref / p, e);
  if (p > ref * 2.5) d *= Math.pow((ref * 2.5) / p, 2);
  return d;
}
const ZONE_SHARE: Record<SeatZone, number> = { general: 0.62, lower: 0.3, premium: 0.08 };
export const SPEND_PER_HEAD: Record<number, number> = { 0: 9, 1: 7.5, 2: 4.5, 3: 3 };
export const SUITE_REF: Record<number, number> = { 0: 90000, 1: 60000, 2: 18000, 3: 8000 };
const OPS_PER_GAME: Record<number, number> = { 0: 30000, 1: 22000, 2: 5500, 3: 1800 };
const TRAVEL_PER_AWAY: Record<number, number> = { 0: 20000, 1: 14000, 2: 4500, 3: 1800 };
export const EURO_TRAVEL = 38000;

export function tier(w: World, c: Club) {
  return tierOf(w, c);
}

export function refPrice(w: World, c: Club, z: SeatZone): number {
  const t = tier(w, c);
  return REF_PRICE[t][z] * c.economy * (0.8 + c.prestige / 250);
}

// ---------------------------------------------------------------------------
// Interest / demand
// ---------------------------------------------------------------------------
export function currentWinPct(w: World, c: Club): number {
  if (!c.leagueId) return 0.5;
  const lc = getComp(w, `${c.leagueId}-${w.season}`);
  const st = lc?.standings.find((s) => s.clubId === c.id);
  if (!st || st.w + st.l === 0) {
    const last = c.history[c.history.length - 1];
    return last ? last.wins / Math.max(1, last.wins + last.losses) : 0.5;
  }
  // blend with last season early on
  const g = st.w + st.l;
  const cur = st.w / g;
  const last = c.history[c.history.length - 1];
  const prev = last ? last.wins / Math.max(1, last.wins + last.losses) : 0.5;
  const k = Math.min(1, g / 10);
  return cur * k + prev * (1 - k);
}

export function starPower(w: World, c: Club): number {
  const r = roster(w, c.id);
  const best = r.reduce((m, p) => Math.max(m, p.ovr), 0);
  const t = tier(w, c);
  const ref = t === 1 ? 72 : t === 2 ? 58 : t === 3 ? 50 : 76;
  return clamp((best - ref) / 20, -0.3, 0.5);
}

export function venueQuality(c: Club): number {
  const l = c.arena.levels;
  return clamp(0.85 + l.accessibility * 0.02 + l.parking * 0.015 + l.videoboard * 0.02 + l.concessions * 0.01 + (c.arena.condition - 70) / 400, 0.7, 1.25);
}

export function interestIndex(w: World, c: Club): number {
  const win = currentWinPct(w, c);
  const f = c.fans;
  return clamp(
    0.55 + win * 0.5 + (f.hype - 50) / 180 + (f.sentiment - 50) / 220 + (c.prestige - 50) / 400 + starPower(w, c) * 0.25,
    0.25,
    1.8,
  ) * venueQuality(c);
}

export function isRival(a: Club, b: Club) {
  return a.rivals.includes(b.id) || b.rivals.includes(a.id);
}

export function isBigGame(w: World, home: Club, away: Club) {
  return isRival(home, away) || away.prestige >= home.prestige + 15 || away.prestige >= 75;
}

export interface GameDemand {
  zones: Record<SeatZone, { price: number; demand: number; capacity: number; seasonHolders: number; sold: number; revenue: number }>;
  attendance: number;
  capacity: number;
  ticketRevenue: number;
  concessions: number;
  promo: boolean;
  bigGame: boolean;
}

export function seatsAvailable(w: World, c: Club): Record<SeatZone, number> {
  const projects = w.projects[c.id] ?? [];
  const disruption = projects.reduce((m, p) => Math.max(m, p.disruption), 0);
  const out = {} as Record<SeatZone, number>;
  const gs = c.groundShare && c.groundShare.season === w.season ? c.groundShare : null;
  if (gs) return { general: Math.round(gs.seats * 0.66), lower: Math.round(gs.seats * 0.28), premium: gs.seats - Math.round(gs.seats * 0.66) - Math.round(gs.seats * 0.28) };
  for (const z of SEAT_ZONES) out[z] = Math.floor(c.arena.seats[z] * (1 - disruption));
  return out;
}

export function isPromoNight(w: World, c: Club, roundIndex: number): boolean {
  const p = c.ticketing.promoNights;
  if (p === 'none') return false;
  if (p === 'weekly') return true;
  if (p === 'biweekly') return roundIndex % 2 === 0;
  return roundIndex % 4 === 0;
}

/** Expected demand & revenue for one home game. Deterministic (noise applied by caller). */
export function gameDemand(w: World, home: Club, away: Club | null, compType: CompType, roundIndex = 1, noise = 1): GameDemand {
  const interest = interestIndex(w, home);
  const oppFactor = away ? 0.85 + away.prestige / 260 + (isRival(home, away) ? 0.18 : 0) : 1;
  const compFactor = compType === 'friendly' ? 0.55 : compType === 'playoffs' ? 1.35 : compType === 'promo' ? 1.3 : compType === 'euro' ? 1.18 : compType === 'cup' ? 1.2 : 1;
  const away_from_home = home.groundShare && home.groundShare.season === w.season ? 0.9 : 1; // borrowed venue: some fans stay away
  const base = (home.fans.local * 0.62 + home.fans.regional * 0.06) * interest * oppFactor * compFactor * noise * (0.85 + home.economy * 0.15) * away_from_home;
  const big = away ? isBigGame(w, home, away) : false;
  const promo = compType === 'league' && isPromoNight(w, home, roundIndex);
  const seats = seatsAvailable(w, home);
  const tk = home.ticketing;
  const zones = {} as GameDemand['zones'];
  let attendance = 0;
  let ticketRevenue = 0;
  let capacity = 0;
  for (const z of SEAT_ZONES) {
    let price = tk.prices[z];
    if (big) price *= 1 + tk.bigGameMarkup;
    if (compType === 'playoffs' || compType === 'promo') price *= 1 + tk.playoffMarkup;
    if (promo && z !== 'premium') price *= 0.6;
    const ref = refPrice(w, home, z);
    let demand = base * ZONE_SHARE[z] * priceDemand(ref, price, ELASTICITY[z]);
    if (tk.studentDiscount && z === 'general') demand *= 1.06;
    const cap = seats[z];
    const holders = Math.min(cap, tk.seasonSold[z]);
    const singleCap = cap - holders;
    if (tk.dynamicPricing) {
      const ratio = (demand - holders * 0.9) / Math.max(1, singleCap);
      if (ratio > 1.1) {
        const bump = Math.min(1.35, ratio);
        price *= bump;
        demand = base * ZONE_SHARE[z] * priceDemand(ref, price, ELASTICITY[z]);
      } else if (ratio < 0.6) {
        price *= 0.88;
        demand = base * ZONE_SHARE[z] * priceDemand(ref, price, ELASTICITY[z]);
      }
    }
    const singleDemand = Math.max(0, demand - holders * 0.9);
    const sold = Math.floor(Math.min(singleCap, singleDemand));
    const revenue = sold * price;
    zones[z] = { price: Math.round(price * 100) / 100, demand: Math.round(demand), capacity: cap, seasonHolders: holders, sold, revenue };
    attendance += sold + Math.round(holders * 0.9);
    ticketRevenue += revenue;
    capacity += cap;
  }
  const concessions = attendance * spendPerHead(w, home) + zones.premium.sold * home.arena.levels.hospitality * 6;
  return { zones, attendance, capacity, ticketRevenue, concessions, promo, bigGame: big };
}

export function spendPerHead(w: World, c: Club): number {
  const t = tier(w, c);
  const l = c.arena.levels;
  const pricing = c.concessions.pricing === 'premium' ? 1.2 : c.concessions.pricing === 'value' ? 0.82 : 1;
  const margin = c.concessions.localSuppliers ? 0.4 : 0.48;
  // flat per-head extras keep stands and a bar worthwhile even where spend per head is low
  const gross = SPEND_PER_HEAD[t] * (0.55 + l.concessions * 0.12) * pricing + l.concessions * 0.35 + l.restaurant * 0.9;
  return gross * margin * (0.85 + c.economy * 0.15);
}

export function opsCostPerGame(w: World, c: Club): number {
  const t = tier(w, c);
  const cap = c.arena.seats.general + c.arena.seats.lower + c.arena.seats.premium;
  return OPS_PER_GAME[t] * (0.6 + cap / 12000) + (c.arena.owned ? 0 : c.arena.rentPerGame);
}

export function travelCost(w: World, c: Club): number {
  return TRAVEL_PER_AWAY[tier(w, c)];
}

/** Non-matchday income of the arena restaurant & bar (events, lunches, weddings), per year. */
export const RESTAURANT_EVENTS: Record<number, number> = { 0: 90000, 1: 60000, 2: 22000, 3: 10000 };
export function restaurantEvents(w: World, c: Club, level = c.arena.levels.restaurant): number {
  return Math.round(level * RESTAURANT_EVENTS[tier(w, c)] * (0.7 + c.economy * 0.3) * (0.8 + Math.min(1.6, Math.sqrt(c.population / 150_000)) * 0.2));
}

// ---------------------------------------------------------------------------
// Season tickets
// ---------------------------------------------------------------------------
export function seasonTicketTarget(w: World, c: Club): Record<SeatZone, number> {
  const last = c.history[c.history.length - 1];
  const lastWin = last ? last.wins / Math.max(1, last.wins + last.losses) : 0.5;
  const momentum = last?.promoted ? 0.25 : last?.relegated ? -0.2 : 0;
  const base = c.fans.local * (c.fans.loyalty / 100) * (0.65 + lastWin * 0.5 + (c.fans.hype - 50) / 200 + momentum);
  const seats = c.arena.seats;
  const out = {} as Record<SeatZone, number>;
  for (const z of SEAT_ZONES) {
    const refSeason = refPrice(w, c, z) * 15 * 0.8;
    const d = base * ZONE_SHARE[z] * 0.9 * Math.pow(refSeason / Math.max(1, c.ticketing.seasonPrices[z]), ELASTICITY[z] * 1.1);
    out[z] = Math.floor(clamp(d, 0, seats[z] * 0.85));
  }
  return out;
}

export function suiteDemand(w: World, c: Club): number {
  const t = tier(w, c);
  const ref = SUITE_REF[t] * c.economy * (0.7 + c.prestige / 200);
  const corp = (c.population / 1e6) * 8 + c.prestige / 10;
  const d = corp * Math.pow(ref / Math.max(1000, c.ticketing.suitePrice), 1.1) * (0.7 + c.arena.levels.hospitality * 0.1);
  return Math.floor(clamp(d, 0, c.arena.suites));
}

// ---------------------------------------------------------------------------
// Merchandise
// ---------------------------------------------------------------------------
export const MERCH_LINES: Record<MerchLine, { label: string; appeal: number; setup: number }> = {
  home: { label: 'Home jersey', appeal: 1, setup: 0 },
  away: { label: 'Away jersey', appeal: 0.5, setup: 0 },
  retro: { label: 'Retro collection', appeal: 0.3, setup: 15000 },
  city: { label: 'City edition', appeal: 0.35, setup: 20000 },
  european: { label: 'European nights collection', appeal: 0.3, setup: 25000 },
  signature: { label: 'Player signature line', appeal: 0.4, setup: 30000 },
  kids: { label: 'Kids range', appeal: 0.3, setup: 10000 },
  lifestyle: { label: 'Lifestyle & streetwear', appeal: 0.35, setup: 35000 },
};

export const REF_JERSEY: Record<number, number> = { 0: 85, 1: 75, 2: 55, 3: 45 };

export function merchDemandUnits(w: World, c: Club): number {
  const f = c.fans;
  const t = tier(w, c);
  const lines = c.merch.lines.reduce((a, l) => a + MERCH_LINES[l].appeal, 0);
  const lineFactor = Math.sqrt(lines);
  const store = 0.5 + c.arena.levels.store * 0.15 + c.arena.levels.onlineStore * 0.12;
  const ref = REF_JERSEY[t] * c.economy;
  const priceFactor = Math.pow(ref / Math.max(10, c.merch.jerseyPrice), 1.3);
  const base = f.local * 0.12 + f.regional * 0.04 + f.national * 0.04 + f.international * 0.06 + f.digital * 0.006;
  const hype = 0.6 + f.hype / 120;
  const star = 1 + Math.max(0, starPower(w, c)) * (c.merch.lines.includes('signature') ? 1.5 : 0.6);
  const euro = c.merch.lines.includes('european') && inEuro(w, c) ? 1.08 : 1;
  return Math.round(base * hype * lineFactor * store * priceFactor * star * euro * (c.facilities ? arenaStoreFactor(w, c) : 1));
}

export function merchUnitCost(c: Club) {
  return c.merch.jerseyPrice * 0.36;
}

export function inventoryUnits(w: World, c: Club): number {
  const mult = c.merch.inventory === 'lean' ? 0.75 : c.merch.inventory === 'deep' ? 1.35 : 1.0;
  return Math.round(merchDemandUnits(w, c) * mult);
}

export function inEuro(w: World, c: Club) {
  const e = getComp(w, `EURO-${w.season}`);
  return !!e?.clubIds.includes(c.id);
}

// ---------------------------------------------------------------------------
// Sponsors / TV / grants
// ---------------------------------------------------------------------------
export const SLOT_INFO: Record<SponsorSlot, { label: string; weight: number }> = {
  shirt: { label: 'Main shirt sponsor', weight: 1 },
  shirtSecondary: { label: 'Sleeve sponsor', weight: 0.22 },
  shirtBack: { label: 'Back of shirt', weight: 0.25 },
  training: { label: 'Training kit', weight: 0.16 },
  naming: { label: 'Arena name', weight: 0.7 },
  court: { label: 'Centre court & LED ribbon', weight: 0.3 },
  local1: { label: 'Courtside fence ads (sideline)', weight: 0.12 },
  local2: { label: 'Courtside fence ads (baseline)', weight: 0.1 },
  local3: { label: 'Concourse & entrance boards', weight: 0.08 },
  digital: { label: 'Digital & streaming partner', weight: 0.18 },
  app: { label: 'Official app partner', weight: 0.12 },
};

const SHIRT_BASE: Record<number, number> = { 0: 1_600_000, 1: 850_000, 2: 85_000, 3: 22_000 };
const REF_FANS: Record<number, number> = { 0: 150000, 1: 80000, 2: 12000, 3: 6000 };

export function exposure(f: Fanbase): number {
  return f.local + f.regional * 0.5 + f.national * 1.0 + f.international * 1.5 + f.digital * 0.15;
}

export function sponsorBenchmark(w: World, c: Club, slot: SponsorSlot): number {
  const t = tier(w, c);
  const fans = exposure(c.fans) / REF_FANS[t];
  let v = SHIRT_BASE[t] * SLOT_INFO[slot].weight * (0.45 + c.prestige / 100) * Math.pow(Math.max(0.15, fans), 0.55) * (0.8 + c.economy * 0.2);
  if (slot === 'digital') v *= clamp(c.fans.digital / (exposure(c.fans) * 1.2), 0.5, 2);
  if (slot === 'naming' && !c.arena.owned) v *= 0.6;
  if (inEuro(w, c) && (slot === 'shirt' || slot === 'court')) v *= 1.12;
  return Math.round(v / 1000) * 1000;
}

const CENTRAL_TV_FOREIGN = 2_000_000;

export function centralTvAnnual(w: World, c: Club, rank?: number): number {
  if (!c.leagueId) return CENTRAL_TV_FOREIGN;
  const rules = w.rules.leagues[c.leagueId];
  const n = rules.teams;
  const pos = rank ?? Math.round(n / 2);
  return Math.round(rules.centralTv + rules.centralTvMerit * ((n - pos) / (n - 1)));
}

export const BROADCASTER_PROFILE: Record<BroadcasterKind, { money: number; reach: number; digital: number; desc: string }> = {
  public: { money: 0.7, reach: 85, digital: 30, desc: 'Free-to-air: modest fee, broad national reach and fan growth.' },
  payTV: { money: 1.35, reach: 35, digital: 25, desc: 'Pay TV: the biggest guarantee, but a small audience limits fan growth.' },
  streamer: { money: 0.9, reach: 50, digital: 85, desc: 'Streaming platform: grows young digital fans; mid-level cash.' },
  regional: { money: 0.55, reach: 40, digital: 20, desc: 'Regional channel: strengthens the local and regional base; low fee.' },
  global: { money: 1.1, reach: 70, digital: 60, desc: 'Global platform: international exposure, demanding production obligations.' },
};

export function localTvBenchmark(w: World, c: Club): number {
  const t = tier(w, c);
  const base = t === 1 ? 450_000 : t === 2 ? 45_000 : t === 3 ? 8_000 : 600_000;
  return Math.round((base * (0.4 + c.prestige / 90) * Math.pow(Math.max(0.2, exposure(c.fans) / REF_FANS[t]), 0.5)) / 1000) * 1000;
}

export function municipalGrant(w: World, c: Club): number {
  const t = tier(w, c);
  if (t === 0 || c.leagueId === 'COLLEGE') return 0;
  const base = t === 1 ? 120_000 : t === 2 ? 150_000 : 110_000;
  const pop = Math.min(1.6, Math.sqrt(c.population / 150_000));
  const community = 1 + (c.campaigns.some((x) => x.kind === 'community' || x.kind === 'schoolClinics') ? 0.15 : 0);
  return Math.round((base * pop * community * (0.6 + c.fans.sentiment / 125)) / 1000) * 1000;
}

// ---------------------------------------------------------------------------
// Annual revenue estimate (forecasting, AI budgeting, board budget)
// ---------------------------------------------------------------------------
export interface RevenueEstimate {
  tickets: number;
  seasonTickets: number;
  suites: number;
  concessions: number;
  merch: number;
  sponsors: number;
  tv: number;
  grants: number;
  prize: number;
  total: number;
}

export function homeGamesEstimate(w: World, c: Club): number {
  if (!c.leagueId) return 9;
  const n = w.rules.leagues[c.leagueId].teams - 1;
  return n + (inEuro(w, c) ? 7 : 0) + 1;
}

export function estimateRevenue(w: World, c: Club): RevenueEstimate {
  const homeGames = homeGamesEstimate(w, c);
  const avgOpp = { prestige: c.leagueId ? avgLeaguePrestige(w, c.leagueId) : 75, rivals: [] as number[], id: -1 } as unknown as Club;
  const st = c.ticketing.seasonSold;
  const stTarget = w.day <= buildCalendar(w.season).seasonTicketDeadline ? seasonTicketTarget(w, c) : st;
  const holders = Object.fromEntries(SEAT_ZONES.map((z) => [z, Math.min(c.arena.seats[z], Math.max(st[z], stTarget[z]))])) as Record<SeatZone, number>;
  const seasonTickets = SEAT_ZONES.reduce((a, z) => a + holders[z] * c.ticketing.seasonPrices[z], 0);
  // single-ticket demand per game with the expected season-ticket holders already in their seats
  const saved = c.ticketing.seasonSold;
  c.ticketing.seasonSold = holders;
  const d = gameDemand(w, c, avgOpp, 'league', 1);
  c.ticketing.seasonSold = saved;
  const suitesSold = Math.max(c.ticketing.suitesSold, suiteDemand(w, c));
  const merchUnits = merchDemandUnits(w, c);
  const shopF = c.shop ? annualShopForecast(w, c) : null;
  const merch = shopF ? shopF.merchGross : merchUnits * c.merch.jerseyPrice * 0.75 - merchUnits * merchUnitCost(c);
  const sponsors = c.sponsors.reduce((a, s) => a + s.annual, 0);
  const tv = centralTvAnnual(w, c) + (c.tv?.annual ?? 0);
  const grants = municipalGrant(w, c);
  const events = c.foreign ? 0 : c.shop ? offDayIncome(w, c).revenue * 12 * 0.32 + (shopF!.foodProfit - d.concessions * homeGames) : restaurantEvents(w, c);
  const total = d.ticketRevenue * homeGames + seasonTickets + suitesSold * c.ticketing.suitePrice + d.concessions * homeGames + events + merch + sponsors + tv + grants;
  return {
    tickets: Math.round(d.ticketRevenue * homeGames),
    seasonTickets: Math.round(seasonTickets),
    suites: suitesSold * c.ticketing.suitePrice,
    concessions: Math.round(d.concessions * homeGames + events),
    merch: Math.round(merch),
    sponsors,
    tv,
    grants,
    prize: 0,
    total: Math.round(total),
  };
}

const prestigeCache = new Map<string, number>();
export function avgLeaguePrestige(w: World, leagueId: string): number {
  const key = `${w.season}-${leagueId}`;
  const c = prestigeCache.get(key);
  if (c != null) return c;
  const cl = w.clubs.filter((x) => x.leagueId === leagueId);
  const v = cl.reduce((a, x) => a + x.prestige, 0) / Math.max(1, cl.length);
  prestigeCache.set(key, v);
  return v;
}

export function opponentOf(w: World, id: number): Club {
  return getClub(w, id);
}
