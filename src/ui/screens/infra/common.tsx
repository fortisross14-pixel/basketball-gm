import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Club, FacilityKey, Staff, StaffRole, World } from '../../../engine/types';
import { absDay } from '../../../engine/types';
import { FACILITY_INFO, MAX_LEVEL, projectOptions, projectRoi, startProject, type ProjectOption } from '../../../engine/arena';
import { boardApproves } from '../../../engine/board';
import { loanOffer } from '../../../engine/finance';
import { fmtAbs } from '../../../engine/calendar';
import { STAFF_LABEL } from '../../../engine/staff';
import { club as getClub, clubStaff, fmtMoney } from '../../../engine/world';
import { Badge, Button, Callout, Card, Modal, Stat } from '../../components/ui';
import { useAct, useNotify, useWorld } from '../../store';
import './infra.css';

export function useUserClub(): { w: World; c: Club } {
  const w = useWorld();
  return { w, c: getClub(w, w.user.clubId!) };
}

/** Board check + start a project; returns a message for the user. */
export function launchProject(w: World, c: Club, o: ProjectOption, financing: 'cash' | 'loan'): { ok: boolean; message: string } {
  if (o.needsBoard) {
    const b = boardApproves(w, c, o.cost);
    if (!b.ok) return { ok: false, message: b.message };
  }
  const res = startProject(w, c, o, financing);
  if (!res.ok) return { ok: false, message: res.reason ?? 'The project could not be started.' };
  return { ok: true, message: `Works started: ${o.label} (${fmtMoney(o.cost)}, ~${o.weeks} weeks).` };
}

export function InfraKicker() {
  return <Link to="/infrastructure" className="link">Infrastructure</Link>;
}

/** Plan a project: cost, ROI, disruption, board approval and financing. */
export function ProjectModal({ o, onClose }: { o: ProjectOption; onClose: () => void }) {
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
      <div className="mt8">
        <Callout tone={roi.annual > 0 ? 'good' : 'warn'}>
          <div><b>Forecast:</b> {roi.annual >= 0 ? '+' : ''}{fmtMoney(roi.annual)}/yr net{roi.paybackYears != null ? `, payback ≈ ${roi.paybackYears} years` : ''}.</div>
          <div className="small muted">{roi.notes || 'Sporting or organisational benefit rather than direct revenue.'}</div>
        </Callout>
      </div>
      {o.needsBoard && <div className="mt8"><Callout tone="warn">This project needs board approval{w.user.role === 'owner' ? ' — as owner you approve it yourself.' : '. The board weighs its confidence, risk appetite and the cost relative to revenue.'}</Callout></div>}
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

/** One project option as a compact row with cost/ROI and a Plan button. */
export function OptionRow({ o, onPlan, extra }: { o: ProjectOption; onPlan: (o: ProjectOption) => void; extra?: ReactNode }) {
  const { w, c } = useUserClub();
  const roi = projectRoi(w, c, o);
  return (
    <div className="zone-option">
      <div className="zo-row">
        <b style={{ flex: 1 }}>{o.label}</b>
        {o.blocked ? <Badge>{o.blocked}</Badge> : <Button size="sm" variant="primary" onClick={() => onPlan(o)}>Plan…</Button>}
      </div>
      <div className="zo-meta">
        {fmtMoney(o.cost)} · {o.weeks} wks{o.disruption ? ` · ${Math.round(o.disruption * 100)}% seats closed` : ''} · upkeep {fmtMoney(o.annualUpkeep)}/yr
        {' · '}<span className={roi.annual > 0 ? 'good' : roi.annual < 0 ? 'bad' : ''}>{roi.annual >= 0 ? '+' : ''}{fmtMoney(roi.annual)}/yr</span>
        {o.needsBoard && <> · <span className="warn">board approval</span></>}
      </div>
      {extra}
    </div>
  );
}

export function FacilityLevel({ level, max = MAX_LEVEL }: { level: number; max?: number }) {
  return <span className="fac-level" title={`Level ${level}/${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}</span>;
}

/** Staff picker; specialists first. */
export function StaffSelect({ c, roles, value, onChange, label }: { c: Club; roles: StaffRole[]; value: number | null | undefined; onChange: (id: number | null) => void; label: string }) {
  const w = useWorld();
  const staff = clubStaff(w, c.id).sort((a: Staff, b: Staff) => Number(roles.includes(b.role)) - Number(roles.includes(a.role)) || b.rating - a.rating);
  return (
    <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">— Nobody assigned —</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>{roles.includes(s.role) ? '★ ' : ''}{s.firstName} {s.lastName} · {STAFF_LABEL[s.role]} · {s.rating}</option>
      ))}
    </select>
  );
}

/** Works under way for this club, optionally filtered. */
export function ConstructionList({ filter, empty = 'No works in progress.' }: { filter?: (kind: string, facility?: string) => boolean; empty?: string }) {
  const { w, c } = useUserClub();
  const now = absDay(w);
  const list = (w.projects[c.id] ?? []).filter((p) => !filter || filter(p.kind, p.facility ?? p.office ?? p.storeKind));
  if (!list.length) return <div className="small muted">{empty}</div>;
  return (
    <div>
      {list.map((p) => {
        const pct = Math.min(1, Math.max(0, (now - p.startDay) / Math.max(1, p.endDay - p.startDay)));
        return (
          <div key={p.id} className="build-row">
            <div><b>{p.label}</b><div className="small muted">Opens {fmtAbs(p.endDay)} · paid {fmtMoney(p.paid)} of {fmtMoney(p.cost)}</div></div>
            <div className="build-bar"><div style={{ width: `${pct * 100}%` }} /></div>
            <div className="right small"><b>{Math.round(pct * 100)}%</b>{p.disruption ? <div className="warn">{Math.round(p.disruption * 100)}% seats closed</div> : null}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact facility levels with plan buttons (opens ProjectModal). */
export function FacilityUpgrades({ keys, title }: { keys: FacilityKey[]; title: string }) {
  const { w, c } = useUserClub();
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const opts = projectOptions(w, c);
  const active = w.projects[c.id] ?? [];
  return (
    <Card title={title}>
      <div className="col">
        {keys.map((k) => {
          const info = FACILITY_INFO[k];
          const lvl = c.arena.levels[k];
          const o = opts.find((x) => x.kind === 'facility' && x.facility === k);
          const building = active.find((p) => p.kind === 'facility' && p.facility === k);
          return (
            <div key={k} className="list-item">
              <div className="row">
                <b style={{ minWidth: 200 }}>{info.label}</b>
                <FacilityLevel level={lvl} />
                <span className="spacer" />
                {building ? <Badge tone="warn">Under construction</Badge> : o && !o.blocked ? <Button size="sm" onClick={() => setPick(o)}>Upgrade · {fmtMoney(o.cost)}</Button> : <Badge>{o?.blocked ?? 'Max'}</Badge>}
              </div>
              <div className="small faint mt8">{info.effect} Trade-off: {info.tradeoff}</div>
            </div>
          );
        })}
      </div>
      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </Card>
  );
}

export { FACILITY_INFO, MAX_LEVEL };
