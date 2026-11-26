import type { Club, Decision, DecisionOption, Department, World, Player, Staff } from './types';
import { absDay } from './types';
import { addNews, book, club as getClub, fmtMoney, hold, isUser, logDelegation, nextId, player as getPlayer, playerName, roster, rng, staffById, staffOf, age, freeAgents, userClub, academy } from './world';
import { clamp } from './rng';
import { resolveTransferBid } from './market';
import { resolveSponsorDecision } from './commercial';
import { refPrice } from './economy';
import { SEAT_ZONES } from './types';
import { STAFF_LABEL, staffAsk } from './staff';
import { resolveJobOffer, fanReaction } from './career';
import { prFactor } from './facilities';
import { salaryAsk, ROLE_MINUTES } from './player';

type Tpl = 'unhappyMinutes' | 'raiseRequest' | 'fanPrices' | 'councilGrant' | 'prospect' | 'staffPoach' | 'incident' | 'sponsorAppearance' | 'coachWish' | 'press' | 'returnToPlay' | 'leaderMeeting';

function mkDecision(w: World, tpl: Tpl, dept: Department, title: string, body: string, options: DecisionOption[], recommended: string | null, recommendedBy: string | null, payload: Record<string, unknown>, opts: { urgency?: number; impact?: number; days?: number; playerIds?: number[]; def?: string } = {}): Decision {
  return {
    id: nextId(w), kind: tpl === 'press' ? 'pressConference' : tpl === 'returnToPlay' ? 'returnToPlay' : tpl === 'staffPoach' ? 'staffPoach' : tpl === 'raiseRequest' ? 'contractRequest' : 'event',
    title, body, createdDay: absDay(w), deadlineDay: absDay(w) + (opts.days ?? 6), urgency: opts.urgency ?? 1, impact: opts.impact ?? 1, dept,
    options, recommended, recommendedBy, payload: { tpl, ...payload }, defaultOption: opts.def ?? options[options.length - 1].id, resolved: false, playerIds: opts.playerIds,
  };
}

/** Weekly midweek opportunities for the user club. Frequency scales with World Noise. */
export function weeklyEvents(w: World) {
  const c = userClub(w);
  if (!c) return;
  const r = rng(w);
  const noise = w.settings.worldNoise === 'quiet' ? 0.45 : w.settings.worldNoise === 'handsOn' ? 1.6 : 1;
  const open = w.decisions.filter((d) => !d.resolved).length;
  if (open >= 6) return;
  const squad = roster(w, c.id);
  const candidates: (() => Decision | null)[] = [];

  // Unhappy about minutes
  const unhappy = squad.filter((p) => p.morale < 45 && p.minutesExpectation >= 15 && p.stats.length > 0);
  if (unhappy.length) candidates.push(() => {
    const p = r.pick(unhappy);
    return mkDecision(w, 'unhappyMinutes', 'tactics', `${playerName(p)} unhappy with his role`, `He expected around ${p.minutesExpectation} minutes a game (${p.contract?.rolePromise ?? 'rotation'} promise). His agent ${p.agent.name} is talking to the press. Morale ${Math.round(p.morale)}/100.`,
      [{ id: 'promise', label: 'Promise more minutes', detail: 'Morale up; coach authority down if you don\'t deliver', tone: 'risky' }, { id: 'explain', label: 'Explain his role', detail: 'Small morale hit for big egos', tone: 'neutral' }, { id: 'list', label: 'Put him on the transfer list', tone: 'bad' }],
      'explain', 'Head coach', { playerId: p.id }, { playerIds: [p.id], impact: p.ovr > 60 ? 2 : 1 });
  });

  // Raise request from overperformer
  const stars = squad.filter((p) => p.contract && !p.contract.youth && p.contract.salary < salaryAsk(w, p) * 0.7 && p.contract.expires > w.season);
  if (stars.length) candidates.push(() => {
    const p = r.pick(stars);
    const ask = Math.round(salaryAsk(w, p) * 0.9 / 1000) * 1000;
    return mkDecision(w, 'raiseRequest', 'transfers', `${playerName(p)} requests a new contract`, `He earns ${fmtMoney(p.contract!.salary)} but his market value now justifies about ${fmtMoney(ask)}. ${p.agent.style === 'hardline' ? 'His agent is known for forcing moves.' : ''}`,
      [{ id: 'raise', label: `Improve terms to ${fmtMoney(ask)}`, tone: 'good' }, { id: 'later', label: 'Promise talks at season end', tone: 'neutral' }, { id: 'refuse', label: 'Refuse', tone: 'bad' }],
      p.ovr >= 60 ? 'raise' : 'later', 'Sporting director', { playerId: p.id, ask }, { playerIds: [p.id], impact: 2 });
  });

  // Fans protest prices
  const priceRatio = SEAT_ZONES.reduce((a, z) => a + c.ticketing.prices[z] / Math.max(1, refPrice(w, c, z)), 0) / 3;
  if (priceRatio > 1.2 && c.fans.sentiment < 55) candidates.push(() => mkDecision(w, 'fanPrices', 'tickets', 'Supporters protest ticket prices', `The supporters' federation says prices are ${Math.round((priceRatio - 1) * 100)}% above what fans consider fair, and plans a banner campaign at the next game.`,
    [{ id: 'cut', label: 'Cut prices by 10%', tone: 'good' }, { id: 'meet', label: 'Meet the fan groups (€ small cost)', tone: 'neutral' }, { id: 'hold', label: 'Hold firm', tone: 'bad' }], 'meet', 'Marketing director', {}, { impact: 2 }));

  // Council grant
  if (r.chance(0.3)) candidates.push(() => {
    const amount = Math.round((c.leagueId === 'ELITE' ? 150000 : c.leagueId === 'ORO' ? 60000 : 25000) * r.float(0.7, 1.3) / 1000) * 1000;
    return mkDecision(w, 'councilGrant', 'marketing', 'City council offers a community grant', `The council will contribute ${fmtMoney(amount)} if the club runs a community programme in schools this season.`,
      [{ id: 'accept', label: 'Accept and launch school clinics', tone: 'good' }, { id: 'decline', label: 'Decline', tone: 'neutral' }], 'accept', 'Marketing director', { amount }, { impact: 1 });
  });

  // Prospect discovered by scouts
  const scout = staffOf(w, c, 'scoutDirector');
  if (scout && r.chance(0.35)) candidates.push(() => {
    const youngFa = freeAgents(w).filter((p) => age(w, p) <= 20).sort((a, b) => b.pot - a.pot)[0];
    if (!youngFa) return null;
    w.user.knowledge[youngFa.id] = Math.max(w.user.knowledge[youngFa.id] ?? 0, 50 + scout.rating / 3);
    return mkDecision(w, 'prospect', 'scouting', `Scout report: ${playerName(youngFa)} (${age(w, youngFa)}) is unattached`, `${scout.firstName} ${scout.lastName} rates him as a ${youngFa.pos} with real upside. He would join the academy on a youth contract.`,
      [{ id: 'sign', label: 'Sign him to the academy (€15k fee)', tone: 'good' }, { id: 'pass', label: 'Pass', tone: 'neutral' }], scout.rating >= 55 ? 'sign' : 'pass', 'Scouting director', { playerId: youngFa.id }, { playerIds: [youngFa.id] });
  });

  // Staff poached
  const poachable = (['headCoach', 'assistantDev', 'scoutDirector', 'commercialDirector', 'medicalLead'] as const).map((role) => staffOf(w, c, role)).filter((s): s is Staff => !!s && s.rating >= 55 && s.ambition > 50);
  if (poachable.length && r.chance(0.25)) candidates.push(() => {
    const s = r.pick(poachable);
    const rival = r.pick(w.clubs.filter((x) => !x.foreign && x.prestige > c.prestige && x.id !== c.id));
    if (!rival) return null;
    const raise = Math.round((s.contract?.salary ?? staffAsk(w, s, 2)) * 1.3 / 1000) * 1000;
    return mkDecision(w, 'staffPoach', 'board', `${rival.name} want your ${STAFF_LABEL[s.role].toLowerCase()}`, `${s.firstName} ${s.lastName} (rating ${s.rating}) has been offered a bigger role at ${rival.name}.`,
      [{ id: 'counter', label: `Match with a raise to ${fmtMoney(raise)}/yr`, tone: 'good' }, { id: 'release', label: 'Let them go (compensation €' + Math.round((s.contract?.salary ?? 0) * 0.5 / 1000) + 'k)', tone: 'neutral' }],
      s.rating >= 65 ? 'counter' : 'release', 'Board', { staffId: s.id, rivalId: rival.id, raise }, { impact: 2, urgency: 2, days: 4, def: 'release' });
  });

  // Incident
  const egos = squad.filter((p) => p.personality.ego > 75);
  if (egos.length && r.chance(0.2)) candidates.push(() => {
    const p = r.pick(egos);
    return mkDecision(w, 'incident', 'media', `${playerName(p)} in a late-night incident`, 'A video of the player at a nightclub two nights before the game is circulating on social media.',
      [{ id: 'fine', label: 'Fine him publicly', tone: 'neutral' }, { id: 'support', label: 'Handle it internally', tone: 'risky' }, { id: 'bench', label: 'Bench him for a game', tone: 'bad' }], 'fine', 'PR lead', { playerId: p.id }, { playerIds: [p.id] });
  });

  // Sponsor appearance
  if (c.sponsors.length && r.chance(0.25)) candidates.push(() => {
    const s = r.pick(c.sponsors);
    const star = [...squad].sort((a, b) => b.ovr - a.ovr)[0];
    if (!star) return null;
    return mkDecision(w, 'sponsorAppearance', 'sponsors', `${s.brand} request an appearance by ${playerName(star)}`, 'An evening event with clients the day before a game. The coach is not keen.',
      [{ id: 'send', label: 'Send him (sponsor goodwill)', tone: 'risky' }, { id: 'other', label: 'Offer another player', tone: 'neutral' }, { id: 'decline', label: 'Decline', tone: 'bad' }], 'other', 'Commercial director', { sponsorId: s.id, playerId: star.id }, { playerIds: [star.id] });
  });

  // Coach wish
  const coach = staffOf(w, c, 'headCoach');
  if (coach && r.chance(0.2)) candidates.push(() => {
    const fa = freeAgents(w).filter((p) => p.ovr >= (squad[7]?.ovr ?? 45)).sort((a, b) => b.ovr - a.ovr)[0];
    if (!fa) return null;
    w.user.knowledge[fa.id] = Math.max(w.user.knowledge[fa.id] ?? 0, 70);
    return mkDecision(w, 'coachWish', 'transfers', `Coach ${coach.lastName} wants ${playerName(fa)}`, `"He fits what we do." Free agent ${fa.pos}, rated around ${fa.ovr}, asking ${fmtMoney(salaryAsk(w, fa, c))}/yr. Go to People → Free agents to negotiate.`,
      [{ id: 'shortlist', label: 'Add to shortlist', tone: 'good' }, { id: 'ignore', label: 'Not now', tone: 'neutral' }], 'shortlist', 'Head coach', { playerId: fa.id }, { playerIds: [fa.id] });
  });

  // Captain / leader meeting after a losing streak
  const lc = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`);
  const st = lc?.standings.find((s) => s.clubId === c.id);
  if (st && st.streak <= -3) candidates.push(() => mkDecision(w, 'press', 'media', `Press conference after ${-st.streak} straight defeats`, 'Journalists want to know whether the project is in crisis.',
    [{ id: 'calm', label: 'Calm: "We trust the process"', tone: 'neutral' }, { id: 'defend', label: 'Defend the players publicly', tone: 'good' }, { id: 'demand', label: 'Demand more from the players', tone: 'risky' }, { id: 'expect', label: 'Lower expectations', tone: 'bad' }], 'defend', 'PR lead', {}, { urgency: 2, days: 3 }));

  if (!candidates.length) return;
  const n = r.chance(0.5 * noise) ? 1 : 0;
  for (let i = 0; i < n + (r.chance(0.12 * noise) ? 1 : 0); i++) {
    const d = r.pick(candidates)();
    if (!d) continue;
    if (w.decisions.some((x) => !x.resolved && x.title === d.title)) continue;
    routeDecision(w, d);
  }
}

/** Return-to-play decisions when a key player is close to recovering. */
export function returnToPlayCheck(w: World, c: Club, p: Player) {
  if (!p.injury || p.injury.daysOut !== 4 || p.ovr < 50) return;
  const med = staffOf(w, c, 'medicalLead');
  const risk = Math.round(clamp(25 + p.injuryProne / 3 - (med?.rating ?? 30) / 5, 5, 60));
  const d = mkDecision(w, 'returnToPlay', 'medical', `${playerName(p)} wants to return early`, `He is 4 days from full recovery (${p.injury.type}). Playing now carries a ${risk}% higher re-injury risk and he will be below his best.`,
    [{ id: 'rush', label: 'Clear him to play now', tone: 'risky' }, { id: 'wait', label: 'Wait for full recovery', tone: 'good' }], risk > (w.user.delegation.medical.riskTolerance ?? 30) ? 'wait' : 'rush', 'Medical lead', { playerId: p.id, risk }, { playerIds: [p.id], days: 3, def: 'wait' });
  routeDecision(w, d);
}

/** Applies delegation: decide automatically or ask the user. */
export function routeDecision(w: World, d: Decision) {
  const pol = w.user.delegation[d.dept] ?? { mode: 'manual' };
  const auto = pol.mode === 'policy' ? d.recommended != null && d.impact <= 1 : pol.mode === 'notify' || pol.mode === 'full';
  if (auto && d.recommended) {
    const msg = resolveDecision(w, d, d.recommended, true);
    logDelegation(w, d.dept, d.recommendedBy ?? 'Staff', `${d.title} → ${d.options.find((o) => o.id === d.recommended)?.label}`, msg, 'Handled within your delegation policy.');
    if (pol.mode !== 'full') addNews(w, `Delegated: ${d.title}`, `${d.recommendedBy}: ${msg}`, { tags: ['delegation'], clubIds: w.user.clubId != null ? [w.user.clubId] : [] });
    return;
  }
  if (pol.mode === 'manual') d.recommended = null;
  w.decisions.push(d);
  hold(w, 'decision', d.title);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------
export function resolveDecision(w: World, d: Decision, choice: string, delegated = false): string {
  if (d.resolved) return 'Already resolved.';
  d.resolved = true;
  d.choice = choice;
  let msg = '';
  switch (d.kind) {
    case 'transferBid': msg = resolveTransferBid(w, d, choice); break;
    case 'sponsorOffer': msg = resolveSponsorDecision(w, d, choice); break;
    case 'jobOffer': msg = resolveJobOffer(w, d, choice); break;
    default: msg = resolveEvent(w, d, choice);
  }
  if (!delegated && w.user.clubId != null) {
    // overruling a staff recommendation has a small relationship cost; results feed later stories
    if (d.recommended && d.recommended !== choice && d.dept === 'tactics') {
      const c = getClub(w, w.user.clubId);
      c.cohesion = clamp(c.cohesion - 1, 0, 100);
    }
  }
  (d.payload as Record<string, unknown>).result = msg;
  return msg;
}

function resolveEvent(w: World, d: Decision, choice: string): string {
  const c = userClub(w);
  if (!c) return 'No club.';
  const tpl = d.payload.tpl as Tpl;
  const p = d.payload.playerId != null ? getPlayer(w, d.payload.playerId as number) : null;
  const r = rng(w);
  switch (tpl) {
    case 'unhappyMinutes':
      if (!p) return '';
      if (choice === 'promise') { p.morale = clamp(p.morale + 18, 0, 100); p.minutesExpectation += 4; c.tactics.rotationOrder = [p.id, ...c.tactics.rotationOrder.filter((x) => x !== p.id)]; return `${playerName(p)} is happier. He moves up the rotation order — the coach must deliver.`; }
      if (choice === 'explain') { p.morale = clamp(p.morale + (p.personality.ego > 70 ? -4 : 6), 0, 100); return p.personality.ego > 70 ? 'He did not take it well.' : 'He accepts his role for now.'; }
      p.transferListed = true; p.morale = clamp(p.morale - 10, 0, 100); return `${playerName(p)} is now on the transfer list.`;
    case 'raiseRequest':
      if (!p || !p.contract) return '';
      if (choice === 'raise') { p.contract.salary = d.payload.ask as number; p.morale = clamp(p.morale + 15, 0, 100); return `New terms agreed: ${fmtMoney(p.contract.salary)}/yr.`; }
      if (choice === 'later') { p.morale = clamp(p.morale - 3, 0, 100); return 'He will wait — for now.'; }
      p.morale = clamp(p.morale - 15, 0, 100); if (p.agent.style === 'hardline') p.transferListed = true; return p.agent.style === 'hardline' ? 'His agent demands a transfer.' : 'He is unhappy.';
    case 'fanPrices':
      if (choice === 'cut') { for (const z of SEAT_ZONES) c.ticketing.prices[z] = Math.round(c.ticketing.prices[z] * 0.9); c.fans.sentiment = clamp(c.fans.sentiment + 8, 0, 100); fanReaction(w, 5, 'Listened to supporters on ticket prices'); return 'Prices cut by 10%. Supporters welcome the move.'; }
      if (choice === 'meet') { book(w, c, 'marketing', -3000); c.fans.sentiment = clamp(c.fans.sentiment + 3, 0, 100); return 'The meeting eased tensions a little.'; }
      c.fans.sentiment = clamp(c.fans.sentiment - 6, 0, 100); c.fans.loyalty = clamp(c.fans.loyalty - 2, 0, 100); fanReaction(w, -6, 'Ignored the ticket-price protest'); return 'Banners at the next game. Sentiment drops.';
    case 'councilGrant':
      if (choice === 'accept') {
        book(w, c, 'grants', d.payload.amount as number);
        const cost = Math.round((d.payload.amount as number) * 0.045 / 100) * 100;
        if (!c.campaigns.some((x) => x.kind === 'schoolClinics')) c.campaigns.push({ id: nextId(w), kind: 'schoolClinics', weeksLeft: 10, weeklyCost: cost, intensity: 1 });
        c.ticketing.studentDiscount = true;
        for (const p of roster(w, c.id).slice(0, 4)) p.freshness = Math.max(70, p.freshness - 4); // players attend clinics
        return `Grant of ${fmtMoney(d.payload.amount as number)} received. Conditions: 10 weeks of school clinics (${fmtMoney(cost)}/week, player appearances) and student discounts on general tickets.`;
      }
      return 'Grant declined.';
    case 'prospect':
      if (!p) return '';
      if (choice === 'sign' && p.teamId == null) { book(w, c, 'academyCost', -15000); p.teamId = c.id; p.academy = true; p.homegrown = p.homegrown || age(w, p) <= 20; p.originClubId = c.id; p.contract = { salary: 4000, expires: w.season + 2, buyout: null, rolePromise: 'prospect', signedSeason: w.season, signingBonus: 0, youth: true }; w.user.knowledge[p.id] = 80; return `${playerName(p)} joins the academy.`; }
      return 'Passed on the prospect.';
    case 'staffPoach': {
      const s = staffById(w, d.payload.staffId as number);
      const rival = getClub(w, d.payload.rivalId as number);
      if (!s) return '';
      if (choice === 'counter') {
        if (r.chance(0.25 + s.ambition / 400)) choice = 'release';
        else { if (s.contract) s.contract.salary = d.payload.raise as number; s.loyalty = Math.min(100, s.loyalty + 15); return `${s.lastName} stays on improved terms.`; }
        addNews(w, `${rival.name} top your offer`, `${s.firstName} ${s.lastName} chose the bigger project anyway.`, { tags: ['staff'], clubIds: [c.id, rival.id] });
      }
      book(w, c, 'other', Math.round((s.contract?.salary ?? 0) * 0.5));
      delete c.staff[s.role];
      const prev = rival.staff[s.role];
      if (prev != null) { const old = staffById(w, prev); if (old) { old.teamId = null; old.contract = null; } }
      s.teamId = rival.id; rival.staff[s.role] = s.id; s.history.push({ season: w.season, teamId: rival.id, role: s.role });
      addNews(w, `${s.firstName} ${s.lastName} leaves for ${rival.name}`, `${c.name} lose their ${STAFF_LABEL[s.role].toLowerCase()}. The post is vacant (Team → Staff).`, { tags: ['staff'], clubIds: [c.id, rival.id], importance: 2 });
      return `${s.lastName} joins ${rival.name}. The post is now vacant.`;
    }
    case 'incident':
      if (!p) return '';
      if (choice === 'fine') { p.morale = clamp(p.morale - 6, 0, 100); return 'Fine announced; the story dies down.'; }
      if (choice === 'support') { if (r.chance(0.4)) { c.fans.sentiment = clamp(c.fans.sentiment - 4, 0, 100); c.board.trust.media = clamp(c.board.trust.media - 8, 0, 100); return 'The story grew: media accuse the club of a cover-up.'; } p.morale = clamp(p.morale + 4, 0, 100); return 'Handled quietly; the player appreciates the support.'; }
      p.morale = clamp(p.morale - 12, 0, 100); p.freshness = 100; c.board.trust.media = clamp(c.board.trust.media + 4, 0, 100); return 'Benched. Strong message to the locker room.';
    case 'sponsorAppearance': {
      const s = c.sponsors.find((x) => x.id === d.payload.sponsorId);
      if (choice === 'send') { if (p) p.freshness = Math.max(50, p.freshness - 12); if (s) s.fit = Math.min(100, s.fit + 10); return 'The sponsor is delighted; the player is a little tired.'; }
      if (choice === 'other') { if (s) s.fit = Math.min(100, s.fit + 3); return 'A squad player attended. Acceptable.'; }
      if (s) s.fit = Math.max(0, s.fit - 10); return 'The sponsor is disappointed.';
    }
    case 'coachWish':
      if (choice === 'shortlist' && p) { if (!w.user.shortlist.some((x) => x.playerId === p.id)) w.user.shortlist.push({ playerId: p.id, note: 'Coach request', addedDay: absDay(w) }); return `${playerName(p)} added to your shortlist.`; }
      return 'The coach is disappointed.';
    case 'press': {
      const sq = roster(w, c.id);
      // a better PR office softens bad press and amplifies good press
      const k = prFactor(w, c);
      const m0 = c.board.trust.media;
      const done = (text: string) => { const d = c.board.trust.media - m0; c.board.trust.media = clamp(m0 + (d > 0 ? d * k : d / k), 0, 100); return text; };
      w.user.pressStance += choice === 'defend' ? 1 : choice === 'demand' ? -1 : choice === 'expect' ? -0.5 : 0;
      if (choice === 'calm') {
        if (r.chance(0.35 / k)) { c.board.trust.media = clamp(c.board.trust.media - 3, 0, 100); fanReaction(w, -2, 'Evasive press conference'); return done('The press called it evasive: "No answers from the executive."'); }
        c.board.trust.media = clamp(c.board.trust.media + 2, 0, 100); return done('Measured answers. No headlines.');
      }
      if (choice === 'defend') { for (const x of sq) x.morale = clamp(x.morale + 4, 0, 100); c.board.trust.media = clamp(c.board.trust.media - 2, 0, 100); return done('The locker room appreciates it; some media call it denial.'); }
      if (choice === 'demand') { for (const x of sq) x.morale = clamp(x.morale + (x.personality.ego > 65 ? -6 : 2), 0, 100); c.fans.sentiment = clamp(c.fans.sentiment + 3, 0, 100); return 'Fans like the honesty; big egos do not.'; }
      c.fans.hype = clamp(c.fans.hype - 4, 0, 100); c.board.trust.relationship = clamp(c.board.trust.relationship - 3, 0, 100); return 'Expectations lowered. The board is not pleased.';
    }
    case 'returnToPlay':
      if (!p || !p.injury) return 'He has already recovered.';
      if (choice === 'rush') { p.injury.playThroughRisk = true; return `${playerName(p)} is cleared to play at reduced level.`; }
      return 'He will complete his recovery.';
    case 'leaderMeeting':
      return '';
  }
  return '';
}

/** Expire decisions past their deadline using the default (or delegated recommendation). */
export function expireDecisions(w: World) {
  const now = absDay(w);
  for (const d of w.decisions) {
    if (d.resolved || d.deadlineDay > now) continue;
    // if staff made a recommendation they act on it; otherwise the default applies
    const pick = d.recommended ?? d.defaultOption;
    const msg = resolveDecision(w, d, pick, true);
    addNews(w, `Deadline passed: ${d.title}`, `No decision was taken, so ${d.recommended ? `${d.recommendedBy ?? 'staff'} chose` : 'the default applied'}: "${d.options.find((o) => o.id === pick)?.label}". ${msg}`, { tags: ['club'], clubIds: w.user.clubId != null ? [w.user.clubId] : [] });
  }
  // keep history short
  const unresolved = w.decisions.filter((d) => !d.resolved);
  const resolved = w.decisions.filter((d) => d.resolved).slice(-60);
  w.decisions = [...resolved, ...unresolved];
}

export function academyCount(w: World, c: Club) {
  return academy(w, c.id).length;
}

export { ROLE_MINUTES, isUser };
