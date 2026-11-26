import { useState } from 'react';
import type { Player } from '../../../engine/types';
import { age, club as getClub, fmtMoney, playerName, roster, academy } from '../../../engine/world';
import { payroll, playerCommitments } from '../../../engine/finance';
import { releaseCost, releasePlayer } from '../../../engine/market';
import { ROLE_LABEL, salaryAsk } from '../../../engine/player';
import { Badge, Button, Card, Money, Page, Pills, Stat, Table, PlayerLink, BarChart } from '../../components/ui';
import { MoraleBadge, OvrCell } from '../../helpers';
import { useAct, useNotify, useWorld } from '../../store';
import ContractModal from './ContractModal';

export default function Contracts() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const [view, setView] = useState<'roster' | 'academy'>('roster');
  const [renew, setRenew] = useState<Player | null>(null);
  const squad = roster(w, c.id);
  const youth = academy(w, c.id);
  const loanedOut = w.players.filter((p) => p.loan?.fromTeamId === c.id);
  const pr = payroll(w, c);
  const budget = c.finances.budget.payroll;
  const expiring = squad.filter((p) => p.contract && p.contract.expires <= w.season);
  const commitments = playerCommitments(w, c, 5);
  const rows = view === 'roster' ? [...squad, ...loanedOut] : youth;

  const release = (p: Player) => {
    const cost = releaseCost(w, p);
    if (!confirm(`Release ${playerName(p)}? Settlement cost: ${fmtMoney(cost)} (60% of remaining salary).`)) return;
    act((ww) => releasePlayer(ww, c, p));
    notify(`${playerName(p)} released. Settlement ${fmtMoney(cost)}.`);
  };

  return (
    <Page title="Contracts" subtitle="Payroll sheet, renewals, releases and transfer status">
      <div className="grid g4 mb8">
        <Stat label="Payroll" value={<Money v={pr} />} sub={`Budget ${fmtMoney(budget)}`} tone={pr > budget ? 'bad' : undefined} />
        <Stat label="Room under budget" value={<Money v={budget - pr} tone />} />
        <Stat label="Expiring this season" value={expiring.length} sub={expiring.map((p) => p.lastName).join(', ') || '—'} tone={expiring.length ? 'warn' : undefined} />
        <Stat label="Transfer budget" value={<Money v={c.finances.budget.transfer} />} sub={c.board.autonomy === 'restricted' ? 'Autonomy restricted by board' : 'Full autonomy'} />
      </div>
      <div className="grid g3 mb8">
        <Card title="Committed salaries by season" className="span2">
          <BarChart items={commitments.map((x) => ({ label: `${x.season}-${String((x.season + 1) % 100).padStart(2, '0')}`, value: x.amount }))} height={110} format={(v) => fmtMoney(v)} />
        </Card>
        <Card title="Notes">
          <div className="small muted col">
            <span>Renewing an expiring player is cheaper than replacing him: loyalty and morale count in his decision.</span>
            <span>Releasing a player costs 60% of his remaining salary.</span>
            <span>Players on the transfer list attract more bids but lose morale. Untouchable players reject all approaches (release clauses still apply).</span>
          </div>
        </Card>
      </div>
      <Card title={<Pills options={[{ id: 'roster', label: `First team (${squad.length})` }, { id: 'academy', label: `Academy (${youth.length})` }]} value={view} onChange={setView} />}>
        <Table
          rows={rows}
          rowKey={(p) => p.id}
          initialSort="salary"
          rowClass={(p) => (p.contract && p.contract.expires <= w.season ? 'me' : '')}
          columns={[
            { key: 'name', label: 'Player', render: (p) => <span className="row gap4"><PlayerLink player={p} />{p.loan && p.loan.fromTeamId === c.id && <Badge tone="info">On loan</Badge>}{p.transferListed && <Badge tone="warn">Listed</Badge>}{p.untouchable && <Badge tone="accent">Untouchable</Badge>}</span>, sort: (p) => p.lastName },
            { key: 'pos', label: 'Pos', render: (p) => p.pos },
            { key: 'age', label: 'Age', render: (p) => age(w, p), sort: (p) => -p.born, align: 'r' },
            { key: 'ovr', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
            { key: 'salary', label: 'Salary', render: (p) => <Money v={p.contract?.salary ?? 0} />, sort: (p) => p.contract?.salary ?? 0, align: 'r' },
            { key: 'market', label: 'Market rate', render: (p) => <Money v={salaryAsk(w, p, c)} />, sort: (p) => salaryAsk(w, p, c), align: 'r', title: 'What he would ask today' },
            { key: 'exp', label: 'Expires', render: (p) => p.contract ? <span className={p.contract.expires <= w.season ? 'warn' : ''}>June {p.contract.expires + 1}</span> : '—', sort: (p) => p.contract?.expires ?? 0, align: 'r' },
            { key: 'role', label: 'Role promise', render: (p) => p.contract ? ROLE_LABEL[p.contract.rolePromise] : '—' },
            { key: 'buyout', label: 'Release clause', render: (p) => p.contract?.buyout ? <Money v={p.contract.buyout} /> : <span className="faint">none</span>, sort: (p) => p.contract?.buyout ?? 0, align: 'r' },
            { key: 'value', label: 'Value', render: (p) => <Money v={p.value} />, sort: (p) => p.value, align: 'r' },
            { key: 'morale', label: 'Morale', render: (p) => <MoraleBadge p={p} />, sort: (p) => p.morale, align: 'c' },
            {
              key: 'act', label: '', render: (p) => p.loan && p.loan.fromTeamId === c.id ? <span className="faint small">returns in June</span> : (
                <span className="row gap4">
                  {view === 'roster' && <Button size="sm" onClick={() => setRenew(p)}>Renew</Button>}
                  {view === 'roster' && <Button size="sm" variant="ghost" title="Toggle transfer list" onClick={() => act(() => { p.transferListed = !p.transferListed; if (p.transferListed) p.untouchable = false; })}>{p.transferListed ? 'Unlist' : 'List'}</Button>}
                  {view === 'roster' && <Button size="sm" variant="ghost" title="Toggle untouchable" onClick={() => act(() => { p.untouchable = !p.untouchable; if (p.untouchable) p.transferListed = false; })}>{p.untouchable ? '🔓' : '🔒'}</Button>}
                  <Button size="sm" variant="danger" onClick={() => release(p)} title={`Settlement ${fmtMoney(releaseCost(w, p))}`}>Release</Button>
                </span>
              ),
            },
          ]}
        />
      </Card>
      {renew && <ContractModal player={renew} mode="renew" onClose={() => setRenew(null)} />}
    </Page>
  );
}
