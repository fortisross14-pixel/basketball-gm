import type { MerchLine } from '../../../engine/types';
import { MERCH_LINES, REF_JERSEY, merchDemandUnits, merchUnitCost, inventoryUnits, tier } from '../../../engine/economy';
import { club as getClub, fmtMoney, seasonTotal, roster, playerName } from '../../../engine/world';
import { Badge, Callout, Card, Money, NumberField, Page, Pills, Stat } from '../../components/ui';
import { useAct } from '../../store';
import { FacilityUpgrades, useUserClub } from './common';

const INV_INFO: Record<'lean' | 'normal' | 'deep', string> = {
  lean: 'Order ~75% of expected demand. Little dead stock, but you will sell out and lose sales if the team takes off.',
  normal: 'Order ~100% of expected demand. Balanced risk.',
  deep: 'Order ~135% of expected demand. Captures a breakout season, but unsold stock is written down 50% each summer.',
};

export default function Stores() {
  const { w, c } = useUserClub();
  const act = useAct();
  const m = c.merch;
  const demand = merchDemandUnits(w, c);
  const unitCost = merchUnitCost(c);
  const stockUnits = Math.round(m.stockValue / Math.max(1, unitCost));
  const rev = seasonTotal(c, w.season, 'merch');
  const cost = seasonTotal(c, w.season, 'merchCost');
  const ref = REF_JERSEY[tier(w, c)] * c.economy;
  const star = roster(w, c.id).sort((a, b) => b.ovr - a.ovr)[0];
  const upd = (fn: (cl: ReturnType<typeof getClub>) => void) => act((ww) => fn(getClub(ww, c.id)));
  return (
    <Page title="Stores & merchandise" subtitle="Product range, pricing and stock risk. The order for next season is placed on 1 July using these settings.">
      <div className="grid g4">
        <Stat label="Merch revenue (season)" value={fmtMoney(rev)} />
        <Stat label="Stock purchases (season)" value={fmtMoney(cost)} />
        <Stat label="Net merch" value={fmtMoney(rev + cost)} tone={rev + cost >= 0 ? 'good' : 'bad'} />
        <Stat label="Stock on hand" value={fmtMoney(m.stockValue)} sub={`≈ ${stockUnits.toLocaleString('en')} units`} />
      </div>
      <div className="grid g2 mt16">
        <Card title="Demand vs order">
          <div className="kv">
            <span>Expected demand (season)</span><b>{demand.toLocaleString('en')} units</b>
            <span>Ordered this season</span><b>{m.orderedUnits.toLocaleString('en')} units</b>
            <span>Next order at current settings</span><b>{inventoryUnits(w, c).toLocaleString('en')} units</b>
            <span>Unit cost</span><b>{fmtMoney(unitCost)}</b>
          </div>
          {stockUnits <= 0 && <Callout tone="warn">Sold out — further demand this season is lost. Consider a deeper inventory next year.</Callout>}
          <div className="small faint mt8">Demand grows with every fan segment (local, regional, national, international, digital), hype, star power and the range you offer.</div>
        </Card>
        <Card title="Pricing & stock policy">
          <div className="col">
            <div className="row">
              <span style={{ minWidth: 140 }}>Jersey price</span>
              <NumberField value={m.jerseyPrice} min={10} prefix="€" width={80} onChange={(v) => upd((cl) => { cl.merch.jerseyPrice = Math.max(10, v); })} />
              <span className="small muted">market reference ≈ {fmtMoney(ref)}</span>
            </div>
            <div className="row">
              <span style={{ minWidth: 140 }}>Inventory depth</span>
              <Pills value={m.inventory} onChange={(v) => upd((cl) => { cl.merch.inventory = v; })} options={[{ id: 'lean', label: 'Lean' }, { id: 'normal', label: 'Normal' }, { id: 'deep', label: 'Deep' }]} />
            </div>
            <div className="small muted">{INV_INFO[m.inventory]}</div>
            <div className="row">
              <span style={{ minWidth: 140 }}>Online allocation</span>
              <input type="range" min={0} max={0.8} step={0.05} value={m.onlineShare} onChange={(e) => upd((cl) => { cl.merch.onlineShare = Number(e.target.value); })} />
              <b>{Math.round(m.onlineShare * 100)}% online</b>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Product lines" className="mt16">
        <div className="grid g4">
          {(Object.keys(MERCH_LINES) as MerchLine[]).map((l) => {
            const info = MERCH_LINES[l];
            const on = m.lines.includes(l);
            const core = l === 'home';
            return (
              <label key={l} className="stat row" style={{ cursor: core ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={on} disabled={core} onChange={(e) => upd((cl) => { cl.merch.lines = e.target.checked ? [...cl.merch.lines, l] : cl.merch.lines.filter((x) => x !== l); })} />
                <div>
                  <b>{info.label}</b>
                  <div className="small muted">Appeal {info.appeal} · setup {info.setup ? <Money v={info.setup} /> : 'none'}</div>
                  {l === 'signature' && <div className="small faint">Built around {star ? playerName(star) : 'your best player'}.</div>}
                  {l === 'european' && <div className="small faint">Boost only while in continental competition.</div>}
                </div>
                {on && <Badge tone="good">On</Badge>}
              </label>
            );
          })}
        </div>
        <div className="small faint mt8">More lines raise demand with diminishing returns (√ of total appeal). Setup costs are charged with the July order.</div>
      </Card>
      <div className="mt16">
        <FacilityUpgrades keys={['store', 'onlineStore']} title="Retail facilities" />
      </div>
    </Page>
  );
}
