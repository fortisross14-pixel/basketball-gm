import { describe, it, expect } from 'vitest';
import { createWorld, assignUser } from '../src/engine/worldgen';
import { advance } from '../src/engine/daily';
import { club, roster } from '../src/engine/world';
import { listForQuickSale, quickSalePrice, friendlyQuote, scheduleFriendly, bodyOf } from '../src/engine/extras';
import { playFixture } from '../src/engine/matchday';

function world() {
  const w = createWorld({ seed: 31, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'quiet' });
  w.settings.liveGames = false;
  const cid = w.clubs.find((c) => c.leagueId === 'ORO')!.id;
  assignUser(w, { userName: 'T', role: 'gm', clubId: cid, style: 'gm', difficulty: 'standard', worldNoise: 'quiet' });
  return w;
}

describe('quick sale', () => {
  it('sells the player the next day for a minimal fee', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    const p = roster(w, c.id).sort((a, b) => b.ovr - a.ovr)[3];
    const fee = quickSalePrice(w, p);
    expect(fee).toBeLessThan(p.value);
    const before = c.finances.seasonTotals[w.season]?.transfersIn ?? 0;
    expect(listForQuickSale(w, c, p).ok).toBe(true);
    advance(w, 'day');
    expect(p.teamId).not.toBe(c.id);
    expect((c.finances.seasonTotals[w.season]?.transfersIn ?? 0) - before).toBe(fee);
  });
});

describe('friendlies', () => {
  it('schedules a friendly on a free day, plays it without touching standings', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    const opp = w.clubs.find((x) => x.leagueId === 'PLATA')!;
    const q = friendlyQuote(w, c, opp, 40, true);
    expect(q.ok).toBe(true);
    expect(scheduleFriendly(w, c, opp, 40, true).ok).toBe(true);
    const f = w.fixtures.find((x) => x.comp === 'friendly')!;
    const cohesion = c.cohesion;
    playFixture(w, f);
    expect(f.played).toBe(true);
    expect(c.cohesion).toBeGreaterThan(cohesion);
    const lc = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`)!;
    expect(lc.standings.every((s) => s.w + s.l === 0)).toBe(true);
    // rejected when too close to a league game
    const league = w.fixtures.find((x) => x.comp === 'league' && x.homeId === c.id)!;
    expect(friendlyQuote(w, c, opp, league.day, true).ok).toBe(false);
  });
});

describe('body types', () => {
  it('gives every player a frame, weight and skin tone', () => {
    const w = world();
    const b = bodyOf(w, roster(w, w.user.clubId!)[0]);
    expect(b.weightKg).toBeGreaterThan(60);
    expect(b.skin).toMatch(/^#/);
  });
});
