import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Club, Decision, SponsorOffer, SponsorSlot, TvOffer } from '../../../engine/types';
import { SPONSOR_SLOTS, absDay } from '../../../engine/types';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { BROADCASTER_PROFILE, SLOT_INFO, centralTvAnnual, localTvBenchmark, sponsorBenchmark, exposure } from '../../../engine/economy';
import { signTv, sponsorSaturation } from '../../../engine/commercial';
import { resolveDecision } from '../../../engine/events';
import { seasonLabel, fmtAbs } from '../../../engine/calendar';
import { Badge, Button, Callout, Card, Money, Page, Stat, Table, Tabs } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { useAct, useNotify, useWorld } from '../../store';
import '../hubs/hubs.css';
import { RevenueDrive } from './RevenueDrive';
import { phaseOf } from '../../../engine/calendar';

type Tab = 'drive' | 'partners' | 'offers' | 'media' | 'department';

export default function Commercial() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const now = absDay(w);
  const [tab, setTab] = useState<Tab>(() => (['offseason', 'preseason'].includes(phaseOf(w.season, w.day)) ? 'drive' : 'partners'));
  const [sel, setSel] = useState<SponsorSlot>(() => SPONSOR_SLOTS.find((s) => !c.sponsors.some((x) => x.slot === s)) ?? 'shirt');
  const sponsorTotal = c.sponsors.reduce((a, s) => a + s.annual, 0);
  const offers: SponsorOffer[] = (w.sponsorOffers[c.id] ?? []).filter((o) => o.expiresDay >= now);
  const decisionFor = (o: SponsorOffer): Decision | undefined => w.decisions.find((d) => !d.resolved && d.kind === 'sponsorOffer' && d.payload.offerId === o.id);
  const central = centralTvAnnual(w, c, c.history[c.history.length - 1]?.rank);
  const sat = sponsorSaturation(c);

  const resolveOffer = (o: SponsorOffer, choice: string) => {
    const d = decisionFor(o);
    if (!d) return notify('This offer is no longer pending.', 'bad');
    const msg = act((ww) => resolveDecision(ww, d, choice));
    notify(msg, choice === 'reject' ? undefined : 'good');
  };

  return (
    <Page kicker={`${c.name} · commercial`} title="Sponsors & TV" subtitle="Sell your inventory carefully: every partner pays, but supporters only tolerate so many brands.">
      <div className="grid g4 mb8" style={{ marginBottom: 14 }}>
        <Stat label="Sponsorship / yr" value={<Money v={sponsorTotal} />} sub={`${c.sponsors.length} partners · ${SPONSOR_SLOTS.length - c.sponsors.length} slots free`} />
        <Stat label="Fan tolerance" value={`${sat.count} / ${sat.comfortable}`} tone={sat.penalty > 0 ? 'bad' : sat.count >= sat.comfortable ? 'warn' : 'good'} sub={sat.label} />
        <Stat label="Media rights / yr" value={<Money v={central + (c.tv?.annual ?? 0)} />} sub={c.tv ? `${c.tv.broadcaster} + central` : 'Central only — no local deal'} tone={!c.tv ? 'warn' : undefined} />
        <Stat label="Exposure" value={Math.round(exposure(c.fans)).toLocaleString('en')} sub="What sponsors pay for" />
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'drive', label: 'Revenue drive' },
          { id: 'partners', label: 'Partners' },
          { id: 'offers', label: `Offers (${offers.length})` },
          { id: 'media', label: `Media rights${w.tvOffers.length ? ` (${w.tvOffers.length})` : ''}` },
          { id: 'department', label: 'Commercial department' },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === 'drive' && <RevenueDrive />}
          {tab === 'partners' && (
            <div className="col gap16">
              <ToleranceCard c={c} />
              <div className="kit-stage">
                <Card title="Your inventory">
                  <KitAndCourt c={c} sel={sel} onSel={setSel} offers={offers} />
                  <div className="slot-list mt8">
                    {SPONSOR_SLOTS.map((s) => {
                      const d = c.sponsors.find((x) => x.slot === s);
                      const pending = offers.filter((o) => o.slot === s).length;
                      return (
                        <button key={s} type="button" className={`slot-chip ${sel === s ? 'sel' : ''}`} onClick={() => setSel(s)}>
                          <span className="sc-label">{SLOT_INFO[s].label}</span>
                          <span className="sc-brand">{d ? d.brand : <span className="faint">Available</span>}</span>
                          <span className="small muted">{d ? `${fmtMoney(d.annual)}/yr · to ${seasonLabel(d.expires)}` : `worth ~${fmtMoney(sponsorBenchmark(w, c, s))}`}{pending ? ` · ${pending} offer` : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
                <AnimatePresence mode="wait">
                  <motion.div key={sel} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <SlotPanel c={c} slot={sel} offers={offers.filter((o) => o.slot === sel)} decisionFor={decisionFor} onResolve={resolveOffer} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
          {tab === 'offers' && (
            <Card title={`Sponsor offers (${offers.length})`}>
              <Table
                rows={offers}
                rowKey={(o) => o.id}
                empty="No pending offers. Empty slots attract more offers each week; a better commercial director attracts better ones."
                columns={[
                  { key: 'b', label: 'Brand', render: (o) => <span>{o.brand} <span className="muted small">{o.category}</span></span> },
                  { key: 's', label: 'Slot', render: (o) => SLOT_INFO[o.slot].label },
                  { key: 'a', label: 'Annual', render: (o) => <Money v={o.annual} />, align: 'r' },
                  { key: 'vs', label: 'vs benchmark', render: (o) => { const r = o.annual / Math.max(1, sponsorBenchmark(w, c, o.slot)); return <span className={r >= 1 ? 'good' : r < 0.85 ? 'bad' : ''}>{Math.round(r * 100)}%</span>; }, align: 'r' },
                  { key: 'y', label: 'Until', render: (o) => seasonLabel(o.expires), align: 'r' },
                  { key: 'r', label: 'Fit / risk', render: (o) => <span className="row gap4"><Badge>{o.fit} fit</Badge>{o.risk >= 50 && <Badge tone="bad" title="Supporters may protest">risk {o.risk}</Badge>}</span> },
                  { key: 'e', label: 'Lapses', render: (o) => fmtAbs(o.expiresDay), align: 'r' },
                  { key: 'act', label: '', render: (o) => <OfferActions o={o} d={decisionFor(o)} onResolve={resolveOffer} /> },
                ]}
              />
            </Card>
          )}
          {tab === 'media' && <MediaRights c={c} central={central} onSign={(o) => { act((ww) => signTv(ww, c, o)); notify(`Media deal signed with ${o.broadcaster}: ${fmtMoney(o.annual)}/yr.`, 'good'); }} />}
          {tab === 'department' && <StaffPanel roles={['commercialDirector']} title="Commercial department" />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function ToleranceCard({ c }: { c: Club }) {
  const sat = sponsorSaturation(c);
  const max = SPONSOR_SLOTS.length;
  return (
    <Card title="How many brands will your fans accept?">
      <div className="row" style={{ alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1 }}>
          <div className="tolerance">
            <span className="tol-limit" style={{ left: `${(sat.comfortable / max) * 100}%` }} title="Comfort limit" />
            <span className="tol-mark" style={{ left: `calc(${(sat.count / max) * 100}% - 2px)` }} />
          </div>
          <div className="row small muted mt8"><span>0 partners</span><span className="spacer" /><span>Comfort limit: {sat.comfortable}</span><span className="spacer" /><span>{max} (sold out)</span></div>
        </div>
        <div style={{ maxWidth: 360 }} className="small">
          <b className={sat.penalty > 0 ? 'bad' : 'good'}>{sat.label}.</b> Each partner beyond the limit costs fan sentiment every week, and risky categories (betting, crypto…) cost extra. Loyal fanbases tolerate a little more.
          {sat.penalty > 0 && <div className="bad mt8">Current sentiment drag: −{sat.penalty} on the weekly target.</div>}
        </div>
      </div>
    </Card>
  );
}

/** Kit + court illustration with a hotspot per sponsorship slot. */
function KitAndCourt({ c, sel, onSel, offers }: { c: Club; sel: SponsorSlot; onSel: (s: SponsorSlot) => void; offers: SponsorOffer[] }) {
  const deal = (s: SponsorSlot) => c.sponsors.find((x) => x.slot === s);
  const [a, b] = c.colors;
  const spots: { slot: SponsorSlot; x: number; y: number }[] = [
    { slot: 'shirt', x: 146, y: 95 },
    { slot: 'shirtSecondary', x: 30, y: 40 },
    { slot: 'naming', x: 534, y: 46 },
    { slot: 'court', x: 438, y: 120 },
    { slot: 'local1', x: 248, y: 207 },
    { slot: 'local2', x: 358, y: 207 },
    { slot: 'local3', x: 468, y: 207 },
    { slot: 'digital', x: 600, y: 40 },
  ];
  const brandText = (s: SponsorSlot, max = 12) => { const d = deal(s); return d ? (d.brand.length > max ? `${d.brand.slice(0, max - 1)}…` : d.brand) : ''; };
  return (
    <svg viewBox="0 0 620 232" role="img" aria-label="Sponsorship inventory: kit, court, arena and digital">
      <defs>
        <linearGradient id="kitg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={a} stopOpacity="0.75" /></linearGradient>
        <linearGradient id="courtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98b4b" /><stop offset="1" stopColor="#8a5a2b" /></linearGradient>
      </defs>
      {/* jersey */}
      <g>
        <path d="M60 30 L80 18 Q96 30 112 18 L132 30 L160 46 L148 74 L134 66 L134 190 L58 190 L58 66 L44 74 L32 46 Z" fill="url(#kitg)" stroke={b} strokeWidth="3" />
        <path d="M80 18 Q96 38 112 18" fill="none" stroke={b} strokeWidth="4" />
        <rect x="64" y="84" width="64" height="22" rx="3" fill={deal('shirt') ? '#fff' : 'rgba(255,255,255,.12)'} stroke={deal('shirt') ? 'none' : '#fff'} strokeDasharray="4 3" />
        <text x="96" y="99" textAnchor="middle" fontSize="10" fontWeight="800" fill="#111" fontFamily="'Barlow Condensed', sans-serif">{brandText('shirt', 13)}</text>
        <text x="96" y="150" textAnchor="middle" fontSize="40" fontWeight="900" fontStyle="italic" fill={b} fontFamily="'Barlow Condensed', sans-serif">{c.abbrev}</text>
        <text x="96" y="214" textAnchor="middle" fontSize="11" fill="#9fb1d8" fontFamily="Inter, sans-serif">Kit</text>
      </g>
      {/* arena + court */}
      <g>
        <rect x="200" y="36" width="320" height="20" rx="3" fill={deal('naming') ? 'rgba(255,138,31,.85)' : 'rgba(255,255,255,.08)'} stroke="#fff" strokeOpacity=".3" />
        <text x="360" y="50" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{deal('naming') ? `${brandText('naming', 22)} ARENA` : c.arena.name.toUpperCase()}</text>
        <path d="M220 70 L500 70 L540 170 L180 170 Z" fill="url(#courtg)" stroke="#f5deb3" strokeWidth="2" />
        <line x1="360" y1="70" x2="360" y2="170" stroke="#f5deb3" strokeWidth="2" />
        <ellipse cx="360" cy="120" rx="34" ry="16" fill="none" stroke="#f5deb3" strokeWidth="2" />
        <rect x="300" y="112" width="120" height="16" rx="2" fill={deal('court') ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.18)'} />
        <text x="360" y="124" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{brandText('court', 18)}</text>
        {(['local1', 'local2', 'local3'] as SponsorSlot[]).map((s, i) => (
          <g key={s}>
            <rect x={196 + i * 110} y="176" width="104" height="16" rx="2" fill={deal(s) ? '#0b1734' : 'rgba(255,255,255,.06)'} stroke={deal(s) ? b : '#fff'} strokeOpacity={deal(s) ? 1 : 0.3} strokeDasharray={deal(s) ? undefined : '4 3'} />
            <text x={248 + i * 110} y="188" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="'Barlow Condensed', sans-serif">{brandText(s, 16)}</text>
          </g>
        ))}
        <text x="540" y="226" textAnchor="end" fontSize="11" fill="#9fb1d8" fontFamily="Inter, sans-serif">Arena & court</text>
      </g>
      {/* digital */}
      <g>
        <rect x="540" y="34" width="44" height="76" rx="8" fill="#0b1734" stroke="#36d1ff" strokeWidth="2" />
        <rect x="546" y="44" width="32" height="54" rx="3" fill={deal('digital') ? 'rgba(54,209,255,.35)' : 'rgba(255,255,255,.06)'} />
        <text x="562" y="128" textAnchor="middle" fontSize="11" fill="#9fb1d8" fontFamily="Inter, sans-serif">Digital</text>
      </g>
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
      <Button size="sm" onClick={() => onResolve(o, 'counter')} title="Ask for +15%: they may walk away and the slot is then locked for ~4 weeks">+15%</Button>
      <Button size="sm" variant="ghost" onClick={() => onResolve(o, 'reject')}>Decline</Button>
    </span>
  );
}

function SlotPanel({ c, slot, offers, decisionFor, onResolve }: { c: Club; slot: SponsorSlot; offers: SponsorOffer[]; decisionFor: (o: SponsorOffer) => Decision | undefined; onResolve: (o: SponsorOffer, choice: string) => void }) {
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
          {locked ? 'Brands are avoiding this slot for a few weeks after a failed counter-offer.' : 'Offers arrive weekly; empty slots and a strong commercial director attract more of them.'}
          {sat.count >= sat.comfortable && ' You are at the fans\' comfort limit: another partner will cost sentiment.'}
        </p>
      )}
      <h3 className="mt16 mb8">Offers for this slot ({offers.length})</h3>
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

function MediaRights({ c, central, onSign }: { c: Club; central: number; onSign: (o: TvOffer) => void }) {
  const w = useWorld();
  return (
    <div className="grid g2">
      <Card title="Current deal">
        {c.tv ? (
          <div className="kv">
            <span>Broadcaster</span><span>{c.tv.broadcaster} <Badge>{c.tv.kind}</Badge></span>
            <span>Annual fee</span><span><Money v={c.tv.annual} /></span>
            <span>Until</span><span>{seasonLabel(c.tv.expires)}</span>
            <span>Reach</span><span>{c.tv.reach}/100</span>
            <span>Digital boost</span><span>{c.tv.digitalBoost}/100</span>
            <span>Exclusive</span><span>{c.tv.exclusivity ? 'Yes' : 'No'}</span>
          </div>
        ) : (
          <Callout tone="warn">No local media deal. Broadcasters bid at the start of each season and occasionally during it while the slot is free.</Callout>
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
