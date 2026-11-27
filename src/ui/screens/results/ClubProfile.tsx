import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { club as getClub, idx, roster, staffOf, age, isUser, fmtMoney } from '../../../engine/world';
import { estimateRevenue } from '../../../engine/economy';
import { capacity } from '../../../engine/arena';
import { sortStandings, rankIn } from '../../../engine/competitions';
import { seasonLabel } from '../../../engine/calendar';
import { STAFF_LABEL, OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { payroll } from '../../../engine/finance';
import { Badge, Button, Card, ClubLink, Crest, Empty, Money, Page, PlayerLink, Stat, Table } from '../../components/ui';
import { useWorld } from '../../store';
import { ClubEditorModal } from '../../components/clubEditor';
import { TrophyArt } from '../../art/TrophyArt';
import { InjuryBadge, OvrCell, PotCell, seasonLine, perGame } from '../../helpers';

export default function ClubProfile() {
  const w = useWorld();
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const c = idx(w).clubs.get(Number(id));
  if (!c) return <Empty>Club not found.</Empty>;
  const mine = isUser(w, c.id);
  const squad = roster(w, c.id).sort((a, b) => b.ovr - a.ovr);
  const coach = staffOf(w, c, 'headCoach');
  const lc = c.leagueId ? w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`) : null;
  const st = lc?.standings.find((s) => s.clubId === c.id);
  const rank = lc ? rankIn(w, c.id) : 0;
  const rev = estimateRevenue(w, c);
  const f = c.fans;
  void sortStandings;
  return (
    <Page
      title={<span className="row"><Crest club={c} size="lg" /> <span>{c.name}{mine && <> <Badge tone="accent">Your club</Badge></>}</span></span>}
      subtitle={`“${c.nickname}” · ${c.city}, ${c.region} · ${c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental club'} · founded ${c.founded}`}
      actions={<Button size="sm" onClick={() => setEditing(true)} title="Edit name, colours and logo (club editor)">✎ Edit club</Button>}
    >
      {editing && <ClubEditorModal club={c} onClose={() => setEditing(false)} />}
      <div className="grid g6">
        <Stat label="Season record" value={st ? `${st.w}–${st.l}` : '—'} sub={rank ? `${rank}${ord(rank)} in league` : undefined} />
        <Stat label="Prestige" value={c.prestige} />
        <Stat label="Arena" value={capacity(c).toLocaleString('en')} sub={c.arena.name} />
        <Stat label="Local fans" value={Math.round(f.local).toLocaleString('en')} sub={`sentiment ${Math.round(f.sentiment)}`} />
        <Stat label={mine ? 'Cash' : 'Est. revenue'} value={mine ? fmtMoney(c.finances.cash) : `~${fmtMoney(Math.round(rev.total / 100000) * 100000)}`} sub={mine ? `payroll ${fmtMoney(payroll(w, c))}` : 'public estimate'} />
        <Stat label="Head coach" value={coach ? coach.lastName : 'Vacant'} sub={coach ? `rating ${coach.rating}${coach.offPref ? ` · ${OFF_LABEL[coach.offPref]}` : ''}` : undefined} />
      </div>

      <div className="grid g3 mt16">
        <Card title="Identity" className="span2">
          <div className="kv small">
            <span>Owner</span><span>{c.board.owner}</span>
            <span>Population</span><span>{c.population.toLocaleString('en')} · economy index {c.economy.toFixed(2)}</span>
            <span>Arena</span><span>{c.arena.name} · {c.arena.owned ? 'owned' : 'municipal'} · condition {Math.round(c.arena.condition)}</span>
            <span>Fanbase</span><span>Local {Math.round(f.local).toLocaleString('en')} · regional {Math.round(f.regional).toLocaleString('en')} · national {Math.round(f.national).toLocaleString('en')} · international {Math.round(f.international).toLocaleString('en')} · digital {Math.round(f.digital).toLocaleString('en')}</span>
            <span>Tactics</span><span>{OFF_LABEL[c.tactics.off]} / {DEF_LABEL[c.tactics.def]} · {c.tactics.pace} pace</span>
            <span>Strategy</span><span>{mine ? '—' : c.ai.strategy}</span>
            <span>Rivals</span><span>{c.rivals.length ? c.rivals.map((r, i) => <span key={r}>{i > 0 && ', '}<ClubLink club={getClub(w, r)} /></span>) : '—'}</span>
            <span>Staff</span><span>{(['assistantOff', 'assistantDef', 'medicalLead', 'scoutDirector'] as const).map((r) => { const s = staffOf(w, c, r); return s ? `${STAFF_LABEL[r]}: ${s.lastName} (${s.rating})` : null; }).filter(Boolean).join(' · ') || '—'}</span>
          </div>
        </Card>
        <Card title="Trophy cabinet">
          {c.trophies.length ? (
            <div className="col small">{[...c.trophies].reverse().map((t, i) => <div key={i}><TrophyArt name={t.name} /> {t.name} <span className="muted">{seasonLabel(t.season)}</span></div>)}</div>
          ) : <div className="muted small">No trophies yet.</div>}
          {c.retiredNumbers.length > 0 && <div className="small mt8">Retired numbers: {c.retiredNumbers.map((r) => `#${r.jersey} ${r.name}`).join(', ')}</div>}
        </Card>
      </div>

      <Card title="Roster" className="mt16">
        <Table
          rows={squad}
          rowKey={(p) => p.id}
          columns={[
            { key: 'no', label: '#', render: (p) => p.jersey },
            { key: 'name', label: 'Player', render: (p) => <><PlayerLink player={p} /> <InjuryBadge p={p} /></> },
            { key: 'pos', label: 'Pos', render: (p) => p.pos },
            { key: 'age', label: 'Age', render: (p) => age(w, p), sort: (p) => age(w, p), align: 'r' },
            { key: 'nat', label: 'Nat.', render: (p) => <span className="small">{p.nationality}{p.homegrown ? ' · HG' : ''}</span> },
            { key: 'ovr', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
            { key: 'pot', label: 'POT', render: (p) => <PotCell p={p} />, align: 'c' },
            { key: 'pts', label: 'PPG', render: (p) => perGame(seasonLine(p, w.season, undefined, c.id), 'pts'), align: 'r' },
            { key: 'sal', label: 'Salary', render: (p) => (mine ? <Money v={p.contract?.salary ?? 0} /> : <span className="faint">—</span>), align: 'r' },
            { key: 'exp', label: 'Contract', render: (p) => (p.contract ? seasonLabel(p.contract.expires) : '—'), align: 'r' },
          ]}
        />
      </Card>

      <Card title="History" className="mt16">
        <Table
          rows={[...c.history].reverse()}
          rowKey={(h) => h.season}
          empty="No completed seasons yet."
          columns={[
            { key: 's', label: 'Season', render: (h) => seasonLabel(h.season) },
            { key: 'lg', label: 'League', render: (h) => (h.leagueId ? w.rules.leagues[h.leagueId].short : 'Continental') },
            { key: 'rank', label: 'Pos', render: (h) => h.rank || '—', align: 'r' },
            { key: 'wl', label: 'W–L', render: (h) => `${h.wins}–${h.losses}`, align: 'c' },
            { key: 'po', label: 'Playoffs', render: (h) => h.playoff },
            { key: 'cup', label: 'Copa del Rey', render: (h) => h.cup },
            { key: 'euro', label: 'Continental', render: (h) => h.euro },
            { key: 'mv', label: '', render: (h) => (h.promoted ? <Badge tone="good">Promoted</Badge> : h.relegated ? <Badge tone="bad">Relegated</Badge> : null) },
            { key: 'att', label: 'Attendance', render: (h) => h.attendance.toLocaleString('en'), align: 'r' },
            ...(mine ? [{ key: 'rev', label: 'Revenue', render: (h: (typeof c.history)[number]) => <Money v={h.revenue} />, align: 'r' as const }, { key: 'pr', label: 'Profit', render: (h: (typeof c.history)[number]) => <Money v={h.profit} tone />, align: 'r' as const }] : []),
            { key: 'coach', label: 'Coach', render: (h) => <span className="small">{h.coach}</span> },
            { key: 'top', label: 'Top player', render: (h) => <span className="small">{h.topPlayer}</span> },
          ]}
        />
      </Card>
    </Page>
  );
}

function ord(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
