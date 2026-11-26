import { Link } from 'react-router-dom';
import { useWorld } from '../../store';
import { userClub, club as getClub, playerName } from '../../../engine/world';
import { sortStandings } from '../../../engine/competitions';
import { fmtDate, seasonLabel } from '../../../engine/calendar';
import { SectionHub, type HubTileData } from './SectionHub';
import { SECTIONS } from './nav';
import { Crest } from '../../components/ui';
import type { LeagueId } from '../../../engine/types';

export default function ResultsHub() {
  const w = useWorld();
  const c = userClub(w);
  const lid: LeagueId = c?.leagueId ?? 'ELITE';
  const lc = w.competitions.find((x) => x.id === `${lid}-${w.season}`);
  const st = lc ? sortStandings(lc.standings) : [];
  const pos = c ? st.findIndex((s) => s.clubId === c.id) + 1 : 0;
  const me = c ? st.find((s) => s.clubId === c.id) : undefined;
  const upcoming = c ? w.fixtures.filter((f) => !f.played && !f.cancelled && (f.homeId === c.id || f.awayId === c.id) && f.day >= w.day).sort((a, b) => a.day - b.day).slice(0, 3) : [];
  const active = w.competitions.filter((x) => x.season === w.season && x.kind !== 'league' && !x.complete);
  const mine = c ? active.filter((x) => x.clubIds.includes(c.id)) : [];
  const leader = (() => {
    const ids = new Set(lc?.clubIds ?? []);
    let best: { name: string; ppg: number } | null = null;
    for (const p of w.players) {
      if (p.teamId == null || !ids.has(p.teamId)) continue;
      const s = p.stats.find((x) => x.season === w.season && x.comp === 'league' && x.teamId === p.teamId);
      if (!s || s.gp < 3) continue;
      const ppg = s.pts / s.gp;
      if (!best || ppg > best.ppg) best = { name: playerName(p), ppg };
    }
    return best;
  })();
  const items = SECTIONS.find((s) => s.id === 'results')!.items!;
  const tile = (to: string): Pick<HubTileData, 'to' | 'label' | 'icon' | 'blurb'> => { const it = items.find((i) => i.to === to)!; return { to, label: it.label, icon: it.icon, blurb: it.blurb }; };
  const tiles: HubTileData[] = [
    {
      ...tile('/results/standings'), wide: true,
      metrics: c ? [{ label: 'Position', value: pos ? `${pos}${['st', 'nd', 'rd'][pos - 1] ?? 'th'}` : '—' }, { label: 'Record', value: me ? `${me.w}–${me.l}` : '—' }, { label: 'Streak', value: me?.streak ? (me.streak > 0 ? `W${me.streak}` : `L${-me.streak}`) : '—', tone: (me?.streak ?? 0) > 0 ? 'good' : (me?.streak ?? 0) < 0 ? 'bad' : undefined }] : [],
      extra: (
        <div className="hub-mini">
          {st.slice(0, 4).map((s, i) => {
            const cl = getClub(w, s.clubId);
            return <span key={s.clubId} className="row" style={{ fontWeight: cl.id === c?.id ? 800 : 400 }}><b style={{ width: 16 }}>{i + 1}</b><Crest club={cl} size={18} /> {cl.name} <span className="spacer" /> {s.w}–{s.l}</span>;
          })}
        </div>
      ),
    },
    {
      ...tile('/results/schedule'),
      metrics: [{ label: 'Upcoming', value: upcoming.length }],
      extra: <div className="hub-mini">{upcoming.map((f) => { const opp = getClub(w, f.homeId === c?.id ? f.awayId : f.homeId); return <span key={f.id} className="row"><Crest club={opp} size={18} /> {f.homeId === c?.id ? 'vs' : '@'} {opp.abbrev} <span className="muted">{fmtDate(w.season, f.day, false)}</span></span>; })}</div>,
    },
    {
      ...tile('/results/competitions'),
      metrics: [{ label: 'Active', value: active.length }, { label: 'You are in', value: mine.length, tone: mine.length ? 'good' : undefined }],
      alert: mine.length ? { text: mine.map((x) => x.stage).join(' · '), tone: 'good' } : null,
    },
    {
      ...tile('/results/stats'),
      metrics: leader ? [{ label: 'Top scorer', value: `${leader.ppg.toFixed(1)} ppg` }] : [],
      extra: leader ? <div className="hub-mini"><span>{leader.name}</span></div> : undefined,
    },
    { ...tile('/results/rules'), metrics: [{ label: 'Ruleset', value: w.rules.version }] },
  ];
  return (
    <SectionHub
      kicker={`Season ${seasonLabel(w.season)}`}
      title="Results"
      icon="results"
      tagline="Tables, fixtures, competitions and numbers."
      aside={c ? <Crest club={c} size={96} /> : undefined}
      stats={c ? [
        { label: lc?.name ?? 'League', value: pos ? `#${pos}` : '—' },
        { label: 'Record', value: me ? `${me.w}–${me.l}` : '—' },
        { label: 'Points diff', value: me ? `${me.pf - me.pa > 0 ? '+' : ''}${me.pf - me.pa}` : '—', tone: me && me.pf - me.pa < 0 ? 'bad' : undefined },
        { label: 'Next', value: upcoming[0] ? getClub(w, upcoming[0].homeId === c.id ? upcoming[0].awayId : upcoming[0].homeId).abbrev : '—' },
      ] : [{ label: 'Competitions', value: active.length }]}
      tiles={tiles}
    >
      {!c && <p className="muted mb8">You have no club right now. <Link className="link" to="/today">Back to Today</Link></p>}
    </SectionHub>
  );
}
