import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { club, roster } from '../src/engine/world';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { planEvent, eventBlocked } from '../src/engine/clubEvents';
import { askCoach, requestMatches } from '../src/engine/coachRequests';
import { migrate } from '../src/engine/save';
import type { World } from '../src/engine/types';

function world(seed = 21): World {
  const w0 = createWorld({ seed, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  const id = w0.clubs.filter((c) => c.leagueId === 'ORO')[3].id;
  const w = createWorld({ seed, userName: 'T', role: 'gm', clubId: id, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  w.settings.liveGames = false;
  return w;
}
const run = (w: World, days: number) => { for (let i = 0; i < days; i++) { advance(w, 'day'); for (const d of w.decisions.filter((x) => !x.resolved)) resolveDecision(w, d, d.kind === 'jobOffer' ? 'decline' : (d.recommended ?? d.defaultOption)); } };

describe('club events', () => {
  it('a team dinner is paid on the day and lifts morale and cohesion', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    const morale0 = roster(w, c.id).reduce((a, p) => a + p.morale, 0);
    const coh0 = c.cohesion;
    expect(planEvent(w, 'dinner', w.day + 3).ok).toBe(true);
    expect(eventBlocked(w, c, w.day + 3)).toMatch(/already an event/);
    run(w, 4);
    const ev = w.user.events![0];
    expect(ev.status).toBe('done');
    expect(c.cohesion).toBeGreaterThanOrEqual(coh0);
    expect(roster(w, c.id).reduce((a, p) => a + p.morale, 0)).toBeGreaterThan(morale0 - 40);
  });

  it('a sponsor activation earns a fee from that partner', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    const deal = c.sponsors[0];
    expect(deal).toBeTruthy();
    const fit0 = deal.fit;
    expect(planEvent(w, 'launch', w.day + 2, deal.id).ok).toBe(true);
    run(w, 3);
    expect(deal.fit).toBeGreaterThan(fit0);
    expect(w.user.events![0].result).toMatch(/activation fee/);
  });
});

describe('coach requests', () => {
  it('the coach names a profile and lists candidates; old saves load', () => {
    const w = world();
    const r = askCoach(w);
    expect(r.ok).toBe(true);
    const req = w.user.coachRequests![0];
    expect(req.keys.length).toBe(3);
    expect(requestMatches(w, req).length).toBeGreaterThan(0);
    expect(askCoach(w).ok).toBe(false); // two-week cooldown
    const old = JSON.parse(JSON.stringify(w)) as World;
    delete old.user.coachRequests; delete old.user.events;
    old.rules.leagues.ELITE.name = 'Liga Élite';
    const m = migrate(old);
    expect(m.rules.leagues.ELITE.name).toBe('Liga ACB');
  });
});
