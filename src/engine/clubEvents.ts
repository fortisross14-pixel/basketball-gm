// Club events you plan in the calendar: team bonding, fan activities, sponsor activations and
// board meetings. Each one pleases a stakeholder (players, fans, sponsors, owner) or earns money,
// and some carry a cost in fatigue or a small risk. Paid and applied on the day itself.
import type { Club, EventKind, PlannedEvent, World } from './types';
import { addNews, book, fmtMoney, rng, roster, tierOf, userClub } from './world';
import { capacity } from './arena';
import { clamp } from './rng';
import { fmtDate } from './calendar';
import { boardNote, fanReaction } from './career';

export interface EventOption {
  id: string;
  kind: EventKind;
  label: string;
  desc: string;
  baseCost: number; // at a Primera FEB club; scaled by tier
  pleases: string; // stakeholder shown in the UI
  effects: string[]; // plain-language preview
  risk?: string;
}

export const EVENT_KINDS: { id: EventKind; label: string; desc: string }[] = [
  { id: 'team', label: 'Team event', desc: 'Bond the squad away from the court: players get happier and play better together.' },
  { id: 'fans', label: 'Fan event', desc: 'Meet the supporters: fan mood and the local fanbase grow, the store sells more.' },
  { id: 'sponsor', label: 'Sponsor event', desc: 'Activate a partner: extra money from the deal and a happier sponsor at renewal time.' },
  { id: 'board', label: 'Owner & board', desc: 'Manage upwards: the owner and the board trust you more.' },
];

export const EVENT_OPTIONS: EventOption[] = [
  { id: 'dinner', kind: 'team', label: 'Team dinner at a restaurant', desc: 'Players, coaches and staff around one table.', baseCost: 1800, pleases: 'Players', effects: ['Player morale +6', 'Team cohesion +3'] },
  { id: 'party', kind: 'team', label: 'Team party', desc: 'A night out to celebrate or blow off steam.', baseCost: 3500, pleases: 'Players', effects: ['Player morale +10', 'Team cohesion +2', 'Players a bit tired the next days'], risk: '1 in 4: photos leak, fans and owner unhappy' },
  { id: 'teambuilding', kind: 'team', label: 'Team-building day', desc: 'Paintball, escape room or a day at the coast with the whole squad.', baseCost: 4000, pleases: 'Players & coach', effects: ['Team cohesion +6', 'Player morale +3'] },
  { id: 'family', kind: 'team', label: 'Family day at the arena', desc: 'Partners and kids on court, a barbecue in the concourse.', baseCost: 2500, pleases: 'Players & fans', effects: ['Player morale +4', 'Team cohesion +2', 'Fan mood +1'] },
  { id: 'signing', kind: 'fans', label: 'Autograph session at the team store', desc: 'Two hours of signatures and photos with your best players.', baseCost: 1000, pleases: 'Fans', effects: ['Fan mood +3', 'Extra store sales', 'Players slightly tired'] },
  { id: 'openTraining', kind: 'fans', label: 'Open training session', desc: 'Doors open: supporters watch practice for free.', baseCost: 600, pleases: 'Fans', effects: ['Fan mood +3', 'Local fans +1%'] },
  { id: 'community', kind: 'fans', label: 'School and hospital visits', desc: 'Players visit schools and the children\'s hospital.', baseCost: 900, pleases: 'Fans & media', effects: ['Fan mood +3', 'Local fans +1.5%', 'Media trust +3'] },
  { id: 'fanNight', kind: 'fans', label: 'Fan night with Q&A', desc: 'Season-ticket holders meet the squad and the coach.', baseCost: 2200, pleases: 'Fans', effects: ['Fan mood +5', 'Supporter loyalty +2', 'Some ticket and food income'] },
  { id: 'shoot', kind: 'sponsor', label: 'Photo shoot and ad campaign', desc: 'Players star in the partner\'s next campaign.', baseCost: 0, pleases: 'Sponsor', effects: ['Activation fee: 4% of the yearly deal', 'Brand fit +4', 'Player morale −2'] },
  { id: 'hospitality', kind: 'sponsor', label: 'Hospitality dinner with executives', desc: 'Their management team at a VIP dinner with you and two captains.', baseCost: 2500, pleases: 'Sponsor', effects: ['Activation fee: 3% of the yearly deal', 'Brand fit +8 (better renewals)'] },
  { id: 'launch', kind: 'sponsor', label: 'Product launch at the arena', desc: 'The partner launches a product on your court at half-time.', baseCost: 1500, pleases: 'Sponsor', effects: ['Activation fee: 6% of the yearly deal', 'Brand fit +4', 'Fans like it if the brand fits'] },
  { id: 'storeVisit', kind: 'sponsor', label: 'Players visit the partner\'s stores', desc: 'Meet-and-greets at the sponsor\'s shops around the region.', baseCost: 0, pleases: 'Sponsor', effects: ['Activation fee: 5% of the yearly deal', 'Brand fit +3', 'Players tired'] },
  { id: 'ownerDinner', kind: 'board', label: 'Private dinner with the owner', desc: 'Talk plans, worries and ambitions over dinner.', baseCost: 1200, pleases: 'Owner', effects: ['Relationship with the owner +6'] },
  { id: 'presentation', kind: 'board', label: 'Strategy presentation to the board', desc: 'Show them the numbers and the plan for the season.', baseCost: 400, pleases: 'Board', effects: ['Board trust in your promises +5', 'Relationship +2'] },
  { id: 'gala', kind: 'board', label: 'Season gala for partners and VIPs', desc: 'Black tie at the arena: sponsors, politicians, former players.', baseCost: 12000, pleases: 'Owner, sponsors & city', effects: ['Relationship with the owner +4', 'Every sponsor: brand fit +3', 'Sponsors chip in 2% of their deals', 'Fan mood +1'] },
];

const TIER_SCALE: Record<number, number> = { 0: 3, 1: 2.5, 2: 1, 3: 0.6 };

export function eventCost(w: World, c: Club, o: EventOption): number {
  return Math.round((o.baseCost * (TIER_SCALE[tierOf(w, c)] ?? 1)) / 100) * 100;
}

/** Why an event can't go on that day, or null. */
export function eventBlocked(w: World, c: Club, day: number, kind?: EventKind, sponsorId?: number): string | null {
  if (day <= w.day) return 'Pick a future day.';
  const game = w.fixtures.find((f) => !f.cancelled && !f.played && f.day === day && (f.homeId === c.id || f.awayId === c.id));
  if (game) return `You play on ${fmtDate(w.season, day)} (${game.label}).`;
  if (c.camp && c.camp.season === w.season && !c.camp.done && day >= c.camp.startDay && day <= c.camp.endDay) return 'The squad is away at the training camp.';
  const planned = (w.user.events ?? []).filter((e) => e.status === 'planned' && e.season === w.season);
  if (planned.some((e) => e.day === day)) return 'There is already an event that day.';
  if (planned.filter((e) => Math.abs(e.day - day) < 7).length >= 2) return 'At most two events in any week: players need rest.';
  if (kind === 'sponsor' && sponsorId != null && (w.user.events ?? []).some((e) => e.sponsorId === sponsorId && e.status !== 'cancelled' && e.season === w.season && Math.abs(e.day - day) < 45)) return 'This partner had an event recently: leave six weeks between activations.';
  return null;
}

export function planEvent(w: World, optionId: string, day: number, sponsorId?: number): { ok: boolean; message: string } {
  const c = userClub(w);
  if (!c) return { ok: false, message: 'You need a club.' };
  const o = EVENT_OPTIONS.find((x) => x.id === optionId);
  if (!o) return { ok: false, message: 'Unknown event.' };
  if (o.kind === 'sponsor' && !c.sponsors.some((s) => s.id === sponsorId)) return { ok: false, message: 'Pick one of your current sponsors.' };
  const why = eventBlocked(w, c, day, o.kind, sponsorId);
  if (why) return { ok: false, message: why };
  const cost = eventCost(w, c, o);
  const ev: PlannedEvent = { id: w.nextId++, kind: o.kind, option: o.id, day, season: w.season, sponsorId, cost, status: 'planned' };
  (w.user.events ??= []).push(ev);
  const brand = sponsorId != null ? c.sponsors.find((s) => s.id === sponsorId)?.brand : null;
  return { ok: true, message: `${o.label}${brand ? ` with ${brand}` : ''} planned for ${fmtDate(w.season, day)}${cost ? ` (${fmtMoney(cost)}, paid on the day)` : ''}.` };
}

export function cancelEvent(w: World, id: number) {
  const e = (w.user.events ?? []).find((x) => x.id === id);
  if (e && e.status === 'planned') e.status = 'cancelled';
}

export function eventsOn(w: World, day: number): PlannedEvent[] {
  return (w.user.events ?? []).filter((e) => e.season === w.season && e.day === day && e.status !== 'cancelled');
}

export function eventLabel(e: PlannedEvent): string {
  return EVENT_OPTIONS.find((o) => o.id === e.option)?.label ?? 'Event';
}

/** Daily: run today's events. */
export function dailyEvents(w: World) {
  const c = userClub(w);
  if (!c || !w.user.events?.length) return;
  for (const e of w.user.events) {
    if (e.status !== 'planned' || e.season !== w.season || e.day !== w.day) continue;
    e.status = 'done';
    e.result = runEvent(w, c, e);
    addNews(w, eventLabel(e), e.result, { tags: ['club'], clubIds: [c.id] });
  }
  if (w.user.events.length > 60) w.user.events = w.user.events.filter((e) => e.season >= w.season - 1);
}

function runEvent(w: World, c: Club, e: PlannedEvent): string {
  const r = rng(w);
  const squad = roster(w, c.id);
  const morale = (d: number) => { for (const p of squad) p.morale = clamp(p.morale + d, 0, 100); };
  const tire = (d: number) => { for (const p of squad) p.freshness = clamp(p.freshness - d, 0, 100); };
  const cohesion = (d: number) => { c.cohesion = clamp(c.cohesion + d, 0, 100); };
  const fans = (d: number, why: string) => { c.fans.sentiment = clamp(c.fans.sentiment + d, 0, 100); fanReaction(w, d / 2, why); };
  const trust = c.board.trust;
  if (e.cost) book(w, c, 'other', -e.cost);
  const deal = e.sponsorId != null ? c.sponsors.find((s) => s.id === e.sponsorId) : undefined;
  const fee = (pct: number) => { if (!deal) return 0; const v = Math.round((deal.annual * pct) / 100) * 100; if (v) book(w, c, 'sponsors', v); return v; };
  switch (e.option) {
    case 'dinner': morale(6); cohesion(3); return 'Long table, good food: the squad is closer (morale +6, cohesion +3).';
    case 'party': {
      morale(10); cohesion(2); tire(4);
      if (r.chance(0.25)) {
        fans(-3, 'Party photos leaked'); trust.relationship = clamp(trust.relationship - 4, 0, 100); boardNote(w, -2, 'Embarrassing party photos');
        return 'Great night for the players (morale +10), but photos leaked on social media: fans and the owner are not amused.';
      }
      return 'A night to remember: morale +10, cohesion +2. A few tired legs at practice.';
    }
    case 'teambuilding': cohesion(6); morale(3); return 'The squad came back as a group: cohesion +6, morale +3.';
    case 'family': morale(4); cohesion(2); fans(1, 'Family day at the arena'); return 'Kids on court and a barbecue: morale +4, cohesion +2, fans liked the photos.';
    case 'signing': {
      fans(3, 'Autograph session'); tire(1);
      const extra = Math.round((c.fans.local * 0.004 * (tierOf(w, c) <= 1 ? 30 : 18)) / 100) * 100;
      if (extra) book(w, c, 'merch', extra);
      return `Queues outside the store: fan mood +3 and ${fmtMoney(extra)} in extra sales.`;
    }
    case 'openTraining': fans(3, 'Open training'); c.fans.local = Math.round(c.fans.local * 1.01); return 'Families in the stands at practice: fan mood +3, local fans +1%.';
    case 'community': fans(3, 'Community visits'); c.fans.local = Math.round(c.fans.local * 1.015); trust.media = clamp(trust.media + 3, 0, 100); return 'Warm coverage of the visits: fan mood +3, local fans up, media trust +3.';
    case 'fanNight': {
      fans(5, 'Fan night'); c.fans.loyalty = clamp(c.fans.loyalty + 2, 0, 100);
      const inc = Math.round((capacity(c) * 0.05 * 12) / 100) * 100;
      book(w, c, 'tickets', inc);
      return `Season-ticket holders met the squad: fan mood +5, loyalty +2, ${fmtMoney(inc)} from tickets and food.`;
    }
    case 'shoot': { const v = fee(4); if (deal) deal.fit = clamp(deal.fit + 4, 0, 100); morale(-2); return `${deal?.brand ?? 'The partner'} paid ${fmtMoney(v)} for the campaign. Some players found it a chore.`; }
    case 'hospitality': { const v = fee(3); if (deal) deal.fit = clamp(deal.fit + 8, 0, 100); return `${deal?.brand ?? 'The partner'}'s executives loved the evening: ${fmtMoney(v)} activation fee, much better odds at renewal.`; }
    case 'launch': {
      const v = fee(6); if (deal) deal.fit = clamp(deal.fit + 4, 0, 100);
      if (deal && deal.risk >= 50) fans(-2, `Fans booed the ${deal.brand} launch`); else fans(1, 'Half-time product launch');
      return `${deal?.brand ?? 'The partner'} launched on your court: ${fmtMoney(v)} activation fee.${deal && deal.risk >= 50 ? ' Supporters booed the brand.' : ''}`;
    }
    case 'storeVisit': { const v = fee(5); if (deal) deal.fit = clamp(deal.fit + 3, 0, 100); tire(3); return `Players toured ${deal?.brand ?? 'the partner'}'s stores: ${fmtMoney(v)} fee, tired legs.`; }
    case 'ownerDinner': trust.relationship = clamp(trust.relationship + 6, 0, 100); boardNote(w, 2, 'Dinner with the owner'); return `${c.board.owner} enjoyed the evening: relationship +6.`;
    case 'presentation': trust.promises = clamp(trust.promises + 5, 0, 100); trust.relationship = clamp(trust.relationship + 2, 0, 100); boardNote(w, 1, 'Strategy presentation'); return 'The board liked the plan: trust in your promises +5.';
    case 'gala': {
      trust.relationship = clamp(trust.relationship + 4, 0, 100);
      let v = 0;
      for (const s of c.sponsors) { s.fit = clamp(s.fit + 3, 0, 100); v += Math.round((s.annual * 0.02) / 100) * 100; }
      if (v) book(w, c, 'sponsors', v);
      fans(1, 'Season gala');
      boardNote(w, 2, 'Season gala');
      return `A night for the city: owner relationship +4, sponsors chipped in ${fmtMoney(v)} and like the club more.`;
    }
  }
  return 'Done.';
}
