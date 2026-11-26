import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useGame, useWorld } from './store';
import { Badge, Button, Crest, Modal } from './components/ui';
import { userClub, fmtMoney, club as getClub, fixture as getFixture, playerName } from '../engine/world';
import { fmtDate, phaseOf, PHASE_LABEL } from '../engine/calendar';
import { nextUserFixtureDay } from '../engine/daily';
import type { AdvanceMode } from '../engine/daily';

import MainMenu from './screens/MainMenu';
import NewGame from './screens/NewGame';
import Today from './screens/Today';
import CalendarScreen from './screens/CalendarScreen';
import Settings from './screens/Settings';
import GameView from './screens/GameView';
import Legacy from './screens/Legacy';
import Finance from './screens/club/Finance';
import Marketing from './screens/club/Marketing';
import Commercial from './screens/club/Commercial';
import Contracts from './screens/club/Contracts';
import Board from './screens/club/Board';
import Media from './screens/club/Media';
import Players from './screens/team/Players';
import Tactics from './screens/team/Tactics';
import Training from './screens/team/Training';
import StaffScreen from './screens/team/Staff';
import Medical from './screens/team/Medical';
import Market from './screens/team/Market';
import Academy from './screens/team/Academy';
import PlayerProfile from './screens/team/PlayerProfile';
import Stadium from './screens/infra/Stadium';
import Tickets from './screens/infra/Tickets';
import Stores from './screens/infra/Stores';
import Restaurants from './screens/infra/Restaurants';
import Standings from './screens/results/Standings';
import Schedule from './screens/results/Schedule';
import Competitions from './screens/results/Competitions';
import Stats from './screens/results/Stats';
import Rules from './screens/results/Rules';
import ClubProfile from './screens/results/ClubProfile';

export default function App() {
  return (
    <HashRouter>
      <Root />
    </HashRouter>
  );
}

function Root() {
  const world = useGame((s) => s.world);
  const toast = useGame((s) => s.toast);
  const busy = useGame((s) => s.busy);
  return (
    <>
      <Routes>
        <Route path="/" element={world ? <Navigate to="/today" replace /> : <MainMenu />} />
        <Route path="/new" element={<NewGame />} />
        <Route path="*" element={world ? <GameShell /> : <Navigate to="/" replace />} />
      </Routes>
      {toast && <div className={`toast ${toast.tone ?? ''}`}>{toast.msg}</div>}
      {busy && (
        <div className="overlay">
          <div className="center">
            <div className="spinner" />
            {busy}
          </div>
        </div>
      )}
    </>
  );
}

const NAV: { head: string; icon: string; items: [string, string][] }[] = [
  { head: 'Club Management', icon: '🏢', items: [['/club/finance', 'Finance'], ['/club/marketing', 'Marketing & Fans'], ['/club/commercial', 'Sponsors & TV'], ['/club/contracts', 'Contracts'], ['/club/board', 'Board'], ['/club/media', 'News & Media']] },
  { head: 'Team', icon: '🏀', items: [['/team/players', 'Players'], ['/team/tactics', 'Tactics'], ['/team/training', 'Training'], ['/team/staff', 'Coaching Staff'], ['/team/medical', 'Medical & Support'], ['/team/market', 'Transfers & Scouting'], ['/team/academy', 'Academy']] },
  { head: 'Infrastructure', icon: '🏟️', items: [['/infrastructure/stadium', 'Stadium'], ['/infrastructure/tickets', 'Tickets'], ['/infrastructure/stores', 'Stores'], ['/infrastructure/restaurants', 'Restaurants']] },
  { head: 'Results', icon: '📊', items: [['/results/standings', 'Standings'], ['/results/schedule', 'Fixtures & Results'], ['/results/competitions', 'Competitions'], ['/results/stats', 'Statistics'], ['/results/rules', 'Rules']] },
];

function GameShell() {
  const w = useWorld();
  const c = userClub(w);
  useEffect(() => {
    if (c) document.documentElement.style.setProperty('--accent', pickAccent(c.colors));
  }, [c]);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🏀</div>
          <div>
            Basketball Dynasty
            <div className="small faint" style={{ fontWeight: 500 }}>v0.1 · full pass</div>
          </div>
        </div>
        <NavLink to="/today" className={({ isActive }) => `nav-top ${isActive ? 'active' : ''}`}>📋 Today</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `nav-top ${isActive ? 'active' : ''}`}>📅 Calendar</NavLink>
        {NAV.map((s) => (
          <div className="nav-section" key={s.head}>
            <div className="nav-head">{s.icon} {s.head}</div>
            {s.items.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>{label}</NavLink>
            ))}
          </div>
        ))}
        <div className="nav-section">
          <NavLink to="/legacy" className={({ isActive }) => `nav-top ${isActive ? 'active' : ''}`}>🏆 Legacy</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-top ${isActive ? 'active' : ''}`}>⚙️ Settings & Saves</NavLink>
        </div>
      </aside>
      <TopBar />
      <main className="main">
        <Routes>
          <Route path="/today" element={<Today />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/club/finance" element={<RequireClub><Finance /></RequireClub>} />
          <Route path="/club/marketing" element={<RequireClub><Marketing /></RequireClub>} />
          <Route path="/club/commercial" element={<RequireClub><Commercial /></RequireClub>} />
          <Route path="/club/contracts" element={<RequireClub><Contracts /></RequireClub>} />
          <Route path="/club/board" element={<RequireClub><Board /></RequireClub>} />
          <Route path="/club/media" element={<Media />} />
          <Route path="/team/players" element={<RequireClub><Players /></RequireClub>} />
          <Route path="/team/tactics" element={<RequireClub><Tactics /></RequireClub>} />
          <Route path="/team/training" element={<RequireClub><Training /></RequireClub>} />
          <Route path="/team/staff" element={<RequireClub><StaffScreen /></RequireClub>} />
          <Route path="/team/medical" element={<RequireClub><Medical /></RequireClub>} />
          <Route path="/team/market" element={<Market />} />
          <Route path="/team/academy" element={<RequireClub><Academy /></RequireClub>} />
          <Route path="/player/:id" element={<PlayerProfile />} />
          <Route path="/infrastructure/stadium" element={<RequireClub><Stadium /></RequireClub>} />
          <Route path="/infrastructure/tickets" element={<RequireClub><Tickets /></RequireClub>} />
          <Route path="/infrastructure/stores" element={<RequireClub><Stores /></RequireClub>} />
          <Route path="/infrastructure/restaurants" element={<RequireClub><Restaurants /></RequireClub>} />
          <Route path="/results/standings" element={<Standings />} />
          <Route path="/results/schedule" element={<Schedule />} />
          <Route path="/results/competitions" element={<Competitions />} />
          <Route path="/results/stats" element={<Stats />} />
          <Route path="/results/rules" element={<Rules />} />
          <Route path="/clubs/:id" element={<ClubProfile />} />
          <Route path="/game/:id" element={<GameView />} />
          <Route path="/legacy" element={<Legacy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>
      <ResultsModal />
      <GlobalSearch />
    </div>
  );
}

function RequireClub({ children }: { children: ReactNode }) {
  const w = useWorld();
  if (w.user.clubId == null) {
    return (
      <div className="card">
        <h2>No club</h2>
        <p className="muted mt8">You are currently without a club. Advance time from the Today screen to receive job offers.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function pickAccent(colors: [string, string]): string {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  for (const c of colors) {
    const l = lum(c);
    if (l > 0.25 && l < 0.92) return c;
  }
  return '#f28c28';
}

const MODES: { mode: AdvanceMode; label: string; desc: string }[] = [
  { mode: 'day', label: 'Advance one day', desc: 'Simulate today.' },
  { mode: 'nextGame', label: 'Play next game', desc: 'Simulate up to and including your next game.' },
  { mode: 'week', label: 'Advance one week', desc: 'Stops only for major events.' },
  { mode: 'nextEvent', label: 'Advance to next event', desc: 'Stops on any calendar hold you have enabled.' },
  { mode: 'month', label: 'Advance one month', desc: 'Delegated staff handle routine items.' },
  { mode: 'endOfPhase', label: 'Holiday to end of season', desc: 'Runs until the new season or a major hold.' },
];

function TopBar() {
  const w = useWorld();
  const c = userClub(w);
  const doAdvance = useGame((s) => s.advance);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const nextDay = nextUserFixtureDay(w);
  const nextF = nextDay != null && c ? w.fixtures.find((f) => f.day === nextDay && !f.played && !f.cancelled && (f.homeId === c.id || f.awayId === c.id)) : null;
  const opp = nextF && c ? getClub(w, nextF.homeId === c.id ? nextF.awayId : nextF.homeId) : null;
  const pending = w.decisions.filter((d) => !d.resolved).length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === ' ' && e.shiftKey) { e.preventDefault(); doAdvance('nextGame'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doAdvance]);
  return (
    <header className="topbar">
      {c ? (
        <div className="club" onClick={() => nav(`/clubs/${c.id}`)} style={{ cursor: 'pointer' }}>
          <Crest club={c} />
          <div>
            {c.name}
            <div className="small muted" style={{ fontWeight: 500 }}>{c.leagueId ? w.rules.leagues[c.leagueId].name : ''} · {w.user.role === 'owner' ? 'Owner-President' : 'General Manager'}</div>
          </div>
        </div>
      ) : (
        <div className="club">Unemployed — {w.user.name}</div>
      )}
      <div className="kpi"><span>Date</span><b>{fmtDate(w.season, w.day)}</b></div>
      <div className="kpi"><span>Phase</span><b>{PHASE_LABEL[phaseOf(w.season, w.day)]}</b></div>
      {c && (
        <>
          <div className="kpi"><span>Cash</span><b className={c.finances.cash < 0 ? 'bad' : ''}>{fmtMoney(c.finances.cash)}</b></div>
          <div className="kpi" title="Board confidence"><span>Board</span><b className={c.board.overall < 40 ? 'bad' : c.board.overall > 65 ? 'good' : ''}>{c.board.overall}/100</b></div>
          <div className="kpi" title="Fan sentiment"><span>Fans</span><b>{Math.round(c.fans.sentiment)}/100</b></div>
          {nextF && opp && (
            <div className="kpi" title={nextF.label}>
              <span>Next game · {fmtDate(w.season, nextF.day, false)}</span>
              <b>{nextF.homeId === c.id ? 'vs' : '@'} {opp.abbrev}</b>
            </div>
          )}
        </>
      )}
      <div className="spacer" />
      <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('bd-search'))} title="Search (Ctrl+K)">🔍</Button>
      {pending > 0 && <Badge tone="warn" title="Decisions waiting">{pending} pending</Badge>}
      {w.gameOver ? (
        <Badge tone="bad">Game over</Badge>
      ) : (
        <div className="dropdown row gap4">
          <Button variant="primary" onClick={() => doAdvance(c ? 'nextGame' : 'week')} title="Shift+Space">
            {c ? '▶ Play next game' : '▶ Advance week'}
          </Button>
          <Button onClick={() => setOpen(!open)}>▾</Button>
          {open && (
            <div className="dropdown-menu" onMouseLeave={() => setOpen(false)}>
              {MODES.map((m) => (
                <button key={m.mode} onClick={() => { setOpen(false); doAdvance(m.mode); }}>
                  <div style={{ fontWeight: 600 }}>{m.label}</div>
                  <div className="small muted">{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function ResultsModal() {
  const w = useWorld();
  const show = useGame((s) => s.showResults);
  const res = useGame((s) => s.lastAdvance);
  const close = useGame((s) => s.closeResults);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => close(), [loc.pathname, close]);
  if (!show || !res) return null;
  const games = res.gamesPlayed.map((id) => getFixture(w, id)).filter((f) => f && f.result);
  const c = userClub(w);
  return (
    <Modal title={`Simulated ${res.days} day${res.days === 1 ? '' : 's'}`} onClose={close}>
      {games.length > 0 && c && (
        <div className="col mb8">
          <h3>Results</h3>
          {games.map((f) => {
            const us = f.homeId === c.id;
            const ours = us ? f.result!.home : f.result!.away;
            const theirs = us ? f.result!.away : f.result!.home;
            const opp = getClub(w, us ? f.awayId : f.homeId);
            const log = w.games.find((g) => g.id === f.result!.gameId);
            const mvp = log ? w.players.find((p) => p.id === log.mvpId) : null;
            return (
              <div key={f.id} className="card" style={{ padding: 12 }}>
                <div className="row">
                  <Badge tone={ours > theirs ? 'good' : 'bad'}>{ours > theirs ? 'WIN' : 'LOSS'}</Badge>
                  <b className="num" style={{ fontSize: 18 }}>{ours}–{theirs}</b>
                  <span>{us ? 'vs' : '@'} {opp.name}</span>
                  <span className="muted small">{f.label}{f.result!.ot ? ` · ${f.result!.ot}OT` : ''}</span>
                  <span className="spacer" />
                  {log && <Button size="sm" onClick={() => { close(); nav(`/game/${log.id}`); }}>Box score & analysis</Button>}
                </div>
                {log && (
                  <div className="mt8 small">
                    {mvp && <div className="muted">Player of the game: {playerName(mvp)}</div>}
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {log.factors.slice(0, 3).map((x, i) => (
                        <li key={i}><span className={x.impact >= 0 ? 'good' : 'bad'}>{x.title}</span> <span className="muted">— {x.detail}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {res.holds.length > 0 && (
        <div className="col">
          <h3>Stopped for</h3>
          {res.holds.slice(0, 8).map((h, i) => (
            <div key={i} className="callout warn small">{h.message}</div>
          ))}
        </div>
      )}
      <div className="row mt16">
        <span className="spacer" />
        <Button onClick={() => { close(); nav('/today'); }}>Go to Today</Button>
        <Button variant="primary" onClick={close}>Continue</Button>
      </div>
    </Modal>
  );
}

function GlobalSearch() {
  const w = useWorld();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onEvt = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('bd-search', onEvt);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('bd-search', onEvt); };
  }, []);
  if (!open) return null;
  const s = q.trim().toLowerCase();
  const players = s.length >= 2 ? w.players.filter((p) => !p.retired && `${p.firstName} ${p.lastName}`.toLowerCase().includes(s)).slice(0, 12) : [];
  const clubs = s.length >= 1 ? w.clubs.filter((c) => `${c.name} ${c.abbrev} ${c.city}`.toLowerCase().includes(s)).slice(0, 8) : [];
  const staff = s.length >= 2 ? w.staff.filter((x) => `${x.firstName} ${x.lastName}`.toLowerCase().includes(s)).slice(0, 6) : [];
  const go = (to: string) => { setOpen(false); setQ(''); nav(to); };
  return (
    <Modal title="Search" onClose={() => setOpen(false)}>
      <input autoFocus placeholder="Player, club or staff…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', fontSize: 16, padding: 10 }} />
      <div className="col mt16">
        {clubs.map((c) => (
          <div key={`c${c.id}`} className="row link" onClick={() => go(`/clubs/${c.id}`)}><Crest club={c} /> {c.name} <span className="muted small">{c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental'}</span></div>
        ))}
        {players.map((p) => (
          <div key={`p${p.id}`} className="row link" onClick={() => go(`/player/${p.id}`)}>🏀 {p.firstName} {p.lastName} <span className="muted small">{p.pos} · {p.teamId != null ? getClub(w, p.teamId).abbrev : 'Free agent'}</span></div>
        ))}
        {staff.map((x) => (
          <div key={`s${x.id}`} className="row"><span>👔 {x.firstName} {x.lastName}</span> <span className="muted small">{x.role} · rating {x.rating} · {x.teamId != null ? getClub(w, x.teamId).abbrev : 'Available'}</span></div>
        ))}
        {s && !clubs.length && !players.length && !staff.length && <div className="muted">No results.</div>}
      </div>
    </Modal>
  );
}
