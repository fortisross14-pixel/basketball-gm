// Game plan politics: the head coach, the squad, the supporters and the owner
// each have a preferred style. You propose the plan (offence, defence, tempo):
//  - against the coach or the personnel → worse execution in games;
//  - against fans / owner → losses hurt more, wins earn less goodwill;
//  - a style they love + a win → their approval grows faster.
import { rapportBuyIn } from './coachRequests';
import type { Club, DefScheme, OffSystem, Pace, Player, World } from './types';
import { roster, staffOf, isUser } from './world';
import { offFit, defFit } from './delegation';
import { OFF_LABEL, DEF_LABEL } from './staff';
import { fanReaction, boardNote } from './career';
import { clamp } from './rng';

export const OFFS: OffSystem[] = ['paceSpace', 'motion', 'pnr', 'post', 'isolation'];
export const DEFS: DefScheme[] = ['switch', 'drop', 'packPaint', 'pressure', 'zone'];
export const PACES: Pace[] = ['slow', 'normal', 'fast'];
export const PACE_LABEL: Record<Pace, string> = { slow: 'Slow tempo', normal: 'Normal tempo', fast: 'Fast tempo' };

export interface GamePlan { off: OffSystem; def: DefScheme; pace: Pace }
export type Stake = 'coach' | 'players' | 'fans' | 'owner';
export const STAKES: Stake[] = ['coach', 'players', 'fans', 'owner'];

export type IdentityId = 'showtime' | 'grit' | 'teamBall' | 'pressure' | 'tradition';
export interface Identity { label: string; desc: string; off: OffSystem[]; def: DefScheme[]; pace: Pace }
export const IDENTITIES: Record<IdentityId, Identity> = {
  showtime: { label: 'Showtime', desc: 'Fast, high-scoring basketball with plenty of threes.', off: ['paceSpace', 'isolation'], def: ['pressure', 'switch'], pace: 'fast' },
  grit: { label: 'Blue-collar grit', desc: 'Defence, effort and a physical inside game.', off: ['post', 'pnr'], def: ['packPaint', 'drop'], pace: 'slow' },
  teamBall: { label: 'Team basketball', desc: 'Ball movement, unselfish play, smart switching.', off: ['motion', 'pnr'], def: ['switch', 'zone'], pace: 'normal' },
  pressure: { label: 'Relentless pressure', desc: 'Full-court defence and points in transition.', off: ['paceSpace', 'motion'], def: ['pressure', 'switch'], pace: 'fast' },
  tradition: { label: 'Old school', desc: 'Through the post, protected by a disciplined zone.', off: ['post', 'motion'], def: ['zone', 'drop'], pace: 'normal' },
};
const IDS = Object.keys(IDENTITIES) as IdentityId[];

function hash(n: number) {
  const x = Math.sin(n * 91.345 + 7.13) * 43758.5453;
  return x - Math.floor(x);
}

export function fanIdentity(c: Club): IdentityId {
  return IDS[Math.floor(hash(c.id * 3 + 1) * IDS.length)];
}

export function ownerIdentity(c: Club): IdentityId {
  // ambitious owners want a show that sells tickets; patient ones prefer a solid, defensive identity
  const r = hash(c.id * 5 + 2);
  if (c.board.ambition >= 70 && r < 0.55) return 'showtime';
  if (c.board.patience >= 70 && r < 0.45) return 'grit';
  return IDS[Math.floor(hash(c.id * 11 + 4) * IDS.length)];
}

interface Affinity { off: Record<OffSystem, number>; def: Record<DefScheme, number>; pace: Record<Pace, number> }

function paceAff(best: Pace): Record<Pace, number> {
  return { slow: best === 'slow' ? 1 : best === 'normal' ? 0.5 : 0, normal: best === 'normal' ? 1 : 0.55, fast: best === 'fast' ? 1 : best === 'normal' ? 0.5 : 0 };
}

function identityAff(id: IdentityId): Affinity {
  const it = IDENTITIES[id];
  const off = Object.fromEntries(OFFS.map((o) => [o, o === it.off[0] ? 1 : o === it.off[1] ? 0.6 : 0.15])) as Record<OffSystem, number>;
  const def = Object.fromEntries(DEFS.map((d) => [d, d === it.def[0] ? 1 : d === it.def[1] ? 0.6 : 0.15])) as Record<DefScheme, number>;
  return { off, def, pace: paceAff(it.pace) };
}

function coachPace(off: OffSystem | null, def: DefScheme | null): Pace {
  if (off === 'paceSpace' || def === 'pressure') return 'fast';
  if (off === 'post' || def === 'packPaint') return 'slow';
  return 'normal';
}

function normalise<K extends string>(scores: Record<K, number>): Record<K, number> {
  const v = Object.values(scores) as number[];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return Object.fromEntries(Object.entries(scores).map(([k, s]) => [k, hi - lo < 1 ? 0.6 : 0.1 + 0.9 * (((s as number) - lo) / (hi - lo))])) as Record<K, number>;
}

function squad(w: World, c: Club): Player[] {
  return roster(w, c.id).filter((p) => !p.injury);
}

export function affinities(w: World, c: Club): Record<Stake, Affinity> {
  const coach = staffOf(w, c, 'headCoach');
  const cOff = Object.fromEntries(OFFS.map((o) => [o, coach?.offPref === o ? 1 : 0.2])) as Record<OffSystem, number>;
  const cDef = Object.fromEntries(DEFS.map((d) => [d, coach?.defPref === d ? 1 : 0.2])) as Record<DefScheme, number>;
  const players = squad(w, c);
  const pOff = normalise(Object.fromEntries(OFFS.map((o) => [o, offFit(players, o)])) as Record<OffSystem, number>);
  const pDef = normalise(Object.fromEntries(DEFS.map((d) => [d, defFit(players, d)])) as Record<DefScheme, number>);
  const top = [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  const legs = top.length ? top.reduce((a, p) => a + (p.ratings.spd + p.ratings.end) / 2, 0) / top.length : 50;
  const playersPace: Pace = legs >= 60 ? 'fast' : legs <= 48 ? 'slow' : 'normal';
  return {
    coach: coach ? { off: cOff, def: cDef, pace: paceAff(coachPace(coach.offPref, coach.defPref)) } : { off: normalise(cOff), def: normalise(cDef), pace: paceAff('normal') },
    players: { off: pOff, def: pDef, pace: paceAff(playersPace) },
    fans: identityAff(fanIdentity(c)),
    owner: identityAff(ownerIdentity(c)),
  };
}

export function planOf(c: Club): GamePlan {
  return { off: c.tactics.off, def: c.tactics.def, pace: c.tactics.pace };
}

function score(a: Affinity, p: GamePlan): number {
  return a.off[p.off] * 0.45 + a.def[p.def] * 0.35 + a.pace[p.pace] * 0.2;
}

export function planScores(w: World, c: Club, p: GamePlan = planOf(c)): Record<Stake, number> {
  const aff = affinities(w, c);
  return Object.fromEntries(STAKES.map((s) => [s, Math.round(score(aff[s], p) * 100) / 100])) as Record<Stake, number>;
}

/** Execution inputs for the game sim (0..1 buy-in of coach and personnel). */
export function planExecution(w: World, c: Club): { coach: number; players: number } {
  const s = planScores(w, c);
  return { coach: Math.min(1, s.coach + rapportBuyIn(w, c.id)), players: s.players };
}

/** Approximate points per game the plan's buy-in is worth (shown in the UI; mirrors sim/game.ts execution()). */
export function executionPoints(coach: number, players: number): number {
  return Math.round(((coach - 0.6) * 5.1 + (players - 0.6) * 6.4) * 10) / 10;
}

export interface StakeView {
  who: Stake;
  title: string;
  name: string;
  identity: string;
  desc: string;
  wants: GamePlan;
  score: number;
  mood: 'love' | 'ok' | 'unhappy';
  quote: string;
}

function best<K extends string>(r: Record<K, number>): K {
  return (Object.entries(r) as [K, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

export function stakeholderViews(w: World, c: Club, p: GamePlan = planOf(c)): StakeView[] {
  const aff = affinities(w, c);
  const coach = staffOf(w, c, 'headCoach');
  const s = planScores(w, c, p);
  const mood = (x: number): StakeView['mood'] => (x >= 0.75 ? 'love' : x >= 0.5 ? 'ok' : 'unhappy');
  const want = (a: Affinity): GamePlan => ({ off: best(a.off), def: best(a.def), pace: best(a.pace) });
  const fanId = IDENTITIES[fanIdentity(c)];
  const ownId = IDENTITIES[ownerIdentity(c)];
  const quotes: Record<Stake, Record<StakeView['mood'], string>> = {
    coach: { love: '"This is how I want us to play. We will execute it."', ok: '"I can work with this, but it is not my basketball."', unhappy: '"I don\'t believe in this. Don\'t expect clean execution."' },
    players: { love: 'The roster is built for this plan.', ok: 'Some players fit, others will be out of position.', unhappy: 'The personnel does not suit this plan: expect bad shots and mistakes.' },
    fans: { love: '"That\'s our club!" — wins will win them over fast.', ok: 'They will judge you on results.', unhappy: '"Boring / not our identity." Losses will hurt twice.' },
    owner: { love: 'Exactly the identity he wants to sell.', ok: 'He will accept it if you win.', unhappy: 'Not what he asked for: defeats will be blamed on the style.' },
  };
  return [
    { who: 'coach', title: 'Head coach', name: coach ? `${coach.firstName} ${coach.lastName}` : 'Interim coach', identity: coach ? `${coach.offPref ? OFF_LABEL[coach.offPref] : '—'} · ${coach.defPref ? DEF_LABEL[coach.defPref] : '—'}` : 'No philosophy', desc: 'Runs the systems he believes in better. Execution follows his buy-in.', wants: want(aff.coach), score: s.coach, mood: mood(s.coach), quote: quotes.coach[mood(s.coach)] },
    { who: 'players', title: 'Squad', name: `${squad(w, c).length} healthy players`, identity: 'Best fit for the personnel', desc: 'Skills decide which systems the roster can actually run.', wants: want(aff.players), score: s.players, mood: mood(s.players), quote: quotes.players[mood(s.players)] },
    { who: 'fans', title: 'Supporters', name: `${c.nickname ?? c.name} fans`, identity: fanId.label, desc: fanId.desc, wants: want(aff.fans), score: s.fans, mood: mood(s.fans), quote: quotes.fans[mood(s.fans)] },
    { who: 'owner', title: 'Owner', name: c.board.owner, identity: ownId.label, desc: ownId.desc, wants: want(aff.owner), score: s.owner, mood: mood(s.owner), quote: quotes.owner[mood(s.owner)] },
  ];
}

export type Preset = Stake | 'balanced' | 'results';
export const PRESET_LABEL: Record<Preset, string> = { results: 'Best for results', balanced: 'Keep everyone happy', coach: "Coach's plan", players: 'Fit the squad', fans: 'Crowd-pleaser', owner: "Owner's way" };

export function presetPlan(w: World, c: Club, preset: Preset): GamePlan {
  const aff = affinities(w, c);
  const wts: Record<Stake, number> =
    preset === 'balanced' ? { coach: 0.28, players: 0.28, fans: 0.22, owner: 0.22 }
    : preset === 'results' ? { coach: 0.45, players: 0.55, fans: 0, owner: 0 }
    : { coach: preset === 'coach' ? 1 : 0.05, players: preset === 'players' ? 1 : 0.05, fans: preset === 'fans' ? 1 : 0.02, owner: preset === 'owner' ? 1 : 0.02 };
  let bestP: GamePlan = planOf(c);
  let bestS = -1;
  for (const off of OFFS) for (const def of DEFS) for (const pace of PACES) {
    const p = { off, def, pace };
    const sc = STAKES.reduce((a, s) => a + wts[s] * score(aff[s], p), 0);
    if (sc > bestS + 1e-9) { bestS = sc; bestP = p; }
  }
  return bestP;
}

/** Projected supporter / owner reaction multipliers for the UI. */
export function reactionPreview(x: number): { win: string; loss: string } {
  const win = x >= 0.75 ? 'Approval grows fast' : x >= 0.5 ? 'Normal growth' : 'Grows slowly';
  const loss = x >= 0.75 ? 'Forgiving' : x >= 0.5 ? 'Normal disappointment' : 'Loses patience quickly';
  return { win, loss };
}

/** After every competitive game of the user's club: supporters and owner judge the style. */
export function styleReaction(w: World, c: Club, won: boolean) {
  if (!isUser(w, c.id)) return;
  const s = planScores(w, c);
  const id = IDENTITIES[fanIdentity(c)];
  // fans: aligned wins add goodwill on top of the result; misaligned losses add frustration
  const f = s.fans;
  const fanDelta = won ? 1.4 * (f - 0.45) : -1.5 * (1 - f) + 0.25;
  const ap = w.user.approval;
  if (Math.abs(fanDelta) >= 0.55) fanReaction(w, Math.round(fanDelta * 10) / 10, won ? (fanDelta > 0 ? `Loved the ${id.label.toLowerCase()} style in the win` : 'Won, but "this is not our basketball"') : fanDelta < 0 ? `Lost playing a style they dislike` : 'Lost, but they like the identity');
  else ap.fanBonus += fanDelta;
  // owner: relationship with the board
  const o = s.owner;
  const ownDelta = won ? 2.2 * (o - 0.45) : -2.6 * (1 - o) + 0.4;
  const tr = c.board.trust;
  tr.relationship = clamp(tr.relationship + ownDelta, 0, 100);
  if (Math.abs(ownDelta) >= 1.1) boardNote(w, Math.round(ownDelta * 10) / 10, won ? (ownDelta > 0 ? `${c.board.owner} enjoys the ${IDENTITIES[ownerIdentity(c)].label.toLowerCase()} identity` : `${c.board.owner} wins, but dislikes the style`) : `${c.board.owner} blames the style for the defeat`);
}
