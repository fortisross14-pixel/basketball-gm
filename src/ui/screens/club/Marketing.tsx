import { Link } from 'react-router-dom';
import type { CampaignKind } from '../../../engine/types';
import { club as getClub, fmtMoney, staffRating } from '../../../engine/world';
import { CAMPAIGNS, campaignWeeklyCost, startCampaign, stopCampaign } from '../../../engine/commercial';
import { exposure, merchDemandUnits, MERCH_LINES } from '../../../engine/economy';
import { buildCalendar } from '../../../engine/calendar';
import { Badge, Button, Card, Meter, Money, Page, Stat, Table } from '../../components/ui';
import { StaffPanel } from '../../helpers';
import { useAct, useNotify, useWorld } from '../../store';

const SEGMENTS: { key: 'local' | 'regional' | 'national' | 'international' | 'digital'; label: string; note: string }[] = [
  { key: 'local', label: 'Local core', note: 'Fills the arena, buys season tickets.' },
  { key: 'regional', label: 'Regional', note: 'Occasional attendance; merch and TV.' },
  { key: 'national', label: 'National', note: 'Drives media value and sponsor exposure.' },
  { key: 'international', label: 'International', note: 'Online merch, global sponsors.' },
  { key: 'digital', label: 'Digital followers', note: 'Social reach; digital partner value.' },
];

export default function Marketing() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const f = c.fans;
  const weeklySpend = c.campaigns.reduce((a, x) => a + x.weeklyCost, 0);
  const cal = buildCalendar(w.season);
  const mkt = staffRating(w, c, 'marketingDirector');
  const spentSeason = -(c.finances.seasonTotals[w.season]?.marketing ?? 0);
  return (
    <Page title="Marketing & Fans" subtitle="Grow the fanbase segment by segment — each one pays differently">
      <div className="grid g4 mb8">
        <Stat label="Fan sentiment" value={`${Math.round(f.sentiment)}/100`} tone={f.sentiment < 45 ? 'bad' : f.sentiment > 65 ? 'good' : undefined} sub="Prices, results, decisions" />
        <Stat label="Hype" value={`${Math.round(f.hype)}/100`} sub="Short-term buzz" />
        <Stat label="Loyalty" value={`${Math.round(f.loyalty)}/100`} sub="Season-ticket conversion" />
        <Stat label="Marketing spend" value={<Money v={spentSeason} />} sub={`Budget ${fmtMoney(c.finances.budget.marketing)} · now ${fmtMoney(weeklySpend)}/wk`} tone={spentSeason > c.finances.budget.marketing ? 'warn' : undefined} />
      </div>
      <div className="grid g2">
        <Card title="Fanbase segments">
          <table className="tbl">
            <thead><tr><th>Segment</th><th className="r">Fans</th><th>Why it matters</th></tr></thead>
            <tbody>
              {SEGMENTS.map((s) => (
                <tr key={s.key}><td>{s.label}</td><td className="r num">{Math.round(f[s.key]).toLocaleString('en')}</td><td className="small muted">{s.note}</td></tr>
              ))}
              <tr className="sep"><td><b>Weighted exposure</b></td><td className="r num"><b>{Math.round(exposure(f)).toLocaleString('en')}</b></td><td className="small muted">Used for sponsor valuations.</td></tr>
            </tbody>
          </table>
          <div className="col mt8">
            <Meter label="Sentiment" value={f.sentiment} />
            <Meter label="Hype" value={f.hype} />
            <Meter label="Loyalty" value={f.loyalty} />
          </div>
        </Card>
        <Card title="Running campaigns">
          <Table
            rows={c.campaigns}
            rowKey={(x) => x.id}
            empty="No campaigns running."
            columns={[
              { key: 'k', label: 'Campaign', render: (x) => CAMPAIGNS[x.kind].label },
              { key: 'w', label: 'Weeks left', render: (x) => x.weeksLeft, align: 'r' },
              { key: 'c', label: 'Cost/wk', render: (x) => <Money v={x.weeklyCost} />, align: 'r' },
              { key: 'i', label: 'Effect', render: (x) => `×${x.intensity.toFixed(2)}`, align: 'r', title: 'Effectiveness from your marketing director' },
              { key: 'a', label: '', render: (x) => <Button size="sm" variant="danger" onClick={() => { act(() => stopCampaign(c, x.id)); notify(`${CAMPAIGNS[x.kind].label} stopped.`); }}>Stop</Button> },
            ]}
          />
          <div className="mt16">
            <h3>Merchandise</h3>
            <div className="small mt8">
              Expected demand this season: <b>{merchDemandUnits(w, c).toLocaleString('en')}</b> units · lines: {c.merch.lines.map((l) => MERCH_LINES[l].label).join(', ')} · stock value <Money v={c.merch.stockValue} />.
            </div>
            <div className="mt8"><Link className="link" to="/infrastructure/stores">Manage stores, product lines and pricing →</Link></div>
          </div>
        </Card>
        <Card title="Launch a campaign" className="span2">
          <p className="small muted">Campaign effectiveness scales with your marketing director (rating {mkt}). Campaigns are charged weekly from cash.</p>
          <Table
            rows={Object.keys(CAMPAIGNS) as CampaignKind[]}
            rowKey={(k) => k}
            columns={[
              { key: 'n', label: 'Campaign', render: (k) => <b>{CAMPAIGNS[k].label}</b> },
              { key: 'd', label: 'What it does', render: (k) => <span className="small muted" style={{ whiteSpace: 'normal' }}>{CAMPAIGNS[k].desc}</span> },
              { key: 'w', label: 'Weeks', render: (k) => CAMPAIGNS[k].weeks, align: 'r' },
              { key: 'c', label: 'Cost/wk', render: (k) => <Money v={campaignWeeklyCost(w, c, k)} />, align: 'r' },
              { key: 't', label: 'Total', render: (k) => <Money v={campaignWeeklyCost(w, c, k) * CAMPAIGNS[k].weeks} />, align: 'r' },
              {
                key: 'a', label: '', render: (k) => {
                  const running = c.campaigns.some((x) => x.kind === k);
                  const closed = (k === 'seasonTicketDrive' && w.day > cal.seasonTicketDeadline) || (k === 'internationalTour' && w.day > 85);
                  if (running) return <Badge tone="good">Running</Badge>;
                  return (
                    <Button size="sm" variant="primary" disabled={closed} title={closed ? 'Not available at this point of the season' : undefined} onClick={() => {
                      const res = act((ww) => startCampaign(ww, c, k));
                      notify(res.message, res.ok ? 'good' : 'bad');
                    }}>Launch</Button>
                  );
                },
              },
            ]}
          />
        </Card>
        <div className="span2"><StaffPanel roles={['marketingDirector']} title="Marketing department" /></div>
      </div>
    </Page>
  );
}
