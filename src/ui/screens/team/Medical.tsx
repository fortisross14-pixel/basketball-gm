import { useAct, useWorld } from '../../store';
import { Badge, Bar, Card, Page, PlayerLink, Stat, Table } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { club as getClub, roster, staffRating } from '../../../engine/world';

export default function Medical() {
  const w = useWorld();
  const act = useAct();
  const c = getClub(w, w.user.clubId!);
  const squad = roster(w, c.id);
  const injured = squad.filter((p) => p.injury);
  const pol = w.user.delegation.medical;
  const risk = pol.riskTolerance ?? 30;
  return (
    <Page title="Medical & Support" subtitle="Injury prevention, rehab and load management.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Injured" value={injured.length} tone={injured.length >= 3 ? 'warn' : undefined} />
        <Stat label="Medical centre" value={`${c.arena.levels.medical}/5`} sub="Upgrade in Infrastructure → Stadium" />
        <Stat label="Medical lead" value={staffRating(w, c, 'medicalLead')} sub="Shorter recoveries, fewer injuries" />
        <Stat label="Physio" value={staffRating(w, c, 'physio')} sub="Faster freshness recovery" />
      </div>
      <div className="grid g2">
        <Card title="Injury report">
          <Table
            rows={injured}
            rowKey={(p) => p.id}
            empty="No injuries. 🎉"
            columns={[
              { key: 'n', label: 'Player', render: (p) => <PlayerLink player={p} /> },
              { key: 't', label: 'Injury', render: (p) => p.injury!.type },
              { key: 's', label: 'Severity', render: (p) => <Badge tone={p.injury!.severity === 'major' ? 'bad' : p.injury!.severity === 'moderate' ? 'warn' : undefined}>{p.injury!.severity}</Badge> },
              { key: 'd', label: 'Days out', render: (p) => p.injury!.daysOut, sort: (p) => p.injury!.daysOut, align: 'r' },
              { key: 'r', label: 'Return-to-play', render: (p) => (p.injury!.playThroughRisk ? <Badge tone="warn">Cleared early (reduced level)</Badge> : <span className="muted small">Full recovery</span>) },
            ]}
          />
        </Card>
        <Card title="Return-to-play policy">
          <p className="small muted">When a key player is a few days from recovery, the medical lead decides whether he can play early (if medical decisions are delegated) using your risk tolerance. Early returns play at about 92% and carry higher re-injury risk.</p>
          <div className="row mt8">
            <span className="small">Risk tolerance</span>
            <input type="range" min={0} max={60} step={5} value={risk} onChange={(e) => act(() => { w.user.delegation.medical.riskTolerance = Number(e.target.value); })} style={{ flex: 1 }} />
            <b>{risk}%</b>
          </div>
          <div className="small faint mt8">{risk <= 15 ? 'Conservative: players always complete their recovery.' : risk >= 40 ? 'Aggressive: stars are rushed back whenever possible.' : 'Balanced.'}</div>
        </Card>
      </div>
      <Card title="Squad freshness & load" className="mt16 flush">
        <Table
          rows={squad}
          rowKey={(p) => p.id}
          initialSort="f"
          initialDir="asc"
          columns={[
            { key: 'n', label: 'Player', render: (p) => <PlayerLink player={p} /> },
            { key: 'f', label: 'Freshness', render: (p) => <div className="row"><div style={{ width: 120 }}><Bar value={p.freshness} color={p.freshness < 70 ? 'var(--warn)' : 'var(--good)'} /></div><span className="small">{Math.round(p.freshness)}</span></div>, sort: (p) => p.freshness },
            { key: 'm', label: 'Season minutes', render: (p) => Math.round(p.seasonMinutes), sort: (p) => p.seasonMinutes, align: 'r' },
            { key: 'ip', label: 'Injury proneness', render: (p) => (p.injuryProne >= 60 ? <Badge tone="warn">High</Badge> : p.injuryProne >= 35 ? 'Medium' : 'Low'), sort: (p) => p.injuryProne },
            { key: 'e', label: 'Endurance', render: (p) => p.ratings.end, sort: (p) => p.ratings.end, align: 'r' },
          ]}
        />
      </Card>
      <div className="mt16"><StaffPanel roles={['medicalLead', 'physio']} title="Medical & performance staff" /></div>
    </Page>
  );
}
