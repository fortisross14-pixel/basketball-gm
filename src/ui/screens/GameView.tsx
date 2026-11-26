import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { BoxLine, GameLog, TeamBox } from '../../engine/types';
import { club as getClub, fixture as getFixture } from '../../engine/world';
import { fmtAbs } from '../../engine/calendar';
import { useWorld } from '../store';
import { Badge, Card, Crest, Page, Table, Money, Empty } from '../components/ui';
import { pctStr } from '../helpers';

export default function GameView() {
  const { id } = useParams();
  const w = useWorld();
  const g = w.games.find((x) => x.id === Number(id));
  if (!g) return <Card><Empty>Game not found (box scores are kept for two seasons).</Empty></Card>;
  const home = getClub(w, g.home.clubId);
  const away = getClub(w, g.away.clubId);
  const f = getFixture(w, g.fixtureId);
  const usHome = g.home.clubId === w.user.clubId;
  const won = usHome ? g.home.score > g.away.score : g.away.score > g.home.score;
  return (
    <Page title={`${home.name} ${g.home.score} – ${g.away.score} ${away.name}`} subtitle={`${f?.label ?? ''} · ${fmtAbs(g.day, true)}${g.ot ? ` · ${g.ot} overtime` : ''} · Attendance ${g.attendance.toLocaleString('en')}`}>
      <div className="grid g2">
        <Card title="Score by quarter">
          <QuarterTable g={g} />
          <div className="kv small mt8">
            <span>Lead changes</span><span>{g.leadChanges}</span>
            <span>Biggest lead</span><span>{home.abbrev} {g.home.biggestLead} · {away.abbrev} {g.away.biggestLead}</span>
            {usHome && <><span>Gate & matchday revenue</span><span><Money v={g.revenue} /></span></>}
          </div>
        </Card>
        <Card title={won ? 'Why we won' : 'Why we lost'}>
          <div className="list">
            {g.factors.map((x, i) => (
              <div key={i} className="list-item">
                <div className="row">
                  <b className={x.impact >= 0 ? 'good' : 'bad'}>{x.title}</b>
                  <span className="spacer" />
                  <Badge tone={x.impact >= 0 ? 'good' : 'bad'} title="Estimated points swing">{x.impact > 0 ? '+' : ''}{x.impact} pts</Badge>
                </div>
                <div className="small muted">{x.detail}</div>
                {x.suggestion && <div className="small mt8">💡 {x.suggestion} <Link className="link" to="/team/tactics">Tactics</Link></div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="Team comparison" className="mt16">
        <Comparison a={g.home} b={g.away} an={home.abbrev} bn={away.abbrev} />
      </Card>
      <div className="grid g2 mt16">
        <BoxCard box={g.home} title={<span className="row"><Crest club={home} /> {home.name}</span>} />
        <BoxCard box={g.away} title={<span className="row"><Crest club={away} /> {away.name}</span>} />
      </div>
    </Page>
  );
}

function QuarterTable({ g }: { g: GameLog }) {
  const w = useWorld();
  const n = Math.max(g.home.quarters.length, g.away.quarters.length);
  const label = (i: number) => (i < 4 ? `Q${i + 1}` : `OT${i - 3}`);
  return (
    <table className="tbl">
      <thead><tr><th>Team</th>{Array.from({ length: n }, (_, i) => <th key={i} className="r">{label(i)}</th>)}<th className="r">Total</th></tr></thead>
      <tbody>
        {[g.home, g.away].map((t) => (
          <tr key={t.clubId} className={t.clubId === w.user.clubId ? 'me' : ''}>
            <td>{getClub(w, t.clubId).abbrev}</td>
            {Array.from({ length: n }, (_, i) => <td key={i} className="r">{t.quarters[i] ?? 0}</td>)}
            <td className="r"><b>{t.score}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Comparison({ a, b, an, bn }: { a: TeamBox; b: TeamBox; an: string; bn: string }) {
  const rows: [string, string, string][] = [
    ['Field goals', `${a.totals.fgm}/${a.totals.fga} (${pctStr(a.totals.fgm, a.totals.fga)})`, `${b.totals.fgm}/${b.totals.fga} (${pctStr(b.totals.fgm, b.totals.fga)})`],
    ['Three pointers', `${a.totals.tpm}/${a.totals.tpa} (${pctStr(a.totals.tpm, a.totals.tpa)})`, `${b.totals.tpm}/${b.totals.tpa} (${pctStr(b.totals.tpm, b.totals.tpa)})`],
    ['Free throws', `${a.totals.ftm}/${a.totals.fta} (${pctStr(a.totals.ftm, a.totals.fta)})`, `${b.totals.ftm}/${b.totals.fta} (${pctStr(b.totals.ftm, b.totals.fta)})`],
    ['Rebounds (off)', `${a.totals.orb + a.totals.drb} (${a.totals.orb})`, `${b.totals.orb + b.totals.drb} (${b.totals.orb})`],
    ['Assists', `${a.totals.ast}`, `${b.totals.ast}`],
    ['Turnovers', `${a.totals.tov}`, `${b.totals.tov}`],
    ['Steals / blocks', `${a.totals.stl} / ${a.totals.blk}`, `${b.totals.stl} / ${b.totals.blk}`],
    ['Points in the paint', `${a.paint}`, `${b.paint}`],
    ['Second-chance points', `${a.secondChance}`, `${b.secondChance}`],
    ['Fast-break points', `${a.fastBreak}`, `${b.fastBreak}`],
    ['Points off turnovers', `${a.offTov}`, `${b.offTov}`],
    ['Bench points', `${a.bench}`, `${b.bench}`],
    ['Fouls', `${a.fouls}`, `${b.fouls}`],
  ];
  return (
    <table className="tbl">
      <thead><tr><th>{an}</th><th className="c">Stat</th><th className="r">{bn}</th></tr></thead>
      <tbody>{rows.map(([k, x, y]) => <tr key={k}><td>{x}</td><td className="c muted">{k}</td><td className="r">{y}</td></tr>)}</tbody>
    </table>
  );
}

function BoxCard({ box, title }: { box: TeamBox; title: ReactNode }) {
  const rows = box.players.filter((p) => p.gp || p.min > 0);
  return (
    <Card title={title} className="flush">
      <div style={{ padding: '0 8px 8px' }}>
        <Table<BoxLine>
          rows={rows}
          rowKey={(p) => p.playerId}
          columns={[
            { key: 'name', label: 'Player', render: (p) => <span>{p.starter ? <b>{p.name}</b> : p.name} <span className="faint small">{p.pos}</span></span> },
            { key: 'min', label: 'MIN', render: (p) => Math.round(p.min), sort: (p) => p.min, align: 'r' },
            { key: 'pts', label: 'PTS', render: (p) => <b>{p.pts}</b>, sort: (p) => p.pts, align: 'r' },
            { key: 'fg', label: 'FG', render: (p) => `${p.fgm}-${p.fga}`, align: 'r' },
            { key: '3p', label: '3P', render: (p) => `${p.tpm}-${p.tpa}`, align: 'r' },
            { key: 'ft', label: 'FT', render: (p) => `${p.ftm}-${p.fta}`, align: 'r' },
            { key: 'reb', label: 'REB', render: (p) => p.orb + p.drb, sort: (p) => p.orb + p.drb, align: 'r' },
            { key: 'ast', label: 'AST', render: (p) => p.ast, sort: (p) => p.ast, align: 'r' },
            { key: 'stl', label: 'STL', render: (p) => p.stl, align: 'r' },
            { key: 'blk', label: 'BLK', render: (p) => p.blk, align: 'r' },
            { key: 'tov', label: 'TO', render: (p) => p.tov, align: 'r' },
            { key: 'pf', label: 'PF', render: (p) => p.pf, align: 'r' },
            { key: 'pm', label: '+/-', render: (p) => <span className={p.pm > 0 ? 'good' : p.pm < 0 ? 'bad' : ''}>{p.pm > 0 ? '+' : ''}{p.pm}</span>, sort: (p) => p.pm, align: 'r' },
          ]}
        />
      </div>
    </Card>
  );
}
