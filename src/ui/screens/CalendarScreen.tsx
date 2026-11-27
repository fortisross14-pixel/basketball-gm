import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Fixture } from '../../engine/types';
import { buildCalendar, dateOf, seasonLength, fmtDate, seasonLabel } from '../../engine/calendar';
import { club as getClub, userClub, fmtMoney } from '../../engine/world';
import { friendlyQuote, scheduleFriendly, cancelFriendly, friendliesThisSeason, MAX_FRIENDLIES } from '../../engine/extras';
import { useAct, useNotify } from '../store';
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
  mark(cal.cupDays.qf[0], { label: 'Copa week', tone: 'accent' });
  mark(cal.faDeadline, { label: 'Registration deadline', tone: 'warn' });
  mark(cal.playoffStart, { label: 'Playoffs begin', tone: 'accent' });
  mark(cal.euroF4Days.sf, { label: 'Continental Final Four', tone: 'accent' });
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
    <Page title="Calendar" subtitle={`Season ${seasonLabel(w.season)}`} actions={uid != null && <Button variant="primary" onClick={() => setFriendlyDay(w.day + 2)}>Arrange friendly</Button>}>
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
                <div key={i} role={uid != null && d > w.day ? 'button' : undefined} tabIndex={uid != null && d > w.day ? 0 : undefined} title={uid != null && d > w.day ? 'Click to arrange a friendly on this day' : undefined} onClick={() => uid != null && d > w.day && !fx.length && setFriendlyDay(d)} onKeyDown={(e) => { if (e.key === 'Enter' && uid != null && d > w.day && !fx.length) setFriendlyDay(d); }} className="cal-day" style={{ cursor: uid != null && d > w.day && !fx.length ? 'pointer' : undefined, minHeight: 84, background: d < w.day ? 'var(--bg2)' : 'var(--panel2)', border: `1px solid ${isToday ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 8, padding: 5, opacity: d < w.day ? 0.75 : 1 }}>
                  <div className="small" style={{ fontWeight: isToday ? 800 : 500 }}>{dateOf(w.season, d).getUTCDate()}</div>
                  {fx.map((f) => <FixtureChip key={f.id} f={f} uid={uid!} />)}
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

export { Badge };
