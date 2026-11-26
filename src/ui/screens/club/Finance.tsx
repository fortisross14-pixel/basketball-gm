import { useState } from 'react';
import type { LedgerCat } from '../../../engine/types';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { CAT_LABEL, cashForecast90, fiveYearForecast, loanOffer, payroll, playerCommitments, repayLoan, statement, takeLoan, totalDebt, type ForecastAssumptions } from '../../../engine/finance';
import { estimateRevenue } from '../../../engine/economy';
import { staffPayroll } from '../../../engine/staff';
import { fmtAbs, seasonLabel } from '../../../engine/calendar';
import { absDay } from '../../../engine/types';
import { Badge, BarChart, Button, Callout, Card, Modal, Money, NumberField, Page, Pills, Sparkline, Stat, Table, Tabs } from '../../components/ui';
import { useAct, useNotify, useWorld } from '../../store';

// budget lines mapped to ledger categories (annual approved budget vs actual)
const BUDGET_MAP: { label: string; cats: LedgerCat[]; key: 'payroll' | 'staff' | 'marketing' | 'scouting' | 'medical' | 'maintenance' | 'academy' }[] = [
  { label: 'Player payroll', cats: ['playerSalaries'], key: 'payroll' },
  { label: 'Staff', cats: ['staffSalaries'], key: 'staff' },
  { label: 'Marketing', cats: ['marketing'], key: 'marketing' },
  { label: 'Scouting', cats: ['scouting'], key: 'scouting' },
  { label: 'Medical', cats: ['medicalCost'], key: 'medical' },
  { label: 'Maintenance', cats: ['maintenance'], key: 'maintenance' },
  { label: 'Academy', cats: ['academyCost'], key: 'academy' },
];

export default function Finance() {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const [tab, setTab] = useState<'overview' | 'pnl' | 'forecast' | 'loans'>('overview');
  const est = estimateRevenue(w, c);
  const debt = totalDebt(c);
  const pr = payroll(w, c);
  const cur = statement(c, w.season);
  return (
    <Page title="Finance" subtitle={`Season ${seasonLabel(w.season)} · the balance sheet is gameplay`}>
      <div className="grid g4 mb8">
        <Stat label="Cash on hand" value={<Money v={c.finances.cash} />} tone={c.finances.cash < 0 ? 'bad' : undefined} sub={c.finances.overdueDays ? `Overdrawn for ${c.finances.overdueDays} days` : undefined} />
        <Stat label="Season result so far" value={<Money v={cur.net} signed tone />} sub={`Income ${fmtMoney(cur.totalIncome)} · costs ${fmtMoney(-cur.totalExpenses)}`} />
        <Stat label="Projected revenue (season)" value={<Money v={est.total} />} sub="At current prices, deals and demand" />
        <Stat label="Debt" value={<Money v={debt} />} sub={`${Math.round((debt / Math.max(1, est.total)) * 100)}% of revenue`} tone={debt / Math.max(1, est.total) > 1.2 ? 'bad' : undefined} />
      </div>
      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'pnl', label: 'Profit & loss' }, { id: 'forecast', label: '5-year forecast' }, { id: 'loans', label: `Loans (${c.finances.loans.length})` }]} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview est={est} pr={pr} />}
      {tab === 'pnl' && <Pnl />}
      {tab === 'forecast' && <ForecastTab />}
      {tab === 'loans' && <Loans />}
    </Page>
  );
}

function Overview({ est, pr }: { est: ReturnType<typeof estimateRevenue>; pr: number }) {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const fc = cashForecast90(w, c);
  const low = Math.min(...fc.map((x) => x.cash));
  const hist = c.finances.cashHistory;
  const budget = c.finances.budget;
  const staff = staffPayroll(w, c);
  const commitments = playerCommitments(w, c, 5);
  const revItems = [
    { label: 'Tickets', value: est.tickets + est.seasonTickets + est.suites },
    { label: 'Food & drink', value: est.concessions },
    { label: 'Merch', value: est.merch },
    { label: 'Sponsors', value: est.sponsors },
    { label: 'Media', value: est.tv },
    { label: 'Grants', value: est.grants },
  ];
  return (
    <div className="grid g2">
      <Card title="Next 90 days (weekly projection)">
        <Sparkline data={fc.map((x) => x.cash)} width={480} height={90} color={low < 0 ? 'var(--bad)' : 'var(--good)'} />
        <div className="row small mt8">
          <span>Today <Money v={fc[0].cash} /></span>
          <span className="spacer" />
          <span>Low point <Money v={low} tone /></span>
          <span className="spacer" />
          <span>In 13 weeks <Money v={fc[fc.length - 1].cash} /></span>
        </div>
        {low < 0 && <Callout tone="bad">Projected to go negative: cut costs, sell a player, take a loan or ask the board for funds.</Callout>}
      </Card>
      <Card title="Cash history">
        {hist.length > 1 ? <Sparkline data={hist.map((x) => x.cash)} width={480} height={90} /> : <div className="muted small">History builds week by week.</div>}
        <div className="row small mt8 muted">
          <span>{hist.length ? fmtAbs(hist[0].day) : ''}</span>
          <span className="spacer" />
          <span>{hist.length ? fmtAbs(hist[hist.length - 1].day) : ''}</span>
        </div>
      </Card>
      <Card title="Projected revenue mix (this season)">
        <BarChart items={revItems} height={120} format={(v) => fmtMoney(v)} />
      </Card>
      <Card title="Payroll & approved budgets">
        <table className="tbl">
          <thead><tr><th>Line</th><th className="r">Budget</th><th className="r">Committed</th><th className="r">Spent so far</th></tr></thead>
          <tbody>
            {BUDGET_MAP.map((b) => {
              const spent = -b.cats.reduce((a, cat) => a + (c.finances.seasonTotals[w.season]?.[cat] ?? 0), 0);
              const committed = b.key === 'payroll' ? pr : b.key === 'staff' ? staff : budget[b.key];
              return (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td className="r"><Money v={budget[b.key]} /></td>
                  <td className={`r ${committed > budget[b.key] * 1.02 ? 'bad' : ''}`}><Money v={committed} /></td>
                  <td className="r"><Money v={spent} /></td>
                </tr>
              );
            })}
            <tr><td>Transfer budget (remaining)</td><td className="r"><Money v={budget.transfer} /></td><td /><td /></tr>
          </tbody>
        </table>
      </Card>
      <Card title="Player salary commitments" className="span2">
        <BarChart items={commitments.map((x) => ({ label: seasonLabel(x.season), value: x.amount }))} height={100} format={(v) => fmtMoney(v)} />
      </Card>
    </div>
  );
}

function Pnl() {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const seasons = Object.keys(c.finances.seasonTotals).map(Number).sort((a, b) => b - a);
  const [season, setSeason] = useState(w.season);
  const s = statement(c, season);
  const prev = statement(c, season - 1);
  const prevVal = (cat: LedgerCat) => [...prev.income, ...prev.expenses].find((x) => x.cat === cat)?.amount ?? 0;
  const lines = (arr: { cat: LedgerCat; amount: number }[]) =>
    arr.map((x) => (
      <tr key={x.cat}>
        <td>{CAT_LABEL[x.cat]}</td>
        <td className="r"><Money v={x.amount} /></td>
        <td className="r muted"><Money v={prevVal(x.cat)} /></td>
      </tr>
    ));
  return (
    <div className="col">
      <div className="row">
        <span className="muted">Season</span>
        <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
          {seasons.map((x) => <option key={x} value={x}>{seasonLabel(x)}</option>)}
        </select>
        <span className="muted small">Loan proceeds and principal repayments are excluded (financing, not operations).</span>
      </div>
      <div className="grid g2">
        <Card title="Income">
          <table className="tbl">
            <thead><tr><th>Category</th><th className="r">{seasonLabel(season)}</th><th className="r">{seasonLabel(season - 1)}</th></tr></thead>
            <tbody>
              {lines(s.income)}
              <tr className="sep"><td><b>Total income</b></td><td className="r"><b><Money v={s.totalIncome} /></b></td><td className="r muted"><Money v={prev.totalIncome} /></td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="Expenses">
          <table className="tbl">
            <thead><tr><th>Category</th><th className="r">{seasonLabel(season)}</th><th className="r">{seasonLabel(season - 1)}</th></tr></thead>
            <tbody>
              {lines(s.expenses)}
              <tr className="sep"><td><b>Total expenses</b></td><td className="r"><b><Money v={s.totalExpenses} /></b></td><td className="r muted"><Money v={prev.totalExpenses} /></td></tr>
            </tbody>
          </table>
        </Card>
      </div>
      <Card>
        <div className="row">
          <h2>Net result</h2>
          <span className="spacer" />
          <h2><Money v={s.net} signed tone /></h2>
          <span className="muted">(prior season <Money v={prev.net} signed />)</span>
        </div>
      </Card>
    </div>
  );
}

function ForecastTab() {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const [a, setA] = useState<ForecastAssumptions>({ revenueGrowth: 0.03, payrollGrowth: 0.03, scenario: 'base' });
  const rows = fiveYearForecast(w, c, a);
  return (
    <div className="col">
      <Card title="Assumptions (editable)">
        <div className="row wrap gap16">
          <label className="field">Revenue growth per year (%)
            <NumberField value={Math.round(a.revenueGrowth * 100)} step={1} onChange={(v) => setA({ ...a, revenueGrowth: v / 100 })} width={80} />
          </label>
          <label className="field">Payroll growth per year (%)
            <NumberField value={Math.round(a.payrollGrowth * 100)} step={1} onChange={(v) => setA({ ...a, payrollGrowth: v / 100 })} width={80} />
          </label>
          <label className="field">Scenario
            <Pills options={[{ id: 'downside', label: 'Downside', title: '-5% revenue each year' }, { id: 'base', label: 'Base' }, { id: 'upside', label: 'Upside', title: '+4% revenue each year' }]} value={a.scenario} onChange={(v) => setA({ ...a, scenario: v })} />
          </label>
        </div>
        <p className="small muted mt8">Payroll uses the larger of signed commitments and the grown current payroll. "Other" = operations, maintenance, academy, medical, scouting and marketing budgets.</p>
      </Card>
      <Card title="Five-year outlook">
        <Table
          rows={rows}
          rowKey={(r) => r.season}
          columns={[
            { key: 's', label: 'Season', render: (r) => seasonLabel(r.season) },
            { key: 'rev', label: 'Revenue', render: (r) => <Money v={r.revenue} />, align: 'r' },
            { key: 'pay', label: 'Payroll', render: (r) => <Money v={-r.payroll} />, align: 'r' },
            { key: 'staff', label: 'Staff', render: (r) => <Money v={-r.staff} />, align: 'r' },
            { key: 'other', label: 'Other', render: (r) => <Money v={-r.other} />, align: 'r' },
            { key: 'debt', label: 'Debt service', render: (r) => <Money v={-r.debtService} />, align: 'r' },
            { key: 'net', label: 'Net', render: (r) => <Money v={r.net} signed tone />, align: 'r' },
            { key: 'cash', label: 'Cash at end', render: (r) => <Money v={r.cashEnd} tone />, align: 'r' },
          ]}
        />
        <div className="mt8"><Sparkline data={[c.finances.cash, ...rows.map((r) => r.cashEnd)]} width={600} height={70} /></div>
      </Card>
    </div>
  );
}

function Loans() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const [show, setShow] = useState(false);
  const now = absDay(w);
  return (
    <div className="col">
      <Card title="Active loans" actions={<Button variant="primary" onClick={() => setShow(true)}>Request a loan</Button>}>
        <Table
          rows={c.finances.loans}
          rowKey={(l) => l.id}
          empty="No debt. Banks lend up to 160% of annual revenue in total."
          columns={[
            { key: 'lender', label: 'Lender', render: (l) => l.lender },
            { key: 'principal', label: 'Principal', render: (l) => <Money v={l.principal} />, align: 'r' },
            { key: 'bal', label: 'Balance', render: (l) => <Money v={l.balance} />, align: 'r' },
            { key: 'rate', label: 'Rate', render: (l) => `${(l.rate * 100).toFixed(1)}%`, align: 'r' },
            { key: 'm', label: 'Monthly', render: (l) => <Money v={l.monthlyPayment} />, align: 'r' },
            { key: 'end', label: 'Ends', render: (l) => fmtAbs(l.endDay), align: 'r' },
            { key: 'left', label: 'Months left', render: (l) => Math.max(0, Math.round((l.endDay - now) / 30)), align: 'r' },
            {
              key: 'act', label: '', render: (l) => (
                <Button size="sm" onClick={() => {
                  const res = act((ww) => repayLoan(ww, c, l.id));
                  notify(res.ok ? 'Loan repaid early (2% fee).' : res.reason!, res.ok ? 'good' : 'bad');
                }}>Repay early</Button>
              ),
            },
          ]}
        />
      </Card>
      <Callout>The board watches debt: above ~80% of annual revenue the finance component of its trust starts to fall, and loan covenants alarm at 120%.</Callout>
      {show && <LoanModal onClose={() => setShow(false)} />}
    </div>
  );
}

function LoanModal({ onClose }: { onClose: () => void }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const [amount, setAmount] = useState(Math.round(estimateRevenue(w, c).total * 0.2 / 10000) * 10000);
  const [years, setYears] = useState(3);
  const offer = loanOffer(w, c, amount, years);
  return (
    <Modal title="Request a bank loan" onClose={onClose}>
      <div className="row wrap gap16">
        <label className="field">Amount
          <NumberField value={amount} step={25000} min={10000} prefix="€" width={150} onChange={setAmount} />
        </label>
        <label className="field">Term
          <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
            {[1, 2, 3, 5, 7, 10].map((y) => <option key={y} value={y}>{y} years</option>)}
          </select>
        </label>
      </div>
      <div className="mt16">
        {offer.ok ? (
          <div className="kv">
            <span>Interest rate</span><span>{(offer.rate * 100).toFixed(2)}% <Badge>{offer.rate > 0.1 ? 'expensive' : offer.rate > 0.07 ? 'moderate' : 'good terms'}</Badge></span>
            <span>Monthly payment</span><span><Money v={offer.monthly} /></span>
            <span>Total repaid</span><span><Money v={offer.monthly * years * 12} /> (interest <Money v={offer.monthly * years * 12 - amount} />)</span>
          </div>
        ) : (
          <Callout tone="bad">{offer.reason}</Callout>
        )}
      </div>
      <div className="row mt16">
        <span className="spacer" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!offer.ok} onClick={() => {
          const res = act((ww) => takeLoan(ww, c, amount, years));
          notify(res.ok ? `Loan of ${fmtMoney(amount)} received.` : res.reason!, res.ok ? 'good' : 'bad');
          if (res.ok) onClose();
        }}>Accept loan</Button>
      </div>
    </Modal>
  );
}
