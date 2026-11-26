import type { Board, Club, Objective, World, TrustComponents } from './types';
import { absDay } from './types';
import { addNews, book, hold, isUser, nextId, rng, roster, age, comp as getComp, tierOf } from './world';
import { clamp } from './rng';
import { estimateRevenue } from './economy';
import { payroll, totalDebt, statement } from './finance';

const OWNERS = ['Grupo Hermanos Ortiz', 'Inversiones Duero', 'Familia Ballesteros', 'Fundación Ciudad', 'Socios (member-owned)', 'Holding Atlántico', 'Ricardo Anaya (local businessman)', 'Consorcio Levante', 'Cooperativa del Norte', 'Familia Iturbe'];

export function generateBoard(w: World, c: Club): Board {
  const r = rng(w);
  const t = tierOf(w, c);
  const wealth = clamp(r.normal(c.prestige * 0.7 + 10, 15), 5, 98);
  return {
    owner: r.pick(OWNERS),
    ownerWealth: Math.round(wealth),
    ambition: r.int(25, 90),
    patience: r.int(25, 85),
    riskAppetite: r.int(15, 80),
    trust: { results: 60, finances: 60, fans: 60, media: 60, promises: 60, relationship: 60 },
    overall: 60,
    objectives: [],
    plan: c.leagueId === 'COLLEGE' ? {
      years: r.int(3, 5),
      vision: c.prestige >= 60 ? r.pick(['Win a national title', 'Be a perennial NCL contender']) : r.pick(['Rebuild the program into a tournament team', 'Recruit better and grow the student fanbase', 'Become a respectable, solvent program']),
      competitiveTarget: c.prestige >= 60 ? 'NCL title contention' : 'NCL Tournament',
      profitTolerance: r.pick(['Break-even required', 'Small losses tolerated']),
      development: 'Youth-first',
    } : {
      years: r.int(3, 5),
      vision: t === 1 ? r.pick(['Become a continental regular', 'Compete for titles every season', 'Stable top-half club with a strong academy']) : t === 2 ? r.pick(['Reach the Liga Élite within three years', 'Build a stable, profitable club', 'Develop local talent and grow the fanbase']) : r.pick(['Climb to the Liga Oro', 'Survive and stay solvent', 'Rebuild the club around the community']),
      competitiveTarget: t === 1 ? 'Playoffs' : t === 2 ? 'Promotion contention' : 'Promotion contention',
      profitTolerance: r.pick(['Break-even required', 'Small losses tolerated', 'Will fund losses for ambition']),
      development: r.pick(['Youth-first', 'Balanced', 'Win-now']),
    },
    ultimatum: null,
    injectionsThisSeason: 0,
    autonomy: 'full',
    fanBaseline: c.fans.local,
  };
}

/** Season objectives based on club stature. */
export function setObjectives(w: World, c: Club) {
  const b = c.board;
  const t = tierOf(w, c);
  const objs: Objective[] = [];
  const mk = (kind: Objective['kind'], target: number, label: string, weight: number): Objective => ({ id: nextId(w), kind, target, label, weight, status: 'pending', progress: 0 });
  const leaguePeers = w.clubs.filter((x) => x.leagueId === c.leagueId).sort((a, b2) => b2.prestige - a.prestige);
  const expectedRank = Math.max(1, leaguePeers.findIndex((x) => x.id === c.id) + 1);
  if (c.leagueId === 'COLLEGE') {
    if (expectedRank <= 3) objs.push(mk('leaguePos', 2, 'Finish top 2 and contend for the NCL title', 3));
    else if (expectedRank <= 9) objs.push(mk('leaguePos', 8, 'Make the NCL Tournament (top 8)', 3));
    else objs.push(mk('leaguePos', 12, 'Win more games: finish 12th or better', 3));
  } else if (t === 1) {
    if (expectedRank <= 3) objs.push(mk('leaguePos', 2, 'Finish in the top 2 of the regular season', 3));
    else if (expectedRank <= 8) objs.push(mk('leaguePos', 8, 'Reach the title playoffs (top 8)', 3));
    else objs.push(mk('avoidRelegation', 14, 'Avoid relegation (finish 14th or better)', 3));
    if (expectedRank <= 5) objs.push(mk('euroQualify', 4, 'Qualify for continental competition (top 4)', 2));
  } else {
    if (expectedRank <= 4) objs.push(mk('promotion', 1, 'Win promotion to the next tier', 3));
    else if (expectedRank <= 10) objs.push(mk('leaguePos', 5, 'Reach the promotion playoffs (top 5)', 3));
    else objs.push(mk('leaguePos', t === 2 ? 14 : 12, t === 2 ? 'Avoid relegation (14th or better)' : 'Finish in the top 12', 3));
  }
  const tol = b.plan.profitTolerance;
  const rev = estimateRevenue(w, c).total;
  if (tol === 'Break-even required') objs.push(mk('profit', 0, 'Break even or better this season', 2));
  else if (tol === 'Small losses tolerated') objs.push(mk('maxLoss', Math.round(rev * 0.08), `Keep losses below €${Math.round(rev * 0.08 / 1000)}k`, 2));
  else objs.push(mk('maxLoss', Math.round(rev * 0.2), `Keep losses below €${Math.round(rev * 0.2 / 1000)}k`, 1));
  if (b.plan.development === 'Youth-first') objs.push(mk('youthMinutes', 900, 'Give 900+ minutes to players aged 22 or under', 2));
  objs.push(mk('fanGrowth', 5, 'Grow the local fanbase by 5%', 1));
  b.objectives = objs;
  b.fanBaseline = c.fans.local;
}

export function objectiveProgress(w: World, c: Club, o: Objective): number {
  const st = getComp(w, `${c.leagueId}-${w.season}`)?.standings;
  const sorted = st ? [...st].sort((a, b) => b.w - a.w || b.pf - b.pa - (a.pf - a.pa)) : [];
  const rank = sorted.findIndex((s) => s.clubId === c.id) + 1 || 99;
  switch (o.kind) {
    case 'leaguePos':
    case 'avoidRelegation':
    case 'euroQualify':
      return rank <= o.target ? 1 : clamp(1 - (rank - o.target) / 6, 0, 0.99);
    case 'promotion':
      return rank === 1 ? 1 : clamp(1 - (rank - 1) / 6, 0, 0.95);
    case 'profit': {
      const s = statement(c, w.season);
      return s.net >= 0 ? 1 : clamp(1 + s.net / 300000, 0, 0.99);
    }
    case 'maxLoss': {
      const s = statement(c, w.season);
      return -s.net <= o.target ? 1 : clamp(1 - (-s.net - o.target) / Math.max(1, o.target), 0, 0.99);
    }
    case 'youthMinutes': {
      const mins = roster(w, c.id).filter((p) => age(w, p) <= 22).reduce((a, p) => a + p.seasonMinutes, 0);
      return clamp(mins / o.target, 0, 1);
    }
    case 'fanGrowth': {
      const base = c.board.fanBaseline || c.fans.local;
      const g = (c.fans.local / base - 1) * 100;
      return clamp(g / o.target, 0, 1);
    }
    case 'attendance':
    case 'cupRun':
      return 0.5;
  }
}

/** Weekly trust update. */
export function weeklyBoard(w: World, c: Club) {
  const b = c.board;
  const tr = b.trust;
  for (const o of b.objectives) o.progress = objectiveProgress(w, c, o);
  const sportObjs = b.objectives.filter((o) => ['leaguePos', 'avoidRelegation', 'promotion', 'euroQualify'].includes(o.kind));
  const sport = sportObjs.length ? sportObjs.reduce((a, o) => a + o.progress * o.weight, 0) / sportObjs.reduce((a, o) => a + o.weight, 0) : 0.6;
  const finObjs = b.objectives.filter((o) => o.kind === 'profit' || o.kind === 'maxLoss');
  const fin = finObjs.length ? finObjs.reduce((a, o) => a + o.progress, 0) / finObjs.length : 0.6;
  const debtRatio = totalDebt(c) / Math.max(1, estimateRevenue(w, c).total);
  const cashPenalty = c.finances.cash < 0 ? 25 : 0;
  const payrollOver = Math.max(0, payroll(w, c) / Math.max(1, c.finances.budget.payroll) - 1) * 100;
  const target: TrustComponents = {
    results: 5 + sport * 90,
    finances: clamp(10 + fin * 80 - cashPenalty - Math.max(0, debtRatio - 0.8) * 40 - payrollOver * 1.2, 0, 100),
    fans: clamp(isUser(w, c.id) ? w.user.approval.fans : c.fans.sentiment, 0, 100),
    media: tr.media,
    promises: tr.promises,
    relationship: tr.relationship,
  };
  const k = 0.12 + (100 - b.patience) / 1000;
  for (const key of ['results', 'finances', 'fans'] as const) tr[key] = tr[key] + (target[key] - tr[key]) * k;
  tr.media = tr.media + (50 - tr.media) * 0.01;
  const prev = b.overall;
  b.overall = Math.round(tr.results * 0.33 + tr.finances * 0.25 + tr.fans * 0.14 + tr.media * 0.08 + tr.promises * 0.1 + tr.relationship * 0.1);
  if (!isUser(w, c.id) || w.user.role === 'owner') return;
  // warnings / ultimatum
  const threshold = difficultyThreshold(w);
  if (b.overall < threshold && prev >= threshold) {
    addNews(w, `Board of ${c.name} voices concern`, `${b.owner} is unhappy with the direction of the club. Confidence is at ${b.overall}/100.`, { tags: ['board'], clubIds: [c.id], importance: 2 });
    hold(w, 'boardUltimatum', 'The board has voiced concern about your management.');
  }
  if (b.overall < threshold - 12 && !b.ultimatum) {
    const obj = b.objectives[0]?.label ?? 'improve results';
    b.ultimatum = { day: absDay(w) + 42, objective: obj };
    addNews(w, `Ultimatum at ${c.name}`, `The board demands progress within six weeks: ${obj}.`, { tags: ['board'], clubIds: [c.id], importance: 3 });
    hold(w, 'boardUltimatum', `Board ultimatum: six weeks to show progress (${obj}).`);
  }
  if (b.ultimatum && absDay(w) >= b.ultimatum.day) {
    if (b.overall < threshold - 6) {
      fireUser(w, c, 'The board lost confidence after the ultimatum expired.');
    } else {
      b.ultimatum = null;
      addNews(w, `${c.name} board stands by its executive`, 'Enough progress was made to lift the ultimatum.', { tags: ['board'], clubIds: [c.id] });
    }
  }
}

function difficultyThreshold(w: World): number {
  return { relaxed: 25, standard: 32, demanding: 38, brutal: 45 }[w.settings.difficulty];
}

export function fireUser(w: World, c: Club, reason: string) {
  const stint = w.user.career.find((s) => s.clubId === c.id && s.to == null);
  if (stint) {
    stint.to = absDay(w);
    stint.exit = 'Dismissed';
  }
  w.user.clubId = null;
  w.user.unemployedSince = absDay(w);
  w.user.reputation = Math.max(5, w.user.reputation - 8);
  c.board.ultimatum = null;
  addNews(w, `${c.name} dismiss ${w.user.name}`, reason, { tags: ['career', 'board'], clubIds: [c.id], importance: 3 });
  hold(w, 'jobOffer', `You have been dismissed by ${c.name}. ${reason}`);
}

// ---------------------------------------------------------------------------
// Requests the player can make
// ---------------------------------------------------------------------------
export function requestBudgetIncrease(w: World, c: Club, amount: number): { ok: boolean; message: string } {
  const b = c.board;
  const rev = estimateRevenue(w, c).total;
  const appetite = b.ambition * 0.5 + b.overall * 0.4 + b.ownerWealth * 0.2;
  const ask = amount / Math.max(1, rev);
  const r = rng(w);
  if (appetite / 100 - ask * 2 + r.float(-0.1, 0.1) > 0.45) {
    c.finances.budget.payroll += amount;
    b.trust.relationship = Math.max(0, b.trust.relationship - 3);
    return { ok: true, message: `The board approves an extra €${Math.round(amount / 1000)}k payroll budget, and expects results to follow.` };
  }
  b.trust.relationship = Math.max(0, b.trust.relationship - 1);
  return { ok: false, message: `The board declines: the request is ${(ask * 100).toFixed(0)}% of revenue and confidence is ${b.overall}/100. Improve trust or ask for less.` };
}

export function requestInjection(w: World, c: Club): { ok: boolean; message: string } {
  const b = c.board;
  if (w.user.role === 'owner') {
    const amount = Math.min(w.user.personalWealth, Math.max(100000, Math.round(estimateRevenue(w, c).total * 0.15)));
    if (amount <= 0) return { ok: false, message: 'Your personal funds are exhausted.' };
    w.user.personalWealth -= amount;
    book(w, c, 'ownerInjection', amount);
    return { ok: true, message: `You inject €${Math.round(amount / 1000)}k of personal wealth into the club.` };
  }
  if (b.injectionsThisSeason >= 1) return { ok: false, message: 'The owner has already injected funds this season.' };
  const r = rng(w);
  const p = b.ownerWealth / 100 * 0.6 + b.overall / 100 * 0.4;
  if (r.chance(p * 0.8)) {
    const amount = Math.round(estimateRevenue(w, c).total * (0.05 + b.ownerWealth / 1000));
    book(w, c, 'ownerInjection', amount);
    b.injectionsThisSeason++;
    b.trust.relationship = Math.max(0, b.trust.relationship - 5);
    return { ok: true, message: `${b.owner} injects €${Math.round(amount / 1000)}k. This favour will be remembered.` };
  }
  b.trust.relationship = Math.max(0, b.trust.relationship - 3);
  return { ok: false, message: `${b.owner} refuses to put more money in at this time.` };
}

export function boardApproves(w: World, c: Club, cost: number): { ok: boolean; message: string } {
  if (w.user.role === 'owner' && isUser(w, c.id)) return { ok: true, message: 'As owner, you approve your own project.' };
  const b = c.board;
  const rev = estimateRevenue(w, c).total;
  const ratio = cost / Math.max(1, rev);
  const score = b.overall / 100 * 0.5 + b.riskAppetite / 100 * 0.3 + b.ownerWealth / 100 * 0.2 - ratio * 0.35;
  if (score > 0.35) return { ok: true, message: 'The board approves the investment.' };
  return { ok: false, message: `The board rejects the project: it costs ${(ratio * 100).toFixed(0)}% of annual revenue and confidence is ${b.overall}/100. Build trust, raise cash or choose a smaller project.` };
}

export function promise(w: World, c: Club, o: Objective) {
  o.promise = true;
  o.weight += 1;
  c.board.trust.relationship = Math.min(100, c.board.trust.relationship + 6);
}

/** End of season: grade objectives, adjust trust and autonomy. */
export function seasonReview(w: World, c: Club): { score: number; lines: string[] } {
  const b = c.board;
  const lines: string[] = [];
  let tot = 0;
  let wsum = 0;
  for (const o of b.objectives) {
    o.progress = objectiveProgress(w, c, o);
    o.status = o.progress >= 1 ? 'met' : 'failed';
    tot += (o.status === 'met' ? 1 : o.progress * 0.4) * o.weight;
    wsum += o.weight;
    lines.push(`${o.status === 'met' ? '✔' : '✘'} ${o.label}`);
    if (o.promise) b.trust.promises = clamp(b.trust.promises + (o.status === 'met' ? 15 : -20), 0, 100);
  }
  const score = wsum ? tot / wsum : 0.5;
  b.trust.results = clamp(b.trust.results + (score - 0.6) * 30, 0, 100);
  b.trust.relationship = clamp(b.trust.relationship + (score - 0.5) * 16, 0, 100);
  b.trust.promises = clamp(b.trust.promises + (score - 0.5) * 10, 0, 100);
  if (score < 0.35) b.autonomy = 'restricted';
  else if (score > 0.7) b.autonomy = 'full';
  b.injectionsThisSeason = 0;
  return { score, lines };
}
