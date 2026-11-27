import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Club, Decision, SponsorOffer, SponsorSlot, TvOffer } from '../../../engine/types';
import { SLOT_GROUPS, SPONSOR_SLOTS, absDay } from '../../../engine/types';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { BROADCASTER_PROFILE, SLOT_INFO, centralTvAnnual, localTvBenchmark, sponsorBenchmark, exposure } from '../../../engine/economy';
import { seekSponsor, sellSeasonRights, signTv, sponsorSaturation } from '../../../engine/commercial';
import { quickDeals, takeQuickDeal } from '../../../engine/fundraising';
import { resolveDecision } from '../../../engine/events';
import { seasonLabel, fmtAbs } from '../../../engine/calendar';
import { Badge, Button, Callout, Card, Money, Page, Stat, Table, Tabs } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { useAct, useNotify, useWorld } from '../../store';
import '../hubs/hubs.css';

type Group = 'kit' | 'arena' | 'media';
type Tab = 'overview' | Group | 'department';
const TABS: Tab[] = ['overview', 'kit', 'arena', 'media', 'department'];

export default function Commercial() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const now = absDay(w);
  const params = useParams();
  const navTo = useNavigate();
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'overview';
  const setTab = (t: Tab) => navTo(`/club/commercial/${t}`, { replace: true });
  const sponsorTotal = c.sponsors.reduce((a, s) => a + s.annual, 0);
  const offers: SponsorOffer[] = (w.sponsorOffers[c.id] ?? []).filter((o) => o.expiresDay >= now);
  const decisionFor = (o: SponsorOffer): Decision | undefined => w.decisions.find((d) => !d.resolved && d.kind === 'sponsorOffer' && d.payload.offerId === o.id);
  const central = centralTvAnnual(w, c, c.history[c.history.length - 1]?.rank);
  const sat = sponsorSaturation(c);
  const groupOf = (s: SponsorSlot) => SLOT_GROUPS.find((g) => g.slots.includes(s))!.id;

  const resolveOffer = (o: SponsorOffer, choice: string) => {
    const d = decisionFor(o);
    if (!d) return notify('This offer is no longer pending.', 'bad');
    const msg = act((ww) => resolveDecision(ww, d, choice));
    notify(msg, choice === 'reject' ? undefined : 'good');
  };
  const seek = (slot: SponsorSlot) => {
    const res = act((ww) => seekSponsor(ww, getClub(ww, c.id), slot));
    notify(res.message, res.ok ? 'good' : 'bad');
  };
  const count = (g: Group) => { const slots = SLOT_GROUPS.find((x) => x.id === g)!.slots; return `${c.sponsors.filter((d) => slots.includes(d.slot)).length}/${slots.length}`; };

  return (
    <Page kicker={`${c.name} · commercial`} title="Sponsors & TV" subtitle="Sell your shirt, your arena and your media rights. Every partner pays, but supporters only accept so many brands.">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: `Overview${offers.length ? ` (${offers.length} offers)` : ''}` },
          { id: 'kit', label: `Shirt & kit ${count('kit')}` },
          { id: 'arena', label: `Arena ${count('arena')}` },
          { id: 'media', label: `Media ${count('media')}${!c.tv ? ' · TV unsold' : ''}` },
          { id: 'department', label: 'Department' },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === 'overview' && (
            <div className="col gap16">
              <div className="grid g4">
                <Stat label="Sponsorship / yr" value={<Money v={sponsorTotal} />} sub={`${c.sponsors.length} of ${SPONSOR_SLOTS.length} spaces sold`} />
                <Stat label="Fan tolerance" value={`${sat.count} / ${sat.comfortable}`} tone={sat.penalty > 0 ? 'bad' : sat.count >= sat.comfortable ? 'warn' : 'good'} sub={sat.label} />
                <Stat label="Media rights / yr" value={<Money v={central + (c.tv?.annual ?? 0)} />} sub={c.tv ? `${c.tv.broadcaster} + league share` : 'League share only: local TV unsold'} tone={!c.tv ? 'warn' : undefined} />
                <Stat label="Exposure" value={Math.round(exposure(c.fans)).toLocaleString('en')} sub="What brands pay for" />
              </div>
              <div className="grid g3">
                {SLOT_GROUPS.map((g) => {
                  const deals = c.sponsors.filter((d) => g.slots.includes(d.slot));
                  const pend = offers.filter((o) => g.slots.includes(o.slot)).length;
                  const worth = g.slots.filter((s) => !deals.some((d) => d.slot === s)).reduce((a, s) => a + sponsorBenchmark(w, c, s), 0);
                  return (
                    <Card key={g.id} title={g.id === 'kit' ? 'Shirt & kit' : g.label} actions={<Button size="sm" onClick={() => setTab(g.id)}>Open</Button>}>
                      <div className="row"><b style={{ fontSize: '1.3rem' }}><Money v={deals.reduce((a, d) => a + d.annual, 0)} /></b><span className="muted small">/yr · {deals.length}/{g.slots.length} sold</span></div>
                      <div className="col mt8" style={{ gap: 4 }}>
                        {g.slots.map((s) => { const d = deals.find((x) => x.slot === s); return <div key={s} className="row small"><span className="muted">{SLOT_INFO[s].label}</span><span className="spacer" />{d ? <b>{d.brand}</b> : <span className="faint">free</span>}</div>; })}
                      </div>
                      <div className="small mt8">{worth > 0 ? <>Unsold spaces worth about <b><Money v={worth} /></b>/yr.</> : 'Sold out.'}{pend ? <> <Badge tone="warn">{pend} offer{pend > 1 ? 's' : ''} waiting</Badge></> : null}</div>
                      {g.id === 'media' && <div className="small mt8">Local TV: {c.tv ? <b>{c.tv.broadcaster} until {seasonLabel(c.tv.expires)}</b> : <span className="warn">not sold yet</span>}</div>}
                    </Card>
                  );
                })}
              </div>
              <ToleranceCard c={c} />
              <Card title={`Offers waiting for an answer (${offers.length})`}>
                <Table
                  rows={offers}
                  rowKey={(o) => o.id}
                  empty="No offers right now. Open a section and ask your director to find a partner for a free space."
                  columns={[
                    { key: 'b', label: 'Brand', render: (o) => <span>{o.brand} <span className="muted small">{o.category}</span></span> },
                    { key: 's', label: 'Space', render: (o) => <Link className="link" to={`/club/commercial/${groupOf(o.slot)}`}>{SLOT_INFO[o.slot].label}</Link> },
                    { key: 'a', label: 'Per year', render: (o) => <Money v={o.annual} />, align: 'r' },
                    { key: 'vs', label: 'vs market', render: (o) => { const r = o.annual / Math.max(1, sponsorBenchmark(w, c, o.slot)); return <span className={r >= 1 ? 'good' : r < 0.85 ? 'bad' : ''}>{Math.round(r * 100)}%</span>; }, align: 'r' },
                    { key: 'y', label: 'Until', render: (o) => seasonLabel(o.expires), align: 'r' },
                    { key: 'r', label: 'Risk', render: (o) => o.risk >= 50 ? <Badge tone="bad" title="Supporters may protest">risk {o.risk}</Badge> : <span className="faint small">low</span> },
                    { key: 'act', label: '', render: (o) => <OfferActions o={o} d={decisionFor(o)} onResolve={resolveOffer} /> },
                  ]}
                />
              </Card>
              <MembersDrive c={c} />
            </div>
          )}
          {(tab === 'kit' || tab === 'arena') && <SlotSection key={tab} c={c} group={tab} offers={offers} decisionFor={decisionFor} onResolve={resolveOffer} onSeek={seek} />}
          {tab === 'media' && (
            <div className="col gap16">
              <MediaRights c={c} central={central}
                onSign={(o) => { act((ww) => signTv(ww, c, o)); notify(`Media deal signed with ${o.broadcaster}: ${fmtMoney(o.annual)}/yr.`, 'good'); }}
                onSellSeason={() => { const res = act((ww) => sellSeasonRights(ww, getClub(ww, c.id))); notify(res.message, res.ok ? 'good' : 'bad'); }} />
              <SlotSection c={c} group="media" offers={offers} decisionFor={decisionFor} onResolve={resolveOffer} onSeek={seek} />
            </div>
          )}
          {tab === 'department' && <StaffPanel roles={['commercialDirector']} title="Commercial department" />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function MembersDrive({ c }: { c: Club }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const d = quickDeals(w, c).find((x) => x.kind === 'membership');
  if (!d) return null;
  const o = d.options[0];
  return (
    <Card title="Members & supporters drive" actions={d.available ? <Badge tone="good">Available</Badge> : <Badge>Closed</Badge>}>
      <div className="row">
        <div className="small muted" style={{ flex: 1 }}>{d.desc} {d.fanNote}{!d.available && <> <b>{d.reason}</b></>}</div>
        {d.available && o && <Button variant="primary" onClick={() => { const res = act((ww) => takeQuickDeal(ww, getClub(ww, c.id), 'membership', o.id)); notify(res.message, res.ok ? 'good' : 'bad'); }}>Launch (~{fmtMoney(o.cashNow)})</Button>}
      </div>
    </Card>
  );
}

function ToleranceCard({ c }: { c: Club }) {
  const sat = sponsorSaturation(c);
  const max = SPONSOR_SLOTS.length;
  return (
    <Card title="How many brands will your fans accept?">
      <div className="row" style={{ alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="tolerance">
            <span className="tol-limit" style={{ left: `${(sat.comfortable / max) * 100}%` }} title="Comfort limit" />
            <span className="tol-mark" style={{ left: `calc(${(sat.count / max) * 100}% - 2px)` }} />
          </div>
          <div className="row small muted mt8"><span>0 partners</span><span className="spacer" /><span>Comfort limit: {sat.comfortable}</span><span className="spacer" /><span>{max} (sold out)</span></div>
        </div>
        <div style={{ maxWidth: 360 }} className="small">
          <b className={sat.penalty > 0 ? 'bad' : 'good'}>{sat.label}.</b> Each partner beyond the limit costs fan mood every week, and risky categories (betting, crypto…) cost extra. Loyal fans accept a few more.
          {sat.penalty > 0 && <div className="bad mt8">Current mood drag: −{sat.penalty} on the weekly target.</div>}
        </div>
      </div>
    </Card>
  );
}

function SlotSection({ c, group, offers, decisionFor, onResolve, onSeek }: { c: Club; group: Group; offers: SponsorOffer[]; decisionFor: (o: SponsorOffer) => Decision | undefined; onResolve: (o: SponsorOffer, choice: string) => void; onSeek: (s: SponsorSlot) => void }) {
  const w = useWorld();
  const slots = SLOT_GROUPS.find((g) => g.id === group)!.slots;
  const [sel, setSel] = useState<SponsorSlot>(() => slots.find((s) => !c.sponsors.some((x) => x.slot === s)) ?? slots[0]);
  return (
    <div className="kit-stage">
      <Card title={group === 'kit' ? 'Your shirt & kit' : group === 'arena' ? 'Your arena' : 'Digital spaces'}>
        <SlotVisual c={c} group={group} sel={sel} onSel={setSel} offers={offers} />
        <div className="slot-list mt8">
          {slots.map((s) => {
            const d = c.sponsors.find((x) => x.slot === s);
            const pending = offers.filter((o) => o.slot === s).length;
            return (
              <button key={s} type="button" className={`slot-chip ${sel === s ? 'sel' : ''}`} onClick={() => setSel(s)}>
                <span className="sc-label">{SLOT_INFO[s].label}</span>
                <span className="sc-brand">{d ? d.brand : <span className="faint">Available</span>}</span>
                <span className="small muted">{d ? `${fmtMoney(d.annual)}/yr · to ${seasonLabel(d.expires)}` : `worth ~${fmtMoney(sponsorBenchmark(w, c, s))}/yr`}{pending ? ` · ${pending} offer` : ''}</span>
              </button>
            );
          })}
        </div>
      </Card>
      <AnimatePresence mode="wait">
        <motion.div key={sel} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          <SlotPanel c={c} slot={sel} offers={offers.filter((o) => o.slot === sel)} decisionFor={decisionFor} onResolve={onResolve} onSeek={onSeek} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Illustration of one commercial group with a hotspot per sponsorship space. */
function SlotVisual({ c, group, sel, onSel, offers }: { c: Club; group: Group; sel: SponsorSlot; onSel: (s: SponsorSlot) => void; offers: SponsorOffer[] }) {
  const deal = (s: SponsorSlot) => c.sponsors.find((x) => x.slot === s);
  const [a, b] = c.colors;
  const bt = (s: SponsorSlot, max = 12) => { const d = deal(s); return d ? (d.brand.length > max ? `${d.brand.slice(0, max - 1)}…` : d.brand) : ''; };
  const box = (s: SponsorSlot) => ({ fill: deal(s) ? '#fff' : 'rgba(255,255,255,.12)', stroke: deal(s) ? 'none' : '#fff', strokeDasharray: '4 3' });
  const label = (x: number, y: number, t: string) => <text x={x} y={y} textAnchor="middle" fontSize="11" fill="#9fb1d8" fontFamily="Inter, sans-serif">{t}</text>;
  const shirt = (x: number, fill: string, trim: string) => <path transform={`translate(${x} 0)`} d="M28 30 L48 18 Q64 30 80 18 L100 30 L128 46 L116 74 L102 66 L102 190 L26 190 L26 66 L12 74 L0 46 Z" fill={fill} stroke={trim} strokeWidth="3" />;
  let spots: { slot: SponsorSlot; x: number; y: number }[] = [];
  let art: JSX.Element;
  if (group === 'kit') {
    spots = [{ slot: 'shirt', x: 100, y: 82 }, { slot: 'shirtSecondary', x: -2, y: 34 }, { slot: 'shirtBack', x: 290, y: 54 }, { slot: 'training', x: 466, y: 82 }];
    art = <g>
      {shirt(0, a, b)}
      <rect x="32" y="84" width="64" height="22" rx="3" {...box('shirt')} /><text x="64" y="99" textAnchor="middle" fontSize="10" fontWeight="800" fill="#111" fontFamily="'Barlow Condensed', sans-serif">{bt('shirt', 13)}</text>
      <rect x="4" y="44" width="20" height="14" rx="2" transform="rotate(-24 14 51)" {...box('shirtSecondary')} />
      <text x="64" y="150" textAnchor="middle" fontSize="40" fontWeight="900" fontStyle="italic" fill={b} fontFamily="'Barlow Condensed', sans-serif">{c.abbrev}</text>
      {label(64, 214, 'Front')}
      {shirt(190, a, b)}
      <rect x="222" y="56" width="64" height="18" rx="3" {...box('shirtBack')} /><text x="254" y="69" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#111" fontFamily="'Barlow Condensed', sans-serif">{bt('shirtBack', 13)}</text>
      <text x="254" y="150" textAnchor="middle" fontSize="54" fontWeight="900" fill={b} fontFamily="'Barlow Condensed', sans-serif">10</text>
      {label(254, 214, 'Back')}
      {shirt(366, '#1d2b4f', a)}
      <rect x="398" y="84" width="64" height="22" rx="3" {...box('training')} /><text x="430" y="99" textAnchor="middle" fontSize="10" fontWeight="800" fill="#111" fontFamily="'Barlow Condensed', sans-serif">{bt('training', 13)}</text>
      {label(430, 214, 'Training kit')}
    </g>;
  } else if (group === 'arena') {
    spots = [{ slot: 'naming', x: 40, y: 46 }, { slot: 'court', x: 326, y: 140 }, { slot: 'local1', x: 92, y: 200 }, { slot: 'local2', x: 520, y: 120 }, { slot: 'local3', x: 470, y: 46 }];
    art = <g>
      <defs><linearGradient id="courtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98b4b" /><stop offset="1" stopColor="#8a5a2b" /></linearGradient></defs>
      <rect x="60" y="34" width="300" height="24" rx="3" fill={deal('naming') ? 'rgba(255,138,31,.85)' : 'rgba(255,255,255,.08)'} stroke="#fff" strokeOpacity=".3" />
      <text x="210" y="50" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{deal('naming') ? `${bt('naming', 22).toUpperCase()} ARENA` : c.arena.name.toUpperCase()}</text>
      <rect x="380" y="30" width="110" height="32" rx="3" fill={deal('local3') ? '#0b1734' : 'rgba(255,255,255,.06)'} stroke={deal('local3') ? b : '#fff'} strokeOpacity={deal('local3') ? 1 : 0.3} strokeDasharray={deal('local3') ? undefined : '4 3'} />
      <text x="435" y="50" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{bt('local3', 16) || 'Concourse'}</text>
      <path d="M120 74 L400 74 L440 172 L80 172 Z" fill="url(#courtg)" stroke="#f5deb3" strokeWidth="2" />
      <line x1="260" y1="74" x2="260" y2="172" stroke="#f5deb3" strokeWidth="2" />
      <ellipse cx="260" cy="123" rx="34" ry="16" fill="none" stroke="#f5deb3" strokeWidth="2" />
      <rect x="200" y="140" width="120" height="16" rx="2" fill={deal('court') ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.18)'} />
      <text x="260" y="152" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{bt('court', 18)}</text>
      <rect x="76" y="180" width="368" height="16" rx="2" fill={deal('local1') ? '#0b1734' : 'rgba(255,255,255,.06)'} stroke={deal('local1') ? b : '#fff'} strokeOpacity={deal('local1') ? 1 : 0.3} strokeDasharray={deal('local1') ? undefined : '4 3'} />
      <text x="260" y="192" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{deal('local1') ? `${bt('local1', 16)} · ${bt('local1', 16)} · ${bt('local1', 16)}` : 'Sideline fence'}</text>
      <rect x="452" y="80" width="18" height="86" rx="2" fill={deal('local2') ? '#0b1734' : 'rgba(255,255,255,.06)'} stroke={deal('local2') ? b : '#fff'} strokeOpacity={deal('local2') ? 1 : 0.3} strokeDasharray={deal('local2') ? undefined : '4 3'} />
      <text x="461" y="182" textAnchor="middle" fontSize="9" fill="#9fb1d8" fontFamily="Inter, sans-serif">Baseline</text>
      {label(260, 222, 'Arena & court')}
    </g>;
  } else {
    spots = [{ slot: 'digital', x: 70, y: 40 }, { slot: 'app', x: 330, y: 40 }];
    art = <g>
      <rect x="40" y="30" width="200" height="130" rx="8" fill="#0b1734" stroke="#36d1ff" strokeWidth="2" />
      <rect x="50" y="40" width="180" height="100" rx="3" fill={deal('digital') ? 'rgba(54,209,255,.3)' : 'rgba(255,255,255,.06)'} />
      <path d="M128 72 L156 90 L128 108 Z" fill="#fff" opacity=".8" />
      <text x="140" y="132" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{bt('digital', 20) || 'Streaming & socials'}</text>
      {label(140, 184, 'Digital & streaming')}
      <rect x="300" y="24" width="80" height="150" rx="12" fill="#0b1734" stroke={a} strokeWidth="3" />
      <rect x="308" y="38" width="64" height="120" rx="4" fill={deal('app') ? 'rgba(255,138,31,.3)' : 'rgba(255,255,255,.06)'} />
      <text x="340" y="96" textAnchor="middle" fontSize="18" fontWeight="900" fontStyle="italic" fill={b} fontFamily="'Barlow Condensed', sans-serif">{c.abbrev}</text>
      <text x="340" y="146" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{bt('app', 11) || 'Club app'}</text>
      {label(340, 194, 'Official app')}
    </g>;
  }
  return (
    <svg viewBox={group === 'kit' ? '-16 0 526 232' : group === 'arena' ? '0 0 540 232' : '0 0 420 205'} role="img" aria-label="Sponsorship spaces">
      {art}
      {spots.map((sp) => {
        const d = deal(sp.slot);
        const pending = offers.some((o) => o.slot === sp.slot);
        const color = d ? '#34d399' : pending ? '#ffb020' : '#36d1ff';
        return (
          <g key={sp.slot} className={`hotspot ${d ? '' : 'empty'} ${sel === sp.slot ? 'sel' : ''}`} onClick={() => onSel(sp.slot)} role="button" tabIndex={0} aria-label={`${SLOT_INFO[sp.slot].label}: ${d ? d.brand : 'available'}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSel(sp.slot); }}>
            <circle className="hs-ring" cx={sp.x} cy={sp.y} r="11" fill="rgba(5,11,29,.75)" stroke={color} strokeWidth="2.5" />
            <text x={sp.x} y={sp.y + 4} textAnchor="middle" fontSize="12" fontWeight="900" fill={color} style={{ pointerEvents: 'none' }}>{d ? '✓' : pending ? '!' : '+'}</text>
          </g>
        );
      })}
    </svg>
  );
}

function OfferActions({ o, d, onResolve }: { o: SponsorOffer; d?: Decision; onResolve: (o: SponsorOffer, choice: string) => void }) {
  if (!d) return <span className="faint small">handled</span>;
  return (
    <span className="row gap4">
      <Button size="sm" variant="primary" onClick={() => onResolve(o, 'accept')}>Sign</Button>
      <Button size="sm" onClick={() => onResolve(o, 'upfront')} title="45% of the whole contract paid today; the yearly fee is halved">Half paid today</Button>
      <Button size="sm" onClick={() => onResolve(o, 'counter')} title="Ask for +15%: they may walk away and the slot is then locked for ~4 weeks">+15%</Button>
      <Button size="sm" variant="ghost" onClick={() => onResolve(o, 'reject')}>Decline</Button>
    </span>
  );
}

function SlotPanel({ c, slot, offers, decisionFor, onResolve, onSeek }: { c: Club; slot: SponsorSlot; offers: SponsorOffer[]; decisionFor: (o: SponsorOffer) => Decision | undefined; onResolve: (o: SponsorOffer, choice: string) => void; onSeek: (s: SponsorSlot) => void }) {
  const w = useWorld();
  const d = c.sponsors.find((x) => x.slot === slot);
  const bench = sponsorBenchmark(w, c, slot);
  const locked = (c.sponsorLocks?.[slot] ?? 0) > absDay(w);
  const sat = sponsorSaturation(c);
  return (
    <div className="slot-panel">
      <div className="kicker" style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontWeight: 800, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{SLOT_INFO[slot].label}</div>
      <h2 className="mt8">{d ? d.brand : 'Available'}</h2>
      <div className="grid g2 mt8">
        <Stat label={d ? 'Pays per year' : 'Market benchmark'} value={<Money v={d ? d.annual : bench} />} sub={d ? `Benchmark ${fmtMoney(bench)} (${Math.round((d.annual / Math.max(1, bench)) * 100)}%)` : 'Based on fans, prestige, tier and exposure'} />
        <Stat label="Slot weight" value={`${Math.round(SLOT_INFO[slot].weight * 100)}%`} sub="of a main shirt deal" />
      </div>
      {d ? (
        <div className="kv small mt16">
          <span>Category</span><span>{d.category}</span>
          <span>Contract</span><span>until {seasonLabel(d.expires)}</span>
          <span>Brand fit</span><span>{d.fit}/100</span>
          <span>Reputational risk</span><span className={d.risk >= 50 ? 'bad' : ''}>{d.risk}/100{d.risk >= 50 ? ' — fans dislike this category' : ''}</span>
          {(d.promoBonus > 0 || d.titleBonus > 0) && <><span>Bonuses</span><span>{d.promoBonus ? `promotion ${fmtMoney(d.promoBonus)} ` : ''}{d.titleBonus ? `title ${fmtMoney(d.titleBonus)}` : ''}</span></>}
        </div>
      ) : (
        <p className="small muted mt16">
          {locked ? 'Your director already approached brands for this space; try again in a few weeks.' : 'Ask your commercial director to find a partner now, or wait: free spaces attract offers over the weeks.'}
          {sat.count >= sat.comfortable && ' You are at the fans\' comfort limit: another partner will cost sentiment.'}
        </p>
      )}
      {!offers.length && <div className="mt16"><Button variant={d ? undefined : 'primary'} disabled={locked} title={locked ? 'Your director approached brands recently; try again in a few weeks' : undefined} onClick={() => onSeek(slot)}>{d ? 'Find a better partner' : 'Find a partner'}</Button></div>}
      <h3 className="mt16 mb8">Offers for this space ({offers.length})</h3>
      {offers.length === 0 ? <div className="small faint">None right now.</div> : offers.map((o) => {
        const r = o.annual / Math.max(1, bench);
        return (
          <div key={o.id} className="decision-card">
            <div className="row"><b>{o.brand}</b><Badge>{o.category}</Badge>{o.risk >= 50 && <Badge tone="bad">risk {o.risk}</Badge>}<span className="spacer" /><b><Money v={o.annual} />/yr</b></div>
            <div className="small muted mt8">{Math.round(r * 100)}% of benchmark · until {seasonLabel(o.expires)} · fit {o.fit} · lapses {fmtAbs(o.expiresDay)}{d ? ` · replaces ${d.brand}` : ''}</div>
            <div className="opts"><OfferActions o={o} d={decisionFor(o)} onResolve={onResolve} /></div>
          </div>
        );
      })}
    </div>
  );
}

function MediaRights({ c, central, onSign, onSellSeason }: { c: Club; central: number; onSign: (o: TvOffer) => void; onSellSeason: () => void }) {
  const w = useWorld();
  return (
    <div className="grid g2">
      <Card title="Local TV rights">
        {c.tv ? (
          <div className="kv">
            <span>Broadcaster</span><span>{c.tv.broadcaster} <Badge>{c.tv.kind}</Badge></span>
            <span>Annual fee</span><span>{c.tv.annual ? <Money v={c.tv.annual} /> : 'paid up front for this season'}</span>
            <span>Until</span><span>{seasonLabel(c.tv.expires)}</span>
            <span>Reach</span><span>{c.tv.reach}/100</span>
            <span>Digital boost</span><span>{c.tv.digitalBoost}/100</span>
            <span>Exclusive</span><span>{c.tv.exclusivity ? 'Yes' : 'No'}</span>
          </div>
        ) : (
          <>
            <Callout tone="warn">Your local TV rights are unsold. Sign a multi-year deal from the offers, or sell just this season's games for a lump sum today.</Callout>
            <div className="mt8"><Button onClick={onSellSeason}>Sell this season only (~{fmtMoney(Math.round(localTvBenchmark(w, c) * 0.9 / 1000) * 1000)})</Button></div>
          </>
        )}
        <div className="mt16 small muted">Central league distribution: <Money v={central} />/yr (paid monthly, merit-weighted by last finish). Local benchmark: <Money v={localTvBenchmark(w, c)} />/yr.</div>
      </Card>
      <Card title={`Broadcaster offers (${w.tvOffers.length})`}>
        {w.tvOffers.length === 0 && <div className="muted small">No offers on the table.</div>}
        <div className="col">
          {w.tvOffers.map((o) => (
            <div key={o.id} className="decision-card">
              <div className="row"><b>{o.broadcaster}</b><Badge>{o.kind}</Badge><span className="spacer" /><b><Money v={o.annual} />/yr</b></div>
              <div className="small muted">{BROADCASTER_PROFILE[o.kind].desc}</div>
              <div className="row small mt8">
                <span>Until {seasonLabel(o.expires)}</span><span>Reach {o.reach}</span><span>Digital {o.digitalBoost}</span>
                {o.exclusivity && <Badge tone="warn">Exclusive</Badge>}
                <span className="muted">lapses {fmtAbs(o.expiresDay)}</span>
                <span className="spacer" />
                <Button size="sm" variant="primary" onClick={() => onSign(o)}>Sign</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
