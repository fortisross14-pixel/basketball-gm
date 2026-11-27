// Head-coach recruitment requests: the coach names the profile his systems need, you go and find it.
// Signing a player who fits raises his trust in you (a little more buy-in on game day); ignoring him
// until the request lapses costs some.
import type { CoachRequest, DefScheme, OffSystem, Player, Position, RatingKey, World } from './types';
import { absDay } from './types';
import { addNews, age, club as getClub, playerName, roster, staffOf, userClub } from './world';
import { payrollRoom } from './finance';
import { salaryAsk } from './player';
import { clamp } from './rng';
import { DEF_LABEL, OFF_LABEL } from './staff';

const OFF_KEYS: Record<OffSystem, Record<Position, RatingKey[]>> = {
  paceSpace: { PG: ['hnd', 'thr', 'spd'], SG: ['thr', 'spd', 'mid'], SF: ['thr', 'spd', 'pdef'], PF: ['thr', 'reb', 'spd'], C: ['reb', 'spd', 'jmp'] },
  motion: { PG: ['pas', 'iq', 'hnd'], SG: ['mid', 'thr', 'iq'], SF: ['pas', 'mid', 'iq'], PF: ['pas', 'mid', 'iq'], C: ['pas', 'iq', 'ins'] },
  pnr: { PG: ['hnd', 'pas', 'mid'], SG: ['hnd', 'thr', 'mid'], SF: ['thr', 'mid', 'spd'], PF: ['thr', 'ins', 'jmp'], C: ['ins', 'jmp', 'str'] },
  post: { PG: ['pas', 'thr', 'iq'], SG: ['thr', 'mid', 'pas'], SF: ['ins', 'str', 'mid'], PF: ['ins', 'str', 'reb'], C: ['ins', 'str', 'reb'] },
  isolation: { PG: ['hnd', 'mid', 'spd'], SG: ['hnd', 'mid', 'ins'], SF: ['mid', 'hnd', 'ins'], PF: ['mid', 'ins', 'str'], C: ['ins', 'str', 'reb'] },
};
const DEF_KEY: Record<DefScheme, Record<Position, RatingKey>> = {
  switch: { PG: 'pdef', SG: 'pdef', SF: 'pdef', PF: 'spd', C: 'spd' },
  drop: { PG: 'pdef', SG: 'pdef', SF: 'pdef', PF: 'idef', C: 'blk' },
  packPaint: { PG: 'stl', SG: 'pdef', SF: 'reb', PF: 'idef', C: 'idef' },
  pressure: { PG: 'stl', SG: 'stl', SF: 'end', PF: 'end', C: 'spd' },
  zone: { PG: 'iq', SG: 'stl', SF: 'iq', PF: 'idef', C: 'blk' },
};
const KEY_WORD: Record<RatingKey, string> = {
  ins: 'finishing inside', mid: 'mid-range scoring', thr: 'three-point shooting', ft: 'free throws', pas: 'passing', hnd: 'ball handling', reb: 'rebounding',
  pdef: 'perimeter defence', idef: 'interior defence', stl: 'steals', blk: 'rim protection', spd: 'speed', str: 'strength', jmp: 'athleticism', end: 'stamina', iq: 'basketball IQ',
};
const POS_WORD: Record<Position, string> = { PG: 'point guard', SG: 'shooting guard', SF: 'small forward', PF: 'power forward', C: 'centre' };

function keysFor(off: OffSystem, def: DefScheme, pos: Position): RatingKey[] {
  const k = [...OFF_KEYS[off][pos]];
  const d = DEF_KEY[def][pos];
  if (!k.includes(d)) k[2] = d;
  return k;
}

/** How well a player fits a request, 0-100 (average of the key skills). */
export const KEY_LABEL = KEY_WORD;

export function fitScore(p: Player, keys: RatingKey[]): number {
  return Math.round(keys.reduce((a, k) => a + (p.ratings[k] ?? 0), 0) / keys.length);
}

export function rapport(w: World): number {
  return w.user.coachRapport ?? 60;
}

/** Ask the head coach what he needs. Once every two weeks; at most two open requests. */
export function askCoach(w: World): { ok: boolean; message: string } {
  const c = userClub(w);
  if (!c) return { ok: false, message: 'You need a club.' };
  const coach = staffOf(w, c, 'headCoach');
  if (!coach) return { ok: false, message: 'You have no head coach to ask.' };
  const now = absDay(w);
  const open = (w.user.coachRequests ?? []).filter((r) => r.status === 'open');
  if (open.length >= 2) return { ok: false, message: `${coach.lastName}: "Get me what I already asked for first."` };
  if ((w.user.lastCoachAsk ?? -99) > now - 14) return { ok: false, message: `${coach.lastName}: "We spoke about this last week. Give me a few more days to watch the group."` };
  const off = coach.offPref ?? c.tactics.off;
  const def = coach.defPref ?? c.tactics.def;
  const squad = roster(w, c.id);
  // the position where his best player fits his systems least
  const gaps = (['PG', 'SG', 'SF', 'PF', 'C'] as Position[])
    .filter((pos) => !open.some((r) => r.pos === pos))
    .map((pos) => {
      const keys = keysFor(off, def, pos);
      const best = squad.filter((p) => p.pos === pos).map((p) => fitScore(p, keys)).sort((a, b) => b - a);
      return { pos, keys, best: best[0] ?? 25, depth: best.length };
    })
    .sort((a, b) => a.best - a.depth * 1.5 - (b.best - b.depth * 1.5));
  const g = gaps[0];
  if (!g) return { ok: false, message: 'Nothing to add right now.' };
  const youngMind = coach.development >= 65;
  const maxAge = youngMind ? 26 : 31;
  const bar = clamp(Math.round(g.best + 5), 45, 85);
  const req: CoachRequest = {
    id: w.nextId++, coachId: coach.id, pos: g.pos, keys: g.keys,
    title: `A ${POS_WORD[g.pos]} with ${KEY_WORD[g.keys[0]]} and ${KEY_WORD[g.keys[1]]}`,
    why: `"For ${OFF_LABEL[off]} with ${DEF_LABEL[def]} I need ${KEY_WORD[g.keys[2]]} at ${g.pos} too. Right now our best fit there scores ${g.best}; bring me ${bar} or more${youngMind ? ', and young enough to develop' : ''}."`,
    maxAge, bar, createdDay: now, expiresDay: now + 70, status: 'open',
  };
  (w.user.coachRequests ??= []).push(req);
  w.user.lastCoachAsk = now;
  addNews(w, `${coach.lastName} asks for a ${POS_WORD[g.pos]}`, req.title + '.', { tags: ['staff'], clubIds: [c.id] });
  return { ok: true, message: `${coach.firstName} ${coach.lastName}: ${req.title.toLowerCase()}.` };
}

/** Best available players for a request (not already at your club). */
export function requestMatches(w: World, r: CoachRequest, n = 8): { p: Player; fit: number }[] {
  const uc = userClub(w);
  if (!uc) return [];
  // realistic targets only: what the club could pay in fee and wages
  const sal = roster(w, uc.id).map((p) => p.contract?.salary ?? 0).sort((a, b) => b - a);
  const wageCap = Math.max(0, payrollRoom(w, uc)) + (sal[2] ?? sal[0] ?? 30000);
  const feeCap = Math.max(uc.finances.budget.transfer * 1.5, 40000);
  return w.players
    .filter((p) => !p.retired && !p.academy && p.pos === r.pos && p.teamId !== uc.id && age(w, p) <= r.maxAge)
    .filter((p) => (p.teamId == null || (p.value <= feeCap && !getClub(w, p.teamId).foreign)) && salaryAsk(w, p, uc) <= wageCap)
    .map((p) => ({ p, fit: fitScore(p, r.keys) }))
    .filter((x) => x.fit >= r.bar - 6)
    .sort((a, b) => b.fit - a.fit || a.p.value - b.p.value)
    .slice(0, n);
}

/** Daily: mark requests satisfied by a signing, or lapse old ones. */
export function dailyCoachRequests(w: World) {
  const c = userClub(w);
  if (!c || !w.user.coachRequests?.length) return;
  const now = absDay(w);
  const coach = staffOf(w, c, 'headCoach');
  for (const r of w.user.coachRequests) {
    if (r.status !== 'open') continue;
    if (!coach || coach.id !== r.coachId) { r.status = 'expired'; continue; }
    const hit = roster(w, c.id).find((p) => p.pos === r.pos && p.joinedDay >= r.createdDay && fitScore(p, r.keys) >= r.bar && age(w, p) <= r.maxAge + 1);
    if (hit) {
      r.status = 'done';
      r.playerId = hit.id;
      w.user.coachRapport = clamp(rapport(w) + 12, 0, 100);
      c.cohesion = clamp(c.cohesion + 2, 0, 100);
      addNews(w, `${coach.lastName} gets his ${POS_WORD[r.pos]}`, `"${playerName(hit)} is exactly what I asked for." The coach's trust in you grows.`, { tags: ['staff'], clubIds: [c.id], importance: 2 });
    } else if (now > r.expiresDay) {
      r.status = 'expired';
      w.user.coachRapport = clamp(rapport(w) - 6, 0, 100);
      addNews(w, `${coach.lastName} still waiting`, `The ${POS_WORD[r.pos]} he asked for never arrived. He is less convinced you back him.`, { tags: ['staff'], clubIds: [c.id] });
    }
  }
  if (w.user.coachRequests.length > 12) w.user.coachRequests = w.user.coachRequests.filter((r) => r.status === 'open' || r.createdDay > now - 200);
}

/** Buy-in bonus from rapport: −0.04 … +0.04. */
export function rapportBuyIn(w: World, clubId: number): number {
  return userClub(w)?.id === clubId ? (rapport(w) - 60) / 1000 : 0;
}
