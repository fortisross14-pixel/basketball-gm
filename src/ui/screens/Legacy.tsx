import { useState } from 'react';
import { Link } from 'react-router-dom';
import { club as getClub, idx } from '../../engine/world';
import { fmtAbs, seasonLabel } from '../../engine/calendar';
import { Badge, Card, ClubLink, Crest, Empty, Money, Page, Stat, Table, Tabs } from '../components/ui';
import { Banner } from '../art/Banner';
import { TrophyArt } from '../art/TrophyArt';
import { useWorld } from '../store';

type Tab = 'career' | 'club' | 'league' | 'awards' | 'records' | 'hof';

export default function Legacy() {
  const w = useWorld();
  const [tab, setTab] = useState<Tab>('career');
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  const allAch = w.user.career.flatMap((s) => s.achievements);
  return (
    <Page title="Legacy" subtitle={`${w.user.name} · executive reputation ${w.user.reputation}/100`}>
      <Banner which="legacy" className="page-banner" />
      <div className="grid g4 mb8">
        <Stat label="Reputation" value={`${w.user.reputation}/100`} />
        <Stat label="Clubs managed" value={new Set(w.user.career.map((s) => s.clubId)).size} />
        <Stat label="Achievements" value={allAch.length} />
        <Stat label="Hall of Fame" value={w.hallOfFame.length} sub="players inducted (world)" />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'career', label: 'My career' },
          { id: 'club', label: uc ? uc.name : 'Club history' },
          { id: 'league', label: 'Champions' },
          { id: 'awards', label: 'Awards' },
          { id: 'records', label: 'Records' },
          { id: 'hof', label: 'Hall of Fame' },
        ]}
      />
      {tab === 'career' && (
        <Card title="Career">
          {!w.user.career.length ? <Empty>No jobs yet.</Empty> : (
            <div className="col">
              {[...w.user.career].reverse().map((s, i) => {
                const c = idx(w).clubs.get(s.clubId);
                return (
                  <div key={i} className="list-item">
                    <div className="row">
                      {c && <Crest club={c} />}
                      <b>{s.clubName}</b>
                      <Badge>{s.role === 'owner' ? 'Owner-President' : 'General Manager'}</Badge>
                      <span className="muted small">{fmtAbs(s.from)} → {s.to != null ? fmtAbs(s.to) : 'present'}</span>
                      <span className="spacer" />
                      {s.exit && <Badge tone={s.exit === 'Dismissed' ? 'bad' : 'info'}>{s.exit}</Badge>}
                    </div>
                    {s.achievements.length > 0 ? (
                      <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.achievements.map((a, j) => <li key={j}>{a}</li>)}</ul>
                    ) : <div className="small faint mt8">No major achievements yet.</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
      {tab === 'club' && (uc ? <ClubLegacy clubId={uc.id} /> : <Empty>You are not at a club.</Empty>)}
      {tab === 'league' && <ChampionsHistory />}
      {tab === 'awards' && (
        <Card title="Season awards">
          <Table
            rows={[...w.awards].reverse()}
            rowKey={(a) => `${a.season}-${a.leagueId}-${a.award}-${a.name}`}
            empty="Awards are given at the end of each season."
            columns={[
              { key: 's', label: 'Season', render: (a) => seasonLabel(a.season), sort: (a) => a.season },
              { key: 'l', label: 'League', render: (a) => (a.leagueId === 'EURO' ? 'Continental' : a.leagueId === 'CUP' ? 'Copa' : w.rules.leagues[a.leagueId].short) },
              { key: 'a', label: 'Award', render: (a) => a.award },
              { key: 'n', label: 'Winner', render: (a) => (a.playerId != null && idx(w).players.get(a.playerId) ? <Link className="link" to={`/player/${a.playerId}`}>{a.name}</Link> : a.name) },
              { key: 'c', label: 'Club', render: (a) => (a.clubId != null ? <ClubLink club={getClub(w, a.clubId)} /> : '—') },
            ]}
          />
        </Card>
      )}
      {tab === 'records' && (
        <Card title="Single-game records">
          <Table
            rows={w.records}
            rowKey={(r) => r.key}
            empty="No records set yet."
            columns={[
              { key: 'l', label: 'Record', render: (r) => r.label },
              { key: 'v', label: 'Value', render: (r) => <b>{r.value}</b>, align: 'r' },
              { key: 'h', label: 'Holder', render: (r) => (r.playerId != null && idx(w).players.get(r.playerId) ? <Link className="link" to={`/player/${r.playerId}`}>{r.holder}</Link> : r.holder) },
              { key: 's', label: 'Season', render: (r) => seasonLabel(r.season) },
            ]}
          />
        </Card>
      )}
      {tab === 'hof' && (
        <Card title="Hall of Fame">
          <Table
            rows={[...w.hallOfFame].reverse()}
            rowKey={(h) => h.playerId}
            empty="Great careers are inducted when the player retires."
            columns={[
              { key: 'n', label: 'Player', render: (h) => (idx(w).players.get(h.playerId) ? <Link className="link" to={`/player/${h.playerId}`}>{h.name}</Link> : h.name) },
              { key: 's', label: 'Inducted', render: (h) => seasonLabel(h.season) },
              { key: 'sum', label: 'Career', render: (h) => <span className="small">{h.summary}</span> },
            ]}
          />
        </Card>
      )}
    </Page>
  );
}

function ClubLegacy({ clubId }: { clubId: number }) {
  const w = useWorld();
  const c = getClub(w, clubId);
  const best = c.history.reduce<typeof c.history[number] | null>((b, h) => (!b || h.tier < b.tier || (h.tier === b.tier && h.rank < b.rank) ? h : b), null);
  return (
    <div className="col">
      <div className="grid g3">
        <Card title="Trophy cabinet">
          {c.trophies.length ? <div className="col">{[...c.trophies].reverse().map((t, i) => <div key={i}><TrophyArt name={t.name} /> <b>{t.name}</b> <span className="muted small">{seasonLabel(t.season)}</span></div>)}</div> : <div className="muted small">The cabinet is still empty.</div>}
        </Card>
        <Card title="Milestones">
          <div className="kv small">
            <span>Founded</span><span>{c.founded}</span>
            <span>Seasons recorded</span><span>{c.history.length}</span>
            <span>Promotions</span><span>{c.history.filter((h) => h.promoted).length}</span>
            <span>Relegations</span><span>{c.history.filter((h) => h.relegated).length}</span>
            <span>Best finish</span><span>{best ? `${best.rank}${best.leagueId ? ` in ${w.rules.leagues[best.leagueId].short}` : ''} (${seasonLabel(best.season)})` : '—'}</span>
            <span>Arena opened</span><span>{c.arena.name} · {c.arena.opened}</span>
          </div>
        </Card>
        <Card title="Retired numbers">
          {c.retiredNumbers.length ? c.retiredNumbers.map((r) => <div key={r.jersey}>#{r.jersey} — {r.name}</div>) : <div className="muted small">None yet.</div>}
        </Card>
      </div>
      <Card title="Season by season">
        <Table
          rows={[...c.history].reverse()}
          rowKey={(h) => h.season}
          empty="Complete a season to start the club chronicle."
          columns={[
            { key: 's', label: 'Season', render: (h) => seasonLabel(h.season) },
            { key: 'lg', label: 'League', render: (h) => (h.leagueId ? w.rules.leagues[h.leagueId].short : '—') },
            { key: 'r', label: 'Pos', render: (h) => h.rank, align: 'r' },
            { key: 'wl', label: 'W–L', render: (h) => `${h.wins}–${h.losses}`, align: 'c' },
            { key: 'po', label: 'Playoffs', render: (h) => h.playoff },
            { key: 'cup', label: 'Copa', render: (h) => h.cup },
            { key: 'eu', label: 'Continental', render: (h) => h.euro },
            { key: 'mv', label: '', render: (h) => (h.promoted ? <Badge tone="good">Promoted</Badge> : h.relegated ? <Badge tone="bad">Relegated</Badge> : null) },
            { key: 'att', label: 'Avg att.', render: (h) => h.attendance.toLocaleString('en'), align: 'r' },
            { key: 'rev', label: 'Revenue', render: (h) => <Money v={h.revenue} />, align: 'r' },
            { key: 'p', label: 'Profit', render: (h) => <Money v={h.profit} tone />, align: 'r' },
            { key: 'top', label: 'Top player', render: (h) => <span className="small">{h.topPlayer}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function ChampionsHistory() {
  const w = useWorld();
  const seasons = [...new Set(w.competitions.map((c) => c.season))].sort((a, b) => b - a);
  const champ = (id: string) => {
    const c = w.competitions.find((x) => x.id === id);
    return c?.champion != null ? getClub(w, c.champion) : null;
  };
  const leagueWinner = (lid: string, season: number) => {
    const t = w.clubs.find((c) => c.history.some((h) => h.season === season && h.leagueId === lid && h.rank === 1));
    return t ?? null;
  };
  const cell = (c: ReturnType<typeof champ>) => (c ? <span className="row"><Crest club={c} /><ClubLink club={c} /></span> : <span className="faint">—</span>);
  return (
    <Card title="Champions by season">
      <Table
        rows={seasons}
        rowKey={(s) => s}
        columns={[
          { key: 's', label: 'Season', render: (s) => seasonLabel(s) },
          { key: 'elite', label: 'Élite champion (playoffs)', render: (s) => cell(champ(`ELITE-PO-${s}`)) },
          { key: 'cup', label: 'Copa', render: (s) => cell(champ(`CUP-${s}`)) },
          { key: 'euro', label: 'Continental Cup', render: (s) => cell(champ(`EURO-${s}`)) },
          { key: 'oro', label: 'Liga Oro winner', render: (s) => cell(leagueWinner('ORO', s)) },
          { key: 'plata', label: 'Liga Plata winner', render: (s) => cell(leagueWinner('PLATA', s)) },
        ]}
      />
    </Card>
  );
}
