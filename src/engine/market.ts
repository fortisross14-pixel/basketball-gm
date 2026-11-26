import type { Club, Negotiation, Player, RolePromise, World, Decision } from './types';
import { absDay } from './types';
import { addNews, age, book, club as getClub, freeAgents, isUser, nextId, player as getPlayer, playerName, roster, rng, staffRating, tierOf, fmtMoney, hold, logDelegation } from './world';
import { marketValue, roleFor, salaryAsk, ROLE_MINUTES, ROLE_LABEL, generatePlayer, eligibilityYears } from './player';
import { payroll } from './finance';
import { transferWindowOpen, buildCalendar } from './calendar';
import { clubStrength } from './matchday';
import { clamp } from './rng';
import { inEuro } from './economy';
import { strategyProfile } from './squad';
import { fanReaction } from './career';

// ---------------------------------------------------------------------------
// Registration rules
// ---------------------------------------------------------------------------
export interface RegCheck {
  ok: boolean;
  reasons: string[];
  warnings: string[];
}

export function registrationCheck(w: World, c: Club, p: Player, leaving: Player | null = null): RegCheck {
  const res: RegCheck = { ok: true, reasons: [], warnings: [] };
  if (!c.leagueId) return res;
  const rules = w.rules.leagues[c.leagueId];
  if (rules.kind === 'college') {
    if (age(w, p) > 22) { res.ok = false; res.reasons.push(`NCL eligibility: college players must be 22 or younger (he is ${age(w, p)}).`); }
    if (p.career.some((x) => x.tier === 1)) { res.ok = false; res.reasons.push('NCL eligibility: he has played professionally at the top level and is no longer an amateur.'); }
  }
  const squad = roster(w, c.id).filter((x) => x.id !== p.id && x.id !== leaving?.id);
  if (squad.length + 1 > rules.rosterMax) {
    res.ok = false;
    res.reasons.push(`Roster full: ${rules.name} allows ${rules.rosterMax} registered players (you have ${squad.length}). Release or loan a player first.`);
  }
  const nonEU = squad.filter((x) => x.region === 'NONEU').length + (p.region === 'NONEU' ? 1 : 0);
  if (nonEU > rules.maxNonEU) {
    res.ok = false;
    res.reasons.push(`Non-EU limit: ${rules.name} allows ${rules.maxNonEU} non-EU players; this signing would make ${nonEU}.`);
  }
  const nonHomegrown = squad.filter((x) => !x.homegrown).length + (p.homegrown ? 0 : 1);
  const maxNonHG = rules.rosterMax - rules.minHomegrown;
  if (nonHomegrown > maxNonHG) {
    res.ok = false;
    res.reasons.push(`Homegrown quota: at least ${rules.minHomegrown} of ${rules.rosterMax} roster places must be homegrown; you would have ${nonHomegrown} non-homegrown players (max ${maxNonHG}).`);
  }
  return res;
}

export function canSignNow(w: World, needsTransfer: boolean): { ok: boolean; reason?: string } {
  const cal = buildCalendar(w.season);
  if (needsTransfer && !transferWindowOpen(w.season, w.day)) return { ok: false, reason: 'The transfer window is closed (open Jul 1 – Sep 30 and Jan 1 – Jan 31). Free agents can still be signed.' };
  if (!needsTransfer && w.day > cal.faDeadline && w.day < cal.seasonEnd) return { ok: false, reason: 'The registration deadline for free agents has passed for this season.' };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Player interest model — explains why a player would or wouldn't join
// ---------------------------------------------------------------------------
export interface ContractOffer {
  salary: number;
  years: number;
  role: RolePromise;
  buyout: number | null;
  signingBonus: number;
}

export interface InterestFactor {
  label: string;
  value: number;
}

export function projectedRank(w: World, c: Club, p: Player): number {
  const others = roster(w, c.id).filter((x) => x.id !== p.id).map((x) => x.ovr);
  return others.filter((o) => o > p.ovr).length;
}

const ROLE_ORDER: RolePromise[] = ['prospect', 'bench', 'rotation', 'starter', 'star'];

export function playerInterest(w: World, p: Player, c: Club, offer: ContractOffer, mode: 'sign' | 'renew' = 'sign'): { score: number; factors: InterestFactor[]; ask: number } {
  const ask = salaryAsk(w, p, c);
  const pers = p.personality;
  const style = p.agent.style;
  const factors: InterestFactor[] = [];
  const a = age(w, p);
  // money
  const money = (offer.salary + offer.signingBonus / Math.max(1, offer.years)) / Math.max(1, ask);
  let moneyW = 0.5 + pers.greed / 100;
  if (c.leagueId === 'COLLEGE') moneyW *= 0.4; // recruits weigh playing time, coach and program over NIL money
  if (style === 'cash') moneyW *= 1.5;
  let moneyScore = (money - 1) * moneyW * 100;
  if (style === 'hardline' && money < 0.97) moneyScore -= 15;
  moneyScore = clamp(moneyScore, -60, 25);
  factors.push({ label: `Salary vs asking (${fmtMoney(ask)})`, value: moneyScore });
  // role
  const rank = projectedRank(w, c, p);
  const deserved = roleFor(rank);
  const roleDiff = ROLE_ORDER.indexOf(offer.role) - ROLE_ORDER.indexOf(deserved);
  let roleScore = roleDiff >= 0 ? Math.min(6, roleDiff * 3) : roleDiff * (6 + pers.ego / 12);
  if (style === 'empowerment' || (style === 'development' && a <= 23)) roleScore *= 1.4;
  factors.push({ label: `Role: ${ROLE_LABEL[offer.role]} (expects ${ROLE_LABEL[deserved]})`, value: roleScore });
  // club level
  if (c.leagueId === 'COLLEGE') {
    factors.push({ label: `Program prestige & exposure (${c.prestige})`, value: (c.prestige - 45) / 3 });
    if (a >= 21) factors.push({ label: 'Wants a professional contract, not college', value: -(a - 20) * 6 });
  }
  if (w.user.background === 'formerPlayer' && isUser(w, c.id)) factors.push({ label: 'Respects you as a former player', value: 4 });
  const t = tierOf(w, c) || 1;
  const fromT = p.teamId != null ? tierOf(w, getClub(w, p.teamId)) || 1 : p.career.length ? p.career[p.career.length - 1].tier || 2 : 3;
  const levelScore = ((fromT - t) * 6 + (c.prestige - 45) / 6) * (0.5 + pers.ambition / 100) * (style === 'media' ? 1.4 : 1);
  factors.push({ label: `Club level & prestige (${c.leagueId ? w.rules.leagues[c.leagueId].short : 'Continental'})`, value: levelScore });
  // talent fit: stars reluctant to drop to small leagues
  const tierRef = t === 1 ? 74 : t === 2 ? 62 : 54;
  if (p.ovr > tierRef + 3) factors.push({ label: 'Believes he is too good for this league', value: -(p.ovr - tierRef - 3) * 2.2 });
  // competitive chance
  const str = clubStrength(w, c);
  const peers = w.clubs.filter((x) => x.leagueId === c.leagueId);
  const rankStr = peers.filter((x) => clubStrength(w, x) > str).length;
  const comp = (peers.length / 2 - rankStr) * 0.9 * (pers.ambition / 70);
  factors.push({ label: 'Competitive chance', value: comp });
  // facilities / coach
  factors.push({ label: 'Facilities (locker room, practice gym)', value: (c.arena.levels.lockerRoom + c.arena.levels.training) * 1.4 - 3 });
  factors.push({ label: 'Head coach reputation', value: (staffRating(w, c, 'headCoach') - 50) / 6 });
  // city
  factors.push({ label: `City: ${c.city}`, value: (c.economy - 1) * 15 + Math.log10(Math.max(30000, c.population) / 200000) * 3 });
  if (inEuro(w, c)) factors.push({ label: 'Continental competition', value: 5 * (pers.ambition / 80) });
  // years
  if (a >= 30 && offer.years < 2) factors.push({ label: 'Wants long-term security', value: -6 });
  if (a <= 24 && offer.years >= 4 && p.pot - p.ovr > 6) factors.push({ label: 'Wary of a long deal while improving', value: -4 });
  if (offer.buyout != null && offer.buyout < marketValue(w, p) * 1.2) factors.push({ label: 'Low release clause (flexibility)', value: 3 });
  // loyalty / relationship
  if (mode === 'renew') factors.push({ label: 'Loyalty to the club', value: pers.loyalty / 10 + (p.morale - 60) / 6 });
  if (isUser(w, c.id)) factors.push({ label: 'Your executive reputation', value: (w.user.reputation - 40) / 10 * (style === 'relationship' ? 1.6 : 1) });
  const score = factors.reduce((s, f) => s + f.value, 0);
  return { score, factors: factors.map((f) => ({ ...f, value: Math.round(f.value * 10) / 10 })), ask };
}

// ---------------------------------------------------------------------------
// Negotiation with the player / agent
// ---------------------------------------------------------------------------
export interface NegotiationResult {
  outcome: 'accepted' | 'counter' | 'walked' | 'blocked';
  message: string;
  counter?: ContractOffer;
  factors?: InterestFactor[];
  score?: number;
}

export function getNegotiation(w: World, playerId: number): Negotiation | undefined {
  return w.user.negotiations.find((n) => n.playerId === playerId && n.status === 'open');
}

export function offerContract(w: World, c: Club, p: Player, offer: ContractOffer, mode: 'sign' | 'renew', feeAgreed = 0): NegotiationResult {
  const r = rng(w);
  if (c.leagueId === 'COLLEGE') {
    if (mode === 'renew') return { outcome: 'blocked', message: 'College scholarships run until eligibility ends; there is nothing to renew.' };
    offer = { ...offer, years: eligibilityYears(age(w, p)), buyout: null };
  }
  if (mode === 'sign') {
    const reg = registrationCheck(w, c, p);
    if (!reg.ok) return { outcome: 'blocked', message: reg.reasons.join(' ') };
    const can = canSignNow(w, p.teamId != null);
    if (!can.ok) return { outcome: 'blocked', message: can.reason! };
    if (p.teamId != null && !feeAgreed && p.teamId !== c.id) return { outcome: 'blocked', message: 'You must agree a transfer fee with his club first.' };
  }
  const recentFail = w.user.negotiations.find((n) => n.playerId === p.id && n.status === 'failed' && n.rounds > absDay(w) - 30);
  if (recentFail) return { outcome: 'blocked', message: `${p.agent.name} won't take your calls for a few weeks after the last breakdown.` };
  if (isUser(w, c.id) && c.board.autonomy === 'restricted' && offer.salary > c.finances.budget.payroll * 0.12) return { outcome: 'blocked', message: 'Board autonomy is restricted: salaries above 12% of the payroll budget need board approval this season.' };
  let neg = getNegotiation(w, p.id);
  if (!neg) {
    neg = { playerId: p.id, rounds: 0, patience: p.agent.style === 'hardline' ? 60 : p.agent.style === 'relationship' ? 100 : 80, lastAsk: null, mode, feeAgreed, status: 'open' };
    w.user.negotiations.push(neg);
  }
  neg.feeAgreed = feeAgreed || neg.feeAgreed;
  neg.rounds++;
  const { score, factors, ask } = playerInterest(w, p, c, offer, mode);
  if (score >= 0) {
    neg.status = 'agreed';
    if (mode === 'sign') completeSigning(w, c, p, offer, neg.feeAgreed);
    else renewContract(w, c, p, offer);
    return { outcome: 'accepted', message: `${playerName(p)} accepts: ${fmtMoney(offer.salary)}/yr for ${offer.years} year${offer.years > 1 ? 's' : ''}.`, factors, score };
  }
  const lowball = -score;
  neg.patience -= Math.min(45, 10 + lowball * 0.6 + (p.agent.style === 'hardline' ? 10 : 0));
  if (neg.patience <= 0 || lowball > 70) {
    neg.status = 'failed';
    neg.rounds = absDay(w);
    if (mode === 'renew') p.morale = clamp(p.morale - 8, 0, 100);
    return { outcome: 'walked', message: `${p.agent.name} ends talks: "We are too far apart."`, factors, score };
  }
  // counter: salary that would close the gap (if money can close it)
  const moneyW = (0.5 + p.personality.greed / 100) * (p.agent.style === 'cash' ? 1.5 : 1);
  const needed = Math.round(Math.min(ask * 1.6, offer.salary + (lowball / (moneyW * 100)) * ask + ask * 0.02) / 1000) * 1000;
  const deservedRole = roleFor(projectedRank(w, c, p));
  const role = ROLE_ORDER.indexOf(offer.role) < ROLE_ORDER.indexOf(deservedRole) ? deservedRole : offer.role;
  const counter: ContractOffer = { ...offer, salary: needed, role, years: age(w, p) >= 30 ? Math.max(2, offer.years) : offer.years };
  neg.lastAsk = { salary: counter.salary, years: counter.years, role: counter.role };
  void r;
  const top = [...factors].sort((a, b) => a.value - b.value)[0];
  return { outcome: 'counter', message: `${p.agent.name} counters at ${fmtMoney(counter.salary)}/yr${role !== offer.role ? ` and a ${ROLE_LABEL[role]} role` : ''}. Main concern: ${top.label}.`, counter, factors, score };
}

function completeSigning(w: World, c: Club, p: Player, offer: ContractOffer, fee: number) {
  const from = p.teamId != null ? getClub(w, p.teamId) : null;
  if (from && fee > 0) {
    book(w, c, 'transfersOut', -fee);
    book(w, from, 'transfersIn', fee);
    c.finances.budget.transfer = Math.max(0, c.finances.budget.transfer - fee);
  }
  book(w, c, 'agentFees', -Math.round(offer.salary * 0.06 + offer.signingBonus));
  moveTo(w, p, c, offer, fee, from ? 'transfer' : 'freeAgent');
}

/** First season a contract signed today covers. */
export function contractStart(w: World): number {
  return w.day >= buildCalendar(w.season).seasonEnd ? w.season + 1 : w.season;
}

export function moveTo(w: World, p: Player, c: Club, offer: ContractOffer, fee: number, kind: 'transfer' | 'freeAgent' | 'youth') {
  const fromId = p.teamId;
  if (fromId != null && fromId !== c.id) {
    const old = getClub(w, fromId);
    old.tactics.starters = old.tactics.starters.filter((x) => x !== p.id);
    old.tactics.rotationOrder = old.tactics.rotationOrder.filter((x) => x !== p.id);
    delete old.tactics.minuteLimits[p.id];
  }
  p.teamId = c.id;
  p.academy = false;
  p.loan = null;
  p.transferListed = false;
  p.untouchable = false;
  const years = c.leagueId === 'COLLEGE' ? eligibilityYears(age(w, p)) : offer.years;
  p.contract = { salary: offer.salary, expires: contractStart(w) + years - 1, buyout: offer.buyout, rolePromise: offer.role, signedSeason: w.season, signingBonus: offer.signingBonus };
  p.joinedDay = absDay(w);
  p.morale = clamp(65 + (offer.role === 'star' || offer.role === 'starter' ? 8 : 0), 0, 100);
  p.minutesExpectation = ROLE_MINUTES[offer.role];
  p.value = marketValue(w, p);
  // jersey
  const taken = new Set(roster(w, c.id).filter((x) => x.id !== p.id).map((x) => x.jersey));
  const retired = new Set(c.retiredNumbers.map((x) => x.jersey));
  if (taken.has(p.jersey) || retired.has(p.jersey)) {
    for (let j = 0; j < 100; j++) if (!taken.has(j) && !retired.has(j)) { p.jersey = j; break; }
  }
  if (isUser(w, c.id)) {
    w.user.knowledge[p.id] = 100;
    const rank = roster(w, c.id).sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === p.id);
    if (rank >= 0 && rank < 3 && kind !== 'youth') fanReaction(w, 6, `Exciting signing: ${playerName(p)}`);
    if (kind === 'youth') fanReaction(w, 2, `Academy graduate ${playerName(p)} promoted`);
  }
  c.cohesion = clamp(c.cohesion - 2.5, 0, 100);
  w.transfers.unshift({ id: nextId(w), day: absDay(w), season: w.season, playerId: p.id, playerName: playerName(p), fromId, toId: c.id, fee, salary: offer.salary, kind });
  if (w.transfers.length > 800) w.transfers.length = 800;
  const from = fromId != null ? getClub(w, fromId) : null;
  const important = p.ovr >= (tierOf(w, c) === 1 ? 68 : 58) || isUser(w, c.id) || (from && isUser(w, from.id));
  if (important) {
    addNews(
      w,
      from ? `${c.name} sign ${playerName(p)} from ${from.name}` : `${c.name} sign free agent ${playerName(p)}`,
      `${p.pos}, ${age(w, p)}, rated ${p.ovr}. ${fee ? `Fee: ${fmtMoney(fee)}. ` : ''}Contract: ${fmtMoney(offer.salary)}/yr until ${p.contract.expires + 1}.`,
      { tags: ['transfer'], clubIds: [c.id, ...(from ? [from.id] : [])], playerIds: [p.id], importance: isUser(w, c.id) || (from && isUser(w, from.id)) ? 2 : 1 },
    );
  }
}

export function renewContract(w: World, c: Club, p: Player, offer: ContractOffer) {
  const start = w.day < buildCalendar(w.season).leagueRoundDays[0] && (!p.contract || p.contract.expires < w.season) ? w.season : w.season + 1;
  p.contract = { salary: offer.salary, expires: start + offer.years - 1, buyout: offer.buyout, rolePromise: offer.role, signedSeason: w.season, signingBonus: offer.signingBonus };
  book(w, c, 'agentFees', -Math.round(offer.signingBonus + offer.salary * 0.03));
  p.morale = clamp(p.morale + 6, 0, 100);
  p.value = marketValue(w, p);
  if (isUser(w, c.id)) addNews(w, `${playerName(p)} extends with ${c.name}`, `New deal until ${p.contract.expires + 1} at ${fmtMoney(offer.salary)}/yr.`, { tags: ['transfer'], clubIds: [c.id], playerIds: [p.id] });
}

// ---------------------------------------------------------------------------
// Transfer bids (user → AI club)
// ---------------------------------------------------------------------------
export interface BidResult {
  outcome: 'accepted' | 'counter' | 'rejected' | 'blocked';
  message: string;
  counterFee?: number;
}

export function sellerMinimum(w: World, seller: Club, p: Player): number {
  const rank = roster(w, seller.id).sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === p.id);
  const importance = rank < 3 ? 1.45 : rank < 6 ? 1.2 : rank < 9 ? 1.0 : 0.85;
  // discounts compound but never below 70%: a distressed seller is cheaper, not a fire sale
  const discount = Math.max(0.7, (seller.finances.cash < 0 ? 0.85 : 1) * (seller.ai.strategy === 'rebuild' && age(w, p) >= 28 ? 0.9 : 1) * (p.transferListed ? 0.88 : 1));
  const strat = seller.ai.strategy === 'contend' ? 1.15 : 1;
  // stable per-club/per-player valuation noise (±10%) so the floor can't be reverse-engineered
  const h = Math.sin(seller.id * 12.9898 + p.id * 78.233 + w.season * 3.7) * 43758.5453;
  const noise = 0.9 + (h - Math.floor(h)) * 0.2;
  return Math.round((p.value * importance * discount * strat * noise) / 1000) * 1000;
}

export function bidForPlayer(w: World, buyer: Club, p: Player, fee: number): BidResult {
  if (p.teamId == null) return { outcome: 'blocked', message: 'He is a free agent: negotiate directly.' };
  const seller = getClub(w, p.teamId);
  if (seller.leagueId === 'COLLEGE') return { outcome: 'blocked', message: 'College athletes cannot be bought. He becomes available when his eligibility ends or he declares for the pros.' };
  if (buyer.leagueId === 'COLLEGE') return { outcome: 'blocked', message: 'College programs cannot pay transfer fees: recruit free agents and high-school players instead.' };
  const can = canSignNow(w, true);
  if (!can.ok) return { outcome: 'blocked', message: can.reason! };
  if (fee > buyer.finances.cash + 100000) return { outcome: 'blocked', message: `You cannot cover a ${fmtMoney(fee)} fee with ${fmtMoney(buyer.finances.cash)} in cash.` };
  if (p.contract?.buyout != null && fee >= p.contract.buyout) {
    return { outcome: 'accepted', message: `${fmtMoney(fee)} meets his release clause: ${seller.name} cannot refuse. Now agree personal terms.` };
  }
  if (p.untouchable) return { outcome: 'rejected', message: `${seller.name}: "${playerName(p)} is not for sale."` };
  const min = sellerMinimum(w, seller, p);
  if (fee >= min) return { outcome: 'accepted', message: `${seller.name} accept ${fmtMoney(fee)}. Now agree personal terms with ${playerName(p)}.` };
  if (fee >= min * 0.7) return { outcome: 'counter', message: `${seller.name} want ${fmtMoney(min)}.${p.contract?.buyout ? ` (Release clause: ${fmtMoney(p.contract.buyout)}.)` : ''}`, counterFee: min };
  return { outcome: 'rejected', message: `${seller.name} reject the offer outright: "That is nowhere near what he is worth to us."${p.contract?.buyout ? ` His release clause is ${fmtMoney(p.contract.buyout)}.` : ''}` };
}

// ---------------------------------------------------------------------------
// Release, loans, transfer list
// ---------------------------------------------------------------------------
export function releaseCost(w: World, p: Player): number {
  if (!p.contract || p.contract.youth) return 0;
  const years = Math.max(0, p.contract.expires - w.season) + (1 - w.day / 365);
  return Math.round(p.contract.salary * years * 0.6 / 1000) * 1000;
}

export function releasePlayer(w: World, c: Club, p: Player) {
  const cost = releaseCost(w, p);
  book(w, c, 'severance', -cost);
  w.transfers.unshift({ id: nextId(w), day: absDay(w), season: w.season, playerId: p.id, playerName: playerName(p), fromId: c.id, toId: null, fee: cost, salary: 0, kind: 'release' });
  p.teamId = null;
  p.contract = null;
  p.academy = false;
  p.loan = null;
  p.morale = 50;
  c.tactics.starters = c.tactics.starters.filter((x) => x !== p.id);
  c.tactics.rotationOrder = c.tactics.rotationOrder.filter((x) => x !== p.id);
  delete c.tactics.minuteLimits[p.id];
  if (isUser(w, c.id)) addNews(w, `${c.name} release ${playerName(p)}`, `Settlement: ${fmtMoney(cost)}.`, { tags: ['transfer'], clubIds: [c.id], playerIds: [p.id] });
}

export function loanOut(w: World, c: Club, p: Player): { ok: boolean; message: string } {
  const r = rng(w);
  const tier = tierOf(w, c);
  const targets = w.clubs.filter((x) => !x.foreign && x.id !== c.id && (tierOf(w, x) >= tier) && roster(w, x.id).length < (x.leagueId ? w.rules.leagues[x.leagueId].rosterMax : 14) && registrationCheck(w, x, p).ok);
  if (!transferWindowOpen(w.season, w.day)) return { ok: false, message: 'Loans can only be agreed while the transfer window is open.' };
  if (!targets.length) return { ok: false, message: 'No club can register him right now.' };
  const dest = r.pick(targets.sort((a, b) => clubStrength(w, a) - clubStrength(w, b)).slice(0, 6));
  p.loan = { fromTeamId: c.id, untilSeason: w.season, wageShare: 0.5 };
  p.teamId = dest.id;
  p.academy = false;
  w.transfers.unshift({ id: nextId(w), day: absDay(w), season: w.season, playerId: p.id, playerName: playerName(p), fromId: c.id, toId: dest.id, fee: 0, salary: p.contract?.salary ?? 0, kind: 'loan' });
  addNews(w, `${playerName(p)} joins ${dest.name} on loan`, `${c.name} keep his rights; ${dest.name} pay half of his salary until the end of the season.`, { tags: ['transfer'], clubIds: [c.id, dest.id], playerIds: [p.id] });
  return { ok: true, message: `${playerName(p)} loaned to ${dest.name} until the end of the season.` };
}

export function recallLoans(w: World) {
  for (const p of w.players) {
    if (p.loan && p.loan.untilSeason < w.season + 1) {
      p.teamId = p.loan.fromTeamId;
      p.loan = null;
    }
  }
}

// ---------------------------------------------------------------------------
// AI market behaviour
// ---------------------------------------------------------------------------
function neededPositions(w: World, c: Club) {
  const r = roster(w, c.id);
  const count = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 } as Record<string, number>;
  for (const p of r) count[p.pos]++;
  return Object.entries(count).filter(([, n]) => n < 2).map(([k]) => k);
}

/** AI clubs complete squads with free agents within their payroll target. */
export function aiFillRosters(w: World, aggressive: boolean) {
  const r = rng(w);
  const fas = freeAgents(w).sort((a, b) => b.ovr - a.ovr);
  const cal = buildCalendar(w.season);
  if (w.day > cal.faDeadline && w.day < cal.seasonEnd) return;
  for (const c of w.clubs) {
    if (isUser(w, c.id)) continue;
    const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
    const target = aggressive ? 13 : (rules?.rosterMin ?? 10) + 1;
    let squad = roster(w, c.id);
    let tries = 0;
    while (squad.length < target && tries++ < 4) {
      const room = Math.max(c.ai.payrollTarget - payroll(w, c), 0);
      const needs = neededPositions(w, c);
      const floor = c.leagueId === 'COLLEGE' ? 2000 : tierOf(w, c) === 1 || c.foreign ? 40000 : tierOf(w, c) === 2 ? 14000 : 7000;
      const college = c.leagueId === 'COLLEGE';
      const prof = strategyProfile(c);
      const score = (p: Player) => p.ovr * (1 - prof.potWeight) + p.pot * prof.potWeight;
      if (!college) fas.sort((a, b) => score(b) - score(a));
      const cand = fas.find((p) => p.teamId == null && (college || age(w, p) <= prof.ageMax || w.day > 80) && (!college || age(w, p) <= 20) && (college || age(w, p) >= 19 || p.ovr >= 50) && (needs.length === 0 || needs.includes(p.pos) || r.chance(0.4)) && salaryAsk(w, p, c) <= Math.max(room, floor * 1.5) && (c.foreign || registrationCheck(w, c, p).ok) && acceptsAi(w, p, c));
      if (!cand) break;
      const salary = Math.max(floor, Math.round(salaryAsk(w, cand, c) * r.float(0.95, 1.05) * aiPayFactor(w, c) / 1000) * 1000);
      moveTo(w, cand, c, { salary, years: r.int(1, 3), role: roleFor(projectedRank(w, c, cand)), buyout: null, signingBonus: 0 }, 0, 'freeAgent');
      fas.splice(fas.indexOf(cand), 1);
      squad = roster(w, c.id);
    }
    // desperation: never field fewer than the league minimum — sign local amateurs
    const min = rules?.rosterMin ?? 10;
    while (squad.length < min) {
      const floor = c.leagueId === 'COLLEGE' ? 2000 : tierOf(w, c) === 1 || c.foreign ? 40000 : tierOf(w, c) === 2 ? 14000 : 7000;
      const cheap = fas.find((p) => p.teamId == null && salaryAsk(w, p, c) <= floor * 2.2 && (c.foreign || registrationCheck(w, c, p).ok));
      const p = cheap ?? localAmateur(w, c);
      moveTo(w, p, c, { salary: floor, years: 1, role: 'bench', buyout: null, signingBonus: 0 }, 0, 'freeAgent');
      if (cheap) fas.splice(fas.indexOf(cheap), 1);
      squad = roster(w, c.id);
    }
    // trim oversize squads
    const max = rules?.rosterMax ?? 15;
    while (squad.length > max) {
      const worst = [...squad].sort((a, b) => a.ovr - b.ovr)[0];
      releasePlayer(w, c, worst);
      squad = roster(w, c.id);
    }
  }
}

function localAmateur(w: World, c: Club): Player {
  const r = rng(w);
  const tier = tierOf(w, c) || 1;
  const college = c.leagueId === 'COLLEGE';
  const p = generatePlayer(w, { targetOvr: Math.round(r.normal(college ? 40 : tier === 1 ? 50 : tier === 2 ? 42 : 36, 3)), age: college ? 18 : r.int(19, 24), region: c.foreign || college ? undefined : 'ESP', country: c.foreign || college ? c.country : undefined });
  p.homegrown = !c.foreign && !college;
  w.players.push(p);
  return p;
}

/** Rich AI clubs pay over the odds; poor ones under. */
export function aiPayFactor(w: World, c: Club): number {
  return clamp((c.ai.payrollTarget / Math.max(1, payroll(w, c))) * strategyProfile(c).spend, 0.85, 1.4);
}

function acceptsAi(w: World, p: Player, c: Club): boolean {
  const t = tierOf(w, c) || 1;
  const ref = t === 1 ? 76 : t === 2 ? 63 : 55;
  const desperate = w.day > 60;
  return p.ovr <= ref + (desperate ? 6 : 2) || c.foreign;
}

/** Occasional AI-to-AI transfers during windows: richer clubs buy from smaller ones. */
export function aiTransfers(w: World) {
  if (!transferWindowOpen(w.season, w.day)) return;
  const r = rng(w);
  for (const buyer of w.clubs) {
    const prof = strategyProfile(buyer);
    if (isUser(w, buyer.id) || buyer.leagueId === 'COLLEGE' || buyer.ai.strategy === 'survive' || !r.chance(0.06 * prof.spend)) continue;
    const squad = roster(w, buyer.id).sort((a, b) => b.ovr - a.ovr);
    const fifth = squad[4]?.ovr ?? 40;
    const room = buyer.ai.payrollTarget - payroll(w, buyer);
    const budget = Math.max(0, buyer.finances.cash * 0.3 * prof.spend);
    const cands = w.players.filter((p) => p.teamId != null && p.teamId !== buyer.id && !p.academy && !p.loan && p.ovr > fifth + 2 && !isUser(w, p.teamId) && getClub(w, p.teamId).leagueId !== 'COLLEGE' && getClub(w, p.teamId).prestige < buyer.prestige - 5 && age(w, p) <= prof.ageMax);
    const target = cands.sort((a, b) => b.ovr - a.ovr).find((p) => {
      const seller = getClub(w, p.teamId!);
      const fee = p.contract?.buyout ?? sellerMinimum(w, seller, p);
      return fee <= budget && salaryAsk(w, p, buyer) <= room + (squad[squad.length - 1]?.contract?.salary ?? 0) && (buyer.foreign || registrationCheck(w, buyer, p).ok);
    });
    if (!target) continue;
    const seller = getClub(w, target.teamId!);
    const fee = target.contract?.buyout ?? sellerMinimum(w, seller, target);
    book(w, buyer, 'transfersOut', -fee);
    book(w, seller, 'transfersIn', fee);
    moveTo(w, target, buyer, { salary: salaryAsk(w, target, buyer), years: r.int(2, 3), role: roleFor(projectedRank(w, buyer, target)), buyout: null, signingBonus: 0 }, fee, 'transfer');
  }
}

/** AI clubs make bids for the user's players → decision for the user (or delegated GM). */
export function aiBidsForUser(w: World) {
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  if (!uc || uc.leagueId === 'COLLEGE' || !transferWindowOpen(w.season, w.day)) return;
  const r = rng(w);
  const noise = w.settings.worldNoise === 'quiet' ? 0.5 : w.settings.worldNoise === 'handsOn' ? 1.5 : 1;
  if (!r.chance(0.22 * noise)) return;
  const mine = roster(w, uc.id).filter((p) => !p.untouchable && (p.ovr >= 50 || p.transferListed));
  if (!mine.length) return;
  const p = r.weighted(mine, mine.map((x) => x.ovr * (x.transferListed ? 3 : 1) * (x.pot > x.ovr + 5 ? 1.5 : 1)));
  // buyers that need him (he'd make their top six), can afford him and whose plan fits his age
  const buyers = w.clubs.filter((c) => {
    if (c.id === uc.id || c.leagueId === 'COLLEGE' || c.ai.strategy === 'survive' || c.prestige < uc.prestige - 5) return false;
    const sixth = roster(w, c.id).sort((a, b) => b.ovr - a.ovr)[5]?.ovr ?? 0;
    return p.ovr > sixth && age(w, p) <= strategyProfile(c).ageMax + 1 && c.finances.cash * 0.5 >= p.value * 0.8;
  });
  if (!buyers.length) return;
  const buyer = r.weighted(buyers, buyers.map((c) => c.finances.cash));
  const existing = w.decisions.find((d) => !d.resolved && d.kind === 'transferBid' && d.payload.playerId === p.id);
  if (existing) return;
  let fee = Math.round(Math.min(buyer.finances.cash * 0.5, p.value * r.float(0.75, 1.3)) / 5000) * 5000;
  if (p.contract?.buyout && fee >= p.contract.buyout) fee = p.contract.buyout;
  const forced = p.contract?.buyout != null && fee >= p.contract.buyout;
  const policy = w.user.delegation.transfers;
  const min = p.value * (policy.minSellMultiple ?? 1.4);
  const d: Decision = {
    id: nextId(w),
    kind: 'transferBid',
    title: `${buyer.name} bid ${fmtMoney(fee)} for ${playerName(p)}`,
    body: `${forced ? 'The bid meets his release clause: you cannot block the move, only try to convince him to stay.' : `Market value ${fmtMoney(p.value)}. He earns ${fmtMoney(p.contract?.salary ?? 0)}/yr.`} ${p.transferListed ? 'He is on the transfer list.' : ''}`,
    createdDay: absDay(w),
    deadlineDay: absDay(w) + 5,
    urgency: 2,
    impact: p.ovr >= 60 ? 3 : 2,
    dept: 'transfers',
    options: forced
      ? [{ id: 'accept', label: 'Accept the release clause', tone: 'neutral' }, { id: 'persuade', label: 'Persuade him to stay (morale & raise)', tone: 'risky' }]
      : [{ id: 'accept', label: `Accept ${fmtMoney(fee)}`, tone: 'good' }, { id: 'counter', label: `Counter at ${fmtMoney(Math.round(fee * 1.25 / 5000) * 5000)}`, tone: 'risky' }, { id: 'reject', label: 'Reject', tone: 'neutral' }],
    recommended: forced ? 'accept' : fee >= min ? 'accept' : 'reject',
    recommendedBy: 'Sporting director',
    payload: { playerId: p.id, buyerId: buyer.id, fee, forced },
    defaultOption: forced ? 'accept' : 'reject',
    resolved: false,
    playerIds: [p.id],
    clubIds: [buyer.id],
  };
  w.decisions.push(d);
  hold(w, 'transferBid', d.title);
}

export function resolveTransferBid(w: World, d: Decision, choice: string): string {
  const p = getPlayer(w, d.payload.playerId as number);
  const buyer = getClub(w, d.payload.buyerId as number);
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  if (!p || !uc || p.teamId !== uc.id) return 'The bid lapsed.';
  const r = rng(w);
  let fee = d.payload.fee as number;
  if (choice === 'counter') {
    fee = Math.round(fee * 1.25 / 5000) * 5000;
    // the buyer accepts a counter only if it still sits inside its own valuation and budget
    const valuation = p.value * (1.05 + (buyer.ai.strategy === 'contend' ? 0.25 : 0.1));
    const pAccept = fee > buyer.finances.cash * 0.6 ? 0 : 1 / (1 + Math.exp(-((valuation - fee) / Math.max(1, p.value)) * 6));
    if (!r.chance(pAccept)) return `${buyer.name} walk away from the deal at ${fmtMoney(fee)}.`;
  }
  if (choice === 'persuade') {
    if (r.chance(0.3 + p.personality.loyalty / 250)) {
      p.morale = clamp(p.morale - 5, 0, 100);
      return `${playerName(p)} rejects ${buyer.name} out of loyalty — but expects a raise soon.`;
    }
    choice = 'accept';
  }
  if (choice === 'accept' || choice === 'counter') {
    const rankBefore = roster(w, uc.id).sort((a, b) => b.ovr - a.ovr).findIndex((x) => x.id === p.id);
    if (rankBefore >= 0 && rankBefore < 3) fanReaction(w, -10 - (p.homegrown ? 4 : 0), `Sold ${playerName(p)}, one of the team's best players`);
    book(w, uc, 'transfersIn', fee);
    book(w, buyer, 'transfersOut', -fee);
    moveTo(w, p, buyer, { salary: Math.max(p.contract?.salary ?? 0, salaryAsk(w, p, buyer)), years: 3, role: roleFor(projectedRank(w, buyer, p)), buyout: null, signingBonus: 0 }, fee, 'transfer');
    uc.finances.budget.transfer += Math.round(fee * 0.5);
    return `${playerName(p)} sold to ${buyer.name} for ${fmtMoney(fee)}. Half of the fee is added to your transfer budget.`;
  }
  p.morale = clamp(p.morale - (p.personality.ambition > 70 && buyer.prestige > uc.prestige ? 8 : 1), 0, 100);
  return `Bid rejected. ${p.personality.ambition > 70 && buyer.prestige > uc.prestige ? `${playerName(p)} is unhappy to miss the move.` : ''}`;
}

/** Delegated GM: keep the squad complete within policy (user club). */
export function delegatedSquadUpkeep(w: World) {
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  if (!uc) return;
  const pol = w.user.delegation.transfers;
  if (pol.mode === 'manual' || pol.mode === 'recommend') return;
  const rules = uc.leagueId ? w.rules.leagues[uc.leagueId] : null;
  if (!rules) return;
  delegatedRenewals(w, uc);
  const squad = roster(w, uc.id);
  if (squad.length >= rules.rosterMin + 1) return;
  const can = canSignNow(w, false);
  const room = uc.finances.budget.payroll - payroll(w, uc);
  const maxSal = pol.maxSalary && pol.maxSalary > 0 ? pol.maxSalary : room;
  const willing = (p: Player, salary: number) => registrationCheck(w, uc, p).ok && playerInterest(w, p, uc, { salary, years: 1, role: roleFor(projectedRank(w, uc, p)), buyout: null, signingBonus: 0 }).score >= 0;
  let cand = can.ok ? freeAgents(w).sort((a, b) => b.ovr - a.ovr).find((p) => salaryAsk(w, p, uc) <= Math.max(0, Math.min(maxSal, room)) && willing(p, salaryAsk(w, p, uc))) : undefined;
  let why = `Roster below the safe minimum (${squad.length}/${rules.rosterMin + 1}); best affordable free agent within policy.`;
  // a legal roster comes first: the cheapest registrable player, even beyond the budget
  if (!cand && can.ok && squad.length < rules.rosterMin) {
    cand = freeAgents(w).filter((p) => p.ovr >= 30).sort((a, b) => salaryAsk(w, a, uc) - salaryAsk(w, b, uc)).find((p) => willing(p, salaryAsk(w, p, uc)));
    why = `Roster below the league minimum (${squad.length}/${rules.rosterMin}): the cheapest registrable free agent, to stay legal.`;
  }
  if (!cand) {
    // promote the best academy player instead
    const youth = w.players.filter((p) => p.teamId === uc.id && p.academy && !p.retired && registrationCheck(w, uc, p).ok).sort((a, b) => b.ovr - a.ovr)[0];
    if (youth && squad.length < rules.rosterMin + 1) {
      youth.academy = false;
      if (youth.contract) youth.contract.youth = false;
      logDelegation(w, 'transfers', 'Sporting director', `Promoted ${playerName(youth)} from the academy`, `Roster below the safe minimum (${squad.length}/${rules.rosterMin + 1}) and no affordable free agent.`, 'Keeps the squad registrable at no extra cost.');
      addNews(w, `${playerName(youth)} promoted to the first team`, 'The sporting director filled a roster spot from the academy.', { tags: ['delegation'], clubIds: [uc.id], playerIds: [youth.id] });
    } else if (squad.length < rules.rosterMin) {
      hold(w, 'decision', `Your roster has only ${squad.length} registered players (minimum ${rules.rosterMin}) and the sporting director found nobody affordable. Sign a player.`);
    }
    return;
  }
  const salary = salaryAsk(w, cand, uc);
  moveTo(w, cand, uc, { salary, years: 1, role: roleFor(projectedRank(w, uc, cand)), buyout: null, signingBonus: 0 }, 0, 'freeAgent');
  logDelegation(w, 'transfers', 'Sporting director', `Signed free agent ${playerName(cand)} (${cand.pos}, ${cand.ovr}) for ${fmtMoney(salary)}`, why, 'Keeps the squad registrable and covers injuries.');
  if (pol.mode === 'notify') addNews(w, `Sporting director signs ${playerName(cand)}`, `Delegated signing within policy: ${fmtMoney(salary)}/yr, 1 year.`, { tags: ['delegation', 'transfer'], clubIds: [uc.id], playerIds: [cand.id] });
}

/** Delegated renewals: from February, extend expiring core players whose ask fits the budget. */
function delegatedRenewals(w: World, c: Club) {
  const cal = buildCalendar(w.season);
  if (w.day < cal.winterWindowOpen || w.day >= cal.seasonEnd) return;
  const squad = roster(w, c.id).sort((a, b) => b.ovr - a.ovr);
  const core = squad.slice(0, 8);
  for (const p of core) {
    if (!p.contract || p.contract.youth || p.contract.expires !== w.season || age(w, p) >= 34) continue;
    const ask = salaryAsk(w, p, c);
    const room = c.finances.budget.payroll - payroll(w, c) + p.contract.salary;
    if (ask > room * 1.02) continue;
    const years = age(w, p) <= 27 ? 3 : 2;
    const offer = { salary: ask, years, role: roleFor(squad.indexOf(p)), buyout: null, signingBonus: 0 };
    if (playerInterest(w, p, c, offer, 'renew').score < 0) continue;
    renewContract(w, c, p, offer);
    logDelegation(w, 'transfers', 'Sporting director', `Renewed ${playerName(p)} (${p.ovr}) for ${years} years at ${fmtMoney(ask)}`, 'Core player out of contract in June; the ask fits the payroll budget.', 'Avoids losing him for nothing.');
    return; // one renewal a week
  }
}
