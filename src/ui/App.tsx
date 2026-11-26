import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useGame, useWorld } from './store';
import { Badge, Button, Crest, Modal, CountUp, useModalClose } from './components/ui';
import { Icon, BrandMark, type IconName } from './art/icons';
import { AnimatePresence, motion, type MotionStyle } from 'framer-motion';
import type { Fixture } from '../engine/types';
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
import Standings from './screens/results/Standings';
import Schedule from './screens/results/Schedule';
import Competitions from './screens/results/Competitions';
import Stats from './screens/results/Stats';
import Rules from './screens/results/Rules';
import ClubProfile from './screens/results/ClubProfile';
import ClubHub from './screens/hubs/ClubHub';
import TeamHub from './screens/hubs/TeamHub';
import ResultsHub from './screens/hubs/ResultsHub';
import InfraHub from './screens/infra/InfraHub';
import Arena from './screens/infra/Arena';
import SportsFacilities from './screens/infra/SportsFacilities';
import CommercialFacilities from './screens/infra/CommercialFacilities';
import ClubFacilities from './screens/infra/ClubFacilities';
import LiveGame from './screens/live/LiveGame';

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
      <div role="status" aria-live="polite" className="sr-only">{toast?.msg}</div>
      {toast && <div className={`toast ${toast.tone ?? ''}`}><div className="row" style={{ alignItems: 'flex-start' }}><span style={{ flex: 1 }}>{toast.msg}</span><button type="button" className="btn ghost sm" aria-label="Dismiss" onClick={() => useGame.setState({ toast: null })}>✕</button></div></div>}
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

interface Section { id: string; label: string; icon: IconName; to: string; match: string; items?: [string, string, IconName][] }

const SECTIONS: Section[] = [
  { id: 'today', label: 'Today', icon: 'today', to: '/today', match: '/today' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', to: '/calendar', match: '/calendar' },
  { id: 'club', label: 'Club', icon: 'club', to: '/club/finance', match: '/club/', items: [['/club/finance', 'Finance', 'money'], ['/club/marketing', 'Marketing & Fans', 'megaphone'], ['/club/commercial', 'Sponsors & TV', 'coin'], ['/club/contracts', 'Contracts', 'contract'], ['/club/board', 'Board', 'board'], ['/club/media', 'News & Media', 'news']] },
  { id: 'team', label: 'Team', icon: 'team', to: '/team/players', match: '/team/', items: [['/team/players', 'Players', 'players'], ['/team/tactics', 'Tactics', 'tactics'], ['/team/training', 'Training', 'training'], ['/team/staff', 'Coaching Staff', 'staff'], ['/team/medical', 'Medical & Support', 'medical'], ['/team/market', 'Transfers & Scouting', 'market'], ['/team/academy', 'Academy', 'academy']] },
  { id: 'infra', label: 'Arena', icon: 'arena', to: '/infrastructure/stadium', match: '/infrastructure/', items: [['/infrastructure/stadium', 'Stadium', 'arena'], ['/infrastructure/tickets', 'Tickets', 'ticket'], ['/infrastructure/stores', 'Stores', 'store'], ['/infrastructure/restaurants', 'Restaurants', 'food']] },
  { id: 'results', label: 'Results', icon: 'results', to: '/results/standings', match: '/results/', items: [['/results/standings', 'Standings', 'standings'], ['/results/schedule', 'Fixtures & Results', 'fixtures'], ['/results/competitions', 'Competitions', 'bracket'], ['/results/stats', 'Statistics', 'stats'], ['/results/rules', 'Rules', 'rules']] },
  { id: 'legacy', label: 'Legacy', icon: 'legacy', to: '/legacy', match: '/legacy' },
  { id: 'settings', label: 'Settings', icon: 'settings', to: '/settings', match: '/settings' },
];

function GameShell() {
  const w = useWorld();
  const c = userClub(w);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  const section = SECTIONS.find((s) => loc.pathname.startsWith(s.match));
  const pending = w.decisions.filter((d) => !d.resolved).length;
  const mainRef = useRef<HTMLElement>(null);
  const liveId = useGame((st) => st.liveFixtureId);
  const navTo = useNavigate();
  useEffect(() => {
    if (liveId != null && !loc.pathname.startsWith('/live/')) navTo(`/live/${liveId}`);
  }, [liveId, loc.pathname, navTo]);
  useEffect(() => {
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    const ob = (w.user.onboarding ??= { visited: [], dismissed: false });
    if (!ob.visited.includes(loc.pathname)) ob.visited.push(loc.pathname);
  }, [loc.pathname, w]);
  useEffect(() => {
    if (c) document.documentElement.style.setProperty('--accent', pickAccent(c.colors));
  }, [c]);
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(w.settings.textScale ?? 1));
  }, [w.settings.textScale]);
  useEffect(() => {
    const t = () => setMenuOpen((v) => !v);
    window.addEventListener('bd-menu', t);
    return () => window.removeEventListener('bd-menu', t);
  }, []);
  return (
    <div className="app">
      <nav className={`rail ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="logo-mark" title="Basketball Dynasty"><BrandMark /></div>
        {SECTIONS.map((s) => (
          <NavLink key={s.id} to={s.to} className={() => `rail-item ${section?.id === s.id ? 'active' : ''}`} aria-current={section?.id === s.id ? 'page' : undefined}>
            <span className="rail-icon"><Icon name={s.icon} size={26} /></span>
            {s.label}
            {s.id === 'today' && pending > 0 && <span className="rail-dot" aria-label={`${pending} pending`}>{pending}</span>}
          </NavLink>
        ))}
      </nav>
      <TopBar />
      {section?.items ? (
        <div className="subnav" role="navigation" aria-label={`${section.label} pages`}>
          {section.items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={icon} size={17} /> {label}
            </NavLink>
          ))}
        </div>
      ) : <div />}
      <main className="main" ref={mainRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, x: 28, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -22, filter: 'blur(2px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes location={loc}>
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
              <Route path="/club" element={<RequireClub><ClubHub /></RequireClub>} />
              <Route path="/team" element={<RequireClub><TeamHub /></RequireClub>} />
              <Route path="/results" element={<ResultsHub />} />
              <Route path="/infrastructure" element={<RequireClub><InfraHub /></RequireClub>} />
              <Route path="/infrastructure/arena" element={<RequireClub><Arena /></RequireClub>} />
              <Route path="/infrastructure/arena/:tab" element={<RequireClub><Arena /></RequireClub>} />
              <Route path="/infrastructure/sports" element={<RequireClub><SportsFacilities /></RequireClub>} />
              <Route path="/infrastructure/commercial" element={<RequireClub><CommercialFacilities /></RequireClub>} />
              <Route path="/infrastructure/club-facilities" element={<RequireClub><ClubFacilities /></RequireClub>} />
              <Route path="/infrastructure/stadium" element={<Navigate to="/infrastructure/arena" replace />} />
              <Route path="/infrastructure/tickets" element={<Navigate to="/infrastructure/arena/tickets" replace />} />
              <Route path="/infrastructure/stores" element={<Navigate to="/infrastructure/commercial" replace />} />
              <Route path="/infrastructure/restaurants" element={<Navigate to="/infrastructure/commercial" replace />} />
              <Route path="/live/:id" element={<RequireClub><LiveGame /></RequireClub>} />
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
          </motion.div>
        </AnimatePresence>
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
    if (l > 0.42 && l < 0.92) return c;
  }
  return '#ff8a1f';
}

const MODES: { mode: AdvanceMode; label: string; desc: string; icon: IconName }[] = [
  { mode: 'day', label: 'Advance one day', desc: 'Simulate today.', icon: 'clock' },
  { mode: 'nextGame', label: 'Play next game', desc: 'Simulate up to and including your next game.', icon: 'play' },
  { mode: 'week', label: 'Advance one week', desc: 'Stops only for major events.', icon: 'calendar' },
  { mode: 'nextEvent', label: 'Advance to next event', desc: 'Stops on any calendar hold you have enabled.', icon: 'alert' },
  { mode: 'month', label: 'Advance one month', desc: 'Delegated staff handle routine items.', icon: 'fixtures' },
  { mode: 'endOfPhase', label: 'Holiday to end of season', desc: 'Runs until the new season or a major hold.', icon: 'legacy' },
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
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    setTimeout(() => (menuRef.current?.querySelector('.dropdown-menu button') as HTMLElement | null)?.focus(), 30);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const go = (mode: AdvanceMode) => {
    const long = mode === 'week' || mode === 'month' || mode === 'endOfPhase';
    if (long && pending > 0 && !confirm(`${pending} decision${pending > 1 ? 's are' : ' is'} waiting. If deadlines pass while advancing, they resolve with the staff recommendation or the default option. Continue?`)) return;
    doAdvance(mode);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === ' ' && e.shiftKey) { e.preventDefault(); doAdvance('nextGame'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doAdvance]);
  const ap = w.user.approval;
  const tone = (v: number, lo: number, hi: number) => (v < lo ? 'bad' : v > hi ? 'good' : '');
  return (
    <header className="topbar">
      <button type="button" className="btn ghost sm menu-toggle" aria-label="Open menu" onClick={() => window.dispatchEvent(new CustomEvent('bd-menu'))}><Icon name="menu" /></button>
      {c ? (
        <button type="button" className="club" onClick={() => nav(`/clubs/${c.id}`)} style={{ cursor: 'pointer', background: 'none', border: 'none', font: 'inherit', textAlign: 'left', padding: 0 }}>
          <Crest club={c} size={44} />
          <div>
            {c.name}
            <div className="sub">{c.leagueId ? w.rules.leagues[c.leagueId].name : ''} · {w.user.role === 'owner' ? 'Owner-President' : c.leagueId === 'COLLEGE' ? 'Athletic Director' : 'General Manager'}</div>
          </div>
        </button>
      ) : (
        <div className="club">Free agent executive<div className="sub">{w.user.name}</div></div>
      )}
      <div className="hud-chip optional" title="Date"><Icon name="clock" size={18} /><div><span>{PHASE_LABEL[phaseOf(w.season, w.day)]}</span><b>{fmtDate(w.season, w.day, false)}</b></div></div>
      {c && (
        <>
          <div className="hud-chip optional" title="Club cash"><Icon name="coin" size={20} className="ic-coin" /><div><span>Cash</span><b className={c.finances.cash < 0 ? 'bad' : ''}>{fmtMoney(c.finances.cash)}</b></div></div>
          <div className="hud-chip" title="How the owner/board rates you"><Icon name="owner" size={19} className="ic-owner" /><div><span>Owner</span><b className={tone(ap.board, 35, 65)}>{Math.round(ap.board)}</b></div></div>
          <div className="hud-chip" title="How the supporters rate you"><Icon name="fans" size={19} className="ic-fans" /><div><span>Fans</span><b className={tone(ap.fans, 30, 65)}>{Math.round(ap.fans)}</b></div></div>
          {nextF && opp && (
            <div className="hud-chip optional" title={nextF.label}>
              <Crest club={opp} size={26} />
              <div><span>Next · {fmtDate(w.season, nextF.day, false)}</span><b>{nextF.homeId === c.id ? 'vs' : '@'} {opp.abbrev}</b></div>
            </div>
          )}
        </>
      )}
      <div className="spacer" />
      <button type="button" className="btn ghost sm" onClick={() => window.dispatchEvent(new CustomEvent('bd-search'))} title="Search (Ctrl+K)" aria-label="Search"><Icon name="search" /></button>
      {w.gameOver ? (
        <Badge tone="bad">Game over</Badge>
      ) : (
        <div className="dropdown row gap4" ref={menuRef}>
          <button type="button" className="btn primary cta" onClick={() => go(c ? 'nextGame' : 'week')} title="Shift+Space">
            <span className="row gap4"><Icon name="play" size={18} /> {c ? 'Play next game' : 'Advance week'}</span>
          </button>
          <button type="button" className="btn" aria-label="More ways to advance time" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="chevronDown" size={18} /></button>
          <AnimatePresence>
            {open && (
              <motion.div className="dropdown-menu" role="menu" initial={{ opacity: 0, scale: 0.92, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -6 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                {MODES.map((m, i) => (
                  <motion.button role="menuitem" key={m.mode} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }} onClick={() => { setOpen(false); go(m.mode); }}>
                    <div className="row"><Icon name={m.icon} size={18} style={{ color: 'var(--electric)' }} /><div><div className="display" style={{ fontSize: '1.05rem' }}>{m.label}</div><div className="small muted">{m.desc}</div></div></div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  );
}

function Confetti() {
  const colors = ['#ff8a1f', '#36d1ff', '#ffd23f', '#34d399', '#f472b6'];
  return (
    <div className="burst" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        const d = 140 + (i % 5) * 40;
        return <i key={i} style={{ background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d - 60}px`, ['--rot' as string]: `${(i * 47) % 360}deg`, animationDelay: `${0.55 + (i % 6) * 0.02}s` } as React.CSSProperties} />;
      })}
    </div>
  );
}

function GameReveal({ f, idx }: { f: Fixture; idx: number }) {
  const w = useWorld();
  const nav = useNavigate();
  const close = useGame((s) => s.closeResults);
  const c = userClub(w)!;
  const us = f.homeId === c.id;
  const ours = us ? f.result!.home : f.result!.away;
  const theirs = us ? f.result!.away : f.result!.home;
  const opp = getClub(w, us ? f.awayId : f.homeId);
  const log = w.games.find((g) => g.id === f.result!.gameId);
  const mvp = log ? w.players.find((p) => p.id === log.mvpId) : null;
  const win = ours > theirs;
  const delay = idx * 0.35;
  return (
    <motion.div className="hero" style={{ ['--home-c' as string]: c.colors[0], ['--away-c' as string]: opp.colors[0], minHeight: 0, marginBottom: 12 } as unknown as MotionStyle} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      {win && <Confetti />}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="kicker">{f.label}{f.result!.ot ? ` · ${f.result!.ot}OT` : ''}</span>
        {log && <button type="button" className="btn sm" onClick={() => { close(); nav(`/game/${log.id}`); }}>Box score & analysis</button>}
      </div>
      <div className="row mt8" style={{ justifyContent: 'center', gap: 26 }}>
        <motion.div className="center" initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: delay + 0.05, type: 'spring', stiffness: 260, damping: 22 }}>
          <Crest club={c} size={84} />
          <div className="team-name mt8">{c.abbrev}</div>
        </motion.div>
        <div className="center">
          <div className="reveal-score"><CountUp value={ours} duration={0.8} /> <span style={{ opacity: 0.5 }}>–</span> <CountUp value={theirs} duration={0.8} /></div>
          <motion.div initial={{ scale: 2.6, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: delay + 0.75, type: 'spring', stiffness: 520, damping: 16 }} className="mt8">
            <span className={`stamp ${win ? 'win' : 'loss'}`}>{win ? 'WIN' : 'LOSS'}</span>
          </motion.div>
        </div>
        <motion.div className="center" initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: delay + 0.05, type: 'spring', stiffness: 260, damping: 22 }}>
          <Crest club={opp} size={84} />
          <div className="team-name mt8">{opp.abbrev}</div>
        </motion.div>
      </div>
      {log && (
        <div className="mt16 small" style={{ position: 'relative' }}>
          {mvp && <motion.div className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 1 }}>★ Player of the game: <b style={{ color: '#fff' }}>{playerName(mvp)}</b></motion.div>}
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {log.factors.slice(0, 3).map((x, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 1.1 + i * 0.12 }}>
                <span className={x.impact >= 0 ? 'good' : 'bad'}>{x.impact >= 0 ? '▲' : '▼'} {x.title}</span> <span className="muted">— {x.detail}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
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
    <Modal title={games.length ? (games.length === 1 ? 'Final score' : `${games.length} games played`) : `${res.days} day${res.days === 1 ? '' : 's'} later`} onClose={close} wide={games.length > 0}>
      {games.length > 0 && c && games.map((f, i) => <GameReveal key={f.id} f={f} idx={i} />)}
      {res.holds.length > 0 && (
        <div className="col">
          <h3>The clock stopped for</h3>
          {res.holds.slice(0, 8).map((h, i) => (
            <motion.div key={i} className="callout warn small" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>{h.message}</motion.div>
          ))}
        </div>
      )}
      <ModalFooter onToday={() => { close(); nav('/today'); }} />
    </Modal>
  );
}

function ModalFooter({ onToday }: { onToday: () => void }) {
  const closeAnimated = useModalClose();
  return (
    <div className="row mt16">
      <span className="spacer" />
      <Button onClick={onToday}>Go to Today</Button>
      <Button variant="primary" onClick={closeAnimated}>Continue</Button>
    </div>
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
      <input autoFocus aria-label="Search" placeholder="Player, club or staff… (Enter opens the first result)" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', fontSize: '1.15rem', padding: 10 }}
        onKeyDown={(e) => { if (e.key === 'Enter') { if (clubs[0]) go(`/clubs/${clubs[0].id}`); else if (players[0]) go(`/player/${players[0].id}`); } }} />
      <div className="col mt16">
        {clubs.map((c) => (
          <button type="button" key={`c${c.id}`} className="row link btn ghost" onClick={() => go(`/clubs/${c.id}`)}><Crest club={c} /> {c.name} <span className="muted small">{c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental'}</span></button>
        ))}
        {players.map((p) => (
          <button type="button" key={`p${p.id}`} className="row link btn ghost" onClick={() => go(`/player/${p.id}`)}>🏀 {p.firstName} {p.lastName} <span className="muted small">{p.pos} · {p.teamId != null ? getClub(w, p.teamId).abbrev : 'Free agent'}</span></button>
        ))}
        {staff.map((x) => (
          <div key={`s${x.id}`} className="row"><span>👔 {x.firstName} {x.lastName}</span> <span className="muted small">{x.role} · rating {x.rating} · {x.teamId != null ? getClub(w, x.teamId).abbrev : 'Available'}</span></div>
        ))}
        {s && !clubs.length && !players.length && !staff.length && <div className="muted">No results.</div>}
      </div>
    </Modal>
  );
}
