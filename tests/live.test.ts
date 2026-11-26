import { describe, it, expect } from 'vitest';
import { createWorld, assignUser } from '../src/engine/worldgen';
import { advance } from '../src/engine/daily';
import { startLiveFixture, playFixture } from '../src/engine/matchday';
import { fixture } from '../src/engine/world';

describe('live games', () => {
  it('stops before the user game, plays quarter by quarter with a minute timeline, then applies the result', () => {
    const w = createWorld({ seed: 77, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'quiet' });
    const cid = w.clubs.find((c) => c.leagueId === 'ORO')!.id;
    assignUser(w, { userName: 'T', role: 'gm', clubId: cid, style: 'gm', difficulty: 'standard', worldNoise: 'quiet' });
    let res = advance(w, 'nextGame');
    for (let i = 0; i < 30 && res.liveFixtureId == null; i++) res = advance(w, 'nextGame');
    expect(res.liveFixtureId).toBeDefined();
    const f = fixture(w, res.liveFixtureId!);
    expect(f.played).toBe(false);
    const live = startLiveFixture(w, f);
    live.playPeriod();
    expect(live.timeline.length).toBe(10);
    expect(live.q).toBe(1);
    const t = { ...live.teams[0].inp.tactics, pace: 'fast' as const };
    live.setTactics(0, t);
    live.playAll();
    expect(live.timeline.length).toBeGreaterThanOrEqual(40);
    const [h, a] = live.score();
    expect(live.timeline[live.timeline.length - 1]).toMatchObject({ h, a });
    expect(live.events.some((e) => e.kind === 'three' || e.kind === 'layup')).toBe(true);
    const log = playFixture(w, f, live)!;
    expect(f.played).toBe(true);
    expect(f.result).toMatchObject({ home: h, away: a });
    expect(log.flow!.length).toBe(live.timeline.length);
    // the day continues without stopping again
    const after = advance(w, 'day');
    expect(after.liveFixtureId).toBeUndefined();
  });
});
