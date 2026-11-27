import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { club } from '../src/engine/world';
import { careerStartOffers, jobMarket, lowestTier } from '../src/engine/career';

describe('job offers', () => {
  it('a new career only gets offers from the bottom division, and nobody bigger calls before a full season', () => {
    for (const nationality of ['ESP', 'FRA', 'BRA']) {
      const w = createWorld({ seed: 5, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal', nationality });
      careerStartOffers(w);
      const offers = w.decisions.filter((d) => d.kind === 'jobOffer').map((d) => club(w, d.payload.clubId as number));
      expect(offers.length).toBeGreaterThan(0);
      for (const c of offers) if (c.leagueId !== 'COLLEGE') expect(w.rules.leagues[c.leagueId!].tier).toBe(lowestTier(w));
      w.user.reputation = 90;
      for (let i = 0; i < 30; i++) jobMarket(w, true);
      const later = w.decisions.filter((d) => d.kind === 'jobOffer').map((d) => club(w, d.payload.clubId as number));
      for (const c of later) if (c.leagueId !== 'COLLEGE') expect(w.rules.leagues[c.leagueId!].tier).toBe(lowestTier(w));
    }
  });
});
