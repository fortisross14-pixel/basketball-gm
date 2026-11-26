import { Link } from 'react-router-dom';
import { useWorld } from '../../store';
import { Card, Empty, Page } from '../../components/ui';
import { JobOfferCard } from '../../components/career';
import { userClub, fmtMoney } from '../../../engine/world';
import { fmtAbs } from '../../../engine/calendar';
import { jobSecurity } from '../../../engine/career';

export default function CareerOffers() {
  const w = useWorld();
  const c = userClub(w);
  const offers = w.decisions.filter((d) => !d.resolved && d.kind === 'jobOffer');
  return (
    <Page kicker="Your career" title="Career offers" subtitle={c ? `Clubs that want you. You are at ${c.name}: job security ${w.user.role === 'owner' ? '—' : `${jobSecurity(w)}/100`}, reputation ${Math.round(w.user.reputation)}/100.` : 'You are out of work. Accept an offer to start.'}>
      <div className="col gap16">
        {offers.length === 0 ? <Card><Empty>No offers right now. Good results raise your reputation and bring bigger clubs.</Empty></Card> : offers.map((d) => <JobOfferCard key={d.id} d={d} />)}
        <Card title="Career so far" actions={<Link className="link small" to="/legacy">Legacy</Link>}>
          <div className="list">
            {[...w.user.career].reverse().map((s, i) => (
              <div key={i} className="list-item row">
                <b>{s.clubName}</b>
                <span className="muted small">{s.role === 'owner' ? 'Owner' : 'General manager'} · {fmtAbs(s.from)} → {s.to != null ? fmtAbs(s.to) : 'now'}</span>
                <span className="spacer" />
                <span className="small faint">{s.exit ?? (s.achievements.length ? s.achievements.join(', ') : '')}</span>
              </div>
            ))}
          </div>
          {w.user.personalWealth > 0 && <div className="small faint mt8">Personal wealth {fmtMoney(w.user.personalWealth)}</div>}
        </Card>
      </div>
    </Page>
  );
}
