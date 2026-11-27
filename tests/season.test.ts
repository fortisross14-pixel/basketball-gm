import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { club, roster } from '../src/engine/world';
import { statement } from '../src/engine/finance';
import { serialize, deserialize } from '../src/engine/save';
import type { World } from '../src/engine/types';

function autoplay(w: World, days: number) {
  let left = days;
  while (left > 0 && !w.gameOver) {
    const r = advance(w, 'nextEvent', left);
    left -= r.days;
    for (const d of w.decisions.filter((x) => !x.resolved)) resolveDecision(w, d, d.recommended ?? d.defaultOption);
    for (const o of [...w.tvOffers]) { void o; }
  }
}

describe('full seasons', () => {
  it('runs 3 seasons with sane economy and valid structure', () => {
    const t0 = Date.now();
    const oro = 0;
    const w = createWorld({ seed: 1234, userName: 'Test', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
    w.settings.liveGames = false;
    const userId = w.clubs.find((c) => c.leagueId === 'ORO')!.id;
    w.user.clubId = userId;
    void oro;
    console.log('gen ms', Date.now() - t0);
    for (let s = 0; s < 3; s++) {
      const t = Date.now();
      const season = w.season;
      autoplay(w, 370);
      console.log('season', season, 'ms', Date.now() - t, 'now', w.season, w.day);
      // league sizes stable
      for (const lid of ['ELITE', 'ORO', 'PLATA', 'TERCERA', 'COLLEGE', 'NBA'] as const) expect(w.clubs.filter((c) => c.leagueId === lid).length).toBe(w.rules.leagues[lid].teams);
      const lines = w.clubs.filter((c) => !c.foreign).map((c) => {
        const st = statement(c, season);
        return { n: c.abbrev, lg: c.history[c.history.length - 1]?.leagueId, rank: c.history[c.history.length - 1]?.rank, rev: Math.round(st.totalIncome / 1000), net: Math.round(st.net / 1000), cash: Math.round(c.finances.cash / 1000), roster: roster(w, c.id).length, att: c.history[c.history.length - 1]?.attendance };
      });
      console.table(lines.slice(0, 48).filter((_, i) => i % 3 === 0));
      const neg = lines.filter((l) => l.cash < -500).length;
      console.log('clubs with cash < -500k', neg, 'user', club(w, userId).finances.cash);
    }
    // each club played 30 league games in final season standings recorded
    const hist = w.clubs.filter((c) => !c.foreign).map((c) => c.history[c.history.length - 1]);
    for (const h of hist) expect(h.wins + h.losses).toBe(30);
    // save roundtrip
    const json = serialize(w);
    console.log('save size KB', Math.round(json.length / 1024));
    const w2 = deserialize(json);
    expect(w2.players.length).toBe(w.players.length);
  }, 120000);
});
