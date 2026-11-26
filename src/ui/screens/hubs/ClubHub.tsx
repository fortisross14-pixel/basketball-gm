import { useWorld } from '../../store';
import { userClub, roster, fmtMoney } from '../../../engine/world';
import { statement, payroll, cashForecast90, totalDebt } from '../../../engine/finance';
import { sponsorSaturation } from '../../../engine/commercial';
import { SPONSOR_SLOTS } from '../../../engine/types';
import { jobSecurity } from '../../../engine/career';
import { SectionHub, type HubTileData } from './SectionHub';
import { SECTIONS } from './nav';
import { Crest, Sparkline } from '../../components/ui';

export default function ClubHub() {
  const w = useWorld();
  const c = userClub(w)!;
  const st = statement(c, w.season);
  const fc = cashForecast90(w, c);
  const low = Math.min(...fc.map((x) => x.cash));
  const pr = payroll(w, c);
  const sat = sponsorSaturation(c);
  const pendingSponsors = w.decisions.filter((d) => !d.resolved && d.kind === 'sponsorOffer').length;
  const emptySlots = SPONSOR_SLOTS.filter((s) => !c.sponsors.some((x) => x.slot === s)).length;
  const expiring = roster(w, c.id).filter((p) => p.contract && !p.contract.youth && p.contract.expires === w.season);
  const unread = w.news.filter((n) => !n.read && n.clubIds.includes(c.id)).length;
  const met = c.board.objectives.filter((o) => o.progress >= 1).length;
  const ap = w.user.approval;
  const owner = w.user.role === 'owner';
  const items = SECTIONS.find((s) => s.id === 'club')!.items!;
  const tile = (to: string): Pick<HubTileData, 'to' | 'label' | 'icon' | 'blurb'> => { const it = items.find((i) => i.to === to)!; return { to, label: it.label, icon: it.icon, blurb: it.blurb }; };
  const fans = c.fans;
  const tiles: HubTileData[] = [
    {
      ...tile('/club/finance'), wide: true,
      metrics: [
        { label: 'Cash', value: fmtMoney(c.finances.cash), tone: c.finances.cash < 0 ? 'bad' : undefined },
        { label: 'Season result', value: fmtMoney(st.net, true), tone: st.net < 0 ? 'bad' : 'good' },
        { label: '90-day low', value: fmtMoney(low), tone: low < 0 ? 'bad' : undefined },
        { label: 'Debt', value: fmtMoney(totalDebt(c)) },
      ],
      alert: c.finances.cash < 0 ? { text: 'Negative cash', tone: 'bad' } : low < 0 ? { text: 'Cash squeeze ahead', tone: 'warn' } : null,
      extra: c.finances.cashHistory.length > 2 ? <div style={{ marginTop: 8 }}><Sparkline data={c.finances.cashHistory.map((x) => x.cash)} width={420} height={44} /></div> : undefined,
    },
    {
      ...tile('/club/marketing'),
      metrics: [
        { label: 'Local fans', value: Math.round(fans.local).toLocaleString('en') },
        { label: 'Sentiment', value: Math.round(fans.sentiment), tone: fans.sentiment < 40 ? 'bad' : fans.sentiment > 65 ? 'good' : undefined },
        { label: 'Campaigns', value: c.campaigns.length },
      ],
    },
    {
      ...tile('/club/commercial'),
      metrics: [
        { label: 'Partners', value: `${sat.count}/${SPONSOR_SLOTS.length}` },
        { label: 'Fan limit', value: sat.comfortable, tone: sat.penalty > 0 ? 'bad' : undefined },
        { label: 'TV deal', value: c.tv ? fmtMoney(c.tv.annual) : 'None', tone: c.tv ? undefined : 'warn' },
      ],
      alert: pendingSponsors ? { text: `${pendingSponsors} offer${pendingSponsors > 1 ? 's' : ''} waiting`, tone: 'warn' } : w.tvOffers.length ? { text: 'TV offers waiting', tone: 'warn' } : sat.penalty > 0 ? { text: 'Fans: too many brands', tone: 'bad' } : emptySlots >= 5 ? { text: `${emptySlots} slots to sell`, tone: 'info' } : null,
    },
    {
      ...tile('/club/contracts'),
      metrics: [
        { label: 'Payroll', value: fmtMoney(pr) },
        { label: 'Budget', value: fmtMoney(c.finances.budget.payroll), tone: pr > c.finances.budget.payroll ? 'bad' : undefined },
        { label: 'Expiring', value: expiring.length, tone: expiring.length ? 'warn' : undefined },
      ],
      alert: pr > c.finances.budget.payroll * 1.02 ? { text: 'Over budget', tone: 'bad' } : null,
    },
    {
      ...tile('/club/board'),
      metrics: [
        { label: 'Owner', value: Math.round(ap.board), tone: ap.board < 35 ? 'bad' : ap.board > 65 ? 'good' : undefined },
        { label: 'Fans', value: Math.round(ap.fans), tone: ap.fans < 30 ? 'bad' : ap.fans > 65 ? 'good' : undefined },
        { label: 'Objectives', value: `${met}/${c.board.objectives.length}` },
      ],
      alert: c.board.ultimatum ? { text: 'Ultimatum', tone: 'bad' } : !owner && jobSecurity(w) < 35 ? { text: 'Job at risk', tone: 'bad' } : null,
    },
    {
      ...tile('/club/media'),
      metrics: [
        { label: 'Unread', value: unread, tone: unread ? 'warn' : undefined },
        { label: 'Delegated actions', value: w.delegationLog.length },
      ],
      extra: <div className="hub-mini">{w.news.filter((n) => n.clubIds.includes(c.id)).slice(0, 2).map((n) => <span key={n.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {n.headline}</span>)}</div>,
    },
  ];
  return (
    <SectionHub
      kicker={`${c.name} · club management`}
      title="Club"
      icon="club"
      tagline="Money, fans, partners and the people you answer to."
      aside={<Crest club={c} size={96} />}
      stats={[
        { label: 'Cash', value: fmtMoney(c.finances.cash), tone: c.finances.cash < 0 ? 'bad' : undefined },
        { label: 'Season result', value: fmtMoney(st.net, true), tone: st.net < 0 ? 'bad' : 'good' },
        { label: 'Owner rating', value: Math.round(ap.board), tone: ap.board < 35 ? 'bad' : undefined },
        { label: 'Fan rating', value: Math.round(ap.fans), tone: ap.fans < 30 ? 'bad' : undefined },
        { label: 'Job security', value: owner ? 'Owner' : jobSecurity(w), tone: !owner && jobSecurity(w) < 35 ? 'bad' : undefined },
      ]}
      tiles={tiles}
    />
  );
}
