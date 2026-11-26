import type { Club, DefScheme, OffSystem, Player, World, SeatZone, Department, DelegationMode } from './types';
import { SEAT_ZONES } from './types';
import { addNews, isUser, logDelegation, roster, staffOf, staffRating, fmtMoney, rng } from './world';
import { DEF_LABEL, OFF_LABEL } from './staff';
import { gameDemand, avgLeaguePrestige } from './economy';
import { presetPlan } from './gameplan';
import { clamp } from './rng';

export const MODE_LABEL: Record<DelegationMode, string> = {
  manual: 'Manual',
  recommend: 'Recommend',
  policy: 'Execute within policy',
  notify: 'Execute, then notify',
  full: 'Fully delegate',
};

export const MODE_DESC: Record<DelegationMode, string> = {
  manual: 'Every decision comes to you, with no staff recommendation.',
  recommend: 'Every decision comes to you with the responsible staff member\'s recommendation.',
  policy: 'Staff act automatically on routine, low-impact items inside your policy; anything else comes to you.',
  notify: 'Staff act on everything and tell you what they did in the news feed.',
  full: 'Staff act on everything; decisions are only recorded in the delegation log.',
};

export const DEPT_LABEL: Record<Department, string> = {
  tactics: 'Tactics & rotation (Head coach)',
  transfers: 'Roster & transfers (Sporting director)',
  scouting: 'Scouting (Scouting director)',
  tickets: 'Ticket pricing (Commercial director)',
  sponsors: 'Sponsorship (Commercial director)',
  marketing: 'Marketing campaigns (Marketing director)',
  media: 'Media & press (PR lead)',
  medical: 'Return-to-play (Medical lead)',
  academy: 'Academy (Academy director)',
  board: 'Board relations',
};

// ---------------------------------------------------------------------------
// Personnel fit for tactical systems (0-100)
// ---------------------------------------------------------------------------
function top(players: Player[], n: number) {
  return [...players].sort((a, b) => b.ovr - a.ovr).slice(0, n);
}

export function offFit(players: Player[], sys: OffSystem): number {
  const t = top(players, 8);
  if (!t.length) return 50;
  const avg = (f: (p: Player) => number) => t.reduce((a, p) => a + f(p), 0) / t.length;
  switch (sys) {
    case 'paceSpace': return clamp((t.filter((p) => p.ratings.thr >= 58).length / t.length) * 90 + (avg((p) => p.ratings.spd) - 50) * 0.6 + 15, 0, 100);
    case 'motion': return clamp((avg((p) => p.ratings.pas) - 45) * 1.6 + (avg((p) => p.ratings.iq) - 45) * 1.2 + 30, 0, 100);
    case 'pnr': {
      const handler = Math.max(...t.filter((p) => p.pos === 'PG' || p.pos === 'SG').map((p) => (p.ratings.hnd + p.ratings.pas) / 2), 30);
      const roller = Math.max(...t.filter((p) => p.pos === 'C' || p.pos === 'PF').map((p) => (p.ratings.ins + p.ratings.jmp) / 2), 30);
      return clamp((handler - 45) * 1.5 + (roller - 45) * 1.2 + 25, 0, 100);
    }
    case 'post': {
      const bigs = t.filter((p) => p.pos === 'C' || p.pos === 'PF');
      const best = Math.max(...bigs.map((p) => (p.ratings.ins + p.ratings.str) / 2), 30);
      return clamp((best - 45) * 2.2 + 20, 0, 100);
    }
    case 'isolation': {
      const gap = t[0].ovr - (t[1]?.ovr ?? t[0].ovr);
      return clamp(gap * 9 + (t[0].ratings.hnd - 50) * 0.8 + 35, 0, 100);
    }
  }
}

export function defFit(players: Player[], sch: DefScheme): number {
  const t = top(players, 8);
  if (!t.length) return 50;
  const avg = (f: (p: Player) => number) => t.reduce((a, p) => a + f(p), 0) / t.length;
  const rimP = Math.max(...t.map((p) => (p.ratings.idef + p.ratings.blk) / 2), 30);
  switch (sch) {
    case 'switch': return clamp((avg((p) => p.ratings.pdef) - 45) * 1.8 + (avg((p) => p.ratings.spd) - 45) * 0.6 + 30 - Math.abs(avg((p) => p.heightCm) - 199) * 1.5, 0, 100);
    case 'drop': return clamp((rimP - 45) * 2 + 30, 0, 100);
    case 'packPaint': return clamp((avg((p) => p.ratings.idef) - 40) * 1.4 + (rimP - 50) * 0.8 + 30, 0, 100);
    case 'pressure': return clamp((avg((p) => p.ratings.stl) - 40) * 1.2 + (avg((p) => p.ratings.end) - 45) * 1.2 + (avg((p) => p.ratings.spd) - 45) * 0.8 + 20, 0, 100);
    case 'zone': return clamp((avg((p) => p.ratings.iq) - 45) * 1.2 + (rimP - 45) * 0.8 + 35, 0, 100);
  }
}

export const OFF_INFO: Record<OffSystem, { desc: string; upside: string; downside: string }> = {
  paceSpace: { desc: 'Five-out spacing and early threes; drive-and-kick.', upside: 'High-efficiency threes and open driving lanes when you have shooters.', downside: 'Bricks and long rebounds without at least three reliable shooters.' },
  motion: { desc: 'Constant cutting and ball movement; everyone touches the ball.', upside: 'High assist rate and balanced usage; hard to scout.', downside: 'More turnovers with poor passers; stars get fewer shots.' },
  pnr: { desc: 'Repeated pick-and-roll for the lead guard and a rolling big.', upside: 'Easy rim and mid-range looks for a good handler + roller.', downside: 'Predictable; exposed by switching defences and weak handlers.' },
  post: { desc: 'Play through the post, inside-out passing.', upside: 'Rim pressure, fouls drawn, offensive rebounds.', downside: 'Slow; packed paints and zones stifle it.' },
  isolation: { desc: 'Clear out for your best scorer.', upside: 'Low turnovers; a star can carry the team in close games.', downside: 'Low assists; fragile if the star is tired, injured or cold.' },
};

export const DEF_INFO: Record<DefScheme, { desc: string; upside: string; downside: string }> = {
  switch: { desc: 'Switch every screen; versatile defenders stay in front.', upside: 'Limits threes and pick-and-roll; good vs motion offences.', downside: 'Mismatches at the rim if your bigs are slow.' },
  drop: { desc: 'Big drops to protect the rim on pick-and-roll.', upside: 'Strong rim protection; fewer fouls.', downside: 'Concedes pull-up mid-range jumpers.' },
  packPaint: { desc: 'Collapse on drives; dare them to shoot.', upside: 'Shuts down post and slashers.', downside: 'Open threes for good shooting teams.' },
  pressure: { desc: 'Full-court pressure and trapping; run off turnovers.', upside: 'Turnovers and fast-break points.', downside: 'Fatigue, fouls and easy layups when beaten.' },
  zone: { desc: '2-3 zone protecting the paint.', upside: 'Hides weak individual defenders; protects the rim.', downside: 'Gives up threes and offensive rebounds.' },
};

/** Coach sets tactics (AI clubs always; user club when tactics are delegated). */
export function coachSetsTactics(w: World, c: Club, log = false) {
  const coach = staffOf(w, c, 'headCoach');
  const players = roster(w, c.id).filter((p) => !p.injury);
  const offs: OffSystem[] = ['paceSpace', 'motion', 'pnr', 'post', 'isolation'];
  const defs: DefScheme[] = ['switch', 'drop', 'packPaint', 'pressure', 'zone'];
  const adapt = coach ? coach.rating / 100 : 0.3;
  // the current plan gets a familiarity bonus so one injury doesn't flip the system
  const bestOff = offs.map((o) => ({ o, s: offFit(players, o) * adapt + (coach?.offPref === o ? 22 : 0) + (c.tactics.off === o ? 6 : 0) })).sort((a, b) => b.s - a.s)[0].o;
  const bestDef = defs.map((d) => ({ d, s: defFit(players, d) * adapt + (coach?.defPref === d ? 22 : 0) + (c.tactics.def === d ? 6 : 0) })).sort((a, b) => b.s - a.s)[0].d;
  let off = bestOff, def = bestDef;
  // for your club the coach also listens to the stands and the boardroom (balanced game plan)
  if (isUser(w, c.id)) { const p = presetPlan(w, c, 'balanced'); off = p.off; def = p.def; c.tactics.pace = p.pace; }
  const changed = c.tactics.off !== off || c.tactics.def !== def;
  c.tactics.off = off;
  c.tactics.def = def;
  c.tactics.starters = [];
  c.tactics.rotationOrder = [];
  const youthObjective = isUser(w, c.id) && c.board.objectives.some((o) => o.kind === 'youthMinutes') && players.filter((p) => w.season - p.born <= 22).length >= 2;
  if (youthObjective) c.tactics.rotation = 'development';
  else if (c.ai.strategy === 'develop' || c.ai.strategy === 'rebuild') c.tactics.rotation = 'development';
  else if (c.ai.strategy === 'contend') c.tactics.rotation = 'veteran';
  else c.tactics.rotation = 'balanced';
  if (log && changed) {
    logDelegation(w, 'tactics', coach ? `Coach ${coach.lastName}` : 'Interim coach', `Set ${OFF_LABEL[off]} / ${DEF_LABEL[def]}`, `Best blend of the coach's preferences and the healthy roster's fit (offence fit ${Math.round(offFit(players, off))}, defence fit ${Math.round(defFit(players, def))}).`, 'Rotation chosen automatically each game.');
    if (w.user.delegation.tactics.mode === 'notify') addNews(w, 'Coach adjusts the game plan', `${OFF_LABEL[off]} on offence, ${DEF_LABEL[def]} on defence.`, { tags: ['delegation'], clubIds: [c.id] });
  }
}

// ---------------------------------------------------------------------------
// Ticket pricing — commercial director (delegated) and AI clubs
// ---------------------------------------------------------------------------
export function optimisePrices(w: World, c: Club, log = false) {
  const comm = staffRating(w, c, 'commercialDirector');
  const r = rng(w);
  const opp = { prestige: c.leagueId ? avgLeaguePrestige(w, c.leagueId) : 70, rivals: [], id: -1 } as unknown as Club;
  const before = { ...c.ticketing.prices };
  for (const z of SEAT_ZONES) {
    let best = c.ticketing.prices[z];
    let bestScore = -Infinity;
    for (const m of [0.8, 0.9, 1, 1.1, 1.2]) {
      const trial = Math.max(3, Math.round(before[z] * m));
      c.ticketing.prices[z] = trial;
      const d = gameDemand(w, c, opp, 'league', 1);
      // revenue plus a sentiment-preserving value on attendance (good directors weigh long-term fans)
      const score = d.zones[z].revenue + d.zones[z].sold * (2 + comm / 25) + d.concessions * 0.3;
      if (score > bestScore) { bestScore = score; best = trial; }
    }
    // weaker directors make noisier calls
    c.ticketing.prices[z] = Math.max(3, Math.round(best * (1 + r.normal(0, (100 - comm) / 900))));
  }
  if (log) {
    const changes = SEAT_ZONES.filter((z) => c.ticketing.prices[z] !== before[z]).map((z) => `${z} ${fmtMoney(before[z])}→${fmtMoney(c.ticketing.prices[z])}`);
    if (changes.length) logDelegation(w, 'tickets', 'Commercial director', `Adjusted ticket prices: ${changes.join(', ')}`, 'Balances gate revenue against attendance and matchday spend for an average opponent.', 'Optimised expected revenue per home game.');
  }
  void (null as unknown as SeatZone);
}

export function monthlyDelegation(w: World, c: Club) {
  if (!isUser(w, c.id)) {
    optimisePrices(w, c);
    return;
  }
  const mode = w.user.delegation.tickets.mode;
  if (mode === 'policy' || mode === 'notify' || mode === 'full') optimisePrices(w, c, true);
}

export function weeklyTacticsDelegation(w: World, c: Club) {
  if (!isUser(w, c.id)) {
    coachSetsTactics(w, c);
    return;
  }
  const mode = w.user.delegation.tactics.mode;
  if (mode === 'policy' || mode === 'notify' || mode === 'full') coachSetsTactics(w, c, true);
}
