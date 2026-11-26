// Club facilities beyond the arena bowl: sports facilities with responsible
// staff, commercial stores, and club offices (corporate & PR). Everything is
// stored in the optional `club.facilities` and initialised lazily, so older
// saves load unchanged.

import type { Club, ClubFacilities, ClubStore, MerchLine, OfficeKey, OwnedFacility, StaffRole, StoreKind, World, Staff } from './types';
import { absDay } from './types';
import { addNews, book, clubStaff, isUser, nextId, roster, academy, rng, staffById, tierOf, fmtMoney } from './world';
import { clamp } from './rng';
import { trainingTick } from './player';
import { REF_JERSEY, merchUnitCost, MERCH_LINES } from './economy';
import { fanReaction } from './career';
import type { ProjectOption } from './arena';

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
const DEFAULT_OFFICE: Record<number, number> = { 0: 4, 1: 4, 2: 3, 3: 2 };

export function ensureFacilities(w: World, c: Club): ClubFacilities {
  if (c.facilities) return c.facilities;
  const t = tierOf(w, c);
  const staffCount = clubStaff(w, c.id).length;
  // offices start just big enough for the staff the club already employs
  const corporate = clamp(Math.max(DEFAULT_OFFICE[t] ?? 2, Math.ceil((staffCount - BASE_CAPACITY) / PER_LEVEL)), 1, 5);
  const stores: ClubStore[] = [makeStore(w, c, 'arena')];
  if (c.arena.levels.onlineStore > 0) stores.push(makeStore(w, c, 'online'));
  const pr = t === 1 ? 2 : 1;
  c.facilities = { owners: {}, offices: { corporate, pr }, officeBase: { corporate, pr }, stores, lastPress: null, pressLog: [], usage: {} };
  return c.facilities;
}

function makeStore(w: World, c: Club, kind: StoreKind): ClubStore {
  return {
    id: nextId(w),
    kind,
    name: STORE_INFO[kind].name(c),
    level: 1,
    lines: kind === 'arena' || kind === 'online' ? c.merch.lines : (['home', 'away', 'kids'] as MerchLine[]),
    priceMult: kind === 'outlet' ? 0.8 : kind === 'airport' ? 1.15 : 1,
    stock: 'normal',
    managerId: null,
    openedDay: absDay(w),
    lastWeekSales: 0,
    lastWeekUnits: 0,
    seasonSales: 0,
  };
}

// ---------------------------------------------------------------------------
// Club offices & staff capacity
// ---------------------------------------------------------------------------
export const BASE_CAPACITY = 5;
export const PER_LEVEL = 2;

export const OFFICE_INFO: Record<OfficeKey, { label: string; desc: string; baseCost: number; weeks: number }> = {
  corporate: { label: 'Corporate offices', desc: 'Desks, meeting rooms and IT for the back office. Every level adds room for two more staff posts — the more posts you can fill, the more you can delegate.', baseCost: 70000, weeks: 8 },
  pr: { label: 'PR & communications office', desc: 'Press room, media team and studio. A better office makes every press conference land better and builds your relationship with the press.', baseCost: 50000, weeks: 6 },
};

export function staffCapacity(w: World, c: Club): number {
  return BASE_CAPACITY + ensureFacilities(w, c).offices.corporate * PER_LEVEL;
}

export function staffUsed(w: World, c: Club): number {
  return clubStaff(w, c.id).length;
}

/** Can a new (not replacement) staff post be filled? */
export function canAddStaff(w: World, c: Club): { ok: boolean; reason?: string } {
  const cap = staffCapacity(w, c);
  const used = staffUsed(w, c);
  if (used < cap) return { ok: true };
  return { ok: false, reason: `Your corporate offices have room for ${cap} staff and all ${used} desks are taken. Expand the offices (Infrastructure → Club facilities) or replace an existing member of staff.` };
}

const TIER_COST: Record<number, number> = { 0: 3, 1: 2.4, 2: 1, 3: 0.7 };

export function officeOptions(w: World, c: Club): ProjectOption[] {
  const f = ensureFacilities(w, c);
  const m = TIER_COST[tierOf(w, c)] ?? 1;
  const active = w.projects[c.id] ?? [];
  return (Object.keys(OFFICE_INFO) as OfficeKey[]).map((k) => {
    const lvl = f.offices[k];
    const info = OFFICE_INFO[k];
    return {
      kind: 'office',
      office: k,
      label: `${info.label} → level ${lvl + 1}`,
      description: info.desc,
      cost: Math.round(info.baseCost * Math.pow(1.6, lvl) * m),
      weeks: info.weeks + lvl * 2,
      disruption: 0,
      annualUpkeep: Math.round(12000 * (lvl + 1) * m),
      needsBoard: false,
      blocked: lvl >= 5 ? 'Maximum level reached' : active.some((p) => p.kind === 'office' && p.office === k) ? 'Already under construction' : undefined,
    } as ProjectOption;
  });
}

// ---------------------------------------------------------------------------
// Sports facilities: owners, capacity, weekly use
// ---------------------------------------------------------------------------
export const OWNED_INFO: Record<OwnedFacility, { label: string; roles: StaffRole[]; effect: string; capacityLabel: string }> = {
  training: { label: 'Training ground & gym', roles: ['assistantDev', 'headCoach', 'assistantOff', 'assistantDef', 'physio'], effect: 'Extra development sessions for players aged 25 or under.', capacityLabel: 'training slots' },
  academy: { label: 'Academy residence', roles: ['academyDirector', 'assistantDev'], effect: 'Extra development for academy players living on site.', capacityLabel: 'beds' },
  lockerRoom: { label: 'Locker room & recovery', roles: ['physio', 'medicalLead', 'headCoach'], effect: 'Faster weekly freshness recovery for the first-team squad.', capacityLabel: 'lockers' },
  medical: { label: 'Medical & rehab centre', roles: ['medicalLead', 'physio'], effect: 'Injured players recover faster through daily rehab.', capacityLabel: 'treatment beds' },
};
export const OWNED_KEYS = Object.keys(OWNED_INFO) as OwnedFacility[];

export function facilityCapacity(w: World, c: Club, k: OwnedFacility): { capacity: number; used: number } {
  const lvl = c.arena.levels[k];
  switch (k) {
    case 'training': return { capacity: 8 + lvl * 3, used: roster(w, c.id).length + Math.ceil(academy(w, c.id).length / 2) };
    case 'academy': return { capacity: 2 + lvl * 3, used: academy(w, c.id).length };
    case 'lockerRoom': return { capacity: 10 + lvl * 2, used: roster(w, c.id).length };
    case 'medical': return { capacity: 1 + lvl, used: roster(w, c.id).filter((p) => p.injury).length };
  }
}

/** How many facilities a staff member is already responsible for. */
function ownerLoad(c: Club, staffId: number): number {
  const f = c.facilities;
  return f ? Object.values(f.owners).filter((x) => x === staffId).length : 0;
}

export interface OwnerEffect {
  owner: Staff | null;
  effectiveness: number; // 0..1.15
  notes: string[];
}

export function ownerEffect(w: World, c: Club, k: OwnedFacility): OwnerEffect {
  const f = ensureFacilities(w, c);
  const id = f.owners[k];
  const s = id != null ? staffById(w, id) : null;
  const notes: string[] = [];
  if (!s || s.teamId !== c.id) {
    notes.push('No one is responsible: the facility runs at reduced effect.');
    return { owner: null, effectiveness: c.arena.levels[k] > 0 ? 0.35 : 0, notes };
  }
  let e = 0.55 + s.rating / 200; // 0.6 - 1.05
  if (!OWNED_INFO[k].roles.includes(s.role)) { e *= 0.6; notes.push(`${s.lastName} is not a specialist for this facility.`); }
  const load = ownerLoad(c, s.id);
  if (load > 1) { e *= 1 - (load - 1) * 0.15; notes.push(`${s.lastName} also runs ${load - 1} other facilit${load > 2 ? 'ies' : 'y'}.`); }
  const cap = facilityCapacity(w, c, k);
  if (cap.used > cap.capacity) { e *= cap.capacity / cap.used; notes.push(`Over capacity: ${cap.used} using ${cap.capacity} ${OWNED_INFO[k].capacityLabel}.`); }
  if (c.arena.levels[k] === 0) { e = 0; notes.push('Not built yet.'); }
  return { owner: s, effectiveness: clamp(e, 0, 1.15), notes };
}

export function assignOwner(w: World, c: Club, k: OwnedFacility, staffId: number | null) {
  const f = ensureFacilities(w, c);
  if (staffId == null) delete f.owners[k];
  else f.owners[k] = staffId;
}

function aiAssignOwners(w: World, c: Club) {
  const f = ensureFacilities(w, c);
  const staff = clubStaff(w, c.id);
  for (const k of OWNED_KEYS) {
    const cur = f.owners[k] != null ? staffById(w, f.owners[k]!) : null;
    if (cur && cur.teamId === c.id) continue;
    const best = staff.filter((s) => OWNED_INFO[k].roles.includes(s.role)).sort((a, b) => b.rating - a.rating)[0];
    if (best) f.owners[k] = best.id;
  }
}

/** Weekly: owners make sure facilities get used — the bonus each facility delivers. */
function weeklySportsFacilities(w: World, c: Club) {
  const f = ensureFacilities(w, c);
  if (!isUser(w, c.id)) aiAssignOwners(w, c);
  const r = rng(w);
  for (const k of OWNED_KEYS) {
    const lvl = c.arena.levels[k];
    const eff = ownerEffect(w, c, k).effectiveness;
    f.usage[k] = Math.round(eff * 100 / 1.15);
    if (lvl === 0 || eff <= 0) continue;
    const power = eff * (0.5 + lvl * 0.15);
    switch (k) {
      case 'training':
        for (const p of roster(w, c.id)) if (w.season - p.born <= 25 && !p.injury && r.chance(0.35 * power)) trainingTick(w, p, r, c.training.focus, c.training.intensity);
        break;
      case 'academy':
        for (const p of academy(w, c.id)) if (r.chance(0.4 * power)) trainingTick(w, p, r, 'development', 'normal');
        break;
      case 'lockerRoom':
        for (const p of roster(w, c.id)) p.freshness = Math.min(100, p.freshness + 1.5 * power);
        break;
      case 'medical':
        for (const p of roster(w, c.id)) if (p.injury && p.injury.daysOut > 1 && r.chance(0.6 * power)) p.injury.daysOut -= 1;
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const STORE_INFO: Record<StoreKind, { name: (c: Club) => string; label: string; desc: string; baseCost: number; weeks: number; rentWeek: number; buildable: boolean }> = {
  arena: { name: (c) => `${c.arena.name} Team Store`, label: 'Arena team store', desc: 'Sells to fans on matchday and around the arena.', baseCost: 0, weeks: 0, rentWeek: 0, buildable: false },
  online: { name: (c) => `${c.abbrev} Online Store`, label: 'Online store', desc: 'Ships to regional, national, international and digital fans.', baseCost: 0, weeks: 0, rentWeek: 0, buildable: false },
  city: { name: (c) => `${c.city} City Store`, label: 'City-centre store', desc: 'A flagship on the high street: reaches local and regional fans every day of the week.', baseCost: 90000, weeks: 6, rentWeek: 900, buildable: true },
  outlet: { name: (c) => `${c.abbrev} Outlet`, label: 'Outlet store', desc: 'Discount store in a retail park: clears old stock and reaches price-sensitive regional fans.', baseCost: 60000, weeks: 5, rentWeek: 500, buildable: true },
  airport: { name: (c) => `${c.abbrev} Airport Store`, label: 'Airport store', desc: 'Premium kiosk for travellers: national and international fans, high prices, high rent.', baseCost: 130000, weeks: 7, rentWeek: 1400, buildable: true },
};

export function storeOptions(w: World, c: Club): ProjectOption[] {
  const f = ensureFacilities(w, c);
  const m = TIER_COST[tierOf(w, c)] ?? 1;
  const active = w.projects[c.id] ?? [];
  const out: ProjectOption[] = [];
  for (const kind of ['city', 'outlet', 'airport'] as StoreKind[]) {
    const info = STORE_INFO[kind];
    const has = f.stores.some((s) => s.kind === kind);
    out.push({
      kind: 'store', storeKind: kind, label: `Open: ${info.label}`, description: `${info.desc} Rent ${fmtMoney(info.rentWeek * m)}/week.`,
      cost: Math.round(info.baseCost * m), weeks: info.weeks, disruption: 0, annualUpkeep: Math.round(info.rentWeek * m * 52), needsBoard: false,
      blocked: has ? 'Already open' : active.some((p) => p.kind === 'store' && p.storeKind === kind) ? 'Under construction' : undefined,
    } as ProjectOption);
  }
  for (const s of f.stores.filter((x) => STORE_INFO[x.kind].buildable)) {
    out.push({
      kind: 'storeUpgrade', storeId: s.id, label: `Refit ${s.name} → level ${s.level + 1}`, description: 'Bigger floor, better displays: more footfall and higher conversion.',
      cost: Math.round(STORE_INFO[s.kind].baseCost * 0.7 * Math.pow(1.5, s.level) * m), weeks: 4, disruption: 0, annualUpkeep: Math.round(STORE_INFO[s.kind].rentWeek * m * 15), needsBoard: false,
      blocked: s.level >= 3 ? 'Maximum level reached' : active.some((p) => p.kind === 'storeUpgrade' && p.storeId === s.id) ? 'Under construction' : undefined,
    } as ProjectOption);
  }
  return out;
}

export function managerFactor(w: World, s: ClubStore): number {
  if (s.managerId == null) return 0.85;
  const m = staffById(w, s.managerId);
  if (!m) return 0.85;
  const fit = m.role === 'marketingDirector' || m.role === 'commercialDirector' ? 1 : 0.7;
  return 0.85 + (m.rating / 400) * fit;
}

/** Expected weekly units for an extra (non-arena) store at current settings. */
export function storeWeeklyDemand(w: World, c: Club, s: ClubStore): number {
  const f = c.fans;
  const base = s.kind === 'city' ? f.local * 0.05 + f.regional * 0.02 : s.kind === 'outlet' ? f.regional * 0.03 + f.local * 0.01 : s.kind === 'airport' ? f.national * 0.04 + f.international * 0.08 + f.regional * 0.005 : 0;
  const lineFactor = Math.sqrt(s.lines.reduce((a, l) => a + MERCH_LINES[l].appeal, 0));
  const ref = (REF_JERSEY[tierOf(w, c)] ?? 55) * c.economy;
  const price = c.merch.jerseyPrice * s.priceMult;
  const priceFactor = Math.pow(ref / Math.max(10, price), s.kind === 'outlet' ? 1.6 : 1.2);
  const stock = s.stock === 'lean' ? 0.8 : s.stock === 'deep' ? 1.1 : 1;
  return (base / 52) * (0.6 + f.hype / 120) * lineFactor * (0.7 + s.level * 0.3) * priceFactor * stock * managerFactor(w, s);
}

function weeklyStores(w: World, c: Club) {
  const f = ensureFacilities(w, c);
  const r = rng(w);
  const m = TIER_COST[tierOf(w, c)] ?? 1;
  for (const s of f.stores) {
    if (!STORE_INFO[s.kind].buildable) continue;
    const units = storeWeeklyDemand(w, c, s) * r.float(0.85, 1.15);
    const price = c.merch.jerseyPrice * s.priceMult;
    const revenue = Math.round(units * price * 0.75);
    const cost = Math.round(units * merchUnitCost(c) * (s.stock === 'deep' ? 1.15 : 1));
    book(w, c, 'merch', revenue);
    book(w, c, 'merchCost', -cost);
    book(w, c, 'rent', -Math.round(STORE_INFO[s.kind].rentWeek * m));
    s.lastWeekSales = revenue;
    s.lastWeekUnits = Math.round(units);
    s.seasonSales += revenue;
  }
}

/** Called by commercial.weeklyMerch to attribute arena/online sales. */
export function recordArenaMerch(c: Club, revenue: number, units: number) {
  const f = c.facilities;
  if (!f) return;
  const online = f.stores.find((s) => s.kind === 'online');
  const arena = f.stores.find((s) => s.kind === 'arena');
  const share = online ? Math.min(0.8, 0.2 + c.arena.levels.onlineStore * 0.12) : 0;
  if (arena) { arena.lastWeekSales = Math.round(revenue * (1 - share)); arena.lastWeekUnits = Math.round(units * (1 - share)); arena.seasonSales += arena.lastWeekSales; arena.level = c.arena.levels.store; }
  if (online) { online.lastWeekSales = Math.round(revenue * share); online.lastWeekUnits = Math.round(units * share); online.seasonSales += online.lastWeekSales; online.level = c.arena.levels.onlineStore; }
}

/** Manager bonus applied to the arena/online merch demand. */
export function arenaStoreFactor(w: World, c: Club): number {
  const arena = c.facilities?.stores.find((s) => s.kind === 'arena');
  return arena ? managerFactor(w, arena) / 0.85 * 0.92 + 0.08 : 1;
}

export function completeFacilityProject(w: World, c: Club, p: { kind: string; office?: OfficeKey; storeKind?: StoreKind; storeId?: number }) {
  const f = ensureFacilities(w, c);
  if (p.kind === 'office' && p.office) f.offices[p.office] = Math.min(5, f.offices[p.office] + 1);
  if (p.kind === 'store' && p.storeKind) f.stores.push(makeStore(w, c, p.storeKind));
  if (p.kind === 'storeUpgrade' && p.storeId != null) {
    const s = f.stores.find((x) => x.id === p.storeId);
    if (s) s.level = Math.min(3, s.level + 1);
  }
}

/** Keep arena/online store entities in sync with the arena facility levels. */
function syncStores(w: World, c: Club) {
  const f = ensureFacilities(w, c);
  if (c.arena.levels.onlineStore > 0 && !f.stores.some((s) => s.kind === 'online')) f.stores.push(makeStore(w, c, 'online'));
  const arena = f.stores.find((s) => s.kind === 'arena');
  if (arena) arena.lines = c.merch.lines;
}

// ---------------------------------------------------------------------------
// Press conferences (PR office)
// ---------------------------------------------------------------------------
export type PressTopic = 'outlook' | 'results' | 'transfers' | 'fans';
export type PressStance = 'confident' | 'humble' | 'players' | 'demand' | 'deflect';

export const PRESS_TOPICS: Record<PressTopic, string> = {
  outlook: 'Season outlook',
  results: 'Recent results',
  transfers: 'Transfer plans',
  fans: 'Fans, prices & the club',
};

export const PRESS_STANCES: Record<PressStance, { label: string; desc: string }> = {
  confident: { label: 'Confident', desc: 'Raise hype and ambition — the press will hold you to it.' },
  humble: { label: 'Humble', desc: 'Manage expectations; calm board, little hype.' },
  players: { label: 'Back the players', desc: 'Public support lifts morale; some media call it denial.' },
  demand: { label: 'Demand more', desc: 'Fans like honesty; big egos may sulk.' },
  deflect: { label: 'Deflect', desc: 'Give nothing away. Safe, but the press notices.' },
};

export const PRESS_COOLDOWN = 10;

/** Effect multiplier of the PR office: office level, PR lead quality. */
export function prFactor(w: World, c: Club): number {
  const f = ensureFacilities(w, c);
  const lead = c.staff.prLead != null ? staffById(w, c.staff.prLead) : null;
  return clamp(0.55 + f.offices.pr * 0.15 + ((lead?.rating ?? 25) - 50) / 250, 0.4, 1.5);
}

export function pressAvailableIn(w: World, c: Club): number {
  const f = ensureFacilities(w, c);
  if (f.lastPress == null) return 0;
  return Math.max(0, f.lastPress + PRESS_COOLDOWN - absDay(w));
}

export function holdPressConference(w: World, c: Club, topic: PressTopic, stance: PressStance): { ok: boolean; message: string } {
  const f = ensureFacilities(w, c);
  const wait = pressAvailableIn(w, c);
  if (wait > 0) return { ok: false, message: `Your PR team advises waiting ${wait} more day${wait > 1 ? 's' : ''}: too many press conferences dilute the message.` };
  const k = prFactor(w, c);
  const r = rng(w);
  const sq = roster(w, c.id);
  const b = c.board.trust;
  let msg = '';
  const media = (d: number) => { b.media = clamp(b.media + d * (d > 0 ? k : 1 / k), 0, 100); };
  const lst = c.history[c.history.length - 1];
  void lst;
  switch (stance) {
    case 'confident':
      c.fans.hype = clamp(c.fans.hype + 5 * k, 0, 100);
      media(topic === 'results' ? -1 : 2);
      fanReaction(w, 2 * k, 'Confident words at the press conference');
      msg = topic === 'transfers' ? 'Headlines promise big moves — fans are excited, agents have noticed.' : 'Bold words make the headlines. Hype rises; expectations too.';
      break;
    case 'humble':
      c.fans.hype = clamp(c.fans.hype - 2, 0, 100);
      b.relationship = clamp(b.relationship + 2 * k, 0, 100);
      media(2);
      msg = 'Measured, realistic answers. The board appreciates the tone.';
      break;
    case 'players':
      for (const p of sq) p.morale = clamp(p.morale + 3 * k, 0, 100);
      media(topic === 'results' ? -2 : 1);
      msg = 'The locker room hears your support loud and clear.';
      break;
    case 'demand':
      for (const p of sq) p.morale = clamp(p.morale + (p.personality.ego > 65 ? -5 : 2), 0, 100);
      fanReaction(w, 3 * k, 'Demanded more from the players');
      media(1);
      msg = 'Supporters like the honesty; a couple of big egos do not.';
      break;
    case 'deflect':
      if (r.chance(0.45 / k)) { media(-3); msg = 'Reporters call it a non-answer: "No substance from the executive."'; }
      else { media(1); msg = 'Nothing quotable — the story moves on.'; }
      break;
  }
  if (topic === 'fans') { c.fans.sentiment = clamp(c.fans.sentiment + (stance === 'humble' || stance === 'demand' ? 2 : 0) * k, 0, 100); }
  f.lastPress = absDay(w);
  f.pressLog.unshift({ day: absDay(w), topic: PRESS_TOPICS[topic], stance: PRESS_STANCES[stance].label, result: msg });
  if (f.pressLog.length > 20) f.pressLog.length = 20;
  addNews(w, `Press conference: ${PRESS_TOPICS[topic].toLowerCase()}`, `${PRESS_STANCES[stance].label} tone. ${msg}`, { tags: ['media'], clubIds: [c.id], importance: 1 });
  return { ok: true, message: msg };
}

// ---------------------------------------------------------------------------
// Weekly hook (called once per week from daily.ts)
// ---------------------------------------------------------------------------
export function weeklyFacilities(w: World) {
  for (const c of w.clubs) {
    if (c.foreign) continue;
    syncStores(w, c);
    weeklySportsFacilities(w, c);
    weeklyStores(w, c);
    const f = ensureFacilities(w, c);
    const extra = Math.max(0, f.offices.corporate - (f.officeBase?.corporate ?? f.offices.corporate)) + Math.max(0, f.offices.pr - (f.officeBase?.pr ?? f.offices.pr));
    if (extra > 0) book(w, c, 'operations', -Math.round((12000 * extra * (TIER_COST[tierOf(w, c)] ?? 1)) / 52));
  }
}

/** Upkeep the facilities summary shows (arena maintenance + stores + offices). */
export function facilitiesUpkeep(w: World, c: Club): { stores: number; offices: number } {
  const f = ensureFacilities(w, c);
  const m = TIER_COST[tierOf(w, c)] ?? 1;
  const stores = f.stores.reduce((a, s) => a + STORE_INFO[s.kind].rentWeek * m * 52, 0);
  const extra = Math.max(0, f.offices.corporate - (f.officeBase?.corporate ?? f.offices.corporate)) + Math.max(0, f.offices.pr - (f.officeBase?.pr ?? f.offices.pr));
  const offices = Math.round(12000 * extra * m);
  return { stores: Math.round(stores), offices };
}
