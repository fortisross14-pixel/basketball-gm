import { useMemo, useState } from 'react';
import type { Club, SeatZone, Ticketing } from '../../../engine/types';
import { SEAT_ZONES } from '../../../engine/types';
import { avgLeaguePrestige, gameDemand, refPrice, seasonTicketTarget, suiteDemand, type GameDemand } from '../../../engine/economy';
import { buildCalendar, fmtDate } from '../../../engine/calendar';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { MODE_LABEL } from '../../../engine/delegation';
import { Badge, Button, Callout, Card, Money, NumberField, Page, Pills, Stat, Table } from '../../components/ui';
import { useAct, useNotify } from '../../store';
import { useUserClub } from './common';

const ZONE_LABEL: Record<SeatZone, string> = { general: 'General (upper)', lower: 'Lower bowl', premium: 'Courtside / club' };

export default function Tickets() {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const [draft, setDraft] = useState<Ticketing>(() => clone(c.ticketing));
  const cal = buildCalendar(w.season);
  const preview = useMemo(() => {
    const fake: Club = { ...c, ticketing: draft };
    const avgOpp = { prestige: c.leagueId ? avgLeaguePrestige(w, c.leagueId) : 70, rivals: [], id: -1 } as unknown as Club;
    const bigOpp = { prestige: 88, rivals: [], id: -2 } as unknown as Club;
    const cur = gameDemand(w, c, avgOpp, 'league', 1);
    return {
      cur,
      avg: gameDemand(w, fake, avgOpp, 'league', 1),
      big: gameDemand(w, fake, bigOpp, 'league', 1),
      promo: gameDemand(w, fake, avgOpp, 'league', 0),
      season: seasonTicketTarget(w, fake),
      suites: suiteDemand(w, fake),
    };
  }, [w, c, draft]);
  const set = (fn: (d: Ticketing) => void) => setDraft((d) => { const n = clone(d); fn(n); return n; });
  const deadlinePassed = w.day > cal.seasonTicketDeadline;
  const homeGames = w.fixtures.filter((f) => f.played && f.homeId === c.id && f.result && !f.neutral).sort((a, b) => b.day - a.day);
  const changed = JSON.stringify(draft) !== JSON.stringify(c.ticketing);
  const mode = w.user.delegation.tickets.mode;
  return (
    <Page
      title="Ticketing strategy"
      subtitle="Set prices and policies; the preview shows expected demand before you confirm."
      actions={<>
        <Button disabled={!changed} onClick={() => setDraft(clone(c.ticketing))}>Reset</Button>
        <Button variant="primary" disabled={!changed} onClick={() => { act((ww) => { getClub(ww, c.id).ticketing = clone(draft); }); notify('Ticket strategy applied.', 'good'); }}>Apply strategy</Button>
      </>}
    >
      {mode !== 'manual' && mode !== 'recommend' && (
        <Callout>Ticket pricing is delegated to your commercial director ({MODE_LABEL[mode]}): prices are re-optimised monthly and may override your changes. Change it in Settings → Delegation.</Callout>
      )}
      <div className="grid g4 mt8">
        <Stat label="Expected attendance" value={preview.avg.attendance.toLocaleString('en')} sub={`of ${preview.avg.capacity.toLocaleString('en')} · now ${preview.cur.attendance.toLocaleString('en')}`} />
        <Stat label="Gate per game" value={fmtMoney(preview.avg.ticketRevenue)} sub={`now ${fmtMoney(preview.cur.ticketRevenue)}`} />
        <Stat label="Big game gate" value={fmtMoney(preview.big.ticketRevenue)} sub={`${preview.big.attendance.toLocaleString('en')} fans`} />
        <Stat label="Food & drink per game" value={fmtMoney(preview.avg.concessions)} />
      </div>

      <div className="grid g2 mt16">
        <Card title="Prices by zone">
          <table className="tbl">
            <thead><tr><th>Zone</th><th className="r">Seats</th><th className="r">Fair price</th><th>Single game</th><th>Season ticket</th></tr></thead>
            <tbody>
              {SEAT_ZONES.map((z) => (
                <tr key={z}>
                  <td>{ZONE_LABEL[z]}</td>
                  <td className="r">{c.arena.seats[z].toLocaleString('en')}</td>
                  <td className="r muted" title="What fans consider fair for this market">{fmtMoney(refPrice(w, c, z))}</td>
                  <td><NumberField value={draft.prices[z]} min={1} prefix="€" width={80} onChange={(v) => set((d) => { d.prices[z] = Math.max(1, v); })} /></td>
                  <td><NumberField value={draft.seasonPrices[z]} min={1} step={10} prefix="€" width={90} onChange={(v) => set((d) => { d.seasonPrices[z] = Math.max(1, v); })} /></td>
                </tr>
              ))}
              <tr>
                <td>Suites ({c.arena.suites})</td><td className="r">{c.arena.suites}</td><td /><td className="muted small">per season</td>
                <td><NumberField value={draft.suitePrice} min={0} step={500} prefix="€" width={90} onChange={(v) => set((d) => { d.suitePrice = Math.max(0, v); })} /></td>
              </tr>
            </tbody>
          </table>
          <div className="small faint mt8">Prices well above the fair price erode fan sentiment week by week, even if you sell out.</div>
        </Card>
        <Card title="Policies">
          <div className="col">
            <div className="row"><span style={{ minWidth: 180 }}>Big-game markup</span><input type="range" min={0} max={0.6} step={0.05} value={draft.bigGameMarkup} onChange={(e) => set((d) => { d.bigGameMarkup = Number(e.target.value); })} /><b>+{Math.round(draft.bigGameMarkup * 100)}%</b></div>
            <div className="row"><span style={{ minWidth: 180 }}>Playoff markup</span><input type="range" min={0} max={1} step={0.05} value={draft.playoffMarkup} onChange={(e) => set((d) => { d.playoffMarkup = Number(e.target.value); })} /><b>+{Math.round(draft.playoffMarkup * 100)}%</b></div>
            <label className="row"><input type="checkbox" checked={draft.dynamicPricing} onChange={(e) => set((d) => { d.dynamicPricing = e.target.checked; })} /> Dynamic pricing <span className="small muted">— raises prices when demand exceeds supply, cuts them when the arena is half empty</span></label>
            <label className="row"><input type="checkbox" checked={draft.protectSeasonHolders} disabled={!draft.dynamicPricing} onChange={(e) => set((d) => { d.protectSeasonHolders = e.target.checked; })} /> Protect season-ticket holders <span className="small muted">— avoids the sentiment hit of dynamic pricing</span></label>
            <label className="row"><input type="checkbox" checked={draft.studentDiscount} onChange={(e) => set((d) => { d.studentDiscount = e.target.checked; })} /> Student discount <span className="small muted">— a little extra general demand</span></label>
            <div className="row">
              <span style={{ minWidth: 180 }}>Promotion nights</span>
              <Pills value={draft.promoNights} onChange={(v) => set((d) => { d.promoNights = v; })} options={[{ id: 'none', label: 'None' }, { id: 'monthly', label: 'Monthly' }, { id: 'biweekly', label: 'Biweekly' }, { id: 'weekly', label: 'Every game' }]} />
            </div>
            <div className="small faint">Promotion nights sell non-premium seats at 40% off: lower yield per seat, more first-time fans converted into local supporters.</div>
            <div className="small muted">Promo-night preview: {preview.promo.attendance.toLocaleString('en')} fans, gate {fmtMoney(preview.promo.ticketRevenue)}.</div>
          </div>
        </Card>
      </div>

      <div className="grid g2 mt16">
        <Card title="Preview by zone">
          <ZoneTable d={preview.avg} label="Average opponent" />
          <div className="mt16" />
          <ZoneTable d={preview.big} label="Big game (marquee opponent)" />
        </Card>
        <Card title="Season tickets & suites">
          <div className="small muted mb8">{deadlinePassed ? `The campaign closed on ${fmtDate(w.season, cal.seasonTicketDeadline, false)}; new season prices apply next summer.` : `Campaign closes ${fmtDate(w.season, cal.seasonTicketDeadline, false)}. Sales accrue weekly toward the target.`}</div>
          <table className="tbl">
            <thead><tr><th>Zone</th><th className="r">Sold</th><th className="r">Target at draft price</th><th className="r">Revenue</th></tr></thead>
            <tbody>
              {SEAT_ZONES.map((z) => (
                <tr key={z}>
                  <td>{ZONE_LABEL[z]}</td>
                  <td className="r">{c.ticketing.seasonSold[z].toLocaleString('en')}</td>
                  <td className="r">{preview.season[z].toLocaleString('en')}</td>
                  <td className="r"><Money v={c.ticketing.seasonSold[z] * c.ticketing.seasonPrices[z]} /></td>
                </tr>
              ))}
              <tr>
                <td>Suites</td>
                <td className="r">{c.ticketing.suitesSold}/{c.arena.suites}</td>
                <td className="r">{preview.suites} (demand)</td>
                <td className="r"><Money v={c.ticketing.suitesSold * c.ticketing.suitePrice} /></td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Recent home games" className="mt16">
        <Table
          rows={homeGames}
          rowKey={(f) => f.id}
          limit={20}
          empty="No home games played yet this season."
          columns={[
            { key: 'date', label: 'Date', render: (f) => fmtDate(w.season, f.day, false), sort: (f) => f.day },
            { key: 'opp', label: 'Opponent', render: (f) => getClub(w, f.awayId).name },
            { key: 'comp', label: 'Competition', render: (f) => <span className="small muted">{f.label}</span> },
            { key: 'res', label: 'Result', render: (f) => `${f.result!.home}–${f.result!.away}` },
            { key: 'att', label: 'Attendance', render: (f) => f.result!.attendance.toLocaleString('en'), sort: (f) => f.result!.attendance, align: 'r' },
            { key: 'occ', label: 'Occupancy', render: (f) => { const cap = c.arena.seats.general + c.arena.seats.lower + c.arena.seats.premium; const occ = f.result!.attendance / Math.max(1, cap); return <Badge tone={occ > 0.95 ? 'good' : occ < 0.6 ? 'bad' : undefined}>{Math.round(occ * 100)}%</Badge>; }, align: 'r' },
          ]}
        />
      </Card>
    </Page>
  );
}

function ZoneTable({ d, label }: { d: GameDemand; label: string }) {
  return (
    <div>
      <div className="small muted mb8">{label}{d.bigGame ? ' · markup applied' : ''}</div>
      <table className="tbl">
        <thead><tr><th>Zone</th><th className="r">Price</th><th className="r">Demand</th><th className="r">Holders</th><th className="r">Single sold</th><th className="r">Revenue</th></tr></thead>
        <tbody>
          {SEAT_ZONES.map((z) => {
            const x = d.zones[z];
            return (
              <tr key={z}>
                <td>{ZONE_LABEL[z]}</td>
                <td className="r">{fmtMoney(x.price)}</td>
                <td className="r">{x.demand.toLocaleString('en')}</td>
                <td className="r">{x.seasonHolders.toLocaleString('en')}</td>
                <td className="r">{x.sold.toLocaleString('en')} / {(x.capacity - x.seasonHolders).toLocaleString('en')}</td>
                <td className="r"><Money v={x.revenue} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function clone(t: Ticketing): Ticketing {
  return JSON.parse(JSON.stringify(t));
}
