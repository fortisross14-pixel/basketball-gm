import type { Decision } from '../../engine/types';
import { absDay } from '../../engine/types';
import { club as getClub, roster, fmtMoney, userClub } from '../../engine/world';
import { estimateRevenue } from '../../engine/economy';
import { clubStrength } from '../../engine/matchday';
import { capacity } from '../../engine/arena';
import { resolveDecision } from '../../engine/events';
import { fanEvaluation, jobSecurity, resign, expectedWinPct } from '../../engine/career';
import { fmtAbs } from '../../engine/calendar';
import { useAct, useNotify, useWorld } from '../store';
import { Badge, Button, Card, Crest, Meter, Sparkline, Stat } from './ui';

export function JobOfferCard({ d }: { d: Decision }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, d.payload.clubId as number);
  const league = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const peers = w.clubs.filter((x) => x.leagueId === c.leagueId && x.group === c.group); // the group you actually play in
  const strRank = [...peers].sort((a, b) => clubStrength(w, b) - clubStrength(w, a)).findIndex((x) => x.id === c.id) + 1;
  const best = Math.max(...roster(w, c.id).map((p) => p.ovr));
  const daysLeft = d.deadlineDay - absDay(w);
  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="row">
        <Crest club={c} size="lg" />
        <div style={{ flex: 1 }}>
          <h2>{c.name}</h2>
          <div className="muted small">{league?.name}{c.group ? ` · group ${c.group}` : ''}{league?.kind === 'college' ? ' · United States' : ' · Spain'} · {c.city}</div>
        </div>
        <Badge tone="warn">{daysLeft > 0 ? `${daysLeft} days to answer` : 'Expires today'}</Badge>
      </div>
      <p className="mt8">{d.body}</p>
      <div className="grid g4 mt8">
        <Stat label="Prestige" value={c.prestige} sub={`Expected finish ~${Math.round((1 - (expectedWinPct(w, c) - 0.25) / 0.5) * (peers.length - 1)) + 1} of ${peers.length}`} />
        <Stat label="Squad strength" value={`#${strRank} of ${peers.length}`} sub={`Best player rated ${best}`} />
        <Stat label="Revenue" value={fmtMoney(estimateRevenue(w, c).total)} sub={`Cash ${fmtMoney(c.finances.cash)}`} />
        <Stat label="Arena" value={capacity(c).toLocaleString('en')} sub={`${Math.round(c.fans.local).toLocaleString('en')} local fans`} />
      </div>
      <div className="small muted mt8">Owner: {c.board.owner} · patience {c.board.patience}/100 · ambition {c.board.ambition}/100</div>
      <div className="row mt8">
        {d.options.map((o) => (
          <Button key={o.id} variant={o.id === 'accept' ? 'primary' : undefined} onClick={() => {
            if (o.id === 'accept' && userClub(w) && !confirm(`Leave ${userClub(w)!.name} for ${c.name}? This cannot be undone.`)) return;
            notify(act((ww) => resolveDecision(ww, d, o.id)), 'good');
          }}>{o.label}</Button>
        ))}
      </div>
    </div>
  );
}

/** How the owner and the supporters rate you, and why. */
export function EvaluationCard() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = userClub(w);
  if (!c) return null;
  const ap = w.user.approval;
  const ev = fanEvaluation(w, c);
  const sec = jobSecurity(w);
  const owner = w.user.role === 'owner';
  return (
    <Card title="Your evaluation — owner & fans">
      <div className="grid g3">
        <Stat label="Owner / board" value={`${Math.round(ap.board)}/100`} tone={ap.board < 35 ? 'bad' : ap.board > 65 ? 'good' : undefined} sub="Objectives, finances, promises, relationship" />
        <Stat label="Supporters" value={`${Math.round(ap.fans)}/100`} tone={ap.fans < 30 ? 'bad' : ap.fans > 65 ? 'good' : undefined} sub={ap.lowFanWeeks >= 3 ? `▼ Calling for change (${ap.lowFanWeeks} weeks)` : 'Results vs expectations, mood, your decisions'} />
        <Stat label="Job security" value={owner ? 'Owner' : `${sec}/100`} tone={!owner && sec < 35 ? 'bad' : !owner && sec > 65 ? 'good' : undefined} sub={owner ? 'Owners cannot be fired' : sec < 35 ? '▼ At risk of dismissal' : sec > 65 ? '▲ Secure' : 'Stable'} />
      </div>
      {ap.history.length > 1 && (
        <div className="row mt16" style={{ alignItems: 'flex-end' }}>
          <div><div className="small muted">Board (blue) · Fans (orange), weekly</div>
            <div style={{ position: 'relative', width: 420, height: 60 }}>
              <div style={{ position: 'absolute', inset: 0 }}><Sparkline data={ap.history.map((h) => h.board)} width={420} height={60} zero={false} /></div>
              <div style={{ position: 'absolute', inset: 0 }}><Sparkline data={ap.history.map((h) => h.fans)} width={420} height={60} color="var(--accent)" zero={false} /></div>
            </div>
          </div>
        </div>
      )}
      <div className="grid g2 mt16">
        <div>
          <h3 className="mb8">What the fans weigh</h3>
          {ev.factors.map((f) => (
            <div key={f.label} className="row small" style={{ padding: '3px 0' }}>
              <span style={{ flex: 1 }}>{f.label}</span>
              <b className={f.value > 0 ? 'good' : f.value < 0 ? 'bad' : ''}>{f.value > 0 ? '▲ +' : f.value < 0 ? '▼ ' : ''}{f.value}</b>
            </div>
          ))}
          <Meter value={ev.fanTarget} label="Where fan approval is heading" />
        </div>
        <div>
          <h3 className="mb8">Recent judgements</h3>
          {ap.notes.length === 0 ? <div className="small muted">Nothing notable yet.</div> : ap.notes.slice(0, 7).map((n, i) => (
            <div key={i} className="row small" style={{ padding: '3px 0' }}>
              <Badge>{n.who === 'fans' ? 'Fans' : 'Owner'}</Badge>
              <span style={{ flex: 1 }}>{n.text}</span>
              <b className={n.delta > 0 ? 'good' : n.delta < 0 ? 'bad' : ''}>{n.delta > 0 ? '+' : ''}{n.delta}</b>
              <span className="faint">{fmtAbs(n.day)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="small muted mt8">
        Performance is judged against expectations for this club, not in absolute terms. Strong ratings raise your executive reputation week by week, and bigger clubs come calling — even mid-season. Poor ratings lead to warnings, an ultimatum, sustained fan protests or a dismissal at the season review.
      </p>
      {!owner && (
        <div className="row mt8">
          <span className="spacer" />
          <Button variant="danger" size="sm" onClick={() => { if (confirm(`Resign from ${c.name}? Your reputation drops slightly and you will wait for offers.`)) notify(act((ww) => resign(ww))); }}>Resign</Button>
        </div>
      )}
    </Card>
  );
}
