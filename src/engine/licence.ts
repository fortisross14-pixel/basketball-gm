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
  return capacity(c) + projects.reduce((a, p) => a + Object.values(p.seatsDelta ?? {}).reduce((x, y) => x + (y ?? 0), 0) + (p.newArenaSeats ? Object.values(p.newArenaSeats).reduce((x, y) => x + y, 0) - capacity(c) : 0), 0);
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
