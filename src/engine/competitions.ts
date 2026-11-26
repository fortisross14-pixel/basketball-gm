import type { Competition, CompType, Fixture, LeagueId, Series, Standing, World } from './types';
import { buildCalendar } from './calendar';
import { LEAGUE_IDS } from './rules';
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

export function rankIn(w: World, clubId: number): number {
  const c = club(w, clubId);
  if (!c.leagueId) return 0;
  const lc = leagueComp(w, c.leagueId);
  if (!lc) return 0;
  return sortStandings(lc.standings).findIndex((s) => s.clubId === clubId) + 1;
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
  for (const lid of LEAGUE_IDS) {
    const rules = w.rules.leagues[lid];
    const ids = w.clubs.filter((c) => c.leagueId === lid).map((c) => c.id);
    const cmp = newCompetition(`${lid}-${w.season}`, 'league', `${rules.name} ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, ids, lid);
    w.competitions.push(cmp);
    const rounds = roundRobin(ids, (a) => r.shuffle(a));
    rounds.forEach((pairs, ri) => {
      for (const [h, a] of pairs) addFixture(w, { day: cal.leagueRoundDays[ri], compId: cmp.id, comp: 'league', round: ri + 1, label: `${rules.short} · Round ${ri + 1}`, homeId: h, awayId: a, neutral: false, seriesId: null });
    });
  }
  // Continental competition
  const eliteIds = w.clubs.filter((c) => c.leagueId === 'ELITE');
  const ranked = [...eliteIds].sort((a, b) => {
    const ra = a.history.find((h) => h.season === w.season - 1 && h.leagueId === 'ELITE')?.rank ?? 50 - a.prestige / 3;
    const rb = b.history.find((h) => h.season === w.season - 1 && h.leagueId === 'ELITE')?.rank ?? 50 - b.prestige / 3;
    return ra - rb;
  });
  const domestic = ranked.slice(0, w.rules.euro.fromElite).map((c) => c.id);
  const foreign = w.clubs.filter((c) => c.foreign).sort((a, b) => b.prestige - a.prestige).slice(0, w.rules.euro.teams - domestic.length).map((c) => c.id);
  const all = [...domestic, ...foreign];
  const euro = newCompetition(`EURO-${w.season}`, 'euro', `Continental Cup ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, all);
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
      for (const [h, a] of pairs) addFixture(w, { day: cal.euroGroupDays[ri], compId: euro.id, comp: 'euro', round: ri + 1, label: `Continental Cup · Group ${g} · R${ri + 1}`, homeId: h, awayId: a, neutral: false, seriesId: null });
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

const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Final'];

export function createCup(w: World) {
  const id = `CUP-${w.season}`;
  if (getComp(w, id)) return;
  const lc = leagueComp(w, 'ELITE');
  if (!lc) return;
  const top = sortStandings(lc.standings).slice(0, w.rules.cup.teams).map((s) => s.clubId);
  const cmp = newCompetition(id, 'cup', `Copa ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, top);
  cmp.stage = 'Quarterfinal';
  w.competitions.push(cmp);
  const cal = buildCalendar(w.season);
  cmp.roundDays = [cal.cupDays.qf, [cal.cupDays.sf], [cal.cupDays.f]];
  for (let i = 0; i < 4; i++) createSeries(w, cmp, 'Quarterfinal', 0, top[i], top[7 - i], 1, [cal.cupDays.qf[i]], 'cup', true);
  invalidateIndex(w);
  addNews(w, `Copa draw: ${top.map((x) => club(w, x).abbrev).join(', ')} qualify`, 'The top eight at the halfway point meet in a four-day knockout at a neutral venue.', { tags: ['league'], importance: 2 });
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'You have qualified for the Copa!');
}

export function createElitePlayoffs(w: World) {
  const id = `ELITE-PO-${w.season}`;
  if (getComp(w, id)) return;
  const lc = leagueComp(w, 'ELITE')!;
  const n = w.rules.leagues.ELITE.playoffTeams;
  const top = sortStandings(lc.standings).slice(0, n).map((s) => s.clubId);
  const cmp = newCompetition(id, 'playoffs', `Liga Élite Playoffs ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, top, 'ELITE');
  cmp.stage = 'Quarterfinal';
  const p = buildCalendar(w.season).playoffStart;
  cmp.roundDays = [[p, p + 2, p + 4], [p + 7, p + 9, p + 11, p + 13, p + 15], [p + 18, p + 20, p + 22, p + 24, p + 26]];
  w.competitions.push(cmp);
  for (let i = 0; i < n / 2; i++) createSeries(w, cmp, 'Quarterfinal', 0, top[i], top[n - 1 - i], 3, cmp.roundDays[0], 'playoffs');
  invalidateIndex(w);
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Your team has qualified for the title playoffs!');
}

export function createCollegePlayoffs(w: World) {
  const id = `COLLEGE-PO-${w.season}`;
  if (getComp(w, id) || !leagueComp(w, 'COLLEGE')) return;
  const lc = leagueComp(w, 'COLLEGE')!;
  const n = w.rules.leagues.COLLEGE.playoffTeams;
  const top = sortStandings(lc.standings).slice(0, n).map((s) => s.clubId);
  const cmp = newCompetition(id, 'playoffs', `NCL Tournament ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, top, 'COLLEGE');
  cmp.stage = 'Quarterfinal';
  const p = buildCalendar(w.season).playoffStart;
  cmp.roundDays = [[p + 1], [p + 5], [p + 7]];
  w.competitions.push(cmp);
  for (let i = 0; i < n / 2; i++) createSeries(w, cmp, 'Quarterfinal', 0, top[i], top[n - 1 - i], 1, cmp.roundDays[0], 'playoffs');
  invalidateIndex(w);
  for (const cid of top) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Your program made the NCL Tournament!');
}

export function createPromoPlayoffs(w: World, lid: LeagueId) {
  const id = `${lid}-PO-${w.season}`;
  if (getComp(w, id)) return;
  const rules = w.rules.leagues[lid];
  if (!rules.playoffPromotion) return;
  const lc = leagueComp(w, lid)!;
  const sorted = sortStandings(lc.standings);
  const entrants = sorted.slice(rules.directPromotion, rules.directPromotion + rules.playoffTeams).map((s) => s.clubId);
  const cmp = newCompetition(id, 'promo', `${rules.name} Promotion Playoff ${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}`, w.season, entrants, lid);
  cmp.stage = 'Semifinal';
  const p = buildCalendar(w.season).promoStart;
  cmp.roundDays = [[p, p + 2, p + 4], [p + 7, p + 9, p + 11]];
  w.competitions.push(cmp);
  const n = entrants.length;
  for (let i = 0; i < n / 2; i++) createSeries(w, cmp, 'Semifinal', 0, entrants[i], entrants[n - 1 - i], 3, cmp.roundDays[0], 'promo');
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
  for (const cid of [...A.slice(0, 4), ...B.slice(0, 4)]) if (isUser(w, cid)) hold(w, 'seasonEvent', 'Through to the Continental Cup quarterfinals!');
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
  const name = winners.length === 2 ? 'Final' : ROUND_NAMES[Math.min(next, 2)] ?? `Round ${next + 1}`;
  cmp.stage = name;
  const compType: CompType = cmp.kind === 'cup' ? 'cup' : cmp.kind === 'euro' ? 'euro' : cmp.kind === 'promo' ? 'promo' : 'playoffs';
  const college = cmp.leagueId === 'COLLEGE';
  const neutral = cmp.kind === 'cup' || (cmp.kind === 'euro' && next >= 1) || (college && next >= 1);
  const bestOf = college || cmp.kind === 'cup' || (cmp.kind === 'euro' && next >= 1) ? 1 : cmp.kind === 'promo' ? 3 : 5;
  // reseed: keep bracket order (1v8 winner meets 4v5 winner etc.)
  const ordered = bracketOrder(winners);
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
  return { league: 'League', playoffs: 'Playoffs', cup: 'Copa', euro: 'Continental Cup', promo: 'Promotion playoff', friendly: 'Friendly' }[t];
}
