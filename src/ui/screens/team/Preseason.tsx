// Preseason: friendlies and the summer training camp, with a readiness read-out.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, Crest, Page, Stat } from '../../components/ui';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { fmtDate } from '../../../engine/calendar';
import { friendliesThisSeason, MAX_FRIENDLIES } from '../../../engine/extras';
import { CAMPS, bookCamp, campBusyReason, campQuote, campWindow, cancelCamp, inCamp, readiness, type CampDest } from '../../../engine/camps';
import { FriendlyModal } from '../CalendarScreen';

export default function Preseason() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const [friendly, setFriendly] = useState(false);
  const rd = readiness(w, c);
  const friendlies = friendliesThisSeason(w, c.id).sort((a, b) => a.day - b.day);
  const camp = c.camp && c.camp.season === w.season ? c.camp : null;
  const dest = camp ? CAMPS.find((d) => d.id === camp.id) : null;
  const win = campWindow(w);
  const open = win.to - win.from >= 7;
  return (
    <Page title="Preseason" subtitle="Friendlies and a summer camp build chemistry and match shape before the league starts.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Readiness" value={rd.label} tone={/Ready/.test(rd.label) ? 'good' : /Rusty/.test(rd.label) ? 'warn' : undefined} />
        <Stat label="Cohesion" value={rd.cohesion} sub="team chemistry (0–100)" />
        <Stat label="Match shape" value={`${rd.shape > 0 ? '+' : ''}${rd.shape}`} sub="form of your top eight" tone={rd.shape >= 2 ? 'good' : rd.shape < 0 ? 'warn' : undefined} />
        <Stat label="Friendlies" value={`${friendlies.length}/${MAX_FRIENDLIES}`} sub={camp ? `Camp: ${dest?.name}` : 'No camp booked'} />
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Friendlies" actions={<Button size="sm" variant="primary" disabled={friendlies.length >= MAX_FRIENDLIES} onClick={() => setFriendly(true)}>Arrange friendly</Button>}>
          <div className="small muted mb8">Each friendly adds cohesion, and players who get minutes gain match shape. They don't count for standings or fan mood.</div>
          {friendlies.length === 0 ? <div className="small faint">None arranged yet.</div> : (
            <div className="list">
              {friendlies.map((f) => {
                const home = f.homeId === c.id;
                const opp = getClub(w, home ? f.awayId : f.homeId);
                const res = f.result ? `${home ? f.result.home : f.result.away}–${home ? f.result.away : f.result.home}` : null;
                return (
                  <div key={f.id} className="list-item row">
                    <Crest club={opp} size={28} />
                    <div style={{ flex: 1 }}><b>{home ? 'vs' : '@'} {opp.name}</b><div className="small faint">{fmtDate(w.season, f.day)}</div></div>
                    {res ? (f.result?.gameId ? <Link className="link" to={`/game/${f.result.gameId}`}>{res}</Link> : <span>{res}</span>) : <Badge>Upcoming</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card title="Summer training camp">
          {camp && dest ? (
            <div className="col gap16">
              <CampCard d={dest} booked />
              <div className="small">{fmtDate(w.season, camp.startDay)} – {fmtDate(w.season, camp.endDay)} · paid {fmtMoney(camp.cost)} · {camp.done ? <b className="good">Completed</b> : inCamp(w, c) ? <b className="warn">In camp now</b> : 'Booked'}</div>
              {!camp.done && w.day < camp.startDay && <div><Button size="sm" variant="danger" onClick={() => { if (!confirm('Cancel the camp? Half the cost is refunded.')) return; const r = act((ww) => cancelCamp(ww, getClub(ww, c.id))); notify(r.message, r.ok ? 'good' : 'bad'); }}>Cancel camp</Button></div>}
            </div>
          ) : !open ? (
            <Callout>The camp window has closed for this season. Camps run from mid-July until a week before the first league game.</Callout>
          ) : (
            <div className="small muted">Pick one camp for the summer. Prices include travel for 18 people and depend on how far it is from home. Better centres train more and help young players develop.</div>
          )}
        </Card>
      </div>
      {!camp && open && (
        <div className="camp-grid mt16">
          {CAMPS.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <CampCard d={d} />
            </motion.div>
          ))}
        </div>
      )}
      {friendly && <FriendlyModal w={w} day={Math.max(w.day + 2, 1)} onClose={() => setFriendly(false)} />}
    </Page>
  );
}

function CampCard({ d, booked }: { d: CampDest; booked?: boolean }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const q = campQuote(w, c, d);
  const win = campWindow(w);
  const starts: number[] = [];
  for (let s = win.from; s + d.days <= win.to; s++) if (!campBusyReason(w, c, s, d.days)) starts.push(s);
  const [start, setStart] = useState<number | null>(starts[0] ?? null);
  const afford = q.total <= c.finances.cash;
  return (
    <Card className="camp-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="camp-flag" aria-hidden="true">{d.flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{d.name}</b>
          <div className="small faint">{d.place}{q.km ? ` · ${q.km.toLocaleString('en')} km` : ''} · {d.days} days</div>
        </div>
        <span className="camp-stars" title={`Facility quality ${d.quality}/5`}>{'★'.repeat(d.quality)}<span className="faint">{'★'.repeat(5 - d.quality)}</span></span>
      </div>
      <div className="small muted mt8">{d.blurb}</div>
      <div className="biz-kpis small mt8">
        <span>Cohesion <b className="good">+{q.cohesion}</b></span>
        <span>Match shape <b className="good">+{q.sharpness}</b></span>
        <span>Training sessions <b>{q.devSessions}</b></span>
        <span>Injury risk <b className={q.injuryChance > 0.15 ? 'warn' : ''}>{Math.round(q.injuryChance * 100)}%</b></span>
        {q.exposurePct > 0 && <span>Fans abroad <b className="good">+{q.exposurePct}%</b></span>}
      </div>
      {!booked && (
        <div className="row mt8" style={{ flexWrap: 'wrap', gap: 8 }}>
          <b className={afford ? '' : 'bad'}>{fmtMoney(q.total)}</b>
          <span className="small faint">travel {fmtMoney(q.travel)} + stay {fmtMoney(q.stay)}</span>
          <span className="spacer" />
          {starts.length ? (
            <>
              <select aria-label="Start date" value={start ?? ''} onChange={(e) => setStart(Number(e.target.value))}>
                {starts.map((s) => <option key={s} value={s}>{fmtDate(w.season, s)}</option>)}
              </select>
              <Button size="sm" variant="primary" disabled={!afford || start == null} onClick={() => { const r = act((ww) => bookCamp(ww, getClub(ww, c.id), d.id, start!)); notify(r.message, r.ok ? 'good' : 'bad'); }}>Book</Button>
            </>
          ) : <Badge>No free dates</Badge>}
        </div>
      )}
    </Card>
  );
}
