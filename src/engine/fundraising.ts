// Revenue drive: deals a small club can close on the spot to raise money,
// typically in pre-season to afford one or two signings. Each has a cost:
// sponsors crowd the shirt and the arena (fans dislike too many), upfront
// payments are discounted, and a one-season media deal sells future value.
import type { Club, SponsorSlot, World } from './types';
import { absDay } from './types';
import { SPONSOR_BRANDS, BROADCASTERS } from './data/names';
import { addNews, book, fmtMoney, nextId, rng } from './world';
import { estimateRevenue, localTvBenchmark, sponsorBenchmark, SLOT_INFO, BROADCASTER_PROFILE } from './economy';
import { signSponsor, signTv, sponsorSaturation } from './commercial';
import { buildCalendar, phaseOf } from './calendar';
import { fanReaction } from './career';
import { clamp } from './rng';

export type QuickDealKind = 'naming' | 'sleeve' | 'court' | 'localPartner' | 'mediaRights' | 'membership';

export interface QuickDealOption {
  id: string;
  label: string;
  detail: string;
  cashNow: number;
  annual: number;
  years: number;
}

export interface QuickDeal {
  kind: QuickDealKind;
  title: string;
  desc: string;
  available: boolean;
  reason?: string;
  options: QuickDealOption[];
  fanNote: string;
  slot?: SponsorSlot;
}

const r1k = (x: number) => Math.round(x / 1000) * 1000;

function seasonLeft(w: World): number {
  const cal = buildCalendar(w.season);
  const start = cal.leagueRoundDays[0];
  const end = cal.leagueRoundDays[cal.leagueRoundDays.length - 1];
  if (w.day <= start) return 1;
  return clamp((end - w.day) / (end - start), 0.1, 1);
}

function sponsorDeal(w: World, c: Club, slot: SponsorSlot, share: number, years: number, kind: QuickDealKind, title: string, desc: string, fanNote: string): QuickDeal {
  const est = estimateRevenue(w, c).total;
  const taken = c.sponsors.find((s) => s.slot === slot);
  let v = Math.max(sponsorBenchmark(w, c, slot), est * share);
  if (slot === 'naming' && !c.arena.owned) v *= 0.75; // the council (arena owner) takes a cut
  v = r1k(v);
  const sat = sponsorSaturation(c);
  const crowd = sat.count + 1 > sat.comfortable ? ` Fans already see ${sat.count} partners (comfortable: ${sat.comfortable}); one more erodes their mood every week.` : '';
  return {
    kind, title, desc, slot,
    available: !taken,
    reason: taken ? `Sold to ${taken.brand} until ${taken.expires + 1}.` : undefined,
    fanNote: fanNote + crowd,
    options: [
      { id: 'standard', label: `${years} seasons, paid monthly`, detail: `${fmtMoney(v)} a year`, cashNow: 0, annual: v, years },
      { id: 'upfront', label: `${years} seasons, half paid today`, detail: `${fmtMoney(r1k(v * years * 0.45))} now (10% discount), then ${fmtMoney(r1k(v / 2))} a year`, cashNow: r1k(v * years * 0.45), annual: r1k(v / 2), years },
    ],
  };
}

export function quickDeals(w: World, c: Club): QuickDeal[] {
  if (c.foreign) return [];
  const est = estimateRevenue(w, c).total;
  const used = c.quickDeals ?? {};
  const out: QuickDeal[] = [];
  out.push(sponsorDeal(w, c, 'naming', 0.085, 4, 'naming', 'Arena naming rights', `Put a partner's name on ${c.arena.name}. The biggest commercial asset a small club has.`, `Some supporters dislike renaming the home arena (small mood hit).`));
  out.push(sponsorDeal(w, c, 'shirtSecondary', 0.032, 2, 'sleeve', 'Shirt sleeve & back sponsor', 'A second logo on the kit. Quick to sell to a local business.', 'Mostly accepted by fans.'));
  out.push(sponsorDeal(w, c, 'court', 0.026, 2, 'court', 'Court & LED boards', 'Courtside boards and the centre-court logo.', 'Fans barely notice it.'));
  const local = (['local1', 'local2', 'local3'] as SponsorSlot[]).find((s) => !c.sponsors.some((x) => x.slot === s));
  if (local) out.push(sponsorDeal(w, c, local, 0.016, 2, 'localPartner', 'Local partner package', 'A regional company buys hospitality, tickets and visibility.', 'Neutral.'));
  // media rights
  const tvFree = !c.tv || c.tv.expires < w.season;
  const bench = r1k(Math.max(localTvBenchmark(w, c), est * 0.04));
  const left = seasonLeft(w);
  out.push({
    kind: 'mediaRights', title: 'Local TV & streaming rights', desc: 'Sell the rights to broadcast your home games to a regional channel or platform.',
    available: tvFree && phaseOf(w.season, w.day) !== 'postseason',
    reason: !tvFree ? `Sold to ${c.tv!.broadcaster} until ${c.tv!.expires + 1}.` : 'The season is almost over.',
    fanNote: 'Exposure grows your regional and digital fans a little.',
    options: [
      { id: 'season', label: 'This season only, paid today', detail: `${fmtMoney(r1k(bench * left * 0.95))} now${left < 1 ? ' (rest of the season)' : ''}. Renegotiate next summer.`, cashNow: r1k(bench * left * 0.95), annual: 0, years: 1 },
      { id: 'multi', label: '3 seasons, paid monthly', detail: `${fmtMoney(r1k(bench * 1.1))} a year, locked in`, cashNow: 0, annual: r1k(bench * 1.1), years: 3 },
    ],
  });
  // membership drive (once a season, before the league starts)
  const pre = phaseOf(w.season, w.day) === 'offseason' || phaseOf(w.season, w.day) === 'preseason';
  const mood = c.fans.sentiment;
  const cash = r1k(est * (0.03 + mood / 2600 + c.fans.loyalty / 3200));
  out.push({
    kind: 'membership', title: 'Members & supporters drive', desc: 'Sell club memberships, founder packs and supporter bonds to the local community.',
    available: pre && used.membership !== w.season,
    reason: used.membership === w.season ? 'Already run this season.' : 'Only before the league season starts.',
    fanNote: 'Fans like being part of the club (+mood). Yield grows with their mood and loyalty.',
    options: [{ id: 'run', label: 'Launch the drive', detail: `About ${fmtMoney(cash)} raised this week`, cashNow: cash, annual: 0, years: 1 }],
  });
  return out;
}

export interface DealResult { ok: boolean; message: string; cash: number; payrollLift: number }

/** Close a revenue-drive deal; the board lets you spend part of the money on the squad. */
export function takeQuickDeal(w: World, c: Club, kind: QuickDealKind, optionId: string): DealResult {
  const deal = quickDeals(w, c).find((d) => d.kind === kind);
  if (!deal) return { ok: false, message: 'Not available.', cash: 0, payrollLift: 0 };
  if (!deal.available) return { ok: false, message: deal.reason ?? 'Not available.', cash: 0, payrollLift: 0 };
  const opt = deal.options.find((o) => o.id === optionId);
  if (!opt) return { ok: false, message: 'Unknown option.', cash: 0, payrollLift: 0 };
  const r = rng(w);
  let msg = '';
  if (deal.slot) {
    const usedBrands = new Set(c.sponsors.map((s) => s.brand));
    const pool = SPONSOR_BRANDS.filter((b) => b.risk < 45 && !usedBrands.has(b.brand));
    const b = r.pick(pool.length ? pool : SPONSOR_BRANDS);
    signSponsor(w, c, {
      id: nextId(w), slot: deal.slot, brand: b.brand, category: b.category, annual: opt.annual,
      expires: w.season + opt.years - 1, promoBonus: 0, titleBonus: 0, fit: r.int(50, 85), risk: b.risk, signedSeason: w.season, expiresDay: absDay(w),
    });
    if (opt.cashNow) book(w, c, 'sponsors', opt.cashNow);
    if (kind === 'naming') {
      c.fans.sentiment = clamp(c.fans.sentiment - 3, 0, 100);
      fanReaction(w, -1.5, `${c.arena.name} renamed for ${b.brand}`);
    }
    msg = `${b.brand} sign up as ${SLOT_INFO[deal.slot].label.toLowerCase()}${opt.cashNow ? `: ${fmtMoney(opt.cashNow)} paid today` : ''}${opt.annual ? `, ${fmtMoney(opt.annual)} a year` : ''}.`;
  } else if (kind === 'mediaRights') {
    const b = r.pick(BROADCASTERS.filter((x) => x.kind === 'regional' || x.kind === 'streamer'));
    const prof = BROADCASTER_PROFILE[b.kind];
    signTv(w, c, { id: nextId(w), broadcaster: b.name, kind: b.kind, annual: opt.annual, expires: w.season + opt.years - 1, reach: prof.reach, digitalBoost: prof.digital, exclusivity: false, expiresDay: absDay(w) });
    if (opt.cashNow) book(w, c, 'tv', opt.cashNow);
    msg = `${b.name} buy your home games${opt.cashNow ? ` for ${fmtMoney(opt.cashNow)}, paid today` : `: ${fmtMoney(opt.annual)} a year for ${opt.years} seasons`}.`;
  } else if (kind === 'membership') {
    book(w, c, 'other', opt.cashNow);
    c.fans.sentiment = clamp(c.fans.sentiment + 2, 0, 100);
    c.fans.local = Math.round(c.fans.local * 1.01);
    fanReaction(w, 1, 'Members drive: supporters feel part of the club');
    msg = `The members drive raises ${fmtMoney(opt.cashNow)}.`;
  }
  (c.quickDeals ??= {})[kind] = w.season;
  // the board lets most of the new money go to the squad
  const lift = r1k(opt.annual * 0.7 + opt.cashNow * 0.6);
  c.finances.budget.payroll += lift;
  c.finances.budget.transfer += r1k(opt.cashNow * 0.3);
  addNews(w, deal.title, `${msg} The board adds ${fmtMoney(lift)} to the payroll budget.`, { tags: ['finance'], clubIds: [c.id] });
  return { ok: true, message: `${msg} Payroll budget +${fmtMoney(lift)}.`, cash: opt.cashNow, payrollLift: lift };
}
