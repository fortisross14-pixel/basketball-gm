import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ClubStore, MerchLine } from '../../../engine/types';
import { MERCH_LINES, REF_JERSEY, SPEND_PER_HEAD, merchDemandUnits, spendPerHead, tier } from '../../../engine/economy';
import { avgAttendance, projectOptions, type ProjectOption } from '../../../engine/arena';
import { STORE_INFO, ensureFacilities, managerFactor, storeOptions, storeProjectRoi, storeWeeklyDemand } from '../../../engine/facilities';
import { club as getClub, fmtMoney, seasonTotal, staffById } from '../../../engine/world';
import { Button, Card, Modal, NumberField, Page, Pills, Stat, Tabs } from '../../components/ui';
import { InfraArt } from '../../art/InfraArt';
import { useAct, useNotify } from '../../store';
import { ConstructionList, FacilityLevel, FacilityUpgrades, InfraKicker, OptionRow, ProjectModal, StaffSelect, useUserClub } from './common';

type Tab = 'merchandise' | 'food';

export default function CommercialFacilities() {
  const params = useParams();
  const navTo = useNavigate();
  const tab: Tab = params.tab === 'food' ? 'food' : 'merchandise';
  const setTab = (t: Tab) => navTo(`/infrastructure/commercial/${t}`, { replace: true });
  const { w, c } = useUserClub();
  const f = ensureFacilities(w, c);
  const merch = seasonTotal(c, w.season, 'merch');
  const merchCost = seasonTotal(c, w.season, 'merchCost');
  const lastWeek = f.stores.reduce((a, s) => a + s.lastWeekSales, 0);
  return (
    <Page tone="quiet" kicker={<InfraKicker />} title="Commercial facilities" subtitle="Club stores and matchday food & drink: what you sell, where, and at what price.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Merch revenue (season)" value={fmtMoney(merch)} sub={`net of stock ${fmtMoney(merch + merchCost)}`} />
        <Stat label="Last week, all stores" value={fmtMoney(lastWeek)} />
        <Stat label="Stores" value={f.stores.length} sub={f.stores.map((s) => STORE_INFO[s.kind].label).join(' · ')} />
        <Stat label="Food & drink (season)" value={fmtMoney(seasonTotal(c, w.season, 'concessions'))} sub={`${fmtMoney(spendPerHead(w, c))} net per fan`} />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'merchandise', label: 'Merchandise' }, { id: 'food', label: 'Food & drink' }]} />
      {tab === 'merchandise' ? <Stores /> : <Food />}
    </Page>
  );
}

const ART: Record<ClubStore['kind'], 'store' | 'online' | 'city' | 'outlet' | 'airport'> = { arena: 'store', online: 'online', city: 'city', outlet: 'outlet', airport: 'airport' };

function Stores() {
  const { w, c } = useUserClub();
  const f = ensureFacilities(w, c);
  const [manage, setManage] = useState<number | null>(null);
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const opts = storeOptions(w, c);
  const facilityOpts = projectOptions(w, c).filter((o) => o.kind === 'facility' && (o.facility === 'store' || o.facility === 'onlineStore'));
  const newStores = opts.filter((o) => o.kind === 'store');
  const store = f.stores.find((s) => s.id === manage) ?? null;
  return (
    <div className="col gap16">
      <div className="store-grid">
        {f.stores.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="store-card">
              <div className="sc-top">
                <InfraArt kind={ART[s.kind]} size={64} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: '#fff' }}>{s.name}</h3>
                  <div className="small muted">{STORE_INFO[s.kind].label}</div>
                  <FacilityLevel level={s.level} max={s.kind === 'arena' || s.kind === 'online' ? 5 : 3} />
                </div>
              </div>
              <div className="grid g2 mt8" style={{ gap: 8 }}>
                <Stat label="Last week" value={fmtMoney(s.lastWeekSales)} sub={`${s.lastWeekUnits} items`} />
                <Stat label="Season" value={fmtMoney(s.seasonSales)} />
              </div>
              <div className="small muted mt8">Manager: {s.managerId != null ? `${staffById(w, s.managerId)?.lastName ?? '—'} (+${Math.round((managerFactor(w, s) - 0.85) * 100)}% sales)` : 'nobody — sales below potential'}</div>
              <div className="row mt8"><span className="spacer" /><Button size="sm" variant="primary" onClick={() => setManage(s.id)}>Manage</Button></div>
            </Card>
          </motion.div>
        ))}
        {newStores.filter((o) => !o.blocked).map((o) => {
          const kind = o.storeKind!;
          const roi = storeProjectRoi(w, c, o);
          return (
            <Card key={kind} className="store-card new">
              <div className="sc-top">
                <InfraArt kind={ART[kind]} size={64} accent="#9fb1d8" />
                <div style={{ flex: 1 }}><h3 style={{ color: '#fff' }}>{STORE_INFO[kind].label}</h3><div className="small muted">Not built yet</div></div>
              </div>
              <p className="small muted mt8">{STORE_INFO[kind].desc}</p>
              <div className="small">Forecast: <b className={roi.annual >= 0 ? 'good' : 'bad'}>{roi.annual >= 0 ? '+' : ''}{fmtMoney(roi.annual)}/yr</b> after stock and rent</div>
              <OptionRow o={o} onPlan={setPick} />
            </Card>
          );
        })}
      </div>
      <div className="grid g2">
        <Card title="Arena & online store facilities">
          {facilityOpts.map((o) => <OptionRow key={o.facility} o={o} onPlan={setPick} />)}
          {opts.filter((o) => o.kind === 'storeUpgrade').map((o) => <OptionRow key={o.storeId} o={o} onPlan={setPick} />)}
        </Card>
        <Card title="Store works under way"><ConstructionList filter={(k, fac) => k === 'store' || k === 'storeUpgrade' || fac === 'store' || fac === 'onlineStore'} /></Card>
      </div>
      {store && <StoreModal s={store} onClose={() => setManage(null)} />}
      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

function StoreModal({ s, onClose }: { s: ClubStore; onClose: () => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const clubWide = s.kind === 'arena' || s.kind === 'online';
  const lines = clubWide ? c.merch.lines : s.lines;
  const ref = (REF_JERSEY[tier(w, c)] ?? 55) * c.economy;
  const upd = (fn: (st: ClubStore, cl: ReturnType<typeof getClub>) => void) => act((ww) => {
    const cl = getClub(ww, c.id);
    const st = ensureFacilities(ww, cl).stores.find((x) => x.id === s.id)!;
    fn(st, cl);
  });
  const toggle = (l: MerchLine) => upd((st, cl) => {
    const arr = clubWide ? cl.merch.lines : st.lines;
    const next = arr.includes(l) ? arr.filter((x) => x !== l) : [...arr, l];
    if (!next.length) return;
    if (clubWide) cl.merch.lines = next; else st.lines = next;
  });
  const est = clubWide ? merchDemandUnits(w, c) / 52 : storeWeeklyDemand(w, c, s);
  const price = clubWide ? c.merch.jerseyPrice : Math.round(c.merch.jerseyPrice * s.priceMult);
  return (
    <Modal title={s.name} onClose={onClose} wide>
      <div className="grid g3">
        <Stat label="Expected per week" value={`${Math.round(est)} items`} sub={`≈ ${fmtMoney(est * price * 0.75)} in sales`} />
        <Stat label="Jersey price" value={fmtMoney(price)} sub={`fair price ≈ ${fmtMoney(ref)}`} />
        <Stat label="Stock depth" value={clubWide ? c.merch.inventory : s.stock} sub="Lean risks lost sales · deep risks dead stock" />
      </div>
      <h3 className="mt16 mb8">Product lines</h3>
      <div className="line-chips">
        {(Object.keys(MERCH_LINES) as MerchLine[]).map((l) => (
          <button key={l} type="button" className={lines.includes(l) ? 'on' : ''} aria-pressed={lines.includes(l)} onClick={() => toggle(l)} title={`Appeal ${MERCH_LINES[l].appeal}, setup ${fmtMoney(MERCH_LINES[l].setup)}`}>{MERCH_LINES[l].label}</button>
        ))}
      </div>
      <div className="small faint mt8">{clubWide ? 'Arena and online stores share the club range; set-up costs apply at the next season order.' : 'This store carries its own selection.'}</div>
      <h3 className="mt16 mb8">Pricing & stock</h3>
      <div className="col">
        {clubWide ? (
          <div className="row"><span style={{ minWidth: 170 }}>Jersey price (club-wide)</span><NumberField label="Jersey price" value={c.merch.jerseyPrice} min={20} max={Math.round(ref * 2.5)} prefix="€" width={70} onChange={(v) => upd((_st, cl) => { cl.merch.jerseyPrice = v; })} /></div>
        ) : (
          <div className="row"><span style={{ minWidth: 170 }}>Price vs club price</span><NumberField label="Store price level" value={Math.round(s.priceMult * 100)} min={70} max={140} step={5} suffix="%" width={60} onChange={(v) => upd((st) => { st.priceMult = v / 100; })} /></div>
        )}
        <div className="row"><span style={{ minWidth: 170 }}>Stock depth</span>
          <Pills value={clubWide ? c.merch.inventory : s.stock} onChange={(v) => upd((st, cl) => { if (clubWide) cl.merch.inventory = v; else st.stock = v; })} options={[{ id: 'lean', label: 'Lean' }, { id: 'normal', label: 'Normal' }, { id: 'deep', label: 'Deep' }]} />
        </div>
        <div className="row"><span style={{ minWidth: 170 }}>Store manager</span>
          <div style={{ flex: 1 }} className="owner-pick"><StaffSelect c={c} roles={['marketingDirector', 'commercialDirector']} value={s.managerId} label="Store manager" onChange={(id) => { upd((st) => { st.managerId = id; }); notify(id == null ? 'Store has no manager.' : 'Manager assigned.', 'good'); }} /></div>
        </div>
      </div>
      <div className="small faint mt8">Managers from marketing or commercial lift sales by up to 25%; other staff help less. One person can manage several stores.</div>
    </Modal>
  );
}

const PRICING_INFO = {
  value: 'Value pricing: −18% spend per head, but supporters notice and sentiment rises over time.',
  standard: 'Standard pricing: market-rate food and drink.',
  premium: 'Premium pricing: +20% spend per head, but fans feel squeezed and sentiment drifts down.',
};

function Food() {
  const { w, c } = useUserClub();
  const act = useAct();
  const sph = spendPerHead(w, c);
  const att = avgAttendance(w, c);
  const upd = (fn: (cl: ReturnType<typeof getClub>) => void) => act((ww) => fn(getClub(ww, c.id)));
  return (
    <div className="col gap16">
      <div className="grid g3">
        <Stat label="Net spend per attendee" value={fmtMoney(sph)} sub={`tier reference gross ${fmtMoney(SPEND_PER_HEAD[tier(w, c)])}`} />
        <Stat label="Average attendance" value={Math.round(att).toLocaleString('en')} />
        <Stat label="Estimated per home game" value={fmtMoney(sph * att)} />
      </div>
      <div className="grid g2">
        <Card title="Operating policy">
          <div className="col">
            <div className="row"><span style={{ minWidth: 140 }}>Pricing</span><Pills value={c.concessions.pricing} onChange={(v) => upd((cl) => { cl.concessions.pricing = v; })} options={[{ id: 'value', label: 'Value' }, { id: 'standard', label: 'Standard' }, { id: 'premium', label: 'Premium' }]} /></div>
            <div className="small muted">{PRICING_INFO[c.concessions.pricing]}</div>
            <label className="row"><input type="checkbox" checked={c.concessions.localSuppliers} onChange={(e) => upd((cl) => { cl.concessions.localSuppliers = e.target.checked; })} /> Local suppliers <span className="small muted">— margin 48% → 40%, the community and fans appreciate it.</span></label>
          </div>
        </Card>
        <FacilityUpgrades keys={['concessions', 'restaurant', 'hospitality']} title="Food & hospitality facilities" />
      </div>
    </div>
  );
}
