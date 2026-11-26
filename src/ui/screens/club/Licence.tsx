import { Link } from 'react-router-dom';
import { useWorld } from '../../store';
import { Badge, Callout, Card, Page } from '../../components/ui';
import { userClub, fmtMoney } from '../../../engine/world';
import { licencePlan } from '../../../engine/licence';

export default function Licence() {
  const w = useWorld();
  const c = userClub(w)!;
  const plan = licencePlan(w, c);
  if (!plan) return <Page title="Promotion licence"><Card>Your club is in the top division (or not in a promotion league): no licence needed.</Card></Page>;
  return (
    <Page kicker={`${c.name} · ${plan.fromName}`} title="Promotion licence" subtitle={`What the ${plan.toName} demands on promotion day, where you stand, and how to get there.`} tone="quiet">
      <div className="col gap16">
        <Callout tone={plan.ok ? 'good' : plan.urgent ? 'bad' : 'warn'}>
          {plan.ok ? `You meet every ${plan.toName} requirement today. Keep it that way until promotion day.` : `${plan.failing} of ${plan.items.length} requirements not met. ${plan.lead}`}
        </Callout>
        {plan.items.map((it) => (
          <Card key={it.id} title={it.label} actions={<Badge tone={it.ok ? 'good' : 'bad'}>{it.ok ? 'Met' : 'Not met'}</Badge>}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
              <div><div className="small faint">Required</div><b>{it.required}</b></div>
              <div><div className="small faint">You have</div><b>{it.current}</b></div>
              {!it.ok && it.gap && <div><div className="small faint">Gap</div><b className="bad">{it.gap}</b></div>}
            </div>
            <div className="small muted mt8">{it.explain}</div>
            {it.actions.length > 0 && (
              <div className="row mt8" style={{ flexWrap: 'wrap' }}>
                {it.actions.map((a) => <Link key={a.to + a.label} className={`btn sm ${a.primary ? 'primary' : ''}`} to={a.to}>{a.label}</Link>)}
              </div>
            )}
          </Card>
        ))}
        <div className="small faint">Guarantee money counted: cash {fmtMoney(c.finances.cash)}, bank credit {fmtMoney(plan.credit)}, owner guarantees {fmtMoney(plan.ownerGuarantee)}.</div>
      </div>
    </Page>
  );
}
