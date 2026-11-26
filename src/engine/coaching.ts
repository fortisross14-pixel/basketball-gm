// Coaching careers: a persistent record per head coach, an AI job market with real vacancies,
// and an NBA destination that appoints the best European coaches. Candidates are ranked on
// results vs expectations, player development, league level, continental record and fit.
import type { Club, CoachSeason, Staff, World } from './types';
import { addNews, club as getClub, isUser, rng, roster, staffOf, tierOf } from './world';
import { staffAsk } from './staff';
import { expectedWinPct } from './career';
import { offFit, defFit } from './delegation';
import { clamp } from './rng';

export const NBA_TEAMS = [
  'Atlanta', 'Boston', 'Brooklyn', 'Charlotte', 'Chicago', 'Cleveland', 'Dallas', 'Denver', 'Detroit', 'Golden State', 'Houston', 'Indiana', 'Los Angeles (A)', 'Los Angeles (B)', 'Memphis',
  'Miami', 'Milwaukee', 'Minneapolis', 'New Orleans', 'New York', 'Oklahoma City', 'Orlando', 'Philadelphia', 'Phoenix', 'Portland', 'Sacramento', 'San Antonio', 'Toronto', 'Salt Lake City', 'Washington',
];

function levelOf(w: World, c: Club): number {
  if (c.foreign) return 0;
  if (c.leagueId === 'COLLEGE') return 3;
  return tierOf(w, c);
}

const LEVEL_WEIGHT: Record<number, number> = { 0: 1.15, 1: 1, 2: 0.7, 3: 0.5, 4: 0.5, 5: 1.4 };

export function leagueLabel(w: World, c: Club): string {
  return c.foreign ? 'Continental' : c.leagueId ? w.rules.leagues[c.leagueId].name : '—';
}

/** Weighted score of a coach's recent seasons (most recent first matter most). */
export function coachForm(s: Staff): number {
  const rec = (s.record ?? []).slice(-4);
  if (!rec.length) return 0;
  let tot = 0, wt = 0;
  rec.forEach((r, i) => { const k = 1 + i * 0.5; tot += r.score * k; wt += k; });
  return tot / wt;
}

export function bestLevel(s: Staff): number {
  const lv = (s.record ?? []).map((r) => (r.level === 0 ? 0.5 : r.level));
  return lv.length ? Math.min(...lv) : 4;
}

export function euroHonours(s: Staff): number {
  return (s.record ?? []).reduce((a, r) => a + r.honours.filter((h) => /Continental/.test(h)).length, 0);
}

/** How well a coach's systems fit a club's roster (0..1). */
export function tacticalFit(w: World, s: Staff, c: Club): number {
  const sq = roster(w, c.id).filter((p) => !p.injury);
  if (!sq.length || !s.offPref || !s.defPref) return 0.5;
  return (offFit(sq, s.offPref) + defFit(sq, s.defPref)) / 200;
}

/** Candidate ranking used by every club (and shown to the user in the staff market). */
export function candidateScore(w: World, s: Staff, c: Club): number {
  const form = coachForm(s);
  const level = bestLevel(s);
  const lvlBonus = level <= 0.5 ? 10 : level <= 1 ? 7 : level <= 2 ? 3 : 0;
  return s.reputation * 0.45 + s.rating * 0.3 + form * 0.6 + lvlBonus + euroHonours(s) * 5 + tacticalFit(w, s, c) * 12 + (s.development - 50) * 0.08;
}

/** Season end: write each head coach's season into their record and update reputation. */
export function recordCoachSeasons(w: World) {
  for (const c of w.clubs) {
    const s = staffOf(w, c, 'headCoach');
    if (!s) continue;
    const h = c.history[c.history.length - 1];
    if (!h || h.season !== w.season) continue;
    const games = h.wins + h.losses;
    if (!games && !c.foreign) continue;
    const winPct = games ? h.wins / games : 0.5;
    const exp = c.foreign ? 0.5 : expectedWinPct(w, c);
    const level = levelOf(w, c);
    const honours: string[] = [];
    if (h.playoff === 'Champion') honours.push(`${leagueLabel(w, c)} champion`);
    if (h.promoted) honours.push('Promotion');
    if (h.euro === 'Champion') honours.push('Continental Cup winner');
    else if (h.euro === 'Final') honours.push('Continental Cup finalist');
    if (h.cup === 'Champion') honours.push('Copa winner');
    const bonus = honours.reduce((a, x) => a + (/Continental Cup winner/.test(x) ? 14 : /finalist/.test(x) ? 6 : /champion/.test(x) ? (level === 1 ? 10 : 5) : /Promotion/.test(x) ? 5 : 3), 0);
    const score = Math.round(((winPct - exp) * 80 * LEVEL_WEIGHT[level] + bonus + (h.relegated ? -10 : 0)) * 10) / 10;
    const line: CoachSeason = { season: w.season, clubId: c.id, clubName: c.name, league: leagueLabel(w, c), level, wins: h.wins, losses: h.losses, expected: Math.round(exp * 100) / 100, rank: h.rank, honours, score };
    (s.record ??= []).push(line);
    if (s.record.length > 30) s.record.shift();
    const ceiling = level === 0 || level === 1 ? 99 : level === 2 ? 86 : 76; // you only become a star on a big stage
    s.reputation = Math.round(clamp(s.reputation + score * 0.45 - Math.max(0, s.reputation - ceiling) * 0.3, 5, 99));
    const age = w.season - s.born;
    if (score > 4 && age < 58) s.rating = Math.min(99, s.rating + 1 + (score > 12 ? 1 : 0));
    else if (score < -8) s.rating = Math.max(15, s.rating - 1);
  }
  // NBA coaches keep a record too (they are beyond our simulation: a light random season)
  const r = rng(w);
  for (const s of w.staff.filter((x) => x.nba)) {
    const score = Math.round(r.normal(s.rating - 70, 6) * 10) / 10;
    (s.record ??= []).push({ season: w.season, clubId: null, clubName: `${s.nba!.team} (NBA)`, league: 'NBA', level: 5, wins: 0, losses: 0, expected: 0.5, rank: 0, honours: [], score });
    s.reputation = Math.round(clamp(s.reputation + score * 0.2, 5, 99));
  }
}

function leaveClub(w: World, s: Staff, exit: string) {
  if (s.teamId != null) {
    const c = getClub(w, s.teamId);
    if (c.staff[s.role] === s.id) delete c.staff[s.role];
    const h = [...s.history].reverse().find((x) => x.teamId === c.id && x.to == null);
    if (h) { h.to = w.season; h.exit = exit; h.clubName ??= c.name; }
  }
  s.teamId = null;
  s.contract = null;
}

function appoint(w: World, s: Staff, c: Club, years = 2) {
  s.teamId = c.id;
  s.role = 'headCoach';
  s.contract = { salary: staffAsk(w, s, tierOf(w, c) || 1), expires: w.season + years };
  c.staff.headCoach = s.id;
  s.history.push({ season: w.season, teamId: c.id, role: 'headCoach', clubName: c.name });
}

function notable(w: World, s: Staff, c?: Club) {
  return s.reputation >= 60 || (c && (c.leagueId === 'ELITE' || c.foreign)) || (s.history.some((h) => w.user.career.some((st) => st.clubId === h.teamId && h.season >= w.season - 12)));
}

/** Fill a head-coach vacancy at an AI club: free coaches, assistants, or poach from smaller clubs. */
export function fillCoachVacancy(w: World, c: Club, depth = 0) {
  if (c.staff.headCoach != null || isUser(w, c.id)) return;
  const r = rng(w);
  const prestige = c.prestige;
  const pool = w.staff.filter((s) => !s.nba && (s.role === 'headCoach' || s.role === 'assistantOff' || s.role === 'assistantDef') && (
    s.teamId == null ||
    (s.role === 'headCoach' && s.teamId !== c.id && !isUser(w, s.teamId) && getClub(w, s.teamId).prestige < prestige - 8 && depth < 2) ||
    (s.role !== 'headCoach' && s.teamId === c.id)
  ));
  if (!pool.length) return;
  const scored = pool.map((s) => ({ s, v: candidateScore(w, s, c) + r.normal(0, 3) - (s.teamId != null && s.teamId !== c.id ? 2 : 0) })).sort((a, b) => b.v - a.v);
  const pick = scored[0].s;
  const from = pick.teamId != null && pick.teamId !== c.id ? getClub(w, pick.teamId) : null;
  if (pick.teamId != null) leaveClub(w, pick, from ? `Left for ${c.name}` : 'Promoted to head coach');
  appoint(w, pick, c);
  if (notable(w, pick, c)) addNews(w, `${c.name} appoint ${pick.firstName} ${pick.lastName} as head coach`, `${from ? `He leaves ${from.name} (${leagueLabel(w, from)}).` : 'A new chapter.'} ${recordLine(pick)}`, { tags: ['staff'], clubIds: [c.id, ...(from ? [from.id] : [])], importance: c.leagueId === 'ELITE' || c.foreign ? 2 : 1 });
  if (from) fillCoachVacancy(w, from, depth + 1);
}

export function recordLine(s: Staff): string {
  const rec = s.record ?? [];
  if (!rec.length) return 'No head-coaching record yet.';
  const w = rec.reduce((a, x) => a + x.wins, 0);
  const l = rec.reduce((a, x) => a + x.losses, 0);
  const hon = rec.flatMap((x) => x.honours);
  return `Career ${w}-${l} over ${rec.length} season${rec.length > 1 ? 's' : ''}${hon.length ? `; ${hon.slice(-3).join(', ')}` : ''}.`;
}

/** Season end (after records): AI boards judge their coaches; the NBA hires; vacancies are filled. */
export function coachingMarket(w: World) {
  const r = rng(w);
  // 1) dismissals
  for (const c of w.clubs) {
    if (isUser(w, c.id)) continue;
    const s = staffOf(w, c, 'headCoach');
    if (!s) continue;
    const last = (s.record ?? []).filter((x) => x.clubId === c.id).slice(-2);
    const bad = last.length && last[last.length - 1].score < -8;
    const twoBad = last.length === 2 && last.every((x) => x.score < -3);
    if ((bad && r.chance(0.55)) || twoBad) {
      leaveClub(w, s, 'Dismissed');
      if (notable(w, s, c)) addNews(w, `${c.name} part ways with ${s.firstName} ${s.lastName}`, `${recordLine(s)}`, { tags: ['staff'], clubIds: [c.id] });
    }
  }
  // 2) the NBA comes calling for the best European coaches
  const nbaPool = w.staff.filter((s) => !s.nba && s.role === 'headCoach' && s.reputation >= 84 && w.season - s.born <= 62 && (s.record ?? []).some((x) => x.level <= 1));
  const taken = new Set(w.staff.filter((s) => s.nba).map((s) => `${s.nba!.team}-${s.nba!.role}`));
  for (const s of nbaPool.sort((a, b) => b.reputation + euroHonours(b) * 4 - (a.reputation + euroHonours(a) * 4))) {
    const head = s.reputation >= 94 && euroHonours(s) >= 1 && r.chance(0.35);
    if (!r.chance(head ? 1 : 0.4)) continue;
    const role: 'head' | 'assistant' = head ? 'head' : 'assistant';
    const team = r.shuffle([...NBA_TEAMS]).find((t) => !taken.has(`${t}-${role}`));
    if (!team) continue;
    taken.add(`${team}-${role}`);
    const from = s.teamId != null ? getClub(w, s.teamId) : null;
    leaveClub(w, s, `Joined the NBA (${team})`);
    s.nba = { team, role, since: w.season };
    s.history.push({ season: w.season, teamId: -1, role: 'headCoach', clubName: `${team} (NBA ${role === 'head' ? 'head coach' : 'assistant coach'})` });
    addNews(w, `${s.firstName} ${s.lastName} heads to the NBA`, `${from ? `${from.name}'s coach` : 'The coach'} joins ${team} as ${role === 'head' ? 'head coach' : 'an assistant coach'}. ${recordLine(s)}`, { tags: ['staff'], clubIds: from ? [from.id] : [], importance: 3 });
  }
  // NBA assistants who shine get the top job
  for (const s of w.staff.filter((x) => x.nba?.role === 'assistant' && w.season - x.nba.since >= 2 && x.reputation >= 92)) {
    if (!r.chance(0.3)) continue;
    const team = r.shuffle([...NBA_TEAMS]).find((t) => !taken.has(`${t}-head`));
    if (!team) continue;
    taken.add(`${team}-head`);
    s.nba = { team, role: 'head', since: w.season };
    s.history.push({ season: w.season, teamId: -1, role: 'headCoach', clubName: `${team} (NBA head coach)` });
    addNews(w, `${s.firstName} ${s.lastName} named NBA head coach`, `After ${w.season - (s.history.find((h) => h.teamId === -1)?.season ?? w.season)} seasons as an assistant, the former European coach takes over ${team}.`, { tags: ['staff'], importance: 3 });
  }
  // 3) fill vacancies, biggest clubs first
  for (const c of [...w.clubs].sort((a, b) => b.prestige - a.prestige)) if (!c.staff.headCoach) fillCoachVacancy(w, c);
}

/** Mid-season: an AI board in crisis may sack its coach (weekly, small chance). */
export function midseasonCoachChange(w: World, c: Club, winPct: number, games: number) {
  if (isUser(w, c.id) || c.foreign || games < 10) return;
  const s = staffOf(w, c, 'headCoach');
  if (!s) { fillCoachVacancy(w, c); return; }
  if (winPct < expectedWinPct(w, c) - 0.25 && rng(w).chance(0.04)) {
    leaveClub(w, s, 'Dismissed (mid-season)');
    if (notable(w, s, c)) addNews(w, `${c.name} sack ${s.firstName} ${s.lastName}`, `After a ${Math.round(winPct * 100)}% start. ${recordLine(s)}`, { tags: ['staff'], clubIds: [c.id] });
    fillCoachVacancy(w, c);
  }
}
