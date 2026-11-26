// Revenue drive: deals you can close today to fund one or two signings.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, Money, Stat } from '../../components/ui';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { payrollRoom } from '../../../engine/finance';
import { sponsorSaturation } from '../../../engine/commercial';
import { quickDeals, takeQuickDeal, type QuickDeal } from '../../../engine/fundraising';
import { freeAgentDiscount } from '../../../engine/player';

export function RevenueDrive() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const deals = quickDeals(w, c);
  const sat = sponsorSaturation(c);
  const potential = deals.filter((d) => d.available).reduce((a, d) => a + Math.max(...d.options.map((o) => o.cashNow)), 0);
  const disc = freeAgentDiscount(w);

  const take = (d: QuickDeal, optionId: string) => {
    const res = act((ww) => takeQuickDeal(ww, getClub(ww, c.id), d.kind, optionId));
    notify(res.message, res.ok ? 'good' : 'bad');
  };

  return (
    <div className="col gap16">
      <div className="grid g4">
        <Stat label="Cash" value={<Money v={c.finances.cash} />} tone={c.finances.cash < 0 ? 'bad' : undefined} />
        <Stat label="Payroll room" value={<Money v={payrollRoom(w, c)} />} sub="What the board lets you add in wages" tone={payrollRoom(w, c) <= 0 ? 'warn' : 'good'} />
        <Stat label="Could raise today" value={<Money v={potential} />} sub="Taking every upfront option" />
        <Stat label="Fan tolerance" value={`${sat.count} / ${sat.comfortable}`} sub={sat.label} tone={sat.penalty > 0 ? 'bad' : sat.count >= sat.comfortable ? 'warn' : 'good'} />
      </div>
      <Callout>
        Small clubs start tight. Close a few of these deals to fund a signing: the board adds most of the new money to your payroll budget.
        Free agents also get cheaper as the season approaches{disc < 1 ? ` (asks are at ${Math.round(disc * 100)}% today)` : ' (from 10 August, down to about 70% when the league starts)'}.
        For lasting income, build a restaurant or a store in <Link className="link" to="/infrastructure">Infrastructure</Link>.
      </Callout>
      <div className="grid g2">
        {deals.map((d, i) => (
          <motion.div key={d.kind} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card title={d.title} actions={d.available ? <Badge tone="good">Available</Badge> : <Badge>Closed</Badge>}>
              <div className="small muted">{d.desc}</div>
              <div className="small mt8"><span className="faint">Fans:</span> {d.fanNote}</div>
              {d.available ? (
                <div className="col mt8" style={{ gap: 8 }}>
                  {d.options.map((o) => (
                    <div key={o.id} className="list-item row">
                      <div style={{ minWidth: 0 }}>
                        <b>{o.label}</b>
                        <div className="small muted">{o.detail}</div>
                      </div>
                      <span className="spacer" />
                      {o.cashNow > 0 && <span className="good small" style={{ whiteSpace: 'nowrap' }}>+{fmtMoney(o.cashNow)} now</span>}
                      <Button size="sm" variant="primary" onClick={() => take(d, o.id)}>Sign</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small faint mt8">{d.reason}</div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
