import { useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../art/icons';
import { Link } from 'react-router-dom';
import type { Fixture } from '../../engine/types';
import { buildCalendar, dateOf, seasonLength, fmtDate, seasonLabel } from '../../engine/calendar';
import { club as getClub, userClub, fmtMoney } from '../../engine/world';
import { friendlyQuote, scheduleFriendly, cancelFriendly, friendliesThisSeason, MAX_FRIENDLIES } from '../../engine/extras';
import { useAct, useNotify } from '../store';
import { EVENT_KINDS, EVENT_OPTIONS, cancelEvent, eventBlocked, eventCost, eventLabel, eventsOn, planEvent } from '../../engine/clubEvents';
import type { EventKind } from '../../engine/types';
import { Crest, Modal, Pills } from '../components/ui';
import type { World } from '../../engine/types';
import { useWorld } from '../store';
import { Banner } from '../art/Banner';
import { Badge, Button, Card, Page } from '../components/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Marker { label: string; tone: 'info' | 'warn' | 'good' | 'accent' | 'bad' }

export default function CalendarScreen() {
  const w = useWorld();
  const cal = buildCalendar(w.season);
  const today = dateOf(w.season, w.day);
  // month offset relative to July of the season (0..11)
  const [offset, setOffset] = useState(() => (today.getUTCMonth() + 12 - 6) % 12);
  const [friendlyDay, setFriendlyDay] = useState<number | null>(null);
  const [planDay, setPlanDay] = useState<number | null>(null);
  const [eventKind, setEventKind] = useState<{ kind: EventKind; day: number } | null>(null);
  const act = useAct();
  const notify = useNotify();
  const year = w.season + (offset >= 6 ? 1 : 0);
  const month = (6 + offset) % 12;
  const uid = w.user.clubId;

  const markers = new Map<number, Marker[]>();
  const mark = (day: number, m: Marker) => { const a = markers.get(day) ?? []; a.push(m); markers.set(day, a); };
  mark(0, { label: 'Season starts · window opens', tone: 'accent' });
  mark(cal.summerWindowClose, { label: 'Summer window closes', tone: 'warn' });
  mark(cal.seasonTicketDeadline, { label: 'Season tickets close', tone: 'info' });
  mark(cal.leagueRoundDays[0], { label: 'League tip-off', tone: 'accent' });
  mark(cal.winterWindowOpen, { label: 'Winter window opens', tone: 'info' });
  mark(cal.winterWindowClose, { label: 'Winter window closes', tone: 'warn' });
  mark(cal.cupDays.qf[0], { label: 'Copa del Rey week', tone: 'accent' });
  mark(cal.faDeadline, { label: 'Registration deadline', tone: 'warn' });
  mark(cal.playoffStart, { label: 'Playoffs begin', tone: 'accent' });
  mark(cal.euroF4Days.sf, { label: 'EuroCup Final Four', tone: 'accent' });
  mark(cal.youthIntake, { label: 'Youth intake', tone: 'good' });
  mark(cal.seasonEnd, { label: 'Season end · promotion & relegation', tone: 'accent' });
  mark(cal.jobMarket, { label: 'Executive job market', tone: 'info' });

  const myFixtures = new Map<number, Fixture[]>();
  if (uid != null) {
    for (const f of w.fixtures) {
      if (f.cancelled || (f.homeId !== uid && f.awayId !== uid)) continue;
      if (Number(f.compId.split('-').pop()) !== w.season) continue;
      const a = myFixtures.get(f.day) ?? [];
      a.push(f);
      myFixtures.set(f.day, a);
    }
  }

  // grid cells
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = Math.round((first.getTime() - Date.UTC(w.season, 6, 1)) / 86400000);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => startDay + i)];
  while (cells.length % 7) cells.push(null);

  const upcoming = [...myFixtures.entries()].filter(([d]) => d >= w.day).sort((a, b) => a[0] - b[0]).slice(0, 8);
  const keyDates = [...markers.entries()].filter(([d]) => d >= w.day && d < seasonLength(w.season)).sort((a, b) => a[0] - b[0]).slice(0, 8);

  return (
    <Page title="Calendar" subtitle={`Season ${seasonLabel(w.season)}`} actions={uid != null && <Button variant="primary" onClick={() => setPlanDay(w.day + 2)}>Plan something…</Button>}>
      <Banner which="calendar" className="page-banner" />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <Card
          title={`${MONTHS[month]} ${year}`}
          actions={
            <div className="row gap4">
              <Button size="sm" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>‹</Button>
              <Button size="sm" onClick={() => setOffset((today.getUTCMonth() + 6) % 12)}>Today</Button>
              <Button size="sm" disabled={offset === 11} onClick={() => setOffset(offset + 1)}>›</Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {WD.map((d) => <div key={d} className="small muted center">{d}</div>)}
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const isToday = d === w.day;
              const fx = myFixtures.get(d) ?? [];
              const mk = markers.get(d) ?? [];
              return (
                <div key={i} role={uid != null && d > w.day ? 'button' : undefined} tabIndex={uid != null && d > w.day ? 0 : undefined} title={uid != null && d > w.day ? 'Click to plan a friendly or an event on this day' : undefined} onClick={() => uid != null && d > w.day && !fx.length && setPlanDay(d)} onKeyDown={(e) => { if (e.key === 'Enter' && uid != null && d > w.day && !fx.length) setPlanDay(d); }} className="cal-day" style={{ cursor: uid != null && d > w.day && !fx.length ? 'pointer' : undefined, minHeight: 84, background: d < w.day ? 'var(--bg2)' : 'var(--panel2)', border: `1px solid ${isToday ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 8, padding: 5, opacity: d < w.day ? 0.75 : 1 }}>
                  <div className="small" style={{ fontWeight: isToday ? 800 : 500 }}>{dateOf(w.season, d).getUTCDate()}</div>
                  {fx.map((f) => <FixtureChip key={f.id} f={f} uid={uid!} />)}
                  {eventsOn(w, d).map((e) => <div key={e.id} className="small" style={{ marginTop: 3, borderLeft: '3px solid #34d399', paddingLeft: 4, lineHeight: 1.2 }} title={e.result ?? eventLabel(e)}>{eventLabel(e)}</div>)}
                  {mk.map((m, j) => <div key={j} className={`badge ${m.tone}`} style={{ fontSize: 10, marginTop: 3, whiteSpace: 'normal' }}>{m.label}</div>)}
                </div>
              );
            })}
          </div>
        </Card>
        <div className="col gap16">
          <Card title="Upcoming games">
            {upcoming.length === 0 ? <div className="muted small">No upcoming games.</div> : (
              <div className="list">
                {upcoming.map(([d, fs]) => fs.map((f) => {
                  const opp = getClub(w, f.homeId === uid ? f.awayId : f.homeId);
                  return (
                    <div key={f.id} className="list-item">
                      <div className="row"><b>{f.homeId === uid ? 'vs' : '@'} {opp.name}</b><span className="spacer" /><span className="small muted">{fmtDate(w.season, d)}</span></div>
                      <div className="small muted row">{f.label}{f.comp === 'friendly' && <button type="button" className="btn ghost sm" onClick={() => { const r = act((ww) => cancelFriendly(ww, f)); notify(r.message); }}>Cancel</button>}</div>
                    </div>
                  );
                }))}
              </div>
            )}
          </Card>
          {uid != null && <PlannedEvents />}
          <Card title="Key dates">
            <div className="list">
              {keyDates.map(([d, ms]) => (
                <div key={d} className="list-item row">
                  <span className="small muted" style={{ minWidth: 110 }}>{fmtDate(w.season, d)}</span>
                  <span className="small">{ms.map((m) => m.label).join(' · ')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {friendlyDay != null && uid != null && <FriendlyModal w={w} day={friendlyDay} onClose={() => setFriendlyDay(null)} />}
      {planDay != null && uid != null && <PlanMenu day={planDay} onClose={() => setPlanDay(null)} onFriendly={() => { setFriendlyDay(planDay); setPlanDay(null); }} onEvent={(k) => { setEventKind({ kind: k, day: planDay }); setPlanDay(null); }} />}
      {eventKind && uid != null && <EventModal kind={eventKind.kind} day={eventKind.day} onClose={() => setEventKind(null)} />}
    </Page>
  );
}

export function FriendlyModal({ w, day: initialDay, onClose }: { w: World; day: number; onClose: () => void }) {
  const act = useAct();
  const notify = useNotify();
  const uc = userClub(w)!;
  const [day, setDay] = useState(initialDay);
  const [home, setHome] = useState<'home' | 'away'>('home');
  const [q, setQ] = useState('');
  const [oppId, setOppId] = useState<number | null>(null);
  const candidates = useMemo(() => w.clubs.filter((c) => c.id !== uc.id && `${c.name} ${c.city}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Math.abs(a.prestige - uc.prestige) - Math.abs(b.prestige - uc.prestige)).slice(0, 14), [w, uc, q]);
  const opp = oppId != null ? getClub(w, oppId) : null;
  const quote = opp ? friendlyQuote(w, uc, opp, day, home === 'home') : null;
  const used = friendliesThisSeason(w, uc.id).length;
  return (
    <Modal title="Arrange a friendly" onClose={onClose} wide>
      <p className="small muted">Friendlies build squad chemistry and let you test your rotation, but carry injury and fatigue risk. They don't count for standings, records or fan mood. {used}/{MAX_FRIENDLIES} arranged this season.</p>
      <div className="row wrap mt8">
        <label className="field">Date
          <span className="row gap4">
            <Button size="sm" onClick={() => setDay(Math.max(w.day + 1, day - 1))}>‹</Button>
            <b className="display" style={{ minWidth: 150, textAlign: 'center' }}>{fmtDate(w.season, day)}</b>
            <Button size="sm" onClick={() => setDay(day + 1)}>›</Button>
          </span>
        </label>
        <label className="field">Venue<Pills value={home} onChange={setHome} options={[{ id: 'home', label: 'At home' }, { id: 'away', label: 'Away' }]} /></label>
        <label className="field" style={{ flex: 1 }}>Opponent<input placeholder="Search clubs…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="grid g2 mt16" style={{ gap: 8 }}>
        {candidates.map((c) => {
          const qq = friendlyQuote(w, uc, c, day, home === 'home');
          return (
            <button key={c.id} type="button" className={`tile ${oppId === c.id ? 'hot' : ''}`} style={{ minHeight: 0, flexDirection: 'row', alignItems: 'center', border: oppId === c.id ? '1px solid var(--accent)' : undefined, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={() => setOppId(c.id)}>
              <Crest club={c} size={36} />
              <div style={{ flex: 1 }}>
                <b>{c.name}</b>
                <div className="small muted">{c.leagueId ? w.rules.leagues[c.leagueId].name : 'Continental'} · prestige {c.prestige}</div>
              </div>
              <Badge tone={qq.ok ? (qq.fee > 0 ? 'warn' : 'good') : 'bad'}>{qq.ok ? (qq.fee > 0 ? `Fee ${fmtMoney(qq.fee)}` : qq.fee < 0 ? `They pay ${fmtMoney(-qq.fee)}` : 'Available') : 'No'}</Badge>
            </button>
          );
        })}
      </div>
      {opp && quote && (
        <div className={`callout ${quote.ok ? 'good' : 'bad'} mt16`}>
          <b>{opp.name}</b>: {quote.ok ? quote.note : quote.reason}
        </div>
      )}
      <div className="row mt16">
        <span className="spacer" />
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" disabled={!opp || !quote?.ok} onClick={() => {
          const r = act((ww) => scheduleFriendly(ww, getClub(ww, uc.id), getClub(ww, opp!.id), day, home === 'home'));
          notify(r.message, r.ok ? 'good' : 'bad');
          if (r.ok) onClose();
        }}>Arrange friendly</Button>
      </div>
    </Modal>
  );
}

function FixtureChip({ f, uid }: { f: Fixture; uid: number }) {
  const w = useWorld();
  const home = f.homeId === uid;
  const opp = getClub(w, home ? f.awayId : f.homeId);
  const tone = f.comp === 'friendly' ? '#94a3b8' : f.comp === 'euro' ? '#a78bfa' : f.comp === 'cup' ? '#f472b6' : f.comp === 'league' ? 'var(--accent2)' : 'var(--accent)';
  let res = '';
  let win: boolean | null = null;
  if (f.result) {
    const ours = home ? f.result.home : f.result.away;
    const theirs = home ? f.result.away : f.result.home;
    win = ours > theirs;
    res = ` ${win ? 'W' : 'L'} ${ours}-${theirs}`;
  }
  const content = (
    <div className="small" style={{ marginTop: 3, borderLeft: `3px solid ${tone}`, paddingLeft: 4, lineHeight: 1.2 }} title={f.label}>
      {home ? 'vs' : '@'} {opp.abbrev}
      {res && <span className={win ? 'good' : 'bad'}>{res}</span>}
    </div>
  );
  return f.result?.gameId ? <Link to={`/game/${f.result.gameId}`}>{content}</Link> : content;
}

const KIND_ICON: Record<EventKind, IconName> = { team: 'team', fans: 'fans', sponsor: 'coin', board: 'board' };
const ic = (n: IconName) => <Icon name={n} size={18} />;

function PlanMenu({ day, onClose, onFriendly, onEvent }: { day: number; onClose: () => void; onFriendly: () => void; onEvent: (k: EventKind) => void }) {
  const w = useWorld();
  const cal = buildCalendar(w.season);
  const campOpen = w.day < cal.leagueRoundDays[0] - 10;
  const tile = (key: string, icon: ReactNode, title: string, desc: string, onClick: () => void, extra?: string) => (
    <button key={key} type="button" className="tile" style={{ minHeight: 0, alignItems: 'flex-start', textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={onClick}>
      <b>{icon} {title}</b>
      <span className="small muted">{desc}</span>
      {extra && <span className="small warn">{extra}</span>}
    </button>
  );
  return (
    <Modal title={`Plan something · ${fmtDate(w.season, day)}`} onClose={onClose} wide>
      <div className="grid g2" style={{ gap: 10 }}>
        {tile('friendly', ic('whistle'), 'Friendly game', 'Match shape and chemistry, against a club you pick. Some injury and fatigue risk.', onFriendly)}
        {campOpen ? (
          <Link to="/team/preseason" className="tile" style={{ minHeight: 0, alignItems: 'flex-start', color: 'inherit' }} onClick={onClose}>
            <b>{ic('training')} Training camp</b>
            <span className="small muted">Twelve destinations, from a cheap week nearby to a high-performance centre abroad.</span>
          </Link>
        ) : tile('camp', ic('training'), 'Training camp', 'Only in the summer, before the league starts.', () => undefined, 'Closed for this season')}
        {EVENT_KINDS.map((k) => tile(k.id, ic(KIND_ICON[k.id]), k.label, k.desc, () => onEvent(k.id)))}
      </div>
    </Modal>
  );
}

function EventModal({ kind, day: initialDay, onClose }: { kind: EventKind; day: number; onClose: () => void }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const uc = userClub(w)!;
  const options = EVENT_OPTIONS.filter((o) => o.kind === kind);
  const [day, setDay] = useState(initialDay);
  const [opt, setOpt] = useState(options[0].id);
  const [sponsorId, setSponsorId] = useState<number | undefined>(uc.sponsors[0]?.id);
  const o = options.find((x) => x.id === opt)!;
  const blocked = eventBlocked(w, uc, day, kind, kind === 'sponsor' ? sponsorId : undefined) ?? (kind === 'sponsor' && !uc.sponsors.length ? 'You have no sponsors yet: sign one in Sponsors & TV.' : null);
  const cost = eventCost(w, uc, o);
  const deal = uc.sponsors.find((s) => s.id === sponsorId);
  const meta = EVENT_KINDS.find((k) => k.id === kind)!;
  return (
    <Modal title={meta.label} onClose={onClose} wide>
      <p className="small muted">{meta.desc}</p>
      <div className="row wrap mt8">
        <label className="field">Date
          <span className="row gap4">
            <Button size="sm" onClick={() => setDay(Math.max(w.day + 1, day - 1))}>‹</Button>
            <b className="display" style={{ minWidth: 150, textAlign: 'center' }}>{fmtDate(w.season, day)}</b>
            <Button size="sm" onClick={() => setDay(day + 1)}>›</Button>
          </span>
        </label>
        {kind === 'sponsor' && uc.sponsors.length > 0 && (
          <label className="field">Partner
            <select value={sponsorId} onChange={(e) => setSponsorId(Number(e.target.value))}>
              {uc.sponsors.map((s) => <option key={s.id} value={s.id}>{s.brand} ({fmtMoney(s.annual)}/yr)</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="grid g2 mt16" style={{ gap: 8 }}>
        {options.map((x) => (
          <button key={x.id} type="button" className={`tile ${opt === x.id ? 'hot' : ''}`} style={{ minHeight: 0, alignItems: 'flex-start', textAlign: 'left', color: 'inherit', font: 'inherit', border: opt === x.id ? '1px solid var(--accent)' : undefined }} onClick={() => setOpt(x.id)}>
            <span className="row" style={{ width: '100%' }}><b>{x.label}</b><span className="spacer" /><Badge>{eventCost(w, uc, x) ? fmtMoney(eventCost(w, uc, x)) : 'Free'}</Badge></span>
            <span className="small muted">{x.desc}</span>
            <span className="small">Pleases: <b>{x.pleases}</b></span>
          </button>
        ))}
      </div>
      <div className="callout mt16">
        <b>{o.label}</b>{deal && kind === 'sponsor' ? ` with ${deal.brand}` : ''} · {cost ? `costs ${fmtMoney(cost)}` : 'no cost'}
        <ul className="small" style={{ margin: '6px 0 0 18px' }}>{o.effects.map((e) => <li key={e}>{e}{deal && /yearly deal/.test(e) ? ` (≈ ${fmtMoney(Math.round((deal.annual * Number(e.match(/(\d+)%/)?.[1] ?? 0)) / 100))})` : ''}</li>)}</ul>
        {o.risk && <div className="small warn mt8">Risk: {o.risk}</div>}
      </div>
      {blocked && <div className="callout bad mt8">{blocked}</div>}
      <div className="row mt16">
        <span className="spacer" />
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" disabled={!!blocked} onClick={() => { const r = act((ww) => planEvent(ww, o.id, day, kind === 'sponsor' ? sponsorId : undefined)); notify(r.message, r.ok ? 'good' : 'bad'); if (r.ok) onClose(); }}>Plan event</Button>
      </div>
    </Modal>
  );
}

function PlannedEvents() {
  const w = useWorld();
  const act = useAct();
  const evs = (w.user.events ?? []).filter((e) => e.season === w.season && e.status !== 'cancelled').sort((a, b) => a.day - b.day);
  const next = evs.filter((e) => e.status === 'planned');
  const done = evs.filter((e) => e.status === 'done').slice(-3).reverse();
  return (
    <Card title="Club events">
      {next.length === 0 && done.length === 0 && <div className="small muted">Nothing planned. Click a free day to plan a friendly, a team night out, a fan event or a sponsor activation.</div>}
      <div className="list">
        {next.map((e) => (
          <div key={e.id} className="list-item row">
            <div style={{ flex: 1 }}><b>{eventLabel(e)}</b><div className="small muted">{fmtDate(w.season, e.day)}{e.sponsorId != null ? ` · ${userClub(w)?.sponsors.find((s) => s.id === e.sponsorId)?.brand ?? ''}` : ''}{e.cost ? ` · ${fmtMoney(e.cost)}` : ''}</div></div>
            <Button size="sm" variant="ghost" onClick={() => act((ww) => cancelEvent(ww, e.id))}>Cancel</Button>
          </div>
        ))}
        {done.map((e) => (
          <div key={e.id} className="list-item"><b>{eventLabel(e)}</b> <span className="small muted">· {fmtDate(w.season, e.day)}</span><div className="small">{e.result}</div></div>
        ))}
      </div>
    </Card>
  );
}

export { Badge };
