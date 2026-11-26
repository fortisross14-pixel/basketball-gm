import { Rng } from './rng';
import type { Club, Competition, Fixture, LedgerCat, NewsItem, NewsTag, Player, Staff, World, DelegationLogEntry, Department, HoldKind } from './types';
import { absDay } from './types';
import { OUTLETS } from './data/names';

// ---------------------------------------------------------------------------
// Fast lookups. Indices are rebuilt lazily per World object and kept in sync
// by the add* helpers below.
// ---------------------------------------------------------------------------
interface Index {
  players: Map<number, Player>;
  clubs: Map<number, Club>;
  staff: Map<number, Staff>;
  fixtures: Map<number, Fixture>;
  fixturesByDay: Map<number, Fixture[]>;
  comps: Map<string, Competition>;
  nPlayers: number;
  nStaff: number;
  nFixtures: number;
  nComps: number;
}

const indexCache = new WeakMap<World, Index>();

function buildIndex(w: World): Index {
  const idx: Index = {
    players: new Map(w.players.map((p) => [p.id, p])),
    clubs: new Map(w.clubs.map((c) => [c.id, c])),
    staff: new Map(w.staff.map((s) => [s.id, s])),
    fixtures: new Map(w.fixtures.map((f) => [f.id, f])),
    fixturesByDay: new Map(),
    comps: new Map(w.competitions.map((c) => [c.id, c])),
    nPlayers: w.players.length,
    nStaff: w.staff.length,
    nFixtures: w.fixtures.length,
    nComps: w.competitions.length,
  };
  for (const f of w.fixtures) {
    const arr = idx.fixturesByDay.get(f.day);
    if (arr) arr.push(f);
    else idx.fixturesByDay.set(f.day, [f]);
  }
  indexCache.set(w, idx);
  return idx;
}

export function idx(w: World): Index {
  const i = indexCache.get(w);
  if (!i || i.nPlayers !== w.players.length || i.nStaff !== w.staff.length || i.nFixtures !== w.fixtures.length || i.nComps !== w.competitions.length) {
    return buildIndex(w);
  }
  return i;
}

export function invalidateIndex(w: World) {
  indexCache.delete(w);
}

export const player = (w: World, id: number) => idx(w).players.get(id)!;
export const club = (w: World, id: number) => idx(w).clubs.get(id)!;
export const staffById = (w: World, id: number) => idx(w).staff.get(id)!;
export const fixture = (w: World, id: number) => idx(w).fixtures.get(id)!;
export const comp = (w: World, id: string) => idx(w).comps.get(id);
export const fixturesOnDay = (w: World, day: number) => idx(w).fixturesByDay.get(day) ?? [];

export function rng(w: World): Rng {
  return new Rng(w as unknown as { rng: number });
}

export function nextId(w: World): number {
  return w.nextId++;
}

export function userClub(w: World): Club | null {
  return w.user.clubId == null ? null : club(w, w.user.clubId);
}

export function isUser(w: World, clubId: number | null | undefined): boolean {
  return clubId != null && w.user.clubId === clubId;
}

export function roster(w: World, clubId: number): Player[] {
  return w.players.filter((p) => p.teamId === clubId && !p.academy && !p.retired);
}

export function academy(w: World, clubId: number): Player[] {
  return w.players.filter((p) => p.teamId === clubId && p.academy && !p.retired);
}

export function freeAgents(w: World): Player[] {
  return w.players.filter((p) => p.teamId === null && !p.retired);
}

export function clubStaff(w: World, clubId: number): Staff[] {
  return w.staff.filter((s) => s.teamId === clubId);
}

export function staffOf(w: World, c: Club, role: keyof Club['staff']): Staff | null {
  const id = c.staff[role];
  return id == null ? null : staffById(w, id) ?? null;
}

/** Staff rating (0-100) with a weak default if the post is vacant. */
export function staffRating(w: World, c: Club, role: keyof Club['staff'], vacant = 25): number {
  const s = staffOf(w, c, role);
  return s ? s.rating : vacant;
}

export function age(w: World, p: { born: number }): number {
  return w.season - p.born;
}

export function domesticClubs(w: World): Club[] {
  return w.clubs.filter((c) => !c.foreign);
}

export function isCollege(c: Club | null | undefined): boolean {
  return !!c && c.leagueId === 'COLLEGE';
}

export function tierOf(w: World, c: Club): number {
  return c.leagueId ? w.rules.leagues[c.leagueId].tier : 0;
}

export function leagueClubs(w: World, leagueId: string): Club[] {
  return w.clubs.filter((c) => c.leagueId === leagueId);
}

export function today(w: World): number {
  return absDay(w);
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
export function book(w: World, c: Club, cat: LedgerCat, amount: number) {
  if (!amount) return;
  c.finances.cash += amount;
  const t = (c.finances.seasonTotals[w.season] ??= {});
  t[cat] = (t[cat] ?? 0) + amount;
}

export function seasonTotal(c: Club, season: number, cat: LedgerCat): number {
  return c.finances.seasonTotals[season]?.[cat] ?? 0;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
export function addNews(
  w: World,
  headline: string,
  body: string,
  opts: { tags?: NewsTag[]; clubIds?: number[]; playerIds?: number[]; importance?: number; outlet?: string } = {},
): NewsItem {
  const r = rng(w);
  const tags = opts.tags ?? ['league'];
  let outlet = opts.outlet;
  if (!outlet) {
    if (tags.includes('fans')) outlet = r.pick(OUTLETS.fan);
    else if (opts.clubIds?.some((id) => isUser(w, id)) && r.chance(0.5)) outlet = r.pick(OUTLETS.local);
    else outlet = r.pick(OUTLETS.national);
  }
  const item: NewsItem = {
    id: nextId(w),
    day: absDay(w),
    season: w.season,
    outlet,
    headline,
    body,
    tags,
    clubIds: opts.clubIds ?? [],
    playerIds: opts.playerIds ?? [],
    importance: opts.importance ?? 1,
    read: false,
  };
  w.news.unshift(item);
  if (w.news.length > 600) w.news.length = 600;
  return item;
}

export function logDelegation(w: World, dept: Department, staff: string, action: string, rationale: string, expected: string) {
  const e: DelegationLogEntry = { id: nextId(w), day: absDay(w), dept, staff, action, rationale, expected };
  w.delegationLog.unshift(e);
  if (w.delegationLog.length > 400) w.delegationLog.length = 400;
}

export function hold(w: World, kind: HoldKind, message: string) {
  if (!w.settings.holds[kind]) return;
  w.pendingHolds.push({ kind, message, day: absDay(w) });
}

export function playerName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

export function shortName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0]}. ${p.lastName}`;
}

export function fmtMoney(v: number, signed = false): string {
  const sign = v < 0 ? '-' : signed && v > 0 ? '+' : '';
  const a = Math.abs(v);
  let s: string;
  if (a >= 1e6) s = `€${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  else if (a >= 1e3) s = `€${Math.round(a / 1e3)}k`;
  else s = `€${Math.round(a)}`;
  return sign + s;
}
