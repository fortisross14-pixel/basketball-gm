import type { Club, LedgerCat, Loan, World, Budget } from './types';
import { INCOME_CATS, absDay } from './types';
import { book, clubStaff, isUser, nextId, roster, academy, addNews, hold } from './world';
import { centralTvAnnual, estimateRevenue, municipalGrant, tier } from './economy';
import { maintenanceNeed } from './arena';
import { clamp } from './rng';
import { staffPayroll } from './staff';

export function payroll(w: World, c: Club): number {
  let s = 0;
  for (const p of w.players) {
    if (p.teamId !== c.id || p.retired || !p.contract) continue;
    s += p.loan ? p.contract.salary * (1 - p.loan.wageShare) : p.contract.salary;
  }
  // players loaned out: we still pay our share
  for (const p of w.players) if (p.loan && p.loan.fromTeamId === c.id && p.contract) s += p.contract.salary * p.loan.wageShare;
  return Math.round(s);
}

export function playerCommitments(w: World, c: Club, years = 5): { season: number; amount: number }[] {
  const out: { season: number; amount: number }[] = [];
  for (let y = 0; y < years; y++) {
    const season = w.season + y;
    let amt = 0;
    for (const p of w.players) if (p.teamId === c.id && p.contract && p.contract.expires >= season) amt += p.contract.salary;
    out.push({ season, amount: amt });
  }
  return out;
}

export function totalDebt(c: Club): number {
  return c.finances.loans.reduce((a, l) => a + l.balance, 0);
}

export function loanOffer(w: World, c: Club, amount: number, years: number): { rate: number; monthly: number; ok: boolean; reason?: string } {
  const rev = estimateRevenue(w, c).total;
  const debt = totalDebt(c);
  const ratio = (debt + amount) / Math.max(1, rev);
  if (ratio > 1.6) return { rate: 0, monthly: 0, ok: false, reason: `Banks refuse: debt would reach ${(ratio * 100).toFixed(0)}% of annual revenue (limit 160%).` };
  const rate = clamp(0.045 + ratio * 0.04 + (c.finances.cash < 0 ? 0.03 : 0) + (100 - c.board.ownerWealth) / 2000, 0.04, 0.16);
  const n = years * 12;
  const mr = rate / 12;
  const monthly = Math.round((amount * mr) / (1 - Math.pow(1 + mr, -n)));
  return { rate, monthly, ok: true };
}

export function takeLoan(w: World, c: Club, amount: number, years: number, lender = 'Banco Regional'): { ok: boolean; reason?: string } {
  const offer = loanOffer(w, c, amount, years);
  if (!offer.ok) return { ok: false, reason: offer.reason };
  const now = absDay(w);
  const loan: Loan = {
    id: nextId(w),
    lender,
    principal: Math.round(amount),
    balance: Math.round(amount),
    rate: offer.rate,
    monthlyPayment: offer.monthly,
    startDay: now,
    endDay: now + years * 365,
    covenantDebtToRevenue: 1.2,
  };
  c.finances.loans.push(loan);
  book(w, c, 'loanIn', Math.round(amount));
  return { ok: true };
}

export function repayLoan(w: World, c: Club, loanId: number): { ok: boolean; reason?: string } {
  const l = c.finances.loans.find((x) => x.id === loanId);
  if (!l) return { ok: false, reason: 'Loan not found' };
  const fee = Math.round(l.balance * 0.02);
  if (c.finances.cash < l.balance + fee) return { ok: false, reason: 'Not enough cash to repay (2% early-repayment fee applies).' };
  book(w, c, 'loanPrincipal', -l.balance);
  book(w, c, 'interest', -fee);
  c.finances.loans = c.finances.loans.filter((x) => x !== l);
  return { ok: true };
}

/** Runs on the 1st of each month. */
export function monthlyFinance(w: World, c: Club) {
  // player wages
  book(w, c, 'playerSalaries', -Math.round(payroll(w, c) / 12));
  // staff wages
  book(w, c, 'staffSalaries', -Math.round(staffPayroll(w, c) / 12));
  if (c.foreign) {
    // continental clubs: abstract budget — central income covers costs
    const income = Math.round((payroll(w, c) + staffPayroll(w, c)) / 12 * 1.02);
    book(w, c, 'sponsors', Math.round(income * 0.55));
    book(w, c, 'tv', Math.round(income * 0.25));
    book(w, c, 'tickets', Math.round(income * 0.2));
    return;
  }
  // sponsors & TV
  book(w, c, 'sponsors', Math.round(c.sponsors.reduce((a, s) => a + s.annual, 0) / 12));
  book(w, c, 'tv', Math.round((centralTvAnnual(w, c, lastRank(c)) + (c.tv?.annual ?? 0)) / 12));
  // departments
  book(w, c, 'academyCost', -Math.round((c.finances.budget.academy + academy(w, c.id).length * 1500) / 12));
  book(w, c, 'medicalCost', -Math.round(c.finances.budget.medical / 12));
  book(w, c, 'scouting', -Math.round(c.finances.budget.scouting / 12));
  // loans
  for (const l of [...c.finances.loans]) {
    const interest = Math.round((l.balance * l.rate) / 12);
    const principal = Math.min(l.balance, Math.max(0, l.monthlyPayment - interest));
    book(w, c, 'interest', -interest);
    book(w, c, 'loanPrincipal', -principal);
    l.balance -= principal;
    if (l.balance <= 0) c.finances.loans = c.finances.loans.filter((x) => x !== l);
  }
  // overdraft interest
  if (c.finances.cash < 0) book(w, c, 'interest', -Math.round(-c.finances.cash * 0.012));
}

function lastRank(c: Club): number | undefined {
  return c.history[c.history.length - 1]?.rank;
}

export function annualFinanceStart(w: World, c: Club) {
  if (c.foreign) return;
  if (c.leagueId) book(w, c, 'leagueFees', -w.rules.leagues[c.leagueId].leagueFee);
}

export function octoberGrant(w: World, c: Club) {
  if (c.foreign) return;
  const g = municipalGrant(w, c);
  book(w, c, 'grants', g);
  if (isUser(w, c.id)) addNews(w, `City council confirms €${Math.round(g / 1000)}k support for ${c.name}`, 'The municipal sports grant reflects the club\'s community role and fan sentiment.', { tags: ['finance'], clubIds: [c.id] });
}

export function weeklyCashSnapshot(w: World, c: Club) {
  c.finances.cashHistory.push({ day: absDay(w), cash: Math.round(c.finances.cash) });
  if (c.finances.cashHistory.length > 260) c.finances.cashHistory.shift();
  if (c.finances.cash < 0) {
    c.finances.overdueDays += 7;
    if (isUser(w, c.id) && c.finances.overdueDays === 7) hold(w, 'budgetBreach', 'Cash balance is negative: the bank is charging overdraft interest and the board is alarmed.');
  } else c.finances.overdueDays = 0;
}

// ---------------------------------------------------------------------------
// Statements & forecasts
// ---------------------------------------------------------------------------
export interface Statement {
  income: { cat: LedgerCat; amount: number }[];
  expenses: { cat: LedgerCat; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

export function statement(c: Club, season: number, excludeFinancing = true): Statement {
  const t = c.finances.seasonTotals[season] ?? {};
  const income: { cat: LedgerCat; amount: number }[] = [];
  const expenses: { cat: LedgerCat; amount: number }[] = [];
  for (const [k, v] of Object.entries(t)) {
    const cat = k as LedgerCat;
    if (excludeFinancing && (cat === 'loanIn' || cat === 'loanPrincipal')) continue;
    if (INCOME_CATS.includes(cat)) income.push({ cat, amount: v ?? 0 });
    else expenses.push({ cat, amount: v ?? 0 });
  }
  income.sort((a, b) => b.amount - a.amount);
  expenses.sort((a, b) => a.amount - b.amount);
  const totalIncome = income.reduce((a, x) => a + x.amount, 0);
  const totalExpenses = expenses.reduce((a, x) => a + x.amount, 0);
  return { income, expenses, totalIncome, totalExpenses, net: totalIncome + totalExpenses };
}

export const CAT_LABEL: Record<LedgerCat, string> = {
  tickets: 'Single tickets', seasonTickets: 'Season tickets', suites: 'Suites', concessions: 'Food & drink', merch: 'Merchandise',
  sponsors: 'Sponsorship', tv: 'Media rights', prize: 'Prize money', transfersIn: 'Player sales', grants: 'Grants', ownerInjection: 'Owner funds',
  other: 'Other income', playerSalaries: 'Player salaries', staffSalaries: 'Staff salaries', transfersOut: 'Transfer fees', agentFees: 'Agent fees & bonuses',
  travel: 'Travel', operations: 'Game operations', maintenance: 'Maintenance', rent: 'Arena rent', marketing: 'Marketing', merchCost: 'Merchandise stock',
  construction: 'Construction', interest: 'Interest', loanPrincipal: 'Loan repayments', academyCost: 'Academy', scouting: 'Scouting', medicalCost: 'Medical',
  leagueFees: 'League fees', penalties: 'Penalties', loanIn: 'Loan proceeds', severance: 'Severance & releases',
};

export interface Forecast {
  season: number;
  revenue: number;
  payroll: number;
  staff: number;
  other: number;
  debtService: number;
  net: number;
  cashEnd: number;
}

export interface ForecastAssumptions {
  revenueGrowth: number; // per year
  payrollGrowth: number;
  scenario: 'base' | 'upside' | 'downside';
}

export function fiveYearForecast(w: World, c: Club, a: ForecastAssumptions): Forecast[] {
  const est = estimateRevenue(w, c).total;
  const scen = a.scenario === 'upside' ? 0.04 : a.scenario === 'downside' ? -0.05 : 0;
  const commitments = playerCommitments(w, c, 5);
  const staff = staffPayroll(w, c);
  const b = c.finances.budget;
  const other = b.maintenance + b.academy + b.medical + b.scouting + b.marketing + operatingEstimate(w, c);
  let cash = c.finances.cash;
  const out: Forecast[] = [];
  let rev = est;
  let pr = payroll(w, c);
  for (let y = 0; y < 5; y++) {
    if (y > 0) {
      rev *= 1 + a.revenueGrowth + scen;
      pr *= 1 + a.payrollGrowth;
    }
    const committed = commitments[y]?.amount ?? 0;
    const pay = Math.max(committed, pr);
    const debtService = c.finances.loans.reduce((s, l) => s + (absDay(w) + y * 365 < l.endDay ? l.monthlyPayment * 12 : 0), 0);
    const net = rev - pay - staff - other - debtService;
    cash += net;
    out.push({ season: w.season + y, revenue: Math.round(rev), payroll: Math.round(pay), staff: Math.round(staff), other: Math.round(other), debtService: Math.round(debtService), net: Math.round(net), cashEnd: Math.round(cash) });
  }
  return out;
}

export function operatingEstimate(w: World, c: Club): number {
  const t = tier(w, c);
  const games = c.leagueId ? w.rules.leagues[c.leagueId].teams - 1 : 8;
  const ops = (t === 1 ? 22000 : t === 2 ? 5500 : 1800) * games * 1.1;
  const travel = (t === 1 ? 14000 : t === 2 ? 4500 : 1800) * games;
  return Math.round(ops + travel + (c.arena.owned ? 0 : c.arena.rentPerGame * games));
}

/** 90-day cash projection, by week. */
export function cashForecast90(w: World, c: Club): { week: number; cash: number }[] {
  const est = estimateRevenue(w, c);
  const weeklyIncome = (est.sponsors + est.tv) / 52;
  const games = c.leagueId ? w.rules.leagues[c.leagueId].teams - 1 : 8;
  const homeWeekly = ((est.tickets + est.concessions) / Math.max(1, games)) / 2; // ~one home game every 2 weeks during season
  const inSeason = w.day >= 92 && w.day <= 320;
  const weeklyCost = (payroll(w, c) + staffPayroll(w, c)) / 52 + (c.finances.budget.academy + c.finances.budget.medical + c.finances.budget.scouting + c.finances.budget.maintenance) / 52 + operatingEstimate(w, c) / 30 + c.finances.loans.reduce((a, l) => a + l.monthlyPayment, 0) * 12 / 52 + c.campaigns.reduce((a, x) => a + x.weeklyCost, 0);
  let cash = c.finances.cash;
  const out = [{ week: 0, cash: Math.round(cash) }];
  for (let i = 1; i <= 13; i++) {
    cash += weeklyIncome + (inSeason ? homeWeekly : 0) - weeklyCost;
    out.push({ week: i, cash: Math.round(cash) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Budgets (set every July by the board)
// ---------------------------------------------------------------------------
export function proposeBudget(w: World, c: Club): Budget {
  const est = estimateRevenue(w, c).total;
  const t = tier(w, c);
  const ambition = c.board.ambition / 100;
  const staff = staffPayroll(w, c);
  const ops = operatingEstimate(w, c);
  const maint = maintenanceNeed(w, c);
  const academyB = (t === 1 ? 180000 : t === 2 ? 45000 : 15000) * (0.5 + c.arena.levels.academy * 0.25);
  const medical = (t === 1 ? 120000 : t === 2 ? 30000 : 10000) * (0.6 + c.arena.levels.medical * 0.2);
  const scouting = (t === 1 ? 90000 : t === 2 ? 20000 : 8000);
  const marketing = Math.round(est * 0.025);
  const cashCushion = Math.max(0, c.finances.cash) * (0.15 + ambition * 0.2);
  const available = est + cashCushion - staff - ops - maint - academyB - medical - scouting - marketing;
  const payrollB = Math.max(est * 0.3, available * (0.82 + ambition * 0.12));
  const transfer = Math.max(0, c.finances.cash * (0.1 + ambition * 0.25));
  return {
    payroll: Math.round(payrollB / 1000) * 1000,
    transfer: Math.round(transfer / 1000) * 1000,
    staff: Math.round(staff * 1.1),
    marketing,
    scouting,
    medical: Math.round(medical),
    maintenance: maint,
    academy: Math.round(academyB),
  };
}

export function payrollRoom(w: World, c: Club): number {
  return c.finances.budget.payroll - payroll(w, c);
}

export function squadCost(w: World, c: Club) {
  return roster(w, c.id).reduce((a, p) => a + (p.contract?.salary ?? 0), 0);
}

export function staffCount(w: World, c: Club) {
  return clubStaff(w, c.id).length;
}
