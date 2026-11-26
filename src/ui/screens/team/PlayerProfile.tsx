import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, ClubLink, Crest, Empty, Money, Page, Rating, Table } from '../../components/ui';
import { MoraleBadge, InjuryBadge, potRange, pctStr } from '../../helpers';
import { absDay, type CompType, type Player, type RatingKey } from '../../../engine/types';
import { age, club as getClub, idx, userClub, isUser } from '../../../engine/world';
import { PlayerCard, grade } from '../../art/PlayerCard';
import { fmtMoney } from '../../../engine/world';
import { bodyOf, bodyLabel, cancelQuickSale, listForQuickSale, quickSalePrice, QUICK_SALE_SHARE } from '../../../engine/extras';
import { potentialLabel, RATING_EFFECT, RATING_LABEL, ROLE_LABEL, salaryAsk, roleFor, scoutedRange } from '../../../engine/player';
import { knowledge } from '../../../engine/squad';
import { playerInterest, projectedRank, releaseCost, releasePlayer, loanOut } from '../../../engine/market';
import { compTypeLabel } from '../../../engine/competitions';
import { seasonLabel } from '../../../engine/calendar';
import ContractModal from '../club/ContractModal';
import BidModal from './BidModal';

const GROUPS: { label: string; keys: RatingKey[] }[] = [
  { label: 'Shooting', keys: ['ins', 'mid', 'thr', 'ft'] },
  { label: 'Playmaking', keys: ['pas', 'hnd', 'iq'] },
  { label: 'Defense & boards', keys: ['pdef', 'idef', 'stl', 'blk', 'reb'] },
  { label: 'Athletic', keys: ['spd', 'str', 'jmp', 'end'] },
];

const PERSONALITY: { key: keyof Player['personality']; label: string; desc: string }[] = [
  { key: 'workEthic', label: 'Work ethic', desc: 'Development speed.' },
  { key: 'clutch', label: 'Clutch', desc: 'Shot-making in the last minutes of close games.' },
  { key: 'leadership', label: 'Leadership', desc: 'Raises teammates\' morale and cohesion.' },
  { key: 'loyalty', label: 'Loyalty', desc: 'Willingness to renew and resist offers.' },
  { key: 'adaptability', label: 'Adaptability', desc: 'Settling at a new club.' },
  { key: 'greed', label: 'Greed', desc: 'Weight of money in negotiations.' },
  { key: 'ambition', label: 'Ambition', desc: 'Weight of club level and winning.' },
  { key: 'ego', label: 'Ego', desc: 'Minutes demands; locker-room risk.' },
];

const AGENT_STYLE: Record<string, string> = {
  relationship: 'Relationship-led: values trust and your reputation.',
  hardline: 'Hard-line: rarely accepts below the asking price; little patience.',
  cash: 'Short-term cash: money dominates.',
  empowerment: 'Player empowerment: role and control matter most.',
  development: 'Development-focused: minutes and coaching for young players.',
  media: 'Media-savvy: club profile and exposure.',
};

export default function PlayerProfile() {
  const { id } = useParams();
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const [search] = useSearchParams();
  const [modal, setModal] = useState<'renew' | 'sign' | 'bid' | null>(() => (search.get('do') === 'renew' ? 'renew' : null));
  const p = idx(w).players.get(Number(id));
  if (!p) return <Page title="Player not found"><Empty>This player no longer exists in the database.</Empty></Page>;
  const uc = userClub(w);
  const own = uc != null && p.teamId === uc.id;
  const loanedFromUs = uc != null && p.loan?.fromTeamId === uc.id;
  const club = p.teamId != null ? getClub(w, p.teamId) : null;
  const k = knowledge(w, p);
  const known = k >= 95;
  const pr = potRange(w, p);
  const short = w.user.shortlist.some((s) => s.playerId === p.id);
  const a = age(w, p);

  const ratingView = (key: RatingKey) => {
    if (known) return <span className="row gap4"><span className="grade" style={{ color: gradeColor(p.ratings[key]) }}>{grade(p.ratings[key])}</span><Rating v={p.ratings[key]} title={RATING_EFFECT[key]} /></span>;
    const r = scoutedRange(p.ratings[key], k, p.id * 31 + key.length * 13 + key.charCodeAt(0));
    return <Rating v={p.ratings[key]} range={r} title={`${RATING_EFFECT[key]} (scouted range)`} />;
  };

  return (
    <Page
      title={<span className="row">{club && <Crest club={club} />}{p.firstName} {p.lastName} {p.retired && <Badge>Retired</Badge>}{p.hallOfFame && <Badge tone="accent">Hall of Fame</Badge>}</span>}
      subtitle={<span>#{p.jersey} · {p.pos} · {a} years · {bodyLabel(bodyOf(w, p))} · {p.nationality} · {club ? <ClubLink club={club} /> : 'Free agent'}{p.loan && <> · on loan from <ClubLink club={getClub(w, p.loan.fromTeamId)} /></>}</span>}
      actions={
        <>
          <Button variant="ghost" onClick={() => act((ww) => {
            if (short) ww.user.shortlist = ww.user.shortlist.filter((s) => s.playerId !== p.id);
            else ww.user.shortlist.push({ playerId: p.id, note: '', addedDay: absDay(ww) });
          })}>{short ? '★ Shortlisted' : '☆ Shortlist'}</Button>
          {uc && !p.retired && own && (
            <>
              <Button onClick={() => setModal('renew')} disabled={!p.contract || !!p.contract.youth}>Renew contract</Button>
              <Button onClick={() => { act(() => { p.transferListed = !p.transferListed; if (p.transferListed) p.untouchable = false; }); notify(p.transferListed ? 'Placed on the transfer list: bids will be more likely, morale drops.' : 'Removed from the transfer list.'); }}>{p.transferListed ? 'Remove from list' : 'Transfer list'}</Button>
              <Button onClick={() => { act(() => { p.untouchable = !p.untouchable; if (p.untouchable) p.transferListed = false; }); notify(p.untouchable ? 'Marked untouchable: clubs will be told he is not for sale (release clauses still apply).' : 'No longer untouchable.'); }}>{p.untouchable ? 'Allow offers' : 'Untouchable'}</Button>
              <Button onClick={() => {
                if (!confirm(`Loan ${p.firstName} ${p.lastName} out until the end of the season? The receiving club pays 50% of his salary.`)) return;
                const res = act((ww) => loanOut(ww, getClub(ww, uc.id), p));
                notify(res.message, res.ok ? 'good' : 'bad');
              }}>Loan out</Button>
              <Button variant="danger" onClick={() => {
                const cost = releaseCost(w, p);
                if (!confirm(`Release ${p.firstName} ${p.lastName}? Settlement: €${Math.round(cost / 1000)}k (60% of the remaining contract).`)) return;
                act((ww) => releasePlayer(ww, getClub(ww, uc.id), p));
                notify(`${p.firstName} ${p.lastName} released.`);
              }}>Release</Button>
              {p.quickSaleDay != null ? (
                <Button onClick={() => { act(() => cancelQuickSale(p)); notify('Quick sale cancelled.'); }} title="He is offered to every club; a buyer pays tomorrow">Cancel quick sale (~{fmtMoney(quickSalePrice(w, p))})</Button>
              ) : (
                <Button variant="danger" onClick={() => {
                  if (!confirm(`Quick-sell ${p.firstName} ${p.lastName}? A club will pay about ${fmtMoney(quickSalePrice(w, p))} (${Math.round(QUICK_SALE_SHARE * 100)}% of his ${fmtMoney(p.value)} value) tomorrow. Fans may not like it.`)) return;
                  const res = act((ww) => listForQuickSale(ww, getClub(ww, uc.id), p));
                  notify(res.message, res.ok ? 'good' : 'bad');
                }}>Quick sale</Button>
              )}
            </>
          )}
          {uc && !p.retired && !own && !loanedFromUs && p.teamId == null && <Button variant="primary" onClick={() => setModal('sign')}>Negotiate</Button>}
          {uc && !p.retired && !own && !loanedFromUs && p.teamId != null && !p.academy && !p.loan && <Button variant="primary" onClick={() => setModal('bid')}>Make a bid</Button>}
        </>
      }
    >
      <div className="row mb8" style={{ alignItems: 'stretch', gap: 16, marginBottom: 14 }}>
        <PlayerCard p={p} club={p.teamId != null ? getClub(w, p.teamId) : null} ovrLabel={known ? undefined : `${scoutedRange(p.ovr, k, p.id)[0]}+`} sub={p.teamId != null ? getClub(w, p.teamId).name : 'Free agent'} />
      <div className="grid g2" style={{ flex: 1, marginBottom: 0 }}>
        <div className="stat"><div className="label">Overall</div><div className="value">{known ? <Rating v={p.ovr} /> : <Rating v={p.ovr} range={scoutedRange(p.ovr, k, p.id)} />}</div><div className="sub">Scouting knowledge {Math.round(k)}%</div></div>
        <div className="stat"><div className="label">Potential</div><div className="value"><Rating v={p.pot} range={pr[0] === pr[1] ? null : pr} /></div><div className="sub">{potentialLabel(Math.round((pr[0] + pr[1]) / 2))}</div></div>
        <div className="stat"><div className="label">Market value</div><div className="value"><Money v={p.value} /></div><div className="sub">{p.contract ? `${p.contract.buyout != null ? `Clause €${Math.round(p.contract.buyout / 1000)}k` : 'No release clause'}` : 'Free agent'}</div></div>
        <div className="stat"><div className="label">Status</div><div className="value row gap4" style={{ fontSize: 14 }}><MoraleBadge p={p} /><InjuryBadge p={p} />{p.region === 'NONEU' ? <Badge tone="warn">Non-EU</Badge> : <Badge>{p.region}</Badge>}{p.homegrown && <Badge tone="good">Homegrown</Badge>}</div><div className="sub">Freshness {Math.round(p.freshness)} · form {p.form > 0 ? '+' : ''}{p.form.toFixed(1)}</div></div>
      </div>
      </div>

      <div className="grid g3">
        <Card title="Ratings" className="span2">
          {!known && <div className="small muted mb8">Ranges reflect your scouting knowledge. Shortlist him or send scouts to narrow them.</div>}
          <div className="grid g4">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <h3 className="mb8">{g.label}</h3>
                <div className="col gap4">
                  {g.keys.map((key) => (
                    <div key={key} className="row small" title={RATING_EFFECT[key]}>
                      <span style={{ flex: 1 }}>{RATING_LABEL[key]}</span>
                      {ratingView(key)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Personality & agent">
          {own || k >= 70 ? (
            <div className="col gap4">
              {PERSONALITY.map((x) => (
                <div key={x.key} className="row small" title={x.desc}>
                  <span style={{ flex: 1 }}>{x.label}</span>
                  <b>{own || k >= 90 ? p.personality[x.key] : `${Math.max(0, Math.floor(p.personality[x.key] / 20) * 20)}–${Math.min(100, Math.floor(p.personality[x.key] / 20) * 20 + 20)}`}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="small muted">Personality unknown — scout him further (knowledge ≥70%).</div>
          )}
          <div className="mt16 small"><b>{p.agent.name}</b><div className="muted">{AGENT_STYLE[p.agent.style]}</div></div>
          <div className="mt8 small muted">Injury proneness: {own || k >= 70 ? (p.injuryProne >= 60 ? 'high' : p.injuryProne >= 35 ? 'medium' : 'low') : 'unknown'}</div>
        </Card>
      </div>

      <div className="grid g2 mt16">
        <Card title="Contract">
          {p.contract ? (
            <div className="kv small">
              <span>Salary</span><span><Money v={p.contract.salary} />/yr</span>
              <span>Expires</span><span>Summer {p.contract.expires + 1}</span>
              <span>Role promise</span><span>{ROLE_LABEL[p.contract.rolePromise]} (expects ~{Math.round(p.minutesExpectation)} min)</span>
              <span>Release clause</span><span>{p.contract.buyout != null ? <Money v={p.contract.buyout} /> : 'None'}</span>
              <span>Signed</span><span>{seasonLabel(p.contract.signedSeason)}{p.contract.youth ? ' · academy deal' : ''}</span>
              {own && <><span>Release cost</span><span><Money v={releaseCost(w, p)} /></span></>}
            </div>
          ) : <div className="muted small">No contract. Asking about <Money v={salaryAsk(w, p, uc ?? undefined)} />/yr.</div>}
        </Card>
        {uc && !own && !p.retired && <InterestPreview p={p} />}
        {own && <Card title="Awards">{p.awards.length ? <div className="col gap4 small">{p.awards.map((x, i) => <div key={i}>🏅 {seasonLabel(x.season)} — {x.award}</div>)}</div> : <div className="muted small">No awards yet.</div>}</Card>}
      </div>

      <StatsTables p={p} />
      {!own && p.awards.length > 0 && <Card title="Awards" className="mt16"><div className="col gap4 small">{p.awards.map((x, i) => <div key={i}>🏅 {seasonLabel(x.season)} — {x.award}</div>)}</div></Card>}

      {modal === 'renew' && <ContractModal player={p} mode="renew" onClose={() => setModal(null)} />}
      {modal === 'sign' && <ContractModal player={p} mode="sign" onClose={() => setModal(null)} />}
      {modal === 'bid' && <BidModal player={p} onClose={() => setModal(null)} />}
      {p.teamId != null && isUser(w, p.teamId) && p.academy && <Callout>Academy player — manage him from <Link className="link" to="/team/academy">Team → Academy</Link>.</Callout>}
    </Page>
  );
}

function InterestPreview({ p }: { p: Player }) {
  const w = useWorld();
  const uc = userClub(w)!;
  const ask = salaryAsk(w, p, uc);
  const role = roleFor(projectedRank(w, uc, p));
  const res = playerInterest(w, p, uc, { salary: ask, years: 2, role, buyout: null, signingBonus: 0 });
  return (
    <Card title={`Would he join ${uc.abbrev}?`}>
      <div className="small muted mb8">At his asking salary (<Money v={ask} />), 2 years, as {ROLE_LABEL[role].toLowerCase()}:</div>
      <div className="row mb8"><Badge tone={res.score >= 0 ? 'good' : res.score > -15 ? 'warn' : 'bad'}>{res.score >= 0 ? 'Likely to accept' : res.score > -15 ? 'Needs convincing' : 'Not interested'}</Badge><span className="small muted">score {res.score.toFixed(1)}</span></div>
      <div className="col gap4">
        {res.factors.filter((f) => Math.abs(f.value) >= 0.5).sort((a, b) => a.value - b.value).map((f, i) => (
          <div key={i} className="row small"><span style={{ flex: 1 }}>{f.label}</span><b className={f.value >= 0 ? 'good' : 'bad'}>{f.value > 0 ? '+' : ''}{f.value}</b></div>
        ))}
      </div>
    </Card>
  );
}

function StatsTables({ p }: { p: Player }) {
  const w = useWorld();
  const rows = [...p.stats].sort((a, b) => b.season - a.season || a.comp.localeCompare(b.comp));
  const pg = (v: number, gp: number) => (gp ? (v / gp).toFixed(1) : '–');
  return (
    <div className="grid g2 mt16">
      <Card title="Statistics" className="flush">
        <Table
          rows={rows}
          rowKey={(s) => `${s.season}-${s.teamId}-${s.comp}`}
          empty="No games played."
          columns={[
            { key: 's', label: 'Season', render: (s) => seasonLabel(s.season) },
            { key: 't', label: 'Team', render: (s) => idx(w).clubs.get(s.teamId)?.abbrev ?? '?' },
            { key: 'c', label: 'Comp', render: (s) => compTypeLabel(s.comp as CompType) },
            { key: 'gp', label: 'GP', render: (s) => s.gp, align: 'r' },
            { key: 'min', label: 'MIN', render: (s) => pg(s.min, s.gp), align: 'r' },
            { key: 'pts', label: 'PTS', render: (s) => pg(s.pts, s.gp), align: 'r' },
            { key: 'reb', label: 'REB', render: (s) => pg(s.orb + s.drb, s.gp), align: 'r' },
            { key: 'ast', label: 'AST', render: (s) => pg(s.ast, s.gp), align: 'r' },
            { key: 'fg', label: 'FG%', render: (s) => pctStr(s.fgm, s.fga), align: 'r' },
            { key: '3p', label: '3P%', render: (s) => pctStr(s.tpm, s.tpa), align: 'r' },
            { key: 'ft', label: 'FT%', render: (s) => pctStr(s.ftm, s.fta), align: 'r' },
            { key: 'pm', label: '+/-', render: (s) => s.pm, align: 'r' },
          ]}
        />
      </Card>
      <Card title="Career" className="flush">
        <Table
          rows={[...p.career].reverse()}
          rowKey={(c) => `${c.season}-${c.teamId}`}
          empty="First season."
          columns={[
            { key: 's', label: 'Season', render: (c) => seasonLabel(c.season) },
            { key: 't', label: 'Club', render: (c) => { const cl = idx(w).clubs.get(c.teamId); return cl ? <ClubLink club={cl} /> : '?'; } },
            { key: 'l', label: 'Tier', render: (c) => (c.tier ? `Tier ${c.tier}` : 'Continental') },
            { key: 'o', label: 'OVR', render: (c) => <Rating v={c.ovr} />, align: 'c' },
          ]}
        />
      </Card>
    </div>
  );
}

function gradeColor(v: number) {
  return v >= 78 ? '#5eead4' : v >= 66 ? '#86efac' : v >= 54 ? '#fde68a' : v >= 42 ? '#fdba74' : '#fca5a5';
}
