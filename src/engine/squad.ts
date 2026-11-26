import type { AiStrategy, Club, Player, ScoutAssignment, World, Position } from './types';
import { absDay } from './types';
import { academy, addNews, age, club as getClub, hold, isUser, nextId, playerName, roster, rng, staffRating, userClub, fmtMoney, tierOf } from './world';
import { trainingTick, generatePlayer, expectedMinutes, updateOvr } from './player';
import { returnToPlayCheck } from './events';
import { clamp } from './rng';
import { registrationCheck, moveTo } from './market';
import { book } from './world';

/** Daily: injury recovery and freshness. */
export function dailySquad(w: World) {
  const clubCache = new Map<number, Club>();
  const getC = (id: number) => {
    let c = clubCache.get(id);
    if (!c) { c = getClub(w, id); clubCache.set(id, c); }
    return c;
  };
  for (const p of w.players) {
    if (p.retired) continue;
    if (p.injury) {
      p.injury.daysOut--;
      if (p.injury.daysOut <= 0) {
        p.injury = null;
        if (p.teamId != null && isUser(w, p.teamId)) addNews(w, `${playerName(p)} is back`, 'Fully recovered and available for selection.', { tags: ['injury'], clubIds: [p.teamId], playerIds: [p.id] });
      } else if (p.teamId != null && isUser(w, p.teamId)) {
        returnToPlayCheck(w, getC(p.teamId), p);
      }
    }
    if (p.freshness < 100) {
      let rec = 2.3;
      if (p.teamId != null) {
        const c = getC(p.teamId);
        rec *= 0.8 + staffRating(w, c, 'physio') / 250 + c.arena.levels.lockerRoom * 0.03;
        if (c.training.intensity === 'light') rec *= 1.25;
        if (c.training.intensity === 'hard') rec *= 0.8;
        if (c.training.focus === 'conditioning') rec *= 1.1;
      }
      p.freshness = Math.min(100, p.freshness + rec);
    }
  }
}

/** Weekly: morale, cohesion, training, minor training injuries. */
export function weeklySquad(w: World, c: Club) {
  const r = rng(w);
  const squad = roster(w, c.id);
  const sorted = [...squad].sort((a, b) => b.ovr - a.ovr);
  const leaders = squad.filter((p) => p.personality.leadership >= 75).length;
  const coachMot = staffRating(w, c, 'headCoach');
  const games = Math.max(1, gamesPlayed(w, c));
  for (const p of squad) {
    const rank = sorted.indexOf(p);
    p.minutesExpectation = Math.max(p.minutesExpectation * 0.5 + expectedMinutes(rank, p) * 0.5, p.contract?.rolePromise === 'star' ? 28 : 0);
    const mpg = p.seasonMinutes / games;
    const gap = mpg - p.minutesExpectation;
    let target = 62 + clamp(gap, -15, 8) * 1.4 + (coachMot - 50) / 8 + leaders * 2 + (p.form) * 0.6;
    if (p.injury) target = 55;
    if (p.transferListed) target -= 8;
    p.morale = clamp(p.morale + (target - p.morale) * 0.15, 0, 100);
    if (!p.injury) trainingTick(w, p, r, c.training.focus, c.training.intensity);
    if (c.training.intensity === 'hard' && !p.injury && r.chance(0.006 * (0.5 + p.injuryProne / 60))) {
      p.injury = { type: 'Training knock', daysOut: r.int(3, 12), severity: 'minor' };
      if (isUser(w, c.id)) hold(w, 'injury', `${playerName(p)} picked up a knock in a hard training session.`);
    }
  }
  for (const p of academy(w, c.id)) trainingTick(w, p, r, 'development', 'normal');
  const tacticalBonus = c.training.focus === 'tactical' ? 0.8 : 0;
  c.cohesion = clamp(c.cohesion + 0.5 + leaders * 0.15 + tacticalBonus - (squad.filter((p) => absDay(w) - p.joinedDay < 30).length * 0.15), 0, 100);
}

function gamesPlayed(w: World, c: Club): number {
  if (!c.leagueId) return 1;
  const lc = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`);
  const st = lc?.standings.find((s) => s.clubId === c.id);
  return st ? st.w + st.l : 1;
}

// ---------------------------------------------------------------------------
// Scouting
// ---------------------------------------------------------------------------
export function knowledge(w: World, p: Player): number {
  if (w.user.clubId != null && p.teamId === w.user.clubId) return 100;
  return w.user.knowledge[p.id] ?? baseKnowledge(w, p);
}

function baseKnowledge(w: World, p: Player): number {
  const uc = userClub(w);
  if (!uc || p.teamId == null) return 15;
  const c = getClub(w, p.teamId);
  return c.leagueId === uc.leagueId ? 40 : c.foreign ? 15 : 25;
}

export function addScoutAssignment(w: World, a: Omit<ScoutAssignment, 'id' | 'weeksLeft'>): ScoutAssignment {
  const x: ScoutAssignment = { ...a, id: nextId(w), weeksLeft: 4 };
  w.user.scoutAssignments.push(x);
  return x;
}

export function weeklyScouting(w: World) {
  const c = userClub(w);
  if (!c) return;
  const r = rng(w);
  const scout = staffRating(w, c, 'scoutDirector', 15);
  const gain = (8 + scout / 6) * (w.user.background === 'analyst' ? 1.3 : 1);
  // shortlist gets steady attention
  for (const s of w.user.shortlist) {
    w.user.knowledge[s.playerId] = Math.min(100, (w.user.knowledge[s.playerId] ?? 20) + gain);
  }
  // assignments: scan a region and report the best finds
  for (const a of [...w.user.scoutAssignments]) {
    book(w, c, 'scouting', -Math.round((tierOf(w, c) === 1 ? 2500 : tierOf(w, c) === 2 ? 900 : 400)));
    const pool = w.players.filter((p) => !p.retired && p.teamId !== c.id && !p.academy && (a.region === 'YOUTH' ? age(w, p) <= 21 : p.region === a.region) && (a.focusPos === 'any' || p.pos === a.focusPos) && age(w, p) <= a.maxAge);
    const sample = r.shuffle(pool).slice(0, 12 + Math.round(scout / 8));
    for (const p of sample) w.user.knowledge[p.id] = Math.min(100, Math.max(w.user.knowledge[p.id] ?? 20, 20) + gain * 1.5);
    a.weeksLeft--;
    if (a.weeksLeft <= 0) {
      w.user.scoutAssignments = w.user.scoutAssignments.filter((x) => x !== a);
      // perceived best: scouting noise means weaker scouts can misjudge
      const ranked = sample.map((p) => ({ p, est: (p.ovr * 0.5 + p.pot * 0.5) + r.normal(0, (100 - scout) / 12) })).sort((x, y) => y.est - x.est).slice(0, 3);
      addNews(w, `Scouting report: ${a.region === 'YOUTH' ? 'young talent' : a.region === 'ESP' ? 'domestic market' : a.region === 'EU' ? 'European market' : 'non-EU market'}${a.focusPos !== 'any' ? ` (${a.focusPos})` : ''}`,
        ranked.length ? `Top recommendations: ${ranked.map((x) => `${playerName(x.p)} (${x.p.pos}, ${age(w, x.p)})`).join('; ')}. Full reports are now available in the market.` : 'No players matching the brief were found.',
        { tags: ['club'], clubIds: [c.id], playerIds: ranked.map((x) => x.p.id), importance: 2 });
      for (const x of ranked) if (!w.user.shortlist.some((s) => s.playerId === x.p.id)) w.user.shortlist.push({ playerId: x.p.id, note: 'Scouting assignment', addedDay: absDay(w) });
    }
  }
}

// ---------------------------------------------------------------------------
// Academy
// ---------------------------------------------------------------------------
export function youthIntake(w: World, c: Club) {
  if (c.foreign || c.leagueId === 'COLLEGE') return;
  const r = rng(w);
  const lvl = c.arena.levels.academy;
  const dir = staffRating(w, c, 'academyDirector', 20);
  const clinics = c.campaigns.some((x) => x.kind === 'schoolClinics') ? 1 : 0;
  const n = clamp(Math.round(1 + lvl * 0.6 + dir / 45 + clinics + r.int(0, 1)), 1, 6);
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    const regionRoll = r.chance(0.85 - lvl * 0.04) ? 'ESP' : r.chance(0.6) ? 'EU' : 'NONEU';
    const p = generatePlayer(w, { targetOvr: Math.round(r.normal(26 + lvl * 2.2 + dir / 18 + (3 - (tierOf(w, c) || 1)) * 1.5, 4)), age: r.int(15, 16), region: regionRoll as Player['region'], potBoost: Math.round(lvl * 1.5 + dir / 25 + r.normal(0, 5)) });
    p.homegrown = true;
    p.teamId = c.id;
    p.academy = true;
    p.originClubId = c.id;
    p.contract = { salary: 3000, expires: w.season + 3, buyout: null, rolePromise: 'prospect', signedSeason: w.season, signingBonus: 0, youth: true };
    w.players.push(p);
    names.push(`${playerName(p)} (${p.pos})`);
    if (isUser(w, c.id)) w.user.knowledge[p.id] = Math.max(55, 30 + dir / 2);
  }
  if (isUser(w, c.id)) {
    addNews(w, `Youth intake: ${n} new academy players`, `${names.join(', ')}. Academy level ${lvl}, director rating ${dir}.`, { tags: ['club'], clubIds: [c.id], importance: 2 });
    hold(w, 'seasonEvent', `Youth intake: ${n} new academy players.`);
  }
}

export function promoteYouth(w: World, c: Club, p: Player): { ok: boolean; message: string } {
  const reg = registrationCheck(w, c, p);
  if (!reg.ok) return { ok: false, message: reg.reasons.join(' ') };
  const salary = tierOf(w, c) === 1 ? 30000 : tierOf(w, c) === 2 ? 12000 : 6000;
  moveTo(w, p, c, { salary, years: 3, role: 'prospect', buyout: Math.max(150000, p.value * 3), signingBonus: 0 }, 0, 'youth');
  p.homegrown = true;
  return { ok: true, message: `${playerName(p)} promoted to the first team on a ${fmtMoney(salary)}/yr deal with a release clause.` };
}

export function releaseYouth(w: World, p: Player) {
  p.teamId = null;
  p.academy = false;
  p.contract = null;
}

/** Rollover: academy graduates age out at 20. AI clubs promote or release. */
export function academyRollover(w: World, c: Club) {
  for (const p of academy(w, c.id)) {
    if (age(w, p) < 20) continue;
    if (isUser(w, c.id)) {
      const res = promoteYouth(w, c, p);
      if (!res.ok) {
        releaseYouth(w, p);
        addNews(w, `${playerName(p)} leaves the academy`, 'Aged out without a first-team place available.', { tags: ['club'], clubIds: [c.id], playerIds: [p.id] });
      } else addNews(w, `${playerName(p)} graduates to the first team`, res.message, { tags: ['club'], clubIds: [c.id], playerIds: [p.id] });
    } else if (p.pot >= 55 && registrationCheck(w, c, p).ok) promoteYouth(w, c, p);
    else releaseYouth(w, p);
  }
}

/** How each sporting plan shapes AI decisions (utility weights, not hard switches). */
export const STRATEGY_PROFILE: Record<AiStrategy, { ageMax: number; potWeight: number; spend: number; renewAgeMax: number; invest: boolean }> = {
  contend: { ageMax: 32, potWeight: 0.1, spend: 1.15, renewAgeMax: 34, invest: true },
  balanced: { ageMax: 30, potWeight: 0.3, spend: 1.0, renewAgeMax: 33, invest: true },
  develop: { ageMax: 25, potWeight: 0.75, spend: 0.9, renewAgeMax: 29, invest: true },
  rebuild: { ageMax: 26, potWeight: 0.65, spend: 0.85, renewAgeMax: 30, invest: false },
  survive: { ageMax: 31, potWeight: 0.25, spend: 0.7, renewAgeMax: 32, invest: false },
};

export function strategyProfile(c: Club) {
  return STRATEGY_PROFILE[c.ai.strategy] ?? STRATEGY_PROFILE.balanced;
}

/** Monthly re-plan with hysteresis: entering a plan needs a stronger signal than staying in it. */
export function aiStrategy(w: World, c: Club) {
  if (c.ai.lockedUntil != null && w.season <= c.ai.lockedUntil) { c.ai.strategy = 'survive'; return; }
  const squad = roster(w, c.id);
  const avgAge = squad.reduce((a, p) => a + age(w, p), 0) / Math.max(1, squad.length);
  const st = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`)?.standings.find((s) => s.clubId === c.id);
  const g = st ? st.w + st.l : 0;
  const last = c.history[c.history.length - 1];
  const lastPct = last ? last.wins / Math.max(1, last.wins + last.losses) : 0.5;
  const k = Math.min(1, g / 15);
  const winPct = (g ? st!.w / g : 0.5) * k + lastPct * (1 - k);
  const cur = c.ai.strategy;
  const cashNeg = c.finances.cash < -Math.max(50000, c.finances.budget.payroll * 0.05);
  let next: AiStrategy = cur;
  if (cashNeg) next = 'survive';
  else if (cur === 'survive' && c.finances.cash > c.finances.budget.payroll * 0.1) next = 'balanced';
  else if (cur !== 'contend' && (winPct > 0.68 || c.prestige >= 82)) next = 'contend';
  else if (cur === 'contend' && winPct < 0.52 && c.prestige < 82) next = 'balanced';
  else if (cur !== 'rebuild' && winPct < 0.3 && avgAge > 27) next = 'rebuild';
  else if (cur === 'rebuild' && (winPct > 0.45 || avgAge < 25)) next = 'develop';
  else if (cur === 'balanced' && avgAge < 23.5) next = 'develop';
  else if (cur === 'develop' && avgAge > 26) next = 'balanced';
  c.ai.strategy = next;
}

export function positionNeeds(w: World, c: Club): Position[] {
  const squad = roster(w, c.id);
  const out: Position[] = [];
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) if (squad.filter((p) => p.pos === pos).length < 2) out.push(pos);
  return out;
}

export { updateOvr };
