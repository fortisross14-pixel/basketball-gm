import type { BoxLine, Club, CompType, Fixture, GameLog, Player, SeasonStats, StatLine, TeamBox, World } from './types';
import { absDay } from './types';
import { simulateGame, teamStrength, LiveGame, type SimTeamIn, type SimTeamOut, type SimResult } from './sim/game';
import { explainGame } from './sim/explain';
import { addNews, age, book, club as getClub, hold, isUser, player as getPlayer, roster, rng, shortName, staffOf, staffRating, playerName, fmtMoney } from './world';
import { onFixtureComplete } from './competitions';
import { gameDemand, opsCostPerGame, travelCost, EURO_TRAVEL } from './economy';
import { INJURY_TYPES } from './data/names';
import { clamp } from './rng';

export function availablePlayers(w: World, c: Club): Player[] {
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const squad = rules?.matchdaySquad ?? 12;
  const r = roster(w, c.id).filter((p) => !p.injury || p.injury.playThroughRisk);
  // starters/rotation chosen by tactics first, then best remaining
  const prefer = new Set([...c.tactics.starters, ...c.tactics.rotationOrder]);
  r.sort((a, b) => (prefer.has(b.id) ? 1 : 0) - (prefer.has(a.id) ? 1 : 0) || b.ovr - a.ovr);
  return r.slice(0, squad);
}

export function simTeamInput(w: World, c: Club): SimTeamIn {
  const coach = staffOf(w, c, 'headCoach');
  const players = availablePlayers(w, c);
  // emergency: sign-less clubs with < 5 players get academy call-ups
  if (players.length < 8) {
    const youth = w.players.filter((p) => p.teamId === c.id && p.academy && !p.injury).sort((a, b) => b.ovr - a.ovr);
    players.push(...youth.slice(0, 8 - players.length));
  }
  return {
    clubId: c.id,
    players: players.map((p) => ({
      id: p.id,
      name: shortName(p),
      pos: p.pos,
      ratings: p.injury?.playThroughRisk ? scaleRatings(p.ratings, 0.92) : p.ratings,
      ovr: p.injury?.playThroughRisk ? Math.round(p.ovr * 0.92) : p.ovr,
      heightCm: p.heightCm,
      freshness: p.freshness,
      morale: p.morale,
      form: p.form,
      clutch: p.personality.clutch,
      injuryProne: p.injury?.playThroughRisk ? p.injuryProne + 40 : p.injuryProne,
      age: age(w, p),
    })),
    tactics: c.tactics,
    coach: { rating: coach?.rating ?? 30, offPref: coach?.offPref ?? null, defPref: coach?.defPref ?? null, motivation: coach?.motivation ?? 40 },
    assistOff: staffRating(w, c, 'assistantOff'),
    assistDef: staffRating(w, c, 'assistantDef'),
    analytics: staffRating(w, c, 'analytics'),
    medical: staffRating(w, c, 'medicalLead') + c.arena.levels.medical * 5,
    physio: staffRating(w, c, 'physio') + c.arena.levels.lockerRoom * 3,
    cohesion: c.cohesion,
  };
}

function scaleRatings<T extends Record<string, number>>(r: T, k: number): T {
  return Object.fromEntries(Object.entries(r).map(([a, v]) => [a, Math.round(v * k)])) as T;
}

const strengthCache = new WeakMap<World, { day: number; season: number; map: Map<number, number> }>();
/** Team strength (memoised per day). */
export function clubStrength(w: World, c: Club): number {
  let e = strengthCache.get(w);
  if (!e || e.day !== w.day || e.season !== w.season) {
    e = { day: w.day, season: w.season, map: new Map() };
    strengthCache.set(w, e);
  }
  let v = e.map.get(c.id);
  if (v == null) {
    v = teamStrength(availablePlayers(w, c));
    e.map.set(c.id, v);
  }
  return v;
}

export function clubStrengthFresh(w: World, c: Club): number {
  return teamStrength(availablePlayers(w, c));
}

function statEntry(p: Player, season: number, teamId: number, comp: CompType): SeasonStats {
  let s = p.stats.find((x) => x.season === season && x.teamId === teamId && x.comp === comp);
  if (!s) {
    s = { season, teamId, comp, gp: 0, gs: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 };
    p.stats.push(s);
  }
  return s;
}

const STAT_KEYS: (keyof StatLine)[] = ['gp', 'gs', 'min', 'pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm'];

/** Set up a fixture to be played live, one period at a time. */
export function startLiveFixture(w: World, f: Fixture): LiveGame {
  return new LiveGame(simTeamInput(w, getClub(w, f.homeId)), simTeamInput(w, getClub(w, f.awayId)), rng(w), !f.neutral);
}

/** Simulate (or take a finished live game) and fully apply one fixture. */
export function playFixture(w: World, f: Fixture, live?: LiveGame): GameLog | null {
  if (f.played || f.cancelled) return null;
  const r = rng(w);
  const home = getClub(w, f.homeId);
  const away = getClub(w, f.awayId);
  if (live && !live.finished) live.playAll();
  const hIn = live ? live.teams[0].inp : simTeamInput(w, home);
  const aIn = live ? live.teams[1].inp : simTeamInput(w, away);
  const res = live ? live.result() : simulateGame(hIn, aIn, r, !f.neutral);
  const hs = res.teams[0].score;
  const as = res.teams[1].score;

  // --- economics
  let attendance = 0;
  let gateRevenue = 0;
  if (!f.neutral) {
    const roundIdx = f.round;
    const d = gameDemand(w, home, away, f.comp, roundIdx, r.float(0.92, 1.08));
    attendance = d.attendance;
    gateRevenue = d.ticketRevenue + d.concessions;
    if (!home.foreign) {
      book(w, home, 'tickets', Math.round(d.ticketRevenue));
      book(w, home, 'concessions', Math.round(d.concessions));
      book(w, home, 'operations', -Math.round(opsCostPerGame(w, home) - (home.arena.owned ? 0 : home.arena.rentPerGame)));
      if (!home.arena.owned) book(w, home, 'rent', -home.arena.rentPerGame);
      if (d.promo) home.fans.local = Math.round(home.fans.local * 1.0015 + 4);
      // full house boosts atmosphere
      if (d.attendance >= d.capacity * 0.97) home.fans.hype = Math.min(100, home.fans.hype + 0.6);
    }
    if (!away.foreign) book(w, away, 'travel', -(f.comp === 'euro' ? EURO_TRAVEL : travelCost(w, away)));
  } else {
    attendance = Math.round(4000 + (home.prestige + away.prestige) * 40);
    for (const c of [home, away]) {
      if (c.foreign) continue;
      book(w, c, 'travel', -(f.comp === 'euro' ? EURO_TRAVEL : travelCost(w, c)));
      book(w, c, 'tickets', Math.round(attendance * 12 * 0.25));
    }
  }

  f.played = true;
  f.result = { home: hs, away: as, ot: res.ot, attendance, gameId: null };

  // --- players
  const injuredNames: string[] = [];
  const injuredIds = new Set(res.injuries.map((i) => i.playerId));
  for (const [side, c] of [[0, home], [1, away]] as [0 | 1, Club][]) {
    const out = res.teams[side];
    const won = side === 0 ? hs > as : as > hs;
    for (const b of out.players) {
      const p = getPlayer(w, b.playerId);
      if (!p) continue;
      if (b.gp) {
        const s = statEntry(p, w.season, c.id, f.comp);
        for (const k of STAT_KEYS) (s[k] as number) += b[k] as number;
        s.min = Math.round(s.min * 10) / 10;
        p.seasonMinutes += b.min;
        p.freshness = clamp(p.freshness - b.min * 0.38, 20, 100);
        const gameScore = b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.orb + 0.3 * b.drb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov;
        const exp = p.ovr / 6;
        p.form = clamp(p.form * 0.7 + (gameScore - exp) * 0.25, -10, 10);
        checkRecords(w, p, c, b.pts, b.orb + b.drb, b.ast);
      }
      p.morale = clamp(p.morale + (won ? 0.6 : -0.6), 0, 100);
      if (injuredIds.has(p.id)) {
        applyInjury(w, p, c);
        injuredNames.push(shortName(p));
      }
    }
    // fan reaction
    if (!c.foreign) {
      const opp = side === 0 ? away : home;
      const upset = won && opp.prestige > c.prestige + 15;
      c.fans.hype = clamp(c.fans.hype + (won ? 1.2 : -1.0) + (upset ? 2.5 : 0), 0, 100);
      c.fans.sentiment = clamp(c.fans.sentiment + (won ? 0.5 : -0.45), 0, 100);
    }
  }

  // --- game log for user games
  let log: GameLog | null = null;
  const userSide = isUser(w, home.id) ? 0 : isUser(w, away.id) ? 1 : -1;
  if (userSide >= 0) {
    log = buildLog(w, f, res, [home, away], userSide as 0 | 1, attendance, gateRevenue, injuredNames, [hIn, aIn]);
    if (live) log.flow = live.timeline.map((t) => ({ m: t.m, h: t.h, a: t.a }));
    f.result.gameId = log.id;
    w.games.push(log);
    const us = userSide === 0 ? home : away;
    const them = userSide === 0 ? away : home;
    const ourScore = userSide === 0 ? hs : as;
    const theirScore = userSide === 0 ? as : hs;
    const won = ourScore > theirScore;
    const mvp = getPlayer(w, log.mvpId);
    addNews(
      w,
      `${won ? 'Win' : 'Defeat'}: ${us.name} ${ourScore}–${theirScore} ${them.name}`,
      `${f.label}. ${mvp ? `${playerName(mvp)} led the way.` : ''} ${log.factors[0] ? log.factors[0].title + '.' : ''} Attendance: ${attendance.toLocaleString('en')}${!f.neutral && userSide === 0 ? `, gate ${fmtMoney(gateRevenue)}` : ''}.`,
      { tags: ['result'], clubIds: [us.id, them.id], importance: 2 },
    );
    if (injuredNames.length) hold(w, 'injury', `Injury during the game: ${injuredNames.join(', ')}.`);
  } else if (Math.abs(hs - as) >= 25 || (hs > as ? away.prestige - home.prestige : home.prestige - away.prestige) > 25) {
    const winner = hs > as ? home : away;
    const loser = hs > as ? away : home;
    addNews(w, `${winner.name} ${Math.max(hs, as)}–${Math.min(hs, as)} ${loser.name}`, `${f.label}: ${winner.prestige < loser.prestige ? 'a big upset.' : 'a statement win.'}`, { tags: ['result'], clubIds: [winner.id, loser.id], importance: 1 });
  }
  onFixtureComplete(w, f);
  return log;
}

function applyInjury(w: World, p: Player, c: Club) {
  const r = rng(w);
  const t = r.weighted(INJURY_TYPES, INJURY_TYPES.map((x) => x.w));
  const med = staffRating(w, c, 'medicalLead');
  const mult = clamp(1 - (med - 50) / 250 - c.arena.levels.medical * 0.03, 0.6, 1.3);
  p.injury = { type: t.type, daysOut: Math.max(1, Math.round(r.int(t.min, t.max) * mult)), severity: t.severity };
  if (t.severity === 'major') {
    addNews(w, `${playerName(p)} out long-term`, `${c.name} confirm a ${t.type.toLowerCase()}. Expected absence: ${Math.round(p.injury.daysOut / 7)} weeks.`, { tags: ['injury'], clubIds: [c.id], playerIds: [p.id], importance: 2 });
  }
}

function checkRecords(w: World, p: Player, c: Club, pts: number, reb: number, ast: number) {
  const upd = (key: string, label: string, value: number) => {
    const rec = w.records.find((x) => x.key === key);
    if (!rec || value > rec.value) {
      const entry = { key, label, value, holder: `${playerName(p)} (${c.abbrev})`, playerId: p.id, clubId: c.id, season: w.season };
      if (rec) Object.assign(rec, entry);
      else w.records.push(entry);
      if (rec && value >= 40) addNews(w, `Record! ${playerName(p)} with ${value} ${label.toLowerCase().includes('point') ? 'points' : ''}`, `A new single-game record: ${label}.`, { tags: ['milestone'], clubIds: [c.id], playerIds: [p.id], importance: 2 });
    }
  };
  if (pts >= 25) upd('game_pts', 'Most points in a game', pts);
  if (reb >= 12) upd('game_reb', 'Most rebounds in a game', reb);
  if (ast >= 10) upd('game_ast', 'Most assists in a game', ast);
}

function teamBox(w: World, out: SimTeamOut, c: Club): TeamBox {
  const players: BoxLine[] = out.players
    .map((b) => {
      const p = getPlayer(w, b.playerId);
      const { secs: _secs, energy, ...line } = b;
      void _secs;
      return { ...line, playerId: b.playerId, name: p ? shortName(p) : '?', pos: p?.pos ?? 'SF', starter: b.starter, energy };
    })
    .sort((a, b) => Number(b.starter) - Number(a.starter) || b.min - a.min);
  const totals = {} as StatLine;
  for (const k of STAT_KEYS) totals[k] = players.reduce((a, x) => a + (x[k] as number), 0);
  totals.min = Math.round(totals.min);
  return { clubId: c.id, score: out.score, quarters: out.quarters, players, totals, fastBreak: out.fastBreak, secondChance: out.secondChance, paint: out.paint, bench: out.bench, offTov: out.offTov, biggestLead: out.biggestLead, timeouts: out.timeouts, fouls: out.fouls };
}

function buildLog(w: World, f: Fixture, res: SimResult, clubs: [Club, Club], us: 0 | 1, attendance: number, revenue: number, injuredNames: string[], inputs: [SimTeamIn, SimTeamIn]): GameLog {
  const names = new Map<number, string>();
  for (const t of inputs) for (const p of t.players) names.set(p.id, p.name);
  const ourStarters = res.teams[us].players.filter((b) => b.starter);
  const starterFoulMinutesLost = ourStarters.filter((b) => b.pf >= 4).reduce((a, b) => a + Math.max(0, 27 - b.min), 0);
  const fit = (t: SimTeamIn) => (t.coach.offPref === t.tactics.off ? 1 : 0) + (t.coach.defPref === t.tactics.def ? 1 : 0);
  const rotAvg = (t: SimTeamIn, k: 'freshness' | 'morale') => { const top = [...t.players].sort((a, b) => b.ovr - a.ovr).slice(0, 8); return top.reduce((a, p) => a + p[k], 0) / Math.max(1, top.length); };
  const context = {
    coachFit: [fit(inputs[0]), fit(inputs[1])] as [number, number],
    freshness: [rotAvg(inputs[0], 'freshness'), rotAvg(inputs[1], 'freshness')] as [number, number],
    morale: [rotAvg(inputs[0], 'morale'), rotAvg(inputs[1], 'morale')] as [number, number],
    cohesion: [inputs[0].cohesion, inputs[1].cohesion] as [number, number],
  };
  const factors = explainGame(res, { us, tactics: [inputs[0].tactics, inputs[1].tactics], names, injuredNames, starterFoulMinutesLost, context });
  const all = [...res.teams[0].players, ...res.teams[1].players];
  const winSide = res.teams[0].score > res.teams[1].score ? 0 : 1;
  const mvp = res.teams[winSide].players.reduce((best, b) => {
    const gs = b.pts + (b.orb + b.drb) * 0.7 + b.ast * 0.9 + b.stl + b.blk - b.tov;
    const bs = best ? best.pts + (best.orb + best.drb) * 0.7 + best.ast * 0.9 + best.stl + best.blk - best.tov : -99;
    return gs > bs ? b : best;
  }, all[0]);
  return {
    id: w.nextId++,
    fixtureId: f.id,
    day: absDay(w),
    season: w.season,
    compId: f.compId,
    home: teamBox(w, res.teams[0], clubs[0]),
    away: teamBox(w, res.teams[1], clubs[1]),
    ot: res.ot,
    factors,
    attendance,
    revenue: Math.round(revenue),
    mvpId: mvp.playerId,
    leadChanges: res.leadChanges,
  };
}
