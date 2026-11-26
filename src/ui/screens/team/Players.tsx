import { Link } from 'react-router-dom';
import { useWorld } from '../../store';
import { Badge, Card, Page, PlayerLink, Table, Bar, Money, Pills } from '../../components/ui';
import { PlayerCard } from '../../art/PlayerCard';
import { useState } from 'react';
import { OvrCell, PotCell, seasonLine, perGame, MoraleBadge, InjuryBadge } from '../../helpers';
import { age, club as getClub, roster } from '../../../engine/world';
import { heightStr, ROLE_LABEL } from '../../../engine/player';
import type { Player } from '../../../engine/types';
import { payroll } from '../../../engine/finance';

export default function Players() {
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const squad = roster(w, c.id);
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const nonEU = squad.filter((p) => p.region === 'NONEU').length;
  const hg = squad.filter((p) => p.homegrown).length;
  const loanedOut = w.players.filter((p) => p.loan?.fromTeamId === c.id);
  const season = w.season;

  return (
    <Page
      title="Players"
      subtitle={`${squad.length} registered · payroll ${Math.round(payroll(w, c) / 1000)}k`}
      actions={<><Link className="btn" to="/team/tactics">Tactics</Link><Link className="btn" to="/club/contracts">Contracts</Link><Link className="btn" to="/team/market">Market</Link></>}
    >
      {rules && (
        <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
          <RegStat label="Roster" value={squad.length} limit={`${rules.rosterMin}–${rules.rosterMax}`} ok={squad.length >= rules.rosterMin && squad.length <= rules.rosterMax} hint="Registered first-team players. Academy players do not count until promoted." />
          <RegStat label="Non-EU players" value={nonEU} limit={`max ${rules.maxNonEU}`} ok={nonEU <= rules.maxNonEU} hint="Players from outside the EU. EU and Spanish players are unrestricted." />
          <RegStat label="Homegrown" value={hg} limit={`min ${rules.minHomegrown} in a full roster`} ok={squad.length - hg <= rules.rosterMax - rules.minHomegrown} hint={`Non-homegrown players may fill at most ${rules.rosterMax - rules.minHomegrown} roster places.`} />
          <RegStat label="Matchday squad" value={Math.min(rules.matchdaySquad, squad.filter((p) => !p.injury).length)} limit={`of ${rules.matchdaySquad}`} ok={squad.filter((p) => !p.injury).length >= 8} hint="Healthy players available for the next game." />
        </div>
      )}
      <div className="row mb8"><span className="spacer" /><Pills value={view} onChange={setView} options={[{ id: 'cards', label: 'Cards' }, { id: 'table', label: 'Table' }]} /></div>
      {view === 'cards' ? (
        <div className="row wrap" style={{ gap: 14, perspective: 900, marginBottom: 16 }}>
          {[...squad].sort((a, b) => b.ovr - a.ovr).map((p, i) => (
            <PlayerCard key={p.id} p={p} club={c} index={i} sub={`${w.season - p.born} yrs · ${p.contract ? `€${Math.round(p.contract.salary / 1000)}k` : ''}${p.homegrown ? ' · HG' : ''}`} />
          ))}
        </div>
      ) : null}
      <Card className="flush">
        <PlayerTable players={squad} season={season} teamId={c.id} />
      </Card>
      {loanedOut.length > 0 && (
        <Card title="Loaned out" className="mt16">
          <Table
            rows={loanedOut}
            rowKey={(p) => p.id}
            columns={[
              { key: 'n', label: 'Player', render: (p) => <PlayerLink player={p} /> },
              { key: 'c', label: 'At', render: (p) => (p.teamId != null ? getClub(w, p.teamId).name : '—') },
              { key: 'o', label: 'OVR', render: (p) => <OvrCell p={p} />, align: 'c' },
              { key: 'mpg', label: 'MPG', render: (p) => perGame(seasonLine(p, season), 'min'), align: 'r' },
              { key: 'until', label: 'Returns', render: (p) => `Summer ${(p.loan?.untilSeason ?? season) + 1}` },
            ]}
          />
        </Card>
      )}
    </Page>
  );
}

function RegStat({ label, value, limit, ok, hint }: { label: string; value: number; limit: string; ok: boolean; hint: string }) {
  return (
    <div className="stat" title={hint}>
      <div className="label">{label}</div>
      <div className={`value ${ok ? '' : 'bad'}`}>{value} <span className="small muted">{limit}</span></div>
      <div className="sub">{ok ? 'Compliant' : 'Rule breached — fix before registering more players'}</div>
    </div>
  );
}

export function PlayerTable({ players, season, teamId }: { players: Player[]; season: number; teamId: number }) {
  const w = useWorld();
  return (
    <Table
      rows={players}
      rowKey={(p) => p.id}
      initialSort="ovr"
      columns={[
        { key: 'j', label: '#', render: (p) => p.jersey, sort: (p) => p.jersey, align: 'r' },
        { key: 'name', label: 'Name', render: (p) => <span className="row gap4"><PlayerLink player={p} />{p.transferListed && <Badge tone="warn">Listed</Badge>}{p.untouchable && <Badge tone="info">Untouchable</Badge>}</span>, sort: (p) => p.lastName },
        { key: 'pos', label: 'Pos', render: (p) => p.pos, sort: (p) => ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(p.pos) },
        { key: 'age', label: 'Age', render: (p) => age(w, p), sort: (p) => age(w, p), align: 'r' },
        { key: 'h', label: 'Ht', render: (p) => heightStr(p.heightCm), sort: (p) => p.heightCm, align: 'r' },
        { key: 'ovr', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
        { key: 'pot', label: 'POT', render: (p) => <PotCell p={p} />, sort: (p) => p.pot, align: 'c' },
        { key: 'reg', label: 'Reg.', render: (p) => <span className="row gap4">{p.region === 'NONEU' ? <Badge tone="warn" title="Non-EU">Non-EU</Badge> : p.region === 'EU' ? <Badge title="EU">EU</Badge> : <Badge title="Spanish">ESP</Badge>}{p.homegrown && <Badge tone="good" title="Homegrown (counts towards the quota)">HG</Badge>}</span> },
        { key: 'role', label: 'Role', render: (p) => (p.contract ? ROLE_LABEL[p.contract.rolePromise] : '—'), sort: (p) => p.minutesExpectation },
        {
          key: 'mpg', label: 'MPG / exp', title: 'Minutes per game vs what he expects',
          render: (p) => {
            const l = seasonLine(p, season, undefined, teamId);
            const mpg = l.gp ? l.min / l.gp : 0;
            const short = l.gp > 0 && mpg < p.minutesExpectation - 5;
            return <span className={short ? 'warn' : ''}>{l.gp ? mpg.toFixed(1) : '–'} / {Math.round(p.minutesExpectation)}</span>;
          },
          sort: (p) => { const l = seasonLine(p, season, undefined, teamId); return l.gp ? l.min / l.gp : 0; }, align: 'r',
        },
        { key: 'gp', label: 'GP', render: (p) => seasonLine(p, season, undefined, teamId).gp, sort: (p) => seasonLine(p, season, undefined, teamId).gp, align: 'r' },
        { key: 'pts', label: 'PTS', render: (p) => perGame(seasonLine(p, season, undefined, teamId), 'pts'), sort: (p) => { const l = seasonLine(p, season, undefined, teamId); return l.gp ? l.pts / l.gp : 0; }, align: 'r' },
        { key: 'reb', label: 'REB', render: (p) => { const l = seasonLine(p, season, undefined, teamId); return l.gp ? ((l.orb + l.drb) / l.gp).toFixed(1) : '–'; }, sort: (p) => { const l = seasonLine(p, season, undefined, teamId); return l.gp ? (l.orb + l.drb) / l.gp : 0; }, align: 'r' },
        { key: 'ast', label: 'AST', render: (p) => perGame(seasonLine(p, season, undefined, teamId), 'ast'), sort: (p) => { const l = seasonLine(p, season, undefined, teamId); return l.gp ? l.ast / l.gp : 0; }, align: 'r' },
        { key: 'mor', label: 'Morale', render: (p) => <MoraleBadge p={p} />, sort: (p) => p.morale, align: 'c' },
        { key: 'fr', label: 'Fresh', render: (p) => <div style={{ width: 60 }} title={`${Math.round(p.freshness)}/100`}><Bar value={p.freshness} color={p.freshness < 70 ? 'var(--warn)' : 'var(--good)'} /></div>, sort: (p) => p.freshness },
        { key: 'inj', label: 'Health', render: (p) => <InjuryBadge p={p} />, sort: (p) => p.injury?.daysOut ?? 0 },
        { key: 'sal', label: 'Salary', render: (p) => (p.contract ? <Money v={p.contract.salary} /> : '—'), sort: (p) => p.contract?.salary ?? 0, align: 'r' },
        { key: 'exp', label: 'Until', render: (p) => (p.contract ? <span className={p.contract.expires === season ? 'warn' : ''}>{p.contract.expires + 1}</span> : '—'), sort: (p) => p.contract?.expires ?? 0, align: 'r' },
      ]}
    />
  );
}
