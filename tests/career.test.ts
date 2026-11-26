import { describe, it, expect } from 'vitest';
import { createWorld, assignUser } from '../src/engine/worldgen';
import { careerStartOffers, jobSecurity } from '../src/engine/career';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { club, roster } from '../src/engine/world';
import type { World } from '../src/engine/types';

function profile(nat: string, seed = 11): World {
  const w = createWorld({ seed, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  assignUser(w, { userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal', nationality: nat, background: 'business' });
  careerStartOffers(w);
  return w;
}

describe('career start', () => {
  it('an American gets offers from weak college programs', () => {
    const w = profile('USA');
    const offers = w.decisions.filter((d) => d.kind === 'jobOffer');
    expect(offers.length).toBeGreaterThanOrEqual(2);
    const leagues = offers.map((d) => club(w, d.payload.clubId as number).leagueId);
    expect(leagues).toContain('COLLEGE');
    for (const d of offers) if (club(w, d.payload.clubId as number).leagueId === 'COLLEGE') expect(club(w, d.payload.clubId as number).prestige).toBeLessThan(45);
  });
  it('a Spaniard gets offers from the lower Spanish divisions', () => {
    const w = profile('ESP');
    const leagues = w.decisions.filter((d) => d.kind === 'jobOffer').map((d) => club(w, d.payload.clubId as number).leagueId);
    expect(leagues.every((l) => l === 'PLATA' || l === 'ORO')).toBe(true);
  });
});

describe('college season and evaluation', () => {
  it('runs a college season with a tournament, graduation and weekly fan/board grading', () => {
    const w = profile('USA', 21);
    const offer = w.decisions.find((d) => d.kind === 'jobOffer' && club(w, d.payload.clubId as number).leagueId === 'COLLEGE')!;
    resolveDecision(w, offer, 'accept');
    const cid = w.user.clubId!;
    expect(club(w, cid).leagueId).toBe('COLLEGE');
    const before = roster(w, cid).filter((p) => p.contract!.expires === w.season).map((p) => p.id);
    const start = w.season;
    let n = 0;
    let offers = 0;
    while (w.season === start && n < 400) {
      advance(w, 'day'); n++;
      for (const d of w.decisions.filter((x) => !x.resolved)) { if (d.kind === 'jobOffer') { offers++; resolveDecision(w, d, 'decline'); } else resolveDecision(w, d, d.recommended ?? d.defaultOption); }
    }
    const po = w.competitions.find((c) => c.id === `COLLEGE-PO-${start}`)!;
    expect(po.champion).not.toBeNull();
    expect(w.user.approval.history.length).toBeGreaterThan(40);
    // graduating seniors are gone
    for (const id of before) expect(w.players.find((p) => p.id === id)!.teamId === cid && !w.players.find((p) => p.id === id)!.retired).toBe(false);
    console.log('rep', w.user.reputation, 'security', jobSecurity(w), 'fans', w.user.approval.fans, 'board', w.user.approval.board, 'employed', w.user.clubId != null, 'offers', offers, 'roster', w.user.clubId ? roster(w, w.user.clubId).length : '-');
    console.log(w.user.approval.notes.slice(0, 6).map((x) => `${x.who}: ${x.text} (${x.delta})`).join('\n'));
  }, 60000);
});
