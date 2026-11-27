// Playable merchandise and food & drink screens (user club).
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Club, FoodConceptId, FoodOutlet, ProductId, ShopState, SupplierId } from '../../../engine/types';
import { absDay } from '../../../engine/types';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { fmtAbs } from '../../../engine/calendar';
import {
  CONCEPTS, PRODUCTS, PRODUCT_IDS, SUPPLIERS, avgCostOf, clearToWholesaler, conceptRefSpend, defaultAllocation, forecastOutlet, forecastWeekly,
  marginAt, maxPoints, moveStock, offDayIncome, openPopup, placeOrder, popupCost, priceForMargin, quoteOrder, refPriceOf, setOutlet, setPrice,
  supplierCost, unitsIncoming, unitsOnHand, conceptRefit, VOLUME_TIERS,
} from '../../../engine/shop';
import { Badge, Button, Callout, Card, Modal, NumberField, Pills, Stat } from '../../components/ui';
import { ProductArt, FoodArt, type ProductKind } from '../../art/ProductArt';
import { useAct, useNotify } from '../../store';
import { useUserClub } from './common';
import '../hubs/hubs.css';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const clampPct = (x: number) => Math.max(0, Math.min(0.85, x));
/** Exact euros for business-sized amounts (fmtMoney rounds to k). */
const eur = (n: number) => (Math.abs(n) < 100000 ? `${n < 0 ? '−' : ''}€${Math.abs(Math.round(n)).toLocaleString('en')}` : fmtMoney(n));
const ART: Record<ProductId, ProductKind> = { jersey: 'jersey-home', scarf: 'scarf', cap: 'cap', keychain: 'keychain' };

function useShop(): { c: Club; s: ShopState | undefined } {
  const { c } = useUserClub();
  return { c, s: c.shop };
}

// =================================================================== merchandise
export function Merchandise() {
  const { c } = useUserClub();
  const s = c.shop;
  const [order, setOrder] = useState<ProductId | null>(null);
  const [move, setMove] = useState<ProductId | null>(null);
  if (!s) return <Callout>The shop opens when you take charge of a club.</Callout>;
  const stores = c.facilities?.stores ?? [];
  const totals = PRODUCT_IDS.reduce((a, p) => ({ units: a.units + s.totals[p].units, rev: a.rev + s.totals[p].revenue, gp: a.gp + s.totals[p].revenue - s.totals[p].cogs, spent: a.spent + s.totals[p].spent }), { units: 0, rev: 0, gp: 0, spent: 0 });
  const onHand = PRODUCT_IDS.reduce((a, p) => a + unitsOnHand(s, p), 0);
  const incoming = s.orders.filter((o) => o.status === 'ordered');
  const lastWeek = s.weeks[0];
  return (
    <div className="col gap16">
      <div className="grid g4">
        <Stat label="Units on hand" value={onHand.toLocaleString('en')} sub={`${incoming.length} order${incoming.length === 1 ? '' : 's'} on the way`} />
        <Stat label="Sold this season" value={totals.units.toLocaleString('en')} sub={`revenue ${fmtMoney(totals.rev)}`} />
        <Stat label="Gross profit (season)" value={fmtMoney(totals.gp)} tone={totals.gp > 0 ? 'good' : undefined} sub="revenue minus cost of the units sold" />
        <Stat label="Cash spent on stock" value={fmtMoney(totals.spent)} sub="paid up front when ordering" />
      </div>
      {lastWeek && <Callout tone={/Stockouts/.test(lastWeek.reason) ? 'warn' : undefined}><b>Last week:</b> {lastWeek.reason}</Callout>}
      <Card title="Products" actions={<span className="small faint">Price changes never touch quantities or what you paid</span>}>
        <div className="col" style={{ gap: 10 }}>
          {PRODUCT_IDS.map((p, i) => <ProductRow key={p} p={p} i={i} onOrder={() => setOrder(p)} onMove={() => setMove(p)} />)}
        </div>
      </Card>
      <div className="grid g2">
        <Card title="Stock by store">
          <table className="tbl">
            <thead><tr><th>Store</th>{PRODUCT_IDS.map((p) => <th key={p} className="r">{PRODUCTS[p].plural}</th>)}<th className="r">Last week</th></tr></thead>
            <tbody>
              {stores.map((st) => (
                <tr key={st.id}>
                  <td>{st.name}</td>
                  {PRODUCT_IDS.map((p) => { const n = s.stock[st.id]?.[p]?.units ?? 0; const wk = lastWeek?.stores[st.id]?.[p]; return <td key={p} className={`r ${n === 0 ? 'bad' : ''}`} title={wk ? `Last week: sold ${wk.sold} of ${wk.demand} wanted (forecast ${wk.expected})` : undefined}>{n}</td>; })}
                  <td className="r">{fmtMoney(st.lastWeekSales)}</td>
                </tr>
              ))}
              {PRODUCT_IDS.some((p) => (s.warehouse[p]?.units ?? 0) > 0) && <tr><td className="muted">Warehouse (unallocated)</td>{PRODUCT_IDS.map((p) => <td key={p} className="r">{s.warehouse[p]?.units ?? 0}</td>)}<td /></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Orders">
          {s.orders.length === 0 ? <div className="small muted">No orders yet. Order stock before it runs out: delivery takes 8–28 days.</div> : (
            <div className="list">
              {[...s.orders].reverse().slice(0, 8).map((o) => (
                <div key={o.id} className="list-item row">
                  <ProductArt kind={ART[o.product]} colors={[c.colors[0], c.colors[1]]} size={30} />
                  <div style={{ flex: 1 }}>
                    <b>{o.units} {PRODUCTS[o.product].plural}</b> <span className="small muted">· {SUPPLIERS[o.supplier].label} · {fmtMoney(o.unitCost)}/unit · {eur(o.total)}</span>
                    <div className="small faint">{o.by === 'director' ? 'Commercial director' : 'You'} · ordered {fmtAbs(o.placedDay)}</div>
                  </div>
                  <Badge tone={o.status === 'delivered' ? 'good' : 'info'}>{o.status === 'delivered' ? 'Delivered' : `Arrives ${fmtAbs(o.arriveDay)}`}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <SalesHistory s={s} />
      <DirectorPolicy />
      {order && <OrderModal p={order} onClose={() => setOrder(null)} />}
      {move && <MoveModal p={move} onClose={() => setMove(null)} />}
    </div>
  );
}

function ProductRow({ p, i, onOrder, onMove }: { p: ProductId; i: number; onOrder: () => void; onMove: () => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const s = c.shop!;
  const cost = avgCostOf(s, p) || supplierCost(p, 'standard', 500);
  const price = s.prices[p];
  const weekly = forecastWeekly(w, c, p);
  const have = unitsOnHand(s, p);
  const cover = have / Math.max(0.1, weekly);
  const inc = unitsIncoming(s, p);
  const t = s.totals[p];
  const upd = (np: number) => act((ww) => setPrice(ww, getClub(ww, c.id), p, np));
  return (
    <motion.div className="biz-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <ProductArt kind={ART[p]} colors={[c.colors[0], c.colors[1]]} size={64} />
      <div className="biz-main">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <b>{PRODUCTS[p].label}</b>
          <span className="small muted">{avgCostOf(s, p) ? 'avg cost' : 'cost (500-unit run)'} {fmtMoney(cost)} · market price {fmtMoney(refPriceOf(w, c, p))}</span>
          {have + inc === 0 && <Badge tone="warn">No stock: order some</Badge>}
          {cover < 3 && have + inc > 0 && <Badge tone="bad">Low stock</Badge>}
          {cover > 40 && <Badge tone="warn">Overstocked</Badge>}
        </div>
        <div className="row mt8" style={{ flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <span className="small muted">Margin</span>
          <input type="range" aria-label={`Margin on ${PRODUCTS[p].plural}`} min={0} max={85} step={1} value={Math.round(clampPct(marginAt(price, cost)) * 100)} onChange={(e) => upd(priceForMargin(cost, Number(e.target.value) / 100))} style={{ flex: 1, minWidth: 140, maxWidth: 320 }} />
          <b>{pct(marginAt(price, cost))}</b>
          <span className="small">sells at <b>{fmtMoney(price)}</b> <span className={price > refPriceOf(w, c, p) * 1.2 ? 'warn' : 'muted'}>({Math.round((price / refPriceOf(w, c, p)) * 100)}% of market)</span></span>
        </div>
        <div className="small mt8 biz-kpis">
          <span>Forecast <b>{weekly.toFixed(1)}</b>/wk</span>
          <span>On hand <b>{have}</b>{inc ? ` (+${inc} coming)` : ''}</span>
          <span>Cover <b className={cover < 3 ? 'bad' : ''}>{cover > 99 ? '99+' : cover.toFixed(1)}</b> wks</span>
          <span>Season: <b>{t.units}</b> sold · GP <b>{fmtMoney(t.revenue - t.cogs)}</b></span>
        </div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <Button size="sm" variant="primary" onClick={onOrder}>Order…</Button>
        <Button size="sm" onClick={onMove} disabled={have === 0}>Move stock</Button>
        <Button size="sm" variant="ghost" disabled={have === 0} onClick={() => { if (!confirm(`Sell all ${have} ${PRODUCTS[p].plural} to a wholesaler at 45% of cost?`)) return; const r = act((ww) => clearToWholesaler(ww, getClub(ww, c.id), p)); notify(r.message, r.ok ? 'good' : 'bad'); }}>Clear stock</Button>
      </div>
    </motion.div>
  );
}

function OrderModal({ p, onClose }: { p: ProductId; onClose: () => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const s = c.shop!;
  const weekly = forecastWeekly(w, c, p);
  const [supplier, setSupplier] = useState<SupplierId>('standard');
  const [units, setUnits] = useState(() => Math.max(300, SUPPLIERS.standard.minOrder, Math.round((weekly * 12) / 50) * 50));
  const [alloc, setAlloc] = useState<Record<number, number> | null>(null);
  const stores = c.facilities?.stores ?? [];
  const auto = useMemo(() => defaultAllocation(w, c, p, units), [w, c, p, units]);
  const a = alloc ?? auto;
  const q = quoteOrder(w, c, p, supplier, units, a);
  const allocated = Object.values(a).reduce((x, y) => x + y, 0);
  return (
    <Modal title={`Order ${PRODUCTS[p].plural}`} onClose={onClose} wide actions={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!q.ok} onClick={() => { const r = act((ww) => placeOrder(ww, getClub(ww, c.id), p, supplier, units, a)); notify(r.message, r.ok ? 'good' : 'bad'); if (r.ok) onClose(); }}>Pay {eur(q.cashDue)} and order</Button></>}>
      <div className="col gap16">
        <div>
          <div className="small muted mb8">Supplier</div>
          <Pills<SupplierId> value={supplier} onChange={(v) => setSupplier(v)} options={(Object.keys(SUPPLIERS) as SupplierId[]).map((id) => ({ id, label: `${SUPPLIERS[id].label} · ${fmtMoney(supplierCost(p, id, units))}`, title: SUPPLIERS[id].desc }))} />
          <div className="small faint mt8">{SUPPLIERS[supplier].desc} Delivery {SUPPLIERS[supplier].leadDays} days · minimum {SUPPLIERS[supplier].minOrder} units.</div>
        </div>
        <div>
          <NumberField label="Quantity" value={units} min={SUPPLIERS[supplier].minOrder} max={Math.max(3000, Math.round(weekly * 40 / 100) * 100)} step={50} suffix="units" width={80} onChange={(v) => { setUnits(v); setAlloc(null); }} />
          <div className="small muted mt8 mb8">The bigger the run, the cheaper each unit:</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {VOLUME_TIERS.map((t, k) => {
              const next = VOLUME_TIERS[k + 1];
              const on = units >= t.min && (!next || units < next.min);
              const n = Math.max(t.min, SUPPLIERS[supplier].minOrder);
              return (
                <button key={t.min} type="button" className={`slot-chip ${on ? 'sel' : ''}`} style={{ minWidth: 104 }} onClick={() => { setUnits(n); setAlloc(null); }}>
                  <span className="sc-label">{t.min ? `${t.min}+ units` : 'Small run'}</span>
                  <span className="sc-brand">{fmtMoney(supplierCost(p, supplier, n))}</span>
                  <span className="small muted">{t.off ? `−${Math.round(t.off * 100)}% per unit` : 'list price'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="row small"><span className="muted">Allocate to stores</span><span className="spacer" /><span className={allocated === units ? 'good' : 'bad'}>{allocated}/{units} allocated</span>{alloc && <Button size="sm" variant="ghost" onClick={() => setAlloc(null)}>Auto</Button>}</div>
          <div className="col mt8" style={{ gap: 6 }}>
            {stores.map((st) => (
              <div key={st.id} className="row" style={{ gap: 10 }}>
                <span style={{ minWidth: 170 }}>{st.name}</span>
                <NumberField label={`Units for ${st.name}`} value={a[st.id] ?? 0} min={0} max={units} step={10} width={70} onChange={(v) => setAlloc({ ...a, [st.id]: v })} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid g4">
          <Stat label="Cash due now" value={eur(q.cashDue)} sub={`${fmtMoney(q.unitCost)} per unit`} tone={q.cashDue > c.finances.cash ? 'bad' : undefined} />
          <Stat label="Delivery" value={fmtAbs(q.arriveDay)} sub={`${SUPPLIERS[supplier].leadDays} days`} />
          <Stat label="Gross margin" value={pct(q.margin)} sub={`at ${fmtMoney(s.prices[p])} each`} tone={q.margin < 0.3 ? 'bad' : q.margin > 0.5 ? 'good' : undefined} />
          <Stat label="Forecast demand" value={`${weekly.toFixed(1)}/wk`} sub={`${q.weeksOfCover.toFixed(1)} weeks of cover after delivery`} />
        </div>
        <div className="small">
          If every unit sells: gross profit <b>{eur(q.grossProfitIfSold)}</b> on the units sold. Stock-out risk before delivery: <Badge tone={q.stockoutRisk === 'high' ? 'bad' : q.stockoutRisk === 'medium' ? 'warn' : 'good'}>{q.stockoutRisk}</Badge>
          {q.overstockRisk && <> · <span className="warn">More than a season of stock: cash tied up, and jerseys lose appeal when the new kit arrives.</span></>}
        </div>
        {q.reason && <Callout tone="bad">{q.reason}</Callout>}
      </div>
    </Modal>
  );
}

function MoveModal({ p, onClose }: { p: ProductId; onClose: () => void }) {
  const { c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const s = c.shop!;
  const stores = c.facilities?.stores ?? [];
  const sources = [...(s.warehouse[p]?.units ? [{ id: -1, name: 'Warehouse' }] : []), ...stores.filter((x) => (s.stock[x.id]?.[p]?.units ?? 0) > 0).map((x) => ({ id: x.id, name: x.name }))];
  const [from, setFrom] = useState(sources[0]?.id ?? -1);
  const [to, setTo] = useState(stores.find((x) => x.id !== from)?.id ?? stores[0]?.id);
  const avail = from === -1 ? s.warehouse[p]?.units ?? 0 : s.stock[from]?.[p]?.units ?? 0;
  const [units, setUnits] = useState(Math.min(50, avail));
  return (
    <Modal title={`Move ${PRODUCTS[p].plural}`} onClose={onClose} actions={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={from === to || units <= 0 || units > avail} onClick={() => { const r = act((ww) => moveStock(ww, getClub(ww, c.id), p, from, to!, units)); notify(r.message, r.ok ? 'good' : 'bad'); if (r.ok) onClose(); }}>Move</Button></>}>
      <div className="col gap16">
        <label className="row">From <select value={from} onChange={(e) => setFrom(Number(e.target.value))}>{sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="row">To <select value={to} onChange={(e) => setTo(Number(e.target.value))}>{stores.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <NumberField label="Units" value={units} min={1} max={Math.max(1, avail)} width={70} onChange={setUnits} />
        <div className="small faint">{avail} available. Moving stock keeps its purchase cost.</div>
      </div>
    </Modal>
  );
}

function SalesHistory({ s }: { s: ShopState }) {
  const weeks = s.weeks.slice(0, 8);
  if (!weeks.length) return null;
  return (
    <Card title="Weekly sales: forecast vs actual">
      <table className="tbl">
        <thead><tr><th>Week of</th><th className="r">Forecast</th><th className="r">Wanted</th><th className="r">Sold</th><th className="r">Revenue</th><th className="r">Gross profit</th><th>Main reason</th></tr></thead>
        <tbody>
          {weeks.map((wk) => {
            const all = Object.values(wk.stores).flatMap((x) => Object.values(x));
            const sum = (k: 'expected' | 'demand' | 'sold' | 'revenue' | 'cogs') => all.reduce((a, l) => a + (l?.[k] ?? 0), 0);
            return <tr key={wk.day}><td>{fmtAbs(wk.day)}</td><td className="r">{sum('expected')}</td><td className="r">{sum('demand')}</td><td className="r">{sum('sold')}</td><td className="r">{fmtMoney(sum('revenue'))}</td><td className="r">{fmtMoney(sum('revenue') - sum('cogs'))}</td><td className="small muted">{wk.reason}</td></tr>;
          })}
        </tbody>
      </table>
    </Card>
  );
}

// =================================================================== commercial director policy
export function DirectorPolicy() {
  const { w, c } = useUserClub();
  const act = useAct();
  const s = c.shop;
  if (!s) return null;
  const pol = s.policy;
  const set = (patch: Partial<typeof pol>) => act((ww) => { Object.assign(getClub(ww, c.id).shop!.policy, patch); });
  const dir = w.staff.find((x) => x.id === c.staff.commercialDirector);
  return (
    <Card title="Commercial director" actions={<Pills<'manual' | 'director'> value={pol.mode} onChange={(v) => set({ mode: v })} options={[{ id: 'manual', label: 'I run it' }, { id: 'director', label: 'Director runs routine' }]} />}>
      <div className="small muted mb8">
        {dir ? `${dir.firstName} ${dir.lastName} (rating ${dir.rating})` : 'No commercial director: hire one in Club facilities for better results.'}
        {pol.mode === 'director' ? ' reorders stock, keeps your minimum margin and tunes menus every week. Orders above the cap, big price rises and new outlets come to Today for your approval.' : ' only advises. You order, price and staff everything.'}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 18 }}>
        <NumberField label="Cash cap per order" value={pol.cashCap} min={0} max={Math.max(50000, pol.cashCap)} step={500} prefix="€" width={80} onChange={(v) => set({ cashCap: v })} />
        <NumberField label="Minimum margin" value={Math.round(pol.minMargin * 100)} min={0} max={85} step={1} suffix="%" width={50} onChange={(v) => set({ minMargin: v / 100 })} />
        <NumberField label="Stock target" value={pol.stockWeeks} min={1} max={20} step={1} suffix="weeks" width={50} onChange={(v) => set({ stockWeeks: v })} />
      </div>
    </Card>
  );
}

// =================================================================== food & drink
const SLOT_LABEL: Record<FoodOutlet['slot'], string> = { stands: 'Concourse stands', restaurant: 'Arena restaurant & bar', lounge: 'VIP lounge', popup: 'Pop-up outlet' };

export function FoodDrink() {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const s = c.shop;
  if (!s) return <Callout>Food & drink opens when you take charge of a club.</Callout>;
  const rep = s.food.reports[0];
  const forecast = s.food.outlets.reduce((a, o) => a + forecastOutlet(w, c, o).profit, 0);
  const od = offDayIncome(w, c);
  return (
    <div className="col gap16">
      <div className="grid g4">
        <Stat label="Forecast profit per home game" value={fmtMoney(forecast)} sub="all outlets, average crowd" tone={forecast > 0 ? 'good' : 'bad'} />
        <Stat label="Last home game" value={rep ? fmtMoney(rep.profit) : '—'} sub={rep ? `${rep.lines.reduce((a, l) => a + l.customers, 0).toLocaleString('en')} customers vs ${rep.opponent}` : 'No home game yet'} tone={rep && rep.profit < 0 ? 'bad' : undefined} />
        <Stat label="Off-day trade (month)" value={od.revenue ? fmtMoney(od.revenue - od.cost) : '—'} sub={od.revenue ? `restaurant events, season ${fmtMoney(s.food.offDaySeason)}` : 'Needs the arena restaurant'} />
        <Stat label="Outlets" value={s.food.outlets.length} sub={s.food.outlets.map((o) => CONCEPTS[o.concept].label).join(' · ')} />
      </div>
      {rep && <LastGame />}
      <div className="grid g2">
        {s.food.outlets.map((o, i) => <OutletCard key={o.id} o={o} i={i} />)}
        {!s.food.outlets.some((o) => o.slot === 'popup') && (
          <Card title="Open a pop-up outlet">
            <FoodArt concept="kiosk" color={c.colors[0]} height={110} />
            <div className="small muted mt8">A second concourse outlet for {fmtMoney(popupCost(w, c))}: two counters, extra capacity when queues cost you sales.</div>
            <div className="row mt8">
              <Button size="sm" onClick={() => { const r = act((ww) => openPopup(ww, getClub(ww, c.id), 'kiosk')); notify(r.message, r.ok ? 'good' : 'bad'); }}>Open a kiosk</Button>
              <Button size="sm" onClick={() => { const r = act((ww) => openPopup(ww, getClub(ww, c.id), 'grill')); notify(r.message, r.ok ? 'good' : 'bad'); }}>Open a grill</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function OutletCard({ o, i }: { o: FoodOutlet; i: number }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const f = forecastOutlet(w, c, o);
  const allowed: FoodConceptId[] = o.slot === 'lounge' ? ['lounge'] : o.slot === 'restaurant' ? ['grill', 'lounge', 'kiosk'] : ['kiosk', 'grill'];
  const ref = conceptRefSpend(w, c, o.concept);
  const upd = (patch: Partial<Pick<FoodOutlet, 'concept' | 'price' | 'points'>>) => { const r = act((ww) => setOutlet(ww, getClub(ww, c.id), o.id, patch)); if (!r.ok) notify(r.message, 'bad'); };
  const cap = o.points * CONCEPTS[o.concept].perPoint;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Card title={SLOT_LABEL[o.slot]} actions={<Badge tone={f.profit > 0 ? 'good' : 'bad'}>{eur(f.profit)}/game</Badge>}>
        <FoodArt concept={o.concept} color={c.colors[0]} height={110} />
        <div className="mt8">
          <Pills<FoodConceptId> value={o.concept} onChange={(v) => { if (v !== o.concept && !confirm(`Switch to ${CONCEPTS[v].label}? Refit costs ${fmtMoney(conceptRefit(w, c, o.slot))}.`)) return; upd({ concept: v }); }} options={allowed.map((k) => ({ id: k, label: CONCEPTS[k].label, title: CONCEPTS[k].desc }))} />
          <div className="small muted mt8">{CONCEPTS[o.concept].desc}</div>
        </div>
        <div className="row mt8" style={{ flexWrap: 'wrap', gap: 14 }}>
          <span className="small muted">Avg spend</span>
          <NumberField label="Average spend per customer" value={o.price} min={0.5} max={Math.round(ref * 2.5)} step={0.5} prefix="€" width={60} onChange={(v) => upd({ price: v })} />
          <span className="small muted">Counters</span>
          <NumberField label="Service points" value={o.points} min={1} max={maxPoints(c, o.slot)} step={1} width={40} onChange={(v) => upd({ points: v })} />
        </div>
        <div className="small faint">Market reference {fmtMoney(ref)} · capacity {cap.toLocaleString('en')} customers a game (max {maxPoints(c, o.slot)} points: upgrade the facility for more).</div>
        <div className="biz-kpis small mt8">
          <span>Customers <b>{f.customers}</b>{f.lost ? <span className="bad"> (+{f.lost} turned away)</span> : null}</span>
          <span>Revenue <b>{eur(f.revenue)}</b></span>
          <span>Food <b>{eur(f.food)}</b></span>
          <span>Labour <b>{eur(f.labor)}</b></span>
          <span>Waste <b>{eur(f.waste)}</b></span>
        </div>
      </Card>
    </motion.div>
  );
}

export function FoodReportCard({ fixtureId }: { fixtureId?: number }) {
  const { c } = useShop();
  const s = c.shop;
  const rep = s && (fixtureId != null ? s.food.reports.find((r) => r.fixtureId === fixtureId) : s.food.reports[0]);
  if (!s || !rep) return null;
  return (
    <Card title={`Food & drink · vs ${rep.opponent}`} actions={<Badge tone={rep.profit >= 0 ? 'good' : 'bad'}>{eur(rep.profit)} profit</Badge>}>
      <table className="tbl">
        <thead><tr><th>Outlet</th><th className="r">Customers</th><th className="r">Avg spend</th><th className="r">Revenue</th><th className="r">Food</th><th className="r">Labour</th><th className="r">Waste</th><th className="r">Profit</th><th className="r">Forecast</th></tr></thead>
        <tbody>
          {rep.lines.map((l) => {
            const o = s.food.outlets.find((x) => x.id === l.outletId);
            return (
              <tr key={l.outletId}>
                <td>{o ? SLOT_LABEL[o.slot] : '—'} <span className="faint small">{CONCEPTS[l.concept].label}</span></td>
                <td className="r">{l.customers}{l.lost ? <span className="bad small"> +{l.lost} lost</span> : null}</td>
                <td className="r">{eur(l.avgSpend)}</td>
                <td className="r">{eur(l.revenue)}</td>
                <td className="r">{eur(l.food)}</td>
                <td className="r">{eur(l.labor)}</td>
                <td className="r">{eur(l.waste)}</td>
                <td className={`r ${l.profit < 0 ? 'bad' : 'good'}`}>{eur(l.profit)}</td>
                <td className="r muted">{eur(l.expectedProfit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="small mt8"><span className="faint">Attendance {rep.attendance.toLocaleString('en')} · {fmtAbs(rep.day)} ·</span> <b>Why:</b> {rep.reason}</div>
    </Card>
  );
}

function LastGame() {
  return <FoodReportCard />;
}

export { absDay };
