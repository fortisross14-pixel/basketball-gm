// Quick-result basketball simulation.
// Games are resolved instantly. Internally they run possession by possession
// (fast: ~1ms per game) so box scores stay credible and the player's real
// levers — roster, coach and tactics — move outcomes in explainable ways.

import type { DefScheme, OffSystem, Position, Ratings, StatLine, Tactics, RotationStyle } from '../types';
import { Rng, clamp } from '../rng';

export interface SimPlayerIn {
  id: number;
  name: string;
  pos: Position;
  ratings: Ratings;
  ovr: number;
  heightCm: number;
  freshness: number; // 0-100
  morale: number; // 0-100
  form: number; // -10..10
  clutch: number;
  injuryProne: number;
  age: number;
}

export interface SimTeamIn {
  clubId: number;
  players: SimPlayerIn[]; // available (healthy) players, ≤ 12
  tactics: Tactics;
  coach: { rating: number; offPref: OffSystem | null; defPref: DefScheme | null; motivation: number };
  assistOff: number;
  assistDef: number;
  analytics: number;
  medical: number;
  physio: number;
  cohesion: number;
}

export interface SimInjury {
  playerId: number;
  side: 0 | 1;
}

export interface SimBox extends StatLine {
  playerId: number;
  starter: boolean;
  energy: number;
  secs: number;
}

export interface SimTeamOut {
  score: number;
  quarters: number[];
  players: SimBox[];
  fastBreak: number;
  secondChance: number;
  paint: number;
  bench: number;
  offTov: number;
  biggestLead: number;
  timeouts: number;
  fouls: number;
  // shot profile for explanations
  rimA: number; rimM: number; midA: number; midM: number; thrA: number; thrM: number;
  ftA: number; ftM: number; tov: number; orb: number; drb: number; stl: number;
  clutchPts: number; // last 4 minutes of Q4/OT within 8 pts
}

export interface SimResult {
  teams: [SimTeamOut, SimTeamOut]; // 0 = home, 1 = away
  ot: number;
  injuries: SimInjury[];
  leadChanges: number;
  preGameEdge: number; // expected home margin
}

// ---------------------------------------------------------------------------
interface SP {
  inp: SimPlayerIn;
  energy: number;
  fouls: number;
  box: SimBox;
  out: boolean; // fouled out / injured
  maxSecs: number;
  rank: number; // depth rank 0..n
}

export interface ST {
  inp: SimTeamIn;
  players: SP[];
  court: SP[];
  out: SimTeamOut;
  teamFoulsQ: number;
  timeoutsLeft: number;
  run: number;
  execOff: number; // execution modifiers
  execDef: number;
}

const POS_ORDER: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
const QLEN = 600;
const OTLEN = 300;

function emptyBox(id: number, starter: boolean): SimBox {
  return { playerId: id, starter, energy: 1, secs: 0, gp: 1, gs: starter ? 1 : 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 };
}

function emptyTeamOut(): SimTeamOut {
  return { score: 0, quarters: [], players: [], fastBreak: 0, secondChance: 0, paint: 0, bench: 0, offTov: 0, biggestLead: 0, timeouts: 0, fouls: 0, rimA: 0, rimM: 0, midA: 0, midM: 0, thrA: 0, thrM: 0, ftA: 0, ftM: 0, tov: 0, orb: 0, drb: 0, stl: 0, clutchPts: 0 };
}

/** Pre-game team strength (0-100 scale) from top-10 players weighted by expected minutes. */
export function teamStrength(players: { ovr: number }[]): number {
  const w = [0.14, 0.13, 0.13, 0.12, 0.12, 0.09, 0.08, 0.07, 0.06, 0.06];
  const sorted = [...players].sort((a, b) => b.ovr - a.ovr);
  let s = 0;
  let t = 0;
  for (let i = 0; i < w.length; i++) {
    if (!sorted[i]) break;
    s += sorted[i].ovr * w[i];
    t += w[i];
  }
  return t ? s / t : 30;
}

const ROT_SIZE: Record<RotationStyle, number> = { tight: 8, balanced: 9, deep: 11, development: 10, veteran: 9 };

function orderPlayers(t: SimTeamIn): SimPlayerIn[] {
  const ps = [...t.players];
  const rot = t.tactics.rotation;
  const val = (p: SimPlayerIn) => {
    let v = p.ovr + (p.freshness - 100) * 0.05;
    if (rot === 'development' && p.age <= 22) v += 4;
    if (rot === 'veteran' && p.age >= 28) v += 3;
    return v;
  };
  ps.sort((a, b) => val(b) - val(a));
  // honour explicit starters / bench order when set and available
  const avail = new Set(ps.map((p) => p.id));
  const starters = t.tactics.starters.filter((id) => avail.has(id)).slice(0, 5);
  if (starters.length === 5) {
    const rest = ps.filter((p) => !starters.includes(p.id));
    const benchOrder = t.tactics.rotationOrder.filter((id) => avail.has(id) && !starters.includes(id));
    const benchRest = rest.filter((p) => !benchOrder.includes(p.id));
    const byId = new Map(ps.map((p) => [p.id, p]));
    return [...starters.map((id) => byId.get(id)!), ...benchOrder.map((id) => byId.get(id)!), ...benchRest];
  }
  // auto: choose best 5 keeping some positional balance
  const chosen: SimPlayerIn[] = [];
  const needs: Position[][] = [['PG', 'SG'], ['SG', 'SF', 'PG'], ['SF', 'PF', 'SG'], ['PF', 'C', 'SF'], ['C', 'PF']];
  for (const need of needs) {
    const cand = ps.find((p) => !chosen.includes(p) && need.includes(p.pos) && val(p) >= (ps.find((q) => !chosen.includes(q))?.ovr ?? 0) - 6);
    chosen.push(cand ?? ps.find((p) => !chosen.includes(p))!);
  }
  return [...chosen.filter(Boolean), ...ps.filter((p) => !chosen.includes(p))];
}

function eff(r: number, energy: number) {
  return r * (0.74 + 0.26 * energy);
}

function comp(p: SP) {
  const r = p.inp.ratings;
  const e = p.energy;
  const h = (p.inp.heightCm - 200) * 0.35;
  return {
    rim: eff(r.ins * 0.55 + r.str * 0.15 + r.jmp * 0.15 + r.spd * 0.05 + r.iq * 0.1, e),
    mid: eff(r.mid * 0.8 + r.iq * 0.2, e),
    thr: eff(r.thr * 0.85 + r.iq * 0.15, e),
    create: eff(r.hnd * 0.45 + r.pas * 0.2 + r.spd * 0.2 + r.iq * 0.15, e),
    pass: eff(r.pas * 0.7 + r.iq * 0.3, e),
    sec: eff(r.hnd * 0.6 + r.iq * 0.4, e),
    perD: eff(r.pdef * 0.6 + r.spd * 0.2 + r.iq * 0.2, e),
    intD: eff(r.idef * 0.55 + r.blk * 0.15 + r.str * 0.15 + r.jmp * 0.15, e),
    reb: eff(r.reb * 0.6 + r.str * 0.2 + r.jmp * 0.2 + h, e),
    stl: eff(r.stl, e),
    blk: eff(r.blk * 0.7 + r.jmp * 0.15 + h * 0.5, e),
    ft: r.ft,
  };
}

// ---------------------------------------------------------------------------
// Live game: simulated one period at a time, recording a minute-by-minute
// timeline (score, play-by-play, live leaders). Tactics can change between periods.
// ---------------------------------------------------------------------------
export type PlayKind = 'three' | 'jumper' | 'layup' | 'ft' | 'and1' | 'timeout' | 'injury' | 'run' | 'period' | 'steal' | 'block';

export interface PlayEvent {
  t: number; // seconds elapsed in the game
  side: 0 | 1 | -1;
  kind: PlayKind;
  pts: number;
  playerId?: number;
  assistId?: number;
  score: [number, number];
}

export interface MinuteTick {
  m: number; // minutes elapsed (1-based: tick m covers minute m)
  period: number; // 0-based
  h: number;
  a: number;
  /** per side, per player (same order as LiveGame.roster(side)): [pts, reb, ast] */
  lines: [number, number, number][][];
}

export class LiveGame {
  readonly teams: ST[];
  readonly preGameEdge: number;
  readonly injuries: SimInjury[] = [];
  readonly events: PlayEvent[] = [];
  readonly timeline: MinuteTick[] = [];
  leadChanges = 0;
  q = 0;
  ot = 0;
  private lastLeader = 0;
  private poss: 0 | 1;
  private transition = false;
  private lastTovBy: 0 | 1 | -1 = -1;
  private elapsed = 0;
  private readonly homeAdv: number;

  constructor(home: SimTeamIn, away: SimTeamIn, private r: Rng, homeCourt = true) {
    this.teams = [home, away].map((t) => initTeam(t));
    this.preGameEdge = (teamStrength(home.players) - teamStrength(away.players)) * 1.1 + (homeCourt ? 3 : 0);
    this.poss = r.chance(0.5) ? 0 : 1;
    this.homeAdv = homeCourt ? 0.012 : 0;
  }

  get periods() { return 4 + this.ot; }
  get finished() { return this.q >= this.periods; }
  score(): [number, number] { return [this.teams[0].out.score, this.teams[1].out.score]; }
  periodLength(q = this.q) { return q < 4 ? QLEN : OTLEN; }
  /** Player ids in timeline line order for one side. */
  roster(side: 0 | 1): number[] { return this.teams[side].players.map((p) => p.inp.id); }
  onCourt(side: 0 | 1): number[] { return this.teams[side].court.map((p) => p.inp.id); }
  energy(side: 0 | 1): Map<number, number> { return new Map(this.teams[side].players.map((p) => [p.inp.id, p.energy])); }
  fouls(side: 0 | 1): Map<number, number> { return new Map(this.teams[side].players.map((p) => [p.inp.id, p.fouls])); }

  /** Change a side's tactics between periods (systems, pace, emphasis sliders). */
  setTactics(side: 0 | 1, tactics: Tactics) {
    const t = this.teams[side];
    t.inp = { ...t.inp, tactics };
    const ex = execution(t.inp);
    t.execOff = ex.off;
    t.execDef = ex.def;
  }

  private diff() { return this.teams[0].out.score - this.teams[1].out.score; }

  private credit(side: 0 | 1, pts: number) {
    const t = this.teams[side];
    t.out.score += pts;
    t.out.quarters[this.q] = (t.out.quarters[this.q] ?? 0) + pts;
    for (const p of t.court) p.box.pm += pts;
    for (const p of this.teams[1 - side].court) p.box.pm -= pts;
    const lead = side === 0 ? this.diff() : -this.diff();
    if (lead > t.out.biggestLead) t.out.biggestLead = lead;
    const leader = Math.sign(this.diff());
    if (leader !== 0 && this.lastLeader !== 0 && leader !== this.lastLeader) this.leadChanges++;
    if (leader !== 0) this.lastLeader = leader;
    if (t.run >= 0) t.run += pts;
    else t.run = pts;
    this.teams[1 - side].run = 0;
  }

  private pushTicks(periodStart: number) {
    while (this.elapsed >= (this.timeline.length + 1) * 60 - 0.0001 && this.timeline.length < Math.floor(periodStart / 60 + this.periodLength() / 60)) {
      this.timeline.push({
        m: this.timeline.length + 1,
        period: this.q,
        h: this.teams[0].out.score,
        a: this.teams[1].out.score,
        lines: this.teams.map((t) => t.players.map((p) => [p.box.pts, p.box.orb + p.box.drb, p.box.ast] as [number, number, number])),
      });
    }
  }

  /** Simulate the next period. Returns the events it produced. */
  playPeriod(): PlayEvent[] {
    if (this.finished) return [];
    const r = this.r;
    const teams = this.teams;
    const q = this.q;
    const fromEvent = this.events.length;
    const len = this.periodLength();
    const periodStart = this.elapsed;
    let clock = len;
    for (const t of teams) {
      t.teamFoulsQ = 0;
      t.out.quarters[q] = t.out.quarters[q] ?? 0;
      if (q === 2) t.timeoutsLeft = 3;
      const rec = q === 2 ? 0.14 : q === 0 ? 0 : 0.05;
      for (const p of t.players) p.energy = Math.min(1, p.energy + rec);
    }
    if (q > 0) this.poss = q % 2 === 1 ? ((1 - this.poss) as 0 | 1) : this.poss;
    while (clock > 0) {
      const poss = this.poss;
      const off = teams[poss];
      const def = teams[1 - poss];
      const clutch = q >= 3 && clock <= 240 && Math.abs(this.diff()) <= 8;
      const result = possession(r, off, def, poss, this.transition, clock, this.homeAdv * (poss === 0 ? 1 : -1), clutch, q);
      clock -= result.secs;
      this.elapsed += result.secs;
      for (const t of teams) {
        const pace = t.inp.tactics.pace === 'fast' ? 1.15 : t.inp.tactics.pace === 'slow' ? 0.9 : 1;
        const press = t.inp.tactics.def === 'pressure' ? 1.18 : 1;
        const physio = 1 - (t.inp.physio - 50) / 600;
        for (const p of t.players) {
          if (t.court.includes(p)) {
            p.box.secs += result.secs;
            const drain = 0.00056 * (1.3 - p.inp.ratings.end / 160) * pace * press * physio;
            p.energy = Math.max(0.3, p.energy - drain * result.secs);
          } else {
            p.energy = Math.min(1, p.energy + 0.0011 * result.secs);
          }
        }
      }
      if (result.pts > 0) {
        const runBefore = off.run;
        this.credit(poss, result.pts);
        if (clutch) off.out.clutchPts += result.pts;
        if (result.fastBreak) off.out.fastBreak += result.pts;
        if (result.second) off.out.secondChance += result.pts;
        if (this.lastTovBy === 1 - poss && result.afterTov) off.out.offTov += result.pts;
        this.events.push({ t: Math.round(this.elapsed), side: poss, kind: result.ev?.kind ?? 'jumper', pts: result.pts, playerId: result.ev?.pid, assistId: result.ev?.ast, score: this.score() });
        if (runBefore < 8 && off.run >= 8) this.events.push({ t: Math.round(this.elapsed), side: poss, kind: 'run', pts: off.run, score: this.score() });
      } else if (result.ev && (result.ev.kind === 'steal' || result.ev.kind === 'block')) {
        this.events.push({ t: Math.round(this.elapsed), side: (1 - poss) as 0 | 1, kind: result.ev.kind, pts: 0, playerId: result.ev.pid, score: this.score() });
      }
      for (const side of [0, 1] as const) {
        const t = teams[side];
        for (const p of t.court) {
          const risk = (0.000055 * result.secs) / 15 * (0.5 + p.inp.injuryProne / 60) * (1.6 - p.energy) * (1 - (t.inp.medical - 50) / 250);
          if (r.chance(risk)) {
            p.out = true;
            this.injuries.push({ playerId: p.inp.id, side });
            this.events.push({ t: Math.round(this.elapsed), side, kind: 'injury', pts: 0, playerId: p.inp.id, score: this.score() });
          }
        }
      }
      this.lastTovBy = result.tov ? poss : -1;
      this.transition = result.transitionNext;
      if (!result.keep) this.poss = (1 - poss) as 0 | 1;
      for (const [i, t] of teams.entries()) {
        const opp = teams[1 - i];
        if (opp.run >= 9 && t.timeoutsLeft > 0) {
          t.timeoutsLeft--;
          t.out.timeouts++;
          opp.run = 0;
          for (const p of t.players) p.energy = Math.min(1, p.energy + 0.03);
          this.events.push({ t: Math.round(this.elapsed), side: i as 0 | 1, kind: 'timeout', pts: 0, score: this.score() });
        }
      }
      for (const t of teams) substitutions(t, q, clock);
      this.pushTicks(periodStart);
    }
    this.elapsed = periodStart + len;
    this.pushTicks(periodStart);
    this.events.push({ t: Math.round(this.elapsed), side: -1, kind: 'period', pts: q, score: this.score() });
    this.q++;
    if (this.q >= 4 && this.q === this.periods && this.diff() === 0) this.ot++;
    return this.events.slice(fromEvent);
  }

  playAll(): this {
    while (!this.finished) this.playPeriod();
    return this;
  }

  result(): SimResult {
    for (const t of this.teams) {
      t.out.bench = 0;
      t.out.fouls = 0;
      for (const p of t.players) {
        p.box.min = Math.round((p.box.secs / 60) * 10) / 10;
        p.box.energy = p.energy;
        p.box.gp = p.box.secs === 0 ? 0 : 1;
        if (!p.box.starter) t.out.bench += p.box.pts;
        t.out.fouls += p.box.pf;
      }
      t.out.players = t.players.map((p) => p.box);
    }
    return { teams: [this.teams[0].out, this.teams[1].out], ot: this.ot, injuries: this.injuries, leadChanges: this.leadChanges, preGameEdge: this.preGameEdge };
  }
}

/** Run a complete game instantly. `homeCourt` false for neutral venues. */
export function simulateGame(home: SimTeamIn, away: SimTeamIn, r: Rng, homeCourt = true): SimResult {
  return new LiveGame(home, away, r, homeCourt).playAll().result();
}

function execution(t: SimTeamIn) {
  const tac = t.tactics;
  const coachFitOff = t.coach.offPref === tac.off ? 1 : 0;
  const coachFitDef = t.coach.defPref === tac.def ? 1 : 0;
  return {
    off: (t.coach.rating - 50) / 1200 + coachFitOff * 0.006 - (1 - coachFitOff) * 0.002 + (t.assistOff - 50) / 2500 + (t.cohesion - 50) / 2600 + (t.analytics - 50) / 5000,
    def: (t.coach.rating - 50) / 1500 + coachFitDef * 0.006 - (1 - coachFitDef) * 0.002 + (t.assistDef - 50) / 2500 + (t.cohesion - 50) / 3200,
  };
}

function initTeam(t: SimTeamIn): ST {
  const ordered = orderPlayers(t);
  const rot = ROT_SIZE[t.tactics.rotation];
  const players: SP[] = ordered.map((p, i) => ({
    inp: p,
    energy: 0.84 + 0.16 * (p.freshness / 100),
    fouls: 0,
    box: emptyBox(p.id, i < 5),
    out: false,
    maxSecs: (t.tactics.minuteLimits[p.id] ?? (i < rot ? 40 : i < rot + 2 ? 6 : 0)) * 60,
    rank: i,
  }));
  const ex = execution(t);
  return {
    inp: t,
    players,
    court: players.slice(0, 5),
    out: emptyTeamOut(),
    teamFoulsQ: 0,
    timeoutsLeft: 2,
    run: 0,
    execOff: ex.off,
    execDef: ex.def,
  };
}

function value(p: SP) {
  return p.inp.ovr * (0.6 + 0.4 * p.energy) - p.rank * 0.8;
}

function substitutions(t: ST, q: number, clock: number) {
  const foulLimit = q === 0 ? 2 : q === 1 ? 3 : q === 2 ? 4 : 5;
  const careful = t.inp.tactics.foulDiscipline < 0;
  const late = q >= 3 && clock < 180;
  for (let i = 0; i < t.court.length; i++) {
    const p = t.court[i];
    const foulTrouble = p.fouls >= 5 || (!late && p.fouls >= foulLimit + (careful ? 0 : 1) && q < 3);
    const tired = p.energy < 0.8 && !late;
    const capped = p.box.secs >= p.maxSecs;
    if (!(p.out || foulTrouble || tired || capped)) continue;
    const bench = t.players.filter((b) => !t.court.includes(b) && !b.out && b.fouls < 5 && b.box.secs < b.maxSecs && b.energy > 0.88);
    if (!bench.length) continue;
    // prefer similar position
    bench.sort((a, b) => value(b) - Math.abs(POS_ORDER[b.inp.pos] - POS_ORDER[p.inp.pos]) * 2.5 - (value(a) - Math.abs(POS_ORDER[a.inp.pos] - POS_ORDER[p.inp.pos]) * 2.5));
    const inP = bench[0];
    if (p.out || p.fouls >= 5 || capped || value(inP) > value(p) - 2 || foulTrouble) t.court[i] = inP;
  }
  // bring rested starters back
  for (let i = 0; i < t.court.length; i++) {
    const p = t.court[i];
    const better = t.players.find((b) => !t.court.includes(b) && !b.out && b.fouls < Math.min(5, (late ? 5 : q + 2)) && b.energy > 0.92 && b.box.secs < b.maxSecs && value(b) > value(p) + 5);
    if (better) t.court[i] = better;
  }
  t.court.sort((a, b) => POS_ORDER[a.inp.pos] - POS_ORDER[b.inp.pos]);
}

interface PossResult {
  secs: number;
  pts: number;
  keep: boolean; // offense keeps ball (offensive foul reset etc.)
  transitionNext: boolean;
  tov: boolean;
  fastBreak: boolean;
  second: boolean;
  afterTov: boolean;
  ev?: { pid: number; ast?: number; kind: PlayKind };
}

function possession(r: Rng, off: ST, def: ST, side: 0 | 1, transition: boolean, clock: number, homeAdv: number, clutch: boolean, q: number, second = false): PossResult {
  const to = off.inp.tactics;
  const td = def.inp.tactics;
  const paceSecs = (to.pace === 'fast' ? 14 : to.pace === 'slow' ? 19 : 16.5) * 0.75 + (td.pace === 'fast' ? 14 : td.pace === 'slow' ? 19 : 16.5) * 0.25 - (td.def === 'pressure' ? 1 : 0);
  let secs = transition ? r.float(4, 8) : second ? r.float(3, 9) : clamp(r.normal(paceSecs, 4), 5, 24);
  if (secs > clock) secs = clock;
  const res: PossResult = { secs, pts: 0, keep: false, transitionNext: false, tov: false, fastBreak: transition, second, afterTov: transition };
  const oc = off.court.map(comp);
  const dc = def.court.map(comp);

  // --- turnover
  const secAvg = oc.reduce((a, c) => a + c.sec, 0) / 5;
  const stlAvg = dc.reduce((a, c) => a + c.stl, 0) / 5;
  let pTov = 0.125 + (50 - secAvg) / 420 + (stlAvg - 50) / 900 - off.execOff * 0.8;
  if (td.def === 'pressure') pTov += 0.035;
  if (td.def === 'zone') pTov -= 0.01;
  if (to.off === 'motion') pTov += 0.008;
  if (to.off === 'isolation') pTov -= 0.012;
  if (to.pace === 'fast') pTov += 0.01;
  if (transition) pTov += 0.02;
  if (r.chance(clamp(pTov, 0.05, 0.25))) {
    const handlerIdx = r.weighted([0, 1, 2, 3, 4], off.court.map((p, i) => 1.5 + (5 - POS_ORDER[p.inp.pos]) * 0.4 + oc[i].create / 60));
    off.court[handlerIdx].box.tov++;
    off.out.tov++;
    res.tov = true;
    if (r.chance(0.55 + (stlAvg - 50) / 300)) {
      const sIdx = r.weighted([0, 1, 2, 3, 4], dc.map((c) => c.stl * c.stl));
      def.court[sIdx].box.stl++;
      def.out.stl++;
      res.ev = { pid: def.court[sIdx].inp.id, kind: 'steal' };
      res.transitionNext = r.chance(0.65);
    }
    return res;
  }

  // --- non-shooting foul
  const discipline = td.foulDiscipline;
  if (r.chance(0.085 + discipline * 0.014 + (td.def === 'pressure' ? 0.02 : 0))) {
    const fIdx = r.int(0, 4);
    commitFoul(def, fIdx);
    if (def.teamFoulsQ > 4) {
      const shooter = r.weighted([0, 1, 2, 3, 4], oc.map((c) => c.create + c.rim));
      res.pts += shootFts(r, off, shooter, oc[shooter].ft, 2);
      res.ev = { pid: off.court[shooter].inp.id, kind: 'ft' };
      return res;
    }
    // side-out: continue with shorter possession
    const more = possession(r, off, def, side, false, Math.max(1, clock - secs * 0.4), homeAdv, clutch, q, second);
    more.secs += secs * 0.4;
    return more;
  }

  // --- shooter
  const usageExp = to.off === 'motion' ? 2.0 : to.off === 'isolation' ? 3.6 : 3.0;
  const topIdx = oc.reduce((bi, c, i) => (Math.max(c.rim, c.mid, c.thr) + c.create > Math.max(oc[bi].rim, oc[bi].mid, oc[bi].thr) + oc[bi].create ? i : bi), 0);
  const usage = oc.map((c, i) => {
    const p = off.court[i];
    let u = Math.pow((Math.max(c.rim, c.mid, c.thr) * 0.6 + c.create * 0.4) / 50, usageExp);
    if (i === topIdx) u *= 1 + to.starUsage * 0.12 + (to.off === 'isolation' ? 0.3 : 0);
    if (to.off === 'post' && (p.inp.pos === 'PF' || p.inp.pos === 'C')) u *= 1.3;
    if (to.off === 'pnr' && (p.inp.pos === 'PG' || p.inp.pos === 'C')) u *= 1.18;
    if (to.off === 'paceSpace' && c.thr > 60) u *= 1.15;
    return u;
  });
  const si = r.weighted([0, 1, 2, 3, 4], usage);
  const s = off.court[si];
  const sc = oc[si];
  const di = si; // positional matchup
  const dcm = dc[di];

  // --- shot zone
  let wRim = Math.pow(sc.rim / 50, 2) * 1.0;
  let wMid = Math.pow(sc.mid / 50, 2) * 0.55;
  let wThr = Math.pow(sc.thr / 50, 2.4) * 0.95;
  wThr *= 1 + to.threeEmphasis * 0.18;
  if (to.off === 'paceSpace') { wThr *= 1.25; wMid *= 0.7; }
  if (to.off === 'post') { wRim *= 1.25; wThr *= 0.85; }
  if (to.off === 'pnr') { wMid *= 1.15; wRim *= 1.1; }
  if (to.off === 'isolation') { wMid *= 1.3; }
  if (td.def === 'packPaint') { wRim *= 0.75; wThr *= 1.2; }
  if (td.def === 'drop') { wMid *= 1.25; }
  if (td.def === 'zone') { wThr *= 1.25; wRim *= 0.85; }
  if (td.def === 'switch') { wMid *= 1.1; }
  if (td.def === 'pressure') { wRim *= 1.12; }
  if (transition) { wRim *= 2; wMid *= 0.5; wThr *= 1.2; }
  const zone = r.weighted(['rim', 'mid', 'thr'] as const, [wRim, wMid, wThr]);

  // --- assist
  const passers = off.court.map((_, i) => i).filter((i) => i !== si);
  let pAst = zone === 'thr' ? 0.66 : zone === 'mid' ? 0.3 : 0.42;
  if (to.off === 'motion') pAst += 0.1;
  if (to.off === 'isolation') pAst -= 0.18;
  const passerIdx = r.weighted(passers, passers.map((i) => oc[i].pass * oc[i].pass));
  pAst *= 0.75 + oc[passerIdx].pass / 200;
  const assisted = r.chance(clamp(pAst, 0.1, 0.95));

  // --- make probability
  const rimProtector = Math.max(...dc.map((c) => c.intD));
  let pMake: number;
  if (zone === 'rim') pMake = 0.585 + (sc.rim - 55) * 0.0055 - ((dcm.intD * 0.5 + rimProtector * 0.5) - 55) * 0.0042;
  else if (zone === 'mid') pMake = 0.4 + (sc.mid - 55) * 0.005 - (dcm.perD - 55) * 0.0025;
  else pMake = 0.352 + (sc.thr - 55) * 0.0046 - (dcm.perD - 55) * 0.0019;
  if (assisted) pMake += 0.03;
  if (transition) pMake += zone === 'rim' ? 0.06 : 0.02;
  if (second && zone === 'rim') pMake += 0.03;
  pMake += homeAdv;
  pMake += off.execOff - def.execDef;
  // scheme interactions
  if (td.def === 'drop') { if (zone === 'mid') pMake += 0.03; if (zone === 'rim') pMake -= 0.02; }
  if (td.def === 'packPaint') { if (zone === 'rim') pMake -= 0.045; if (zone === 'thr') pMake += 0.015; }
  if (td.def === 'zone') { if (zone === 'rim') pMake -= 0.03; if (zone === 'thr') pMake += 0.022; if (zone === 'mid') pMake -= 0.01; }
  if (td.def === 'pressure') { if (zone === 'rim') pMake += 0.03; }
  if (td.def === 'switch') {
    const perimD = dc.reduce((a, c) => a + c.perD, 0) / 5;
    pMake += zone === 'rim' ? 0.008 : -(perimD - 50) / 1500;
  }
  if (to.off === 'paceSpace' && zone === 'thr') {
    const shooters = oc.filter((c) => c.thr > 58).length;
    pMake += (shooters - 2.5) * 0.006;
  }
  if (to.off === 'post' && zone === 'rim' && (s.inp.pos === 'PF' || s.inp.pos === 'C')) pMake += 0.015;
  if (to.threeEmphasis > 0 && zone === 'thr' && sc.thr < 55) pMake -= 0.01 * to.threeEmphasis;
  pMake += (s.inp.morale - 60) / 2500 + s.inp.form / 450;
  if (clutch) pMake += (s.inp.clutch - 50) / 1100;
  pMake = clamp(pMake, 0.12, 0.82);

  const pts3 = zone === 'thr';
  s.box.fga++;
  if (pts3) { s.box.tpa++; off.out.thrA++; } else if (zone === 'rim') off.out.rimA++; else off.out.midA++;

  // block
  let blocked = false;
  if (zone !== 'thr') {
    const pBlk = (zone === 'rim' ? 0.075 : 0.03) + (Math.max(dcm.blk, rimProtector * 0.8) - 55) / 800;
    if (r.chance(clamp(pBlk, 0.005, 0.18))) {
      blocked = true;
      const bIdx = r.weighted([0, 1, 2, 3, 4], dc.map((c) => c.blk * c.blk));
      def.court[bIdx].box.blk++;
      res.ev = { pid: def.court[bIdx].inp.id, kind: 'block' };
    }
  }

  // shooting foul
  let pFoul = zone === 'rim' ? 0.2 : zone === 'mid' ? 0.075 : 0.022;
  pFoul *= 1 + discipline * 0.12;
  pFoul *= 0.75 + (s.inp.ratings.ins + s.inp.ratings.str) / 400;
  const fouled = !blocked && r.chance(pFoul);
  const made = !blocked && r.chance(fouled ? pMake * 0.55 : pMake);

  if (fouled) commitFoul(def, di);
  if (made) {
    const pts = pts3 ? 3 : 2;
    s.box.fgm++;
    s.box.pts += pts;
    if (pts3) { s.box.tpm++; off.out.thrM++; } else if (zone === 'rim') { off.out.rimM++; off.out.paint += 2; } else off.out.midM++;
    if (assisted) off.court[passerIdx].box.ast++;
    res.pts += pts;
    res.ev = { pid: s.inp.id, ast: assisted ? off.court[passerIdx].inp.id : undefined, kind: fouled ? 'and1' : pts3 ? 'three' : zone === 'rim' ? 'layup' : 'jumper' };
    if (fouled) res.pts += shootFts(r, off, si, sc.ft, 1);
    return res;
  }
  if (fouled) {
    res.pts += shootFts(r, off, si, sc.ft, pts3 ? 3 : 2);
    res.ev = { pid: s.inp.id, kind: 'ft' };
    return res;
  }
  // rebound
  const oReb = oc.reduce((a, c) => a + c.reb, 0);
  const dReb = dc.reduce((a, c) => a + c.reb, 0);
  let pOrb = 0.265 + (oReb - dReb) / 520 + to.reboundEmphasis * 0.018 - td.reboundEmphasis * 0.012;
  if (td.def === 'zone') pOrb += 0.035;
  if (zone === 'thr') pOrb += 0.02;
  if (r.chance(clamp(pOrb, 0.12, 0.45))) {
    const rIdx = r.weighted([0, 1, 2, 3, 4], oc.map((c) => c.reb * c.reb));
    off.court[rIdx].box.orb++;
    off.out.orb++;
    const rem = clock - secs;
    if (rem > 1) {
      const put = possession(r, off, def, side, false, rem, homeAdv, clutch, q, true);
      put.secs += secs;
      put.fastBreak = false;
      put.second = true;
      return put;
    }
    return res;
  }
  const rIdx = r.weighted([0, 1, 2, 3, 4], dc.map((c) => c.reb * c.reb));
  def.court[rIdx].box.drb++;
  def.out.drb++;
  // running teams push off defensive rebounds
  const runChance = (td.pace === 'fast' ? 0.2 : td.pace === 'slow' ? 0.06 : 0.12) + (td.def === 'pressure' ? 0.05 : 0) - (to.reboundEmphasis < 0 ? 0.04 : 0) + (to.reboundEmphasis > 0 ? 0.03 : 0);
  res.transitionNext = r.chance(runChance);
  return res;
}

function commitFoul(t: ST, idx: number) {
  const p = t.court[idx];
  p.fouls++;
  p.box.pf++;
  t.teamFoulsQ++;
}

function shootFts(r: Rng, t: ST, idx: number, ft: number, n: number): number {
  const p = t.court[idx];
  let pts = 0;
  const pFt = clamp(0.45 + ft * 0.0045, 0.4, 0.93);
  for (let i = 0; i < n; i++) {
    p.box.fta++;
    t.out.ftA++;
    if (r.chance(pFt)) {
      p.box.ftm++;
      t.out.ftM++;
      p.box.pts++;
      pts++;
    }
  }
  return pts;
}
