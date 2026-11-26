// Promotion licence planner: requirements of the league above, current status and actions.
import type { Club, LeagueId, World } from './types';
import { fmtMoney } from './world';
import { capacity } from './arena';
import { creditLine, licenceCheck } from './season';
import { buildCalendar } from './calendar';

export interface LicenceItem {
  id: 'seats' | 'fee' | 'standard';
  label: string;
  ok: boolean;
  required: string;
  current: string;
  gap?: string;
  explain: string;
  actions: { label: string; to: string; primary?: boolean }[];
}

export interface LicencePlan {
  to: LeagueId;
  toName: string;
  fromName: string;
  ok: boolean;
  failing: number;
  urgent: boolean;
  lead: string;
  credit: number;
  ownerGuarantee: number;
  items: LicenceItem[];
}

export function upperLeague(c: Club): LeagueId | null {
  return c.leagueId === 'ORO' ? 'ELITE' : c.leagueId === 'PLATA' ? 'ORO' : null;
}

export function plannedSeats(w: World, c: Club): number {
  const projects = w.projects[c.id] ?? [];
  const gs = c.groundShare && c.groundShare.season >= w.season ? c.groundShare.seats : 0;
  return Math.max(gs, capacity(c) + projects.reduce((a, p) => a + Object.values(p.seatsDelta ?? {}).reduce((x, y) => x + (y ?? 0), 0) + (p.newArenaSeats ? Object.values(p.newArenaSeats).reduce((x, y) => x + y, 0) - capacity(c) : 0), 0));
}

export function licencePlan(w: World, c: Club): LicencePlan | null {
  const to = upperLeague(c);
  if (!to || !c.leagueId) return null;
  const r = w.rules.leagues[to];
  const credit = creditLine(w, c);
  const ownerGuarantee = c.board.ownerWealth * 25000;
  const seats = plannedSeats(w, c);
  const cash = c.finances.cash;
  const cal = buildCalendar(w.season);
  const items: LicenceItem[] = [
    {
      id: 'seats', label: 'Arena capacity', ok: seats >= r.minArenaSeats,
      required: `${r.minArenaSeats.toLocaleString('en')} seats`, current: `${capacity(c).toLocaleString('en')}${seats !== capacity(c) ? ` (${seats.toLocaleString('en')} with works under way)` : ''}`,
      gap: seats < r.minArenaSeats ? `${(r.minArenaSeats - seats).toLocaleString('en')} seats` : undefined,
      explain: 'Seats count if the works are under way on promotion day. Expansions take 8–14 weeks; a new arena takes more than a season.',
      actions: [{ label: 'Plan an expansion', to: '/infrastructure/arena', primary: true }, { label: 'Licence rules', to: '/results/rules' }],
    },
    {
      id: 'fee', label: 'Entry guarantee', ok: cash + credit >= r.promotionFee,
      required: fmtMoney(r.promotionFee), current: `${fmtMoney(cash)} cash + ${fmtMoney(credit)} credit`,
      gap: cash + credit < r.promotionFee ? fmtMoney(r.promotionFee - cash - credit) : undefined,
      explain: 'Paid to the league when you go up. Cash or available bank credit (half of annual revenue, minus debt) both count.',
      actions: [{ label: 'Revenue drive', to: '/business/revenue-drive', primary: true }, { label: 'Finance & loans', to: '/club/finance' }],
    },
    {
      id: 'standard', label: 'Financial standard', ok: cash + credit + ownerGuarantee >= r.minPayrollGuarantee,
      required: fmtMoney(r.minPayrollGuarantee), current: fmtMoney(cash + credit + ownerGuarantee),
      gap: cash + credit + ownerGuarantee < r.minPayrollGuarantee ? fmtMoney(r.minPayrollGuarantee - cash - credit - ownerGuarantee) : undefined,
      explain: 'Cash, owner guarantees and available credit together must cover the league standard.',
      actions: [{ label: 'Ask the board', to: '/club/board' }, { label: 'Finance', to: '/club/finance' }],
    },
  ];
  const failing = items.filter((i) => !i.ok).length;
  const weeksLeft = Math.max(0, Math.round((cal.seasonEnd - w.day) / 7));
  const urgent = failing > 0 && weeksLeft <= 16;
  void licenceCheck;
  return {
    to, toName: r.name, fromName: w.rules.leagues[c.leagueId].name, ok: failing === 0, failing, urgent, credit, ownerGuarantee, items,
    lead: `About ${weeksLeft} weeks until promotion day.${items[0].ok ? '' : ' Seats are the slowest fix: start works at least 14 weeks before.'}`,
  };
}

// ------------------------------------------------------------------ routes to the licence
import { projectOptions, startProject } from './arena';
import { book, addNews, nextId } from './world';
import { absDay as _abs } from './types';
import { centralTvAnnual } from './economy';
import { phaseOf } from './calendar';

export function licenceStandOption(w: World, c: Club) {
  return projectOptions(w, c).find((o) => o.kind === 'licenceStand') ?? null;
}

export function startLicenceStand(w: World, c: Club, financing: 'cash' | 'loan'): { ok: boolean; message: string } {
  const o = licenceStandOption(w, c);
  if (!o) return { ok: false, message: 'No licence expansion is needed.' };
  const r = startProject(w, c, o, financing);
  return r.ok ? { ok: true, message: `${o.label} under way: ${fmtMoney(o.cost)}${financing === 'loan' ? ' (80% on a construction loan)' : ''}, ready in ${o.weeks} weeks.` } : { ok: false, message: r.reason ?? 'Could not start.' };
}

/** Season a ground-share signed today would cover (the next season played at the bigger venue). */
function shareSeason(w: World): number {
  const ph = phaseOf(w.season, w.day);
  return ph === 'offseason' || ph === 'preseason' ? w.season : w.season + 1;
}

export function groundShareOffer(w: World, c: Club): { venue: string; seats: number; rentPerGame: number; deposit: number; season: number } | null {
  const to = upperLeague(c);
  const need = to ? w.rules.leagues[to].minArenaSeats : c.leagueId === 'ELITE' ? w.rules.leagues.ELITE.minArenaSeats : 0;
  if (!need || capacity(c) >= need) return null;
  const seats = Math.max(need + 400, 6000);
  const rentPerGame = Math.round((seats * 1.2) / 100) * 100;
  return { venue: `Palacio Multiusos de ${c.city}`, seats, rentPerGame, deposit: rentPerGame * 3, season: shareSeason(w) };
}

export function signGroundShare(w: World, c: Club): { ok: boolean; message: string } {
  const o = groundShareOffer(w, c);
  if (!o) return { ok: false, message: 'Your arena already meets the requirement.' };
  if (c.groundShare && c.groundShare.season >= o.season) return { ok: false, message: 'A ground-share is already agreed.' };
  if (c.finances.cash < o.deposit) return { ok: false, message: `The venue wants a ${fmtMoney(o.deposit)} deposit.` };
  book(w, c, 'rent', -o.deposit);
  c.groundShare = { venue: o.venue, seats: o.seats, rentPerGame: o.rentPerGame, season: o.season };
  addNews(w, `${c.name} agree a ground-share at ${o.venue}`, `${o.seats.toLocaleString('en')} seats for the ${o.season}-${String((o.season + 1) % 100).padStart(2, '0')} season while the home arena grows. Rent ${fmtMoney(o.rentPerGame)} per home game.`, { tags: ['club'], clubIds: [c.id], importance: 2 });
  return { ok: true, message: `Ground-share agreed: ${o.venue} counts for the licence. Deposit ${fmtMoney(o.deposit)}.` };
}

/** Relaxed/standard: a league media advance that lets a newly promoted club pay a bigger squad. */
export function payrollBridgeOffer(w: World, c: Club): { amount: number; rate: number; years: number } | null {
  if (c.promotedSeason !== w.season || c.payrollBridge?.season === w.season || !c.leagueId) return null;
  const d = w.settings.difficulty;
  if (d !== 'relaxed' && d !== 'standard') return null;
  const lower = c.leagueId === 'ELITE' ? 'ORO' : c.leagueId === 'ORO' ? 'PLATA' : null;
  if (!lower) return null;
  const up = centralTvAnnual(w, c);
  const was = w.rules.leagues[lower].centralTv + w.rules.leagues[lower].centralTvMerit / 2;
  const amount = Math.round(Math.max(0, up - was) * (d === 'relaxed' ? 0.5 : 0.3) / 5000) * 5000;
  return amount > 0 ? { amount, rate: d === 'relaxed' ? 0.015 : 0.035, years: 2 } : null;
}

export function takePayrollBridge(w: World, c: Club): { ok: boolean; message: string } {
  const o = payrollBridgeOffer(w, c);
  if (!o) return { ok: false, message: 'No bridge available.' };
  const monthly = Math.round((o.amount * (1 + o.rate * o.years)) / (o.years * 12));
  c.finances.loans.push({ id: nextId(w), lender: 'League media advance', principal: o.amount, balance: o.amount, rate: o.rate, monthlyPayment: monthly, startDay: _abs(w), endDay: _abs(w) + o.years * 365, covenantDebtToRevenue: 9 });
  book(w, c, 'loanIn', o.amount);
  c.finances.budget.payroll += o.amount;
  c.payrollBridge = { season: w.season, amount: o.amount };
  addNews(w, 'League advances media money', `${fmtMoney(o.amount)} against future TV income, repaid over ${o.years} seasons at ${(o.rate * 100).toFixed(1)}%. The payroll budget rises by the same amount.`, { tags: ['finance'], clubIds: [c.id] });
  return { ok: true, message: `Payroll bridge: +${fmtMoney(o.amount)} to the payroll budget.` };
}
