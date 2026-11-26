import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, type MotionStyle } from 'framer-motion';
import type { Club, Tactics, World } from '../../../engine/types';
import { club as getClub, fixture as getFixture, userClub, player as getPlayer } from '../../../engine/world';
import { startLiveFixture, playFixture } from '../../../engine/matchday';
import type { LiveGame as Engine, MinuteTick, PlayEvent } from '../../../engine/sim/game';
import { OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { fmtDate } from '../../../engine/calendar';
import { useAct, useGame, useWorld } from '../../store';
import { Badge, Button, Card, Crest, Pills, NumberField } from '../../components/ui';
import { Icon } from '../../art/icons';
import './live.css';

// One engine per fixture, kept across navigation so a game can be resumed.
const cache = new Map<number, Engine>();

const SPEEDS = [
  { id: '0.5', label: '½×' },
  { id: '1', label: '1×' },
  { id: '2', label: '2×' },
  { id: '4', label: '4×' },
];
const BASE_MS = 1150; // one game minute at 1×

interface PlayerInfo { id: number; name: string; pos: string; ovr: number }

export default function LiveGame() {
  const { id } = useParams();
  const w = useWorld();
  const f = getFixture(w, Number(id));
  const nav = useNavigate();
  if (!f || f.played) {
    return (
      <Card title="No live game">
        <p className="muted">This game has already been played. Its box score is in Results → Fixtures & Results.</p>
        <Button onClick={() => nav('/today')}>Back to Today</Button>
      </Card>
    );
  }
  return <LiveGameInner key={f.id} fixtureId={f.id} />;
}

function LiveGameInner({ fixtureId }: { fixtureId: number }) {
  const w = useWorld();
  const act = useAct();
  const nav = useNavigate();
  const setLive = useGame((s) => s.setLiveFixture);
  const advance = useGame((s) => s.advance);
  const notify = useGame((s) => s.notify);
  const f = getFixture(w, fixtureId);
  const uc = userClub(w)!;
  const home = getClub(w, f.homeId);
  const away = getClub(w, f.awayId);
  const usSide: 0 | 1 = f.homeId === uc.id ? 0 : 1;
  const engine = useMemo(() => {
    let e = cache.get(fixtureId);
    if (!e) {
      e = startLiveFixture(w, f);
      cache.set(fixtureId, e);
    }
    return e;
  }, [fixtureId, w, f]);

  const [shown, setShown] = useState(engine.timeline.length); // ticks revealed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [tactics, setTacticsState] = useState<Tactics>(() => ({ ...engine.teams[usSide].inp.tactics }));
  const [finishing, setFinishing] = useState(false);

  const totalTicks = engine.timeline.length;
  const periodDone = !playing && shown === totalTicks;
  const gameOver = engine.finished && shown >= totalTicks;
  const started = totalTicks > 0;

  // reveal one game minute per tick
  useEffect(() => {
    if (!playing) return;
    if (shown >= engine.timeline.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), BASE_MS / Number(speed));
    return () => clearTimeout(t);
  }, [playing, shown, speed, engine]);

  const playNextPeriod = () => {
    engine.setTactics(usSide, tactics);
    engine.playPeriod();
    setPlaying(true);
  };
  const simToEnd = () => {
    engine.setTactics(usSide, tactics);
    engine.playAll();
    setShown(engine.timeline.length);
    setPlaying(false);
  };
  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    engine.playAll();
    const log = act((ww) => playFixture(ww, getFixture(ww, fixtureId), engine));
    cache.delete(fixtureId);
    setLive(null);
    const [h, a] = engine.score();
    const ours = usSide === 0 ? h : a;
    const theirs = usSide === 0 ? a : h;
    notify(`${ours > theirs ? 'Win' : 'Defeat'}: ${ours}–${theirs}. The rest of the day is being simulated…`, ours > theirs ? 'good' : 'warn');
    await advance('day');
    nav(log ? `/game/${log.id}` : '/today');
  };

  const tick: MinuteTick | null = shown > 0 ? engine.timeline[shown - 1] : null;
  const [sh, sa] = tick ? [tick.h, tick.a] : [0, 0];
  const curPeriod = tick ? tick.period : 0;
  const periodLabel = (q: number) => (q < 4 ? `Q${q + 1}` : `OT${q - 3}`);
  const minuteInPeriod = tick ? tick.m - periodStartMinute(curPeriod) : 0;
  const periodMinutes = curPeriod < 4 ? 10 : 5;
  const atBreak = started && periodDone && !engine.finished;
  const clock = !tick ? '10:00' : `${String(Math.max(0, periodMinutes - minuteInPeriod)).padStart(2, '0')}:00`;
  const status = gameOver ? 'FINAL' : playing ? 'LIVE' : !started ? 'PRE-GAME' : atBreak ? (curPeriod === 1 ? 'HALFTIME' : `END ${periodLabel(curPeriod)}`) : 'PAUSED';

  const visibleEvents = engine.events.filter((e) => Math.ceil(Math.max(1, e.t) / 60) <= (tick?.m ?? 0));
  const infos = useMemo(() => [0, 1].map((side) => new Map(engine.teams[side].inp.players.map((p) => [p.id, { id: p.id, name: p.name, pos: p.pos, ovr: p.ovr } as PlayerInfo]))), [engine]);

  return (
    <div className="live">
      <Scoreboard home={home} away={away} h={sh} a={sa} status={status} period={tick ? periodLabel(curPeriod) : 'Q1'} clock={atBreak || gameOver ? '00:00' : clock} label={f.label} live={playing} day={fmtDate(w.season, f.day)} />

      <div className="live-controls row wrap">
        {!started && <Button variant="primary" onClick={playNextPeriod}><span className="row gap4"><Icon name="play" size={16} /> Tip-off</span></Button>}
        {atBreak && <Button variant="primary" onClick={playNextPeriod}><span className="row gap4"><Icon name="play" size={16} /> Play {periodLabel(engine.q)}</span></Button>}
        {playing && <Button onClick={() => setShown(engine.timeline.length)}>Skip to end of {periodLabel(curPeriod)}</Button>}
        {!gameOver && <Button onClick={simToEnd}>Sim to final</Button>}
        {gameOver && <Button variant="primary" onClick={finish} disabled={finishing}><span className="row gap4">Continue <Icon name="chevronRight" size={16} /></span></Button>}
        <span className="spacer" />
        <span className="small muted">Speed</span>
        <Pills value={speed} onChange={setSpeed} options={SPEEDS} />
      </div>

      {gameOver && <FinalPanel engine={engine} usSide={usSide} clubs={[home, away]} infos={infos} />}
      <AnimatePresence>
        {atBreak && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            <BreakPanel engine={engine} usSide={usSide} clubs={[home, away]} infos={infos} tactics={tactics} onTactics={(t) => { setTacticsState(t); act((ww) => { getClub(ww, uc.id).tactics = { ...getClub(ww, uc.id).tactics, ...t }; }); }} />
          </motion.div>
        )}
      </AnimatePresence>
      {!started && <PreGame w={w} engine={engine} home={home} away={away} usSide={usSide} />}

      {started && (
        <div className="live-grid">
          <div className="col gap16">
            <Card title="Game flow · lead by minute">
              <LeadChart engine={engine} shown={shown} home={home} away={away} />
            </Card>
            <Card title="Play-by-play">
              <Feed events={visibleEvents} infos={infos} clubs={[home, away]} />
            </Card>
          </div>
          <div className="col gap16">
            <Leaders tick={tick} engine={engine} infos={infos} clubs={[home, away]} />
            <QuarterTable engine={engine} shown={shown} home={home} away={away} />
          </div>
        </div>
      )}


    </div>
  );
}

function periodStartMinute(q: number) {
  return q < 4 ? q * 10 : 40 + (q - 4) * 5;
}

// ---------------------------------------------------------------- scoreboard
function Scoreboard({ home, away, h, a, status, period, clock, label, live, day }: { home: Club; away: Club; h: number; a: number; status: string; period: string; clock: string; label: string; live: boolean; day: string }) {
  return (
    <div className="sb" style={{ ['--hc' as string]: home.colors[0], ['--ac' as string]: away.colors[0] } as CSSProperties}>
      <div className="sb-meta">{label} · {day}</div>
      <div className="sb-row">
        <div className="sb-team home"><Crest club={home} size={64} /><div><div className="sb-name">{home.name}</div><div className="sb-abbr">{home.abbrev} · HOME</div></div></div>
        <div className="sb-center">
          <div className="sb-score"><Digit v={h} /><span className="sb-dash">–</span><Digit v={a} /></div>
          <div className="sb-clock"><span className={`sb-status ${live ? 'on' : ''}`}>{live && <i />}{status}</span><span>{period} · {clock}</span></div>
        </div>
        <div className="sb-team away"><div className="right"><div className="sb-name">{away.name}</div><div className="sb-abbr">AWAY · {away.abbrev}</div></div><Crest club={away} size={64} /></div>
      </div>
    </div>
  );
}

function Digit({ v }: { v: number }) {
  return (
    <span className="sb-digit">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={v} initial={{ y: -22, opacity: 0, scale: 1.3 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 22, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          {v}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ---------------------------------------------------------------- pre-game
function stars(engine: Engine, side: 0 | 1) {
  return [...engine.teams[side].inp.players].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
}

function PreGame({ w, engine, home, away, usSide }: { w: World; engine: Engine; home: Club; away: Club; usSide: 0 | 1 }) {
  const pct = Math.round(100 / (1 + Math.exp(-engine.preGameEdge / 6.5)));
  const ours = usSide === 0 ? pct : 100 - pct;
  return (
    <div className="grid g2 mt16">
      {[home, away].map((c, side) => (
        <Card key={c.id} title={`${c.abbrev} · stars to watch`}>
          <div className="col">
            {stars(engine, side as 0 | 1).map((p, i) => {
              const pl = getPlayer(w, p.id);
              return (
                <motion.div key={p.id} className="star-row" initial={{ opacity: 0, x: side ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                  <span className="star-ovr">{p.ovr}</span>
                  <div style={{ flex: 1 }}><b>{pl ? `${pl.firstName} ${pl.lastName}` : p.name}</b><div className="small muted">{p.pos} · {pl ? `${w.season - pl.born} yrs` : ''}</div></div>
                  <Icon name="bolt" size={16} style={{ color: 'var(--gold)' }} />
                </motion.div>
              );
            })}
          </div>
          <div className="small muted mt8">Plan: {OFF_LABEL[engine.teams[side].inp.tactics.off]} · {DEF_LABEL[engine.teams[side].inp.tactics.def]} · {engine.teams[side].inp.tactics.pace} pace</div>
        </Card>
      ))}
      <Card title="Pre-game" className="span2">
        <div className="row wrap">
          <span>Your win chance: <b className={ours >= 50 ? 'good' : 'bad'}>{ours}%</b></span>
          <span className="muted small">The game is played one quarter at a time. At every break you can change your systems, pace and emphasis for the next quarter.</span>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- lead chart
function LeadChart({ engine, shown, home, away }: { engine: Engine; shown: number; home: Club; away: Club }) {
  const W = 760, H = 210, padL = 34, padR = 10, padT = 12, padB = 24;
  const total = Math.max(40, engine.timeline.length, periodStartMinute(engine.periods));
  const pts = [{ m: 0, d: 0 }, ...engine.timeline.slice(0, shown).map((t) => ({ m: t.m, d: t.h - t.a }))];
  const maxAbs = Math.max(8, ...pts.map((p) => Math.abs(p.d)));
  const scale = Math.ceil(maxAbs / 5) * 5;
  const x = (m: number) => padL + (m / total) * (W - padL - padR);
  const y = (d: number) => padT + ((scale - d) / (2 * scale)) * (H - padT - padB);
  const line = pts.map((p) => `${x(p.m)},${y(p.d)}`).join(' ');
  const area = `${x(0)},${y(0)} ${line} ${x(pts[pts.length - 1].m)},${y(0)}`;
  const periods = Array.from({ length: engine.periods }, (_, q) => q);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lead-chart" role="img" aria-label={`Lead by minute. Above the line ${home.name} lead, below ${away.name}.`}>
      <defs>
        <clipPath id="lc-top"><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
        <clipPath id="lc-bot"><rect x="0" y={y(0)} width={W} height={H} /></clipPath>
      </defs>
      {[scale, scale / 2, -scale / 2, -scale].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e8f0ff" strokeOpacity=".07" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="lc-axis">+{Math.abs(t)}</text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#e8f0ff" strokeOpacity=".3" />
      {periods.map((q) => (
        <g key={q}>
          {q > 0 && <line x1={x(periodStartMinute(q))} x2={x(periodStartMinute(q))} y1={padT} y2={H - padB} stroke="#e8f0ff" strokeOpacity=".15" strokeDasharray="3 5" />}
          <text x={x(periodStartMinute(q) + (q < 4 ? 5 : 2.5))} y={H - 7} textAnchor="middle" className="lc-axis">{q < 4 ? `Q${q + 1}` : `OT${q - 3}`}</text>
        </g>
      ))}
      <polygon points={area} fill={home.colors[0]} fillOpacity=".45" clipPath="url(#lc-top)" />
      <polygon points={area} fill={away.colors[0]} fillOpacity=".45" clipPath="url(#lc-bot)" />
      <polyline points={line} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      {shown < total && <rect x={x(last.m)} y={padT} width={Math.max(0, x(total) - x(last.m))} height={H - padT - padB} fill="#020814" fillOpacity=".45" />}
      <circle cx={x(last.m)} cy={y(last.d)} r="5" fill="#fff" className="lc-now" />
      <text x={padL + 4} y={padT + 12} className="lc-axis" fill="#fff">{home.abbrev} ahead</text>
      <text x={padL + 4} y={H - padB - 6} className="lc-axis" fill="#fff">{away.abbrev} ahead</text>
    </svg>
  );
}

// ---------------------------------------------------------------- feed
function describe(e: PlayEvent, infos: Map<number, PlayerInfo>[], clubs: Club[]): { text: string; big: boolean } {
  const who = (side: number, id?: number) => (id != null ? infos[side]?.get(id)?.name ?? infos[1 - side]?.get(id)?.name ?? '?' : '');
  const team = e.side >= 0 ? clubs[e.side].abbrev : '';
  const ast = e.assistId != null ? ` (assist ${who(e.side, e.assistId)})` : '';
  switch (e.kind) {
    case 'three': return { text: `${who(e.side, e.playerId)} drills a three${ast}`, big: true };
    case 'layup': return { text: `${who(e.side, e.playerId)} finishes at the rim${ast}`, big: false };
    case 'jumper': return { text: `${who(e.side, e.playerId)} knocks down the jumper${ast}`, big: false };
    case 'and1': return { text: `${who(e.side, e.playerId)} scores and the foul — AND ONE!${ast}`, big: true };
    case 'ft': return { text: `${who(e.side, e.playerId)} makes ${e.pts} from the line`, big: false };
    case 'steal': return { text: `${who(e.side, e.playerId)} picks his pocket — steal!`, big: false };
    case 'block': return { text: `${who(e.side, e.playerId)} sends it back — block!`, big: true };
    case 'timeout': return { text: `${team} call a timeout to stop the bleeding`, big: false };
    case 'run': return { text: `${team} on an ${e.pts}–0 run!`, big: true };
    case 'injury': return { text: `${who(e.side, e.playerId)} goes down and heads to the locker room`, big: true };
    case 'period': return { text: e.pts === 1 ? 'Halftime' : `End of ${e.pts < 4 ? `Q${e.pts + 1}` : `OT${e.pts - 3}`}`, big: true };
  }
}

function Feed({ events, infos, clubs }: { events: PlayEvent[]; infos: Map<number, PlayerInfo>[]; clubs: Club[] }) {
  const recent = events.slice(-40).reverse();
  return (
    <div className="feed">
      <AnimatePresence initial={false}>
        {recent.map((e) => {
          const d = describe(e, infos, clubs);
          const c = e.side >= 0 ? clubs[e.side] : null;
          const min = Math.ceil(e.t / 60);
          return (
            <motion.div key={`${e.t}-${e.kind}-${e.playerId ?? ''}-${e.score.join('-')}`} className={`feed-row ${d.big ? 'big' : ''} ${e.kind === 'period' ? 'period' : ''}`} style={{ ['--tc' as string]: c?.colors[0] ?? '#334' } as unknown as MotionStyle} initial={{ opacity: 0, height: 0, backgroundColor: 'rgba(255,138,31,0.25)' }} animate={{ opacity: 1, height: 'auto', backgroundColor: 'rgba(255,138,31,0)' }} transition={{ duration: 0.4 }}>
              <span className="feed-min">{min}'</span>
              {c && <Crest club={c} size={22} />}
              <span className="feed-text">{d.text}</span>
              {e.pts > 0 && e.kind !== 'run' && e.kind !== 'period' && <Badge tone="accent">+{e.pts}</Badge>}
              <span className="feed-score num">{e.score[0]}–{e.score[1]}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {!recent.length && <div className="muted small">Tip-off…</div>}
    </div>
  );
}

// ---------------------------------------------------------------- leaders
function Leaders({ tick, engine, infos, clubs }: { tick: MinuteTick | null; engine: Engine; infos: Map<number, PlayerInfo>[]; clubs: Club[] }) {
  const rows = tick
    ? [0, 1].flatMap((side) => engine.roster(side as 0 | 1).map((id, i) => ({ side, id, pts: tick.lines[side][i][0], reb: tick.lines[side][i][1], ast: tick.lines[side][i][2] })))
    : [];
  const groups: { key: 'pts' | 'reb' | 'ast'; label: string }[] = [{ key: 'pts', label: 'Points' }, { key: 'reb', label: 'Rebounds' }, { key: 'ast', label: 'Assists' }];
  return (
    <Card title="Game leaders · live">
      <div className="col">
        {groups.map((g) => {
          const top = [...rows].sort((a, b) => b[g.key] - a[g.key]).slice(0, 3);
          const max = Math.max(1, top[0]?.[g.key] ?? 1);
          return (
            <div key={g.key}>
              <h3 className="mb8">{g.label}</h3>
              {top.map((r) => (
                <motion.div layout key={`${g.key}-${r.id}`} className="leader-row" style={{ ['--tc' as string]: clubs[r.side].colors[0] } as unknown as MotionStyle}>
                  <Crest club={clubs[r.side]} size={20} />
                  <span style={{ flex: 1 }}>{infos[r.side].get(r.id)?.name}<i className="leader-bar"><b style={{ width: `${(r[g.key] / max) * 100}%` }} /></i></span>
                  <b className="display" style={{ fontSize: '1.3rem' }}>{r[g.key]}</b>
                </motion.div>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function QuarterTable({ engine, shown, home, away }: { engine: Engine; shown: number; home: Club; away: Club }) {
  const n = engine.periods;
  const at = (q: number) => {
    const endM = periodStartMinute(q + 1);
    const startM = periodStartMinute(q);
    if (shown <= startM) return null;
    const end = engine.timeline[Math.min(shown, endM) - 1];
    const start = startM > 0 ? engine.timeline[startM - 1] : { h: 0, a: 0 };
    return { h: end.h - start.h, a: end.a - start.a };
  };
  return (
    <Card title="By quarter">
      <table className="tbl">
        <thead><tr><th>Team</th>{Array.from({ length: n }, (_, q) => <th key={q} className="r">{q < 4 ? `Q${q + 1}` : `OT${q - 3}`}</th>)}</tr></thead>
        <tbody>
          {[home, away].map((c, side) => (
            <tr key={c.id}><td>{c.abbrev}</td>{Array.from({ length: n }, (_, q) => { const v = at(q); return <td key={q} className="r">{v ? (side === 0 ? v.h : v.a) : '–'}</td>; })}</tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ---------------------------------------------------------------- break: adjust tactics
function BreakPanel({ engine, usSide, clubs, infos, tactics, onTactics }: { engine: Engine; usSide: 0 | 1; clubs: Club[]; infos: Map<number, PlayerInfo>[]; tactics: Tactics; onTactics: (t: Tactics) => void }) {
  const energy = engine.energy(usSide);
  const fouls = engine.fouls(usSide);
  const court = new Set(engine.onCourt(usSide));
  const ids = engine.roster(usSide).slice(0, 10);
  const set = (p: Partial<Tactics>) => onTactics({ ...tactics, ...p });
  return (
    <Card title={`Break · adjust for ${engine.q < 4 ? `Q${engine.q + 1}` : `OT${engine.q - 3}`}`} className="hot mt16">
      <div className="grid g2">
        <div className="col">
          <div className="row wrap"><span className="muted small" style={{ width: 90 }}>Offence</span><Pills value={tactics.off} onChange={(v) => set({ off: v })} options={(Object.keys(OFF_LABEL) as Tactics['off'][]).map((k) => ({ id: k, label: OFF_LABEL[k] }))} /></div>
          <div className="row wrap"><span className="muted small" style={{ width: 90 }}>Defence</span><Pills value={tactics.def} onChange={(v) => set({ def: v })} options={(Object.keys(DEF_LABEL) as Tactics['def'][]).map((k) => ({ id: k, label: DEF_LABEL[k] }))} /></div>
          <div className="row wrap"><span className="muted small" style={{ width: 90 }}>Pace</span><Pills value={tactics.pace} onChange={(v) => set({ pace: v })} options={[{ id: 'slow', label: 'Slow' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Fast' }]} /></div>
          <div className="row"><span className="muted small" style={{ width: 90 }}>3-pt emphasis</span><NumberField label="Three-point emphasis" value={tactics.threeEmphasis} min={-2} max={2} step={1} width={52} onChange={(v) => set({ threeEmphasis: v })} /></div>
          <div className="row"><span className="muted small" style={{ width: 90 }}>Rebounding</span><NumberField label="Rebound emphasis" value={tactics.reboundEmphasis} min={-2} max={2} step={1} width={52} onChange={(v) => set({ reboundEmphasis: v })} /></div>
          <div className="row"><span className="muted small" style={{ width: 90 }}>Feed the star</span><NumberField label="Star usage" value={tactics.starUsage} min={-2} max={2} step={1} width={52} onChange={(v) => set({ starUsage: v })} /></div>
          <div className="small faint">Changes apply from the next quarter and are kept as your club's game plan.</div>
        </div>
        <div>
          <h3 className="mb8">{clubs[usSide].abbrev} · energy & fouls</h3>
          {ids.map((id) => {
            const e = Math.round((energy.get(id) ?? 1) * 100);
            const fl = fouls.get(id) ?? 0;
            return (
              <div key={id} className="row small" style={{ padding: '3px 0' }}>
                <span style={{ width: 150 }}>{court.has(id) ? '● ' : ''}{infos[usSide].get(id)?.name}</span>
                <span className="bar" style={{ flex: 1 }}><div style={{ width: `${e}%`, background: e > 80 ? 'var(--good)' : e > 65 ? 'var(--warn)' : 'var(--bad)' }} /></span>
                <span style={{ width: 36 }} className="num right">{e}%</span>
                <span style={{ width: 50 }} className={fl >= 4 ? 'bad' : 'muted'}>{fl} PF</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- final
function FinalPanel({ engine, usSide, clubs, infos }: { engine: Engine; usSide: 0 | 1; clubs: Club[]; infos: Map<number, PlayerInfo>[] }) {
  const [h, a] = engine.score();
  const win = usSide === 0 ? h > a : a > h;
  const res = engine.result();
  const all = [0, 1].flatMap((side) => res.teams[side].players.map((p) => ({ side, ...p })));
  const winSide = h > a ? 0 : 1;
  const mvp = all.filter((p) => p.side === winSide).sort((x, y) => (y.pts + (y.orb + y.drb) * 0.7 + y.ast) - (x.pts + (x.orb + x.drb) * 0.7 + x.ast))[0];
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div ref={ref} className="final-card mt16" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} style={{ ['--wc' as string]: clubs[winSide].colors[0] } as unknown as MotionStyle}>
      {win && <div className="burst" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => { const ang = (i / 30) * Math.PI * 2; return <i key={i} style={{ background: ['#ff8a1f', '#36d1ff', '#ffd23f', '#34d399'][i % 4], ['--dx' as string]: `${Math.cos(ang) * 260}px`, ['--dy' as string]: `${Math.sin(ang) * 160 - 40}px`, ['--rot' as string]: `${i * 37}deg`, animationDelay: `${0.2 + (i % 5) * 0.03}s` } as CSSProperties} />; })}</div>}
      <div className="row" style={{ justifyContent: 'center', gap: 20 }}>
        <Crest club={clubs[winSide]} size={90} />
        <div>
          <div className="kicker">Final{engine.ot ? ` · ${engine.ot}OT` : ''}</div>
          <div className="display" style={{ fontSize: '2.6rem', lineHeight: 1 }}>{clubs[winSide].name} win</div>
          <div className="reveal-score" style={{ fontSize: '3rem' }}>{h} – {a}</div>
        </div>
        <motion.span className={`stamp ${win ? 'win' : 'loss'}`} initial={{ scale: 2.4, opacity: 0, rotate: -16 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ delay: 0.35, type: 'spring', stiffness: 500, damping: 15 }}>{win ? 'WIN' : 'LOSS'}</motion.span>
      </div>
      {mvp && <div className="center mt8">★ MVP <b>{infos[mvp.side].get(mvp.playerId)?.name}</b> — {mvp.pts} PTS · {mvp.orb + mvp.drb} REB · {mvp.ast} AST</div>}
      <div className="center small muted mt8">Press Continue to apply the result and see the full box score and the "why we won/lost" analysis.</div>
    </motion.div>
  );
}
