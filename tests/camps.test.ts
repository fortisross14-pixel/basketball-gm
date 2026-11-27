import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { club } from '../src/engine/world';
import { advance } from '../src/engine/daily';
import { CAMPS, bookCamp, campQuote, campWindow } from '../src/engine/camps';
import { friendlyQuote } from '../src/engine/extras';

function world() {
  const w0 = createWorld({ seed: 41, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  const id = w0.clubs.filter((c) => c.leagueId === 'ORO')[4].id;
  const w = createWorld({ seed: 41, userName: 'T', role: 'gm', clubId: id, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  w.settings.liveGames = false;
  return w;
}

describe('training camps', () => {
  it('offers 12 destinations; Portugal is cheaper than Qatar from Spain and Qatar trains more', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    expect(CAMPS.length).toBe(12);
    const pt = campQuote(w, c, CAMPS.find((d) => d.id === 'algarve')!);
    const qa = campQuote(w, c, CAMPS.find((d) => d.id === 'doha')!);
    expect(pt.total).toBeLessThan(qa.total);
    expect(qa.devSessions).toBeGreaterThan(pt.devSessions);
  });
  it('a booked camp blocks friendlies and builds cohesion and match shape when it ends', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    c.finances.cash = 1_000_000;
    const start = campWindow(w).from + 2;
    expect(bookCamp(w, c, 'algarve', start).ok).toBe(true);
    const opp = w.clubs.find((x) => x.leagueId === 'ORO' && x.id !== c.id)!;
    expect(friendlyQuote(w, c, opp, start + 3, true).ok).toBe(false);
    const coh = c.cohesion;
    while (w.day <= start + 10) advance(w, 'day');
    expect(c.camp!.done).toBe(true);
    expect(c.cohesion).toBeGreaterThan(coh);
  });
});
