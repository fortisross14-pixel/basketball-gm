// Quick sales, friendlies and player body types.
import type { Club, Fixture, Player, World } from './types';
import { absDay } from './types';
import { addNews, age, book, club as getClub, fmtMoney, hold, invalidateIndex, isUser, nextId, playerName, roster, rng, tierOf } from './world';
import { buildCalendar, fmtDate, transferWindowOpen } from './calendar';
import { moveTo, registrationCheck, projectedRank } from './market';
import { roleFor, salaryAsk } from './player';
import { fanReaction } from './career';

// ---------------------------------------------------------------------------
// Immediate sale: a guaranteed buyer the next day, at a minimal fee
// ---------------------------------------------------------------------------
export const QUICK_SALE_SHARE = 0.4;

export function quickSalePrice(w: World, p: Player): number {
  const floor = tierOf(w, getClub(w, p.teamId!)) === 1 ? 20000 : 5000;
  return Math.max(floor, Math.round((p.value * QUICK_SALE_SHARE) / 1000) * 1000);
}

export function listForQuickSale(w: World, c: Club, p: Player): { ok: boolean; message: string } {
  if (p.teamId !== c.id) return { ok: false, message: 'He is not your player.' };
  if (c.leagueId === 'COLLEGE') return { ok: false, message: 'College athletes cannot be sold.' };
  if (!transferWindowOpen(w.season, w.day)) return { ok: false, message: 'The transfer window is closed (open Jul 1 – Sep 30 and Jan 1 – Jan 31).' };
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  if (rules && roster(w, c.id).length <= rules.rosterMin) return { ok: false, message: `Selling him would leave fewer than ${rules.rosterMin} registered players.` };
  p.quickSaleDay = absDay(w);
  return { ok: true, message: `${playerName(p)} is offered to every club at a discount. A buyer will pay about ${fmtMoney(quickSalePrice(w, p))} tomorrow.` };
}

export function cancelQuickSale(p: Player) {
  delete p.quickSaleDay;
}

/** Daily: complete quick sales listed today or earlier (completes when the day is processed). */
export function processQuickSales(w: World) {
  const now = absDay(w);
  for (const p of w.players) {
    if (p.quickSaleDay == null || p.quickSaleDay > now || p.teamId == null) continue;
    const seller = getClub(w, p.teamId);
    delete p.quickSaleDay;
    if (!transferWindowOpen(w.season, w.day)) continue;
    const fee = quickSalePrice(w, p);
    const r = rng(w);
    // a guaranteed buyer: best fit first, then anyone who can afford and register him, then a continental club
    const base = w.clubs.filter((b) => b.id !== seller.id && !isUser(w, b.id) && b.leagueId !== 'COLLEGE' && (b.foreign || registrationCheck(w, b, p).ok));
    let buyers = base.filter((b) => b.finances.cash >= fee * 1.5 && projectedRank(w, b, p) < 11);
    if (!buyers.length) buyers = base.filter((b) => b.finances.cash >= fee);
    if (!buyers.length) buyers = base.filter((b) => b.foreign);
    if (!buyers.length) {
      if (isUser(w, seller.id)) addNews(w, `No buyer for ${playerName(p)}`, 'No club could register or afford him, even at a discount. He stays.', { tags: ['transfer'], clubIds: [seller.id], playerIds: [p.id], importance: 2 });
      continue;
    }
    const buyer = r.pick(buyers);
    const rankBefore = roster(w, seller.id).sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === p.id);
    book(w, seller, 'transfersIn', fee);
    book(w, buyer, 'transfersOut', -fee);
    moveTo(w, p, buyer, { salary: Math.max(p.contract?.salary ?? 0, salaryAsk(w, p, buyer)), years: 2, role: roleFor(projectedRank(w, buyer, p)), buyout: null, signingBonus: 0 }, fee, 'transfer');
    if (isUser(w, seller.id)) {
      if (rankBefore >= 0 && rankBefore < 3) fanReaction(w, -12, `Sold ${playerName(p)} on the cheap`);
      hold(w, 'transferBid', `${playerName(p)} sold to ${buyer.name} for ${fmtMoney(fee)} (quick sale).`);
    }
  }
}

// ---------------------------------------------------------------------------
// Friendlies
// ---------------------------------------------------------------------------
export const MAX_FRIENDLIES = 6;

function busy(w: World, clubId: number, day: number): Fixture | undefined {
  return w.fixtures.find((f) => !f.cancelled && !f.played && Math.abs(f.day - day) <= 1 && (f.homeId === clubId || f.awayId === clubId) && Number(f.compId.split('-').pop()) === w.season);
}

export function friendliesThisSeason(w: World, clubId: number): Fixture[] {
  return w.fixtures.filter((f) => f.comp === 'friendly' && f.compId === `FRIENDLY-${w.season}` && (f.homeId === clubId || f.awayId === clubId) && !f.cancelled);
}

export interface FriendlyQuote {
  ok: boolean;
  reason?: string;
  fee: number; // appearance fee you pay (big visitors) or receive (when you visit a smaller club)
  note: string;
}

export function friendlyQuote(w: World, uc: Club, opp: Club, day: number, home: boolean): FriendlyQuote {
  const cal = buildCalendar(w.season);
  if (day <= w.day) return { ok: false, reason: 'Pick a date in the future.', fee: 0, note: '' };
  if (day >= cal.seasonEnd) return { ok: false, reason: 'The season is over by then.', fee: 0, note: '' };
  if (friendliesThisSeason(w, uc.id).length >= MAX_FRIENDLIES) return { ok: false, reason: `You already have ${MAX_FRIENDLIES} friendlies this season.`, fee: 0, note: '' };
  const mine = busy(w, uc.id, day);
  if (mine) return { ok: false, reason: `Too close to your ${mine.label} on ${fmtDate(w.season, mine.day)} (a friendly needs a free day either side).`, fee: 0, note: '' };
  const theirs = busy(w, opp.id, day);
  if (theirs) return { ok: false, reason: `${opp.name} have a game around that date (${theirs.label}).`, fee: 0, note: '' };
  const gap = opp.prestige - uc.prestige;
  const tierMult = tierOf(w, uc) === 1 ? 1 : tierOf(w, uc) === 2 ? 0.35 : 0.15;
  if (gap > 45) return { ok: false, reason: `${opp.name} turn it down: the gap in stature is too big.`, fee: 0, note: '' };
  const fee = gap > 10 ? Math.round((gap * 2500 * tierMult) / 500) * 500 : gap < -15 && !home ? -Math.round((-gap * 1200 * tierMult) / 500) * 500 : 0;
  const note = home
    ? `You keep the gate (friendly crowds are smaller).${fee > 0 ? ` ${opp.name} want an appearance fee.` : ''}`
    : `${opp.name} keep the gate; you pay travel.${fee < 0 ? ' They pay you to visit.' : fee > 0 ? ' They also want an appearance fee.' : ''}`;
  return { ok: true, fee, note };
}

export function scheduleFriendly(w: World, uc: Club, opp: Club, day: number, home: boolean): { ok: boolean; message: string } {
  const q = friendlyQuote(w, uc, opp, day, home);
  if (!q.ok) return { ok: false, message: q.reason! };
  if (q.fee > 0 && uc.finances.cash < q.fee) return { ok: false, message: `You cannot cover the ${fmtMoney(q.fee)} appearance fee.` };
  if (q.fee) book(w, uc, q.fee > 0 ? 'other' : 'other', -q.fee);
  const f: Fixture = {
    id: nextId(w), day, compId: `FRIENDLY-${w.season}`, comp: 'friendly', round: 0, label: 'Friendly',
    homeId: home ? uc.id : opp.id, awayId: home ? opp.id : uc.id, neutral: false, seriesId: null, played: false, cancelled: false, result: null,
  };
  w.fixtures.push(f);
  invalidateIndex(w);
  addNews(w, `Friendly arranged: ${getClub(w, f.homeId).name} vs ${getClub(w, f.awayId).name}`, `${fmtDate(w.season, day)}.${q.fee > 0 ? ` Appearance fee ${fmtMoney(q.fee)}.` : q.fee < 0 ? ` You receive ${fmtMoney(-q.fee)}.` : ''}`, { tags: ['club'], clubIds: [uc.id, opp.id] });
  return { ok: true, message: `Friendly vs ${opp.name} on ${fmtDate(w.season, day)} arranged.` };
}

export function cancelFriendly(w: World, f: Fixture): { ok: boolean; message: string } {
  if (f.comp !== 'friendly' || f.played) return { ok: false, message: 'Only upcoming friendlies can be cancelled.' };
  f.cancelled = true;
  return { ok: true, message: 'Friendly cancelled.' };
}

// ---------------------------------------------------------------------------
// Body types (for the player figure: frame, height, skin tone)
// ---------------------------------------------------------------------------
export type Frame = 'slender' | 'lean' | 'athletic' | 'strong' | 'heavy';
export const FRAME_LABEL: Record<Frame, string> = { slender: 'Slender', lean: 'Lean', athletic: 'Athletic', strong: 'Strong', heavy: 'Heavy-set' };
export const SKIN_TONES = ['#f3d2b8', '#e2b08b', '#c68a62', '#9a6340', '#6e4429', '#4a2c1a'];

function h(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// rough population mix per pool (weights over the six tones); fictional players, varied everywhere
const TONE_WEIGHTS: Record<string, number[]> = {
  USA: [2, 2, 2, 3, 4, 3], CAN: [4, 3, 2, 2, 2, 1], BRA: [2, 3, 4, 3, 2, 1], DOM: [1, 2, 3, 4, 3, 2], ARG: [4, 4, 3, 1, 1, 0],
  SEN: [0, 0, 1, 2, 4, 5], NGA: [0, 0, 1, 2, 4, 5], FRA: [4, 3, 2, 2, 2, 1], ESP: [5, 4, 2, 1, 1, 0], ITA: [5, 4, 2, 1, 0, 0],
};

export interface Body {
  frame: Frame;
  heightCm: number;
  weightKg: number;
  skin: string;
  width: number; // relative shoulder width 0.8-1.25
}

export function bodyOf(w: World, p: Player): Body {
  const pos = { PG: -6, SG: -3, SF: 0, PF: 5, C: 9 }[p.pos];
  const s = p.ratings.str * 0.6 - p.ratings.spd * 0.25 + pos + (h(p.id * 3.1) - 0.5) * 22 + (age(w, p) - 24) * 0.6;
  const frame: Frame = s < 12 ? 'slender' : s < 22 ? 'lean' : s < 32 ? 'athletic' : s < 42 ? 'strong' : 'heavy';
  const width = { slender: 0.84, lean: 0.92, athletic: 1.0, strong: 1.1, heavy: 1.2 }[frame];
  const bmi = { slender: 21, lean: 22.5, athletic: 24, strong: 25.8, heavy: 28 }[frame];
  const weightKg = Math.round(bmi * Math.pow(p.heightCm / 100, 2));
  const weights = TONE_WEIGHTS[p.nationality] ?? [4, 3, 2, 2, 1, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = h(p.id * 7.7 + 1) * total;
  let idx = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { idx = i; break; }
  }
  return { frame, heightCm: p.heightCm, weightKg, skin: SKIN_TONES[idx], width };
}

export function bodyLabel(b: Body): string {
  return `${(b.heightCm / 100).toFixed(2)} m · ${b.weightKg} kg · ${FRAME_LABEL[b.frame]} frame`;
}

export { roster };
