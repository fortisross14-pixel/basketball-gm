import { useMemo, useState } from 'react';
import type { Player, RolePromise } from '../../../engine/types';
import { age, club as getClub, fmtMoney, playerName } from '../../../engine/world';
import { offerContract, playerInterest, projectedRank, getNegotiation, type ContractOffer, type NegotiationResult } from '../../../engine/market';
import { salaryAsk, roleFor, ROLE_LABEL, marketValue } from '../../../engine/player';
import { payroll } from '../../../engine/finance';
import { Badge, Button, Callout, Modal, Money, NumberField } from '../../components/ui';
import { useAct, useNotify, useWorld } from '../../store';

const ROLES: RolePromise[] = ['star', 'starter', 'rotation', 'bench', 'prospect'];

export default function ContractModal({ player, mode, feeAgreed = 0, onClose }: { player: Player; mode: 'sign' | 'renew'; feeAgreed?: number; onClose: () => void }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const ask = salaryAsk(w, player, c);
  const neg = getNegotiation(w, player.id);
  const [offer, setOffer] = useState<ContractOffer>(() => ({
    salary: neg?.lastAsk?.salary ?? Math.round((ask * 0.9) / 1000) * 1000,
    years: neg?.lastAsk?.years ?? (age(w, player) >= 30 ? 2 : 3),
    role: neg?.lastAsk?.role ?? roleFor(projectedRank(w, c, player)),
    buyout: null,
    signingBonus: 0,
  }));
  const [hasBuyout, setHasBuyout] = useState(false);
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const finalOffer: ContractOffer = { ...offer, buyout: hasBuyout ? offer.buyout ?? Math.round((marketValue(w, player) * 2) / 1000) * 1000 : null };
  const preview = useMemo(() => playerInterest(w, player, c, finalOffer, mode), [w, player, c, finalOffer.salary, finalOffer.years, finalOffer.role, finalOffer.buyout, finalOffer.signingBonus, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = player.contract?.salary ?? 0;
  const payrollAfter = payroll(w, c) - (mode === 'renew' ? current : 0) + finalOffer.salary;
  const factors = result?.factors ?? preview.factors;

  const submit = () => {
    const res = act((ww) => offerContract(ww, c, player, finalOffer, mode, feeAgreed));
    setResult(res);
    if (res.counter) setOffer({ ...res.counter, buyout: res.counter.buyout });
    if (res.outcome === 'accepted') {
      notify(res.message, 'good');
      onClose();
    } else if (res.outcome === 'walked' || res.outcome === 'blocked') notify(res.message, 'bad');
  };

  return (
    <Modal title={`${mode === 'renew' ? 'Contract renewal' : 'Contract offer'}: ${playerName(player)}`} onClose={onClose} wide>
      <div className="grid g2">
        <div className="col">
          <div className="kv small">
            <span>Age / position</span><span>{age(w, player)} · {player.pos}</span>
            <span>Agent</span><span>{player.agent.name} <Badge>{player.agent.style}</Badge></span>
            <span>Asking salary</span><span><Money v={ask} />/yr</span>
            <span>Current contract</span><span>{player.contract ? `${fmtMoney(current)}/yr to ${player.contract.expires + 1}` : 'None'}</span>
            {feeAgreed > 0 && <><span>Transfer fee agreed</span><span><Money v={feeAgreed} /></span></>}
            <span>Payroll after deal</span><span className={payrollAfter > c.finances.budget.payroll ? 'bad' : ''}><Money v={payrollAfter} /> / budget <Money v={c.finances.budget.payroll} /></span>
            {neg && <><span>Agent patience</span><span>{Math.max(0, Math.round(neg.patience))}/100 · round {neg.rounds}</span></>}
          </div>
          <label className="field">Salary per year
            <NumberField value={offer.salary} step={5000} min={0} prefix="€" width={140} onChange={(v) => setOffer({ ...offer, salary: v })} />
          </label>
          <label className="field">Years
            <select value={offer.years} onChange={(e) => setOffer({ ...offer, years: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
            </select>
          </label>
          <label className="field">Role promise
            <select value={offer.role} onChange={(e) => setOffer({ ...offer, role: e.target.value as RolePromise })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="field">Signing bonus (one-off)
            <NumberField value={offer.signingBonus} step={5000} min={0} prefix="€" width={140} onChange={(v) => setOffer({ ...offer, signingBonus: v })} />
          </label>
          <label className="row small"><input type="checkbox" checked={hasBuyout} onChange={(e) => setHasBuyout(e.target.checked)} /> Include release clause</label>
          {hasBuyout && (
            <label className="field">Release clause
              <NumberField value={finalOffer.buyout ?? 0} step={25000} min={0} prefix="€" width={140} onChange={(v) => setOffer({ ...offer, buyout: v })} />
            </label>
          )}
        </div>
        <div className="col">
          <h3>What he weighs {result ? '(last response)' : '(estimate)'}</h3>
          <div className="col gap4">
            {factors.map((f, i) => (
              <div key={i} className="row small">
                <span>{f.label}</span>
                <span className="spacer" />
                <b className={f.value >= 0 ? 'good' : 'bad'}>{f.value >= 0 ? '+' : ''}{f.value}</b>
              </div>
            ))}
          </div>
          <div className="row">
            <span className="muted">Overall</span>
            <span className="spacer" />
            <Badge tone={preview.score >= 0 ? 'good' : preview.score > -15 ? 'warn' : 'bad'}>{preview.score >= 0 ? 'Likely to accept' : preview.score > -15 ? 'Close' : 'Far apart'} ({Math.round(preview.score)})</Badge>
          </div>
          {result && <Callout tone={result.outcome === 'accepted' ? 'good' : result.outcome === 'counter' ? 'warn' : 'bad'}>{result.message}</Callout>}
        </div>
      </div>
      <div className="row mt16">
        <span className="muted small">Lowball offers cost agent patience. If talks break down he won't negotiate for a few weeks.</span>
        <span className="spacer" />
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={submit} disabled={result?.outcome === 'walked'}>Submit offer</Button>
      </div>
    </Modal>
  );
}
