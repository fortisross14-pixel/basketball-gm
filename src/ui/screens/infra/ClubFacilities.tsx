import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { StaffRole } from '../../../engine/types';
import { STAFF_LABEL, STAFF_ROLES } from '../../../engine/staff';
import { OFFICE_INFO, PRESS_STANCES, PRESS_TOPICS, PRESS_COOLDOWN, ensureFacilities, holdPressConference, officeOptions, pressAvailableIn, prFactor, staffCapacity, staffUsed, type PressStance, type PressTopic } from '../../../engine/facilities';
import { club as getClub, staffOf } from '../../../engine/world';
import { fmtAbs } from '../../../engine/calendar';
import { type ProjectOption } from '../../../engine/arena';
import { Badge, Button, Card, Meter, Page, Pills, Stat } from '../../components/ui';
import { InfraArt } from '../../art/InfraArt';
import { useAct, useNotify } from '../../store';
import { ConstructionList, FacilityLevel, InfraKicker, OptionRow, ProjectModal, useUserClub } from './common';

export default function ClubFacilities() {
  const { w, c } = useUserClub();
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const f = ensureFacilities(w, c);
  const cap = staffCapacity(w, c);
  const used = staffUsed(w, c);
  const opts = officeOptions(w, c);
  return (
    <Page kicker={<InfraKicker />} title="Club facilities" subtitle="The back office that runs the club: room for the staff you delegate to, and the press room where the club speaks.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Staff desks" value={`${used}/${cap}`} tone={used >= cap ? 'warn' : undefined} sub={used >= cap ? 'Full: expand to add posts' : `${cap - used} free`} />
        <Stat label="Corporate offices" value={`Level ${f.offices.corporate}`} />
        <Stat label="PR office" value={`Level ${f.offices.pr}`} sub={`Press effect ×${prFactor(w, c).toFixed(2)}`} />
        <Stat label="Press relationship" value={`${Math.round(c.board.trust.media)}/100`} tone={c.board.trust.media < 40 ? 'bad' : c.board.trust.media > 65 ? 'good' : undefined} />
      </div>
      <div className="grid g2">
        <Card title="Corporate offices">
          <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <InfraArt kind="corporate" size={96} />
            <div style={{ flex: 1 }} className="col gap4">
              <FacilityLevel level={f.offices.corporate} />
              <div className="small muted">{OFFICE_INFO.corporate.desc}</div>
              <div className="desk-row mt8" aria-label={`${used} of ${cap} desks in use`}>{Array.from({ length: cap }, (_, i) => <i key={i} className={i < used ? 'on' : ''} />)}</div>
            </div>
          </div>
          <h3 className="mt16 mb8">Staff posts</h3>
          <div className="post-grid">
            {STAFF_ROLES.map((r: StaffRole) => {
              const s = staffOf(w, c, r);
              return (
                <div key={r} className={`post ${s ? '' : 'vacant'}`}>
                  <small>{STAFF_LABEL[r]}</small>
                  {s ? <b>{s.firstName} {s.lastName}</b> : <span className="muted">Vacant</span>}
                </div>
              );
            })}
          </div>
          <div className="row mt8"><span className="spacer" /><Link className="btn sm" to="/team/staff">Hire & manage staff</Link></div>
          {opts.filter((o) => o.office === 'corporate').map((o) => <OptionRow key="corp" o={o} onPlan={setPick} />)}
        </Card>
        <PressRoom onPlan={setPick} />
      </div>
      <Card title="Office works under way" className="mt16"><ConstructionList filter={(k) => k === 'office'} /></Card>
      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </Page>
  );
}

function PressRoom({ onPlan }: { onPlan: (o: ProjectOption) => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const f = ensureFacilities(w, c);
  const [topic, setTopic] = useState<PressTopic>('outlook');
  const [stance, setStance] = useState<PressStance>('humble');
  const wait = pressAvailableIn(w, c);
  const lead = staffOf(w, c, 'prLead');
  const opt = officeOptions(w, c).find((o) => o.office === 'pr');
  return (
    <Card title="PR & communications office">
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <InfraArt kind="pr" size={96} />
        <div style={{ flex: 1 }} className="col gap4">
          <FacilityLevel level={f.offices.pr} />
          <div className="small muted">{OFFICE_INFO.pr.desc}</div>
          <Meter value={c.board.trust.media} label="Relationship with the press" />
          <div className="small">PR lead: {lead ? <b>{lead.firstName} {lead.lastName} ({lead.rating})</b> : <span className="warn">vacant — press conferences land worse</span>}</div>
        </div>
      </div>
      <h3 className="mt16 mb8">Hold a press conference</h3>
      <div className="row wrap"><span className="small muted" style={{ minWidth: 60 }}>Topic</span><Pills value={topic} onChange={setTopic} options={(Object.keys(PRESS_TOPICS) as PressTopic[]).map((t) => ({ id: t, label: PRESS_TOPICS[t] }))} /></div>
      <div className="stance-grid mt8">
        {(Object.keys(PRESS_STANCES) as PressStance[]).map((s) => (
          <button key={s} type="button" className={`stance ${stance === s ? 'on' : ''}`} aria-pressed={stance === s} onClick={() => setStance(s)}>
            <b>{PRESS_STANCES[s].label}</b>
            <span className="small muted">{PRESS_STANCES[s].desc}</span>
          </button>
        ))}
      </div>
      <div className="row mt8">
        <span className="small muted">Effect strength ×{prFactor(w, c).toFixed(2)} (office level + PR lead). One every {PRESS_COOLDOWN} days.</span>
        <span className="spacer" />
        <Button variant="primary" disabled={wait > 0} onClick={() => { const r = act((ww) => holdPressConference(ww, getClub(ww, c.id), topic, stance)); notify(r.message, r.ok ? 'good' : 'warn'); }}>{wait > 0 ? `Available in ${wait}d` : 'Face the press'}</Button>
      </div>
      <AnimatePresence>
        {f.pressLog.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt16">
            <h3 className="mb8">Recent press conferences</h3>
            <div className="list">
              {f.pressLog.slice(0, 4).map((p, i) => (
                <motion.div key={p.day + p.topic} className="list-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="row"><Badge>{p.stance}</Badge><b>{p.topic}</b><span className="spacer" /><span className="small faint">{fmtAbs(p.day)}</span></div>
                  <div className="small muted">{p.result}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {opt && <OptionRow o={opt} onPlan={onPlan} />}
    </Card>
  );
}
