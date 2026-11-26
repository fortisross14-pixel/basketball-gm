import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { OwnedFacility } from '../../../engine/types';
import { FACILITY_INFO, projectOptions, type ProjectOption } from '../../../engine/arena';
import { OWNED_INFO, OWNED_KEYS, assignOwner, facilityCapacity, ownerEffect } from '../../../engine/facilities';
import { club as getClub } from '../../../engine/world';
import { Badge, Bar, Card, Meter, Page, Stat } from '../../components/ui';
import { InfraArt } from '../../art/InfraArt';
import { useAct, useNotify } from '../../store';
import { ConstructionList, FacilityLevel, InfraKicker, OptionRow, ProjectModal, StaffSelect, useUserClub } from './common';

export default function SportsFacilities() {
  const { w, c } = useUserClub();
  const [pick, setPick] = useState<ProjectOption | null>(null);
  const effects = OWNED_KEYS.map((k) => ownerEffect(w, c, k));
  const owned = effects.filter((e) => e.owner).length;
  const avgEff = Math.round((effects.reduce((a, e) => a + e.effectiveness, 0) / OWNED_KEYS.length) * 100 / 1.15);
  return (
    <Page kicker={<InfraKicker />} title="Sports facilities" subtitle="Where the team trains, recovers and grows its own talent. Give each facility a responsible member of staff so it is used properly.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Facilities with an owner" value={`${owned}/${OWNED_KEYS.length}`} tone={owned < OWNED_KEYS.length ? 'warn' : 'good'} sub="Unowned facilities run at reduced effect" />
        <Stat label="Average usage" value={`${avgEff}%`} sub="How well your facilities are used" />
        <Stat label="Training ground" value={`Level ${c.arena.levels.training}`} sub={`${facilityCapacity(w, c, 'training').used}/${facilityCapacity(w, c, 'training').capacity} slots in use`} />
        <Stat label="Academy residence" value={`Level ${c.arena.levels.academy}`} sub={`${facilityCapacity(w, c, 'academy').used}/${facilityCapacity(w, c, 'academy').capacity} beds`} />
      </div>
      <div className="fac-grid">
        {OWNED_KEYS.map((k, i) => <FacilityCard key={k} k={k} i={i} onPlan={setPick} />)}
      </div>
      <Card title="Works under way" className="mt16">
        <ConstructionList filter={(kind, fac) => kind === 'facility' && OWNED_KEYS.includes(fac as OwnedFacility)} />
      </Card>
      {pick && <ProjectModal o={pick} onClose={() => setPick(null)} />}
    </Page>
  );
}

const ART: Record<OwnedFacility, 'training' | 'academy' | 'lockerRoom' | 'medical'> = { training: 'training', academy: 'academy', lockerRoom: 'lockerRoom', medical: 'medical' };

function FacilityCard({ k, i, onPlan }: { k: OwnedFacility; i: number; onPlan: (o: ProjectOption) => void }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const info = OWNED_INFO[k];
  const lvl = c.arena.levels[k];
  const cap = facilityCapacity(w, c, k);
  const eff = ownerEffect(w, c, k);
  const opt = projectOptions(w, c).find((o) => o.kind === 'facility' && o.facility === k);
  const building = (w.projects[c.id] ?? []).some((p) => p.kind === 'facility' && p.facility === k);
  const usage = Math.round((eff.effectiveness / 1.15) * 100);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
      <Card className={eff.owner ? '' : 'hot'}>
        <div className="fac-card">
          <div className="fc-art"><InfraArt kind={ART[k]} size={92} accent={eff.owner ? '#36d1ff' : '#fbbf24'} /></div>
          <div className="col gap4">
            <div className="row">
              <h2 style={{ flex: 1 }}>{info.label}</h2>
              {building ? <Badge tone="warn">Under construction</Badge> : <FacilityLevel level={lvl} />}
            </div>
            <div className="small muted">{info.effect} {FACILITY_INFO[k].effect}</div>
            <div className="mt8">
              <div className="row small"><span className="muted" style={{ flex: 1 }}>Capacity: {cap.used} using {cap.capacity} {info.capacityLabel}</span><b className={cap.used > cap.capacity ? 'bad' : ''}>{cap.used > cap.capacity ? '▼ Overcrowded' : 'OK'}</b></div>
              <Bar value={Math.min(cap.used, cap.capacity)} max={Math.max(1, cap.capacity)} color={cap.used > cap.capacity ? 'var(--bad)' : undefined} />
            </div>
            <Meter value={usage} label="Usage (how well it is run)" />
            <div className="owner-pick mt8">
              <span className="small muted">Responsible</span>
              <StaffSelect c={c} roles={info.roles} value={eff.owner?.id} label={`Responsible for ${info.label}`} onChange={(id) => { act((ww) => assignOwner(ww, getClub(ww, c.id), k, id)); notify(id == null ? `${info.label}: nobody responsible.` : `${info.label} now has a responsible member of staff.`, id == null ? 'warn' : 'good'); }} />
            </div>
            {eff.notes.length > 0 && <div className="small warn">{eff.notes.join(' ')}</div>}
            {!eff.owner && <div className="small faint">Best suited: {info.roles.map((r) => r.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}. <Link className="link" to="/team/staff">Hire staff</Link></div>}
            {opt && <OptionRow o={opt} onPlan={onPlan} />}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

