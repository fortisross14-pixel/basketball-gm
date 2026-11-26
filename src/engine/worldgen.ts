import type { Background, Club, Department, DelegationPolicy, ExecutiveStyle, LeagueId, Player, Region, Settings, Tactics, UserRole, World, StaffRole, SponsorSlot } from './types';
import { CLUB_SEEDS, type ClubSeed } from './data/clubs';
import { SPONSOR_BRANDS, BROADCASTERS } from './data/names';
import { defaultRuleset } from './rules';
import { Rng, clamp } from './rng';
import { generatePlayer, baseSalary, roleFor, marketValue, updateOvr, nilSalary, eligibilityYears } from './player';
import { generateStaff, STAFF_ROLES } from './staff';
import { generateBoard } from './board';
import { REF_PRICE, SUITE_REF, estimateRevenue, sponsorBenchmark, localTvBenchmark, BROADCASTER_PROFILE } from './economy';
import { payroll, operatingEstimate, proposeBudget } from './finance';
import { staffPayroll } from './staff';
import { maintenanceNeed } from './arena';
import { nextId, invalidateIndex, rng, club as getClub, roster, addNews, fmtMoney } from './world';
import { startSeason } from './season';
import { BACKGROUND_INFO } from './career';
import { ensureFacilities } from './facilities';
import { ensureShop } from './shop';
import { absDay } from './types';

export const SAVE_VERSION = 3;
export const START_SEASON = 2026;

export interface NewGameOptions {
  seed?: number;
  userName: string;
  nationality?: string;
  background?: Background;
  role: UserRole;
  clubId: number | null; // null = executive journey (unemployed)
  style: ExecutiveStyle;
  difficulty: Settings['difficulty'];
  worldNoise: Settings['worldNoise'];
  customClub?: { name: string; nickname: string; abbrev: string; city: string; colors: [string, string] } | null;
  scenario?: string | null;
}

export function defaultTactics(offPref?: Tactics['off'] | null, defPref?: Tactics['def'] | null): Tactics {
  return {
    off: offPref ?? 'motion',
    def: defPref ?? 'switch',
    pace: 'normal',
    rotation: 'balanced',
    threeEmphasis: 0,
    reboundEmphasis: 0,
    foulDiscipline: 0,
    starUsage: 0,
    starters: [],
    rotationOrder: [],
    minuteLimits: {},
  };
}

export function delegationPreset(style: ExecutiveStyle): Record<Department, DelegationPolicy> {
  const all = (mode: DelegationPolicy['mode']): DelegationPolicy => ({ mode });
  const base: Record<Department, DelegationPolicy> = {
    tactics: all('manual'),
    transfers: { mode: 'recommend', maxSalary: 0, maxFee: 0, minSellMultiple: 1.4 },
    scouting: all('policy'),
    tickets: all('manual'),
    sponsors: { mode: 'recommend', sponsorFloor: 0.9, excludedCategories: ['Betting', 'Crypto'] },
    marketing: { mode: 'recommend', spendCap: 0 },
    media: all('recommend'),
    medical: { mode: 'policy', riskTolerance: 30 },
    academy: all('policy'),
    board: all('manual'),
  };
  if (style === 'owner') {
    base.tactics = all('full');
    base.transfers = { mode: 'notify', maxSalary: 0, maxFee: 0, minSellMultiple: 1.3 };
    base.scouting = all('full');
    base.medical = { mode: 'full', riskTolerance: 30 };
    base.academy = all('full');
  } else if (style === 'gm') {
    base.tactics = all('recommend');
    base.tickets = all('policy');
    base.sponsors = { mode: 'policy', sponsorFloor: 0.9, excludedCategories: ['Betting', 'Crypto'] };
    base.marketing = { mode: 'policy', spendCap: 0 };
    base.media = all('notify');
  } else if (style === 'obsessive') {
    base.tactics = all('manual');
    base.transfers = { mode: 'manual', minSellMultiple: 1.5 };
    base.scouting = all('recommend');
    base.medical = { mode: 'recommend', riskTolerance: 30 };
  }
  return base;
}

function defaultSettings(seed: number, difficulty: Settings['difficulty'], noise: Settings['worldNoise']): Settings {
  return {
    worldNoise: noise,
    difficulty,
    holds: {
      userGame: false, decision: true, injury: true, boardUltimatum: true, budgetBreach: true, transferBid: true,
      contractExpiry: true, jobOffer: true, seasonEvent: true, projectComplete: true, windowClose: true,
    },
    seed,
    debugDeterministic: false,
    liveGames: true,
  };
}

const LEAGUE_OF_TIER: Record<number, LeagueId | null> = { 0: null, 1: 'ELITE', 2: 'ORO', 3: 'PLATA', 4: 'COLLEGE' };

export function createWorld(opts: NewGameOptions): World {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const w: World = {
    version: SAVE_VERSION,
    saveId: `bd-${seed}-${Date.now().toString(36)}`,
    saveName: '',
    createdAt: Date.now(),
    season: START_SEASON,
    day: 0,
    rng: seed >>> 0,
    rules: defaultRuleset(START_SEASON),
    clubs: [],
    players: [],
    staff: [],
    competitions: [],
    fixtures: [],
    games: [],
    news: [],
    decisions: [],
    delegationLog: [],
    transfers: [],
    sponsorOffers: {},
    tvOffers: [],
    projects: {},
    user: {
      name: opts.userName || 'Executive',
      nationality: opts.nationality ?? 'ESP',
      background: opts.background ?? 'business',
      approval: { board: 60, fans: 55, fanBonus: 0, lowFanWeeks: 0, history: [], notes: [] },
      role: opts.role,
      clubId: opts.clubId,
      reputation: 25,
      personalWealth: opts.role === 'owner' ? 1_500_000 : 0,
      style: opts.style,
      delegation: delegationPreset(opts.style),
      career: [],
      jobOffers: [],
      shortlist: [],
      scoutAssignments: [],
      negotiations: [],
      knowledge: {},
      pressStance: 0,
      unemployedSince: null,
    },
    settings: defaultSettings(seed, opts.difficulty, opts.worldNoise),
    awards: [],
    records: [],
    hallOfFame: [],
    nextId: 1,
    pendingHolds: [],
    gameOver: null,
    scenario: opts.scenario ?? null,
    lastWeekSummary: null,
    pendingMoves: [],
  };
  const r = rng(w);
  CLUB_SEEDS.forEach((seedC) => w.clubs.push(makeClub(w, r, seedC)));
  invalidateIndex(w);
  for (const c of w.clubs) {
    generateRoster(w, r, c);
    generateClubStaff(w, r, c);
  }
  // Rivalries: same region, or the two biggest clubs
  for (const c of w.clubs) {
    c.rivals = w.clubs.filter((o) => o.id !== c.id && !o.foreign && !c.foreign && o.region === c.region && Math.abs(o.prestige - c.prestige) < 35).map((o) => o.id).slice(0, 3);
  }
  // free agents & staff pool
  for (let i = 0; i < 150; i++) {
    const a = r.int(19, 35);
    const ovr = Math.round(clamp(r.normal(48, 8), 32, 68));
    const p = generatePlayer(w, { targetOvr: ovr, age: a });
    w.players.push(p);
  }
  generateRecruits(w, 45);
  for (const role of STAFF_ROLES) {
    for (let i = 0; i < 7; i++) w.staff.push(generateStaff(w, role, clamp(r.normal(50, 15), 20, 85), null, 2));
  }
  invalidateIndex(w);
  for (const c of w.clubs) {
    setupCommercial(w, r, c);
    c.board = generateBoard(w, c);
    calibrateFinances(w, r, c);
    if (!c.foreign) ensureFacilities(w, c);
  }
  w.user.clubId = null;
  startSeason(w);
  assignUser(w, opts);
  return w;
}

/** Post-generation: put the user in charge of a club (or leave them unemployed). */
export function assignUser(w: World, opts: Pick<NewGameOptions, 'userName' | 'role' | 'clubId' | 'style' | 'difficulty' | 'worldNoise' | 'customClub' | 'scenario' | 'nationality' | 'background'>) {
  w.user.name = opts.userName || 'Executive';
  if (opts.nationality) w.user.nationality = opts.nationality;
  if (opts.background) w.user.background = opts.background;
  w.user.role = opts.role;
  w.user.style = opts.style;
  w.user.delegation = delegationPreset(opts.style);
  w.user.personalWealth = opts.role === 'owner' ? 1_500_000 : 0;
  w.settings.difficulty = opts.difficulty;
  w.settings.worldNoise = opts.worldNoise;
  w.scenario = opts.scenario ?? null;
  w.user.clubId = opts.clubId;
  w.user.career = [];
  if (opts.customClub && opts.clubId != null) applyCustomClub(w, opts.clubId, opts.customClub);
  if (opts.clubId != null) {
    const c = getClub(w, opts.clubId);
    w.user.career.push({ clubId: c.id, clubName: c.name, role: opts.role, from: absDay(w), to: null, achievements: [], exit: null });
    for (const p of roster(w, c.id)) w.user.knowledge[p.id] = 100;
    w.user.reputation = c.leagueId === 'ELITE' ? 45 : c.leagueId === 'ORO' ? 30 : c.leagueId === 'COLLEGE' ? 20 + Math.round(c.prestige / 5) : 20;
    if (opts.role === 'owner') { c.board.owner = w.user.name; c.board.ownerWealth = 60; }
    applyStartSupport(w, c);
    if (!c.foreign) ensureShop(w, c);
    const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
    addNews(w, `${w.user.name} takes charge of ${c.name}`, `${c.board.owner} welcomes the new ${opts.role === 'owner' ? 'owner-president' : 'general manager'}. Vision: ${c.board.plan.vision}. The board has set ${c.board.objectives.length} objectives and a payroll budget of ${fmtMoney(c.finances.budget.payroll)}. ${rules ? `${rules.name}: ${rules.teams} clubs, max ${rules.maxNonEU} non-EU players, min ${rules.minHomegrown} homegrown.` : ''} The summer transfer window is open until 30 September.`, { tags: ['career', 'board'], clubIds: [c.id], importance: 3 });
  } else {
    w.user.unemployedSince = absDay(w);
    w.user.reputation = BACKGROUND_INFO[w.user.background].rep;
  }
  w.user.approval = { board: 60, fans: 55, fanBonus: 5, lowFanWeeks: 0, history: [], notes: [] };
  if (opts.scenario) applyScenario(w, opts.scenario);
  w.saveName = '';
}

/**
 * Difficulty support for the club the user starts with: cash cushion and board patience.
 * Applied when a club is picked directly and on the first job accepted in Career mode.
 */
export function applyStartSupport(w: World, c: Club) {
  const d = w.settings.difficulty;
  const fin = d === 'relaxed' ? 1.5 : d === 'demanding' ? 0.8 : d === 'brutal' ? 0.6 : 1;
  if (c.finances.cash > 0) c.finances.cash = Math.round(c.finances.cash * fin);
  else if (d === 'relaxed') c.finances.cash = Math.round(estimateRevenue(w, c).total * 0.05);
  c.board.patience = Math.min(100, Math.round(c.board.patience * (d === 'relaxed' ? 1.3 : d === 'brutal' ? 0.7 : 1)));
  c.finances.budget = proposeBudget(w, c);
}

function makeClub(w: World, r: Rng, s: ClubSeed): Club {
  const college = s.tier === 4;
  const tier = college ? 2 : s.tier; // college programs run on a tier-2 economic scale
  const local = Math.round(Math.sqrt(s.population) * 14 * (0.4 + s.prestige / 80));
  const general = Math.round(s.seats * 0.66 / 50) * 50;
  const lower = Math.round(s.seats * 0.28 / 50) * 50;
  const premium = s.seats - general - lower;
  const suites = tier === 1 || tier === 0 ? Math.round(s.seats / 600) : tier === 2 ? Math.round(s.seats / 2500) : 0;
  const lvl = (lo: number, hi: number) => r.int(lo, hi);
  const L = college ? (s.prestige >= 65 ? [3, 4] : s.prestige >= 45 ? [2, 3] : [1, 2]) : tier === 0 ? [3, 4] : tier === 1 ? [2, 3] : tier === 2 ? [1, 2] : [0, 1];
  const ref = REF_PRICE[tier];
  const priceMult = s.economy * (0.8 + s.prestige / 250);
  const prices = { general: Math.round(ref.general * priceMult), lower: Math.round(ref.lower * priceMult), premium: Math.round(ref.premium * priceMult) };
  const c: Club = {
    id: nextId(w),
    name: s.name,
    seedName: s.name,
    nickname: s.nickname,
    abbrev: s.abbrev,
    city: s.city,
    region: s.region,
    country: s.country,
    foreign: s.tier === 0,
    colors: s.colors,
    leagueId: LEAGUE_OF_TIER[s.tier],
    population: s.population,
    economy: s.economy,
    prestige: s.prestige,
    fans: {
      local,
      regional: Math.round(local * r.float(1.2, 1.8)),
      national: Math.round(local * Math.pow(s.prestige / 100, 2) * 3),
      international: Math.round(local * Math.pow(s.prestige / 100, 4) * 1.5),
      digital: Math.round(local * (s.prestige / 100 + 0.3) * 3),
      loyalty: r.int(50, 80),
      sentiment: 60,
      hype: 50,
    },
    finances: {
      cash: 0,
      loans: [],
      seasonTotals: {},
      cashHistory: [],
      budget: { payroll: 0, transfer: 0, staff: 0, marketing: 0, scouting: 0, medical: 0, maintenance: 0, academy: 0 },
      overdueDays: 0,
    },
    arena: {
      name: s.arena,
      seats: { general, lower, premium },
      suites,
      levels: {
        concessions: lvl(L[0], L[1]), restaurant: lvl(L[0] - 1 < 0 ? 0 : L[0] - 1, L[1] - 1 < 0 ? 0 : L[1] - 1), hospitality: tier <= 1 ? lvl(1, 3) : 0,
        store: lvl(L[0], L[1]), onlineStore: tier <= 1 ? lvl(1, 3) : r.int(0, 1), videoboard: lvl(L[0], L[1]), lockerRoom: lvl(L[0], L[1]),
        training: lvl(L[0], L[1]), medical: lvl(L[0], L[1]), academy: lvl(L[0], L[1]), accessibility: lvl(L[0], L[1]), parking: lvl(L[0], L[1]),
      },
      condition: r.int(55, 90),
      opened: START_SEASON - r.int(5, 40),
      owned: college || s.prestige >= 80,
      rentPerGame: college || s.prestige >= 80 ? 0 : tier === 1 ? 6000 : tier === 2 ? 1200 : 300,
    },
    ticketing: {
      prices,
      seasonPrices: { general: prices.general * 12, lower: prices.lower * 12, premium: prices.premium * 12 },
      seasonSold: { general: 0, lower: 0, premium: 0 },
      suitePrice: Math.round(SUITE_REF[tier] * s.economy * (0.7 + s.prestige / 200) / 500) * 500,
      suitesSold: 0,
      bigGameMarkup: 0.15,
      playoffMarkup: 0.25,
      dynamicPricing: false,
      protectSeasonHolders: true,
      promoNights: 'monthly',
      studentDiscount: true,
    },
    concessions: { pricing: 'standard', localSuppliers: false },
    merch: { lines: tier <= 1 ? ['home', 'away', 'retro', 'kids'] : ['home', 'away'], jerseyPrice: tier === 0 ? 85 : tier === 1 ? 75 : tier === 2 ? 55 : 45, inventory: 'normal', onlineShare: 0.3, stockValue: 0, orderedUnits: 0, signaturePlayerId: null },
    sponsors: [],
    tv: null,
    campaigns: [],
    staff: {},
    tactics: defaultTactics(),
    training: { focus: 'balanced', intensity: 'normal' },
    board: null as unknown as Club['board'],
    ai: { strategy: 'balanced', payrollTarget: 0 },
    cohesion: r.int(40, 70),
    rivals: [],
    history: [],
    trophies: [],
    retiredNumbers: [],
    founded: START_SEASON - r.int(20, 90),
  };
  return c;
}

function topTarget(c: Club, tier: number) {
  if (tier === 0) return 66 + c.prestige * 0.16;
  if (tier === 1) return 60 + c.prestige * 0.2;
  if (tier === 2) return 54 + c.prestige * 0.16;
  return 48 + c.prestige * 0.15;
}

function regionMix(c: Club, tier: number, r: Rng): Region[] {
  const n = 13;
  if (tier === 0) return r.shuffle([...Array(5).fill('LOCAL'), ...Array(4).fill('EU'), ...Array(4).fill('NONEU')]) as Region[];
  const nonEU = tier === 1 ? 3 : tier === 2 ? 2 : 1;
  const eu = tier === 1 ? 3 : tier === 2 ? 2 : 1;
  return [...Array(nonEU).fill('NONEU'), ...Array(eu).fill('EU'), ...Array(n - nonEU - eu).fill('ESP')] as Region[];
}

function generateRoster(w: World, r: Rng, c: Club) {
  if (c.leagueId === 'COLLEGE') return generateCollegeRoster(w, r, c);
  const tier = c.foreign ? 0 : w.rules.leagues[c.leagueId!].tier;
  const top = topTarget(c, tier);
  const regions = regionMix(c, tier, r);
  // non-EU imports tend to be the better players; ESP fill the depth
  const slots = Array.from({ length: 13 }, (_, i) => i);
  const posOrder = [...r.shuffle(['PG', 'SG', 'SF', 'PF', 'C'] as const as unknown as string[]), ...r.shuffle(['PG', 'SG', 'SF', 'PF', 'C'] as const as unknown as string[]), ...['PG', 'SF', 'C'].map(() => r.pick(['PG', 'SG', 'SF', 'PF', 'C']))];
  const regionByRank = tier === 0 ? regions : orderRegions(regions, r);
  for (const i of slots) {
    const target = Math.round(top - i * r.float(1.2, 2.0) + r.normal(0, 1.5));
    const a = i < 5 ? r.int(23, 32) : r.int(19, 34);
    const reg = regionByRank[i];
    const p = generatePlayer(w, {
      targetOvr: target,
      age: a,
      region: reg === ('LOCAL' as Region) ? undefined : reg,
      country: reg === ('LOCAL' as Region) ? c.country : undefined,
      pos: posOrder[i] as Player['pos'],
    });
    signInitial(w, r, p, c, i, tier);
    w.players.push(p);
  }
  if (!c.foreign) {
    for (let i = 0; i < 5; i++) {
      const lvlBonus = c.arena.levels.academy * 2;
      const p = generatePlayer(w, { targetOvr: Math.round(r.normal(30 + lvlBonus + (3 - tier) * 2, 4)), age: r.int(15, 18), region: 'ESP', potBoost: r.int(0, 6) });
      p.homegrown = true;
      p.teamId = c.id;
      p.academy = true;
      p.originClubId = c.id;
      p.contract = { salary: 3000, expires: w.season + 2, buyout: null, rolePromise: 'prospect', signedSeason: w.season, signingBonus: 0, youth: true };
      w.players.push(p);
    }
  }
}

function generateCollegeRoster(w: World, r: Rng, c: Club) {
  const top = 45 + c.prestige * 0.22;
  const pos = r.shuffle(['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SG', 'SF', 'PF'] as Player['pos'][]);
  for (let i = 0; i < 13; i++) {
    const a = r.int(18, 22);
    const intl = r.chance(0.18);
    const p = generatePlayer(w, { targetOvr: Math.round(top - i * r.float(1.0, 1.8) - (22 - a) * 0.8 + r.normal(0, 1.5)), age: a, country: intl ? undefined : 'USA', region: intl ? r.pick(['EU', 'NONEU'] as Region[]) : undefined, pos: pos[i], potBoost: Math.round(c.prestige / 20) });
    p.teamId = c.id;
    p.homegrown = false;
    p.contract = { salary: nilSalary(p.ovr), expires: w.season + eligibilityYears(a) - 1, buyout: null, rolePromise: roleFor(i), signedSeason: w.season - r.int(0, 2), signingBonus: 0 };
    p.morale = r.int(60, 80);
    p.joinedDay = absDay(w) - r.int(0, 700);
    p.value = marketValue(w, p);
    w.players.push(p);
  }
}

/** High-school class: unattached 18-year-olds that college programs recruit (pros may sign them too). */
export function generateRecruits(w: World, n: number) {
  const r = rng(w);
  for (let i = 0; i < n; i++) {
    const p = generatePlayer(w, { targetOvr: Math.round(clamp(r.normal(43, 6), 30, 62)), age: 18, country: r.chance(0.8) ? 'USA' : undefined, potBoost: r.int(0, 8) });
    w.players.push(p);
  }
}

function orderRegions(regions: Region[], r: Rng): Region[] {
  // place NONEU mostly among top 6, EU among top 9
  const out: Region[] = Array(13).fill('ESP');
  const nonEU = regions.filter((x) => x === 'NONEU').length;
  const eu = regions.filter((x) => x === 'EU').length;
  const free = Array.from({ length: 13 }, (_, i) => i);
  const take = (maxRank: number) => {
    const cands = free.filter((i) => i < maxRank);
    const pick = cands.length ? r.pick(cands) : free[0];
    free.splice(free.indexOf(pick), 1);
    return pick;
  };
  for (let i = 0; i < nonEU; i++) out[take(6)] = 'NONEU';
  for (let i = 0; i < eu; i++) out[take(10)] = 'EU';
  return out;
}

function signInitial(w: World, r: Rng, p: Player, c: Club, rank: number, tier: number) {
  p.teamId = c.id;
  const floor = tier === 1 || tier === 0 ? 40000 : tier === 2 ? 14000 : 7000;
  const salary = Math.max(floor, Math.round(baseSalary(p.ovr) * r.float(0.8, 1.15) / 1000) * 1000);
  p.contract = {
    salary,
    expires: w.season + r.int(0, 3),
    buyout: r.chance(0.4) ? Math.round(marketValue(w, { ...p, contract: { salary, expires: w.season + 2, buyout: null, rolePromise: 'starter', signedSeason: w.season, signingBonus: 0 } }) * r.float(1.6, 3) / 1000) * 1000 : null,
    rolePromise: roleFor(rank),
    signedSeason: w.season - r.int(0, 2),
    signingBonus: 0,
  };
  p.morale = r.int(55, 80);
  p.joinedDay = absDay(w) - r.int(0, 900);
  p.value = marketValue(w, p);
}

function generateClubStaff(w: World, r: Rng, c: Club) {
  const tier = c.foreign ? 0 : w.rules.leagues[c.leagueId!].tier;
  const base = tier === 0 ? 62 : tier === 1 ? 48 : tier === 2 ? 36 : 26;
  const roles: StaffRole[] = c.foreign ? ['headCoach', 'assistantOff', 'assistantDef', 'medicalLead', 'physio'] : STAFF_ROLES;
  for (const role of roles) {
    if (!c.foreign && tier === 3 && (role === 'analytics' || role === 'prLead') && r.chance(0.5)) continue; // small clubs lack some posts
    const s = generateStaff(w, role, clamp(r.normal(base + c.prestige * 0.3, 8), 15, 95), c.id, tier || 1);
    s.history.push({ season: w.season, teamId: c.id, role });
    w.staff.push(s);
    c.staff[role] = s.id;
    if (role === 'headCoach') c.tactics = defaultTactics(s.offPref, s.defPref);
  }
}

function setupCommercial(w: World, r: Rng, c: Club) {
  if (c.foreign) return;
  const tier = w.rules.leagues[c.leagueId!].tier;
  // Clubs start with a couple of partners; the rest of the inventory is sold during the game.
  const slots: SponsorSlot[] = ['shirt', 'local1'];
  if (tier === 1) slots.push('court');
  const used = new Set<string>();
  for (const slot of slots) {
    const b = r.pick(SPONSOR_BRANDS.filter((x) => !used.has(x.brand) && x.risk < 60));
    used.add(b.brand);
    c.sponsors.push({
      id: nextId(w), slot, brand: b.brand, category: b.category,
      annual: Math.round(sponsorBenchmark(w, c, slot) * r.float(0.8, 1.1) / 1000) * 1000,
      expires: w.season + r.int(0, 2), promoBonus: 0, titleBonus: 0, fit: r.int(40, 85), risk: b.risk, signedSeason: w.season - 1,
    });
  }
  if (tier === 1) {
    const b = r.pick(BROADCASTERS.filter((x) => x.kind === 'regional' || x.kind === 'public'));
    const prof = BROADCASTER_PROFILE[b.kind];
    c.tv = { id: nextId(w), broadcaster: b.name, kind: b.kind, annual: Math.round(localTvBenchmark(w, c) * prof.money / 1000) * 1000, expires: w.season + r.int(0, 2), reach: prof.reach, digitalBoost: prof.digital, exclusivity: false };
  }
}

/** Make initial books roughly sustainable so the world starts plausible. */
function calibrateFinances(w: World, r: Rng, c: Club) {
  const est = estimateRevenue(w, c).total;
  const costs = payroll(w, c) + staffPayroll(w, c) + operatingEstimate(w, c) + maintenanceNeed(w, c) + (c.leagueId === 'ELITE' ? 350000 : c.leagueId === 'ORO' ? 90000 : 30000);
  const gap = costs * r.float(0.97, 1.05) - est;
  if (gap > 0 && c.sponsors.length) {
    const scale = Math.min(2.2, 1 + gap / Math.max(1, c.sponsors.reduce((a, s) => a + s.annual, 0)));
    for (const s of c.sponsors) s.annual = Math.round(s.annual * scale / 1000) * 1000;
  }
  const rev2 = estimateRevenue(w, c).total;
  c.finances.cash = Math.round(rev2 * r.float(0.08, 0.2) + c.board.ownerWealth * 2000);
  if (c.foreign) c.finances.cash = 5_000_000;
  c.finances.cashHistory.push({ day: absDay(w), cash: c.finances.cash });
}

function applyCustomClub(w: World, clubId: number, cc: NonNullable<NewGameOptions['customClub']>) {
  const c = getClub(w, clubId);
  c.name = cc.name;
  c.nickname = cc.nickname;
  c.abbrev = cc.abbrev.toUpperCase().slice(0, 3);
  if (cc.city) c.city = cc.city;
  c.colors = cc.colors;
  c.arena.name = `Pabellón de ${c.city}`;
  c.history = [];
  c.founded = START_SEASON;
  c.prestige = Math.min(c.prestige, 22);
}

export const SCENARIOS: { id: string; name: string; description: string; tier: LeagueId }[] = [
  { id: 'bankrupt', name: 'On the Brink', description: 'A historic Liga Oro club with €-450k in the bank, a bank loan and a restless owner. Survive the season.', tier: 'ORO' },
  { id: 'tinyMarket', name: 'Smallest City, Biggest Dream', description: 'Take the smallest market in the Liga Plata and reach the Liga Oro within two seasons.', tier: 'PLATA' },
  { id: 'promotionPush', name: 'Promotion or Bust', description: 'Your owner spent big: a Liga Oro roster built to go up now, with a board that will not wait.', tier: 'ORO' },
  { id: 'eliteSurvival', name: 'Survival at the Top', description: 'Freshly promoted to the Liga Élite with the smallest budget in the league.', tier: 'ELITE' },
];

export function scenarioClub(w: World, id: string): number | null {
  const pick = (lid: LeagueId, f: (a: Club, b: Club) => number) => w.clubs.filter((c) => c.leagueId === lid).sort(f)[0]?.id ?? null;
  switch (id) {
    case 'bankrupt': return pick('ORO', (a, b) => b.prestige - a.prestige);
    case 'tinyMarket': return pick('PLATA', (a, b) => a.population - b.population);
    case 'promotionPush': return pick('ORO', (a, b) => b.population - a.population);
    case 'eliteSurvival': return pick('ELITE', (a, b) => a.prestige - b.prestige);
  }
  return null;
}

function applyScenario(w: World, id: string) {
  const c = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  if (!c) return;
  const r = rng(w);
  if (id === 'bankrupt') {
    c.finances.cash = -450000;
    c.finances.loans.push({ id: nextId(w), lender: 'Banco Regional', principal: 600000, balance: 600000, rate: 0.09, monthlyPayment: 19000, startDay: absDay(w), endDay: absDay(w) + 3 * 365, covenantDebtToRevenue: 1.2 });
    c.board.patience = 25;
    c.board.trust.finances = 30;
    c.board.objectives = c.board.objectives.filter((o) => o.kind !== 'profit' && o.kind !== 'maxLoss');
    c.board.objectives.push({ id: nextId(w), kind: 'profit', target: 0, label: 'Break even or better this season', weight: 3, status: 'pending', progress: 0 });
  } else if (id === 'promotionPush') {
    for (const p of roster(w, c.id).slice(0, 5)) {
      p.ratings = Object.fromEntries(Object.entries(p.ratings).map(([k, v]) => [k, Math.min(99, v + 4)])) as Player['ratings'];
      updateOvr(p);
    }
    c.finances.cash += 300000;
    c.board.patience = 15;
    c.board.ambition = 95;
    void r;
  } else if (id === 'eliteSurvival') {
    c.finances.cash = Math.round(c.finances.cash * 0.5);
  }
}
