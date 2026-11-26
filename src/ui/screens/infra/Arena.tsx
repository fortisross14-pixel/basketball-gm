import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { FacilityKey, ProjectKind } from '../../../engine/types';
import { absDay } from '../../../engine/types';
import { FACILITY_INFO, avgOccupancy, capacity, maintenanceNeed, projectOptions, type ProjectOption } from '../../../engine/arena';
import { licenceCheck } from '../../../engine/season';
import { suiteDemand } from '../../../engine/economy';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { Badge, Button, Callout, Card, Meter, NumberField, Page, Stat, Tabs } from '../../components/ui';
import { ArenaModel, type ArenaZone, type ZoneMarker } from '../../art/ArenaModel';
import { useAct, useNotify } from '../../store';
import { ConstructionList, FacilityLevel, InfraKicker, OptionRow, ProjectModal, useUserClub } from './common';
import { TicketStrategy } from './Tickets';

type Tab = 'upgrades' | 'tickets';

const ZONES: { zone: ArenaZone; label: string; color: string; facilities: FacilityKey[]; kinds: ProjectKind[]; desc: string }[] = [
  { zone: 'seating', label: 'Seating bowl', color: '#ff8a1f', facilities: [], kinds: ['expandGeneral', 'expandLower', 'premiumSeats', 'renovation'], desc: 'Upper tier, lower bowl and courtside seats. Capacity drives gate revenue and licence eligibility; seat quality follows the arena condition.' },
  { zone: 'scoreboard', label: 'Videoboard', color: '#36d1ff', facilities: ['videoboard'], kinds: [], desc: 'Centre-hung videoboard and sound. Lifts atmosphere and attendance interest, and makes court & LED sponsorship more valuable.' },
  { zone: 'vip', label: 'VIP & suites', color: '#ffd23f', facilities: ['hospitality'], kinds: ['suites'], desc: 'Corporate suites and the VIP hospitality lounge: season-long premium revenue and corporate partners.' },
  { zone: 'concessions', label: 'Concourse food', color: '#34d399', facilities: ['concessions', 'restaurant'], kinds: [], desc: 'Concession stands and the arena restaurant: spend per fan on every matchday.' },
  { zone: 'access', label: 'Access & gates', color: '#a78bfa', facilities: ['accessibility'], kinds: [], desc: 'Entrances, transit links, accessibility and safety. Improves attendance and civic goodwill; required for a modern licence.' },
  { zone: 'parking', label: 'Parking & fan zone', color: '#60a5fa', facilities: ['parking'], kinds: [], desc: 'Parking and the outdoor fan zone: brings in regional fans and pre-game spend.' },
];

export default function Arena() {
  const { tab = 'upgrades' } = useParams();
  const nav = useNavigate();
  const { w, c } = useUserClub();
  const cap = capacity(c);
  const occ = avgOccupancy(w, c);
  return (
    <Page kicker={<InfraKicker />} title={c.arena.name} subtitle={`${c.city} · ${c.arena.owned ? 'Club-owned arena' : `Municipal arena (rent ${fmtMoney(c.arena.rentPerGame)} per home game)`} · opened ${c.arena.opened}`}>
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Capacity" value={cap.toLocaleString('en')} sub={`${Math.round(occ * 100)}% average occupancy`} />
        <Stat label="Seats by zone" value={`${(c.arena.seats.general / 1000).toFixed(1)}k / ${(c.arena.seats.lower / 1000).toFixed(1)}k / ${c.arena.seats.premium}`} sub="General · lower bowl · courtside" />
        <Stat label="Suites" value={`${c.ticketing.suitesSold}/${c.arena.suites}`} sub={`demand ${suiteDemand(w, c)}`} />
        <Stat label="Condition" value={`${Math.round(c.arena.condition)}/100`} tone={c.arena.condition < 50 ? 'bad' : c.arena.condition > 80 ? 'good' : undefined} sub="Seat quality & atmosphere" />
      </div>
      <Tabs<Tab> value={tab as Tab} onChange={(t) => nav(t === 'upgrades' ? '/infrastructure/arena' : `/infrastructure/arena/${t}`)} tabs={[{ id: 'upgrades', label: 'Upgrades' }, { id: 'tickets', label: 'Ticket prices' }]} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
          {tab === 'tickets' ? <TicketStrategy /> : <Upgrades />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function Upgrades() {
  const { w, c } = useUserClub();
  const [zone, setZone] = useState<ArenaZone | null>('seating');
  const goTo = useNavigate();
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const opts = projectOptions(w, c);
  const now = absDay(w);
  const projects = w.projects[c.id] ?? [];
  const progressFor = (z: (typeof ZONES)[number]) => {
    const p = projects.find((x) => (x.facility && z.facilities.includes(x.facility)) || z.kinds.includes(x.kind));
    return p ? Math.min(1, Math.max(0, (now - p.startDay) / Math.max(1, p.endDay - p.startDay))) : null;
  };
  const occ = Math.min(1, avgOccupancy(w, c));
  const markers: ZoneMarker[] = ZONES.map((z) => ({
    zone: z.zone,
    label: z.label,
    value: z.zone === 'seating' ? `${capacity(c).toLocaleString('en')} seats` : z.zone === 'vip' ? `${c.arena.suites} suites · lvl ${c.arena.levels.hospitality}` : `Level ${z.facilities.map((f) => c.arena.levels[f]).join(' / ')}`,
    building: progressFor(z),
  }));
  const current = ZONES.find((z) => z.zone === zone);
  const lic = c.leagueId === 'ORO' || c.leagueId === 'PLATA' ? licenceCheck(w, c, c.leagueId === 'ORO' ? 'ELITE' : 'ORO') : null;
  const newArena = opts.find((o) => o.kind === 'newArena');
  return (
    <div>
      {lic && !lic.ok && <div className="mb8" style={{ marginBottom: 12 }}><Callout tone="warn"><b>Licence for the league above:</b> {lic.reasons.join(' ')}</Callout></div>}
      <div className="arena-stage">
        <div>
          <ArenaModel markers={markers} selected={zone} onSelect={(z) => (z === 'concessions' ? goTo('/business/food') : setZone(z))} colors={c.colors} seatsFill={{ general: occ, lower: Math.min(1, occ * 1.05), premium: Math.min(1, occ * 0.9) }} />
          <div className="zone-legend">
            {ZONES.map((z) => (
              <button key={z.zone} type="button" className={zone === z.zone ? 'on' : ''} onClick={() => setZone(z.zone)}><i style={{ background: z.color }} />{z.label}</button>
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {current && (
            <motion.div key={current.zone} className="zone-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
              <Card>
                <div className="zp-head"><span className="zp-dot" style={{ color: current.color }} /><h2>{current.label}</h2></div>
                <p className="small muted">{current.desc}</p>
                <ZoneState zone={current.zone} />
                <h3 className="mt16">Actions</h3>
                {opts.filter((o) => (o.facility && current.facilities.includes(o.facility)) || current.kinds.includes(o.kind)).map((o) => (
                  <OptionRow key={`${o.kind}-${o.facility ?? ''}`} o={o} onPlan={setPick} />
                ))}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid g2 mt16">
        <Card title="Works under way"><ConstructionList filter={(k) => k !== 'store' && k !== 'storeUpgrade' && k !== 'office'} /></Card>
        <MaintenanceCard />
      </div>
      {newArena && (
        <Card title="A new home" className="mt16">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p>{newArena.description}</p>
              <div className="small muted">{fmtMoney(newArena.cost)} · {newArena.weeks} weeks of construction · needs board approval</div>
            </div>
            {newArena.blocked ? <Badge>{newArena.blocked}</Badge> : <Button variant="primary" onClick={() => setPick(newArena)}>Plan the new arena…</Button>}
          </div>
        </Card>
      )}
      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

function ZoneState({ zone }: { zone: ArenaZone }) {
  const { w, c } = useUserClub();
  const row = (label: string, value: ReactNode) => <div className="row small" style={{ padding: '3px 0' }}><span className="muted" style={{ flex: 1 }}>{label}</span><b>{value}</b></div>;
  const fac = (k: FacilityKey) => row(FACILITY_INFO[k].label, <FacilityLevel level={c.arena.levels[k]} />);
  switch (zone) {
    case 'seating':
      return (
        <div className="col gap4">
          {row('General (upper tier)', c.arena.seats.general.toLocaleString('en'))}
          {row('Lower bowl', c.arena.seats.lower.toLocaleString('en'))}
          {row('Courtside & club seats', c.arena.seats.premium.toLocaleString('en'))}
          {row('Season-ticket holders', (c.ticketing.seasonSold.general + c.ticketing.seasonSold.lower + c.ticketing.seasonSold.premium).toLocaleString('en'))}
          <Meter value={c.arena.condition} label="Seat quality (arena condition)" />
          <Meter value={Math.min(100, avgOccupancy(w, c) * 100)} label="Average occupancy" />
        </div>
      );
    case 'scoreboard': return <div className="col gap4">{fac('videoboard')}</div>;
    case 'vip': return <div className="col gap4">{row('Suites sold', `${c.ticketing.suitesSold}/${c.arena.suites}`)}{row('Suite price', `${fmtMoney(c.ticketing.suitePrice)}/season`)}{row('Suite demand', suiteDemand(w, c))}{fac('hospitality')}</div>;
    case 'concessions': return <div className="col gap4">{fac('concessions')}{fac('restaurant')}{row('Pricing', c.concessions.pricing)}<Link className="btn primary sm" to="/business/food" style={{ alignSelf: 'flex-start', marginTop: 6 }}>Open Food &amp; Drink</Link></div>;
    case 'access': return <div className="col gap4">{fac('accessibility')}{row('Licence relevance', 'Required for modern venues')}</div>;
    case 'parking': return <div className="col gap4">{fac('parking')}</div>;
  }
}

function MaintenanceCard() {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const need = maintenanceNeed(w, c);
  const [budget, setBudget] = useState(c.finances.budget.maintenance);
  return (
    <Card title="Maintenance">
      <Meter value={c.arena.condition} label="Arena condition" />
      <div className="row small mt8"><span className="muted" style={{ flex: 1 }}>Needed to hold condition</span><b>{fmtMoney(need)}/yr</b></div>
      <div className="row mt8">
        <NumberField label="Maintenance budget" value={budget} min={0} max={Math.max(need * 3, 10000)} step={1000} prefix="€" width={90} onChange={setBudget} />
      </div>
      <div className="row mt8">
        <Button size="sm" onClick={() => setBudget(need)}>Match need</Button>
        <span className="spacer" />
        <Button size="sm" variant="primary" disabled={budget === c.finances.budget.maintenance} onClick={() => { act((ww) => { getClub(ww, c.id).finances.budget.maintenance = budget; }); notify(`Maintenance budget set to ${fmtMoney(budget)}/yr.`, 'good'); }}>Apply</Button>
      </div>
      <div className="small faint mt8">Underfunding saves cash but the condition decays — seat quality and attendance interest fall. Overfunding restores it.</div>
    </Card>
  );
}
