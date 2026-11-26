import { Link, useNavigate } from 'react-router-dom';
import type { Decision } from '../../engine/types';
import { absDay } from '../../engine/types';
import { buildDigest } from '../../engine/digest';
import { resolveDecision } from '../../engine/events';
import { userClub, club as getClub, fmtMoney, roster } from '../../engine/world';
import { fmtAbs, fmtDate, seasonLabel, phaseOf, PHASE_LABEL } from '../../engine/calendar';
import { nextUserFixtureDay } from '../../engine/daily';
import { clubStrength } from '../../engine/matchday';
import { sortStandings } from '../../engine/competitions';
import { OFF_LABEL, DEF_LABEL } from '../../engine/staff';
import { useAct, useNotify, useWorld, useGame } from '../store';
import { Badge, Button, Card, Crest, Meter, Page, Stat, Empty } from '../components/ui';

export default function Today() {
  const w = useWorld();
  const c = userClub(w);
  const digest = buildDigest(w);
  const decisions = w.decisions.filter((d) => !d.resolved).sort((a, b) => b.urgency + b.impact - (a.urgency + a.impact));
  const advance = useGame((s) => s.advance);
  const name = w.user.name.split(' ')[0];
  return (
    <Page
      title={`Good morning, ${name}`}
      subtitle={`${fmtDate(w.season, w.day)} · Season ${seasonLabel(w.season)} · ${PHASE_LABEL[phaseOf(w.season, w.day)]}`}
      actions={!c && <Button variant="primary" onClick={() => advance('week')}>Advance a week (wait for offers)</Button>}
    >
      {w.gameOver && <div className="callout bad mb8"><b>Career over.</b> {w.gameOver.reason}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div className="col gap16">
          {decisions.length > 0 && (
            <Card title={`Decisions waiting (${decisions.length})`}>
              <div className="list">
                {decisions.map((d) => <DecisionRow key={d.id} d={d} />)}
              </div>
            </Card>
          )}
          <Card title="Executive digest">
            {digest.filter((x) => !x.decisionId).length === 0 ? <Empty>All quiet. Nothing needs your attention.</Empty> : (
              <div className="list">
                {digest.filter((x) => !x.decisionId).map((it) => (
                  <div key={it.id} className="list-item row" style={{ alignItems: 'flex-start' }}>
                    <span className={`badge ${it.tone === 'alert' ? 'bad' : it.tone === 'warn' ? 'warn' : it.tone === 'good' ? 'good' : 'info'}`} style={{ marginTop: 2 }}>{it.tone === 'alert' ? '!' : it.tone === 'warn' ? '▲' : it.tone === 'good' ? '✓' : 'i'}</span>
                    <div style={{ flex: 1 }}>
                      <b>{it.title}</b>
                      <div className="small muted">{it.detail}</div>
                      <div className="small faint">Owner: {it.owner}{it.deadline ? ` · deadline ${fmtAbs(it.deadline)}` : ''}</div>
                    </div>
                    <Link className="btn sm" to={it.link}>Open</Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <LatestNews />
        </div>
        <div className="col gap16">
          {c && <NextGame />}
          {c && <ClubSnapshot />}
          {c && <MiniTable />}
          {c && <LastResults />}
        </div>
      </div>
    </Page>
  );
}

function DecisionRow({ d }: { d: Decision }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const daysLeft = d.deadlineDay - absDay(w);
  return (
    <div className="list-item">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="row gap4">
            <b>{d.title}</b>
            {d.urgency >= 2 && <Badge tone="warn">urgent</Badge>}
            {d.impact >= 3 && <Badge tone="bad">high impact</Badge>}
          </div>
          <div className="small muted mt8">{d.body}</div>
          <div className="small faint">{daysLeft <= 0 ? 'Expires today' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`} · if ignored: “{d.options.find((o) => o.id === d.defaultOption)?.label}”</div>
        </div>
      </div>
      <div className="row wrap mt8">
        {d.options.map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant={d.recommended === o.id ? 'primary' : o.tone === 'bad' ? 'danger' : undefined}
            title={o.detail}
            onClick={() => {
              const msg = act((ww) => resolveDecision(ww, d, o.id));
              notify(msg || 'Done.', 'good');
            }}
          >
            {o.label}
          </Button>
        ))}
        {d.recommended && d.recommendedBy && <span className="small muted">★ recommended by {d.recommendedBy}</span>}
      </div>
    </div>
  );
}

function NextGame() {
  const w = useWorld();
  const c = userClub(w)!;
  const nav = useNavigate();
  const day = nextUserFixtureDay(w);
  const f = day != null ? w.fixtures.find((x) => x.day === day && !x.played && !x.cancelled && (x.homeId === c.id || x.awayId === c.id)) : null;
  if (!f) return <Card title="Next game"><Empty>No scheduled games.</Empty></Card>;
  const home = f.homeId === c.id;
  const opp = getClub(w, home ? f.awayId : f.homeId);
  const us = clubStrength(w, c);
  const them = clubStrength(w, opp);
  const edge = (us - them) * 1.1 + (f.neutral ? 0 : home ? 3 : -3);
  const pct = Math.round(100 / (1 + Math.exp(-edge / 6.5)));
  const injured = roster(w, c.id).filter((p) => p.injury && !p.injury.playThroughRisk);
  return (
    <Card title="Next game" actions={<Badge>{f.label}</Badge>}>
      <div className="row" style={{ justifyContent: 'center', gap: 22, padding: '6px 0' }}>
        <div className="center"><Crest club={home ? c : opp} size="lg" /><div className="small mt8">{(home ? c : opp).abbrev}</div></div>
        <div className="center">
          <div className="muted small">{fmtDate(w.season, f.day)}</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{f.neutral ? 'vs' : '@'}</div>
          <div className="small muted">{f.neutral ? 'Neutral venue' : home ? 'Home' : 'Away'}</div>
        </div>
        <div className="center"><Crest club={home ? opp : c} size="lg" /><div className="small mt8">{(home ? opp : c).abbrev}</div></div>
      </div>
      <Meter value={pct} label="Pre-game win chance (squad strength, venue)" />
      <div className="kv small mt8">
        <span>Strength</span><span>{us.toFixed(1)} vs {them.toFixed(1)}</span>
        <span>Your plan</span><span>{OFF_LABEL[c.tactics.off]} · {DEF_LABEL[c.tactics.def]} · {c.tactics.pace} pace</span>
        <span>Their plan</span><span>{OFF_LABEL[opp.tactics.off]} · {DEF_LABEL[opp.tactics.def]}</span>
        <span>Unavailable</span><span>{injured.length ? injured.map((p) => p.lastName).join(', ') : 'None'}</span>
      </div>
      <div className="row mt8"><Button size="sm" onClick={() => nav('/team/tactics')}>Adjust tactics</Button><Button size="sm" onClick={() => nav(`/clubs/${opp.id}`)}>Scout opponent</Button></div>
    </Card>
  );
}

function ClubSnapshot() {
  const w = useWorld();
  const c = userClub(w)!;
  const wk = w.lastWeekSummary;
  return (
    <Card title="Club snapshot">
      <div className="grid g2">
        <Stat label="Cash" value={fmtMoney(c.finances.cash)} tone={c.finances.cash < 0 ? 'bad' : undefined} sub={wk ? `This week ${fmtMoney(wk.cashDelta, true)}` : undefined} />
        <Stat label="Board confidence" value={`${c.board.overall}/100`} tone={c.board.overall < 40 ? 'bad' : c.board.overall > 65 ? 'good' : undefined} sub={c.board.ultimatum ? 'Ultimatum active' : c.board.autonomy === 'restricted' ? 'Autonomy restricted' : undefined} />
        <Stat label="Fan sentiment" value={`${Math.round(c.fans.sentiment)}/100`} sub={`Hype ${Math.round(c.fans.hype)} · ${Math.round(c.fans.local).toLocaleString('en')} local fans`} />
        <Stat label="Reputation" value={`${w.user.reputation}/100`} sub="Executive standing" />
      </div>
      <div className="col mt8">
        {c.board.objectives.map((o) => (
          <Meter key={o.id} value={o.progress * 100} label={<>{o.promise ? '🤝 ' : ''}{o.label}</>} />
        ))}
      </div>
    </Card>
  );
}

function MiniTable() {
  const w = useWorld();
  const c = userClub(w)!;
  const lc = w.competitions.find((x) => x.id === `${c.leagueId}-${w.season}`);
  if (!lc) return null;
  const st = sortStandings(lc.standings);
  const idx = st.findIndex((s) => s.clubId === c.id);
  const from = Math.max(0, Math.min(st.length - 7, idx - 3));
  return (
    <Card title={lc.name} actions={<Link className="link small" to="/results/standings">Full table</Link>}>
      <table className="tbl">
        <tbody>
          {st.slice(from, from + 7).map((s, i) => {
            const cl = getClub(w, s.clubId);
            return (
              <tr key={s.clubId} className={s.clubId === c.id ? 'me' : ''}>
                <td className="r">{from + i + 1}</td>
                <td><Link to={`/clubs/${cl.id}`} className="link">{cl.name}</Link></td>
                <td className="r">{s.w}-{s.l}</td>
                <td className="r">{s.pf - s.pa > 0 ? '+' : ''}{s.pf - s.pa}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function LastResults() {
  const w = useWorld();
  const games = [...w.games].filter((g) => g.season === w.season).slice(-5).reverse();
  const c = userClub(w)!;
  if (!games.length) return null;
  return (
    <Card title="Recent results">
      <div className="list">
        {games.map((g) => {
          const us = g.home.clubId === c.id;
          const ours = us ? g.home.score : g.away.score;
          const theirs = us ? g.away.score : g.home.score;
          const opp = getClub(w, us ? g.away.clubId : g.home.clubId);
          return (
            <Link key={g.id} to={`/game/${g.id}`} className="list-item row">
              <Badge tone={ours > theirs ? 'good' : 'bad'}>{ours > theirs ? 'W' : 'L'}</Badge>
              <b className="num">{ours}–{theirs}</b>
              <span>{us ? 'vs' : '@'} {opp.name}</span>
              <span className="spacer" />
              <span className="small muted">{g.factors[0]?.title}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function LatestNews() {
  const w = useWorld();
  const news = w.news.filter((n) => n.importance >= 1 && (w.user.clubId == null || n.clubIds.includes(w.user.clubId) || n.importance >= 2)).slice(0, 10);
  return (
    <Card title="Newsroom" actions={<Link className="link small" to="/club/media">All news</Link>}>
      {news.length === 0 ? <Empty>No news yet.</Empty> : (
        <div className="list">
          {news.map((n) => (
            <div key={n.id} className="list-item">
              <div className="row gap4"><b>{n.headline}</b></div>
              <div className="small muted">{n.body}</div>
              <div className="small faint">{n.outlet} · {fmtAbs(n.day)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
