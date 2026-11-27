import type { World } from './types';
import { absDay } from './types';
import { userClub, roster, playerName, fmtMoney, club as getClub, academy } from './world';
import { payroll, cashForecast90 } from './finance';
import { buildCalendar, transferWindowOpen } from './calendar';
import { registrationCheck } from './market';
import { licenceCheck } from './season';
import { SPONSOR_SLOTS } from './types';
import { SLOT_INFO } from './economy';

export interface DigestItem {
  id: string;
  title: string;
  detail: string;
  urgency: number; // 0-3
  impact: number; // 0-3
  deadline: number | null; // abs day
  owner: string; // who is responsible / recommended owner
  link: string; // route
  /** Short verb phrase for the button that fixes it ("Renew contract"). */
  action?: string;
  decisionId?: number;
  tone: 'alert' | 'warn' | 'info' | 'good';
}

export function buildDigest(w: World): DigestItem[] {
  const c = userClub(w);
  const items: DigestItem[] = [];
  if (!c) {
    items.push({ id: 'unemployed', title: 'You are out of work', detail: 'Advance time to receive job offers. Clubs consider your executive reputation.', urgency: 2, impact: 3, deadline: null, owner: 'You', link: '/today', tone: 'warn' });
    for (const d of w.decisions.filter((x) => !x.resolved)) items.push({ id: `d${d.id}`, title: d.title, detail: d.body, urgency: d.urgency, impact: d.impact, deadline: d.deadlineDay, owner: 'You', link: '/today', decisionId: d.id, tone: 'info' });
    return items;
  }
  const now = absDay(w);
  const cal = buildCalendar(w.season);
  for (const d of w.decisions.filter((x) => !x.resolved)) {
    items.push({ id: `d${d.id}`, title: d.title, detail: d.body, urgency: d.urgency + (d.deadlineDay - now <= 2 ? 1 : 0), impact: d.impact, deadline: d.deadlineDay, owner: d.recommendedBy ?? 'You', link: '/today', decisionId: d.id, tone: d.urgency >= 2 ? 'warn' : 'info' });
  }
  // finances
  if (c.finances.cash < 0) items.push({ id: 'cash', title: `Negative cash: ${fmtMoney(c.finances.cash)}`, detail: 'Overdraft interest is accruing and the board is losing trust. Sell a player, cut costs, take a loan or ask the owner for funds.', urgency: 3, impact: 3, deadline: null, owner: 'You', link: '/club/finance', action: 'Open finance', tone: 'alert' });
  else {
    const fc = cashForecast90(w, c);
    const low = Math.min(...fc.map((x) => x.cash));
    if (low < 0) items.push({ id: 'forecast', title: 'Cash forecast turns negative within 90 days', detail: `Projected low point: ${fmtMoney(low)}.`, urgency: 2, impact: 2, deadline: null, owner: 'Finance', link: '/club/finance', action: 'Check the forecast', tone: 'warn' });
  }
  const pr = payroll(w, c);
  if (pr > c.finances.budget.payroll * 1.02) items.push({ id: 'payroll', title: `Payroll over budget by ${fmtMoney(pr - c.finances.budget.payroll)}`, detail: 'The board measures you against the approved payroll. Overspending erodes financial trust.', urgency: 2, impact: 2, deadline: null, owner: 'You', link: '/club/contracts', action: 'Review payroll', tone: 'warn' });
  // board
  if (c.board.ultimatum) items.push({ id: 'ultimatum', title: 'Board ultimatum', detail: `Show progress: ${c.board.ultimatum.objective}.`, urgency: 3, impact: 3, deadline: c.board.ultimatum.day, owner: 'You', link: '/club/board', action: 'See objectives', tone: 'alert' });
  else if (c.board.overall < 40 && w.user.role === 'gm') items.push({ id: 'board', title: `Board confidence low (${c.board.overall}/100)`, detail: 'Results, finances and fan mood all feed the board\'s view.', urgency: 2, impact: 3, deadline: null, owner: 'You', link: '/club/board', action: 'Open board', tone: 'warn' });
  // roster legality
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const squad = roster(w, c.id);
  if (rules) {
    if (squad.length < rules.rosterMin) items.push({ id: 'rostermin', title: `Only ${squad.length} registered players (minimum ${rules.rosterMin})`, detail: 'Sign free agents or promote academy players before the next game.', urgency: 3, impact: 3, deadline: null, owner: 'Sporting director', link: '/team/market', action: 'Sign players', tone: 'alert' });
    const nonEU = squad.filter((p) => p.region === 'NONEU').length;
    if (nonEU > rules.maxNonEU) items.push({ id: 'noneu', title: `Non-EU quota exceeded (${nonEU}/${rules.maxNonEU})`, detail: 'The league will not accept further registrations until resolved.', urgency: 2, impact: 2, deadline: null, owner: 'Sporting director', link: '/team/players', action: 'Review squad', tone: 'warn' });
    const hg = squad.filter((p) => p.homegrown).length;
    if (squad.length - hg > rules.rosterMax - rules.minHomegrown) items.push({ id: 'hg', title: `Homegrown quota at risk (${hg} homegrown)`, detail: `At least ${rules.minHomegrown} homegrown players are needed in a full roster.`, urgency: 1, impact: 2, deadline: null, owner: 'Sporting director', link: '/team/players', action: 'Review squad', tone: 'warn' });
  }
  // injuries
  const inj = squad.filter((p) => p.injury);
  if (inj.length) items.push({ id: 'inj', title: `${inj.length} injured`, detail: inj.map((p) => `${playerName(p)} (${p.injury!.type}, ${p.injury!.daysOut}d)`).join(', '), urgency: inj.some((p) => p.ovr >= 60) ? 2 : 1, impact: 1, deadline: null, owner: 'Medical lead', link: '/team/medical', action: 'Medical room', tone: 'info' });
  // morale
  const unhappy = squad.filter((p) => p.morale < 40);
  if (unhappy.length) items.push({ id: 'morale', title: `${unhappy.length} unhappy player${unhappy.length > 1 ? 's' : ''}`, detail: unhappy.map((p) => playerName(p)).join(', ') + ' — check roles and minutes.', urgency: 1, impact: 2, deadline: null, owner: 'Head coach', link: '/team/players', action: 'Talk to players', tone: 'warn' });
  // contracts
  const expiring = squad.filter((p) => p.contract && !p.contract.youth && p.contract.expires === w.season);
  if (expiring.length && (w.day > cal.winterWindowOpen || expiring.some((p) => p.ovr >= Math.max(...squad.map((x) => x.ovr)) - 3))) {
    const key = [...expiring].sort((a, b) => b.ovr - a.ovr)[0];
    const many = expiring.length > 1;
    items.push({ id: 'exp', title: many ? `${expiring.length} contracts expire in June` : `${playerName(key)}'s contract expires in June`, detail: `${expiring.map((p) => `${playerName(p)} (${p.ovr})`).join(', ')}. Renew before rivals approach them.`, urgency: w.day > cal.leagueRoundDays[25] ? 2 : 1, impact: key.ovr >= 55 ? 3 : 2, deadline: null, owner: 'Sporting director', link: `/player/${key.id}?do=renew`, action: `Renew ${key.lastName}`, tone: key.ovr >= 55 ? 'warn' : 'info' });
  }
  // window
  if (transferWindowOpen(w.season, w.day)) {
    const close = w.day <= cal.summerWindowClose ? cal.summerWindowClose : w.day <= cal.winterWindowClose ? cal.winterWindowClose : null;
    if (close != null && close - w.day <= 14) items.push({ id: 'window', title: `Transfer window closes in ${close - w.day} days`, detail: 'Transfers need the window open; free agents can be signed until the registration deadline.', urgency: 2, impact: 1, deadline: now + (close - w.day), owner: 'Sporting director', link: '/team/market', action: 'Open market', tone: 'warn' });
  }
  // commercial
  if (w.tvOffers.length) items.push({ id: 'tv', title: `${w.tvOffers.length} media-rights offers waiting`, detail: 'Choose a broadcaster: cash now vs reach and digital growth.', urgency: 2, impact: 2, deadline: w.tvOffers[0].expiresDay, owner: 'Commercial director', link: '/club/commercial/media', action: 'Choose broadcaster', tone: 'info' });
  const empty = SPONSOR_SLOTS.filter((s) => !c.sponsors.some((x) => x.slot === s) && (s !== 'naming' || c.arena.owned));
  if (empty.length >= 6) items.push({ id: 'sponsors', title: `${empty.length} sponsorship slots empty`, detail: empty.map((s) => SLOT_INFO[s].label).join(', ') + '. Offers arrive weekly; a better commercial director attracts more.', urgency: 0, impact: 1, deadline: null, owner: 'Commercial director', link: '/club/commercial', action: 'Find partners', tone: 'info' });
  if (c.shop && c.shop.policy.mode === 'manual' && !c.shop.orders.some((o) => o.status === 'ordered') && Object.values(c.shop.stock).every((st) => Object.values(st).every((b) => !b || b.units <= 0))) {
    items.push({ id: 'shop-empty', title: 'Your club store has nothing to sell', detail: 'Order jerseys, scarves, caps and keychains. Bigger runs cost less per unit; delivery takes 8 to 28 days.', urgency: 1, impact: 1, deadline: null, owner: 'Commercial director', link: '/business/merchandise', action: 'Order stock', tone: 'warn' });
  }
  // promotion readiness
  if (c.leagueId === 'ORO' || c.leagueId === 'PLATA') {
    const up = c.leagueId === 'ORO' ? 'ELITE' : 'ORO';
    const lic = licenceCheck(w, c, up);
    if (!lic.ok && true) items.push({ id: 'licence', title: `Not licensed for the ${w.rules.leagues[up].name}`, detail: `If you win promotion: ${lic.reasons.join(' ')}`, urgency: w.day > cal.leagueRoundDays[22] ? 3 : 1, impact: 3, deadline: null, owner: 'You', link: '/club/licence', action: 'Check promotion licence', tone: 'warn' });
  }
  if (c.promotedSeason === w.season && (w.settings.difficulty === 'relaxed' || w.settings.difficulty === 'standard') && c.payrollBridge?.season !== w.season && c.leagueId !== 'PLATA') items.push({ id: 'bridge', title: 'Promotion payroll bridge available', detail: 'The league can advance part of your bigger media income to strengthen the squad.', urgency: 1, impact: 2, deadline: null, owner: 'Finance', link: '/club/licence', action: 'See the advance', tone: 'info' });
  // preseason planning (summer only)
  if (w.day < cal.leagueRoundDays[0] - 14) {
    const hasCamp = c.camp && c.camp.season === w.season;
    const friendlies = w.fixtures.filter((f) => f.comp === 'friendly' && f.compId === `FRIENDLY-${w.season}` && !f.cancelled && (f.homeId === c.id || f.awayId === c.id)).length;
    if (!hasCamp || friendlies < 2) items.push({ id: 'preseason', title: hasCamp ? `Only ${friendlies} friendlies before the season` : 'No summer training camp booked', detail: 'Friendlies and a camp build cohesion and match shape before the league starts.', urgency: 0, impact: 1, deadline: null, owner: 'Head coach', link: '/team/preseason', action: 'Plan preseason', tone: 'info' });
  }
  // academy
  const ready = academy(w, c.id).filter((p) => p.ovr >= (squad.sort((a, b) => a.ovr - b.ovr)[0]?.ovr ?? 99) && registrationCheck(w, c, p).ok);
  if (ready.length) items.push({ id: 'academy', title: `${ready.length} academy player${ready.length > 1 ? 's' : ''} ready for the first team`, detail: ready.map((p) => playerName(p)).join(', '), urgency: 0, impact: 1, deadline: null, owner: 'Academy director', link: '/team/academy', action: 'Open academy', tone: 'good' });
  // staff vacancies
  const vacant = (['headCoach', 'medicalLead', 'scoutDirector', 'commercialDirector'] as const).filter((r) => c.staff[r] == null);
  if (vacant.length) items.push({ id: 'vacant', title: `${vacant.length} key staff post${vacant.length > 1 ? 's' : ''} vacant`, detail: 'Vacant posts perform at a very low level. Hire in Team → Staff.', urgency: vacant.includes('headCoach') ? 3 : 1, impact: 2, deadline: null, owner: 'You', link: '/team/staff', action: 'Hire staff', tone: 'warn' });
  // negotiations open
  for (const n of w.user.negotiations.filter((x) => x.status === 'open')) {
    const p = w.players.find((x) => x.id === n.playerId);
    if (p) items.push({ id: `neg${n.playerId}`, title: `Negotiation open: ${playerName(p)}`, detail: n.lastAsk ? `Last ask: ${fmtMoney(n.lastAsk.salary)}/yr, ${n.lastAsk.years} years.` : 'Awaiting your offer.', urgency: 1, impact: 1, deadline: null, owner: 'You', link: `/player/${p.id}`, action: 'Continue talks', tone: 'info' });
  }
  items.sort((a, b) => b.urgency * 2 + b.impact - (a.urgency * 2 + a.impact));
  void getClub;
  return items;
}

/** Club warnings for Today: digest items that are not decisions, most serious first. */
export function clubWarnings(w: World): DigestItem[] {
  const rank = { alert: 0, warn: 1, info: 2, good: 3 } as const;
  return buildDigest(w).filter((x) => !x.decisionId && x.id !== 'unemployed').sort((a, b) => rank[a.tone] - rank[b.tone] || b.urgency * 2 + b.impact - (a.urgency * 2 + a.impact));
}
