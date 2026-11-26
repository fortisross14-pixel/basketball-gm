import type { Club, Decision, World } from './types';
import { absDay } from './types';
import { addNews, club as getClub, fmtMoney, hold, nextId, rng, roster, tierOf, userClub } from './world';
import { clamp } from './rng';
import { estimateRevenue } from './economy';

export function jobOfferDecision(w: World, c: Club, reason: string): Decision {
  const t = tierOf(w, c);
  const salary = Math.round((t === 1 ? 180000 : t === 2 ? 70000 : 40000) * (0.7 + c.prestige / 100) / 1000) * 1000;
  const expectations = t === 1 ? (c.prestige >= 75 ? 'Win titles and compete in Europe' : 'Reach the playoffs') : 'Win promotion within two seasons';
  return {
    id: nextId(w), kind: 'jobOffer',
    title: `Job offer: ${c.name} (${c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental'})`,
    body: `${reason} Budget around ${fmtMoney(estimateRevenue(w, c).total)} revenue, prestige ${c.prestige}. Expectations: ${expectations}. Salary ${fmtMoney(salary)}/yr.`,
    createdDay: absDay(w), deadlineDay: absDay(w) + 10, urgency: 2, impact: 3, dept: 'board',
    options: [{ id: 'accept', label: `Accept and move to ${c.name}`, tone: 'risky' }, { id: 'decline', label: 'Decline', tone: 'neutral' }],
    recommended: null, recommendedBy: null, payload: { clubId: c.id, salary }, defaultOption: 'decline', resolved: false, clubIds: [c.id],
  };
}

/** Offers arrive at the end of the season (and weekly while unemployed). */
export function jobMarket(w: World, force = false) {
  if (w.user.role === 'owner' && w.user.clubId != null) return;
  const r = rng(w);
  const rep = w.user.reputation;
  const current = userClub(w);
  const pool = w.clubs.filter((c) => !c.foreign && c.id !== w.user.clubId);
  const fit = pool.filter((c) => {
    const need = c.prestige * 0.75 + (tierOf(w, c) === 1 ? 10 : tierOf(w, c) === 2 ? 0 : -10);
    return rep >= need - 15 && (!current || c.prestige > current.prestige + 3 || tierOf(w, c) < tierOf(w, current));
  });
  if (!fit.length) return;
  const unemployed = w.user.clubId == null;
  const n = unemployed ? r.int(1, 3) : r.chance(clamp((rep - 30) / 80, 0.05, 0.7)) ? 1 : 0;
  const picks = r.shuffle(fit).slice(0, force ? Math.max(n, 2) : n);
  for (const c of picks) {
    if (w.decisions.some((d) => !d.resolved && d.kind === 'jobOffer' && d.payload.clubId === c.id)) continue;
    const reason = unemployed ? `${c.board.owner} is looking for a new executive and likes your profile.` : `After your work at ${current!.name}, ${c.name} want you to lead their project.`;
    const d = jobOfferDecision(w, c, reason);
    w.decisions.push(d);
    hold(w, 'jobOffer', d.title);
  }
}

export function resolveJobOffer(w: World, d: Decision, choice: string): string {
  const c = getClub(w, d.payload.clubId as number);
  const old = userClub(w);
  if (choice !== 'accept') {
    if (old) {
      old.board.trust.relationship = clamp(old.board.trust.relationship + 6, 0, 100);
      old.fans.sentiment = clamp(old.fans.sentiment + 3, 0, 100);
      addNews(w, `${w.user.name} turns down ${c.name}`, `The ${old.name} executive commits to the project. Supporters and board appreciate the loyalty.`, { tags: ['career'], clubIds: [old.id, c.id], importance: 2 });
    }
    return `You declined ${c.name}.`;
  }
  switchClub(w, c, old ? `Left for ${c.name}` : null);
  return `You are the new executive of ${c.name}.`;
}

export function switchClub(w: World, c: Club, exitLabel: string | null) {
  const now = absDay(w);
  const old = userClub(w);
  if (old) {
    const st = w.user.career.find((s) => s.clubId === old.id && s.to == null);
    if (st) { st.to = now; st.exit = exitLabel ?? 'Left'; }
    addNews(w, `${w.user.name} leaves ${old.name} for ${c.name}`, 'A new chapter begins.', { tags: ['career'], clubIds: [old.id, c.id], importance: 3 });
  } else {
    addNews(w, `${c.name} appoint ${w.user.name}`, `${w.user.name} takes charge of ${c.name}.`, { tags: ['career'], clubIds: [c.id], importance: 3 });
  }
  w.user.clubId = c.id;
  w.user.unemployedSince = null;
  w.user.career.push({ clubId: c.id, clubName: c.name, role: w.user.role === 'owner' ? 'gm' : w.user.role, from: now, to: null, achievements: [], exit: null });
  if (w.user.role === 'owner') w.user.role = 'gm';
  w.user.negotiations = [];
  w.user.shortlist = [];
  w.tvOffers = [];
  for (const p of roster(w, c.id)) w.user.knowledge[p.id] = 100;
  c.board.trust = { results: 60, finances: 60, fans: 60, media: 60, promises: 60, relationship: 65 };
  c.board.overall = 61;
  c.board.ultimatum = null;
  // cancel pending decisions belonging to the old club
  for (const d of w.decisions) if (!d.resolved && d.kind !== 'jobOffer') d.resolved = true;
}

/** End-of-season reputation update. */
export function updateReputation(w: World, delta: number, achievement?: string) {
  w.user.reputation = Math.round(clamp(w.user.reputation + delta, 0, 100));
  if (achievement) {
    const st = w.user.career.find((s) => s.clubId === w.user.clubId && s.to == null);
    if (st) st.achievements.push(`${w.season}-${String((w.season + 1) % 100).padStart(2, '0')}: ${achievement}`);
  }
}
