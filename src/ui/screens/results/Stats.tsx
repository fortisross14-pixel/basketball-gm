import { useMemo, useState } from 'react';
import type { LeagueId, Player, StatLine } from '../../../engine/types';
import { club as getClub, comp as getComp, isUser } from '../../../engine/world';
import { Card, ClubLink, Crest, Empty, NumberField, Page, PlayerLink, Table, Tabs } from '../../components/ui';
import { useWorld } from '../../store';
import { addLine, emptyLine, pctStr } from '../../helpers';
import { SeasonSelect } from './common';

interface Row {
  p: Player;
  teamId: number;
  l: StatLine;
}

const CATS: { key: string; label: string; val: (l: StatLine) => number; fmt: (l: StatLine) => string; minAttempts?: (l: StatLine) => boolean }[] = [
  { key: 'pts', label: 'Points', val: (l) => l.pts / l.gp, fmt: (l) => (l.pts / l.gp).toFixed(1) },
  { key: 'reb', label: 'Rebounds', val: (l) => (l.orb + l.drb) / l.gp, fmt: (l) => ((l.orb + l.drb) / l.gp).toFixed(1) },
  { key: 'ast', label: 'Assists', val: (l) => l.ast / l.gp, fmt: (l) => (l.ast / l.gp).toFixed(1) },
  { key: 'stl', label: 'Steals', val: (l) => l.stl / l.gp, fmt: (l) => (l.stl / l.gp).toFixed(1) },
  { key: 'blk', label: 'Blocks', val: (l) => l.blk / l.gp, fmt: (l) => (l.blk / l.gp).toFixed(1) },
  { key: 'fg', label: 'FG%', val: (l) => (l.fga ? l.fgm / l.fga : 0), fmt: (l) => pctStr(l.fgm, l.fga), minAttempts: (l) => l.fga >= l.gp * 5 },
  { key: 'tp', label: '3P%', val: (l) => (l.tpa ? l.tpm / l.tpa : 0), fmt: (l) => pctStr(l.tpm, l.tpa), minAttempts: (l) => l.tpa >= l.gp * 2 },
  { key: 'ft', label: 'FT%', val: (l) => (l.fta ? l.ftm / l.fta : 0), fmt: (l) => pctStr(l.ftm, l.fta), minAttempts: (l) => l.fta >= l.gp * 1.5 },
];

export default function Stats() {
  const w = useWorld();
  const uc = w.user.clubId != null ? getClub(w, w.user.clubId) : null;
  const [lid, setLid] = useState<LeagueId>(uc?.leagueId ?? 'ELITE');
  const [season, setSeason] = useState(w.season);
  const [minGp, setMinGp] = useState(5);
  const cmp = getComp(w, `${lid}-${season}`);
  const rows = useMemo<Row[]>(() => {
    if (!cmp) return [];
    const ids = new Set(cmp.clubIds);
    const out: Row[] = [];
    for (const p of w.players) {
      const byTeam = new Map<number, StatLine>();
      for (const s of p.stats) {
        if (s.season !== season || s.comp !== 'league' || !ids.has(s.teamId)) continue;
        byTeam.set(s.teamId, addLine(byTeam.get(s.teamId) ?? emptyLine(), s));
      }
      for (const [teamId, l] of byTeam) if (l.gp > 0) out.push({ p, teamId, l });
    }
    return out;
  }, [w, cmp, season]);
  const qualified = rows.filter((r) => r.l.gp >= minGp);
  const teams = useMemo(() => {
    if (!cmp) return [];
    return cmp.clubIds.map((id) => {
      const l = rows.filter((r) => r.teamId === id).reduce((a, r) => addLine(a, r.l), emptyLine());
      const st = cmp.standings.find((s) => s.clubId === id);
      const games = st ? st.w + st.l : 0;
      return { id, l, games, st };
    });
  }, [cmp, rows]);
  return (
    <Page
      title="Statistics"
      actions={<>
        <label className="row small" style={{ minWidth: 260 }}>Min games <NumberField label="Minimum games" value={minGp} min={0} max={40} onChange={setMinGp} width={50} /></label>
        <SeasonSelect w={w} value={season} onChange={setSeason} />
      </>}
    >
      <Tabs<LeagueId> value={lid} onChange={setLid} tabs={(['ELITE', 'ORO', 'PLATA', 'COLLEGE'] as LeagueId[]).map((id) => ({ id, label: w.rules.leagues[id].name }))} />
      {!cmp || !rows.length ? <Empty>No statistics recorded yet.</Empty> : (
        <>
          <div className="grid g4">
            {CATS.map((cat) => {
              const list = qualified.filter((r) => !cat.minAttempts || cat.minAttempts(r.l)).sort((a, b) => cat.val(b.l) - cat.val(a.l)).slice(0, 10);
              return (
                <Card key={cat.key} title={cat.label}>
                  <table className="tbl">
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={`${r.p.id}-${r.teamId}`} className={isUser(w, r.teamId) ? 'me' : ''}>
                          <td className="muted">{i + 1}</td>
                          <td><PlayerLink player={r.p} short /> <span className="small faint">{getClub(w, r.teamId).abbrev}</span></td>
                          <td className="r"><b>{cat.fmt(r.l)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
          <Card title="Team statistics (per game)" className="mt16">
            <Table
              rows={teams}
              rowKey={(t) => t.id}
              initialSort="pts"
              rowClass={(t) => (isUser(w, t.id) ? 'me' : '')}
              columns={[
                { key: 'club', label: 'Club', render: (t) => { const c = getClub(w, t.id); return <span className="row"><Crest club={c} /><ClubLink club={c} /></span>; } },
                { key: 'g', label: 'G', render: (t) => t.games, align: 'r' },
                { key: 'pts', label: 'PTS', render: (t) => pg(t.l.pts, t.games), sort: (t) => t.l.pts / Math.max(1, t.games), align: 'r' },
                { key: 'opp', label: 'OPP', render: (t) => pg(t.st?.pa ?? 0, t.games), sort: (t) => (t.st?.pa ?? 0) / Math.max(1, t.games), align: 'r' },
                { key: 'reb', label: 'REB', render: (t) => pg(t.l.orb + t.l.drb, t.games), sort: (t) => (t.l.orb + t.l.drb) / Math.max(1, t.games), align: 'r' },
                { key: 'ast', label: 'AST', render: (t) => pg(t.l.ast, t.games), sort: (t) => t.l.ast / Math.max(1, t.games), align: 'r' },
                { key: 'tov', label: 'TOV', render: (t) => pg(t.l.tov, t.games), sort: (t) => t.l.tov / Math.max(1, t.games), align: 'r' },
                { key: 'stl', label: 'STL', render: (t) => pg(t.l.stl, t.games), sort: (t) => t.l.stl / Math.max(1, t.games), align: 'r' },
                { key: 'blk', label: 'BLK', render: (t) => pg(t.l.blk, t.games), sort: (t) => t.l.blk / Math.max(1, t.games), align: 'r' },
                { key: 'fg', label: 'FG%', render: (t) => pctStr(t.l.fgm, t.l.fga), sort: (t) => t.l.fgm / Math.max(1, t.l.fga), align: 'r' },
                { key: 'tp', label: '3P%', render: (t) => pctStr(t.l.tpm, t.l.tpa), sort: (t) => t.l.tpm / Math.max(1, t.l.tpa), align: 'r' },
                { key: 'tpa', label: '3PA', render: (t) => pg(t.l.tpa, t.games), sort: (t) => t.l.tpa / Math.max(1, t.games), align: 'r' },
                { key: 'ft', label: 'FT%', render: (t) => pctStr(t.l.ftm, t.l.fta), sort: (t) => t.l.ftm / Math.max(1, t.l.fta), align: 'r' },
              ]}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

function pg(v: number, g: number) {
  return g ? (v / g).toFixed(1) : '–';
}
