// Seeded multi-season balance runs. Usage:
//   npx vite-node scripts/balance.ts <mode: delegated|active> <club: weak|average|strong> <difficulty> <seasons> <seed...>
// Prints one JSON line per run with per-season outcomes.
import { createWorld } from '../src/engine/worldgen';
import { club as getClub, roster, freeAgents } from '../src/engine/world';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { payroll } from '../src/engine/finance';
import { salaryAsk, roleFor } from '../src/engine/player';
import { offerContract, projectedRank, registrationCheck, canSignNow } from '../src/engine/market';
import { quickDeals, takeQuickDeal } from '../src/engine/fundraising';
import { presetPlan } from '../src/engine/gameplan';
import { licencePlan, licenceStandOption, startLicenceStand, takePayrollBridge, payrollBridgeOffer } from '../src/engine/licence';
import { buildCalendar } from '../src/engine/calendar';
import type { Department, Difficulty, World } from '../src/engine/types';

const [mode = 'delegated', which = 'average', difficulty = 'relaxed', seasonsArg = '5', ...seedArgs] = process.argv.slice(2);
const seasons = Number(seasonsArg);
const seeds = seedArgs.length ? seedArgs.map(Number) : [1];

function pickClub(seed: number): number {
  const w0 = createWorld({ seed, userName: 'B', role: 'gm', clubId: null, style: 'gm', difficulty: difficulty as Difficulty, worldNoise: 'normal' });
  const oro = w0.clubs.filter((c) => c.leagueId === 'ORO').sort((a, b) => a.prestige - b.prestige);
  return (which === 'weak' ? oro[1] : which === 'strong' ? oro[oro.length - 3] : oro[Math.floor(oro.length / 2)]).id;
}

function delegateAll(w: World) {
  for (const k of Object.keys(w.user.delegation) as Department[]) {
    if (k === 'board') continue;
    w.user.delegation[k] = { ...w.user.delegation[k], mode: 'notify' };
  }
  w.user.delegation.transfers = { ...w.user.delegation.transfers, mode: 'notify', maxSalary: 0, maxFee: 0 };
}

function signFreeAgents(w: World, n: number) {
  const c = getClub(w, w.user.clubId!);
  if (!canSignNow(w, false).ok) return;
  for (let k = 0; k < n; k++) {
    const sq = roster(w, c.id).sort((a, b) => b.ovr - a.ovr);
    const room = c.finances.budget.payroll - payroll(w, c);
    const eighth = sq[7]?.ovr ?? 0;
    const cand = freeAgents(w).filter((p) => p.ovr > eighth + 1 && registrationCheck(w, c, p).ok && salaryAsk(w, p, c) * 1.2 <= room).sort((a, b) => b.ovr - a.ovr)[0];
    if (!cand) return;
    if (sq.length >= 14) {
      // make room: release nobody (keeps it simple); stop when the roster is full
      return;
    }
    let offer = { salary: salaryAsk(w, cand, c), years: 2, role: roleFor(projectedRank(w, c, cand)), buyout: null, signingBonus: 0 };
    for (let i = 0; i < 4; i++) {
      const r = offerContract(w, c, cand, offer, 'sign');
      if (r.outcome === 'accepted') break;
      if (r.outcome === 'counter' && r.counter && r.counter.salary <= room) offer = r.counter as typeof offer; else break;
    }
  }
}

function activeWeek(w: World) {
  const c = getClub(w, w.user.clubId!);
  const cal = buildCalendar(w.season);
  Object.assign(c.tactics, presetPlan(w, c, 'results'));
  if (w.day < cal.leagueRoundDays[0]) {
    for (const d of quickDeals(w, c)) if (d.available) takeQuickDeal(w, c, d.kind, d.options.find((o) => o.id === 'upfront' || o.id === 'season' || o.id === 'run')?.id ?? d.options[0].id);
  }
  if ((w.day > 40 && w.day < cal.summerWindowClose) || (w.day >= cal.winterWindowOpen && w.day <= cal.winterWindowClose)) signFreeAgents(w, 2);
  if (payrollBridgeOffer(w, c)) takePayrollBridge(w, c);
  const plan = licencePlan(w, c);
  if (plan && !plan.items[0].ok && w.day > cal.leagueRoundDays[8] && licenceStandOption(w, c)) {
    const lc = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`);
    const st = lc ? [...lc.standings].sort((a, b) => b.w - a.w) : [];
    const rank = st.findIndex((x) => x.clubId === c.id) + 1;
    if (rank > 0 && rank <= 5) startLicenceStand(w, c, 'loan');
  }
}

for (const seed of seeds) {
  const clubId = pickClub(seed);
  const w = createWorld({ seed, userName: 'B', role: 'gm', clubId, style: 'gm', difficulty: difficulty as Difficulty, worldNoise: 'normal' });
  w.settings.liveGames = false;
  delegateAll(w);
  getClub(w, clubId).shop!.policy.mode = 'director';
  const out: Record<string, unknown>[] = [];
  const start = w.season;
  let fired = false;
  let days = 0;
  while (w.season < start + seasons && days < seasons * 400) {
    const s0 = w.season;
    const c0 = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
    const league0 = c0?.leagueId;
    advance(w, 'week');
    days += 7;
    for (const d of w.decisions.filter((x) => !x.resolved)) resolveDecision(w, d, d.kind === 'jobOffer' ? 'decline' : (d.recommended ?? d.defaultOption));
    if (w.user.clubId == null) { fired = true; out.push({ season: s0, fired: true, day: w.day, why: w.news.find((n) => /dismiss/.test(n.headline))?.body }); break; }
    if (mode === 'active') activeWeek(w);
    if (w.season !== s0) {
      const c = getClub(w, clubId);
      const h = c.history[c.history.length - 1];
      const euro = w.competitions.find((x) => x.id === `EURO-${s0}`);
      out.push({ season: s0, league: league0, rank: h?.rank, w: h?.wins, l: h?.losses, playoff: h?.playoff, euro: euro?.clubIds.includes(clubId) ? (euro.champion === clubId ? 'Champion' : h?.euro) : null, promoted: h?.promoted, relegated: h?.relegated, next: c.leagueId, cash: Math.round(c.finances.cash / 1000), board: c.board.overall });
    }
  }
  console.log(JSON.stringify({ mode, which, difficulty, seed, fired, seasons: out }));
}
