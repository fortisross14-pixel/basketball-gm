import type { LeagueId, LeagueRules } from '../../../engine/types';
import { RULE_EXPLAINERS, LEAGUE_IDS } from '../../../engine/rules';
import { buildCalendar, fmtDate } from '../../../engine/calendar';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { licenceCheck } from '../../../engine/season';
import { Badge, Callout, Card, Page } from '../../components/ui';
import { useWorld } from '../../store';

const ROWS: { key: keyof LeagueRules; label: string; money?: boolean; seats?: boolean }[] = [
  { key: 'teams', label: 'Clubs' },
  { key: 'rosterMin', label: 'Roster minimum' },
  { key: 'rosterMax', label: 'Roster maximum' },
  { key: 'matchdaySquad', label: 'Matchday squad' },
  { key: 'maxNonEU', label: 'Max non-EU players' },
  { key: 'minHomegrown', label: 'Min homegrown players' },
  { key: 'minArenaSeats', label: 'Min arena seats', seats: true },
  { key: 'promotionFee', label: 'Entry guarantee (on promotion)', money: true },
  { key: 'minPayrollGuarantee', label: 'Financial standard', money: true },
  { key: 'centralTv', label: 'Central TV per club', money: true },
  { key: 'centralTvMerit', label: 'Merit TV (champion)', money: true },
  { key: 'leagueFee', label: 'Annual league fee', money: true },
  { key: 'prizeChampion', label: 'Champion prize', money: true },
  { key: 'directPromotion', label: 'Direct promotion places' },
  { key: 'playoffPromotion', label: 'Playoff promotion places' },
  { key: 'playoffTeams', label: 'Playoff entrants' },
  { key: 'relegation', label: 'Relegation places' },
];

export default function Rules() {
  const w = useWorld();
  const r = w.rules;
  const cal = buildCalendar(w.season);
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  const upper: Record<LeagueId, LeagueId | null> = { ELITE: null, ORO: 'ELITE', PLATA: 'ORO', COLLEGE: null };
  return (
    <Page title="Competition rules" subtitle={<>Ruleset <span className="mono">{r.version}</span> · season {r.season}. All regulations are data-driven and versioned per season. Hover a rule for its explanation.</>}>
      <Card title="League regulations" className="flush">
        <div className="tbl-wrap" style={{ padding: '0 8px 8px' }}>
          <table className="tbl">
            <thead>
              <tr><th>Rule</th>{LEAGUE_IDS.map((id) => <th key={id} className="r">{r.leagues[id].name} ({r.leagues[id].kind === 'college' ? 'US college' : `tier ${r.leagues[id].tier}`})</th>)}</tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} title={RULE_EXPLAINERS[row.key] ?? ''}>
                  <td>{row.label}{RULE_EXPLAINERS[row.key] && <span className="faint"> ⓘ</span>}</td>
                  {LEAGUE_IDS.map((id) => {
                    const v = r.leagues[id][row.key] as number;
                    return <td key={id} className="r">{row.money ? fmtMoney(v) : row.seats ? v.toLocaleString('en') : v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2 mt16">
        <Card title="Explanations">
          <div className="col small">
            {Object.entries(RULE_EXPLAINERS).map(([k, v]) => (
              <div key={k}><b>{ROWS.find((x) => x.key === k)?.label ?? k}:</b> <span className="muted">{v}</span></div>
            ))}
          </div>
        </Card>
        <div className="col">
          <Card title="Calendar & transfer windows">
            <div className="kv small">
              <span>Summer window</span><span>1 Jul – {fmtDate(w.season, cal.summerWindowClose, false)}</span>
              <span>Winter window</span><span>{fmtDate(w.season, cal.winterWindowOpen, false)} – {fmtDate(w.season, cal.winterWindowClose, false)}</span>
              <span>Free-agent registration deadline</span><span>{fmtDate(w.season, cal.faDeadline, false)}</span>
              <span>Season-ticket deadline</span><span>{fmtDate(w.season, cal.seasonTicketDeadline, false)}</span>
              <span>Regular season</span><span>{fmtDate(w.season, cal.leagueRoundDays[0], false)} – {fmtDate(w.season, cal.leagueRoundDays[cal.leagueRoundDays.length - 1], false)} (30 rounds)</span>
              <span>Copa</span><span>{fmtDate(w.season, cal.cupDays.qf[0], false)} – {fmtDate(w.season, cal.cupDays.f, false)}</span>
              <span>Playoffs start</span><span>{fmtDate(w.season, cal.playoffStart, false)}</span>
              <span>Season end (promotion/relegation)</span><span>{fmtDate(w.season, cal.seasonEnd, false)}</span>
            </div>
            <div className="small faint mt8">Transfers with a fee need an open window. Free agents can be signed at any time until the registration deadline.</div>
          </Card>
          <Card title="Continental Cup & Copa">
            <div className="kv small">
              <span>Continental Cup</span><span>{r.euro.teams} clubs: top {r.euro.fromElite} of the Liga Élite + invited continental clubs. Two groups of 8, top 4 to best-of-3 quarterfinals, Final Four at a neutral venue.</span>
              <span>Participation prize</span><span>{fmtMoney(r.euro.prizeParticipation)} + {fmtMoney(r.euro.prizePerWin)} per group win</span>
              <span>Champion prize</span><span>{fmtMoney(r.euro.prizeChampion)}</span>
              <span>TV share</span><span>{fmtMoney(r.euro.tvShare)} per club</span>
              <span>Copa</span><span>Top {r.cup.teams} of the Liga Élite after round 15; single-game knockout at a neutral venue.</span>
              <span>Copa prizes</span><span>Winner {fmtMoney(r.cup.prizeWinner)}, participation {fmtMoney(r.cup.prizeParticipation)}</span>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Promotion, relegation & licensing" className="mt16">
        <p className="small">At season end the top clubs of each lower league are promoted and the same number of clubs from the league above are relegated, keeping league sizes stable. A sporting promotion only counts if the club also passes the licence of the higher league: arena capacity (counting works already under way), payment of the entry guarantee from cash, and the financial standard (cash plus owner guarantees). If a promoted club fails, the next eligible candidate takes the place; if nobody qualifies, a club in the relegation zone is spared.</p>
        {uc && uc.leagueId && upper[uc.leagueId] && (() => {
          const to = upper[uc.leagueId!]!;
          const lic = licenceCheck(w, uc, to);
          return (
            <Callout tone={lic.ok ? 'good' : 'warn'}>
              <div className="row"><b>{uc.name} — licence for the {r.leagues[to].name}</b><span className="spacer" /><Badge tone={lic.ok ? 'good' : 'warn'}>{lic.ok ? 'Currently eligible' : 'Not eligible today'}</Badge></div>
              {lic.reasons.map((x, i) => <div key={i} className="small mt8">• {x}</div>)}
            </Callout>
          );
        })()}
      </Card>
    </Page>
  );
}
