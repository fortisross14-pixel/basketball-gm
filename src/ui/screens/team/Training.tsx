import { useAct, useWorld } from '../../store';
import { Card, Callout, Meter, Page, Pills, PlayerLink, Table } from '../../components/ui';
import { OvrCell, PotCell, StaffPanel } from '../../helpers';
import { academy, age, club as getClub, roster } from '../../../engine/world';
import { developmentEnv } from '../../../engine/player';
import type { TrainingFocus, TrainingIntensity } from '../../../engine/types';

const FOCUS: { id: TrainingFocus; label: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced', desc: 'Even weekly gains across all skills.' },
  { id: 'offense', label: 'Offense', desc: 'Finishing, mid-range, passing and ball handling improve faster.' },
  { id: 'defense', label: 'Defense', desc: 'Perimeter and interior defence, steals and blocks improve faster.' },
  { id: 'shooting', label: 'Shooting', desc: 'Three-point, mid-range and free-throw work.' },
  { id: 'conditioning', label: 'Conditioning', desc: 'Endurance, speed and strength; players also recover freshness 10% faster.' },
  { id: 'development', label: 'Youth development', desc: 'Raises the development environment for players under 26 (season-end progression and weekly gains).' },
  { id: 'tactical', label: 'Tactical', desc: 'Basketball IQ and passing; team cohesion grows faster (better execution in games).' },
];
const INT: { id: TrainingIntensity; label: string; desc: string }[] = [
  { id: 'light', label: 'Light', desc: 'Freshness recovers 25% faster; development gains ×0.6. Good in congested weeks (continental games).' },
  { id: 'normal', label: 'Normal', desc: 'Standard load.' },
  { id: 'hard', label: 'Hard', desc: 'Development gains ×1.35, but freshness recovers 20% slower and training knocks become possible.' },
];

export default function Training() {
  const w = useWorld();
  const act = useAct();
  const c = getClub(w, w.user.clubId!);
  const young = [...roster(w, c.id), ...academy(w, c.id)].filter((p) => age(w, p) <= 25).sort((a, b) => (b.pot - b.ovr) - (a.pot - a.ovr));
  const avgFresh = roster(w, c.id).reduce((a, p) => a + p.freshness, 0) / Math.max(1, roster(w, c.id).length);
  return (
    <Page title="Training" subtitle="Weekly training shapes development, freshness and cohesion.">
      <div className="grid g2">
        <Card title="Training focus">
          <Pills<TrainingFocus> value={c.training.focus} onChange={(v) => act(() => { c.training.focus = v; })} options={FOCUS.map((f) => ({ id: f.id, label: f.label, title: f.desc }))} />
          <p className="small muted mt8">{FOCUS.find((f) => f.id === c.training.focus)?.desc}</p>
          <h3 className="mt16 mb8">Intensity</h3>
          <Pills<TrainingIntensity> value={c.training.intensity} onChange={(v) => act(() => { c.training.intensity = v; })} options={INT.map((f) => ({ id: f.id, label: f.label, title: f.desc }))} />
          <p className="small muted mt8">{INT.find((f) => f.id === c.training.intensity)?.desc}</p>
        </Card>
        <Card title="Team condition">
          <div className="col">
            <Meter value={c.cohesion} label="Team cohesion" />
            <div className="small faint">Cohesion grows each week the group stays together, faster with leaders and tactical training; every new signing lowers it. It improves execution on both ends.</div>
            <Meter value={avgFresh} label="Average freshness" />
            <div className="small faint">Players lose freshness with minutes; low freshness means lower energy in games and higher injury risk.</div>
            <div className="small">Practice facility level <b>{c.arena.levels.training}</b>/5 · locker room <b>{c.arena.levels.lockerRoom}</b>/5</div>
          </div>
        </Card>
      </div>
      <Card title="Development watch (25 and under)" className="mt16 flush">
        <Table
          rows={young}
          rowKey={(p) => p.id}
          initialSort="gap"
          columns={[
            { key: 'n', label: 'Player', render: (p) => <PlayerLink player={p} /> },
            { key: 'a', label: 'Age', render: (p) => age(w, p), sort: (p) => age(w, p), align: 'r' },
            { key: 'sq', label: 'Squad', render: (p) => (p.academy ? 'Academy' : 'First team') },
            { key: 'o', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
            { key: 'p', label: 'POT', render: (p) => <PotCell p={p} />, sort: (p) => p.pot, align: 'c' },
            { key: 'gap', label: 'Room to grow', render: (p) => Math.max(0, p.pot - p.ovr), sort: (p) => p.pot - p.ovr, align: 'r' },
            { key: 'we', label: 'Work ethic', render: (p) => p.personality.workEthic, sort: (p) => p.personality.workEthic, align: 'r' },
            { key: 'min', label: 'Season min', render: (p) => Math.round(p.seasonMinutes), sort: (p) => p.seasonMinutes, align: 'r', title: 'Minutes played feed season-end progression' },
            { key: 'env', label: 'Dev. environment', render: (p) => `×${developmentEnv(w, p).toFixed(2)}`, sort: (p) => developmentEnv(w, p), align: 'r', title: 'Coach, development coach, facilities and training focus' },
          ]}
        />
      </Card>
      <div className="mt16">
        {young.length > 0 && c.training.focus !== 'development' && <Callout>Tip: the "Youth development" focus and a strong development coach raise the environment multiplier for every player above.</Callout>}
      </div>
      <div className="mt16"><StaffPanel roles={['assistantDev']} title="Player development coach" /></div>
    </Page>
  );
}
