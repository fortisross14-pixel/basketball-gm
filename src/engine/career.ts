import type { Club, Decision, World } from './types';
import { absDay } from './types';
import { addNews, club as getClub, fmtMoney, hold, nextId, rng, roster, tierOf, userClub } from './world';
import { clamp } from './rng';
import { estimateRevenue } from './economy';

export function jobOfferDecision(w: World, c: Club, reason: string): Decision {
  const t = tierOf(w, c);
  const salary = Math.round((t === 1 ? 180000 : t === 2 ? 70000 : 40000) * (0.7 + c.prestige / 100) / 1000) * 1000;
  const expectations = c.leagueId === 'COLLEGE' ? (c.prestige >= 60 ? 'Contend for the NCL title' : 'Rebuild the program and reach the NCL Tournament') : t === 1 ? (c.prestige >= 75 ? 'Win titles and compete in Europe' : 'Reach the playoffs') : 'Win promotion within two seasons';
  return {
    id: nextId(w), kind: 'jobOffer',
    title: `Job offer: ${c.name} (${c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental'}${c.leagueId === 'COLLEGE' ? ', USA' : c.leagueId ? ', Spain' : ''})`,
    body: `${reason} Budget around ${fmtMoney(estimateRevenue(w, c).total)} revenue, prestige ${c.prestige}. Expectations: ${expectations}. Salary ${fmtMoney(salary)}/yr.`,
    createdDay: absDay(w), deadlineDay: absDay(w) + 10, urgency: 2, impact: 3, dept: 'board',
    options: [{ id: 'accept', label: `Accept and move to ${c.name}`, tone: 'risky' }, { id: 'decline', label: 'Decline', tone: 'neutral' }],
    recommended: null, recommendedBy: null, payload: { clubId: c.id, salary }, defaultOption: 'decline', resolved: false, clubIds: [c.id],
  };
}

/**
 * Offers arrive at the end of the season, weekly while unemployed (at a rate
 * that grows with reputation) and mid-season when you are performing well.
 */
export function jobMarket(w: World, unemployedTick = false, midseason = false) {
  if (w.user.role === 'owner' && w.user.clubId != null) return;
  const r = rng(w);
  const rep = w.user.reputation;
  const current = userClub(w);
  const unemployed = w.user.clubId == null;
  if (unemployedTick && !r.chance(clamp(0.12 + rep / 160, 0.12, 0.6))) return;
  const lastClub = w.user.career.length ? w.clubs.find((c) => c.id === w.user.career[w.user.career.length - 1].clubId) : null;
  const firedRecently = unemployed && w.user.career[w.user.career.length - 1]?.exit === 'Dismissed';
  const declined = w.user.declinedOffers ?? {};
  const pool = w.clubs.filter((c) => !c.foreign && c.id !== w.user.clubId && c.id !== lastClub?.id && (declined[c.id] ?? 0) < absDay(w));
  const level = (c: Club) => c.prestige * 0.75 + (c.leagueId === 'ELITE' ? 10 : c.leagueId === 'PLATA' ? -10 : 0);
  const fit = pool.filter((c) => {
    if (rep < level(c) - 15) return false;
    if (firedRecently && lastClub && level(c) > level(lastClub) + 3) return false; // after a dismissal, only equal or lesser jobs
    if (current && level(c) <= level(current) + 4) return false; // only a step up tempts an employed executive
    if (midseason && c.board.overall > 50) return false; // mid-season, only clubs whose board has lost faith
    return true;
  });
  if (!fit.length) return;
  const n = unemployed ? 1 : midseason ? 1 : r.chance(clamp((rep - 25) / 70, 0.05, 0.75)) ? (r.chance(0.3) ? 2 : 1) : 0;
  const picks = r.shuffle(fit).sort((a, b) => level(b) - level(a)).slice(0, Math.max(n, 0) + 2);
  for (const c of r.shuffle(picks).slice(0, n)) {
    if (w.decisions.some((d) => !d.resolved && d.kind === 'jobOffer' && d.payload.clubId === c.id)) continue;
    const reason = unemployed
      ? `${c.board.owner} is looking for a new executive and likes your profile.`
      : midseason
        ? `${c.name}'s board has lost faith in its executive and wants you now, mid-season. Your work at ${current!.name} has been noticed.`
        : `After your work at ${current!.name}, ${c.name} want you to lead their project.`;
    const d = jobOfferDecision(w, c, reason);
    w.decisions.push(d);
    hold(w, 'jobOffer', d.title);
  }
}

export function resolveJobOffer(w: World, d: Decision, choice: string): string {
  const c = getClub(w, d.payload.clubId as number);
  const old = userClub(w);
  if (choice !== 'accept') {
    (w.user.declinedOffers ??= {})[c.id] = absDay(w) + 300;
    if (old) {
      old.board.trust.relationship = clamp(old.board.trust.relationship + 6, 0, 100);
      old.fans.sentiment = clamp(old.fans.sentiment + 3, 0, 100);
      addNews(w, `${w.user.name} turns down ${c.name}`, `The ${old.name} executive commits to the project. Supporters and board appreciate the loyalty.`, { tags: ['career'], clubIds: [old.id, c.id], importance: 2 });
    }
    return `You declined ${c.name}.`;
  }
  switchClub(w, c, old ? `Left for ${c.name}` : null);
  return `You are the new executive of ${c.name}.`;
}

export function switchClub(w: World, c: Club, exitLabel: string | null) {
  const now = absDay(w);
  const old = userClub(w);
  if (old) {
    const st = w.user.career.find((s) => s.clubId === old.id && s.to == null);
    if (st) { st.to = now; st.exit = exitLabel ?? 'Left'; }
    addNews(w, `${w.user.name} leaves ${old.name} for ${c.name}`, 'A new chapter begins.', { tags: ['career'], clubIds: [old.id, c.id], importance: 3 });
  } else {
    addNews(w, `${c.name} appoint ${w.user.name}`, `${w.user.name} takes charge of ${c.name}.`, { tags: ['career'], clubIds: [c.id], importance: 3 });
  }
  if (old) releaseShop(old);
  const firstJob = w.user.career.length === 0;
  w.user.clubId = c.id;
  w.user.unemployedSince = null;
  ensureShop(w, c);
  w.user.career.push({ clubId: c.id, clubName: c.name, role: w.user.role === 'owner' ? 'gm' : w.user.role, from: now, to: null, achievements: [], exit: null });
  if (w.user.role === 'owner') w.user.role = 'gm';
  w.user.negotiations = [];
  w.user.shortlist = [];
  w.user.onboarding = { visited: [], dismissed: false };
  w.tvOffers = [];
  for (const p of roster(w, c.id)) w.user.knowledge[p.id] = 100;
  c.board.trust = { results: 60, finances: 60, fans: 60, media: 60, promises: 60, relationship: 65 };
  w.user.approval = { board: 61, fans: 55, fanBonus: 5, lowFanWeeks: 0, history: [], notes: [{ day: now, text: `Appointed at ${c.name}: a honeymoon period`, delta: 5, who: 'fans' }] };
  c.board.overall = 61;
  c.board.ultimatum = null;
  if (firstJob) applyStartSupport(w, c);
  // cancel pending decisions belonging to the old club
  for (const d of w.decisions) if (!d.resolved && d.kind !== 'jobOffer') d.resolved = true;
}

/** End-of-season reputation update. */
export function updateReputation(w: World, delta: number, achievement?: string) {
  w.user.reputation = Math.round(clamp(w.user.reputation + delta, 0, 100));
  if (achievement) {
    const st = w.user.career.find((s) => s.clubId === w.user.clubId && s.to == null);
    if (st) st.achievements.push(`${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}: ${achievement}`);
  }
}

// ===========================================================================
// Career start, evaluation by owner & fans, performance-based offers
// ===========================================================================
import type { Background } from './types';
import { currentWinPct } from './economy';
import { leagueComp, sortStandings } from './competitions';

export const BACKGROUND_INFO: Record<Background, { label: string; desc: string; rep: number }> = {
  formerPlayer: { label: 'Former player', desc: 'Players respect you: +4 interest in every negotiation.', rep: 24 },
  coach: { label: 'Former coach', desc: 'You know how to develop players: faster development at your club.', rep: 22 },
  business: { label: 'Business executive', desc: 'You speak the sponsors\' language: sponsor offers are 8% better.', rep: 20 },
  analyst: { label: 'Data analyst', desc: 'You read players better: scouting knowledge grows 30% faster.', rep: 20 },
};

export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'ESP', label: 'Spain' }, { code: 'USA', label: 'United States' }, { code: 'FRA', label: 'France' }, { code: 'ITA', label: 'Italy' },
  { code: 'GRE', label: 'Greece' }, { code: 'SRB', label: 'Serbia' }, { code: 'LTU', label: 'Lithuania' }, { code: 'GER', label: 'Germany' },
  { code: 'POR', label: 'Portugal' }, { code: 'TUR', label: 'Turkey' }, { code: 'ARG', label: 'Argentina' }, { code: 'BRA', label: 'Brazil' },
  { code: 'CAN', label: 'Canada' }, { code: 'OTHER', label: 'Other' },
];

function weakest(w: World, leagueId: string, n: number): Club[] {
  return w.clubs.filter((c) => c.leagueId === leagueId).sort((a, b) => a.prestige - b.prestige).slice(0, n);
}

/** The first offers of a new career depend on where you come from. */
export function careerStartOffers(w: World) {
  const r = rng(w);
  const nat = w.user.nationality;
  const picks: { club: Club; reason: string }[] = [];
  const take = (pool: Club[], k: number, reason: (c: Club) => string) => {
    for (const c of r.shuffle([...pool]).slice(0, k)) if (!picks.some((p) => p.club.id === c.id)) picks.push({ club: c, reason: reason(c) });
  };
  if (nat === 'USA' || nat === 'CAN') {
    take(weakest(w, 'COLLEGE', 6), 2, (c) => `${c.name} is a struggling college program looking for a young athletic director with fresh ideas.`);
    if (r.chance(0.6)) take(weakest(w, 'PLATA', 8), 1, (c) => `${c.name}, a Spanish third-division club, wants an American executive to modernise its recruiting.`);
  } else if (nat === 'ESP') {
    take(weakest(w, 'PLATA', 10), 2, (c) => `${c.board.owner} offers you the reins of ${c.name} in the Liga Plata, the Spanish third division.`);
    take(weakest(w, 'ORO', 4), 1, (c) => `${c.name} are bottom-half in the Liga Oro (second division) and want a local executive to stabilise them.`);
  } else if (['ARG', 'BRA', 'OTHER'].includes(nat)) {
    take(weakest(w, 'PLATA', 10), 2, (c) => `${c.name} in the Spanish Liga Plata are looking for an executive with international contacts.`);
    take(weakest(w, 'COLLEGE', 6), 1, (c) => `${c.name} wants an international executive to open up its recruiting abroad.`);
  } else {
    take(weakest(w, 'PLATA', 10), 2, (c) => `${c.name} in the Spanish Liga Plata want a European executive who knows the continental market.`);
    take(weakest(w, 'ORO', 5), 1, (c) => `${c.name}, a Liga Oro (second division) club, liked your profile.`);
  }
  for (const p of picks) {
    const d = jobOfferDecision(w, p.club, p.reason);
    d.deadlineDay = absDay(w) + 21;
    d.urgency = 3;
    w.decisions.push(d);
  }
}

export function fanReaction(w: World, delta: number, text: string) {
  w.user.approval.fanBonus += delta;
  w.user.approval.notes.unshift({ day: absDay(w), text, delta, who: 'fans' });
  if (w.user.approval.notes.length > 40) w.user.approval.notes.length = 40;
}

export function boardNote(w: World, delta: number, text: string) {
  w.user.approval.notes.unshift({ day: absDay(w), text, delta, who: 'board' });
  if (w.user.approval.notes.length > 40) w.user.approval.notes.length = 40;
}

/** Where the club "should" finish given its stature (prestige rank among league peers). */
export function expectedWinPct(w: World, c: Club): number {
  const peers = w.clubs.filter((x) => x.leagueId === c.leagueId).sort((a, b) => b.prestige - a.prestige);
  const rank = Math.max(0, peers.findIndex((x) => x.id === c.id));
  return 0.75 - (0.5 * rank) / Math.max(1, peers.length - 1);
}

export interface EvaluationBreakdown {
  winPct: number;
  expected: number;
  fanTarget: number;
  factors: { label: string; value: number }[];
}

/** What supporters expect: half club stature, half the squad they can see on the court. */
export function fanExpectedWinPct(w: World, c: Club): number {
  const peers = w.clubs.filter((x) => x.leagueId === c.leagueId);
  const byStr = [...peers].sort((a, b) => clubStrength(w, b) - clubStrength(w, a));
  const rank = Math.max(0, byStr.findIndex((x) => x.id === c.id));
  const squadExp = 0.75 - (0.5 * rank) / Math.max(1, peers.length - 1);
  return (expectedWinPct(w, c) + squadExp) / 2;
}

export function fanEvaluation(w: World, c: Club): EvaluationBreakdown {
  const raw = currentWinPct(w, c);
  const expected = fanExpectedWinPct(w, c);
  // a handful of games says little: shrink toward expectations until the sample grows
  const st = c.leagueId ? w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`)?.standings.find((x) => x.clubId === c.id) : undefined;
  const games = st ? st.w + st.l : 0;
  const winPct = games ? (raw * games + expected * 6) / (games + 6) : raw;
  const factors = [
    { label: `Results vs expectations (${Math.round(raw * 100)}% wins vs ${Math.round(expected * 100)}% expected)`, value: clamp((winPct - expected) * 95, -34, 34) },
    { label: 'Supporters\' mood (prices, atmosphere, hype)', value: (c.fans.sentiment - 55) * 0.5 },
    { label: 'Your recent decisions (signings, sales, promises)', value: w.user.approval.fanBonus },
  ];
  return { winPct, expected, fanTarget: clamp(50 + factors.reduce((a, f) => a + f.value, 0), 0, 100), factors: factors.map((f) => ({ ...f, value: Math.round(f.value) })) };
}

export function jobSecurity(w: World): number {
  return Math.round(w.user.approval.board * 0.65 + w.user.approval.fans * 0.35);
}

/** Weekly: fans and owner grade you; reputation follows; fan pressure can end your tenure. */
export function weeklyEvaluation(w: World) {
  const c = userClub(w);
  const ap = w.user.approval;
  if (!c) {
    w.user.reputation = Math.max(5, w.user.reputation - 0.05);
    return;
  }
  const ev = fanEvaluation(w, c);
  ap.fans = Math.round(clamp(ap.fans + (ev.fanTarget - ap.fans) * 0.13, 0, 100) * 10) / 10;
  ap.board = c.board.overall;
  ap.fanBonus *= 0.9;
  ap.history.push({ day: absDay(w), board: ap.board, fans: Math.round(ap.fans) });
  if (ap.history.length > 160) ap.history.shift();
  // reputation drifts with how both constituencies rate you, weighted by the stage you work on
  const perf = (ap.board * 0.6 + ap.fans * 0.4) / 100;
  const stage = c.leagueId === 'ELITE' ? 1.3 : c.leagueId === 'ORO' ? 1 : c.leagueId === 'COLLEGE' ? 0.9 + c.prestige / 200 : 0.8;
  w.user.reputation = Math.round(clamp(w.user.reputation + (perf - 0.55) * 0.5 * stage, 0, 100) * 10) / 10;
  // fan pressure
  if (ap.fans < 25) {
    ap.lowFanWeeks++;
    if (ap.lowFanWeeks === 3) {
      addNews(w, `Supporters turn on ${w.user.name}`, `Banners and chants at ${c.arena.name} demand change. Fan approval of the management: ${Math.round(ap.fans)}/100.`, { tags: ['fans', 'board'], clubIds: [c.id], importance: 3 });
      hold(w, 'boardUltimatum', 'The fans are calling for your dismissal.');
    }
    if (ap.lowFanWeeks >= 3) c.board.trust.relationship = clamp(c.board.trust.relationship - 3, 0, 100);
    const patience = w.settings.difficulty === 'relaxed' ? { weeks: 14, board: 40 } : w.settings.difficulty === 'standard' ? { weeks: 9, board: 48 } : { weeks: 7, board: 52 };
    const stint = w.user.career[w.user.career.length - 1];
    const firstSeason = stint && stint.clubId === c.id && absDay(w) - stint.from < 330;
    if (w.user.role === 'gm' && ap.lowFanWeeks >= patience.weeks && c.board.overall < patience.board - (firstSeason ? 13 : 0)) {
      fireUserFromCareer(w, c, 'The board bowed to sustained supporter pressure.');
      return;
    }
  } else ap.lowFanWeeks = 0;
  // performance attracts bigger clubs during the season
  const cal = buildCalendar(w.season);
  if (w.day > cal.leagueRoundDays[6] && w.day < cal.leagueRoundDays[26] && perf > 0.62 && rng(w).chance(0.05 + (perf - 0.62))) jobMarket(w, false, true);
}

import { fireUser } from './board';
import { ensureShop, releaseShop } from './shop';
import { applyStartSupport } from './worldgen';
import { clubStrength } from './matchday';
import { buildCalendar } from './calendar';
function fireUserFromCareer(w: World, c: Club, reason: string) {
  fireUser(w, c, reason);
}

export function resign(w: World): string {
  const c = userClub(w);
  if (!c) return 'You have no club.';
  const st = w.user.career.find((s) => s.clubId === c.id && s.to == null);
  if (st) { st.to = absDay(w); st.exit = 'Resigned'; }
  releaseShop(c);
  w.user.clubId = null;
  w.user.unemployedSince = absDay(w);
  w.user.reputation = Math.max(5, w.user.reputation - 4);
  for (const d of w.decisions) if (!d.resolved && d.kind !== 'jobOffer') d.resolved = true;
  addNews(w, `${w.user.name} resigns from ${c.name}`, 'The executive steps down. Clubs will now weigh the decision when considering an approach.', { tags: ['career'], clubIds: [c.id], importance: 3 });
  return `You resigned from ${c.name}.`;
}

export function finalStanding(w: World, c: Club): number {
  const lc = c.leagueId ? leagueComp(w, c.leagueId) : null;
  return lc ? sortStandings(lc.standings).findIndex((s) => s.clubId === c.id) + 1 : 0;
}
