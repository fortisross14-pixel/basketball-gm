import type { Player, Position, RatingKey, Ratings, World, Region, AgentStyle, Club, RolePromise } from './types';
import { RATING_KEYS } from './types';
import { Rng, clamp } from './rng';
import { NAME_POOLS } from './data/names';
import { age, nextId, rng, staffRating, club as getClub } from './world';
import { buildCalendar, dayOfDate } from './calendar';

// ---------------------------------------------------------------------------
// Overall rating — position-aware weighted blend of skills.
// ---------------------------------------------------------------------------
const W_GUARD: Partial<Record<RatingKey, number>> = { ins: 0.08, mid: 0.09, thr: 0.14, ft: 0.04, pas: 0.13, hnd: 0.13, reb: 0.03, pdef: 0.1, idef: 0.02, stl: 0.05, blk: 0.01, spd: 0.08, str: 0.02, jmp: 0.04, end: 0.04, iq: 0.12 };
const W_WING: Partial<Record<RatingKey, number>> = { ins: 0.1, mid: 0.09, thr: 0.13, ft: 0.03, pas: 0.07, hnd: 0.07, reb: 0.07, pdef: 0.1, idef: 0.06, stl: 0.04, blk: 0.03, spd: 0.06, str: 0.05, jmp: 0.06, end: 0.04, iq: 0.1 };
const W_BIG: Partial<Record<RatingKey, number>> = { ins: 0.16, mid: 0.05, thr: 0.05, ft: 0.03, pas: 0.05, hnd: 0.03, reb: 0.15, pdef: 0.03, idef: 0.14, stl: 0.02, blk: 0.08, spd: 0.03, str: 0.09, jmp: 0.06, end: 0.04, iq: 0.09 };

function weightsFor(pos: Position) {
  return pos === 'PG' || pos === 'SG' ? W_GUARD : pos === 'SF' ? W_WING : W_BIG;
}

export function computeOvr(r: Ratings, pos: Position): number {
  const wts = weightsFor(pos);
  let s = 0;
  let t = 0;
  for (const k of RATING_KEYS) {
    const wt = wts[k] ?? 0;
    s += r[k] * wt;
    t += wt;
  }
  // stretch: raw blend clusters around the mean; widen so stars separate.
  const raw = s / t;
  return Math.round(clamp(50 + (raw - 50) * 1.25, 1, 99));
}

export function updateOvr(p: Player) {
  p.ovr = computeOvr(p.ratings, p.pos);
}

// ---------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------
type Archetype = 'playmaker' | 'scorer' | 'shooter' | 'slasher' | '3andD' | 'stretch' | 'rimProtector' | 'post' | 'rebounder' | 'balanced';

const ARCH_BY_POS: Record<Position, Archetype[]> = {
  PG: ['playmaker', 'playmaker', 'scorer', 'shooter', 'balanced'],
  SG: ['shooter', 'scorer', 'slasher', '3andD', 'balanced'],
  SF: ['3andD', 'slasher', 'scorer', 'shooter', 'balanced'],
  PF: ['stretch', 'rebounder', 'post', 'balanced', '3andD'],
  C: ['rimProtector', 'post', 'rebounder', 'stretch', 'balanced'],
};

const ARCH_MOD: Record<Archetype, Partial<Record<RatingKey, number>>> = {
  playmaker: { pas: 16, hnd: 14, iq: 8, spd: 6, reb: -8, blk: -10, str: -6, idef: -8 },
  scorer: { mid: 10, ins: 8, hnd: 8, thr: 6, pdef: -6, reb: -4 },
  shooter: { thr: 16, ft: 12, mid: 8, ins: -6, str: -6, reb: -6, blk: -8 },
  slasher: { ins: 14, spd: 10, jmp: 10, hnd: 4, thr: -8, mid: -4 },
  '3andD': { thr: 10, pdef: 14, stl: 8, pas: -6, hnd: -4, mid: -4 },
  stretch: { thr: 14, mid: 8, ft: 6, ins: -4, blk: -6, str: -6 },
  rimProtector: { blk: 18, idef: 16, reb: 10, jmp: 6, thr: -16, mid: -10, hnd: -10, pas: -6 },
  post: { ins: 16, str: 12, reb: 6, thr: -14, spd: -8, hnd: -6 },
  rebounder: { reb: 18, str: 10, idef: 6, jmp: 6, thr: -12, mid: -6, pas: -6 },
  balanced: {},
};

const POS_BASE: Record<Position, Partial<Record<RatingKey, number>>> = {
  PG: { hnd: 10, pas: 10, spd: 8, thr: 4, reb: -14, blk: -16, idef: -12, str: -10, ins: -6 },
  SG: { thr: 6, hnd: 4, spd: 4, mid: 4, reb: -10, blk: -12, idef: -8, str: -6 },
  SF: { pdef: 2, jmp: 2, reb: -2, blk: -4 },
  PF: { reb: 8, str: 6, idef: 6, blk: 4, spd: -6, hnd: -8, pas: -6, thr: -4 },
  C: { reb: 14, str: 12, idef: 12, blk: 12, ins: 6, spd: -12, hnd: -16, pas: -10, thr: -12, mid: -4 },
};

const HEIGHT: Record<Position, [number, number]> = { PG: [180, 193], SG: [188, 198], SF: [196, 205], PF: [201, 209], C: [206, 218] };

export function randomPosition(r: Rng): Position {
  return r.weighted<Position>(['PG', 'SG', 'SF', 'PF', 'C'], [20, 21, 21, 20, 18]);
}

/** Generate a ratings vector whose ovr lands close to `target`. */
export function generateRatings(r: Rng, pos: Position, target: number, arch?: Archetype): Ratings {
  const a = arch ?? r.pick(ARCH_BY_POS[pos]);
  const base = POS_BASE[pos];
  const mod = ARCH_MOD[a];
  const ratings = {} as Ratings;
  for (const k of RATING_KEYS) {
    ratings[k] = target + (base[k] ?? 0) + (mod[k] ?? 0) + r.normal(0, 6);
  }
  // iterate to target
  for (let i = 0; i < 6; i++) {
    const o = computeOvr(clampRatings(ratings), pos);
    const diff = target - o;
    if (Math.abs(diff) < 1) break;
    for (const k of RATING_KEYS) ratings[k] += diff * 0.8;
  }
  return clampRatings(ratings);
}

function clampRatings(r: Ratings): Ratings {
  const out = {} as Ratings;
  for (const k of RATING_KEYS) out[k] = Math.round(clamp(r[k], 15, 99));
  return out;
}

// ---------------------------------------------------------------------------
// Player generation
// ---------------------------------------------------------------------------
export interface GenOpts {
  targetOvr: number;
  age: number;
  region?: Region;
  country?: string;
  pos?: Position;
  potBoost?: number;
}

const AGENT_FIRST = ['Agencia', 'Grupo', 'Gestión', 'Sports', 'Pro', 'Elite'];
const AGENT_LAST = ['Baloncesto Total', 'Iberia Talent', 'Continental Hoops', 'Atlántico Sports', 'Prime Court', 'Norte Representación', 'Mediterráneo Group', 'Hoops Global', 'BEN Management', 'Cancha Agency'];

export function pickPool(r: Rng, region?: Region, country?: string) {
  let pools = NAME_POOLS;
  if (country) pools = pools.filter((p) => p.country === country);
  else if (region) pools = pools.filter((p) => p.region === region);
  if (!pools.length) pools = NAME_POOLS;
  return r.weighted(pools, pools.map((p) => p.weight));
}

export function generatePlayer(w: World, opts: GenOpts): Player {
  const r = rng(w);
  const pool = pickPool(r, opts.region, opts.country);
  const pos = opts.pos ?? randomPosition(r);
  const ratings = generateRatings(r, pos, opts.targetOvr);
  const ovr = computeOvr(ratings, pos);
  const a = opts.age;
  const growth = a <= 19 ? r.normal(16, 7) : a <= 22 ? r.normal(10, 5) : a <= 25 ? r.normal(4, 3) : a <= 28 ? r.normal(1, 1.5) : 0;
  const pot = Math.round(clamp(Math.max(ovr, ovr + growth + (opts.potBoost ?? 0)), 1, 99));
  const [hMin, hMax] = HEIGHT[pos];
  const agentStyle: AgentStyle = r.pick(['relationship', 'hardline', 'cash', 'empowerment', 'development', 'media']);
  const p: Player = {
    id: nextId(w),
    firstName: r.pick(pool.first),
    lastName: r.pick(pool.last),
    nationality: pool.country,
    region: pool.region,
    homegrown: pool.region === 'ESP' || (a <= 20 && r.chance(0.15)),
    born: w.season - a,
    heightCm: Math.round(r.float(hMin, hMax)),
    pos,
    ratings,
    ovr,
    pot,
    personality: {
      workEthic: r.int(20, 95),
      clutch: r.int(20, 95),
      leadership: r.int(10, 95),
      loyalty: r.int(10, 95),
      adaptability: r.int(20, 95),
      greed: r.int(10, 95),
      ambition: r.int(15, 95),
      ego: r.int(10, 95),
    },
    injuryProne: r.int(5, 80),
    agent: { name: `${r.pick(AGENT_FIRST)} ${r.pick(AGENT_LAST)}`, style: agentStyle },
    teamId: null,
    academy: false,
    contract: null,
    loan: null,
    morale: 65,
    freshness: 100,
    form: 0,
    injury: null,
    stats: [],
    career: [],
    jersey: r.int(0, 55),
    retired: false,
    hallOfFame: false,
    originClubId: null,
    value: 0,
    transferListed: false,
    untouchable: false,
    minutesExpectation: 20,
    seasonMinutes: 0,
    awards: [],
    joinedDay: 0,
  };
  p.value = marketValue(w, p);
  return p;
}

// ---------------------------------------------------------------------------
// Economics: salaries and market values
// ---------------------------------------------------------------------------

/** Baseline market salary for a given overall (EUR / year). */
export function baseSalary(ovr: number): number {
  return Math.round(clamp(6000 * Math.exp((ovr - 35) * 0.135), 5000, 9_000_000) / 1000) * 1000;
}

/** NIL payment for a college athlete (scholarship costs are part of the academy/ops budget). */
export function nilSalary(ovr: number): number {
  return Math.max(2000, Math.round(baseSalary(ovr) * 0.12 / 500) * 500);
}

/** Seasons of eligibility left for a player of this age (college players are 18–22). */
export function eligibilityYears(age: number): number {
  return Math.max(1, Math.min(4, 23 - age));
}

export function salaryAsk(w: World, p: Player, forClub?: Club): number {
  const a = age(w, p);
  const effective = a <= 23 ? p.ovr * 0.75 + p.pot * 0.25 : p.ovr;
  if (forClub?.leagueId === 'COLLEGE') return nilSalary(effective);
  let s = baseSalary(effective);
  s *= 0.85 + p.personality.greed / 333; // 0.88 – 1.13
  if (a >= 33) s *= 0.75;
  if (p.agent.style === 'cash' || p.agent.style === 'hardline') s *= 1.08;
  // unsigned free agents get nervous as the season approaches and lower their demands
  if (!p.contract && p.teamId == null) s *= freeAgentDiscount(w);
  if (forClub) {
    // stars ask a premium to drop down a level
    const tier = forClub.leagueId ? w.rules.leagues[forClub.leagueId].tier : 1;
    if (tier >= 2 && p.ovr >= 62) s *= 1.15;
  }
  return Math.round(s / 1000) * 1000;
}

/** 1.0 in early summer → 0.7 by the start of the league → 0.65 during the season. */
export function freeAgentDiscount(w: World): number {
  const cal = buildCalendar(w.season);
  if (w.day >= cal.seasonEnd) return 1;
  const from = dayOfDate(w.season, w.season, 7, 10); // 10 Aug (months are 0-based)
  const to = cal.leagueRoundDays[0];
  if (w.day <= from) return 1;
  if (w.day >= to) return 0.65;
  return 1 - 0.3 * ((w.day - from) / Math.max(1, to - from));
}

export function marketValue(w: World, p: Player): number {
  const a = age(w, p);
  const effective = a <= 24 ? p.ovr * 0.6 + p.pot * 0.4 : p.ovr;
  let v = baseSalary(effective) * 1.6;
  if (a <= 21) v *= 1.6;
  else if (a <= 24) v *= 1.3;
  else if (a >= 31) v *= 0.6;
  if (a >= 34) v *= 0.4;
  const yearsLeft = p.contract ? p.contract.expires - w.season + 1 : 0;
  if (!p.contract) v *= 0.15; // free agents have no fee value
  else v *= 0.55 + Math.min(yearsLeft, 4) * 0.18;
  if (p.injury && p.injury.severity === 'major') v *= 0.7;
  return Math.round(v / 1000) * 1000;
}

export function refreshValue(w: World, p: Player) {
  p.value = marketValue(w, p);
}

export function roleFor(rank: number): RolePromise {
  if (rank === 0) return 'star';
  if (rank < 5) return 'starter';
  if (rank < 9) return 'rotation';
  return 'bench';
}

export const ROLE_MINUTES: Record<RolePromise, number> = { star: 30, starter: 25, rotation: 17, bench: 8, prospect: 6 };
export const ROLE_LABEL: Record<RolePromise, string> = { star: 'Franchise player', starter: 'Starter', rotation: 'Rotation', bench: 'Bench', prospect: 'Prospect' };

// ---------------------------------------------------------------------------
// Development & ageing (run once per season + small in-season ticks)
// ---------------------------------------------------------------------------
export function developmentEnv(w: World, p: Player): number {
  if (p.teamId == null) return 0.85;
  const c = getClub(w, p.teamId);
  if (!c) return 0.85;
  const coach = staffRating(w, c, 'headCoach');
  const dev = staffRating(w, c, 'assistantDev');
  const training = c.arena.levels.training;
  const academy = p.academy ? c.arena.levels.academy : 0;
  const ad = p.academy ? staffRating(w, c, 'academyDirector') : 50;
  const focus = c.training.focus === 'development' ? 0.06 : 0;
  const coachingExec = w.user.background === 'coach' && w.user.clubId === p.teamId ? 0.04 : 0;
  return coachingExec + 0.75 + coach / 500 + dev / 350 + training * 0.04 + academy * 0.04 + ad / 1000 + focus;
}

/** Annual progression. Returns delta in ovr. */
export function progressPlayer(w: World, p: Player, r: Rng): number {
  const a = age(w, p);
  const before = p.ovr;
  const env = developmentEnv(w, p);
  const work = 0.7 + p.personality.workEthic / 170;
  const minutes = Math.min(1.25, 0.6 + p.seasonMinutes / 1200);
  let delta: number;
  if (a <= 22) {
    const gap = Math.max(0, p.pot - p.ovr);
    delta = gap * r.float(0.18, 0.42) * env * work * minutes + r.normal(0, 1.5);
  } else if (a <= 26) {
    const gap = Math.max(0, p.pot - p.ovr);
    delta = gap * r.float(0.2, 0.5) * env * work * minutes + r.normal(0, 1.2);
  } else if (a <= 29) {
    delta = r.normal(0.2, 1.2) * env;
  } else if (a <= 32) {
    delta = r.normal(-1.6, 1.3);
  } else {
    delta = r.normal(-3.2, 1.6);
  }
  applyDelta(p, delta, a, r);
  updateOvr(p);
  // potential converges as players mature
  if (a >= 27) p.pot = Math.max(p.ovr, Math.round(p.pot * 0.6 + p.ovr * 0.4));
  else p.pot = Math.max(p.pot, p.ovr);
  // late bloomers / busts
  if (a <= 24 && r.chance(0.05)) p.pot = Math.round(clamp(p.pot + r.int(3, 8), 1, 99));
  if (a <= 24 && r.chance(0.05)) p.pot = Math.max(p.ovr, p.pot - r.int(3, 8));
  return p.ovr - before;
}

function applyDelta(p: Player, delta: number, a: number, r: Rng) {
  for (const k of RATING_KEYS) {
    let d = delta * r.float(0.5, 1.5);
    // athletic decline hits first, skill/IQ hold longer
    if (delta < 0 && (k === 'spd' || k === 'jmp' || k === 'end')) d *= 1.5;
    if (delta < 0 && (k === 'iq' || k === 'ft' || k === 'thr' || k === 'pas')) d *= 0.4;
    if (delta > 0 && a <= 22 && (k === 'iq')) d *= 1.2;
    p.ratings[k] = Math.round(clamp(p.ratings[k] + d, 15, 99));
  }
}

/** Small weekly in-season development driven by training focus. */
export function trainingTick(w: World, p: Player, r: Rng, focus: string, intensity: string) {
  const a = age(w, p);
  if (a > 26 || p.injury) return;
  const gap = p.pot - p.ovr;
  if (gap <= 0) return;
  const env = developmentEnv(w, p);
  const int = intensity === 'hard' ? 1.35 : intensity === 'light' ? 0.6 : 1;
  const chance = 0.06 * env * int * (0.6 + p.personality.workEthic / 120) * Math.min(1.5, gap / 8);
  if (!r.chance(chance)) return;
  const keysByFocus: Record<string, RatingKey[]> = {
    offense: ['ins', 'mid', 'pas', 'hnd'],
    defense: ['pdef', 'idef', 'stl', 'blk'],
    shooting: ['thr', 'mid', 'ft'],
    conditioning: ['end', 'spd', 'str'],
    tactical: ['iq', 'pas'],
    development: [...RATING_KEYS],
    balanced: [...RATING_KEYS],
  };
  const k = r.pick(keysByFocus[focus] ?? RATING_KEYS);
  p.ratings[k] = Math.min(99, p.ratings[k] + 1);
  updateOvr(p);
}

export function retirementCheck(w: World, p: Player, r: Rng): boolean {
  const a = age(w, p);
  if (a < 32) return false;
  let chance = (a - 31) * 0.12;
  if (p.ovr >= 70) chance *= 0.5;
  if (p.teamId == null) chance += 0.25;
  if (p.injury?.severity === 'major') chance += 0.15;
  return r.chance(clamp(chance, 0, a >= 40 ? 1 : 0.95));
}

/** Expected minutes per game based on role rank and personality. */
export function expectedMinutes(rank: number, p: Player): number {
  const base = ROLE_MINUTES[roleFor(rank)];
  return Math.round(base * (0.85 + p.personality.ego / 400));
}

export function potentialLabel(pot: number): string {
  if (pot >= 80) return 'Franchise talent';
  if (pot >= 72) return 'Future star';
  if (pot >= 65) return 'High-level starter';
  if (pot >= 58) return 'Solid starter';
  if (pot >= 50) return 'Rotation player';
  return 'Depth piece';
}

/** Scouted view of ratings for the user. Knowledge 0-100. */
export function scoutedRange(trueVal: number, knowledge: number, seed: number): [number, number] {
  const width = Math.round((100 - knowledge) / 6); // up to ±16
  const offset = ((seed * 9301 + 49297) % 233280) / 233280 - 0.5; // stable bias
  const center = trueVal + Math.round(offset * width);
  return [Math.max(1, center - width), Math.min(99, center + width)];
}

export function heightStr(cm: number): string {
  return `${(cm / 100).toFixed(2)} m`;
}

export const RATING_LABEL: Record<RatingKey, string> = {
  ins: 'Finishing', mid: 'Mid-range', thr: 'Three-point', ft: 'Free throw', pas: 'Passing', hnd: 'Ball handling',
  reb: 'Rebounding', pdef: 'Perimeter D', idef: 'Interior D', stl: 'Steals', blk: 'Shot blocking', spd: 'Speed',
  str: 'Strength', jmp: 'Vertical', end: 'Endurance', iq: 'Basketball IQ',
};

export const RATING_EFFECT: Record<RatingKey, string> = {
  ins: 'Make probability on shots at the rim; also draws shooting fouls.',
  mid: 'Make probability on pull-ups and mid-range jumpers; more relevant vs drop coverage.',
  thr: 'Make probability and willingness to take threes; spacing for teammates in pace-and-space.',
  ft: 'Free-throw percentage, and late-game value when the opponent fouls.',
  pas: 'Assist rate and shot quality created for teammates; lowers turnovers in motion offence.',
  hnd: 'Turnover resistance under pressure; key for pick-and-roll handlers.',
  reb: 'Share of available rebounds won on both ends.',
  pdef: 'Reduces make probability of guards/wings he guards; key in switch schemes.',
  idef: 'Reduces finishing at the rim; key in drop and pack-the-paint schemes.',
  stl: 'Probability of forcing live-ball turnovers (leads to fast breaks).',
  blk: 'Probability of blocking shots at the rim and mid-range.',
  spd: 'Transition scoring and fast-break chances; perimeter defensive recovery.',
  str: 'Post scoring, rebounding position and finishing through contact.',
  jmp: 'Finishing, rebounding and shot blocking.',
  end: 'Energy drain per minute: affects how long he holds his level on court.',
  iq: 'Decision quality: fewer turnovers, better shot selection, better help defence.',
};
