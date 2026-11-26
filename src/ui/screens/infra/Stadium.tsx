import { useState } from 'react';
import type { LeagueId } from '../../../engine/types';
import { absDay } from '../../../engine/types';
import { FACILITY_INFO, FACILITY_KEYS, MAX_LEVEL, capacity, maintenanceNeed, projectOptions, projectRoi, avgOccupancy, type ProjectOption } from '../../../engine/arena';
import { licenceCheck } from '../../../engine/season';
import { loanOffer } from '../../../engine/finance';
import { fmtAbs } from '../../../engine/calendar';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { Badge, Bar, Button, Callout, Card, Meter, Modal, Money, NumberField, Page, Stat, Table } from '../../components/ui';
import { useAct, useNotify } from '../../store';
import { launchProject, useUserClub } from './common';

const GROUPS: { id: string; label: string }[] = [
  { id: 'stadium', label: 'Stadium' },
  { id: 'stores', label: 'Stores' },
  { id: 'restaurants', label: 'Restaurants & hospitality' },
  { id: 'performance', label: 'Performance' },
  { id: 'community', label: 'Community & academy' },
];

export default function Stadium() {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const [maint, setMaint] = useState(c.finances.budget.maintenance);
  const a = c.arena;
  const cap = capacity(c);
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const up: LeagueId | null = c.leagueId === 'PLATA' ? 'ORO' : c.leagueId === 'ORO' ? 'ELITE' : null;
  const lic = up ? licenceCheck(w, c, up) : null;
  const need = maintenanceNeed(w, c);
  const projects = w.projects[c.id] ?? [];
  const now = absDay(w);
  const opts = projectOptions(w, c);
  return (
    <Page title={a.name} subtitle={`${c.city} · ${a.owned ? 'Club-owned' : `Municipal (rent ${fmtMoney(a.rentPerGame)} per home game)`} · opened ${a.opened}`}>
      <div className="grid g6">
        <Stat label="Capacity" value={cap.toLocaleString('en')} sub={`${Math.round(avgOccupancy(w, c) * 100)}% avg occupancy`} />
        <Stat label="General" value={a.seats.general.toLocaleString('en')} />
        <Stat label="Lower bowl" value={a.seats.lower.toLocaleString('en')} />
        <Stat label="Premium" value={a.seats.premium.toLocaleString('en')} />
        <Stat label="Suites" value={a.suites} />
        <Stat label="Condition" value={`${Math.round(a.condition)}/100`} tone={a.condition < 50 ? 'bad' : a.condition < 70 ? 'warn' : 'good'} />
      </div>

      <div className="grid g2 mt16">
        <Card title="League licence">
          {rules && (
            <div className="col">
              <div className="row">
                <span>{rules.name} minimum: {rules.minArenaSeats.toLocaleString('en')} seats</span>
                <span className="spacer" />
                <Badge tone={cap >= rules.minArenaSeats ? 'good' : 'bad'}>{cap >= rules.minArenaSeats ? 'Compliant' : 'Below minimum'}</Badge>
              </div>
              {up && lic && (
                <>
                  <div className="row">
                    <span>{w.rules.leagues[up].name} (if promoted): {w.rules.leagues[up].minArenaSeats.toLocaleString('en')} seats, {fmtMoney(w.rules.leagues[up].promotionFee)} entry guarantee</span>
                    <span className="spacer" />
                    <Badge tone={lic.ok ? 'good' : 'warn'}>{lic.ok ? 'Eligible' : 'Not eligible'}</Badge>
                  </div>
                  {!lic.ok && <Callout tone="warn">{lic.reasons.map((r, i) => <div key={i} className="small">• {r}</div>)}</Callout>}
                </>
              )}
              {!up && <div className="small muted">Top tier: no higher licence to meet.</div>}
            </div>
          )}
        </Card>
        <Card title="Maintenance">
          <div className="col">
            <Meter label="Arena condition" value={a.condition} />
            <div className="row small">
              <span className="muted">Needed to hold condition</span><span className="spacer" /><Money v={need} />/yr
            </div>
            <div className="row small">
              <span className="muted">Current budget</span><span className="spacer" /><Money v={c.finances.budget.maintenance} />/yr
            </div>
            <div className="row">
              <NumberField value={maint} step={5000} min={0} prefix="€" onChange={setMaint} width={140} />
              <Button size="sm" onClick={() => setMaint(need)}>Match need</Button>
              <Button size="sm" variant="primary" onClick={() => { act((ww) => { getClub(ww, c.id).finances.budget.maintenance = Math.max(0, Math.round(maint)); }); notify('Maintenance budget updated.', 'good'); }}>Apply</Button>
            </div>
            <div className="small faint">Underfunding saves cash but condition decays, lowering attendance interest. Overfunding restores condition.</div>
          </div>
        </Card>
      </div>

      <Card title="Under construction" className="mt16">
        {projects.length ? (
          <div className="col">
            {projects.map((p) => {
              const prog = Math.min(1, (now - p.startDay) / Math.max(1, p.endDay - p.startDay));
              return (
                <div key={p.id} className="list-item">
                  <div className="row">
                    <b>{p.label}</b>
                    <Badge>{p.financing === 'loan' ? 'Loan-financed' : 'Cash'}</Badge>
                    {p.disruption > 0 && <Badge tone="warn">{Math.round(p.disruption * 100)}% seats unavailable</Badge>}
                    <span className="spacer" />
                    <span className="small muted">Completes {fmtAbs(p.endDay)} · paid {fmtMoney(p.paid)} / {fmtMoney(p.cost)}</span>
                  </div>
                  <div className="mt8"><Bar value={prog * 100} /></div>
                </div>
              );
            })}
          </div>
        ) : <div className="muted small">No works in progress.</div>}
      </Card>

      <Card title="Facilities" className="mt16">
        <div className="grid g3">
          {GROUPS.map((g) => (
            <div key={g.id}>
              <h3 className="mb8">{g.label}</h3>
              {FACILITY_KEYS.filter((k) => FACILITY_INFO[k].group === g.id).map((k) => (
                <div key={k} className="mb8" title={`${FACILITY_INFO[k].effect} Trade-off: ${FACILITY_INFO[k].tradeoff}`}>
                  <div className="row small"><span>{FACILITY_INFO[k].label}</span><span className="spacer" /><b>{a.levels[k]}/{MAX_LEVEL}</b></div>
                  <Bar value={a.levels[k]} max={MAX_LEVEL} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Project catalogue" className="mt16">
        <Table
          rows={opts}
          rowKey={(o) => `${o.kind}-${o.facility ?? ''}`}
          columns={[
            { key: 'label', label: 'Project', render: (o) => <span title={o.description}>{o.label}</span> },
            { key: 'cost', label: 'Cost', render: (o) => <Money v={o.cost} />, sort: (o) => o.cost, align: 'r' },
            { key: 'weeks', label: 'Weeks', render: (o) => o.weeks, sort: (o) => o.weeks, align: 'r' },
            { key: 'dis', label: 'Disruption', render: (o) => (o.disruption ? `${Math.round(o.disruption * 100)}%` : '—'), align: 'r' },
            { key: 'up', label: 'Upkeep/yr', render: (o) => <Money v={o.annualUpkeep} />, align: 'r' },
            { key: 'roi', label: 'Net return/yr', render: (o) => <Money v={projectRoi(w, c, o).annual} tone />, sort: (o) => projectRoi(w, c, o).annual, align: 'r' },
            { key: 'pay', label: 'Payback', render: (o) => { const p = projectRoi(w, c, o).paybackYears; return p == null ? '—' : `${p} yrs`; }, align: 'r' },
            { key: 'board', label: '', render: (o) => (o.needsBoard ? <Badge tone="warn" title="Requires board approval">Board</Badge> : null) },
            { key: 'act', label: '', render: (o) => (o.blocked ? <Badge>{o.blocked}</Badge> : <Button size="sm" onClick={() => setPick(o)}>Plan…</Button>) },
          ]}
        />
      </Card>

      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </Page>
  );
}

function ProjectModal({ o, onClose }: { o: ProjectOption; onClose: () => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const [fin, setFin] = useState<'cash' | 'loan'>(c.finances.cash >= o.cost * 0.3 ? 'cash' : 'loan');
  const roi = projectRoi(w, c, o);
  const loan = loanOffer(w, c, o.cost * 0.8, 5);
  const down = Math.round(o.cost * 0.3);
  return (
    <Modal title={o.label} onClose={onClose}>
      <p>{o.description}</p>
      <div className="grid g4 mt8">
        <Stat label="Cost" value={fmtMoney(o.cost)} />
        <Stat label="Duration" value={`${o.weeks} wks`} />
        <Stat label="Disruption" value={o.disruption ? `${Math.round(o.disruption * 100)}%` : 'None'} sub="seats unavailable" />
        <Stat label="Upkeep" value={fmtMoney(o.annualUpkeep)} sub="per year" />
      </div>
      <Callout tone={roi.annual > 0 ? 'good' : 'warn'}>
        <div><b>Forecast:</b> {roi.annual >= 0 ? '+' : ''}{fmtMoney(roi.annual)}/yr net{roi.paybackYears != null ? `, payback ≈ ${roi.paybackYears} years` : ''}.</div>
        <div className="small muted">{roi.notes}</div>
      </Callout>
      {o.needsBoard && <Callout tone="warn">This project needs board approval{w.user.role === 'owner' ? ' — as owner you approve it yourself.' : '. The board weighs its confidence, risk appetite and the cost relative to revenue.'}</Callout>}
      <h3 className="mt16 mb8">Financing</h3>
      <div className="col">
        <label className="row"><input type="radio" checked={fin === 'cash'} onChange={() => setFin('cash')} /> Cash — {fmtMoney(down)} down payment now (30%), the rest weekly during construction. Cash: {fmtMoney(c.finances.cash)}.</label>
        <label className="row"><input type="radio" checked={fin === 'loan'} onChange={() => setFin('loan')} /> Loan — 80% financed over 5 years.{' '}
          {loan.ok ? <span className="muted">Rate {(loan.rate * 100).toFixed(1)}%, {fmtMoney(loan.monthly)}/month.</span> : <span className="bad">{loan.reason}</span>}
        </label>
      </div>
      <div className="row mt16">
        <span className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          const r = act((ww) => launchProject(ww, getClub(ww, c.id), o, fin));
          notify(r.message, r.ok ? 'good' : 'bad');
          if (r.ok) onClose();
        }}>Start works</Button>
      </div>
    </Modal>
  );
}
