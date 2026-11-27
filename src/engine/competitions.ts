import type { Competition, CompType, Fixture, LeagueId, Series, Standing, World } from './types';
import { buildCalendar, roundDaysFor } from './calendar';
import { activeLeagues } from './rules';
import { addNews, club, comp as getComp, fixture as getFixture, invalidateIndex, isUser, nextId, rng, hold } from './world';

export function emptyStanding(clubId: number): Standing {
  return { clubId, w: 0, l: 0, pf: 0, pa: 0, home: [0, 0], away: [0, 0], streak: 0, last10: [] };
}

export function sortStandings(st: Standing[]): Standing[] {
  return [...st].sort((a, b) => b.w - a.w || a.l - b.l || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf);
}

export function leagueComp(w: World, leagueId: LeagueId, season = w.season): Competition | undefined {
  return getComp(w, `${leagueId}-${season}`);
}

/** The group (conference) a club plays in inside a league competition, if any. */
export function groupKeyOf(cmp: Competition, clubId: number): string | null {
  if (!cmp.groups) return null;
  for (const [k, ids] of Object.entries(cmp.groups)) if (ids.includes(clubId)) return k;
  return null;
}

/** Sorted table the club is ranked in: its group, or the whole league. */
export function tableFor(cmp: Competition, clubId?: number): Standing[] {
  const g = clubId != null && cmp.kind === 'league' ? groupKeyOf(cmp, clubId) : null;
  const ids = g ? cmp.groups![g] : null;
  return sortStandings(ids ? cmp.standings.filter((s) => ids.includes(s.clubId)) : cmp.standings);
}

/** Every group's sorted table (one entry named '' for an ungrouped league). */
export function groupTables(cmp: Competition): [string, Standing[]][] {
  if (!cmp.groups || cmp.kind !== 'league') return [['', sortStandings(cmp.standings)]];
  return Object.entries(cmp.groups).sort((a, b) => a[0].localeCompare(b[0])).map(([k, ids]) => [k, sortStandings(cmp.standings.filter((s) => ids.includes(s.clubId)))]);
}

const winPct = (s: Standing) => s.w / Math.max(1, s.w + s.l);
/** Clubs at a given position (1-based) of every group, best record first. */
export function atPosition(cmp: Competition, pos: number): number[] {
  return groupTables(cmp).map(([, t]) => t[pos - 1]).filter(Boolean).sort((a, b) => winPct(b) - winPct(a) || b.pf - b.pa - (a.pf - a.pa)).map((s) => s.clubId);
}

export function rankIn(w: World, clubId: number): number {
  const c = club(w, clubId);
  if (!c.leagueId) return 0;
  const lc = leagueComp(w, c.leagueId);
  if (!lc) return 0;
  return tableFor(lc, clubId).findIndex((s) => s.clubId === clubId) + 1;
}

/** Standard bracket seed order: [1,8,4,5,2,7,3,6] for 8, so neighbours meet in the next round. */
export function bracketSeeds(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((x) => [x, m - x]);
  }
  return order;
}

/** Circle-method double round robin. Returns rounds of [home, away] pairs. */
export function roundRobin(ids: number[], shuffle: (a: number[]) => number[]): [number, number][][] {
  const teams = shuffle([...ids]);
  if (teams.length % 2) teams.push(-1);
  const n = teams.length;
  const rounds: [number, number][][] = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === -1 || b === -1) continue;
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const second = rounds.map((rd) => rd.map(([h, a]) => [a, h] as [number, number]));
  return [...rounds, ...second];
}

function addFixture(w: World, f: Omit<Fixture, 'id' | 'played' | 'cancelled' | 'result'>): Fixture {
  const fx: Fixture = { ...f, id: nextId(w), played: false, cancelled: false, result: null };
  w.fixtures.push(fx);
  return fx;
}

export function newCompetition(id: string, kind: Competition['kind'], name: string, season: number, clubIds: number[], leagueId?: LeagueId): Competition {
  return { id, kind, leagueId, name, season, clubIds, standings: kind === 'league' || kind === 'euro' ? clubIds.map(emptyStanding) : [], series: [], stage: kind === 'league' ? 'Regular season' : 'Round 1', champion: null, runnerUp: null, complete: false };
}

/** Create leagues (with fixtures) and the continental group stage for the season. */
export function createSeasonCompetitions(w: World) {
  const r = rng(w);
  const cal = buildCalendar(w.season);
  for (const lid of activeLeagues(w)) {
    const rules = w.rules.leagues[lid];
    const clubs = w.clubs.filter((c) => c.leagueId === lid);
    const ids = clubs.map((c) => c.id);
    const cmp = newCompetition(`${lid}-${w.season}`, 'league', `${rules.name} ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, ids, lid);
    w.competitions.push(cmp);
    const groups: Record<string, number[]> = {};
    if (rules.grouped) for (const c of clubs) (groups[c.group ?? 'A'] ??= []).push(c.id);
    else groups[''] = ids;
    if (rules.grouped) cmp.groups = groups;
    for (const [g, gids] of Object.entries(groups)) {
      const rounds = roundRobin(gids, (a) => r.shuffle(a));
      const days = roundDaysFor(w.season, rounds.length);
      rounds.forEach((pairs, ri) => {
        for (const [h, a] of pairs) addFixture(w, { day: days[ri], compId: cmp.id, comp: 'league', round: ri + 1, label: `${rules.short}${g ? ` ${g}` : ''} · Round ${ri + 1}`, homeId: h, awayId: a, neutral: false, seriesId: null });
      });
    }
  }
  createSupercopa(w);
  // Continental competition
  if (!w.clubs.some((c) => c.foreign && !c.leagueId)) { invalidateIndex(w); return; }
  const eliteIds = w.clubs.filter((c) => c.leagueId === 'ELITE');
  const ranked = [...eliteIds].sort((a, b) => {
    const ra = a.history.find((h) => h.season === w.season - 1 && h.leagueId === 'ELITE')?.rank ?? 50 - a.prestige / 3;
    const rb = b.history.find((h) => h.season === w.season - 1 && h.leagueId === 'ELITE')?.rank ?? 50 - b.prestige / 3;
    return ra - rb;
  });
  const domestic = ranked.slice(0, w.rules.euro.fromElite).map((c) => c.id);
  const foreign = w.clubs.filter((c) => c.foreign && !c.leagueId).sort((a, b) => b.prestige - a.prestige).slice(0, w.rules.euro.teams - domestic.length).map((c) => c.id);
  const all = [...domestic, ...foreign];
  const euro = newCompetition(`EURO-${w.season}`, 'euro', `EuroCup ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, all);
  // seeded groups (snake by prestige)
  const seeded = [...all].sort((a, b) => club(w, b).prestige - club(w, a).prestige);
  const A: number[] = [];
  const B: number[] = [];
  seeded.forEach((id, i) => ((i % 4 === 0 || i % 4 === 3) ? A : B).push(id));
  euro.groups = { A, B };
  euro.stage = 'Group stage';
  w.competitions.push(euro);
  for (const [g, ids] of Object.entries(euro.groups)) {
    const rounds = roundRobin(ids, (a) => r.shuffle(a));
    rounds.forEach((pairs, ri) => {
      for (const [h, a] of pairs) addFixture(w, { day: cal.euroGroupDays[ri], compId: euro.id, comp: 'euro', round: ri + 1, label: `EuroCup · Group ${g} · R${ri + 1}`, homeId: h, awayId: a, neutral: false, seriesId: null });
    });
  }
  invalidateIndex(w);
}

// ---------------------------------------------------------------------------
// Knockout helpers
// ---------------------------------------------------------------------------
function homePattern(bestOf: number): boolean[] {
  if (bestOf === 1) return [true];
  if (bestOf === 3) return [true, false, true];
  if (bestOf === 5) return [true, true, false, false, true];
  return Array.from({ length: bestOf }, (_, i) => i % 2 === 0);
}

function createSeries(w: World, cmp: Competition, round: string, roundIndex: number, high: number, low: number, bestOf: number, days: number[], compType: CompType, neutral = false): Series {
  const s: Series = { id: nextId(w), compId: cmp.id, round, roundIndex, bestOf, highSeed: high, lowSeed: low, winsHigh: 0, winsLow: 0, winner: null, fixtureIds: [], neutral };
  const pattern = homePattern(bestOf);
  for (let g = 0; g < bestOf; g++) {
    const highHome = pattern[g];
    const f = addFixture(w, {
      day: days[g],
      compId: cmp.id,
      comp: compType,
      round: roundIndex,
      label: `${cmp.name.replace(/ \d{4}-\d{2}$/, '')} · ${round}${bestOf > 1 ? ` · G${g + 1}` : ''}`,
      homeId: highHome ? high : low,
      awayId: highHome ? low : high,
      neutral,
      seriesId: s.id,
    });
    s.fixtureIds.push(f.id);
  }
  cmp.series.push(s);
  return s;
}

const seasonTag = (w: World) => `${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`;
export function roundName(teams: number): string {
  return teams === 2 ? 'Final' : teams === 4 ? 'Semifinal' : teams === 8 ? 'Quarterfinal' : `Round of ${teams}`;
}

/** A knockout bracket from seeded entrants (best first), series created in bracket order. */
function bracket(w: World, cmp: Competition, seeded: number[], bestOf: number, compType: CompType, neutral: boolean) {
  const n = seeded.length;
  cmp.adjacent = true;
  cmp.clubIds = seeded;
  cmp.stage = roundName(n);
  const order = bracketSeeds(n);
  for (let i = 0; i < n; i += 2) {
    const hi = seeded[order[i] - 1], lo = seeded[order[i + 1] - 1];
    createSeries(w, cmp, roundName(n), 0, hi, lo, bestOf, days0(cmp, bestOf, i / 2), compType, neutral);
  }
}
function days0(cmp: Competition, bestOf: number, i: number): number[] {
  const d = cmp.roundDays![0];
  if (bestOf === 1) return [d[Math.min(i, d.length - 1)] ?? d[0]];
  return d.slice(0, bestOf).length === bestOf ? d.slice(0, bestOf) : Array(bestOf).fill(d[0]);
}

const largestPow2 = (n: number) => (n >= 16 ? 16 : n >= 8 ? 8 : n >= 4 ? 4 : n >= 2 ? 2 : 0);

export function createCup(w: World) {
  const id = `CUP-${w.season}`;
  if (getComp(w, id)) return;
  const lc = leagueComp(w, 'ELITE');
  if (!lc) return;
  const top = sortStandings(lc.standings).slice(0, w.rules.cup.teams).map((s) => s.clubId);
  const cmp = newCompetition(id, 'cup', `Copa del Rey ${seasonTag(w)}`, w.season, top);
  const cal = buildCalendar(w.season);
  cmp.roundDays = [cal.cupDays.qf, [cal.cupDays.sf], [cal.cupDays.f]];
  w.competitions.push(cmp);
  bracket(w, cmp, top, 1, 'cup', true);
  invalidateIndex(w);
  addNews(w, `Copa del Rey draw: ${top.map((x) => club(w, x).abbrev).join(', ')} qualify`, 'The top eight at the halfway point meet in a four-day knockout at a neutral venue.', { tags: ['league'], importance: 2 });
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'You have qualified for the Copa del Rey!');
  createLowerCups(w);
}

/** Copa Princesa (Primera FEB: 1st v 2nd at halfway) and Copa España (Segunda FEB group leaders). */
function createLowerCups(w: World) {
  const cal = buildCalendar(w.season);
  const pf = leagueComp(w, 'ORO');
  if (pf && !getComp(w, `PRINCESA-${w.season}`)) {
    const top = sortStandings(pf.standings).slice(0, 2).map((s) => s.clubId);
    if (top.length === 2) {
      const cmp = newCompetition(`PRINCESA-${w.season}`, 'cup', `Copa Princesa de Asturias ${seasonTag(w)}`, w.season, top, 'ORO');
      cmp.roundDays = [[cal.cupDays.sf]];
      w.competitions.push(cmp);
      bracket(w, cmp, top, 1, 'cup', false);
      for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'You play the Copa Princesa de Asturias final!');
    }
  }
  const sf = leagueComp(w, 'PLATA');
  if (sf && !getComp(w, `ESPANA-${w.season}`)) {
    const entrants = sf.groups ? [...atPosition(sf, 1), ...atPosition(sf, 2)].slice(0, 4) : sortStandings(sf.standings).slice(0, 4).map((s) => s.clubId);
    if (entrants.length === 4) {
      const cmp = newCompetition(`ESPANA-${w.season}`, 'cup', `Copa España ${seasonTag(w)}`, w.season, entrants, 'PLATA');
      cmp.roundDays = [[cal.cupDays.qf[0], cal.cupDays.qf[0]], [cal.cupDays.f]];
      w.competitions.push(cmp);
      bracket(w, cmp, entrants, 1, 'cup', true);
      for (const cid of entrants) if (isUser(w, cid)) hold(w, 'seasonEvent', 'You qualified for the Copa España!');
    }
  }
  invalidateIndex(w);
}

/** Supercopa Endesa: four ACB clubs (last champion, Copa winner, then best finishers), a week before the league. */
export function createSupercopa(w: World) {
  const id = `SUPER-${w.season}`;
  if (getComp(w, id)) return;
  const acb = w.clubs.filter((c) => c.leagueId === 'ELITE');
  if (acb.length < 4) return;
  const prev = w.season - 1;
  const champ = getComp(w, `ELITE-PO-${prev}`)?.champion;
  const cup = getComp(w, `CUP-${prev}`)?.champion;
  const byRank = [...acb].sort((a, b) => (a.history.find((h) => h.season === prev)?.rank ?? 99 - a.prestige / 10) - (b.history.find((h) => h.season === prev)?.rank ?? 99 - b.prestige / 10)).map((c) => c.id);
  const entrants: number[] = [];
  for (const x of [champ, cup, ...byRank]) if (x != null && acb.some((c) => c.id === x) && !entrants.includes(x) && entrants.length < 4) entrants.push(x);
  const first = buildCalendar(w.season).leagueRoundDays[0];
  const cmp = newCompetition(id, 'cup', `Supercopa Endesa ${seasonTag(w)}`, w.season, entrants, 'ELITE');
  cmp.roundDays = [[first - 8, first - 8], [first - 7]];
  w.competitions.push(cmp);
  bracket(w, cmp, entrants, 1, 'cup', true);
}

export function createElitePlayoffs(w: World) {
  const id = `ELITE-PO-${w.season}`;
  if (getComp(w, id)) return;
  const lc = leagueComp(w, 'ELITE');
  if (!lc) return;
  const n = w.rules.leagues.ELITE.playoffTeams;
  const top = sortStandings(lc.standings).slice(0, n).map((s) => s.clubId);
  const cmp = newCompetition(id, 'playoffs', `Liga ACB Playoffs ${seasonTag(w)}`, w.season, top, 'ELITE');
  const p = buildCalendar(w.season).playoffStart;
  cmp.roundDays = [[p, p + 2, p + 4], [p + 7, p + 9, p + 11, p + 13, p + 15], [p + 18, p + 20, p + 22, p + 24, p + 26]];
  w.competitions.push(cmp);
  bracket(w, cmp, top, 3, 'playoffs', false);
  invalidateIndex(w);
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Your team has qualified for the title playoffs!');
}

/** NCAA Tournament: the best of every conference, single games at neutral sites. */
export function createCollegePlayoffs(w: World) {
  const id = `COLLEGE-PO-${w.season}`;
  const lc = leagueComp(w, 'COLLEGE');
  if (getComp(w, id) || !lc) return;
  const want = largestPow2(Math.min(w.rules.leagues.COLLEGE.playoffTeams, lc.clubIds.length));
  const perGroup = lc.groups ? Math.ceil(want / Object.keys(lc.groups).length) : want;
  const pool: number[] = [];
  for (let pos = 1; pos <= perGroup; pos++) pool.push(...(lc.groups ? atPosition(lc, pos) : [sortStandings(lc.standings)[pos - 1]?.clubId].filter((x): x is number => x != null)));
  const top = pool.slice(0, want);
  const cmp = newCompetition(id, 'playoffs', `NCAA Tournament ${seasonTag(w)}`, w.season, top, 'COLLEGE');
  const p = buildCalendar(w.season).playoffStart;
  cmp.roundDays = [[p + 1], [p + 3], [p + 5], [p + 7]].slice(0, Math.log2(want) || 1);
  w.competitions.push(cmp);
  bracket(w, cmp, top, 1, 'playoffs', true);
  invalidateIndex(w);
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Your program made the NCAA Tournament!');
}

/** NBA Playoffs: top eight of each conference, best of seven, conferences kept apart until the Finals. */
export function createNbaPlayoffs(w: World) {
  const id = `NBA-PO-${w.season}`;
  const lc = leagueComp(w, 'NBA');
  if (getComp(w, id) || !lc || !lc.groups) return;
  const confs = groupTables(lc);
  const seeded: number[] = [];
  const order = bracketSeeds(8);
  // build the 16-team bracket by hand: conference brackets back to back
  const cmp = newCompetition(id, 'playoffs', `NBA Playoffs ${seasonTag(w)}`, w.season, [], 'NBA');
  const p = buildCalendar(w.season).playoffStart;
  const r = (s: number) => Array.from({ length: 7 }, (_, i) => s + i);
  cmp.roundDays = [r(p), r(p + 7), r(p + 14), r(p + 21)];
  cmp.adjacent = true;
  cmp.stage = 'First round';
  w.competitions.push(cmp);
  for (const [, t] of confs.slice(0, 2)) {
    const top = t.slice(0, 8).map((s) => s.clubId);
    seeded.push(...top);
    for (let i = 0; i < 8; i += 2) createSeries(w, cmp, 'First round', 0, top[order[i] - 1], top[order[i + 1] - 1], 7, cmp.roundDays[0], 'playoffs', false);
  }
  cmp.clubIds = seeded;
  invalidateIndex(w);
}

/** Promotion playoff: entrants after the direct-promotion places (group by group in grouped leagues). */
export function createPromoPlayoffs(w: World, lid: LeagueId) {
  const id = `${lid}-PO-${w.season}`;
  if (getComp(w, id)) return;
  const rules = w.rules.leagues[lid];
  if (!rules?.playoffPromotion) return;
  const lc = leagueComp(w, lid);
  if (!lc) return;
  let entrants: number[];
  if (lc.groups) {
    const perGroup = Object.keys(lc.groups).length;
    const directPerGroup = Math.ceil(rules.directPromotion / perGroup);
    entrants = [];
    for (let pos = directPerGroup + 1; entrants.length < rules.playoffTeams && pos < 20; pos++) entrants.push(...atPosition(lc, pos));
    entrants = entrants.slice(0, rules.playoffTeams);
  } else {
    entrants = sortStandings(lc.standings).slice(rules.directPromotion, rules.directPromotion + rules.playoffTeams).map((s) => s.clubId);
  }
  const n = largestPow2(entrants.length);
  if (n < 2) return;
  entrants = entrants.slice(0, n);
  const cmp = newCompetition(id, 'promo', `${rules.name} Promotion Playoff ${seasonTag(w)}`, w.season, entrants, lid);
  const p = buildCalendar(w.season).promoStart;
  const rounds = Math.log2(n);
  cmp.roundDays = Array.from({ length: rounds }, (_, i) => [p + i * 7, p + i * 7 + 2, p + i * 7 + 4]);
  w.competitions.push(cmp);
  bracket(w, cmp, entrants, 3, 'promo', false);
  invalidateIndex(w);
  for (const cid of entrants) if (isUser(w, cid)) hold(w, 'seasonEvent', 'You are in the promotion playoff!');
}

export function createEuroKnockouts(w: World) {
  const euro = getComp(w, `EURO-${w.season}`);
  if (!euro || euro.series.length || !euro.groups) return;
  const groupRank = (g: string) => sortStandings(euro.standings.filter((s) => euro.groups![g].includes(s.clubId))).map((s) => s.clubId);
  const A = groupRank('A');
  const B = groupRank('B');
  const cal = buildCalendar(w.season);
  euro.stage = 'Quarterfinal';
  euro.roundDays = [cal.euroQfDays, [cal.euroF4Days.sf], [cal.euroF4Days.f]];
  const pairs: [number, number][] = [[A[0], B[3]], [B[1], A[2]], [B[0], A[3]], [A[1], B[2]]];
  for (const [h, l] of pairs) createSeries(w, euro, 'Quarterfinal', 0, h, l, 3, cal.euroQfDays, 'euro');
  invalidateIndex(w);
  for (const cid of [...A.slice(0, 4), ...B.slice(0, 4)]) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Through to the EuroCup quarterfinals!');
}

// ---------------------------------------------------------------------------
// Result processing
// ---------------------------------------------------------------------------
export function recordStanding(cmp: Competition, f: Fixture) {
  if (!f.result) return;
  const h = cmp.standings.find((s) => s.clubId === f.homeId);
  const a = cmp.standings.find((s) => s.clubId === f.awayId);
  if (!h || !a) return;
  const hw = f.result.home > f.result.away;
  h.pf += f.result.home; h.pa += f.result.away;
  a.pf += f.result.away; a.pa += f.result.home;
  if (hw) { h.w++; a.l++; h.home[0]++; a.away[1]++; } else { a.w++; h.l++; h.home[1]++; a.away[0]++; }
  for (const [s, won] of [[h, hw], [a, !hw]] as [Standing, boolean][]) {
    s.streak = won ? (s.streak > 0 ? s.streak + 1 : 1) : s.streak < 0 ? s.streak - 1 : -1;
    s.last10.push(won ? 'W' : 'L');
    if (s.last10.length > 10) s.last10.shift();
  }
}

export function onFixtureComplete(w: World, f: Fixture) {
  const cmp = getComp(w, f.compId);
  if (!cmp || !f.result) return;
  if (cmp.kind === 'league' || (cmp.kind === 'euro' && f.seriesId == null)) {
    recordStanding(cmp, f);
    return;
  }
  const s = cmp.series.find((x) => x.id === f.seriesId);
  if (!s || s.winner != null) return;
  const winnerId = f.result.home > f.result.away ? f.homeId : f.awayId;
  if (winnerId === s.highSeed) s.winsHigh++;
  else s.winsLow++;
  const need = Math.ceil(s.bestOf / 2);
  if (s.winsHigh >= need || s.winsLow >= need) {
    s.winner = s.winsHigh >= need ? s.highSeed : s.lowSeed;
    for (const fid of s.fixtureIds) {
      const fx = getFixture(w, fid);
      if (fx && !fx.played) fx.cancelled = true;
    }
    const loser = s.winner === s.highSeed ? s.lowSeed : s.highSeed;
    if (isUser(w, loser)) hold(w, 'seasonEvent', `Eliminated from the ${cmp.name.replace(/ \d{4}-\d{2}$/, '')} (${s.round}).`);
    advanceKnockout(w, cmp, s.roundIndex);
  }
}

function advanceKnockout(w: World, cmp: Competition, roundIndex: number) {
  const round = cmp.series.filter((s) => s.roundIndex === roundIndex);
  if (round.some((s) => s.winner == null)) return;
  const winners = round.map((s) => s.winner!);
  if (winners.length === 1) {
    cmp.champion = winners[0];
    const fin = round[0];
    cmp.runnerUp = fin.winner === fin.highSeed ? fin.lowSeed : fin.highSeed;
    cmp.complete = true;
    cmp.stage = 'Complete';
    const ch = club(w, cmp.champion);
    const title = cmp.name.replace(/ \d{4}-\d{2}$/, '');
    if (cmp.kind !== 'promo') ch.trophies.push({ season: w.season, name: title });
    addNews(w, cmp.kind === 'promo' ? `${ch.name} win the promotion playoff!` : `${ch.name} are ${title} champions!`, `${ch.name} beat ${club(w, cmp.runnerUp).name} in the final.`, { tags: ['result', 'milestone'], clubIds: [ch.id, cmp.runnerUp], importance: 3 });
    if (isUser(w, ch.id)) hold(w, 'seasonEvent', cmp.kind === 'promo' ? 'You won the promotion playoff!' : `Champions: ${title}!`);
    return;
  }
  const next = roundIndex + 1;
  const days = cmp.roundDays?.[next];
  if (!days) return;
  const name = cmp.leagueId === 'NBA' ? (winners.length === 2 ? 'NBA Finals' : winners.length === 4 ? 'Conference finals' : 'Conference semifinals') : roundName(winners.length);
  cmp.stage = name;
  const compType: CompType = cmp.kind === 'cup' ? 'cup' : cmp.kind === 'euro' ? 'euro' : cmp.kind === 'promo' ? 'promo' : 'playoffs';
  const college = cmp.leagueId === 'COLLEGE';
  const neutral = cmp.kind === 'cup' || (cmp.kind === 'euro' && next >= 1) || (college && next >= 1);
  const bestOf = cmp.leagueId === 'NBA' ? 7 : college || cmp.kind === 'cup' || (cmp.kind === 'euro' && next >= 1) ? 1 : cmp.kind === 'promo' ? 3 : 5;
  // keep bracket order (1v8 winner meets 4v5 winner etc.)
  const ordered = cmp.adjacent ? [...round].sort((a, b) => cmp.series.indexOf(a) - cmp.series.indexOf(b)).map((s) => s.winner!) : bracketOrder(winners);
  for (let i = 0; i < ordered.length; i += 2) {
    let [hi, lo] = [ordered[i], ordered[i + 1]];
    const seedOf = (id: number) => cmp.clubIds.indexOf(id);
    if (seedOf(lo) >= 0 && seedOf(hi) >= 0 && seedOf(lo) < seedOf(hi)) [hi, lo] = [lo, hi];
    createSeries(w, cmp, name, next, hi, lo, bestOf, days.slice(0, bestOf).length === bestOf ? days.slice(0, bestOf) : Array(bestOf).fill(days[0]), compType, neutral);
  }
  invalidateIndex(w);
}

function bracketOrder(winners: number[]): number[] {
  // QF order [1v8, 4v5? ...] is created as [0v7, 1v6, 2v5, 3v4]; semis pair 0 with 3, 1 with 2.
  if (winners.length === 4) return [winners[0], winners[3], winners[1], winners[2]];
  return winners;
}

export function compTypeLabel(t: CompType): string {
  return { league: 'League', playoffs: 'Playoffs', cup: 'Copa del Rey', euro: 'EuroCup', promo: 'Promotion playoff', friendly: 'Friendly' }[t];
}
