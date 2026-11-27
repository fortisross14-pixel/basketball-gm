import { useState } from 'react';
import type { Competition, Series } from '../../../engine/types';
import { seasonLabel } from '../../../engine/calendar';
import { club as getClub, isUser, fixture as getFixture } from '../../../engine/world';
import { Badge, Card, ClubLink, Crest, Empty, Page, Table } from '../../components/ui';
import { useWorld } from '../../store';
import { SeasonSelect, shortCompName } from './common';

export default function Competitions() {
  const w = useWorld();
  const [season, setSeason] = useState(w.season);
  const comps = w.competitions.filter((c) => c.season === season && c.kind !== 'league');
  const order = { euro: 0, cup: 1, playoffs: 2, promo: 3, league: 4 };
  comps.sort((a, b) => order[a.kind] - order[b.kind]);
  const champions = w.competitions.filter((c) => c.complete && c.champion != null).sort((a, b) => b.season - a.season);
  const leagueWinners = w.competitions.filter((c) => c.kind === 'league' && c.season < w.season);
  return (
    <Page title="Competitions" actions={<SeasonSelect w={w} value={season} onChange={setSeason} />}>
      {!comps.length && <Empty>No knockout competitions yet for this season.</Empty>}
      <div className="col">
        {comps.map((c) => <CompCard key={c.id} c={c} />)}
      </div>
      <Card title="Roll of honour" className="mt16">
        <Table
          rows={champions}
          rowKey={(c) => c.id}
          empty="No titles decided yet."
          columns={[
            { key: 's', label: 'Season', render: (c) => seasonLabel(c.season), sort: (c) => c.season },
            { key: 'comp', label: 'Competition', render: (c) => shortCompName(c) },
            { key: 'ch', label: 'Winner', render: (c) => { const cl = getClub(w, c.champion!); return <span className="row"><Crest club={cl} /><ClubLink club={cl} /></span>; } },
            { key: 'ru', label: 'Runner-up', render: (c) => (c.runnerUp != null ? <ClubLink club={getClub(w, c.runnerUp)} /> : '—') },
          ]}
        />
        {leagueWinners.length > 0 && <div className="small faint mt8">Regular-season league winners are listed in each club's trophy cabinet and in Legacy.</div>}
      </Card>
    </Page>
  );
}

function CompCard({ c }: { c: Competition }) {
  const w = useWorld();
  const rounds = [...new Set(c.series.map((s) => s.roundIndex))].sort((a, b) => a - b);
  const mine = c.clubIds.some((id) => isUser(w, id));
  return (
    <Card
      title={<h2>{shortCompName(c)} {mine && <Badge tone="accent">You</Badge>}</h2>}
      actions={c.champion != null ? <Badge tone="good">🏆 {getClub(w, c.champion).name}</Badge> : <Badge tone="info">{c.stage}</Badge>}
    >
      {c.kind === 'euro' && c.groups && !c.series.length && <div className="small muted mb8">Group stage in progress — see Standings → EuroCup. Top 4 of each group reach the quarterfinals.</div>}
      {!rounds.length && c.kind !== 'euro' && <div className="small muted">Not started.</div>}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, rounds.length)}, minmax(0, 1fr))` }}>
        {rounds.map((ri) => {
          const list = c.series.filter((s) => s.roundIndex === ri);
          return (
            <div key={ri} className="col">
              <h3>{list[0]?.round}</h3>
              {list.map((s) => <SeriesBox key={s.id} s={s} />)}
            </div>
          );
        })}
      </div>
      <div className="small faint mt8">Participants: {c.clubIds.map((id) => getClub(w, id).abbrev).join(', ')}</div>
    </Card>
  );
}

function SeriesBox({ s }: { s: Series }) {
  const w = useWorld();
  const hi = getClub(w, s.highSeed);
  const lo = getClub(w, s.lowSeed);
  const games = s.fixtureIds.map((id) => getFixture(w, id)).filter((f) => f && f.played && f.result);
  const line = (cl: typeof hi, wins: number) => (
    <div className="row" style={{ fontWeight: s.winner === cl.id ? 700 : 400, opacity: s.winner != null && s.winner !== cl.id ? 0.55 : 1 }}>
      <Crest club={cl} />
      <span className={isUser(w, cl.id) ? 'warn' : ''}>{cl.name}</span>
      <span className="spacer" />
      {s.bestOf > 1 && <b className="num">{wins}</b>}
    </div>
  );
  return (
    <div className="stat">
      {line(hi, s.winsHigh)}
      {line(lo, s.winsLow)}
      <div className="small faint mt8">
        {s.bestOf > 1 ? `Best of ${s.bestOf}` : s.neutral ? 'Single game · neutral venue' : 'Single game'}
        {games.length > 0 && ' · ' + games.map((f) => `${getClub(w, f.homeId).abbrev} ${f.result!.home}–${f.result!.away} ${getClub(w, f.awayId).abbrev}`).join(', ')}
      </div>
    </div>
  );
}
