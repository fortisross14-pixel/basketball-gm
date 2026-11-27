import { useState } from 'react';
import type { LeagueId, Standing, World } from '../../../engine/types';
import { groupKeyOf, groupTables, sortStandings } from '../../../engine/competitions';
import { activeLeagues } from '../../../engine/rules';
import { club as getClub, comp as getComp, isUser } from '../../../engine/world';
import { Badge, Card, ClubLink, Crest, Empty, Page, Pills, Table, Tabs } from '../../components/ui';
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
          ...activeLeagues(w).map((id) => ({ id: id as Tab, label: w.rules.leagues[id].kind === 'pro' ? w.rules.leagues[id].name : `${w.rules.leagues[id].name} (USA)` })),
          { id: 'EURO', label: 'EuroCup' },
        ]}
      />
      {tab === 'EURO' ? <EuroGroups season={season} /> : <LeagueTable leagueId={tab} season={season} />}
    </Page>
  );
}

function zoneOf(w: World, lid: LeagueId, rank: number, n: number, groups = 1): { label: string; tone: 'good' | 'info' | 'bad' | 'accent' } | null {
  const r = w.rules.leagues[lid];
  if (lid === 'COLLEGE') {
    if (rank <= Math.ceil(r.playoffTeams / groups)) return { label: 'NCAA Tournament', tone: 'good' };
    return null;
  }
  if (lid === 'NBA') {
    if (rank <= 8) return { label: 'Playoffs', tone: 'good' };
    return null;
  }
  if (groups > 1) {
    const direct = r.directPromotion / groups;
    const po = Math.ceil(r.playoffTeams / groups);
    if (rank === 1) return direct >= 1 ? { label: 'Promotion', tone: 'accent' } : { label: 'Group winner: promotion race', tone: 'accent' };
    if (r.playoffPromotion && rank <= Math.ceil(direct) + po) return { label: 'Promo playoff', tone: 'good' };
    const rel = Math.ceil(r.relegation / groups);
    if (rel && rank > n - rel) return { label: 'Relegation', tone: 'bad' };
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
  const mine = w.user.clubId != null && cmp ? groupKeyOf(cmp, w.user.clubId) : null;
  const tables = cmp ? groupTables(cmp) : [];
  const [g, setG] = useState<string>(mine ?? tables[0]?.[0] ?? '');
  if (!cmp) return <Empty>No standings for this season.</Empty>;
  const r = w.rules.leagues[leagueId];
  const groups = tables.length;
  const shown = groups > 1 ? tables.filter(([k]) => k === g || (!tables.some(([x]) => x === g) && k === tables[0][0])) : tables;
  return (
    <Card title={cmp.name} className="flush" actions={groups > 1 ? <Pills<string> value={g} onChange={setG} options={tables.map(([k]) => ({ id: k, label: leagueId === 'NBA' || leagueId === 'COLLEGE' ? k : `Group ${k}` }))} /> : undefined}>
      {shown.map(([k, rows]) => (
        <div key={k} style={{ padding: '0 8px 8px' }}>
          <Table rows={rows} rowKey={(s) => s.clubId} rowClass={(s) => (isUser(w, s.clubId) ? 'me' : '')} columns={standingColumns(w, (rank) => zoneOf(w, leagueId, rank, rows.length, groups))} />
        </div>
      ))}
      <div className="small faint" style={{ padding: '0 16px 12px' }}>
        {leagueId === 'ELITE'
          ? `Top ${r.playoffTeams} reach the title playoffs; top ${w.rules.euro.fromElite} qualify for next season's EuroCup; top ${w.rules.cup.teams} at the halfway point play the Copa del Rey; bottom ${r.relegation} are relegated.`
          : leagueId === 'NBA' ? 'Top eight of each conference reach the playoffs (best of seven).'
          : leagueId === 'COLLEGE' ? `The best ${r.playoffTeams} programs, conference by conference, play the NCAA Tournament.`
          : leagueId === 'TERCERA' ? `${groups} groups. The ${r.directPromotion} best group winners are promoted to the ${w.rules.leagues.PLATA?.name ?? 'Segunda FEB'}. Promotion requires meeting the licence (Results → Rules).`
          : groups > 1 ? `${groups} groups. Group winners go up; the next ${r.playoffTeams} play off for ${r.playoffPromotion} more place${r.playoffPromotion > 1 ? 's' : ''}${r.relegation ? `; bottom ${Math.ceil(r.relegation / groups)} of each group go down` : ''}. Promotion requires meeting the licence (Results → Rules).`
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
