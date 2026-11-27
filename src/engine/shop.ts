// Playable merchandise and food & drink for the user's club.
//
// Merchandise: order (cash up front) → delivery after the supplier's lead time → allocated
// units in each store → weekly sales draw down finite stock → reorder, move stock or clear.
// Food & drink: each home game, every outlet serves customers from the crowd mix, limited by
// service capacity; revenue minus food cost, labour and waste is the outlet's profit.
// Forecasts and actual results call the same demand functions; actuals only add randomness
// and the stock / capacity limits, and every report states the main reason they differ.
import type { Club, ClubStore, Decision, FoodConceptId, FoodLine, FoodOutlet, FoodReport, MerchOrder, ProductId, SeatZone, ShopState, ShopWeek, StockBucket, SupplierId, World } from './types';
import { absDay, SEAT_ZONES } from './types';
import { addNews, book, fmtMoney, hold, isUser, nextId, rng, staffRating, tierOf } from './world';
import { ensureFacilities, managerFactor } from './facilities';
import { buildCalendar, monthOf } from './calendar';
import { starPower, RESTAURANT_EVENTS, inEuro } from './economy';
import { signGroundShare, takePayrollBridge } from './licence';
import { clamp } from './rng';

// ------------------------------------------------------------------ catalogue
export const PRODUCTS: Record<ProductId, { label: string; plural: string; cost: number; ref: Record<number, number>; mix: number; elasticity: number }> = {
  jersey: { label: 'Replica jersey', plural: 'jerseys', cost: 12, ref: { 0: 85, 1: 72, 2: 42, 3: 32 }, mix: 0.34, elasticity: 1.3 },
  scarf: { label: 'Bar scarf', plural: 'scarves', cost: 4.5, ref: { 0: 25, 1: 22, 2: 17, 3: 14 }, mix: 0.24, elasticity: 1.5 },
  cap: { label: 'Snapback cap', plural: 'caps', cost: 5.5, ref: { 0: 30, 1: 26, 2: 20, 3: 17 }, mix: 0.18, elasticity: 1.4 },
  keychain: { label: 'Crest keychain', plural: 'keychains', cost: 1.2, ref: { 0: 9, 1: 8, 2: 6, 3: 5 }, mix: 0.24, elasticity: 1.7 },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

export const SUPPLIERS: Record<SupplierId, { label: string; costMult: number; leadDays: number; quality: number; minOrder: number; desc: string }> = {
  budget: { label: 'Budget factory (overseas)', costMult: 0.75, leadDays: 28, quality: 0.9, minOrder: 300, desc: 'Cheapest unit cost, four-week shipping, slightly lower appeal.' },
  standard: { label: 'Regional supplier', costMult: 1, leadDays: 12, quality: 1, minOrder: 100, desc: 'Reliable two-week delivery at the reference cost.' },
  premium: { label: 'Licensed premium maker', costMult: 1.45, leadDays: 8, quality: 1.15, minOrder: 50, desc: 'Fast, higher quality that sells better, expensive.' },
};

// ------------------------------------------------------------------ food concepts
export const CONCEPTS: Record<FoodConceptId, { label: string; desc: string; spend: number; elasticity: number; perPoint: number; foodPct: number; labor: number; fixed: number; mix: Record<SeatZone | 'suite', number> }> = {
  kiosk: { label: 'Family kiosk', desc: 'Hot dogs, popcorn and drinks. Cheap, fast, lives on volume.', spend: 7, elasticity: 1.7, perPoint: 260, foodPct: 0.3, labor: 90, fixed: 0, mix: { general: 0.5, lower: 0.38, premium: 0.12, suite: 0 } },
  grill: { label: 'Local grill', desc: 'Regional dishes off an open grill. Mid price, needs locals who stay.', spend: 14, elasticity: 1.2, perPoint: 110, foodPct: 0.38, labor: 160, fixed: 150, mix: { general: 0.1, lower: 0.22, premium: 0.25, suite: 0.1 } },
  lounge: { label: 'Premium lounge', desc: 'Seated dining for courtside and suite guests. High spend, high fixed cost.', spend: 48, elasticity: 0.7, perPoint: 45, foodPct: 0.32, labor: 420, fixed: 600, mix: { general: 0, lower: 0.03, premium: 0.5, suite: 0.85 } },
};
export const CONCEPT_IDS = Object.keys(CONCEPTS) as FoodConceptId[];
const SPEND_TIER: Record<number, number> = { 0: 1.25, 1: 1, 2: 0.7, 3: 0.55 };
const LABOR_TIER: Record<number, number> = { 0: 1.3, 1: 1, 2: 0.8, 3: 0.7 };

const SEASONALITY = [1.4, 0.8, 0.8, 0.9, 1.2, 0.7, 1.3, 1.3, 1.5, 1.0, 0.9, 2.2]; // Jan..Dec

export function refPriceOf(w: World, c: Club, p: ProductId): number {
  return Math.round(PRODUCTS[p].ref[tierOf(w, c)] * (0.85 + c.economy * 0.15));
}

/** Bigger runs are cheaper per unit (the factory sets up once). */
export const VOLUME_TIERS: { min: number; off: number }[] = [
  { min: 0, off: 0 }, { min: 250, off: 0.07 }, { min: 500, off: 0.15 }, { min: 1000, off: 0.25 }, { min: 2000, off: 0.35 },
];
export function volumeDiscount(units: number): number {
  let off = 0;
  for (const t of VOLUME_TIERS) if (units >= t.min) off = t.off;
  return off;
}

/** Cost per unit from a supplier; pass the order size to apply the volume discount. */
export function supplierCost(p: ProductId, s: SupplierId, units = 0): number {
  return Math.round(PRODUCTS[p].cost * SUPPLIERS[s].costMult * (1 - volumeDiscount(units)) * 100) / 100;
}

export function conceptRefSpend(w: World, c: Club, k: FoodConceptId): number {
  return Math.round(CONCEPTS[k].spend * SPEND_TIER[tierOf(w, c)] * (0.85 + c.economy * 0.15) * 2) / 2;
}

// ------------------------------------------------------------------ setup
function storesOf(w: World, c: Club): ClubStore[] {
  return ensureFacilities(w, c).stores;
}

export function maxPoints(c: Club, slot: FoodOutlet['slot']): number {
  const l = c.arena.levels;
  return slot === 'stands' ? 2 + l.concessions * 2 : slot === 'restaurant' ? 1 + l.restaurant : slot === 'lounge' ? 1 + l.hospitality : 2;
}

export function syncOutlets(w: World, c: Club, s: ShopState) {
  const has = (slot: FoodOutlet['slot']) => s.food.outlets.some((o) => o.slot === slot);
  const add = (slot: FoodOutlet['slot'], concept: FoodConceptId, points: number) => s.food.outlets.push({ id: nextId(w), slot, concept, price: conceptRefSpend(w, c, concept), points });
  if (!has('stands')) add('stands', 'kiosk', Math.min(maxPoints(c, 'stands'), 2 + c.arena.levels.concessions));
  if (c.arena.levels.restaurant > 0 && !has('restaurant')) add('restaurant', 'grill', maxPoints(c, 'restaurant'));
  if (c.arena.levels.hospitality > 0 && !has('lounge')) add('lounge', 'lounge', maxPoints(c, 'lounge'));
  for (const o of s.food.outlets) o.points = clamp(o.points, 1, maxPoints(c, o.slot));
}

/** Create the shop for a club (first time the user runs it). It opens with no stock. */
export function ensureShop(w: World, c: Club): ShopState {
  if (c.shop) { syncOutlets(w, c, c.shop); syncStores(w, c, c.shop); return c.shop; }
  const prices = Object.fromEntries(PRODUCT_IDS.map((p) => [p, refPriceOf(w, c, p)])) as Record<ProductId, number>;
  const s: ShopState = {
    prices, stock: {}, warehouse: {}, orders: [], weeks: [], season: w.season,
    totals: Object.fromEntries(PRODUCT_IDS.map((p) => [p, { units: 0, revenue: 0, cogs: 0, spent: 0 }])) as ShopState['totals'],
    food: { outlets: [], reports: [], offDaySeason: 0 },
    policy: { mode: 'manual', cashCap: Math.round(Math.max(3000, c.finances.cash * 0.05) / 500) * 500, minMargin: 0.5, stockWeeks: 6 },
  };
  c.shop = s;
  syncStores(w, c, s);
  // the shop opens empty: you decide what to make. Any stock the previous management left
  // behind is sold to a wholesaler.
  if (c.merch.stockValue > 0) book(w, c, 'other', Math.round(c.merch.stockValue * 0.6));
  c.merch.stockValue = 0;
  syncOutlets(w, c, s);
  return s;
}

function syncStores(w: World, c: Club, s: ShopState) {
  for (const st of storesOf(w, c)) s.stock[st.id] ??= {};
}

// ------------------------------------------------------------------ demand (shared by forecast and actuals)
function fanPool(w: World, c: Club): number {
  const f = c.fans;
  const base = f.local * 0.12 + f.regional * 0.04 + f.national * 0.04 + f.international * 0.06 + f.digital * 0.006;
  const hype = 0.6 + f.hype / 120;
  const star = 1 + Math.max(0, starPower(w, c)) * 0.6;
  const euro = inEuro(w, c) ? 1.06 : 1;
  return (base * 2.6 * hype * star * euro) / 52; // purchase occasions per week across all channels
}

function onlineShare(c: Club): number {
  return Math.min(0.75, 0.18 + c.arena.levels.onlineStore * 0.12);
}

/** Purchase occasions this store sees in a week (before price and product mix). */
export function storeAudience(w: World, c: Club, st: ClubStore, homeGames: number | null): number {
  const f = c.fans;
  const pool = fanPool(w, c);
  const mf = managerFactor(w, st) / 0.85;
  switch (st.kind) {
    case 'arena': {
      const base = pool * (1 - onlineShare(c)) * (0.55 + c.arena.levels.store * 0.15);
      // most arena sales happen on game nights; null = season-average week (forecasts)
      const g = homeGames == null ? 1 : homeGames > 0 ? 2.2 + (homeGames - 1) * 1.6 : 0.45;
      return base * g * mf;
    }
    case 'online': return pool * onlineShare(c) * (0.6 + c.arena.levels.onlineStore * 0.15) * mf;
    case 'city': return ((f.local * 0.4 + f.regional * 0.1) / 52) * (0.6 + f.hype / 120) * (0.7 + st.level * 0.3) * mf;
    case 'outlet': return ((f.regional * 0.15 + f.local * 0.06) / 52) * (0.6 + f.hype / 120) * (0.7 + st.level * 0.3) * mf * 1.25;
    case 'airport': return ((f.national * 0.25 + f.international * 0.5 + f.regional * 0.02) / 52) * (0.6 + f.hype / 120) * (0.7 + st.level * 0.3) * mf;
  }
}

/** Expected units demanded of one product in one store over `weeks` weeks at `price`. */
export function expectedDemand(w: World, c: Club, st: ClubStore, p: ProductId, price: number, weeks = 1, seasonal = true, homeGames: number | null = null, quality = 1): number {
  const info = PRODUCTS[p];
  const ref = refPriceOf(w, c, p) * (st.kind === 'outlet' ? 0.85 : st.kind === 'airport' ? 1.15 : 1);
  const priceF = Math.pow(ref / Math.max(0.5, price), info.elasticity);
  const season = seasonal ? SEASONALITY[monthOf(w.season, w.day)] : 1;
  return storeAudience(w, c, st, homeGames) * info.mix * priceF * season * quality * weeks;
}

/** Forecast weekly demand for a product across all stores at a price (season-average week). */
export function forecastWeekly(w: World, c: Club, p: ProductId, price = c.shop?.prices[p] ?? refPriceOf(w, c, p)): number {
  return storesOf(w, c).reduce((a, st) => a + expectedDemand(w, c, st, p, price, 1, true, null), 0);
}

export function unitsOnHand(s: ShopState, p: ProductId): number {
  return Object.values(s.stock).reduce((a, b) => a + (b[p]?.units ?? 0), 0) + (s.warehouse[p]?.units ?? 0);
}

export function unitsIncoming(s: ShopState, p: ProductId): number {
  return s.orders.filter((o) => o.status === 'ordered' && o.product === p).reduce((a, o) => a + o.units, 0);
}

export function avgCostOf(s: ShopState, p: ProductId): number {
  let u = 0, v = 0;
  for (const b of [...Object.values(s.stock).map((x) => x[p]), s.warehouse[p]]) if (b && b.units > 0) { u += b.units; v += b.units * b.avgCost; }
  return u > 0 ? v / u : 0;
}

export function marginAt(price: number, unitCost: number): number {
  return price > 0 ? (price - unitCost) / price : 0;
}

export function priceForMargin(unitCost: number, margin: number): number {
  return Math.max(1, Math.round((unitCost / Math.max(0.01, 1 - clamp(margin, 0, 0.95))) * 2) / 2);
}

// ------------------------------------------------------------------ orders
export interface OrderQuote {
  ok: boolean;
  reason?: string;
  unitCost: number;
  cashDue: number;
  arriveDay: number;
  weeklyDemand: number;
  weeksOfCover: number;
  margin: number;
  grossProfitIfSold: number;
  stockoutRisk: 'high' | 'medium' | 'low';
  overstockRisk: boolean;
  allocation: Record<number, number>;
}

/** Split units across stores in proportion to their forecast demand. */
export function defaultAllocation(w: World, c: Club, p: ProductId, units: number): Record<number, number> {
  const s = ensureShop(w, c);
  const st = storesOf(w, c);
  const d = st.map((x) => expectedDemand(w, c, x, p, s.prices[p], 1, false));
  const tot = d.reduce((a, b) => a + b, 0) || 1;
  const out: Record<number, number> = {};
  let left = units;
  st.forEach((x, i) => { const n = i === st.length - 1 ? left : Math.round((units * d[i]) / tot); out[x.id] = Math.max(0, Math.min(left, n)); left -= out[x.id]; });
  return out;
}

export function quoteOrder(w: World, c: Club, p: ProductId, supplier: SupplierId, units: number, allocation?: Record<number, number>): OrderQuote {
  const s = ensureShop(w, c);
  const sup = SUPPLIERS[supplier];
  const unitCost = supplierCost(p, supplier, units);
  const cashDue = Math.round(unitCost * units);
  const weekly = forecastWeekly(w, c, p);
  const cover = (unitsOnHand(s, p) + unitsIncoming(s, p) + units) / Math.max(0.1, weekly);
  const leadWeeks = sup.leadDays / 7;
  const onHandWeeks = unitsOnHand(s, p) / Math.max(0.1, weekly);
  const alloc = allocation ?? defaultAllocation(w, c, p, units);
  let reason: string | undefined;
  if (units < sup.minOrder) reason = `${sup.label} has a minimum order of ${sup.minOrder} units.`;
  else if (cashDue > c.finances.cash) reason = `Not enough cash: the order costs ${fmtMoney(cashDue)} up front.`;
  else if (Object.values(alloc).reduce((a, b) => a + b, 0) !== units) reason = 'Allocate every unit to a store.';
  return {
    ok: !reason, reason, unitCost, cashDue, arriveDay: absDay(w) + sup.leadDays, weeklyDemand: weekly, weeksOfCover: cover,
    margin: marginAt(s.prices[p], unitCost), grossProfitIfSold: Math.round(units * (s.prices[p] - unitCost)),
    stockoutRisk: onHandWeeks < leadWeeks ? 'high' : onHandWeeks < leadWeeks + 2 ? 'medium' : 'low',
    overstockRisk: cover > 40, allocation: alloc,
  };
}

export function placeOrder(w: World, c: Club, p: ProductId, supplier: SupplierId, units: number, allocation?: Record<number, number>, by: MerchOrder['by'] = 'you'): { ok: boolean; message: string } {
  const q = quoteOrder(w, c, p, supplier, units, allocation);
  if (!q.ok) return { ok: false, message: q.reason! };
  const s = ensureShop(w, c);
  const o: MerchOrder = { id: nextId(w), product: p, supplier, units, unitCost: q.unitCost, total: q.cashDue, placedDay: absDay(w), arriveDay: q.arriveDay, status: 'ordered', allocation: q.allocation, by };
  s.orders.push(o);
  book(w, c, 'merchCost', -q.cashDue);
  s.totals[p].spent += q.cashDue;
  return { ok: true, message: `Ordered ${units} ${PRODUCTS[p].plural} from ${SUPPLIERS[supplier].label}: ${fmtMoney(q.cashDue)} paid, delivery in ${SUPPLIERS[supplier].leadDays} days.` };
}

function addToBucket(b: StockBucket | undefined, units: number, cost: number, quality: number): StockBucket {
  if (!b || b.units <= 0) return { units, avgCost: cost, quality };
  const n = b.units + units;
  return { units: n, avgCost: (b.units * b.avgCost + units * cost) / n, quality: (b.units * b.quality + units * quality) / n };
}

function deliver(w: World, c: Club, s: ShopState, now: number): string[] {
  const out: string[] = [];
  for (const o of s.orders.filter((x) => x.status === 'ordered' && x.arriveDay <= now)) {
    o.status = 'delivered';
    const q = SUPPLIERS[o.supplier].quality;
    for (const [sid, n] of Object.entries(o.allocation)) {
      if (n <= 0) continue;
      const id = Number(sid);
      if (s.stock[id]) s.stock[id][o.product] = addToBucket(s.stock[id][o.product], n, o.unitCost, q);
      else s.warehouse[o.product] = addToBucket(s.warehouse[o.product], n, o.unitCost, q);
    }
    out.push(`${o.units} ${PRODUCTS[o.product].plural}`);
  }
  if (s.orders.length > 40) s.orders = s.orders.filter((o) => o.status === 'ordered' || o.arriveDay > now - 120);
  return out;
}

/** Move units between stores (or from the warehouse: from = -1). */
export function moveStock(w: World, c: Club, p: ProductId, from: number, to: number, units: number): { ok: boolean; message: string } {
  const s = ensureShop(w, c);
  const src = from === -1 ? s.warehouse[p] : s.stock[from]?.[p];
  if (!src || src.units < units || units <= 0) return { ok: false, message: 'Not enough units there.' };
  src.units -= units;
  s.stock[to][p] = addToBucket(s.stock[to][p], units, src.avgCost, src.quality);
  return { ok: true, message: `Moved ${units} ${PRODUCTS[p].plural}.` };
}

/** Sell remaining units of a product to a wholesaler right away (frees cash, books a loss on cost). */
export function clearToWholesaler(w: World, c: Club, p: ProductId): { ok: boolean; message: string; cash: number } {
  const s = ensureShop(w, c);
  const units = unitsOnHand(s, p);
  if (units <= 0) return { ok: false, message: 'Nothing to clear.', cash: 0 };
  const cost = avgCostOf(s, p);
  const cash = Math.round(units * cost * 0.45);
  for (const b of [...Object.values(s.stock).map((x) => x[p]), s.warehouse[p]]) if (b) b.units = 0;
  book(w, c, 'merch', cash);
  s.totals[p].revenue += cash;
  s.totals[p].cogs += Math.round(units * cost);
  return { ok: true, message: `A wholesaler takes ${units} ${PRODUCTS[p].plural} for ${fmtMoney(cash)} (45% of cost).`, cash };
}

export function setPrice(w: World, c: Club, p: ProductId, price: number) {
  const s = ensureShop(w, c);
  s.prices[p] = Math.max(0.5, Math.round(price * 2) / 2); // quantities and purchase costs are untouched
}

// ------------------------------------------------------------------ weekly sales
function homeGamesThisWeek(w: World, c: Club): { n: number; derby: boolean } {
  const fx = w.fixtures.filter((f) => f.played && !f.neutral && f.homeId === c.id && f.day > w.day - 7 && f.day <= w.day && f.compId.endsWith(`-${w.season}`));
  const derby = fx.some((f) => c.rivals.includes(f.awayId));
  return { n: fx.length, derby };
}

export function weeklyShop(w: World, c: Club) {
  if (!isUser(w, c.id) || c.foreign) return;
  const s = ensureShop(w, c);
  const now = absDay(w);
  const r = rng(w);
  const arrived = deliver(w, c, s, now);
  const hg = homeGamesThisWeek(w, c);
  const week: ShopWeek = { day: now, stores: {}, reason: '' };
  let exp = 0, sold = 0, lost = 0;
  for (const st of storesOf(w, c)) {
    week.stores[st.id] = {};
    let rev = 0, units = 0;
    for (const p of PRODUCT_IDS) {
      const b = s.stock[st.id]?.[p];
      const q = b?.quality ?? 1;
      const e = expectedDemand(w, c, st, p, s.prices[p], 1, true, st.kind === 'arena' ? hg.n : null, q) * (st.kind === 'arena' && hg.derby ? 1.4 : 1);
      const demand = e * r.float(0.85, 1.15);
      const have = b?.units ?? 0;
      const n = Math.max(0, Math.min(have, Math.round(demand)));
      const revenue = Math.round(n * s.prices[p]);
      const cogs = Math.round(n * (b?.avgCost ?? 0));
      if (b) b.units -= n;
      week.stores[st.id][p] = { expected: Math.round(e), demand: Math.round(demand), sold: n, revenue, cogs };
      s.totals[p].units += n; s.totals[p].revenue += revenue; s.totals[p].cogs += cogs;
      exp += e; sold += n; lost += Math.max(0, Math.round(demand) - n);
      rev += revenue; units += n;
      book(w, c, 'merch', revenue);
    }
    st.lastWeekSales = rev;
    st.lastWeekUnits = units;
    st.seasonSales += rev;
  }
  week.reason = lost > Math.max(3, exp * 0.1) ? `Stockouts: ${lost} sales lost because stores ran out.` : sold > exp * 1.08 ? 'Busier than forecast (normal week-to-week variation).' : sold < exp * 0.92 ? 'Quieter than forecast (normal week-to-week variation).' : hg.n > 0 ? `Home game${hg.derby ? ' (derby)' : ''} week: sales as forecast.` : 'Sales as forecast.';
  s.weeks.unshift(week);
  if (s.weeks.length > 26) s.weeks.length = 26;
  if (arrived.length) addNews(w, 'Merchandise delivered', `${arrived.join(', ')} arrived and went on the shelves.`, { tags: ['finance'], clubIds: [c.id] });
  if (s.policy.mode === 'director') directorMerch(w, c, s);
}

/** Season rollover: last season's jerseys lose appeal (new kit), totals reset. */
export function shopNewSeason(w: World, c: Club) {
  const s = c.shop;
  if (!s) return;
  for (const b of [...Object.values(s.stock).map((x) => x.jersey), s.warehouse.jersey]) if (b) b.quality *= 0.6;
  for (const p of PRODUCT_IDS) s.totals[p] = { units: 0, revenue: 0, cogs: 0, spent: 0 };
  s.season = w.season;
  s.food.offDaySeason = 0;
}

// ------------------------------------------------------------------ food & drink
interface Crowd { general: number; lower: number; premium: number; suite: number }

function crowdOf(c: Club, sold: Record<SeatZone, number>): Crowd {
  return { general: sold.general, lower: sold.lower, premium: sold.premium, suite: c.ticketing.suitesSold * 12 };
}

function outletDemand(w: World, c: Club, o: FoodOutlet, crowd: Crowd): number {
  const k = CONCEPTS[o.concept];
  const ref = conceptRefSpend(w, c, o.concept);
  const priceF = Math.pow(ref / Math.max(0.5, o.price), k.elasticity);
  const quality = o.slot === 'popup' ? 0.85 : 1 + (o.slot === 'stands' ? c.arena.levels.concessions : o.slot === 'restaurant' ? c.arena.levels.restaurant : c.arena.levels.hospitality) * 0.04;
  // two outlets with the same concept share the same customers
  const same = c.shop!.food.outlets.filter((x) => x.concept === o.concept);
  const share = same.length > 1 ? o.points / same.reduce((a, x) => a + x.points, 0) : 1;
  const raw = (crowd.general * k.mix.general + crowd.lower * k.mix.lower + crowd.premium * k.mix.premium + crowd.suite * k.mix.suite) * priceF * quality;
  // nobody buys twice at the same counter: at most 90% of the fans this concept appeals to
  const reach = (k.mix.general > 0 ? crowd.general : 0) + (k.mix.lower > 0 ? crowd.lower : 0) + (k.mix.premium > 0 ? crowd.premium : 0) + (k.mix.suite > 0 ? crowd.suite : 0);
  return Math.min(raw, reach * 0.9) * share;
}

function outletLine(w: World, c: Club, o: FoodOutlet, crowd: Crowd, noise: number, expectedCrowd: Crowd): FoodLine {
  const k = CONCEPTS[o.concept];
  const t = tierOf(w, c);
  const cap = o.points * k.perPoint;
  const demand = outletDemand(w, c, o, crowd) * noise;
  const expDemand = outletDemand(w, c, o, expectedCrowd);
  const served = Math.round(Math.min(demand, cap));
  const prepared = Math.min(cap, expDemand * 1.08); // the kitchen preps for the forecast
  const revenue = Math.round(served * o.price);
  const food = Math.round(revenue * k.foodPct);
  const waste = Math.round(Math.max(0, prepared - served) * o.price * k.foodPct * 0.8);
  const labor = Math.round((o.points * k.labor + k.fixed) * LABOR_TIER[t]);
  const expServed = Math.min(expDemand, cap);
  const expRev = expServed * o.price;
  const expectedProfit = Math.round(expRev * (1 - k.foodPct) - Math.max(0, prepared - expServed) * o.price * k.foodPct * 0.8 - labor);
  return { outletId: o.id, concept: o.concept, customers: served, lost: Math.max(0, Math.round(demand) - served), avgSpend: o.price, revenue, food, labor, waste, profit: revenue - food - labor - waste, expectedProfit };
}

/** Forecast for one outlet at an average home game (same economics as the game-night result). */
export function forecastOutlet(w: World, c: Club, o: FoodOutlet, attendanceBy?: Record<SeatZone, number>): FoodLine {
  const crowd = crowdOf(c, attendanceBy ?? typicalCrowd(w, c));
  return outletLine(w, c, o, crowd, 1, crowd);
}

export function typicalCrowd(w: World, c: Club): Record<SeatZone, number> {
  const last = (c.shop?.food.reports ?? []).slice(0, 3);
  const cap = c.arena.seats;
  const occ = last.length ? Math.min(1, last.reduce((a, x) => a + x.attendance, 0) / last.length / Math.max(1, cap.general + cap.lower + cap.premium)) : 0.7;
  return Object.fromEntries(SEAT_ZONES.map((z) => [z, Math.round(cap[z] * occ)])) as Record<SeatZone, number>;
}

/** Called for every home game of the user's club; books revenue and costs, returns the report. */
export function foodGameNight(w: World, c: Club, fixtureId: number, opponent: string, sold: Record<SeatZone, number>): FoodReport {
  const s = ensureShop(w, c);
  const r = rng(w);
  const crowd = crowdOf(c, sold);
  const expected = crowdOf(c, typicalCrowd(w, c));
  const lines = s.food.outlets.map((o) => outletLine(w, c, o, crowd, r.float(0.9, 1.1), expected));
  const revenue = lines.reduce((a, l) => a + l.revenue, 0);
  const cost = lines.reduce((a, l) => a + l.food + l.labor + l.waste, 0);
  book(w, c, 'concessions', revenue);
  book(w, c, 'foodCost', -cost);
  const profit = revenue - cost;
  const expectedProfit = lines.reduce((a, l) => a + l.expectedProfit, 0);
  const attendance = sold.general + sold.lower + sold.premium;
  const typical = expected.general + expected.lower + expected.premium;
  const lost = lines.reduce((a, l) => a + l.lost, 0);
  const wasted = lines.reduce((a, l) => a + l.waste, 0);
  const reason = lost > lines.reduce((a, l) => a + l.customers, 0) * 0.12 ? `Queues: ${lost} customers gave up because counters were full. Add service points.`
    : attendance > typical * 1.08 ? `Bigger crowd than usual (${attendance.toLocaleString('en')} vs ~${typical.toLocaleString('en')}).`
    : attendance < typical * 0.92 ? `Smaller crowd than usual (${attendance.toLocaleString('en')} vs ~${typical.toLocaleString('en')}): food prepared for more went to waste.`
    : wasted > revenue * 0.06 ? 'Waste: more food prepared than sold.' : 'In line with the forecast.';
  const rep: FoodReport = { day: absDay(w), fixtureId, opponent, attendance, lines, revenue, profit, expectedProfit, reason };
  s.food.reports.unshift(rep);
  if (s.food.reports.length > 20) s.food.reports.length = 20;
  // long queues and steep prices annoy supporters a little
  const kiosk = s.food.outlets.find((o) => o.concept === 'kiosk');
  if (kiosk) c.concessions.pricing = kiosk.price > conceptRefSpend(w, c, 'kiosk') * 1.15 ? 'premium' : kiosk.price < conceptRefSpend(w, c, 'kiosk') * 0.9 ? 'value' : 'standard';
  if (lost > 200) c.fans.sentiment = clamp(c.fans.sentiment - 0.3, 0, 100);
  if (s.policy.mode === 'director') directorFood(w, c, s);
  return rep;
}

/** Monthly non-matchday trade of the arena restaurant: concept and price shape it. Net profit. */
export function offDayIncome(w: World, c: Club): { revenue: number; cost: number } {
  const lvl = c.arena.levels.restaurant;
  const o = c.shop?.food.outlets.find((x) => x.slot === 'restaurant');
  if (lvl <= 0 || !o) return { revenue: 0, cost: 0 };
  const ref = conceptRefSpend(w, c, o.concept);
  const conceptF = o.concept === 'grill' ? 1 : o.concept === 'lounge' ? 0.55 + c.economy * 0.45 + Math.min(0.4, c.ticketing.suitesSold / 40) : 0.45;
  const priceF = Math.pow(ref / Math.max(0.5, o.price), CONCEPTS[o.concept].elasticity) * (o.price / ref);
  const gross = (lvl * RESTAURANT_EVENTS[tierOf(w, c)] * (0.7 + c.economy * 0.3) * conceptF * priceF) / 12;
  return { revenue: Math.round(gross), cost: Math.round(gross * (CONCEPTS[o.concept].foodPct + 0.3)) };
}

export function setOutlet(w: World, c: Club, id: number, patch: Partial<Pick<FoodOutlet, 'concept' | 'price' | 'points'>>): { ok: boolean; message: string } {
  const s = ensureShop(w, c);
  const o = s.food.outlets.find((x) => x.id === id);
  if (!o) return { ok: false, message: 'No such outlet.' };
  if (patch.concept && patch.concept !== o.concept) {
    if (o.slot === 'lounge' && patch.concept !== 'lounge') return { ok: false, message: 'The VIP lounge only runs premium dining.' };
    const refit = Math.round(conceptRefit(w, c, o.slot) / 500) * 500;
    if (refit > c.finances.cash) return { ok: false, message: `Refitting costs ${fmtMoney(refit)}.` };
    book(w, c, 'construction', -refit);
    o.concept = patch.concept;
    o.price = conceptRefSpend(w, c, patch.concept);
  }
  if (patch.price != null) o.price = Math.max(0.5, Math.round(patch.price * 2) / 2);
  if (patch.points != null) o.points = clamp(Math.round(patch.points), 1, maxPoints(c, o.slot));
  return { ok: true, message: 'Outlet updated.' };
}

export function conceptRefit(w: World, c: Club, slot: FoodOutlet['slot']): number {
  const m = { 0: 3, 1: 2.4, 2: 0.8, 3: 0.4 }[tierOf(w, c)] ?? 1;
  return (slot === 'restaurant' ? 25000 : 8000) * m;
}

export function popupCost(w: World, c: Club): number {
  return Math.round(conceptRefit(w, c, 'popup') * 0.75 / 500) * 500;
}

export function openPopup(w: World, c: Club, concept: FoodConceptId): { ok: boolean; message: string } {
  const s = ensureShop(w, c);
  if (s.food.outlets.some((o) => o.slot === 'popup')) return { ok: false, message: 'You already run a pop-up outlet.' };
  if (concept === 'lounge') return { ok: false, message: 'Premium dining needs the VIP lounge.' };
  const cost = popupCost(w, c);
  if (cost > c.finances.cash) return { ok: false, message: `Not enough cash (${fmtMoney(cost)}).` };
  book(w, c, 'construction', -cost);
  s.food.outlets.push({ id: nextId(w), slot: 'popup', concept, price: conceptRefSpend(w, c, concept), points: 2 });
  return { ok: true, message: `Pop-up ${CONCEPTS[concept].label.toLowerCase()} opened on the concourse for ${fmtMoney(cost)}.` };
}

// ------------------------------------------------------------------ commercial director
function directorName(w: World, c: Club) {
  const s = w.staff.find((x) => x.id === c.staff.commercialDirector);
  return s ? `${s.firstName} ${s.lastName}` : 'Commercial director';
}

function approval(w: World, c: Club, title: string, body: string, payload: Record<string, unknown>, impact = 2) {
  if (w.decisions.some((d) => !d.resolved && d.kind === 'shopApproval' && d.payload.key === payload.key)) return;
  const d: Decision = {
    id: nextId(w), kind: 'shopApproval', title, body, createdDay: absDay(w), deadlineDay: absDay(w) + 7, urgency: 1, impact, dept: 'sponsors',
    options: [{ id: 'approve', label: 'Approve', tone: 'good' }, { id: 'decline', label: 'Decline', tone: 'neutral' }],
    recommended: 'approve', recommendedBy: directorName(w, c), payload, defaultOption: 'decline', resolved: false,
  };
  w.decisions.push(d);
  hold(w, 'decision', title);
}

function directorMerch(w: World, c: Club, s: ShopState) {
  const pol = s.policy;
  const skill = staffRating(w, c, 'commercialDirector');
  for (const p of PRODUCT_IDS) {
    // keep the minimum margin on the current cost
    const cost = avgCostOf(s, p) || supplierCost(p, 'standard');
    if (marginAt(s.prices[p], cost) < pol.minMargin) {
      const np = priceForMargin(cost, pol.minMargin);
      if (np > s.prices[p] * 1.15) approval(w, c, `Price exception: ${PRODUCTS[p].plural} to ${fmtMoney(np)}?`, `Keeping a ${Math.round(pol.minMargin * 100)}% margin needs a ${Math.round((np / s.prices[p] - 1) * 100)}% price rise (from ${fmtMoney(s.prices[p])}). Fans and demand may react.`, { key: `price-${p}`, action: 'price', product: p, price: np }, 1);
      else s.prices[p] = np;
    }
    const weekly = forecastWeekly(w, c, p);
    const have = unitsOnHand(s, p) + unitsIncoming(s, p);
    const target = weekly * pol.stockWeeks;
    if (have >= target * 0.6 || weekly < 1) continue;
    const supplier: SupplierId = skill >= 65 && unitsOnHand(s, p) > weekly * 5 ? 'budget' : 'standard';
    const units = Math.max(SUPPLIERS[supplier].minOrder, Math.round((target - have) / 10) * 10);
    const q = quoteOrder(w, c, p, supplier, units);
    if (q.cashDue > pol.cashCap || q.cashDue > c.finances.cash * 0.5) {
      approval(w, c, `Approve ${units} ${PRODUCTS[p].plural} for ${fmtMoney(q.cashDue)}?`, `Stock covers ${Math.round(unitsOnHand(s, p) / Math.max(0.1, weekly))} weeks. The order is above your cap of ${fmtMoney(pol.cashCap)}. Delivery in ${SUPPLIERS[supplier].leadDays} days; margin ${Math.round(q.margin * 100)}%.`, { key: `order-${p}`, action: 'order', product: p, supplier, units }, q.cashDue > c.finances.cash * 0.25 ? 3 : 2);
      continue;
    }
    if (q.ok) placeOrder(w, c, p, supplier, units, undefined, 'director');
  }
}

function directorFood(w: World, c: Club, s: ShopState) {
  const rep = s.food.reports[0];
  if (!rep) return;
  for (const l of rep.lines) {
    const o = s.food.outlets.find((x) => x.id === l.outletId);
    if (!o) continue;
    // menu price: nudge toward the most profitable price within the margin floor (same model as forecasts)
    const best = [0.85, 0.92, 1, 1.08, 1.16].map((k) => ({ k, p: forecastOutlet(w, c, { ...o, price: Math.max(0.5, Math.round(o.price * k * 2) / 2) }).profit })).sort((a, b) => b.p - a.p)[0];
    if (best.k !== 1) o.price = Math.max(0.5, Math.round(o.price * best.k * 2) / 2);
    if (l.lost > l.customers * 0.15 && o.points < maxPoints(c, o.slot)) o.points += 1;
    else if (l.profit < 0 && o.points > 1 && l.customers < o.points * CONCEPTS[o.concept].perPoint * 0.5) o.points -= 1;
  }
  const lost = rep.lines.reduce((a, l) => a + l.lost, 0);
  if (lost > 400 && !s.food.outlets.some((o) => o.slot === 'popup')) approval(w, c, `Open a pop-up kiosk for ${fmtMoney(popupCost(w, c))}?`, `${lost} fans gave up queuing at the last home game and every counter is already staffed.`, { key: 'popup', action: 'popup' }, 2);
}

export function resolveShopApproval(w: World, d: Decision, choice: string): string {
  const c = w.clubs.find((x) => x.id === w.user.clubId);
  if (!c) return 'No club.';
  if (choice !== 'approve') return 'Declined. The director will ask again if the situation persists.';
  const pl = d.payload;
  if (pl.action === 'order') return placeOrder(w, c, pl.product as ProductId, pl.supplier as SupplierId, pl.units as number, undefined, 'director').message;
  if (pl.action === 'price') { setPrice(w, c, pl.product as ProductId, pl.price as number); return `Price set to ${fmtMoney(pl.price as number)}.`; }
  if (pl.action === 'popup') return openPopup(w, c, 'kiosk').message;
  if (pl.action === 'groundShare') return signGroundShare(w, c).message;
  if (pl.action === 'bridge') return takePayrollBridge(w, c).message;
  return 'Done.';
}

// ------------------------------------------------------------------ summaries
export function annualShopForecast(w: World, c: Club): { merchGross: number; foodProfit: number } {
  const s = c.shop;
  if (!s) return { merchGross: 0, foodProfit: 0 };
  const merchGross = PRODUCT_IDS.reduce((a, p) => a + forecastWeekly(w, c, p) * 52 * (s.prices[p] - (avgCostOf(s, p) || supplierCost(p, 'standard'))), 0);
  const homeGames = c.leagueId ? w.rules.leagues[c.leagueId].teams - 1 : 15;
  const foodProfit = s.food.outlets.reduce((a, o) => a + forecastOutlet(w, c, o).profit, 0) * homeGames;
  void buildCalendar;
  return { merchGross: Math.round(merchGross), foodProfit: Math.round(foodProfit) };
}

/** The user leaves the club: stock goes back into the abstract AI inventory. */
export function releaseShop(c: Club) {
  const s = c.shop;
  if (!s) return;
  let v = 0;
  for (const b of [...Object.values(s.stock).flatMap((x) => Object.values(x)), ...Object.values(s.warehouse)]) if (b) v += b.units * b.avgCost;
  c.merch.stockValue = Math.round(v);
  delete c.shop;
}
