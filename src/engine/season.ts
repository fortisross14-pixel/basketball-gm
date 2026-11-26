import type { Club, LeagueId, Player, World, SeasonRecord } from './types';
import { SEAT_ZONES, absDay } from './types';
import { addNews, age, book, club as getClub, hold, invalidateIndex, isUser, playerName, roster, rng, staffOf, tierOf, userClub, fmtMoney, academy } from './world';
import { createSeasonCompetitions, leagueComp, sortStandings } from './competitions';
import { defaultRuleset, LEAGUE_IDS } from './rules';
import { proposeBudget, statement, annualFinanceStart } from './finance';
import { setObjectives, seasonReview, fireUser } from './board';
import { placeMerchOrder, expireSponsors, tvMarketCheck } from './commercial';
import { progressPlayer, retirementCheck, refreshValue, salaryAsk, roleFor, expectedMinutes } from './player';
import { recallLoans, renewContract, projectedRank, aiPayFactor } from './market';
import { academyRollover, strategyProfile } from './squad';
import { coachSetsTactics } from './delegation';
import { estimateRevenue, avgLeaguePrestige } from './economy';
import { capacity, avgAttendance, aiInvest } from './arena';
import { updateReputation, fanReaction, boardNote } from './career';
import { clamp } from './rng';
import { staffAsk } from './staff';
import { seasonLabel, buildCalendar } from './calendar';

export function startSeason(w: World) {
  w.rules = { ...defaultRuleset(w.season), leagues: w.rules.leagues, euro: w.rules.euro, cup: w.rules.cup };
  w.rules.version = `BD-RULES-${w.season}.1`;
  w.rules.season = w.season;
  createSeasonCompetitions(w);
  for (const c of w.clubs) {
    c.ticketing.seasonSold = { general: 0, lower: 0, premium: 0 };
    c.ticketing.suitesSold = 0;
    c.campaigns = c.campaigns.filter((x) => x.kind !== 'seasonTicketDrive');
    if (!c.foreign) {
      annualFinanceStart(w, c);
      tvMarketCheck(w, c);
      if (c.shop) shopNewSeason(w, c);
      else placeMerchOrder(w, c);
    }
    if (!isUser(w, c.id)) aiInvest(w, c, estimateRevenue(w, c).total);
    c.finances.budget = proposeBudget(w, c);
    c.ai.payrollTarget = c.finances.budget.payroll;
    setObjectives(w, c);
    if (!isUser(w, c.id) || ['policy', 'notify', 'full'].includes(w.user.delegation.tactics.mode)) coachSetsTactics(w, c);
    const sq = roster(w, c.id).sort((a, b) => b.ovr - a.ovr);
    sq.forEach((p, i) => (p.minutesExpectation = expectedMinutes(i, p)));
  }
  for (const p of w.players) p.seasonMinutes = 0;
  const uc = userClub(w);
  if (uc) {
    addNews(w, `Season ${seasonLabel(w.season)} begins`, `The board has set ${uc.board.objectives.length} objectives and a payroll budget of ${fmtMoney(uc.finances.budget.payroll)}. The summer transfer window is open until 30 September.`, { tags: ['board'], clubIds: [uc.id], importance: 3 });
  }
}

// ---------------------------------------------------------------------------
// End of season
// ---------------------------------------------------------------------------
export interface LeagueMove {
  clubId: number;
  from: LeagueId;
  to: LeagueId;
  reason: string;
}

export interface LicenceCheck {
  ok: boolean;
  reasons: string[];
}

/** Can a club take up a place in a higher league? */
export function licenceCheck(w: World, c: Club, to: LeagueId): LicenceCheck {
  const rules = w.rules.leagues[to];
  const reasons: string[] = [];
  const projects = w.projects[c.id] ?? [];
  const plannedSeats = capacity(c) + projects.reduce((a, p) => a + Object.values(p.seatsDelta ?? {}).reduce((x, y) => x + (y ?? 0), 0) + (p.newArenaSeats ? Object.values(p.newArenaSeats).reduce((x, y) => x + y, 0) - capacity(c) : 0), 0);
  const gs = c.groundShare && c.groundShare.season >= w.season + (w.day >= buildCalendar(w.season).leagueRoundDays[0] ? 1 : 0) ? c.groundShare.seats : 0;
  if (Math.max(plannedSeats, gs) < rules.minArenaSeats) reasons.push(`Arena capacity ${capacity(c).toLocaleString('en')} (incl. works under way: ${plannedSeats.toLocaleString('en')}) is below the ${rules.name} minimum of ${rules.minArenaSeats.toLocaleString('en')}.`);
  const credit = creditLine(w, c);
  if (c.finances.cash + credit < rules.promotionFee) reasons.push(`The ${fmtMoney(rules.promotionFee)} entry guarantee cannot be covered (cash ${fmtMoney(c.finances.cash)} + bank credit ${fmtMoney(credit)}).`);
  const guarantees = c.finances.cash + credit + c.board.ownerWealth * 25000;
  if (guarantees < rules.minPayrollGuarantee) reasons.push(`Financial standard not met: cash, owner guarantees and credit total ${fmtMoney(guarantees)}; the league requires ${fmtMoney(rules.minPayrollGuarantee)}.`);
  return { ok: reasons.length === 0, reasons };
}

/** Bank credit a club can draw on: half of annual revenue minus existing debt. */
export function creditLine(w: World, c: Club): number {
  const debt = c.finances.loans.reduce((a, l) => a + l.balance, 0);
  return Math.max(0, Math.round(estimateRevenue(w, c).total * 0.5 - debt - Math.max(0, -c.finances.cash)));
}

function computeLeagueMoves(w: World): LeagueMove[] {
  const moves: LeagueMove[] = [];
  const order: LeagueId[] = ['ELITE', 'ORO', 'PLATA'];
  for (let i = 1; i < order.length; i++) {
    const lower = order[i];
    const upper = order[i - 1];
    const lr = w.rules.leagues[lower];
    const ur = w.rules.leagues[upper];
    const lc = leagueComp(w, lower)!;
    const sorted = sortStandings(lc.standings).map((s) => s.clubId);
    const po = w.competitions.find((x) => x.id === `${lower}-PO-${w.season}`);
    // candidates in priority order: direct, playoff winner, then playoff finalist, then next ranked
    const cands: number[] = [];
    cands.push(...sorted.slice(0, lr.directPromotion));
    if (po?.champion) cands.push(po.champion);
    if (po?.runnerUp) cands.push(po.runnerUp);
    for (const id of sorted) if (!cands.includes(id)) cands.push(id);
    const slots = lr.directPromotion + lr.playoffPromotion;
    const promoted: number[] = [];
    for (const id of cands) {
      if (promoted.length >= slots) break;
      const c = getClub(w, id);
      const rank = sorted.indexOf(id) + 1;
      if (rank > lr.playoffTeams + lr.directPromotion + 2) break; // not a sporting candidate
      const lic = licenceCheck(w, c, upper);
      if (lic.ok) promoted.push(id);
      else {
        addNews(w, `${c.name} denied promotion`, lic.reasons.join(' '), { tags: ['league', 'board'], clubIds: [c.id], importance: 3 });
        if (isUser(w, id)) hold(w, 'seasonEvent', `Promotion denied: ${lic.reasons.join(' ')}`);
      }
    }
    for (const id of promoted) moves.push({ clubId: id, from: lower, to: upper, reason: sorted.indexOf(id) < lr.directPromotion ? 'Champions' : 'Promotion playoff' });
    // relegation from upper: as many as promoted (keeps league sizes stable)
    const uc = leagueComp(w, upper)!;
    const usorted = sortStandings(uc.standings).map((s) => s.clubId);
    const relegated = usorted.slice(usorted.length - Math.min(ur.relegation, promoted.length) || usorted.length).slice(0, promoted.length);
    for (const id of relegated) moves.push({ clubId: id, from: upper, to: lower, reason: 'Relegated' });
    if (promoted.length < ur.relegation) {
      const spared = usorted.slice(usorted.length - ur.relegation, usorted.length - promoted.length);
      for (const id of spared) addNews(w, `${getClub(w, id).name} spared from relegation`, 'Not enough eligible clubs from the league below met the licence requirements.', { tags: ['league'], clubIds: [id], importance: 2 });
    }
  }
  return moves;
}

function seasonAwards(w: World) {
  for (const lid of LEAGUE_IDS) {
    const lc = leagueComp(w, lid);
    if (!lc) continue;
    const clubs = lc.clubIds;
    const players = w.players.filter((p) => p.teamId != null && clubs.includes(p.teamId) && !p.academy);
    const line = (p: Player) => p.stats.find((s) => s.season === w.season && s.comp === 'league' && s.teamId === p.teamId);
    const standing = new Map(sortStandings(lc.standings).map((s, i) => [s.clubId, i]));
    const score = (p: Player) => {
      const s = line(p);
      if (!s || s.gp < 15) return -1;
      const per = (s.pts + s.orb + s.drb + s.ast * 1.2 + s.stl + s.blk - s.tov - (s.fga - s.fgm) * 0.6) / s.gp;
      return per * (1.15 - (standing.get(p.teamId!) ?? 8) / 30);
    };
    const mvp = [...players].sort((a, b) => score(b) - score(a))[0];
    const scorer = [...players].sort((a, b) => ((line(b)?.pts ?? 0) / Math.max(1, line(b)?.gp ?? 1)) - ((line(a)?.pts ?? 0) / Math.max(1, line(a)?.gp ?? 1)))[0];
    const young = [...players].filter((p) => age(w, p) <= 22).sort((a, b) => score(b) - score(a))[0];
    const name = w.rules.leagues[lid].short;
    const give = (p: Player | undefined, award: string) => {
      if (!p || score(p) < 0) return;
      p.awards.push({ season: w.season, award: `${name} ${award}` });
      w.awards.push({ season: w.season, leagueId: lid, award, playerId: p.id, clubId: p.teamId, name: playerName(p) });
      if (lid === 'ELITE' || isUser(w, p.teamId)) addNews(w, `${playerName(p)} named ${name} ${award}`, `${getClub(w, p.teamId!).name}.`, { tags: ['award'], clubIds: [p.teamId!], playerIds: [p.id], importance: lid === 'ELITE' ? 2 : 1 });
    };
    give(mvp, 'MVP');
    give(scorer, 'Top Scorer');
    give(young, 'Best Young Player');
    // coach of the year: most wins above expectation (prestige)
    const over = sortStandings(lc.standings).map((s, i) => ({ id: s.clubId, d: (avgLeaguePrestige(w, lid) - getClub(w, s.clubId).prestige) / 4 - i }));
    const coy = over.sort((a, b) => b.d - a.d)[0];
    const coach = coy ? staffOf(w, getClub(w, coy.id), 'headCoach') : null;
    if (coach) {
      w.awards.push({ season: w.season, leagueId: lid, award: 'Coach of the Year', playerId: null, clubId: coy.id, name: `${coach.firstName} ${coach.lastName}` });
      coach.reputation = Math.min(100, coach.reputation + 6);
      coach.rating = Math.min(99, coach.rating + 1);
    }
  }
}

function competitionResult(w: World, c: Club): { playoff: string; cup: string; euro: string } {
  const res = { playoff: '—', cup: '—', euro: '—' };
  for (const cmp of w.competitions.filter((x) => x.season === w.season && x.kind !== 'league')) {
    if (!cmp.clubIds.includes(c.id)) continue;
    let label = 'Group stage';
    if (cmp.champion === c.id) label = cmp.kind === 'promo' ? 'Won playoff' : 'Champion';
    else if (cmp.runnerUp === c.id) label = 'Final';
    else {
      const lost = cmp.series.filter((s) => (s.highSeed === c.id || s.lowSeed === c.id) && s.winner != null && s.winner !== c.id)[0];
      if (lost) label = lost.round;
    }
    if (cmp.kind === 'cup') res.cup = label;
    else if (cmp.kind === 'euro') res.euro = label;
    else res.playoff = label;
  }
  return res;
}

export function seasonEnd(w: World) {
  seasonAwards(w);
  const moves = computeLeagueMoves(w);
  w.pendingMoves = moves;
  // prize money
  for (const lid of LEAGUE_IDS) {
    const lc = leagueComp(w, lid)!;
    const sorted = sortStandings(lc.standings);
    const champ = getClub(w, sorted[0].clubId);
    const champion = lid === 'ELITE' || lid === 'COLLEGE' ? w.competitions.find((x) => x.id === `${lid}-PO-${w.season}`)?.champion ?? sorted[0].clubId : sorted[0].clubId;
    book(w, getClub(w, champion), 'prize', w.rules.leagues[lid].prizeChampion);
    if (lid !== 'ELITE' && lid !== 'COLLEGE') champ.trophies.push({ season: w.season, name: `${w.rules.leagues[lid].name} (regular season)` });
  }
  const cup = w.competitions.find((x) => x.id === `CUP-${w.season}`);
  if (cup) for (const id of cup.clubIds) book(w, getClub(w, id), 'prize', id === cup.champion ? w.rules.cup.prizeWinner : w.rules.cup.prizeParticipation);
  const euro = w.competitions.find((x) => x.id === `EURO-${w.season}`);
  if (euro) for (const id of euro.clubIds) {
    const c = getClub(w, id);
    if (c.foreign) continue;
    const st = euro.standings.find((s) => s.clubId === id);
    book(w, c, 'prize', w.rules.euro.prizeParticipation + (st?.w ?? 0) * w.rules.euro.prizePerWin + (euro.champion === id ? w.rules.euro.prizeChampion : 0));
    book(w, c, 'tv', w.rules.euro.tvShare);
  }
  // history
  for (const c of w.clubs) {
    const lc = c.leagueId ? leagueComp(w, c.leagueId) : null;
    const sorted = lc ? sortStandings(lc.standings) : [];
    const rank = sorted.findIndex((s) => s.clubId === c.id) + 1;
    const st = sorted.find((s) => s.clubId === c.id);
    const comp = competitionResult(w, c);
    const stmt = statement(c, w.season);
    const best = roster(w, c.id).sort((a, b) => b.ovr - a.ovr)[0];
    const coach = staffOf(w, c, 'headCoach');
    const rec: SeasonRecord = {
      season: w.season, leagueId: c.leagueId, tier: tierOf(w, c), rank, wins: st?.w ?? 0, losses: st?.l ?? 0,
      playoff: comp.playoff, cup: comp.cup, euro: comp.euro, revenue: Math.round(stmt.totalIncome), profit: Math.round(stmt.net),
      attendance: Math.round(avgAttendance(w, c)), promoted: moves.some((m) => m.clubId === c.id && m.reason !== 'Relegated'),
      relegated: moves.some((m) => m.clubId === c.id && m.reason === 'Relegated'),
      coach: coach ? `${coach.firstName} ${coach.lastName}` : '—', topPlayer: best ? playerName(best) : '—',
    };
    c.history.push(rec);
    // prestige drifts with success
    const tier = tierOf(w, c);
    const tierBase = c.leagueId === 'COLLEGE' ? c.prestige : tier === 1 ? 60 : tier === 2 ? 38 : tier === 3 ? 24 : c.prestige;
    const perf = lc ? (sorted.length / 2 - rank) / sorted.length : 0;
    void 0;
    c.prestige = Math.round(clamp(c.prestige + perf * 6 + (tierBase - c.prestige) * 0.05 + (rec.promoted ? 4 : 0) - (rec.relegated ? 5 : 0) + (comp.playoff === 'Champion' ? 3 : 0) + (comp.euro === 'Champion' ? 4 : 0), 5, 99));
  }
  // coaching careers: records, dismissals, the NBA, vacancies
  recordCoachSeasons(w);
  coachingMarket(w);
  // user review & reputation
  const uc = userClub(w);
  if (uc) {
    const review = seasonReview(w, uc);
    const rec = uc.history[uc.history.length - 1];
    let rep = (review.score - 0.5) * 12;
    const ach: string[] = [];
    if (rec.promoted) { rep += 10; ach.push(`Promoted to ${w.rules.leagues[moves.find((m) => m.clubId === uc.id)!.to].name}`); }
    if (rec.relegated) rep -= 10;
    if (rec.playoff === 'Champion') { rep += 12; ach.push('League champion'); }
    if (rec.cup === 'Champion') { rep += 6; ach.push('Copa winner'); }
    if (rec.euro === 'Champion') { rep += 12; ach.push('Continental Cup winner'); }
    updateReputation(w, rep, ach.join(', ') || undefined);
    addNews(w, `Season review: ${Math.round(review.score * 100)}% of objectives`, review.lines.join(' · ') + `. Executive reputation now ${w.user.reputation}.`, { tags: ['board'], clubIds: [uc.id], importance: 3 });
    hold(w, 'seasonEvent', `Season review: ${review.lines.join(' · ')}`);
    if (rec.promoted) fanReaction(w, 15, `Promotion to the ${w.rules.leagues[moves.find((m) => m.clubId === uc.id)!.to].name}`);
    if (rec.relegated) fanReaction(w, -20, 'Relegation');
    if (rec.playoff === 'Champion' || rec.cup === 'Champion' || rec.euro === 'Champion') fanReaction(w, 15, 'A trophy for the club');
    boardNote(w, Math.round((review.score - 0.5) * 20), `Season review: ${Math.round(review.score * 100)}% of objectives met`);
    // the owner decides on your future, weighing objectives and how the supporters rate you
    const verdict = review.score * 0.45 + (uc.board.overall / 100) * 0.35 + (w.user.approval.fans / 100) * 0.2;
    const stint = w.user.career[w.user.career.length - 1];
    const firstSeason = stint && stint.clubId === uc.id && absDay(w) - stint.from < 400;
    const grace = firstSeason ? (w.settings.difficulty === 'relaxed' ? 0.14 : 0.08) : uc.promotedSeason === w.season && w.settings.difficulty === 'relaxed' ? 0.08 : 0;
    const bar = { relaxed: 0.26, standard: 0.34, demanding: 0.42, brutal: 0.48 }[w.settings.difficulty] - grace;
    const triumph = rec.promoted || rec.playoff === 'Champion' || rec.cup === 'Champion' || rec.euro === 'Champion';
    if (w.user.role === 'gm' && !triumph && verdict < bar) fireUser(w, uc, `The owner decided not to continue: ${Math.round(review.score * 100)}% of objectives met, board confidence ${uc.board.overall}/100, fan approval ${Math.round(w.user.approval.fans)}/100.`);
  }
  for (const m of moves) {
    const c = getClub(w, m.clubId);
    addNews(w, m.reason === 'Relegated' ? `${c.name} relegated to ${w.rules.leagues[m.to].name}` : `${c.name} promoted to ${w.rules.leagues[m.to].name}!`, m.reason, { tags: ['league', 'milestone'], clubIds: [c.id], importance: isUser(w, c.id) ? 3 : 2 });
  }
}

// ---------------------------------------------------------------------------
// Rollover → new season
// ---------------------------------------------------------------------------
export function rollover(w: World) {
  const r = rng(w);
  const moves = w.pendingMoves ?? [];
  w.pendingMoves = [];
  // progression, ageing, retirements (in the season that is ending)
  for (const p of w.players) {
    if (p.retired) continue;
    if (p.teamId != null) p.career.push({ season: w.season, teamId: p.teamId, tier: tierOf(w, getClub(w, p.teamId)), ovr: p.ovr });
    progressPlayer(w, p, r);
  }
  const nextSeason = w.season + 1;
  // league moves
  for (const m of moves) {
    const c = getClub(w, m.clubId);
    if (m.to !== m.from && m.reason !== 'Relegated') book(w, c, 'leagueFees', -w.rules.leagues[m.to].promotionFee);
    c.leagueId = m.to;
    if (m.reason !== 'Relegated') c.promotedSeason = nextSeason;
    for (const s of c.sponsors) if (s.promoBonus && m.reason !== 'Relegated') book(w, c, 'sponsors', s.promoBonus);
    if (m.reason !== 'Relegated') { c.fans.hype = clamp(c.fans.hype + 20, 0, 100); c.fans.local = Math.round(c.fans.local * 1.08); }
    else { c.fans.hype = clamp(c.fans.hype - 15, 0, 100); }
  }
  // contracts & retirements happen at the season boundary; pay factors snapshot before any contract expires
  const payFactor = new Map(w.clubs.map((c) => [c.id, aiPayFactor(w, c)]));
  w.season = nextSeason;
  w.day = 0;
  recallLoans(w);
  for (const p of w.players) {
    if (p.retired) continue;
    if (retirementCheck(w, p, r)) {
      retire(w, p);
      continue;
    }
    const pc = p.teamId != null ? getClub(w, p.teamId) : null;
    if (pc?.leagueId === 'COLLEGE' && p.contract && p.contract.expires >= w.season && p.ovr >= 62 && age(w, p) >= 19 && r.chance(0.55)) {
      addNews(w, `${playerName(p)} declares for the pros`, `${pc.name}'s ${p.pos} (rated ${p.ovr}) leaves college early and enters the professional market.`, { tags: ['transfer'], clubIds: [pc.id], playerIds: [p.id], importance: isUser(w, pc.id) ? 2 : 1 });
      p.teamId = null; p.contract = null; continue;
    }
    if (p.contract && p.contract.expires < w.season && !p.academy) {
      const c = p.teamId != null ? getClub(w, p.teamId) : null;
      if (c && !isUser(w, c.id) && c.leagueId !== 'COLLEGE' && aiWantsRenewal(w, c, p) && r.chance(0.5 + p.personality.loyalty / 250)) {
        const sal = Math.round(salaryAsk(w, p, c) * (payFactor.get(c.id) ?? 1) / 1000) * 1000;
        p.contract = null;
        renewContract(w, c, p, { salary: sal, years: r.int(1, 3), role: roleFor(projectedRank(w, c, p)), buyout: null, signingBonus: 0 });
      } else {
        if (c && isUser(w, c.id)) addNews(w, c.leagueId === 'COLLEGE' ? `${playerName(p)} graduates` : `${playerName(p)} leaves as a free agent`, c.leagueId === 'COLLEGE' ? 'His college eligibility is over; he moves on to the professional market.' : 'His contract expired.', { tags: ['transfer'], clubIds: [c.id], playerIds: [p.id] });
        p.teamId = null;
        p.contract = null;
        p.transferListed = false;
      }
    }
    refreshValue(w, p);
    p.injury = p.injury && p.injury.daysOut > 60 ? { ...p.injury, daysOut: p.injury.daysOut - 60 } : null;
    p.freshness = 100;
    p.form = 0;
  }
  // staff contracts
  for (const s of w.staff) {
    if (s.contract && s.contract.expires < w.season && s.teamId != null) {
      const c = getClub(w, s.teamId);
      // your staff usually extend (unless ambition takes them elsewhere); AI staff renew 70% of the time
      const stays = isUser(w, c.id) ? !r.chance(0.08 + s.ambition / 900) : r.chance(0.7);
      if (stays) s.contract = { salary: staffAsk(w, s, tierOf(w, c) || 1), expires: w.season + r.int(1, 2) };
      else {
        if (isUser(w, c.id)) { addNews(w, `${s.firstName} ${s.lastName} leaves the club`, `${s.role === 'headCoach' ? 'Your head coach' : 'A member of staff'} did not extend an expiring contract. Hire a replacement in Team → Staff.`, { tags: ['staff'], clubIds: [c.id], importance: s.role === 'headCoach' ? 3 : 1 }); hold(w, 'decision', `${s.firstName} ${s.lastName} (${s.role === 'headCoach' ? 'head coach' : 'staff'}) has left: the post is vacant.`); }
        if (c.staff[s.role] === s.id) delete c.staff[s.role];
        s.teamId = null;
        s.contract = null;
      }
    }
    if (s.teamId == null && s.born < w.season - 70) s.reputation = 0;
  }
  // AI clubs fill vacant staff posts
  for (const c of w.clubs) {
    if (isUser(w, c.id)) continue;
    for (const role of ['headCoach', 'assistantOff', 'assistantDef', 'medicalLead', 'physio'] as const) {
      if (c.staff[role] != null) continue;
      const pool = w.staff.filter((s) => s.teamId == null && !s.nba && s.role === role).sort((a, b) => b.rating - a.rating);
      const pick = pool.find((s) => s.rating <= c.prestige + 25) ?? pool[pool.length - 1];
      if (pick) { pick.teamId = c.id; pick.contract = { salary: staffAsk(w, pick, tierOf(w, c) || 1), expires: w.season + 1 }; c.staff[role] = pick.id; pick.history.push({ season: w.season, teamId: c.id, role }); }
    }
  }
  for (const c of w.clubs) {
    academyRollover(w, c);
    expireSponsors(w, c);
    c.board.injectionsThisSeason = 0;
    if (!c.foreign && !isUser(w, c.id) && c.finances.cash < 0 && c.finances.cash > -estimateRevenue(w, c).total * 0.4 && rng(w).chance(c.board.ownerWealth / 100)) {
      // AI owners cover part of the hole
      const top = Math.round(-c.finances.cash * (0.5 + c.board.ownerWealth / 200));
      book(w, c, 'ownerInjection', top);
    }
    if (!c.foreign && c.finances.cash < -estimateRevenue(w, c).total * 0.4 && !isUser(w, c.id)) {
      // AI rescue: new investor
      c.finances.cash = Math.round(estimateRevenue(w, c).total * 0.05);
      c.finances.loans = [];
      c.prestige = Math.max(5, c.prestige - 6);
      c.board.owner = 'New investor group';
      c.ai.strategy = 'survive';
      c.ai.lockedUntil = w.season; // a rescued club must cut costs for a full season
      addNews(w, `${c.name} rescued by new investors`, 'The club avoided administration after a change of ownership.', { tags: ['finance', 'league'], clubIds: [c.id] });
    }
  }
  replenishPools(w);
  pruneHistory(w);
  invalidateIndex(w);
  startSeason(w);
}

function aiWantsRenewal(w: World, c: Club, p: Player): boolean {
  const sq = roster(w, c.id).sort((a, b) => b.ovr - a.ovr);
  const rank = sq.indexOf(p);
  return age(w, p) <= strategyProfile(c).renewAgeMax && rank >= 0 && rank < 10 && salaryAsk(w, p, c) <= c.ai.payrollTarget * 0.22;
}

function retire(w: World, p: Player) {
  const c = p.teamId != null ? getClub(w, p.teamId) : null;
  p.retired = true;
  p.teamId = null;
  p.contract = null;
  const peak = Math.max(p.ovr, ...p.career.map((x) => x.ovr));
  const seasons = p.career.length;
  const awards = p.awards.length;
  if (peak >= 76 || (peak >= 70 && awards >= 2) || awards >= 4) {
    p.hallOfFame = true;
    w.hallOfFame.push({ playerId: p.id, name: playerName(p), season: w.season, summary: `Peak rating ${peak}, ${seasons} seasons, ${awards} awards.` });
    addNews(w, `${playerName(p)} retires — a Hall of Fame career`, `Peak rating ${peak}, ${seasons} seasons, ${awards} major awards.`, { tags: ['milestone'], playerIds: [p.id], importance: 2 });
  } else if (c && isUser(w, c.id)) {
    addNews(w, `${playerName(p)} retires`, `He ends a ${seasons}-season career.`, { tags: ['club'], clubIds: [c.id], playerIds: [p.id] });
  }
}

/** Keep the free-agent and staff pools healthy across long careers. */
function replenishPools(w: World) {
  const r = rng(w);
  const fas = w.players.filter((p) => p.teamId == null && !p.retired).length;
  // lazy import to avoid cycle at module init
  for (let i = fas; i < 160; i++) {
    const a = r.int(19, 31);
    const p = generateFreeAgent(w, a, Math.round(clamp(r.normal(50, 8), 34, 70)));
    w.players.push(p);
  }
  const staffFa = w.staff.filter((s) => s.teamId == null && !s.nba).length;
  if (staffFa < 60) {
    for (let i = staffFa; i < 80; i++) {
      w.staff.push(genStaff(w, r.pick(['headCoach', 'assistantOff', 'assistantDef', 'assistantDev', 'scoutDirector', 'analytics', 'medicalLead', 'physio', 'academyDirector', 'marketingDirector', 'commercialDirector', 'prLead'] as const), clamp(r.normal(50, 15), 20, 88)));
    }
  }
}

import { generatePlayer } from './player';
import { shopNewSeason } from './shop';
import { recordCoachSeasons, coachingMarket } from './coaching';
import { generateStaff } from './staff';
function generateFreeAgent(w: World, a: number, ovr: number) {
  return generatePlayer(w, { targetOvr: ovr, age: a });
}
function genStaff(w: World, role: Parameters<typeof generateStaff>[1], rating: number) {
  return generateStaff(w, role, rating, null, 2);
}

function pruneHistory(w: World) {
  const keepFrom = w.season - 2;
  w.fixtures = w.fixtures.filter((f) => {
    const s = Number(f.compId.split('-').pop());
    return s >= w.season - 1;
  });
  w.games = w.games.filter((g) => g.season >= w.season - 1);
  // drop retired non-notable players after a few seasons
  const notable = new Set([...w.hallOfFame.map((h) => h.playerId), ...w.records.map((r) => r.playerId), ...w.awards.map((a) => a.playerId)]);
  w.players = w.players.filter((p) => !p.retired || notable.has(p.id) || p.career.some((c) => c.season >= keepFrom) || p.career.some((c) => w.user.career.some((s) => s.clubId === c.teamId)));
  // trim old stat lines
  for (const p of w.players) if (p.stats.length > 60) p.stats = p.stats.slice(-60);
  w.staff = w.staff.filter((s) => s.teamId != null || s.born >= w.season - 68);
  for (const c of w.clubs) {
    const keys = Object.keys(c.finances.seasonTotals).map(Number).sort();
    while (keys.length > 8) delete c.finances.seasonTotals[keys.shift()!];
  }
  void academy;
  void SEAT_ZONES;
  void absDay;
}

export function moves(w: World): LeagueMove[] {
  return w.pendingMoves ?? [];
}
