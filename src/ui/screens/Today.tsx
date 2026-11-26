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
import { JobOfferCard } from '../components/career';
import { jobSecurity } from '../../engine/career';
import { Badge, Button, Card, Crest, Meter, Page, Stat, Empty } from '../components/ui';
import { Icon, type IconName } from '../art/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { InstallButton } from '../components/install';
import { useState } from 'react';
import '../screens/hubs/hubs.css';
import { payroll } from '../../engine/finance';
import type { CSSProperties } from 'react';

export default function Today() {
  const w = useWorld();
  const c = userClub(w);
  const digest = buildDigest(w);
  const offers = w.decisions.filter((d) => !d.resolved && d.kind === 'jobOffer');
  const decisions = w.decisions.filter((d) => !d.resolved && d.kind !== 'jobOffer').sort((a, b) => b.urgency + b.impact - (a.urgency + a.impact));
  const advance = useGame((s) => s.advance);
  const name = w.user.name.split(' ')[0];
  return (
    <Page
      kicker={c ? `${c.name} · executive desk` : 'Executive desk'}
      title={`Good morning, ${name}`}
      subtitle={`${fmtDate(w.season, w.day)} · Season ${seasonLabel(w.season)} · ${PHASE_LABEL[phaseOf(w.season, w.day)]}`}
      actions={<><InstallButton compact />{!c && <Button variant="primary" onClick={() => advance('week')}>Advance a week (wait for offers)</Button>}</>}
    >
      {w.gameOver && <div className="callout bad mb8"><b>Career over.</b> {w.gameOver.reason}</div>}
      <LiveBanner />
      <ActionPanel offers={offers} decisions={decisions} />
      {c && <MatchStrip />}
      {c && <HubTiles />}
      {c && <RecentStrip />}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <div className="col gap16">
          {!c && offers.length === 0 && <Card title="Waiting for offers"><p className="muted">No offers right now. Advance time: clubs approach you at a rate that grows with your reputation ({Math.round(w.user.reputation)}/100).</p></Card>}
          {c && <FirstWeeks />}
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
          {c && <ClubSnapshot />}
          {c && <MiniTable />}
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
              if ((o.tone === 'bad' || d.impact >= 3) && !confirm(`${o.label}?\n\n${o.detail ?? d.title}\n\nThis cannot be undone.`)) return;
              const msg = act((ww) => resolveDecision(ww, d, o.id));
              notify(msg || 'Done.', 'good');
            }}
          >
            {o.label}
          </Button>
        ))}
        {d.recommended && d.recommendedBy && <span className="small muted">★ recommended by {d.recommendedBy}</span>}
      </div>
      {d.options.some((o) => o.detail) && (
        <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {d.options.filter((o) => o.detail).map((o) => <li key={o.id}><b>{o.label}:</b> {o.detail}</li>)}
        </ul>
      )}
    </div>
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
        <Stat label="Job security" value={w.user.role === 'owner' ? 'Owner' : `${jobSecurity(w)}/100`} tone={w.user.role !== 'owner' && jobSecurity(w) < 35 ? 'bad' : undefined} sub={`Owner ${Math.round(w.user.approval.board)} · Fans ${Math.round(w.user.approval.fans)} · Rep ${Math.round(w.user.reputation)}`} />
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

const STEPS: { path: string; label: string; why: string }[] = [
  { path: '/club/board', label: 'Read the board\'s objectives and how you are evaluated', why: 'The owner and the fans grade you every week against these expectations.' },
  { path: '/team/players', label: 'Review your squad', why: 'Who is good, who is unhappy, whose contract is ending.' },
  { path: '/team/tactics', label: 'Propose your game plan', why: 'Coach and squad decide execution; fans and owner judge the style.' },
  { path: '/club/finance', label: 'Check the finances', why: 'Cash, payroll budget and the 90-day forecast decide what you can afford.' },
  { path: '/infrastructure/tickets', label: 'Set ticket prices', why: 'Gate revenue vs full arenas and happy supporters.' },
  { path: '/club/commercial', label: 'Run a revenue drive', why: 'Naming rights, a kit sponsor, local TV and a members drive can fund your first signing.' },
  { path: '/team/market', label: 'Browse free agents', why: 'Their asks drop as the season approaches — bargains before the window closes.' },
];

function FirstWeeks() {
  const w = useWorld();
  const act = useAct();
  const ob = w.user.onboarding;
  const stint = w.user.career[w.user.career.length - 1];
  if (!ob || ob.dismissed || !stint || absDay(w) - stint.from > 90) return null;
  const done = STEPS.filter((s) => ob.visited.includes(s.path)).length;
  if (done === STEPS.length) return null;
  return (
    <Card title={`Your first weeks (${done}/${STEPS.length})`} actions={<Button size="sm" variant="ghost" onClick={() => act((ww) => { ww.user.onboarding!.dismissed = true; })}>Hide</Button>}>
      <div className="list">
        {STEPS.map((s) => {
          const ok = ob.visited.includes(s.path);
          return (
            <Link key={s.path} to={s.path} className="list-item row">
              <Badge tone={ok ? 'good' : undefined}>{ok ? '✓ done' : 'to do'}</Badge>
              <div><b className={ok ? 'muted' : ''}>{s.label}</b><div className="small muted">{s.why}</div></div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- hub (visual pass)
function LiveBanner() {
  const w = useWorld();
  const id = useGame((st) => st.liveFixtureId);
  const nav = useNavigate();
  if (id == null) return null;
  const f = w.fixtures.find((x) => x.id === id);
  const c = userClub(w);
  if (!f || !c) return null;
  const opp = getClub(w, f.homeId === c.id ? f.awayId : f.homeId);
  return (
    <motion.div className="live-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <span className="live-dot" aria-hidden="true" />
      <Crest club={opp} size={40} />
      <div style={{ flex: 1 }}>
        <h2>Game day: {f.homeId === c.id ? 'vs' : '@'} {opp.name}</h2>
        <div className="small muted">{f.label} · tip-off is waiting for you</div>
      </div>
      <button type="button" className="btn primary cta" onClick={() => nav(`/live/${id}`)}><span className="row gap4"><Icon name="play" size={16} /> Watch game</span></button>
    </motion.div>
  );
}

function ActionPanel({ offers, decisions }: { offers: Decision[]; decisions: Decision[] }) {
  const w = useWorld();
  const c = userClub(w);
  const last = useGame((st) => st.lastAdvance);
  const [hidden, setHidden] = useState<unknown>(null);
  const stops = last && hidden !== last ? last.holds : [];
  if (!offers.length && !decisions.length && !stops.length) return null;
  const title = offers.length && !c ? 'Choose where your career starts' : decisions.length || offers.length ? 'Action required' : 'The clock stopped';
  return (
    <motion.section className="action-panel" initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} aria-live="polite">
      <div className="ap-head">
        <span className="ap-badge"><Icon name="alert" size={24} /></span>
        <div style={{ flex: 1 }}>
          <h2>{title}</h2>
          <div className="small muted">{[decisions.length && `${decisions.length} decision${decisions.length > 1 ? 's' : ''}`, offers.length && `${offers.length} job offer${offers.length > 1 ? 's' : ''}`, stops.length && `${stops.length} event${stops.length > 1 ? 's' : ''} stopped the clock`].filter(Boolean).join(' · ')}</div>
        </div>
        {stops.length > 0 && !decisions.length && !offers.length && <Button size="sm" variant="ghost" onClick={() => setHidden(last)}>Dismiss</Button>}
      </div>
      {stops.length > 0 && (
        <div className="action-stops">
          <AnimatePresence>
            {stops.slice(0, 6).map((h, i) => (
              <motion.div key={`${h.kind}-${i}`} className="action-stop" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                <Icon name={h.kind === 'injury' ? 'medical' : h.kind === 'jobOffer' ? 'owner' : h.kind === 'transferBid' ? 'market' : h.kind === 'boardUltimatum' ? 'board' : h.kind === 'budgetBreach' ? 'coin' : 'clock'} size={20} style={{ color: 'var(--warn)' }} />
                <span>{h.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {offers.length > 0 && <div className="col">{offers.map((d) => <JobOfferCard key={d.id} d={d} />)}</div>}
      {decisions.map((d) => <div key={d.id} className="decision-card"><DecisionRow d={d} /></div>)}
    </motion.section>
  );
}

function MatchStrip() {
  const w = useWorld();
  const c = userClub(w)!;
  const nav = useNavigate();
  const advance = useGame((s) => s.advance);
  const day = nextUserFixtureDay(w);
  const f = day != null ? w.fixtures.find((x) => x.day === day && !x.played && !x.cancelled && (x.homeId === c.id || x.awayId === c.id)) : null;
  if (!f) return <div className="match-strip"><span className="ms-teams"><Crest club={c} size={34} /> No games scheduled</span><span className="ms-meta">Use the off-season to rebuild: contracts, signings, infrastructure.</span></div>;
  const home = f.homeId === c.id ? c : getClub(w, f.homeId);
  const away = f.homeId === c.id ? getClub(w, f.awayId) : c;
  const opp = getClub(w, f.homeId === c.id ? f.awayId : f.homeId);
  const edge = (clubStrength(w, c) - clubStrength(w, opp)) * 1.1 + (f.neutral ? 0 : f.homeId === c.id ? 3 : -3);
  const pct = Math.round(100 / (1 + Math.exp(-edge / 6.5)));
  const injured = roster(w, c.id).filter((p) => p.injury && !p.injury.playThroughRisk);
  return (
    <div className="match-strip" style={{ ['--home-c' as string]: home.colors[0], ['--away-c' as string]: away.colors[0] } as CSSProperties}>
      <div>
        <div className="small" style={{ color: 'var(--accent-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next game · {fmtDate(w.season, f.day)}</div>
        <div className="ms-teams"><Crest club={home} size={34} /> {home.abbrev} <span className="ms-vs">VS</span> {away.abbrev} <Crest club={away} size={34} /></div>
        <div className="ms-meta">{f.label} · {f.neutral ? 'neutral venue' : f.homeId === c.id ? 'home' : 'away'} · {OFF_LABEL[c.tactics.off]} / {DEF_LABEL[c.tactics.def]}{injured.length ? ` · out: ${injured.map((p) => p.lastName).join(', ')}` : ''}</div>
      </div>
      <span className="spacer" />
      <div className="ms-meter"><Meter value={pct} label="Win chance" /></div>
      <Button size="sm" onClick={() => nav('/team/tactics')}>Game plan</Button>
      <Button size="sm" onClick={() => nav(`/clubs/${opp.id}`)}>Scout {opp.abbrev}</Button>
      <button type="button" className="btn primary sm" onClick={() => advance('nextGame')}><span className="row gap4"><Icon name="play" size={15} /> Play</span></button>
    </div>
  );
}

function HubTiles() {
  const w = useWorld();
  const c = userClub(w)!;
  const sq = roster(w, c.id);
  const unhappy = sq.filter((p) => p.morale < 45).length;
  const room = c.finances.budget.payroll - payroll(w, c);
  const tiles: { to: string; icon: IconName; title: string; sub: string; badge?: string }[] = [
    { to: '/team/players', icon: 'players', title: 'Squad', sub: `${sq.length} players · ${sq.filter((p) => p.injury).length} injured`, badge: unhappy ? `${unhappy} unhappy` : undefined },
    { to: '/team/tactics', icon: 'tactics', title: 'Tactics', sub: `${OFF_LABEL[c.tactics.off]}` },
    { to: '/team/market', icon: 'market', title: 'Market', sub: `Payroll room ${fmtMoney(room)}` },
    { to: '/club/finance', icon: 'coin', title: 'Finance', sub: `Cash ${fmtMoney(c.finances.cash)}` },
    { to: '/infrastructure/stadium', icon: 'arena', title: 'Arena', sub: `${(c.arena.seats.general + c.arena.seats.lower + c.arena.seats.premium).toLocaleString('en')} seats` },
    { to: '/club/board', icon: 'board', title: 'Board', sub: `Job security ${w.user.role === 'owner' ? '—' : jobSecurity(w)}` },
  ];
  return (
    <div className="grid g6" style={{ gap: 10, marginBottom: 16 }}>
      {tiles.map((t, i) => (
        <Link key={t.to} to={t.to} className="tile" style={{ animationDelay: `${0.05 * i}s` }}>
          {t.badge && <span className="tile-badge"><Badge tone="warn">{t.badge}</Badge></span>}
          <Icon name={t.icon} size={30} className="tile-icon" />
          <div><div className="tile-title">{t.title}</div><div className="tile-sub">{t.sub}</div></div>
        </Link>
      ))}
    </div>
  );
}

function RecentStrip() {
  const w = useWorld();
  const c = userClub(w)!;
  const games = [...w.games].filter((g) => g.season === w.season).slice(-6).reverse();
  if (!games.length) return null;
  return (
    <Card title="Recent results" className="mb8" style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {games.map((g, i) => {
          const home = getClub(w, g.home.clubId);
          const away = getClub(w, g.away.clubId);
          const usHome = g.home.clubId === c.id;
          const win = usHome ? g.home.score > g.away.score : g.away.score > g.home.score;
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/game/${g.id}`} className="matchup-tile" style={{ background: `linear-gradient(115deg, ${home.colors[0]} 0 49.5%, #fff 49.5% 50.5%, ${away.colors[0]} 50.5% 100%)` }} title={`${home.name} ${g.home.score}–${g.away.score} ${away.name}`}>
                <span className="wl"><Badge tone={win ? 'good' : 'bad'}>{win ? 'W' : 'L'}</Badge></span>
                <Crest club={home} size={52} />
                <Crest club={away} size={52} />
                <span className="score">{g.home.score} – {g.away.score}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
