import { SPEND_PER_HEAD, spendPerHead, tier } from '../../../engine/economy';
import { avgAttendance } from '../../../engine/arena';
import { club as getClub, fmtMoney, seasonTotal } from '../../../engine/world';
import { Card, Page, Pills, Stat } from '../../components/ui';
import { useAct } from '../../store';
import { FacilityUpgrades, useUserClub } from './common';

const PRICING_INFO = {
  value: 'Value pricing: lower margin per fan (−18% spend) but supporters notice — sentiment rises over time.',
  standard: 'Standard pricing: market-rate food and drink.',
  premium: 'Premium pricing: +20% spend per head, but fans feel squeezed and sentiment drifts down.',
};

export default function Restaurants() {
  const { w, c } = useUserClub();
  const act = useAct();
  const sph = spendPerHead(w, c);
  const att = avgAttendance(w, c);
  const rev = seasonTotal(c, w.season, 'concessions');
  const upd = (fn: (cl: ReturnType<typeof getClub>) => void) => act((ww) => fn(getClub(ww, c.id)));
  return (
    <Page title="Restaurants & hospitality" subtitle="Matchday food, drink and premium hospitality.">
      <div className="grid g4">
        <Stat label="Food & drink revenue (season)" value={fmtMoney(rev)} />
        <Stat label="Net spend per attendee" value={fmtMoney(sph)} sub={`tier reference gross ${fmtMoney(SPEND_PER_HEAD[tier(w, c)])}`} />
        <Stat label="Avg attendance" value={Math.round(att).toLocaleString('en')} />
        <Stat label="Est. per home game" value={fmtMoney(sph * att)} />
      </div>
      <Card title="Operating policy" className="mt16">
        <div className="col">
          <div className="row">
            <span style={{ minWidth: 160 }}>Pricing</span>
            <Pills value={c.concessions.pricing} onChange={(v) => upd((cl) => { cl.concessions.pricing = v; })} options={[{ id: 'value', label: 'Value' }, { id: 'standard', label: 'Standard' }, { id: 'premium', label: 'Premium' }]} />
          </div>
          <div className="small muted">{PRICING_INFO[c.concessions.pricing]}</div>
          <label className="row">
            <input type="checkbox" checked={c.concessions.localSuppliers} onChange={(e) => upd((cl) => { cl.concessions.localSuppliers = e.target.checked; })} />
            Local suppliers
            <span className="small muted">— margin falls from 48% to 40%, but the community and fan sentiment appreciate it.</span>
          </label>
        </div>
      </Card>
      <div className="mt16">
        <FacilityUpgrades keys={['concessions', 'restaurant', 'hospitality']} title="Food & hospitality facilities" />
      </div>
      <div className="small faint mt8">Hospitality adds revenue per premium-seat holder each game and improves suite demand. Restaurants add about €0.90 gross per fan per level.</div>
    </Page>
  );
}
