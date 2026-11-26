import type { Campaign, CampaignKind, Club, SponsorOffer, SponsorSlot, TvOffer, World, Decision } from './types';
import { SEAT_ZONES, SPONSOR_SLOTS, absDay } from './types';
import { SPONSOR_BRANDS, BROADCASTERS } from './data/names';
import { addNews, book, fmtMoney, hold, isUser, logDelegation, nextId, rng, staffRating, tierOf, playerName, roster } from './world';
import { BROADCASTER_PROFILE, SLOT_INFO, inventoryUnits, localTvBenchmark, merchDemandUnits, merchUnitCost, seasonTicketTarget, sponsorBenchmark, suiteDemand, currentWinPct, refPrice, MERCH_LINES } from './economy';
import { clamp } from './rng';
import { buildCalendar, monthOf } from './calendar';
import { weeklyShop } from './shop';
import { recordArenaMerch } from './facilities';

// ---------------------------------------------------------------------------
// Sponsors
// ---------------------------------------------------------------------------
export function generateSponsorOffer(w: World, c: Club, slot: SponsorSlot): SponsorOffer {
  const r = rng(w);
  const used = new Set(c.sponsors.map((s) => s.brand));
  const pool = SPONSOR_BRANDS.filter((b) => !used.has(b.brand));
  const b = r.pick(pool.length ? pool : SPONSOR_BRANDS);
  const comm = staffRating(w, c, 'commercialDirector');
  const quality = (0.75 + comm / 250 + (b.risk > 50 ? 0.25 : 0)) * (isUser(w, c.id) && w.user.background === 'business' ? 1.08 : 1); // risky brands pay more
  const annual = Math.round(sponsorBenchmark(w, c, slot) * quality * r.float(0.85, 1.15) / 1000) * 1000;
  const years = r.int(1, 4);
  return {
    id: nextId(w), slot, brand: b.brand, category: b.category, annual,
    expires: w.season + years - 1 + (w.day > 300 ? 1 : 0),
    promoBonus: tierOf(w, c) > 1 ? Math.round(annual * r.float(0.2, 0.5) / 1000) * 1000 : 0,
    titleBonus: Math.round(annual * r.float(0.1, 0.3) / 1000) * 1000,
    fit: Math.round(clamp(r.normal(60, 18) - b.risk * 0.3, 5, 98)),
    risk: b.risk,
    signedSeason: w.season,
    expiresDay: absDay(w) + r.int(10, 24),
  };
}

export function sponsorDecision(w: World, c: Club, o: SponsorOffer): Decision {
  const current = c.sponsors.find((s) => s.slot === o.slot);
  return {
    id: nextId(w), kind: 'sponsorOffer',
    title: `${o.brand} offer ${fmtMoney(o.annual)}/yr for ${SLOT_INFO[o.slot].label.toLowerCase()}`,
    body: `${o.category} brand · ${o.expires - w.season + 1}-year deal · brand fit ${o.fit}/100 · reputational risk ${o.risk}/100.${o.promoBonus ? ` Promotion bonus ${fmtMoney(o.promoBonus)}.` : ''}${current ? ` Replaces ${current.brand} (${fmtMoney(current.annual)}/yr).` : ' The slot is currently empty.'}${o.risk >= 50 ? ' Supporters may react badly to this category.' : ''}`,
    createdDay: absDay(w), deadlineDay: o.expiresDay, urgency: 1, impact: o.annual > 100000 ? 2 : 1, dept: 'sponsors',
    options: [{ id: 'accept', label: 'Sign the deal', tone: 'good' }, { id: 'counter', label: 'Ask for +15%', tone: 'risky' }, { id: 'reject', label: 'Decline', tone: 'neutral' }],
    recommended: recommendSponsor(w, c, o),
    recommendedBy: 'Commercial director',
    payload: { offerId: o.id, clubId: c.id },
    defaultOption: 'reject', resolved: false,
  };
}

function recommendSponsor(w: World, c: Club, o: SponsorOffer): string {
  const pol = w.user.delegation.sponsors;
  const bench = sponsorBenchmark(w, c, o.slot);
  const current = c.sponsors.find((s) => s.slot === o.slot);
  if (pol.excludedCategories?.includes(o.category)) return 'reject';
  if (current && current.annual >= o.annual) return 'reject';
  // don't crowd the kit: a new brand beyond what fans tolerate needs to be really worth it
  const sat = sponsorSaturation(c);
  if (!current && sat.count >= sat.comfortable && o.annual < bench * 1.6) return 'reject';
  return o.annual >= bench * (pol.sponsorFloor ?? 0.9) ? 'accept' : 'counter';
}

/**
 * Supporters tolerate a handful of partners; beyond that every extra brand
 * (and especially risky categories) erodes sentiment week by week.
 */
export function sponsorSaturation(c: Club): { count: number; comfortable: number; penalty: number; label: string } {
  const comfortable = 4 + Math.round(c.fans.loyalty / 40); // 4-6
  const count = c.sponsors.length;
  const risky = c.sponsors.filter((s) => s.risk >= 50).length;
  const penalty = Math.max(0, count - comfortable) * 3 + risky * 2;
  const label = penalty === 0 ? (count >= comfortable ? 'At the limit fans accept' : 'Fans are comfortable') : penalty < 6 ? 'Fans grumble about commercialisation' : 'Fans feel the club has sold out';
  return { count, comfortable, penalty, label };
}

export function signSponsor(w: World, c: Club, o: SponsorOffer) {
  c.sponsors = c.sponsors.filter((s) => s.slot !== o.slot);
  const { expiresDay: _e, ...deal } = o;
  void _e;
  c.sponsors.push({ ...deal, signedSeason: w.season });
  if (o.risk >= 50) {
    c.fans.sentiment = clamp(c.fans.sentiment - o.risk / 12, 0, 100);
    if (isUser(w, c.id)) addNews(w, `Supporters unhappy with ${o.brand} deal`, `Fan groups criticise the ${o.category.toLowerCase()} sponsorship.`, { tags: ['fans'], clubIds: [c.id] });
  }
  if (isUser(w, c.id)) addNews(w, `${c.name} sign ${o.brand} as ${SLOT_INFO[o.slot].label.toLowerCase()}`, `${fmtMoney(o.annual)} per year until ${o.expires + 1}.`, { tags: ['finance'], clubIds: [c.id] });
}

export function resolveSponsorDecision(w: World, d: Decision, choice: string): string {
  const c = w.clubs.find((x) => x.id === d.payload.clubId)!;
  const offers = w.sponsorOffers[c.id] ?? [];
  const o = offers.find((x) => x.id === d.payload.offerId);
  if (!o) return 'The offer has lapsed.';
  w.sponsorOffers[c.id] = offers.filter((x) => x !== o);
  if (choice === 'accept') {
    signSponsor(w, c, o);
    return `Signed ${o.brand}: ${fmtMoney(o.annual)}/yr.`;
  }
  if (choice === 'counter') {
    const r = rng(w);
    const hardline = o.risk >= 50 || o.annual >= sponsorBenchmark(w, c, o.slot) * 1.05;
    if (!hardline && r.chance(0.4 + staffRating(w, c, 'commercialDirector') / 400)) {
      o.annual = Math.round(o.annual * 1.15 / 1000) * 1000;
      signSponsor(w, c, o);
      return `${o.brand} accept the counter: ${fmtMoney(o.annual)}/yr.`;
    }
    (c.sponsorLocks ??= {})[o.slot] = absDay(w) + 28;
    return `${o.brand} withdraw their offer${hardline ? ' — it was already at the top of their range' : ''}. Other brands will wait about four weeks before approaching that slot.`;
  }
  return `Declined ${o.brand}.`;
}

/** Weekly: offers for empty/expiring slots (user), auto-renew for AI. */
export function weeklySponsors(w: World, c: Club) {
  if (c.foreign) return;
  const r = rng(w);
  const user = isUser(w, c.id);
  if (!user) {
    // AI: fill empty slots at benchmark
    for (const slot of SPONSOR_SLOTS) {
      if (slot === 'naming' && !c.arena.owned) continue;
      if (!c.sponsors.find((s) => s.slot === slot) && r.chance(0.08)) {
        const o = generateSponsorOffer(w, c, slot);
        if (o.risk < 60) signSponsor(w, c, o);
      }
    }
    return;
  }
  const noise = w.settings.worldNoise === 'quiet' ? 0.6 : w.settings.worldNoise === 'handsOn' ? 1.4 : 1;
  const comm = staffRating(w, c, 'commercialDirector');
  const emptyCount = SPONSOR_SLOTS.filter((s) => !c.sponsors.find((x) => x.slot === s)).length;
  const p = (0.12 + comm / 600) * noise * (1 + emptyCount * 0.12);
  if (!r.chance(p)) return;
  const empty = SPONSOR_SLOTS.filter((s) => !c.sponsors.find((x) => x.slot === s) && (s !== 'naming' || c.arena.owned || tierOf(w, c) === 1));
  const expiring = c.sponsors.filter((s) => s.expires <= w.season).map((s) => s.slot);
  const locked = (s: SponsorSlot) => (c.sponsorLocks?.[s] ?? 0) > absDay(w);
  const pool = [...empty, ...expiring, ...(r.chance(0.3) ? SPONSOR_SLOTS : [])].filter((s) => !locked(s));
  if (!pool.length) return;
  const slot = r.pick(pool);
  const o = generateSponsorOffer(w, c, slot);
  (w.sponsorOffers[c.id] ??= []).push(o);
  const d = sponsorDecision(w, c, o);
  const pol = w.user.delegation.sponsors;
  if (pol.mode === 'policy' || pol.mode === 'notify' || pol.mode === 'full') {
    const rec = d.recommended!;
    if (pol.mode !== 'policy' || rec === 'accept' || rec === 'reject') {
      const msg = resolveSponsorDecision(w, d, rec);
      logDelegation(w, 'sponsors', 'Commercial director', msg, rec === 'accept' ? `Offer at or above ${Math.round((pol.sponsorFloor ?? 0.9) * 100)}% of the slot benchmark (${fmtMoney(sponsorBenchmark(w, c, slot))}).` : 'Below policy floor, excluded category or worse than the current partner.', rec === 'accept' ? `+${fmtMoney(o.annual)}/yr` : 'Slot kept for a better offer.');
      if (pol.mode === 'notify') addNews(w, 'Commercial director: sponsorship decision', msg, { tags: ['delegation', 'finance'], clubIds: [c.id] });
      return;
    }
  }
  w.decisions.push(d);
  hold(w, 'decision', d.title);
}

/** Season rollover: expire deals; AI renews. */
export function expireSponsors(w: World, c: Club) {
  const r = rng(w);
  const expired = c.sponsors.filter((s) => s.expires < w.season);
  c.sponsors = c.sponsors.filter((s) => s.expires >= w.season);
  if (!isUser(w, c.id)) {
    for (const s of expired) {
      if (r.chance(0.75)) c.sponsors.push({ ...s, annual: Math.round(sponsorBenchmark(w, c, s.slot) * r.float(0.85, 1.1) / 1000) * 1000, expires: w.season + r.int(0, 2), signedSeason: w.season });
    }
  } else if (expired.length) {
    addNews(w, `${expired.length} sponsorship deal${expired.length > 1 ? 's' : ''} expired`, `Empty slots: ${expired.map((s) => SLOT_INFO[s.slot].label).join(', ')}. Your commercial director will look for new partners.`, { tags: ['finance'], clubIds: [c.id], importance: 2 });
  }
}

// ---------------------------------------------------------------------------
// Television / streaming rights
// ---------------------------------------------------------------------------
export function generateTvOffers(w: World, c: Club): TvOffer[] {
  const r = rng(w);
  const bench = localTvBenchmark(w, c);
  const comm = staffRating(w, c, 'commercialDirector');
  const n = 2 + (comm > 60 ? 1 : 0) + (tierOf(w, c) === 1 ? 1 : 0);
  const picks = r.shuffle([...BROADCASTERS]).slice(0, n);
  return picks.map((b) => {
    const prof = BROADCASTER_PROFILE[b.kind];
    const years = r.int(2, 4);
    return {
      id: nextId(w), broadcaster: b.name, kind: b.kind,
      annual: Math.round(bench * prof.money * r.float(0.85, 1.15) * (0.85 + comm / 330) / 1000) * 1000,
      expires: w.season + years - 1,
      reach: prof.reach, digitalBoost: prof.digital, exclusivity: b.kind === 'payTV' || r.chance(0.3),
      expiresDay: absDay(w) + 30,
    };
  });
}

export function signTv(w: World, c: Club, o: TvOffer) {
  const { expiresDay: _e, ...deal } = o;
  void _e;
  c.tv = deal;
  w.tvOffers = w.tvOffers.filter((x) => x.id !== o.id);
  if (isUser(w, c.id)) {
    w.tvOffers = [];
    addNews(w, `${c.name} agree media deal with ${o.broadcaster}`, `${fmtMoney(o.annual)}/yr until ${o.expires + 1}. ${BROADCASTER_PROFILE[o.kind].desc}`, { tags: ['finance', 'media'], clubIds: [c.id], importance: 2 });
  }
}

export function tvMarketCheck(w: World, c: Club) {
  if (c.foreign) return;
  const needs = !c.tv || c.tv.expires < w.season;
  if (!needs) return;
  if (!isUser(w, c.id)) {
    const r = rng(w);
    const offers = generateTvOffers(w, c);
    if (offers.length && r.chance(0.7)) signTv(w, c, offers.sort((a, b) => b.annual - a.annual)[0]);
    else c.tv = null;
    return;
  }
  c.tv = null;
  if (!w.tvOffers.length) {
    w.tvOffers = generateTvOffers(w, c);
    addNews(w, 'Broadcasters bid for your local media rights', `${w.tvOffers.length} offers are on the table (Club → Commercial). They lapse in 30 days.`, { tags: ['finance', 'media'], clubIds: [c.id], importance: 2 });
    hold(w, 'decision', 'New TV / streaming rights offers.');
  }
}

// ---------------------------------------------------------------------------
// Marketing campaigns
// ---------------------------------------------------------------------------
export const CAMPAIGNS: Record<CampaignKind, { label: string; desc: string; weeks: number; costFactor: number }> = {
  community: { label: 'Community programme', desc: 'Neighbourhood events and school visits. Grows the local core and loyalty; improves municipal goodwill.', weeks: 8, costFactor: 0.6 },
  regionalAds: { label: 'Regional advertising', desc: 'Radio, billboards and regional press. Grows regional fans and attendance from outside the city.', weeks: 6, costFactor: 1.0 },
  social: { label: 'Social & digital content', desc: 'Behind-the-scenes content and highlights. Grows digital followers and the digital sponsor value.', weeks: 8, costFactor: 0.7 },
  seasonTicketDrive: { label: 'Season-ticket drive', desc: 'Summer campaign to convert fans into season-ticket holders (only before the deadline).', weeks: 6, costFactor: 0.9 },
  schoolClinics: { label: 'School clinics & camps', desc: 'Youth clinics: long-term local growth, small academy intake boost and grant goodwill.', weeks: 10, costFactor: 0.5 },
  internationalTour: { label: 'International pre-season tour', desc: 'A pre-season tour abroad: international fans and a match fee, but fatigue.', weeks: 2, costFactor: 3.0 },
  starPromo: { label: 'Star player promotion', desc: 'Build marketing around your best player: hype, national fans and merch demand.', weeks: 6, costFactor: 1.2 },
};

export function campaignWeeklyCost(w: World, c: Club, kind: CampaignKind): number {
  const t = tierOf(w, c);
  const base = t === 1 ? 9000 : t === 2 ? 2200 : 900;
  return Math.round(base * CAMPAIGNS[kind].costFactor * (0.8 + c.population / 4e6) / 100) * 100;
}

export function startCampaign(w: World, c: Club, kind: CampaignKind): { ok: boolean; message: string } {
  if (c.campaigns.some((x) => x.kind === kind)) return { ok: false, message: 'That campaign is already running.' };
  if (kind === 'seasonTicketDrive' && w.day > buildCalendar(w.season).seasonTicketDeadline) return { ok: false, message: 'Season-ticket sales are closed until next summer.' };
  if (kind === 'internationalTour' && w.day > 85) return { ok: false, message: 'Tours can only be organised during the off-season (before late September).' };
  const mkt = staffRating(w, c, 'marketingDirector');
  const camp: Campaign = { id: nextId(w), kind, weeksLeft: CAMPAIGNS[kind].weeks, weeklyCost: campaignWeeklyCost(w, c, kind), intensity: 0.6 + mkt / 125 };
  c.campaigns.push(camp);
  return { ok: true, message: `${CAMPAIGNS[kind].label} launched: ${fmtMoney(camp.weeklyCost)}/week for ${camp.weeksLeft} weeks.` };
}

export function stopCampaign(c: Club, id: number) {
  c.campaigns = c.campaigns.filter((x) => x.id !== id);
}

function weeklyCampaigns(w: World, c: Club) {
  const r = rng(w);
  for (const camp of [...c.campaigns]) {
    book(w, c, 'marketing', -camp.weeklyCost);
    const k = camp.intensity;
    const f = c.fans;
    switch (camp.kind) {
      case 'community': f.local *= 1 + 0.004 * k; f.loyalty = clamp(f.loyalty + 0.25 * k, 0, 100); f.sentiment = clamp(f.sentiment + 0.4 * k, 0, 100); break;
      case 'regionalAds': f.regional *= 1 + 0.008 * k; f.local *= 1 + 0.0015 * k; break;
      case 'social': f.digital *= 1 + 0.015 * k; f.national *= 1 + 0.002 * k; break;
      case 'seasonTicketDrive': f.loyalty = clamp(f.loyalty + 0.5 * k, 0, 100); f.hype = clamp(f.hype + 0.4 * k, 0, 100); break;
      case 'schoolClinics': f.local *= 1 + 0.0025 * k; f.loyalty = clamp(f.loyalty + 0.15 * k, 0, 100); break;
      case 'internationalTour':
        f.international *= 1 + 0.05 * k; f.digital *= 1 + 0.01 * k;
        if (camp.weeksLeft === 1) {
          const fee = Math.round(camp.weeklyCost * r.float(1.2, 2.2));
          book(w, c, 'other', fee);
          for (const p of roster(w, c.id)) p.freshness = Math.max(60, p.freshness - 10);
        }
        break;
      case 'starPromo': f.hype = clamp(f.hype + 0.8 * k, 0, 100); f.national *= 1 + 0.006 * k; break;
    }
    camp.weeksLeft--;
    if (camp.weeksLeft <= 0) c.campaigns = c.campaigns.filter((x) => x !== camp);
  }
}

/** Delegated marketing: keep sensible campaigns running within the weekly cap. */
function delegatedMarketing(w: World, c: Club) {
  const pol = w.user.delegation.marketing;
  if (pol.mode === 'manual' || pol.mode === 'recommend') return;
  const cap = pol.spendCap && pol.spendCap > 0 ? pol.spendCap : Math.round(c.finances.budget.marketing / 52);
  const running = c.campaigns.reduce((a, x) => a + x.weeklyCost, 0);
  const cal = buildCalendar(w.season);
  const want: CampaignKind[] = w.day <= cal.seasonTicketDeadline - 30 ? ['seasonTicketDrive', 'community', 'social'] : ['community', 'social', 'regionalAds', 'schoolClinics'];
  for (const k of want) {
    const cost = campaignWeeklyCost(w, c, k);
    if (running + cost > cap || c.campaigns.some((x) => x.kind === k)) continue;
    const res = startCampaign(w, c, k);
    if (res.ok) {
      logDelegation(w, 'marketing', 'Marketing director', res.message, `Within the weekly cap of ${fmtMoney(cap)}.`, CAMPAIGNS[k].desc);
      if (pol.mode === 'notify') addNews(w, 'Marketing director launches a campaign', res.message, { tags: ['delegation'], clubIds: [c.id] });
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Merchandise
// ---------------------------------------------------------------------------
export function placeMerchOrder(w: World, c: Club) {
  if (c.foreign) return;
  const units = inventoryUnits(w, c);
  const setup = c.merch.lines.reduce((a, l) => a + MERCH_LINES[l].setup, 0) * (tierOf(w, c) === 1 ? 1 : 0.4);
  const cost = Math.round(units * merchUnitCost(c) + setup);
  book(w, c, 'merchCost', -cost);
  c.merch.stockValue = Math.round(c.merch.stockValue * 0.5 + units * merchUnitCost(c)); // old stock written down 50%
  c.merch.orderedUnits = units;
}

const MERCH_SEASONALITY = [1.4, 0.8, 0.8, 0.9, 1.2, 0.7, 1.3, 1.3, 1.5, 1.0, 0.9, 2.2]; // by month Jan..Dec

function weeklyMerch(w: World, c: Club) {
  const demand = merchDemandUnits(w, c);
  const month = monthOf(w.season, w.day);
  const weekly = (demand / 52) * MERCH_SEASONALITY[month] * rng(w).float(0.85, 1.15);
  const stockUnits = c.merch.stockValue / Math.max(1, merchUnitCost(c));
  const sold = Math.max(0, Math.min(stockUnits, weekly));
  const revenue = sold * c.merch.jerseyPrice * 0.75; // product mix average
  book(w, c, 'merch', Math.round(revenue));
  recordArenaMerch(c, revenue, sold);
  c.merch.stockValue = Math.max(0, c.merch.stockValue - sold * merchUnitCost(c));
}

// ---------------------------------------------------------------------------
// Season tickets & suites
// ---------------------------------------------------------------------------
function weeklySeasonTickets(w: World, c: Club) {
  const cal = buildCalendar(w.season);
  if (w.day > cal.seasonTicketDeadline) return;
  const target = seasonTicketTarget(w, c);
  const drive = c.campaigns.some((x) => x.kind === 'seasonTicketDrive') ? 1.12 : 1;
  for (const z of SEAT_ZONES) {
    const goal = Math.min(c.arena.seats[z] * 0.85, Math.floor(target[z] * drive));
    const remaining = goal - c.ticketing.seasonSold[z];
    if (remaining <= 0) continue;
    const sell = Math.ceil(remaining * 0.22);
    c.ticketing.seasonSold[z] += sell;
    book(w, c, 'seasonTickets', sell * c.ticketing.seasonPrices[z]);
  }
}

export function closeSeasonTickets(w: World, c: Club) {
  const suites = suiteDemand(w, c);
  c.ticketing.suitesSold = suites;
  book(w, c, 'suites', suites * c.ticketing.suitePrice);
  if (isUser(w, c.id)) {
    const total = SEAT_ZONES.reduce((a, z) => a + c.ticketing.seasonSold[z], 0);
    addNews(w, `Season-ticket campaign closes: ${total.toLocaleString('en')} holders`, `${suites}/${c.arena.suites} suites sold at ${fmtMoney(c.ticketing.suitePrice)}.`, { tags: ['finance', 'fans'], clubIds: [c.id], importance: 2 });
  }
}

// ---------------------------------------------------------------------------
// Fans
// ---------------------------------------------------------------------------
function weeklyFans(w: World, c: Club) {
  const f = c.fans;
  const win = currentWinPct(w, c);
  const saturation = sponsorSaturation(c);
  const tvReach = c.tv?.reach ?? 20;
  const tvDigital = c.tv?.digitalBoost ?? 10;
  // pricing fairness: high prices erode sentiment
  // fairness is judged on the average AND the most expensive zone, so one gouged zone can't hide
  const ratios = SEAT_ZONES.map((z) => c.ticketing.prices[z] / Math.max(1, refPrice(w, c, z)));
  const priceRatio = (ratios.reduce((a, x) => a + x, 0) / 3) * 0.5 + Math.max(...ratios) * 0.5;
  const concPenalty = c.concessions.pricing === 'premium' ? -0.15 : c.concessions.pricing === 'value' ? 0.1 : 0;
  const dyn = c.ticketing.dynamicPricing && !c.ticketing.protectSeasonHolders ? -0.25 : c.ticketing.dynamicPricing ? -0.08 : 0;
  const sentTarget = clamp(35 + win * 45 + (f.hype - 50) / 4 - (priceRatio - 1) * 30 + concPenalty * 20 + (c.concessions.localSuppliers ? 3 : 0) - saturation.penalty, 0, 100);
  f.sentiment = clamp(f.sentiment + (sentTarget - f.sentiment) * 0.06 + dyn, 0, 100);
  f.hype = clamp(f.hype + (50 - f.hype) * 0.03, 0, 100);
  const growth = (win - 0.5) * 0.004 + (f.hype - 50) / 25000 + (f.sentiment - 55) / 30000;
  f.local = Math.max(200, f.local * (1 + growth));
  f.regional = Math.max(200, f.regional * (1 + growth * 1.2 + tvReach / 300000));
  f.national = Math.max(50, f.national * (1 + growth * 1.5 + tvReach / 120000 + (c.prestige - 50) / 200000));
  f.international = Math.max(10, f.international * (1 + growth + (tvReach > 60 ? 0.0006 : 0)));
  f.digital = Math.max(100, f.digital * (1 + growth + tvDigital / 100000));
  f.loyalty = clamp(f.loyalty + (f.sentiment - 55) / 1500, 0, 100);
}

/** Weekly commercial cycle for every club. */
export function weeklyCommercial(w: World, c: Club) {
  if (c.foreign) return;
  weeklySeasonTickets(w, c);
  if (isUser(w, c.id)) weeklyShop(w, c);
  else weeklyMerch(w, c);
  weeklyCampaigns(w, c);
  weeklyFans(w, c);
  weeklySponsors(w, c);
  if (isUser(w, c.id)) delegatedMarketing(w, c);
}

export function signaturePlayer(w: World, c: Club): string {
  const best = roster(w, c.id).sort((a, b) => b.ovr - a.ovr)[0];
  return best ? playerName(best) : '—';
}
