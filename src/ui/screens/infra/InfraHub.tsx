import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { avgOccupancy, capacity, maintenanceNeed } from '../../../engine/arena';
import { OWNED_KEYS, ensureFacilities, facilitiesUpkeep, ownerEffect, prFactor, staffCapacity, staffUsed } from '../../../engine/facilities';
import { fmtMoney, seasonTotal } from '../../../engine/world';
import { Card, Meter, Page, Stat } from '../../components/ui';
import { InfraArt, type InfraArtKind } from '../../art/InfraArt';
import { ConstructionList, useUserClub } from './common';

export default function InfraHub() {
  const { w, c } = useUserClub();
  const nav = useNavigate();
  const f = ensureFacilities(w, c);
  const up = facilitiesUpkeep(w, c);
  const maint = c.finances.budget.maintenance;
  const projects = w.projects[c.id] ?? [];
  const owned = OWNED_KEYS.filter((k) => ownerEffect(w, c, k).owner).length;
  const tiles: { to: string; art: InfraArtKind; title: string; kpis: [string, string][]; accent: string }[] = [
    { to: '/infrastructure/arena', art: 'arena', title: 'Arena', accent: '#ff8a1f', kpis: [['Capacity', capacity(c).toLocaleString('en')], ['Occupancy', `${Math.round(avgOccupancy(w, c) * 100)}%`], ['Suites', `${c.arena.suites}`], ['Condition', `${Math.round(c.arena.condition)}`]] },
    { to: '/infrastructure/sports', art: 'sports', title: 'Sports facilities', accent: '#36d1ff', kpis: [['Training', `Lvl ${c.arena.levels.training}`], ['Academy', `Lvl ${c.arena.levels.academy}`], ['Medical', `Lvl ${c.arena.levels.medical}`], ['Owned', `${owned}/${OWNED_KEYS.length}`]] },
    { to: '/infrastructure/commercial/merchandise', art: 'commercial', title: 'Commercial', accent: '#34d399', kpis: [['Stores', `${f.stores.length}`], ['Merch (season)', fmtMoney(seasonTotal(c, w.season, 'merch'))], ['Food & drink', fmtMoney(seasonTotal(c, w.season, 'concessions'))], ['Last week', fmtMoney(f.stores.reduce((a, s) => a + s.lastWeekSales, 0))]] },
    { to: '/infrastructure/club-facilities', art: 'offices', title: 'Club facilities', accent: '#ffd23f', kpis: [['Staff desks', `${staffUsed(w, c)}/${staffCapacity(w, c)}`], ['Offices', `Lvl ${f.offices.corporate}`], ['PR office', `Lvl ${f.offices.pr}`], ['Press', `${Math.round(c.board.trust.media)}`]] },
  ];
  return (
    <Page kicker="Infrastructure" title="Club infrastructure" subtitle="Everything the club owns or runs: the arena, where the team works, what the club sells, and the offices behind it all.">
      <div className="grid g4 mb8" style={{ marginBottom: 16 }}>
        <Stat label="Arena condition" value={`${Math.round(c.arena.condition)}/100`} tone={c.arena.condition < 50 ? 'bad' : undefined} sub={maint < maintenanceNeed(w, c) ? '▼ Maintenance underfunded' : 'Maintenance funded'} />
        <Stat label="Works under way" value={projects.length} sub={projects.length ? projects.map((p) => p.label.split(' →')[0]).slice(0, 2).join(' · ') : 'Nothing being built'} />
        <Stat label="Annual upkeep" value={fmtMoney(maint + up.stores + up.offices)} sub={`maintenance ${fmtMoney(maint)} · stores ${fmtMoney(up.stores)} · offices ${fmtMoney(up.offices)}`} />
        <Stat label="Press effect" value={`×${prFactor(w, c).toFixed(2)}`} sub="PR office & PR lead" />
      </div>
      <div className="infra-tiles">
        {tiles.map((t, i) => (
          <motion.button key={t.to} type="button" className="infra-tile" onClick={() => nav(t.to)} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.05 + i * 0.07, type: 'spring', stiffness: 260, damping: 22 }} whileTap={{ scale: 0.97 }} style={{ textAlign: 'left', font: 'inherit' }}>
            <span className="it-art"><InfraArt kind={t.art} size={110} accent={t.accent} /></span>
            <span className="it-title">{t.title}</span>
            <span className="it-kpis">{t.kpis.map(([k, v]) => <span key={k}>{k}<b>{v}</b></span>)}</span>
            <span className="it-go">Enter ›</span>
          </motion.button>
        ))}
      </div>
      <div className="grid g2 mt16">
        <Card title="Works under way"><ConstructionList /></Card>
        <Card title="Facility health">
          <div className="col">
            <Meter value={c.arena.condition} label="Arena condition" />
            {OWNED_KEYS.map((k) => <Meter key={k} value={(ownerEffect(w, c, k).effectiveness / 1.15) * 100} label={`${k === 'lockerRoom' ? 'Locker room' : k[0].toUpperCase() + k.slice(1)} usage`} />)}
            <Meter value={(staffUsed(w, c) / Math.max(1, staffCapacity(w, c))) * 100} label="Office occupancy" />
          </div>
        </Card>
      </div>
    </Page>
  );
}
