import { EvaluationCard } from '../../components/career';
import { useState } from 'react';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { promise, requestBudgetIncrease, requestInjection } from '../../../engine/board';
import { estimateRevenue } from '../../../engine/economy';
import { fmtAbs, seasonLabel } from '../../../engine/calendar';
import { absDay } from '../../../engine/types';
import { Badge, Button, Callout, Card, Meter, Money, NumberField, Page, Stat, Table } from '../../components/ui';
import { useAct, useNotify, useWorld } from '../../store';

const TRUST_LABEL: Record<string, string> = {
  results: 'Results (33%)',
  finances: 'Finances (25%)',
  fans: 'Fans (14%)',
  media: 'Media (8%)',
  promises: 'Promises kept (10%)',
  relationship: 'Relationship (10%)',
};

export default function Board() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const b = c.board;
  const owner = w.user.role === 'owner';
  const [amount, setAmount] = useState(Math.round(estimateRevenue(w, c).total * 0.05 / 10000) * 10000);
  const [lastMsg, setLastMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const now = absDay(w);

  return (
    <Page tone="quiet" title="Board" subtitle={`${b.owner} · ${owner ? 'You are the owner-president' : 'You answer to the board'}`}>
      <div className="mb8"><EvaluationCard /></div>
      <div className="grid g4 mb8">
        <Stat label="Board confidence" value={`${b.overall}/100`} tone={b.overall < 40 ? 'bad' : b.overall > 65 ? 'good' : undefined} sub={owner ? 'Owners cannot be fired — but can go bankrupt' : 'Below ~30 risks an ultimatum'} />
        <Stat label="Autonomy" value={b.autonomy === 'full' ? 'Full' : 'Restricted'} tone={b.autonomy === 'restricted' ? 'warn' : undefined} sub={b.autonomy === 'restricted' ? 'Big salaries need approval' : 'Act freely within budget'} />
        <Stat label="Owner wealth" value={`${b.ownerWealth}/100`} sub={`Ambition ${b.ambition} · patience ${b.patience} · risk ${b.riskAppetite}`} />
        {owner ? <Stat label="Your personal wealth" value={<Money v={w.user.personalWealth} />} sub="Available to inject" /> : <Stat label="Executive reputation" value={`${w.user.reputation}/100`} sub="Drives job offers" />}
      </div>
      {b.ultimatum && (
        <Callout tone="bad">
          <b>Ultimatum:</b> {b.ultimatum.objective}. Deadline {fmtAbs(b.ultimatum.day)} ({Math.max(0, b.ultimatum.day - now)} days).
        </Callout>
      )}
      <div className="grid g2 mt8">
        <Card title="Strategic plan">
          <div className="kv">
            <span>Horizon</span><span>{b.plan.years} years</span>
            <span>Vision</span><span>{b.plan.vision}</span>
            <span>Competitive target</span><span>{b.plan.competitiveTarget}</span>
            <span>Profit tolerance</span><span>{b.plan.profitTolerance}</span>
            <span>Development</span><span>{b.plan.development}</span>
          </div>
        </Card>
        <Card title="Trust components">
          <div className="col">
            {Object.entries(b.trust).map(([k, v]) => <Meter key={k} label={TRUST_LABEL[k] ?? k} value={v} />)}
          </div>
        </Card>
        <Card title="Season objectives" className="span2">
          <Table
            rows={b.objectives}
            rowKey={(o) => o.id}
            empty="No objectives set."
            columns={[
              { key: 'l', label: 'Objective', render: (o) => <span>{o.label} {o.promise && <Badge tone="accent">Promised</Badge>}</span> },
              { key: 'w', label: 'Weight', render: (o) => '●'.repeat(o.weight), align: 'c' },
              { key: 'p', label: 'Progress', render: (o) => <div style={{ width: 160 }}><Meter value={o.progress * 100} /></div> },
              { key: 's', label: 'Status', render: (o) => <Badge tone={o.status === 'met' ? 'good' : o.status === 'failed' ? 'bad' : o.progress >= 1 ? 'good' : 'info'}>{o.status === 'pending' ? (o.progress >= 1 ? 'On track' : 'In progress') : o.status}</Badge> },
              {
                key: 'a', label: '', render: (o) => !o.promise && o.status === 'pending' ? (
                  <Button size="sm" title="Publicly commit: +relationship now, bigger trust swing at season end" onClick={() => { act((ww) => promise(ww, c, o)); notify('Promise made to the board. Keeping it will boost trust; breaking it will hurt.', 'warn'); }}>Promise</Button>
                ) : null,
              },
            ]}
          />
        </Card>
        <Card title="Requests to the board">
          <div className="col">
            {!owner && (
              <div>
                <div className="row">
                  <span>Increase payroll budget by</span>
                  <NumberField value={amount} step={10000} min={10000} prefix="€" width={130} onChange={setAmount} />
                  <Button onClick={() => { const r = act((ww) => requestBudgetIncrease(ww, c, amount)); setLastMsg(r); notify(r.message, r.ok ? 'good' : 'bad'); }}>Ask</Button>
                </div>
                <div className="small muted mt8">Current payroll budget: {fmtMoney(c.finances.budget.payroll)}. Each request costs a little relationship; approvals depend on ambition, wealth and confidence.</div>
              </div>
            )}
            {owner && (
              <div className="row">
                <span>Raise payroll budget (as owner)</span>
                <NumberField value={amount} step={10000} min={10000} prefix="€" width={130} onChange={setAmount} />
                <Button onClick={() => { act(() => { c.finances.budget.payroll += amount; }); notify(`Payroll budget raised to ${fmtMoney(c.finances.budget.payroll)}.`, 'good'); }}>Set</Button>
              </div>
            )}
            <div className="row mt8">
              <span>{owner ? 'Inject personal funds into the club' : 'Ask the owner for a cash injection'}</span>
              <span className="spacer" />
              <Button onClick={() => { const r = act((ww) => requestInjection(ww, c)); setLastMsg(r); notify(r.message, r.ok ? 'good' : 'bad'); }}>{owner ? 'Inject' : 'Ask'}</Button>
            </div>
            {!owner && <div className="small muted">The owner injects at most once per season ({b.injectionsThisSeason} used).</div>}
            {lastMsg && <Callout tone={lastMsg.ok ? 'good' : 'bad'}>{lastMsg.message}</Callout>}
          </div>
        </Card>
        <Card title="Approved budgets">
          <div className="kv">
            <span>Player payroll</span><span><Money v={c.finances.budget.payroll} /></span>
            <span>Transfer fees</span><span><Money v={c.finances.budget.transfer} /></span>
            <span>Staff</span><span><Money v={c.finances.budget.staff} /></span>
            <span>Marketing</span><span><Money v={c.finances.budget.marketing} /></span>
            <span>Scouting</span><span><Money v={c.finances.budget.scouting} /></span>
            <span>Medical</span><span><Money v={c.finances.budget.medical} /></span>
            <span>Maintenance</span><span><Money v={c.finances.budget.maintenance} /></span>
            <span>Academy</span><span><Money v={c.finances.budget.academy} /></span>
          </div>
          <div className="small muted mt8">Budgets are set every July from projected revenue, cash and owner ambition.</div>
        </Card>
        <Card title="Club history" className="span2">
          <Table
            rows={[...c.history].reverse()}
            rowKey={(h) => h.season}
            empty="No completed seasons yet."
            columns={[
              { key: 's', label: 'Season', render: (h) => seasonLabel(h.season) },
              { key: 'l', label: 'League', render: (h) => (h.leagueId ? w.rules.leagues[h.leagueId].name : '—') },
              { key: 'r', label: 'Pos', render: (h) => h.rank || '—', align: 'r' },
              { key: 'wl', label: 'W-L', render: (h) => `${h.wins}-${h.losses}`, align: 'r' },
              { key: 'po', label: 'Playoffs', render: (h) => h.playoff },
              { key: 'cup', label: 'Copa del Rey', render: (h) => h.cup },
              { key: 'eu', label: 'Europe', render: (h) => h.euro },
              { key: 'm', label: 'Move', render: (h) => (h.promoted ? <Badge tone="good">Promoted</Badge> : h.relegated ? <Badge tone="bad">Relegated</Badge> : '') },
              { key: 'rev', label: 'Revenue', render: (h) => <Money v={h.revenue} />, align: 'r' },
              { key: 'p', label: 'Profit', render: (h) => <Money v={h.profit} signed tone />, align: 'r' },
              { key: 'a', label: 'Avg att.', render: (h) => h.attendance.toLocaleString('en'), align: 'r' },
              { key: 'c', label: 'Coach', render: (h) => h.coach },
            ]}
          />
        </Card>
      </div>
    </Page>
  );
}
