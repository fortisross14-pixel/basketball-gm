import type { World, HoldEvent } from './types';
import { absDay } from './types';
import { buildCalendar, weekday, dateNum, monthOf, fmtDate } from './calendar';
import { fixturesOnDay, userClub, isUser, addNews, hold, club as getClub, rng } from './world';
import { playFixture } from './matchday';
import { createCup, createElitePlayoffs, createPromoPlayoffs, createEuroKnockouts, createCollegePlayoffs } from './competitions';
import { dailySquad, weeklySquad, weeklyScouting, youthIntake, aiStrategy } from './squad';
import { weeklyCommercial, closeSeasonTickets, generateTvOffers } from './commercial';
import { weeklyBoard, fireUser } from './board';
import { weeklyProjects, monthlyArenaUpkeep } from './arena';
import { monthlyFinance, weeklyCashSnapshot, octoberGrant } from './finance';
import { aiFillRosters, aiTransfers, aiBidsForUser, delegatedSquadUpkeep } from './market';
import { weeklyEvents, expireDecisions } from './events';
import { monthlyDelegation, weeklyTacticsDelegation } from './delegation';
import { seasonEnd, rollover } from './season';
import { jobMarket, weeklyEvaluation } from './career';
import { estimateRevenue } from './economy';
import { generateRecruits } from './worldgen';

/** Simulate the current day fully, then move to the next. */
export function processDay(w: World) {
  if (w.gameOver) return;
  const cal = buildCalendar(w.season);
  const d = w.day;
  const uc = userClub(w);
  const cashBefore = uc?.finances.cash ?? 0;

  // ---- games
  for (const f of [...fixturesOnDay(w, d)]) {
    if (!f.played && !f.cancelled) {
      playFixture(w, f);
      if (w.lastWeekSummary && (isUser(w, f.homeId) || isUser(w, f.awayId)) && f.result) {
        const us = isUser(w, f.homeId);
        const ours = us ? f.result.home : f.result.away;
        const theirs = us ? f.result.away : f.result.home;
        const opp = getClub(w, us ? f.awayId : f.homeId);
        w.lastWeekSummary.results.push({ fixtureId: f.id, text: `${ours > theirs ? 'W' : 'L'} ${ours}–${theirs} ${us ? 'vs' : '@'} ${opp.abbrev}`, win: ours > theirs });
      }
    }
  }

  // ---- competition triggers
  if (d === cal.leagueRoundDays[14] + 1) createCup(w);
  if (d === cal.leagueRoundDays[cal.leagueRoundDays.length - 1] + 1) {
    createElitePlayoffs(w);
    createPromoPlayoffs(w, 'ORO');
    createPromoPlayoffs(w, 'PLATA');
    createCollegePlayoffs(w);
  }
  if (d === cal.euroGroupDays[cal.euroGroupDays.length - 1] + 1) createEuroKnockouts(w);

  // ---- daily
  dailySquad(w);

  // ---- weekly (Mondays)
  if (weekday(w.season, d) === 1) weekly(w);

  // ---- monthly (1st)
  if (dateNum(w.season, d) === 1) {
    for (const c of w.clubs) {
      monthlyFinance(w, c);
      if (!c.foreign) {
        monthlyArenaUpkeep(w, c);
        monthlyDelegation(w, c);
      }
      if (!isUser(w, c.id)) aiStrategy(w, c);
    }
  }

  // ---- calendar milestones
  if (d === cal.seasonTicketDeadline) for (const c of w.clubs) if (!c.foreign) closeSeasonTickets(w, c);
  if (d === cal.summerWindowClose - 7 && uc) hold(w, 'windowClose', 'The summer transfer window closes in 7 days.');
  if (d === cal.winterWindowClose - 5 && uc) hold(w, 'windowClose', 'The winter transfer window closes in 5 days.');
  if (monthOf(w.season, d) === 9 && dateNum(w.season, d) === 15) for (const c of w.clubs) octoberGrant(w, c);
  if (d === cal.youthIntake) {
    for (const c of w.clubs) youthIntake(w, c);
    generateRecruits(w, 60);
    addNews(w, 'High-school class of the year announced', 'A new class of 18-year-old recruits is available. College programs (and pro clubs) can sign them from the free-agent market.', { tags: ['league'], importance: 1 });
  }
  if (d === cal.seasonEnd) seasonEnd(w);
  if (d === cal.jobMarket) jobMarket(w);
  if (uc && d === cal.leagueRoundDays[18]) contractReminder(w);

  // ---- decisions & game state
  expireDecisions(w);
  checkBankruptcy(w);
  if (w.lastWeekSummary && uc) w.lastWeekSummary.cashDelta += uc.finances.cash - cashBefore;

  // ---- advance
  if (d >= cal.rollover) rollover(w);
  else w.day++;
}

function weekly(w: World) {
  const uc = userClub(w);
  for (const c of w.clubs) {
    weeklySquad(w, c);
    weeklyTacticsDelegation(w, c);
    if (!c.foreign) {
      weeklyCommercial(w, c);
      weeklyProjects(w, c);
      weeklyBoard(w, c);
    }
    weeklyCashSnapshot(w, c);
  }
  const preseason = w.day < buildCalendar(w.season).leagueRoundDays[0];
  weeklyEvaluation(w);
  aiFillRosters(w, preseason);
  aiTransfers(w);
  aiBidsForUser(w);
  delegatedSquadUpkeep(w);
  weeklyScouting(w);
  weeklyEvents(w);
  if (w.user.clubId == null) jobMarket(w, true);
  // media-rights offers lapse; new bidders appear while the club has no local deal
  w.tvOffers = w.tvOffers.filter((o) => o.expiresDay >= absDay(w));
  if (uc && !uc.tv && !w.tvOffers.length && rng(w).chance(0.12)) {
    w.tvOffers = generateTvOffers(w, uc);
    addNews(w, 'New broadcasters interested in your media rights', `${w.tvOffers.length} offers are on the table (Club → Sponsors & TV).`, { tags: ['media', 'finance'], clubIds: [uc.id] });
  }
  // weekly summary for the digest
  if (uc) {
    w.lastWeekSummary = { fromDay: absDay(w), toDay: absDay(w) + 6, cashDelta: 0, results: [], trustDelta: 0, fanDelta: 0, highlights: [] };
  }
}

function contractReminder(w: World) {
  const uc = userClub(w)!;
  const exp = w.players.filter((p) => p.teamId === uc.id && !p.academy && p.contract && p.contract.expires === w.season);
  if (exp.length) {
    addNews(w, `${exp.length} contracts expire this summer`, exp.map((p) => `${p.firstName} ${p.lastName}`).join(', ') + '. Renew now or lose them for free (Club → Contracts).', { tags: ['transfer'], clubIds: [uc.id], importance: 2 });
    hold(w, 'contractExpiry', `${exp.length} player contracts expire at the end of the season.`);
  }
}

function checkBankruptcy(w: World) {
  const uc = userClub(w);
  if (!uc) return;
  const rev = estimateRevenue(w, uc).total;
  if (uc.finances.cash < -rev * 0.5 && uc.finances.overdueDays > 56) {
    if (w.user.role === 'owner') {
      w.gameOver = { reason: `${uc.name} entered administration: debts exceeded half of annual revenue for two months. As owner, you lost the club.`, day: absDay(w) };
      addNews(w, `${uc.name} enter administration`, w.gameOver.reason, { tags: ['finance'], clubIds: [uc.id], importance: 3 });
    } else {
      uc.finances.cash = 0;
      uc.board.owner = 'Court-appointed administrator';
      addNews(w, `${uc.name} enter administration`, 'An administrator takes control of the club finances.', { tags: ['finance'], clubIds: [uc.id], importance: 3 });
      fire(w);
    }
  }
}

function fire(w: World) {
  const uc = userClub(w);
  if (uc) fireUser(w, uc, 'The administrator removed the management team after the club became insolvent.');
}

// ---------------------------------------------------------------------------
// Advance modes
// ---------------------------------------------------------------------------
export type AdvanceMode = 'day' | 'week' | 'nextGame' | 'nextEvent' | 'month' | 'endOfPhase';

export interface AdvanceResult {
  holds: HoldEvent[];
  days: number;
  gamesPlayed: number[]; // fixture ids of user games played
  stoppedBy: string | null;
  /** Set when the clock stopped because one of your games is ready to be watched live. */
  liveFixtureId?: number;
}

export function nextUserFixtureDay(w: World): number | null {
  if (w.user.clubId == null) return null;
  const id = w.user.clubId;
  const f = w.fixtures.filter((x) => !x.played && !x.cancelled && (x.homeId === id || x.awayId === id) && x.day >= w.day).sort((a, b) => a.day - b.day)[0];
  return f ? f.day : null;
}

export function advance(w: World, mode: AdvanceMode, maxDays = 400): AdvanceResult {
  const res: AdvanceResult = { holds: [], days: 0, gamesPlayed: [], stoppedBy: null };
  w.pendingHolds = [];
  const startSeason = w.season;
  const target = (() => {
    switch (mode) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      default: return maxDays;
    }
  })();
  const gameDay = mode === 'nextGame' ? nextUserFixtureDay(w) : null;
  const gameSeason = w.season;
  for (let i = 0; i < target; i++) {
    if (w.gameOver) { res.stoppedBy = 'Game over'; break; }
    const dayBefore = w.day;
    const seasonBefore = w.season;
    const userFixtures = w.user.clubId != null ? fixturesOnDay(w, dayBefore).filter((f) => !f.played && !f.cancelled && (f.homeId === w.user.clubId || f.awayId === w.user.clubId)).map((f) => f.id) : [];
    processDay(w);
    res.days++;
    res.gamesPlayed.push(...userFixtures);
    const important = w.pendingHolds.filter((h) => h.kind !== 'userGame');
    if (mode !== 'day' && mode !== 'week' && mode !== 'month' && important.length) {
      res.stoppedBy = important[0].message;
      break;
    }
    if ((mode === 'week' || mode === 'month') && important.some((h) => ['boardUltimatum', 'jobOffer', 'seasonEvent', 'transferBid'].includes(h.kind))) {
      res.stoppedBy = important[0].message;
      break;
    }
    if (mode === 'nextGame' && (userFixtures.length || (gameDay != null && seasonBefore === gameSeason && dayBefore >= gameDay))) break;
    if (mode === 'nextGame' && gameDay == null && w.season !== startSeason) break;
    if (mode === 'endOfPhase' && w.season !== startSeason) break;
  }
  res.holds = [...w.pendingHolds];
  return res;
}

export function describeDay(w: World): string {
  return fmtDate(w.season, w.day);
}
