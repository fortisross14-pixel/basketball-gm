import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { BoxLine, Club, GameLog, TeamBox } from '../../engine/types';
import { club as getClub, fixture as getFixture } from '../../engine/world';
import { fmtAbs } from '../../engine/calendar';
import { useWorld } from '../store';
import { Badge, Card, Crest, Page, Table, Money, Empty } from '../components/ui';
import { PlayerFace } from '../art/faces';
import { ArenaBackdrop } from '../art/ArenaBackdrop';
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
      <PostgameHero g={g} home={home} away={away} />
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
      {g.flow && g.flow.length > 0 && (
        <Card title="Game flow · lead by minute" className="mt16">
          <FlowChart flow={g.flow} home={home} away={away} />
        </Card>
      )}
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
  const w = useWorld();
  const rows = box.players.filter((p) => p.gp || p.min > 0);
  return (
    <Card title={title} className="flush">
      <div style={{ padding: '0 8px 8px' }}>
        <Table<BoxLine>
          rows={rows}
          rowKey={(p) => p.playerId}
          columns={[
            { key: 'name', label: 'Player', render: (p) => { const pl = w.players.find((x) => x.id === p.playerId); return <span className="plink-face">{pl && <PlayerFace player={pl} size={24} round />}{p.starter ? <b>{p.name}</b> : p.name} <span className="faint small">{p.pos}</span></span>; } },
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

function FlowChart({ flow, home, away }: { flow: { m: number; h: number; a: number }[]; home: Club; away: Club }) {
  const W = 760, H = 180, padL = 34, padR = 10, padT = 10, padB = 22;
  const total = Math.max(40, flow[flow.length - 1].m);
  const pts = [{ m: 0, d: 0 }, ...flow.map((t) => ({ m: t.m, d: t.h - t.a }))];
  const scale = Math.ceil(Math.max(8, ...pts.map((p) => Math.abs(p.d))) / 5) * 5;
  const x = (m: number) => padL + (m / total) * (W - padL - padR);
  const y = (d: number) => padT + ((scale - d) / (2 * scale)) * (H - padT - padB);
  const line = pts.map((p) => `${x(p.m)},${y(p.d)}`).join(' ');
  const area = `${x(0)},${y(0)} ${line} ${x(pts[pts.length - 1].m)},${y(0)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Lead by minute">
      <defs>
        <clipPath id="gv-top"><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
        <clipPath id="gv-bot"><rect x="0" y={y(0)} width={W} height={H} /></clipPath>
      </defs>
      {[scale, -scale].map((t) => <text key={t} x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#9fb1d8">+{Math.abs(t)}</text>)}
      <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#e8f0ff" strokeOpacity=".3" />
      {[10, 20, 30, 40].filter((m) => m < total).map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={padT} y2={H - padB} stroke="#e8f0ff" strokeOpacity=".15" strokeDasharray="3 5" />)}
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => <text key={q} x={x(i * 10 + 5)} y={H - 6} textAnchor="middle" fontSize="11" fill="#9fb1d8">{q}</text>)}
      <polygon points={area} fill={home.colors[0]} fillOpacity=".45" clipPath="url(#gv-top)" />
      <polygon points={area} fill={away.colors[0]} fillOpacity=".45" clipPath="url(#gv-bot)" />
      <polyline points={line} fill="none" stroke="#fff" strokeWidth="2" className="spark-line" pathLength={1} />
      <text x={padL + 4} y={padT + 12} fontSize="11" fill="#fff">{home.abbrev} ahead</text>
      <text x={padL + 4} y={H - padB - 6} fontSize="11" fill="#fff">{away.abbrev} ahead</text>
    </svg>
  );
}

function PostgameHero({ g, home, away }: { g: GameLog; home: Club; away: Club }) {
  const w = useWorld();
  const mvp = w.players.find((p) => p.id === g.mvpId);
  const line = [...g.home.players, ...g.away.players].find((b) => b.playerId === g.mvpId);
  return (
    <div className="pg-hero">
      <ArenaBackdrop club={home} view="interior" className="pg-bd" />
      <div className="pg-score"><Crest club={home} size={44} /> <b>{g.home.score}</b> <span className="muted">–</span> <b>{g.away.score}</b> <Crest club={away} size={44} /></div>
      {mvp && line && (
        <Link to={`/player/${mvp.id}`} className="pg-mvp">
          <PlayerFace player={mvp} size={64} />
          <div><div className="small" style={{ color: 'var(--gold)', fontWeight: 700, letterSpacing: '.1em' }}>PLAYER OF THE GAME</div><b>{mvp.firstName} {mvp.lastName}</b><div className="small muted">{line.pts} pts · {line.orb + line.drb} reb · {line.ast} ast</div></div>
        </Link>
      )}
    </div>
  );
}
