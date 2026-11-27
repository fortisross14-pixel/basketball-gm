import { describe, it, expect } from 'vitest';
import { createWorld, assignUser } from '../src/engine/worldgen';
import { club, staffOf } from '../src/engine/world';
import { careerStartOffers } from '../src/engine/career';
import { resolveDecision } from '../src/engine/events';
import { coachingMarket, recordCoachSeasons, candidateScore } from '../src/engine/coaching';
import { licenceCheck } from '../src/engine/season';
import { groundShareOffer, signGroundShare, licencePlan } from '../src/engine/licence';
import { advance } from '../src/engine/daily';
import type { World } from '../src/engine/types';

const opts = (d: 'relaxed' | 'standard') => ({ userName: 'T', role: 'gm' as const, clubId: null, style: 'gm' as const, difficulty: d, worldNoise: 'normal' as const });

describe('relaxed opening', () => {
  it('the first accepted job gets the same cash and patience support as picking a club directly', () => {
    const base = createWorld({ seed: 31, ...opts('relaxed') });
    const w: World = createWorld({ seed: 31, ...opts('relaxed') });
    w.settings.liveGames = false;
    assignUser(w, { ...opts('relaxed'), nationality: 'ESP', background: 'business' });
    careerStartOffers(w);
    const offer = w.decisions.find((d) => d.kind === 'jobOffer')!;
    const id = offer.payload.clubId as number;
    const cash0 = club(base, id).finances.cash;
    const pat0 = club(base, id).board.patience;
    resolveDecision(w, offer, 'accept');
    expect(w.user.clubId).toBe(id);
    const c = club(w, id);
    if (cash0 > 0) expect(c.finances.cash).toBeGreaterThanOrEqual(Math.round(cash0 * 1.5) - 1);
    expect(c.board.patience).toBeGreaterThanOrEqual(Math.min(100, Math.round(pat0 * 1.3)) - 1);
    expect(c.shop).toBeTruthy();
  });
});

describe('promotion licence routes', () => {
  it('a ground-share counts towards the seat requirement', () => {
    const w0 = createWorld({ seed: 33, ...opts('standard') });
    const small = w0.clubs.filter((c) => c.leagueId === 'ORO').sort((a, b) => (a.arena.seats.general + a.arena.seats.lower + a.arena.seats.premium) - (b.arena.seats.general + b.arena.seats.lower + b.arena.seats.premium))[0];
    const w = createWorld({ seed: 33, ...opts('standard'), clubId: small.id });
    const c = club(w, small.id);
    expect(licenceCheck(w, c, 'ELITE').reasons.some((r) => /capacity/.test(r))).toBe(true);
    c.finances.cash = 5_000_000;
    expect(groundShareOffer(w, c)).toBeTruthy();
    expect(signGroundShare(w, c).ok).toBe(true);
    expect(licenceCheck(w, c, 'ELITE').reasons.some((r) => /capacity/.test(r))).toBe(false);
    expect(licencePlan(w, c)!.items[0].ok).toBe(true);
  });
});

describe('coaching careers', () => {
  it('records seasons, fills vacancies and the NBA appoints top European coaches', () => {
    const w = createWorld({ seed: 35, ...opts('standard') });
    w.settings.liveGames = false;
    const start = w.season;
    let n = 0;
    while (w.season === start && n++ < 60) advance(w, 'week');
    expect(w.season).toBe(start + 1);
    const withRecord = w.staff.filter((s) => (s.record ?? []).length > 0);
    expect(withRecord.length).toBeGreaterThan(30);
    for (const c of w.clubs.filter((x) => x.leagueId && !x.foreign)) expect(staffOf(w, c, 'headCoach')).toBeTruthy();
    // force a star coach and run the market
    const star = staffOf(w, w.clubs.find((c) => c.leagueId === 'ELITE')!, 'headCoach')!;
    star.reputation = 97;
    star.record!.push({ season: w.season - 1, clubId: star.teamId, clubName: 'X', league: 'Liga ACB', level: 1, wins: 25, losses: 5, expected: 0.5, rank: 1, honours: ['EuroCup winner'], score: 20 });
    for (let i = 0; i < 6 && !star.nba; i++) coachingMarket(w);
    expect(star.nba).toBeTruthy();
    expect(star.teamId).toBeNull();
    expect(w.news.some((x) => /NBA/.test(x.headline))).toBe(true);
    void recordCoachSeasons; void candidateScore;
  }, 60000);
});
