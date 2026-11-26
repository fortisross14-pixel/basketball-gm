import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { club } from '../src/engine/world';
import { planScores, presetPlan, styleReaction, stakeholderViews } from '../src/engine/gameplan';
import { quickDeals, takeQuickDeal } from '../src/engine/fundraising';
import { freeAgentDiscount } from '../src/engine/player';
import { payrollRoom } from '../src/engine/finance';
import type { World } from '../src/engine/types';

function plataWorld(): World {
  const w0 = createWorld({ seed: 9, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  const id = w0.clubs.filter((c) => c.leagueId === 'PLATA').sort((a, b) => a.prestige - b.prestige)[0].id;
  const w = createWorld({ seed: 9, userName: 'T', role: 'gm', clubId: id, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  w.settings.liveGames = false;
  return w;
}

describe('game plan', () => {
  it('presets maximise their stakeholder and four views are shown', () => {
    const w = plataWorld();
    const c = club(w, w.user.clubId!);
    for (const who of ['coach', 'players', 'fans', 'owner'] as const) {
      const p = presetPlan(w, c, who);
      expect(planScores(w, c, p)[who]).toBeGreaterThanOrEqual(0.9);
    }
    expect(stakeholderViews(w, c)).toHaveLength(4);
  });
  it('winning in the fans\' style earns goodwill, losing against it costs more', () => {
    const w = plataWorld();
    const c = club(w, w.user.clubId!);
    Object.assign(c.tactics, presetPlan(w, c, 'fans'));
    const b0 = w.user.approval.fanBonus;
    styleReaction(w, c, true);
    const liked = w.user.approval.fanBonus - b0;
    // pick the plan fans like least
    let worst = presetPlan(w, c, 'fans');
    let lo = 1;
    for (const off of ['paceSpace', 'motion', 'pnr', 'post', 'isolation'] as const) for (const def of ['switch', 'drop', 'packPaint', 'pressure', 'zone'] as const) for (const pace of ['slow', 'normal', 'fast'] as const) {
      const s = planScores(w, c, { off, def, pace }).fans;
      if (s < lo) { lo = s; worst = { off, def, pace }; }
    }
    Object.assign(c.tactics, worst);
    const b1 = w.user.approval.fanBonus;
    styleReaction(w, c, false);
    expect(liked).toBeGreaterThan(0);
    expect(w.user.approval.fanBonus - b1).toBeLessThan(-0.8);
  });
});

describe('revenue drive', () => {
  it('quick deals raise cash and payroll room; the members drive runs once a season', () => {
    const w = plataWorld();
    const c = club(w, w.user.clubId!);
    const cash0 = c.finances.cash;
    const room0 = payrollRoom(w, c);
    expect(takeQuickDeal(w, c, 'naming', 'upfront').ok).toBe(true);
    expect(takeQuickDeal(w, c, 'membership', 'run').ok).toBe(true);
    expect(takeQuickDeal(w, c, 'membership', 'run').ok).toBe(false);
    expect(takeQuickDeal(w, c, 'naming', 'standard').ok).toBe(false);
    expect(c.finances.cash - cash0).toBeGreaterThan(30000);
    expect(payrollRoom(w, c) - room0).toBeGreaterThan(20000);
    expect(quickDeals(w, c).find((d) => d.kind === 'naming')!.available).toBe(false);
  });
  it('free-agent asks fall as the season approaches', () => {
    const w = plataWorld();
    expect(freeAgentDiscount(w)).toBe(1);
    w.day = 80;
    expect(freeAgentDiscount(w)).toBeLessThan(0.85);
  });
});
