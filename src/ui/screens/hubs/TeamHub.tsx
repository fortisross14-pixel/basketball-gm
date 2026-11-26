import { useWorld } from '../../store';
import { userClub, roster, academy, staffOf, fmtMoney, playerName } from '../../../engine/world';
import { clubStrength } from '../../../engine/matchday';
import { offFit, defFit } from '../../../engine/delegation';
import { OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { payrollRoom } from '../../../engine/finance';
import { buildCalendar, transferWindowOpen, fmtDate } from '../../../engine/calendar';
import { registrationCheck } from '../../../engine/market';
import { SectionHub, type HubTileData } from './SectionHub';
import { SECTIONS } from './nav';
import { Crest, Rating } from '../../components/ui';
import { PlayerCard } from '../../art/PlayerCard';

export default function TeamHub() {
  const w = useWorld();
  const c = userClub(w)!;
  const sq = roster(w, c.id);
  const healthy = sq.filter((p) => !p.injury);
  const injured = sq.filter((p) => p.injury);
  const unhappy = sq.filter((p) => p.morale < 45);
  const str = clubStrength(w, c);
  const peers = w.clubs.filter((x) => x.leagueId === c.leagueId);
  const strRank = [...peers].sort((a, b) => clubStrength(w, b) - clubStrength(w, a)).findIndex((x) => x.id === c.id) + 1;
  const avgMorale = sq.reduce((a, p) => a + p.morale, 0) / Math.max(1, sq.length);
  const avgFresh = sq.reduce((a, p) => a + p.freshness, 0) / Math.max(1, sq.length);
  const coach = staffOf(w, c, 'headCoach');
  const oFit = Math.round(offFit(healthy, c.tactics.off));
  const dFit = Math.round(defFit(healthy, c.tactics.def));
  const agree = (coach?.offPref === c.tactics.off ? 1 : 0) + (coach?.defPref === c.tactics.def ? 1 : 0);
  const vacant = (['headCoach', 'assistantOff', 'assistantDef', 'assistantDev', 'scoutDirector', 'analytics', 'academyDirector', 'medicalLead', 'physio'] as const).filter((r) => c.staff[r] == null);
  const cal = buildCalendar(w.season);
  const window = transferWindowOpen(w.season, w.day);
  const room = payrollRoom(w, c);
  const acad = academy(w, c.id);
  const worst = [...sq].sort((a, b) => a.ovr - b.ovr)[0]?.ovr ?? 0;
  const ready = acad.filter((p) => p.ovr >= worst && registrationCheck(w, c, p).ok);
  const rules = c.leagueId ? w.rules.leagues[c.leagueId] : null;
  const expiring = sq.filter((p) => p.contract && !p.contract.youth && p.contract.expires === w.season);
  const stars = [...sq].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  const items = SECTIONS.find((s) => s.id === 'team')!.items!;
  const tile = (to: string): Pick<HubTileData, 'to' | 'label' | 'icon' | 'blurb'> => { const it = items.find((i) => i.to === to)!; return { to, label: it.label, icon: it.icon, blurb: it.blurb }; };
  const tiles: HubTileData[] = [
    {
      ...tile('/team/players'), wide: true,
      metrics: [
        { label: 'Registered', value: `${sq.length}${rules ? `/${rules.rosterMax}` : ''}`, tone: rules && sq.length < rules.rosterMin ? 'bad' : undefined },
        { label: 'Avg morale', value: Math.round(avgMorale), tone: avgMorale < 50 ? 'warn' : undefined },
        { label: 'Expiring', value: expiring.length, tone: expiring.length ? 'warn' : undefined },
      ],
      alert: unhappy.length ? { text: `${unhappy.length} unhappy`, tone: 'warn' } : rules && sq.length < rules.rosterMin ? { text: 'Roster below minimum', tone: 'bad' } : null,
      extra: <div className="row" style={{ gap: 8, marginTop: 8, transform: 'scale(0.72)', transformOrigin: 'left top', height: 160 }}>{stars.map((p, i) => <PlayerCard key={p.id} p={p} club={c} index={i} />)}</div>,
    },
    {
      ...tile('/team/tactics'),
      metrics: [
        { label: 'Offence fit', value: oFit, tone: oFit < 40 ? 'bad' : oFit > 65 ? 'good' : undefined },
        { label: 'Defence fit', value: dFit, tone: dFit < 40 ? 'bad' : dFit > 65 ? 'good' : undefined },
        { label: 'Coach agrees', value: `${agree}/2`, tone: agree === 0 ? 'warn' : undefined },
      ],
      alert: oFit < 35 || dFit < 35 ? { text: 'Poor personnel fit', tone: 'warn' } : null,
      extra: <div className="hub-mini"><span>{OFF_LABEL[c.tactics.off]} · {DEF_LABEL[c.tactics.def]}</span><span className="muted">{c.tactics.pace} pace · {c.tactics.rotation} rotation</span></div>,
    },
    {
      ...tile('/team/training'),
      metrics: [
        { label: 'Focus', value: c.training.focus },
        { label: 'Intensity', value: c.training.intensity },
        { label: 'Cohesion', value: Math.round(c.cohesion), tone: c.cohesion < 40 ? 'warn' : undefined },
      ],
    },
    {
      ...tile('/team/staff'),
      metrics: [
        { label: 'Head coach', value: coach ? <Rating v={coach.rating} /> : '—', tone: coach ? undefined : 'bad' },
        { label: 'Vacancies', value: vacant.length, tone: vacant.length ? 'warn' : undefined },
      ],
      alert: !coach ? { text: 'No head coach', tone: 'bad' } : vacant.length ? { text: `${vacant.length} posts vacant`, tone: 'warn' } : null,
      extra: coach ? <div className="hub-mini"><span>{coach.firstName} {coach.lastName}</span></div> : undefined,
    },
    {
      ...tile('/team/medical'),
      metrics: [
        { label: 'Injured', value: injured.length, tone: injured.length >= 3 ? 'bad' : injured.length ? 'warn' : 'good' },
        { label: 'Freshness', value: Math.round(avgFresh), tone: avgFresh < 75 ? 'warn' : undefined },
      ],
      alert: injured.some((p) => p.injury?.severity === 'major') ? { text: 'Long-term injury', tone: 'bad' } : null,
      extra: injured.length ? <div className="hub-mini">{injured.slice(0, 3).map((p) => <span key={p.id}>🩹 {playerName(p)} · {p.injury!.daysOut}d</span>)}</div> : undefined,
    },
    {
      ...tile('/team/market'),
      metrics: [
        { label: 'Window', value: window ? 'Open' : 'Closed', tone: window ? 'good' : undefined },
        { label: 'Payroll room', value: fmtMoney(room), tone: room < 0 ? 'bad' : undefined },
        { label: 'Shortlist', value: w.user.shortlist.length },
      ],
      alert: w.user.scoutAssignments.length ? { text: `${w.user.scoutAssignments.length} scouts out`, tone: 'info' } : null,
    },
    {
      ...tile('/team/academy'),
      metrics: [
        { label: 'Prospects', value: acad.length },
        { label: 'Ready', value: ready.length, tone: ready.length ? 'good' : undefined },
        { label: 'Next intake', value: fmtDate(w.season, cal.youthIntake, false) },
      ],
      alert: ready.length ? { text: `${ready.length} ready to promote`, tone: 'good' } : null,
    },
  ];
  return (
    <SectionHub
      kicker={`${c.name} · team`}
      title="Team"
      icon="team"
      tagline="The squad, the game plan and the people who build it."
      aside={<Crest club={c} size={96} />}
      stats={[
        { label: 'Squad strength', value: str.toFixed(1) },
        { label: 'League rank (talent)', value: `#${strRank} of ${peers.length}`, tone: strRank <= 3 ? 'good' : strRank > peers.length - 3 ? 'bad' : undefined },
        { label: 'Injured', value: injured.length, tone: injured.length >= 3 ? 'bad' : undefined },
        { label: 'Unhappy', value: unhappy.length, tone: unhappy.length ? 'warn' : undefined },
        { label: 'Cohesion', value: Math.round(c.cohesion) },
      ]}
      tiles={tiles}
    />
  );
}
