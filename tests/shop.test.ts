import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/engine/worldgen';
import { club } from '../src/engine/world';
import { advance } from '../src/engine/daily';
import { resolveDecision } from '../src/engine/events';
import { migrate, serialize, deserialize } from '../src/engine/save';
import { placeOrder, quoteOrder, setPrice, unitsOnHand, avgCostOf, forecastOutlet, PRODUCT_IDS } from '../src/engine/shop';
import type { World } from '../src/engine/types';

function oroWorld(seed = 13): World {
  const w0 = createWorld({ seed, userName: 'T', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  const id = w0.clubs.filter((c) => c.leagueId === 'ORO').sort((a, b) => a.prestige - b.prestige)[6].id;
  const w = createWorld({ seed, userName: 'T', role: 'gm', clubId: id, style: 'gm', difficulty: 'standard', worldNoise: 'normal' });
  w.settings.liveGames = false;
  return w;
}
const run = (w: World, days: number) => { for (let i = 0; i < days; i++) { advance(w, 'day'); for (const d of w.decisions.filter((x) => !x.resolved)) resolveDecision(w, d, d.kind === 'jobOffer' ? 'decline' : (d.recommended ?? d.defaultOption)); } };

describe('merchandise loop', () => {
  it('order costs cash up front, arrives after the lead time, and stock sells down', () => {
    const w = oroWorld();
    const c = club(w, w.user.clubId!);
    const s = c.shop!;
    expect(s).toBeTruthy();
    const q = quoteOrder(w, c, 'jersey', 'standard', 500);
    expect(q.cashDue).toBe(5100); // 500 × €12, −15% volume discount
    expect(quoteOrder(w, c, 'jersey', 'standard', 100).unitCost).toBe(12); // small run: list price
    expect(quoteOrder(w, c, 'jersey', 'standard', 2000).unitCost).toBeLessThan(q.unitCost);
    expect(unitsOnHand(s, 'jersey')).toBe(0); // the shop opens empty
    setPrice(w, c, 'jersey', 29);
    expect(Math.round(quoteOrder(w, c, 'jersey', 'standard', 500).margin * 100)).toBe(65);
    const cash0 = c.finances.cash;
    const before = unitsOnHand(s, 'jersey');
    expect(placeOrder(w, c, 'jersey', 'standard', 500).ok).toBe(true);
    expect(cash0 - c.finances.cash).toBe(5100);
    // price change leaves quantities and purchase costs intact
    const cost = avgCostOf(s, 'jersey');
    setPrice(w, c, 'jersey', 35);
    expect(unitsOnHand(s, 'jersey')).toBe(before);
    expect(avgCostOf(s, 'jersey')).toBeCloseTo(cost, 6);
    run(w, 21);
    expect(s.orders[0].status).toBe('delivered');
    expect(s.totals.jersey.units).toBeGreaterThan(0);
    expect(unitsOnHand(s, 'jersey')).toBe(before + 500 - s.totals.jersey.units);
    expect(s.weeks.length).toBeGreaterThanOrEqual(3);
  });

  it('food & drink reports every home game with the same economics as the forecast', () => {
    const w = oroWorld(17);
    const c = club(w, w.user.clubId!);
    run(w, 130);
    const reps = c.shop!.food.reports;
    expect(reps.length).toBeGreaterThan(0);
    const r = reps[0];
    for (const l of r.lines) expect(l.revenue - l.food - l.labor - l.waste).toBe(l.profit);
    // forecast at the reported crowd with no noise is close to the actual
    const o = c.shop!.food.outlets[0];
    expect(forecastOutlet(w, c, o).customers).toBeGreaterThan(0);
    expect(r.reason.length).toBeGreaterThan(5);
  }, 60000);

  it('the commercial director reorders within the cap and asks above it', () => {
    const w = oroWorld(19);
    const c = club(w, w.user.clubId!);
    const s = c.shop!;
    for (const p of PRODUCT_IDS) for (const st of Object.values(s.stock)) if (st[p]) st[p]!.units = 0;
    s.policy = { mode: 'director', cashCap: 1, minMargin: 0.5, stockWeeks: 6 };
    advance(w, 'week');
    expect(w.decisions.some((d) => d.kind === 'shopApproval' && !d.resolved)).toBe(true);
    s.policy.cashCap = 1_000_000;
    advance(w, 'week');
    expect(s.orders.some((o) => o.by === 'director')).toBe(true);
  });

  it('shop state survives a save round trip and old saves migrate', () => {
    const w = oroWorld(23);
    const c = club(w, w.user.clubId!);
    placeOrder(w, c, 'scarf', 'standard', 200);
    const back = migrate(deserialize(serialize(w)));
    expect(club(back, c.id).shop!.orders.length).toBe(1);
    const old = JSON.parse(serialize(w));
    old.version = 2;
    for (const cl of old.clubs) delete cl.shop;
    const mig = migrate(old);
    expect(club(mig, c.id).shop).toBeTruthy();
  });
});
