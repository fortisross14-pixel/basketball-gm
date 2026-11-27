import { describe, it, expect } from 'vitest';
import { createWorld, assignUser } from '../src/engine/worldgen';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { club, roster, freeAgents } from '../src/engine/world';
import { licenceCheck } from '../src/engine/season';
import { offerContract, registrationCheck, bidForPlayer } from '../src/engine/market';
import { salaryAsk, roleFor } from '../src/engine/player';
import { serialize, deserialize } from '../src/engine/save';
import { buildDigest } from '../src/engine/digest';
import type { World } from '../src/engine/types';

function world(seed = 99): World {
  const w = createWorld({ seed, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  w.settings.liveGames = false;
  const cid = w.clubs.find((c) => c.leagueId === 'ORO')!.id;
  assignUser(w, { userName: 'T', role: 'gm', clubId: cid, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  return w;
}

function playUntil(w: World, pred: () => boolean, max = 400) {
  let n = 0;
  while (!pred() && n < max) {
    const r = advance(w, 'day');
    n += r.days;
    for (const d of w.decisions.filter((x) => !x.resolved)) resolveDecision(w, d, d.recommended ?? d.defaultOption);
  }
}

describe('schedule', () => {
  it('no club plays twice on the same day and every league club gets 30 games', () => {
    const w = world();
    const seen = new Set<string>();
    for (const f of w.fixtures) {
      for (const id of [f.homeId, f.awayId]) {
        const k = `${id}-${f.day}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    // double round robin inside each league (or group): everyone plays each opponent home and away
    for (const c of w.clubs.filter((x) => x.leagueId)) {
      const mates = w.clubs.filter((x) => x.leagueId === c.leagueId && x.group === c.group).length;
      expect(w.fixtures.filter((f) => f.comp === 'league' && (f.homeId === c.id || f.awayId === c.id)).length).toBe(2 * (mates - 1));
      expect(w.fixtures.filter((f) => f.comp === 'league' && f.homeId === c.id).length).toBe(mates - 1);
    }
  });
});

describe('registration rules', () => {
  it('blocks a signing that breaks the non-EU quota with an explanation', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    const nonEu = freeAgents(w).find((p) => p.region === 'NONEU')!;
    // fill quota
    const rules = w.rules.leagues[c.leagueId!];
    let n = roster(w, c.id).filter((p) => p.region === 'NONEU').length;
    for (const p of roster(w, c.id)) { if (n >= rules.maxNonEU) break; if (p.region !== 'NONEU') { p.region = 'NONEU'; n++; } }
    const res = registrationCheck(w, c, nonEu);
    expect(res.ok).toBe(false);
    expect(res.reasons.join(' ')).toMatch(/Non-EU/);
  });
});

describe('negotiation', () => {
  it('a generous offer is accepted and a lowball is countered or refused', () => {
    const w = world(5);
    const c = club(w, w.user.clubId!);
    // make room
    const fa = freeAgents(w).filter((p) => registrationCheck(w, c, p).ok).sort((a, b) => a.ovr - b.ovr)[0];
    const low = offerContract(w, c, fa, { salary: Math.round(salaryAsk(w, fa, c) * 0.3), years: 1, role: 'bench', buyout: null, signingBonus: 0 }, 'sign');
    expect(['counter', 'walked', 'blocked']).toContain(low.outcome);
    w.user.negotiations = [];
    const high = offerContract(w, c, fa, { salary: Math.round(salaryAsk(w, fa, c) * 1.6), years: 2, role: 'star', buyout: null, signingBonus: 20000 }, 'sign');
    if (high.outcome !== 'blocked') expect(high.outcome).toBe('accepted');
    void roleFor;
  });
  it('bids meeting a release clause are accepted', () => {
    const w = world(6);
    w.day = 10;
    const target = w.players.find((p) => p.teamId != null && p.teamId !== w.user.clubId && p.contract?.buyout && !p.academy)!;
    const c = club(w, w.user.clubId!);
    c.finances.cash = target.contract!.buyout! * 2;
    const r = bidForPlayer(w, c, target, target.contract!.buyout!);
    expect(r.outcome).toBe('accepted');
  });
});

describe('promotion licensing', () => {
  it('denies promotion to a club whose arena is too small', () => {
    const w = world();
    const c = club(w, w.user.clubId!);
    c.arena.seats = { general: 1500, lower: 600, premium: 100 };
    const lic = licenceCheck(w, c, 'ELITE');
    expect(lic.ok).toBe(false);
    expect(lic.reasons[0]).toMatch(/capacity/i);
  });
});

describe('season cycle', () => {
  it('promotes/relegates consistently, keeps league sizes and survives save/load mid-season', () => {
    const w = world(42);
    playUntil(w, () => w.day > 150);
    const w2 = deserialize(serialize(w));
    expect(w2.fixtures.length).toBe(w.fixtures.length);
    const start = w2.season;
    playUntil(w2, () => w2.season > start, 400);
    for (const lid of ['ELITE', 'ORO', 'PLATA', 'TERCERA'] as const) expect(w2.clubs.filter((c) => c.leagueId === lid).length).toBe(w2.rules.leagues[lid].teams);
    const moved = w2.clubs.filter((c) => c.history[c.history.length - 1]?.promoted || c.history[c.history.length - 1]?.relegated);
    expect(moved.length).toBeGreaterThanOrEqual(4);
    // all knockout competitions finished with a champion
    for (const cmp of w2.competitions.filter((x) => x.season === start && x.kind !== 'league')) expect(cmp.champion).not.toBeNull();
    expect(buildDigest(w2)).toBeInstanceOf(Array);
  }, 60000);
});
