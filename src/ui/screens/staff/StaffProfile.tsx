import { Link, useParams } from 'react-router-dom';
import { useWorld } from '../../store';
import { Badge, Card, Empty, Page, Stat } from '../../components/ui';
import { StaffFace } from '../../art/faces';
import { STAFF_LABEL, OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { coachForm, recordLine, candidateScore } from '../../../engine/coaching';
import { userClub } from '../../../engine/world';

export default function StaffProfile() {
  const w = useWorld();
  const { id } = useParams();
  const s = w.staff.find((x) => x.id === Number(id));
  if (!s) return <Page title="Not found"><Empty>This person is not in the database.</Empty></Page>;
  const club = s.teamId != null ? w.clubs.find((c) => c.id === s.teamId) : null;
  const uc = userClub(w);
  const rec = s.record ?? [];
  const where = s.nba ? `${s.nba.team} (NBA ${s.nba.role === 'head' ? 'head coach' : 'assistant'})` : club ? club.name : 'Available';
  return (
    <Page kicker={STAFF_LABEL[s.role]} title={`${s.firstName} ${s.lastName}`} subtitle={`${where} · age ${w.season - s.born} · ${s.nationality}`}>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
        <StaffFace staff={s} size={120} />
        <div className="grid g4" style={{ flex: 1, minWidth: 280 }}>
          <Stat label="Rating" value={s.rating} />
          <Stat label="Reputation" value={s.reputation} sub={s.reputation >= 84 ? 'NBA radar' : s.reputation >= 65 ? 'Élite-level name' : undefined} />
          <Stat label="Recent form" value={rec.length ? (coachForm(s) > 0 ? '+' : '') + coachForm(s).toFixed(1) : '—'} sub="results vs expectations" />
          <Stat label="Fit for your club" value={uc ? Math.round(candidateScore(w, s, uc)) : '—'} sub="candidate score" />
        </div>
      </div>
      <div className="grid g2">
        <Card title="Coaching record">
          <div className="small muted mb8">{recordLine(s)} {s.offPref && s.defPref ? `Prefers ${OFF_LABEL[s.offPref]} and ${DEF_LABEL[s.defPref]}.` : ''}</div>
          {rec.length === 0 ? <Empty>No seasons as a head coach yet.</Empty> : (
            <table className="tbl">
              <thead><tr><th>Season</th><th>Club</th><th>League</th><th className="r">W-L</th><th className="r">Exp.</th><th className="r">Rank</th><th className="r">Score</th><th>Honours</th></tr></thead>
              <tbody>
                {[...rec].reverse().map((r) => (
                  <tr key={r.season + r.clubName}>
                    <td>{r.season}</td>
                    <td>{r.clubId != null ? <Link className="link" to={`/clubs/${r.clubId}`}>{r.clubName}</Link> : r.clubName}</td>
                    <td className="small">{r.league}</td>
                    <td className="r">{r.league === 'NBA' ? '—' : `${r.wins}-${r.losses}`}</td>
                    <td className="r">{r.league === 'NBA' ? '—' : `${Math.round(r.expected * 100)}%`}</td>
                    <td className="r">{r.rank || '—'}</td>
                    <td className={`r ${r.score >= 0 ? 'good' : 'bad'}`}>{r.score > 0 ? '+' : ''}{r.score}</td>
                    <td className="small">{r.honours.map((h) => <Badge key={h} tone="good">{h}</Badge>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Career history">
          <div className="list">
            {[...s.history].reverse().map((h, i) => (
              <div key={i} className="list-item row">
                <b>{h.season}{h.to ? `–${h.to}` : ''}</b>
                <span>{h.teamId > 0 ? <Link className="link" to={`/clubs/${h.teamId}`}>{h.clubName ?? w.clubs.find((c) => c.id === h.teamId)?.name ?? 'Club'}</Link> : h.clubName}</span>
                <span className="muted small">{STAFF_LABEL[h.role]}</span>
                <span className="spacer" />
                <span className="small faint">{h.exit ?? (h.to ? '' : 'current')}</span>
              </div>
            ))}
            {s.history.length === 0 && <Empty>No club history yet.</Empty>}
          </div>
        </Card>
      </div>
    </Page>
  );
}
