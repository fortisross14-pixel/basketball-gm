import type { Decision, SponsorOffer } from '../../../engine/types';
import { SPONSOR_SLOTS, absDay } from '../../../engine/types';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { BROADCASTER_PROFILE, SLOT_INFO, centralTvAnnual, localTvBenchmark, sponsorBenchmark, exposure } from '../../../engine/economy';
import { signTv } from '../../../engine/commercial';
import { resolveDecision } from '../../../engine/events';
import { seasonLabel, fmtAbs } from '../../../engine/calendar';
import { Badge, Button, Callout, Card, Money, Page, Stat, Table } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { useAct, useNotify, useWorld } from '../../store';

export default function Commercial() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const now = absDay(w);
  const sponsorTotal = c.sponsors.reduce((a, s) => a + s.annual, 0);
  const offers: SponsorOffer[] = (w.sponsorOffers[c.id] ?? []).filter((o) => o.expiresDay >= now);
  const decisionFor = (o: SponsorOffer): Decision | undefined => w.decisions.find((d) => !d.resolved && d.kind === 'sponsorOffer' && d.payload.offerId === o.id);
  const central = centralTvAnnual(w, c, c.history[c.history.length - 1]?.rank);
  const slots = SPONSOR_SLOTS.filter((s) => s !== 'naming' || c.arena.owned || c.leagueId === 'ELITE' || c.sponsors.some((x) => x.slot === 'naming'));

  const resolveOffer = (o: SponsorOffer, choice: string) => {
    const d = decisionFor(o);
    if (!d) {
      notify('This offer is no longer pending.', 'bad');
      return;
    }
    const msg = act((ww) => resolveDecision(ww, d, choice));
    notify(msg, choice === 'reject' ? undefined : 'good');
  };

  return (
    <Page title="Sponsors & TV" subtitle="Commercial inventory: brand partners and media rights">
      <div className="grid g4 mb8">
        <Stat label="Sponsorship (annual)" value={<Money v={sponsorTotal} />} sub={`${c.sponsors.length}/${slots.length} slots filled`} />
        <Stat label="Central TV" value={<Money v={central} />} sub={c.leagueId ? `${w.rules.leagues[c.leagueId].name} distribution` : ''} />
        <Stat label="Local media deal" value={<Money v={c.tv?.annual ?? 0} />} sub={c.tv ? `${c.tv.broadcaster} to ${c.tv.expires + 1}` : 'No deal'} tone={!c.tv ? 'warn' : undefined} />
        <Stat label="Exposure" value={Math.round(exposure(c.fans)).toLocaleString('en')} sub="Fans weighted by sponsor value" />
      </div>
      <div className="grid g2">
        <Card title="Sponsorship slots" className="span2">
          <Table
            rows={slots}
            rowKey={(s) => s}
            columns={[
              { key: 'slot', label: 'Slot', render: (s) => SLOT_INFO[s].label },
              { key: 'brand', label: 'Partner', render: (s) => { const d = c.sponsors.find((x) => x.slot === s); return d ? <span>{d.brand} <span className="muted small">({d.category})</span></span> : <span className="faint">— empty —</span>; } },
              { key: 'annual', label: 'Annual', render: (s) => { const d = c.sponsors.find((x) => x.slot === s); return d ? <Money v={d.annual} /> : '—'; }, align: 'r' },
              { key: 'bench', label: 'Market benchmark', render: (s) => <Money v={sponsorBenchmark(w, c, s)} />, align: 'r', title: 'What this slot is worth today given your fans, prestige and tier' },
              { key: 'exp', label: 'Expires', render: (s) => { const d = c.sponsors.find((x) => x.slot === s); return d ? <span className={d.expires <= w.season ? 'warn' : ''}>{seasonLabel(d.expires)}</span> : ''; }, align: 'r' },
              { key: 'fit', label: 'Fit / risk', render: (s) => { const d = c.sponsors.find((x) => x.slot === s); return d ? <span className="row gap4"><Badge>{d.fit} fit</Badge>{d.risk >= 50 && <Badge tone="bad">risk {d.risk}</Badge>}</span> : ''; } },
              { key: 'bonus', label: 'Bonuses', render: (s) => { const d = c.sponsors.find((x) => x.slot === s); return d && (d.promoBonus || d.titleBonus) ? <span className="small">{d.promoBonus ? `promo ${fmtMoney(d.promoBonus)} ` : ''}{d.titleBonus ? `title ${fmtMoney(d.titleBonus)}` : ''}</span> : ''; } },
            ]}
          />
          <p className="small muted mt8">Offers arrive during the week; a stronger commercial director attracts more and better ones. Delegate sponsorship in Settings to let them sign deals above your floor automatically.</p>
        </Card>
        <Card title={`Sponsor offers (${offers.length})`} className="span2">
          <Table
            rows={offers}
            rowKey={(o) => o.id}
            empty="No pending offers."
            columns={[
              { key: 'b', label: 'Brand', render: (o) => <span>{o.brand} <span className="muted small">{o.category}</span></span> },
              { key: 's', label: 'Slot', render: (o) => SLOT_INFO[o.slot].label },
              { key: 'a', label: 'Annual', render: (o) => <Money v={o.annual} />, align: 'r' },
              { key: 'vs', label: 'vs benchmark', render: (o) => { const r = o.annual / Math.max(1, sponsorBenchmark(w, c, o.slot)); return <span className={r >= 1 ? 'good' : r < 0.85 ? 'bad' : ''}>{Math.round(r * 100)}%</span>; }, align: 'r' },
              { key: 'y', label: 'Until', render: (o) => seasonLabel(o.expires), align: 'r' },
              { key: 'r', label: 'Fit / risk', render: (o) => <span className="row gap4"><Badge>{o.fit} fit</Badge>{o.risk >= 50 && <Badge tone="bad" title="Supporters may protest">risk {o.risk}</Badge>}</span> },
              { key: 'cur', label: 'Replaces', render: (o) => { const d = c.sponsors.find((x) => x.slot === o.slot); return d ? `${d.brand} (${fmtMoney(d.annual)})` : <span className="faint">empty slot</span>; } },
              { key: 'rec', label: 'Advice', render: (o) => { const d = decisionFor(o); return d?.recommended ? <Badge tone="info">{d.recommended}</Badge> : ''; } },
              { key: 'e', label: 'Lapses', render: (o) => fmtAbs(o.expiresDay), align: 'r' },
              {
                key: 'act', label: '', render: (o) => decisionFor(o) ? (
                  <span className="row gap4">
                    <Button size="sm" variant="primary" onClick={() => resolveOffer(o, 'accept')}>Sign</Button>
                    <Button size="sm" onClick={() => resolveOffer(o, 'counter')} title="Ask for +15%: they may walk away">+15%</Button>
                    <Button size="sm" variant="ghost" onClick={() => resolveOffer(o, 'reject')}>Decline</Button>
                  </span>
                ) : <span className="faint small">handled</span>,
              },
            ]}
          />
        </Card>
        <Card title="Media rights">
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
            <Callout tone="warn">No local media deal. Offers arrive at the start of each season when the slot is free.</Callout>
          )}
          <div className="mt16 small muted">
            Central league distribution: <Money v={central} />/yr (paid monthly, merit-weighted by last finish). Local benchmark: <Money v={localTvBenchmark(w, c)} />/yr.
          </div>
        </Card>
        <Card title={`Broadcaster offers (${w.tvOffers.length})`}>
          {w.tvOffers.length === 0 && <div className="muted small">No offers on the table.</div>}
          <div className="col">
            {w.tvOffers.map((o) => (
              <div key={o.id} className="list-item">
                <div className="row">
                  <b>{o.broadcaster}</b>
                  <Badge>{o.kind}</Badge>
                  <span className="spacer" />
                  <b><Money v={o.annual} />/yr</b>
                </div>
                <div className="small muted">{BROADCASTER_PROFILE[o.kind].desc}</div>
                <div className="row small mt8">
                  <span>Until {seasonLabel(o.expires)}</span>
                  <span>Reach {o.reach}</span>
                  <span>Digital {o.digitalBoost}</span>
                  {o.exclusivity && <Badge tone="warn">Exclusive</Badge>}
                  <span className="muted">lapses {fmtAbs(o.expiresDay)}</span>
                  <span className="spacer" />
                  <Button size="sm" variant="primary" onClick={() => { act((ww) => signTv(ww, c, o)); notify(`Media deal signed with ${o.broadcaster}: ${fmtMoney(o.annual)}/yr.`, 'good'); }}>Sign</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="span2"><StaffPanel roles={['commercialDirector']} title="Commercial department" /></div>
      </div>
    </Page>
  );
}
