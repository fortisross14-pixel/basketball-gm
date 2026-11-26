import { describe, it, expect } from 'vitest';
import { simulateGame, type SimTeamIn, type SimPlayerIn } from '../src/engine/sim/game';
import { generateRatings, computeOvr } from '../src/engine/player';
import { Rng } from '../src/engine/rng';
import type { Position, Tactics } from '../src/engine/types';

export function tactics(over: Partial<Tactics> = {}): Tactics {
  return { off: 'motion', def: 'switch', pace: 'normal', rotation: 'balanced', threeEmphasis: 0, reboundEmphasis: 0, foulDiscipline: 0, starUsage: 0, starters: [], rotationOrder: [], minuteLimits: {}, ...over };
}

let nid = 1;
function team(r: Rng, base: number, t: Partial<Tactics> = {}): SimTeamIn {
  const pos: Position[] = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF'];
  const players: SimPlayerIn[] = pos.map((p, i) => {
    const ratings = generateRatings(r, p, base - i * 1.2);
    return { id: nid++, name: 'P' + i, pos: p, ratings, ovr: computeOvr(ratings, p), heightCm: 185 + ['PG','SG','SF','PF','C'].indexOf(p) * 7, freshness: 100, morale: 65, form: 0, clutch: 50, injuryProne: 30, age: 26 };
  });
  return { clubId: nid++, players, tactics: tactics(t), coach: { rating: 60, offPref: 'motion', defPref: 'switch', motivation: 60 }, assistOff: 50, assistDef: 50, analytics: 50, medical: 50, physio: 50, cohesion: 60 };
}

describe('game sim', () => {
  it('produces credible FIBA box scores', () => {
    const r = new Rng(42);
    let pts = 0, fga = 0, tpa = 0, fta = 0, tov = 0, ast = 0, orb = 0, homeW = 0, ot = 0, starterMin = 0, benchMin = 0, inj = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const res = simulateGame(team(r, 60), team(r, 60), r);
      for (const t of res.teams) {
        pts += t.score;
        for (const p of t.players) { fga += p.fga; tpa += p.tpa; fta += p.fta; tov += p.tov; ast += p.ast; orb += p.orb; if (p.starter) starterMin += p.min; else benchMin += p.min; }
      }
      if (res.teams[0].score > res.teams[1].score) homeW++;
      ot += res.ot ? 1 : 0;
      inj += res.injuries.length;
    }
    const g = N * 2;
    const out = { pts: pts / g, fga: fga / g, tpa: tpa / g, fta: fta / g, tov: tov / g, ast: ast / g, orb: orb / g, home: homeW / N, ot: ot / N, starterMin: starterMin / g / 5, benchMinTot: benchMin / g, inj: inj / N };
    console.log(out);
    expect(out.pts).toBeGreaterThan(70);
    expect(out.pts).toBeLessThan(92);
  });
  it('better team wins more', () => {
    const r = new Rng(7);
    let w = 0;
    for (let i = 0; i < 300; i++) {
      const res = simulateGame(team(r, 66), team(r, 58), r, false);
      if (res.teams[0].score > res.teams[1].score) w++;
    }
    console.log('strong win%', w / 300);
    expect(w / 300).toBeGreaterThan(0.7);
  });
});
