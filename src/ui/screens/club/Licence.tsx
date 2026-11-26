import { Link } from 'react-router-dom';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, Page } from '../../components/ui';
import { club as getClub, userClub, fmtMoney } from '../../../engine/world';
import { groundShareOffer, licencePlan, licenceStandOption, payrollBridgeOffer, signGroundShare, startLicenceStand, takePayrollBridge } from '../../../engine/licence';

export default function Licence() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = userClub(w)!;
  const plan = licencePlan(w, c);
  const stand = licenceStandOption(w, c);
  const share = groundShareOffer(w, c);
  const bridge = payrollBridgeOffer(w, c);
  const run = (fn: (ww: typeof w) => { ok: boolean; message: string }) => { const r = act(fn); notify(r.message, r.ok ? 'good' : 'bad'); };
  return (
    <Page tone="quiet" kicker={`${c.name}${plan ? ` · ${plan.fromName}` : ''}`} title="Promotion licence" subtitle={plan ? `What the ${plan.toName} demands on promotion day, where you stand, and how to get there.` : 'You are in the top division. Promotion support and venue options live here.'}>
      <div className="col gap16">
        {plan ? (
          <Callout tone={plan.ok ? 'good' : plan.urgent ? 'bad' : 'warn'}>
            {plan.ok ? `You meet every ${plan.toName} requirement today. Keep it that way until promotion day.` : `${plan.failing} of ${plan.items.length} requirements not met. ${plan.lead}`}
          </Callout>
        ) : <Callout>No promotion licence applies to {c.name} this season.</Callout>}
        {bridge && (
          <Card title="Payroll bridge for promoted clubs" actions={<Badge tone="good">Available</Badge>}>
            <div className="small">The league advances <b>{fmtMoney(bridge.amount)}</b> of your bigger media income now, repaid over {bridge.years} seasons at {(bridge.rate * 100).toFixed(1)}%. Your payroll budget rises by the same amount so you can strengthen the squad for the new division.</div>
            <div className="row mt8"><Button variant="primary" size="sm" onClick={() => run((ww) => takePayrollBridge(ww, getClub(ww, c.id)))}>Take the advance</Button></div>
          </Card>
        )}
        {plan?.items.map((it) => (
          <Card key={it.id} title={it.label} actions={<Badge tone={it.ok ? 'good' : 'bad'}>{it.ok ? 'Met' : 'Not met'}</Badge>}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
              <div><div className="small faint">Required</div><b>{it.required}</b></div>
              <div><div className="small faint">You have</div><b>{it.current}</b></div>
              {!it.ok && it.gap && <div><div className="small faint">Gap</div><b className="bad">{it.gap}</b></div>}
            </div>
            <div className="small muted mt8">{it.explain}</div>
            {it.id === 'seats' && !it.ok && (
              <div className="grid g2 mt8">
                {stand && (
                  <div className="list-item">
                    <b>{stand.label}</b>
                    <div className="small muted">{fmtMoney(stand.cost)} · {stand.weeks} weeks · counts as soon as the works start. Upkeep {fmtMoney(stand.annualUpkeep)}/yr.</div>
                    <div className="row mt8"><Button size="sm" variant="primary" onClick={() => { if (confirm(`Start ${stand.label} with a construction loan for 80% of ${fmtMoney(stand.cost)}?`)) run((ww) => startLicenceStand(ww, getClub(ww, c.id), 'loan')); }}>Start, financed</Button><Button size="sm" onClick={() => run((ww) => startLicenceStand(ww, getClub(ww, c.id), 'cash'))}>Start, cash</Button></div>
                  </div>
                )}
                {share && (
                  <div className="list-item">
                    <b>Ground-share: {share.venue}</b>
                    <div className="small muted">{share.seats.toLocaleString('en')} seats for one season ({share.season}-{String((share.season + 1) % 100).padStart(2, '0')}). Rent {fmtMoney(share.rentPerGame)} per home game, {fmtMoney(share.deposit)} deposit. Some fans stay away from a borrowed venue.</div>
                    <div className="row mt8">{c.groundShare && c.groundShare.season >= share.season ? <Badge tone="good">Agreed</Badge> : <Button size="sm" onClick={() => { if (confirm(`Pay a ${fmtMoney(share.deposit)} deposit for ${share.venue}?`)) run((ww) => signGroundShare(ww, getClub(ww, c.id))); }}>Agree ground-share</Button>}</div>
                  </div>
                )}
              </div>
            )}
            {it.actions.length > 0 && (
              <div className="row mt8" style={{ flexWrap: 'wrap' }}>
                {it.actions.map((a) => <Link key={a.to + a.label} className={`btn sm ${a.primary ? 'primary' : ''}`} to={a.to}>{a.label}</Link>)}
              </div>
            )}
          </Card>
        ))}
        {plan && <div className="small faint">Guarantee money counted: cash {fmtMoney(c.finances.cash)}, bank credit {fmtMoney(plan.credit)}, owner guarantees {fmtMoney(plan.ownerGuarantee)}.</div>}
      </div>
    </Page>
  );
}
