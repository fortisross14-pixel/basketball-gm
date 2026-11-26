import { useState } from 'react';
import type { LeagueId, Standing, World } from '../../../engine/types';
import { sortStandings } from '../../../engine/competitions';
import { club as getClub, comp as getComp, isUser } from '../../../engine/world';
import { Badge, Card, ClubLink, Crest, Empty, Page, Table, Tabs } from '../../components/ui';
import { useWorld } from '../../store';
import { SeasonSelect } from './common';

type Tab = LeagueId | 'EURO';

export default function Standings() {
  const w = useWorld();
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  const [tab, setTab] = useState<Tab>(uc?.leagueId ?? 'ELITE');
  const [season, setSeason] = useState(w.season);
  return (
    <Page title="Standings" actions={<SeasonSelect w={w} value={season} onChange={setSeason} />}>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'ELITE', label: w.rules.leagues.ELITE.name },
          { id: 'ORO', label: w.rules.leagues.ORO.name },
          { id: 'PLATA', label: w.rules.leagues.PLATA.name },
          { id: 'COLLEGE', label: `${w.rules.leagues.COLLEGE.name} (USA)` },
          { id: 'EURO', label: 'Continental Cup' },
        ]}
      />
      {tab === 'EURO' ? <EuroGroups season={season} /> : <LeagueTable leagueId={tab} season={season} />}
    </Page>
  );
}

function zoneOf(w: World, lid: LeagueId, rank: number, n: number): { label: string; tone: 'good' | 'info' | 'bad' | 'accent' } | null {
  const r = w.rules.leagues[lid];
  if (lid === 'COLLEGE') {
    if (rank <= r.playoffTeams) return { label: 'NCL Tournament', tone: 'good' };
    return null;
  }
  if (lid === 'ELITE') {
    if (rank <= w.rules.euro.fromElite && rank <= r.playoffTeams) return { label: 'Playoffs · Europe', tone: 'accent' };
    if (rank <= r.playoffTeams) return { label: 'Playoffs', tone: 'good' };
  } else {
    if (rank <= r.directPromotion) return { label: 'Promotion', tone: 'accent' };
    if (r.playoffPromotion && rank <= r.directPromotion + r.playoffTeams) return { label: 'Promo playoff', tone: 'good' };
  }
  if (r.relegation && rank > n - r.relegation) return { label: 'Relegation', tone: 'bad' };
  return null;
}

function standingColumns(w: World, zone?: (rank: number) => ReturnType<typeof zoneOf>) {
  return [
    { key: 'rank', label: '#', render: (_s: Standing, i: number) => i + 1 },
    { key: 'club', label: 'Club', render: (s: Standing) => { const c = getClub(w, s.clubId); return <span className="row"><Crest club={c} /><ClubLink club={c} /></span>; } },
    { key: 'wl', label: 'W–L', render: (s: Standing) => <b>{s.w}–{s.l}</b>, align: 'c' as const },
    { key: 'pct', label: 'Win%', render: (s: Standing) => (s.w + s.l ? (s.w / (s.w + s.l)).toFixed(3).replace(/^0/, '') : '–'), align: 'r' as const },
    { key: 'pf', label: 'PF', render: (s: Standing) => s.pf, align: 'r' as const },
    { key: 'pa', label: 'PA', render: (s: Standing) => s.pa, align: 'r' as const },
    { key: 'diff', label: '+/−', render: (s: Standing) => <span className={s.pf - s.pa >= 0 ? 'good' : 'bad'}>{s.pf - s.pa > 0 ? '+' : ''}{s.pf - s.pa}</span>, align: 'r' as const },
    { key: 'home', label: 'Home', render: (s: Standing) => `${s.home[0]}–${s.home[1]}`, align: 'c' as const },
    { key: 'away', label: 'Away', render: (s: Standing) => `${s.away[0]}–${s.away[1]}`, align: 'c' as const },
    { key: 'streak', label: 'Streak', render: (s: Standing) => (s.streak ? <span className={s.streak > 0 ? 'good' : 'bad'}>{s.streak > 0 ? `W${s.streak}` : `L${-s.streak}`}</span> : '–'), align: 'c' as const },
    { key: 'l10', label: 'Last 10', render: (s: Standing) => <span className="mono small">{s.last10.map((x, i) => <span key={i} className={x === 'W' ? 'good' : 'bad'}>{x}</span>)}</span> },
    ...(zone ? [{ key: 'zone', label: '', render: (_s: Standing, i: number) => { const z = zone(i + 1); return z ? <Badge tone={z.tone}>{z.label}</Badge> : null; } }] : []),
  ];
}

function LeagueTable({ leagueId, season }: { leagueId: LeagueId; season: number }) {
  const w = useWorld();
  const cmp = getComp(w, `${leagueId}-${season}`);
  if (!cmp) return <Empty>No standings for this season.</Empty>;
  const rows = sortStandings(cmp.standings);
  const r = w.rules.leagues[leagueId];
  return (
    <Card title={cmp.name} className="flush">
      <div style={{ padding: '0 8px 8px' }}>
        <Table rows={rows} rowKey={(s) => s.clubId} rowClass={(s) => (isUser(w, s.clubId) ? 'me' : '')} columns={standingColumns(w, (rank) => zoneOf(w, leagueId, rank, rows.length))} />
      </div>
      <div className="small faint" style={{ padding: '0 16px 12px' }}>
        {leagueId === 'ELITE'
          ? `Top ${r.playoffTeams} reach the title playoffs; top ${w.rules.euro.fromElite} qualify for next season's Continental Cup; top ${w.rules.cup.teams} at the halfway point play the Copa; bottom ${r.relegation} are relegated.`
          : `${r.directPromotion} promoted directly, places ${r.directPromotion + 1}–${r.directPromotion + r.playoffTeams} play off for ${r.playoffPromotion} more promotion place${r.playoffPromotion > 1 ? 's' : ''}${r.relegation ? `, bottom ${r.relegation} relegated` : ''}. Promotion requires meeting the licence (Results → Rules).`}
      </div>
    </Card>
  );
}

function EuroGroups({ season }: { season: number }) {
  const w = useWorld();
  const e = getComp(w, `EURO-${season}`);
  if (!e?.groups) return <Empty>No continental competition this season.</Empty>;
  return (
    <div className="grid g2">
      {Object.entries(e.groups).map(([g, ids]) => {
        const rows = sortStandings(e.standings.filter((s) => ids.includes(s.clubId)));
        return (
          <Card key={g} title={`Group ${g}`}>
            <Table rows={rows} rowKey={(s) => s.clubId} rowClass={(s) => (isUser(w, s.clubId) ? 'me' : '')} columns={standingColumns(w, (rank) => (rank <= 4 ? { label: 'Quarterfinal', tone: 'good' } : null)).filter((c) => !['home', 'away', 'l10'].includes(c.key))} />
          </Card>
        );
      })}
    </div>
  );
}
