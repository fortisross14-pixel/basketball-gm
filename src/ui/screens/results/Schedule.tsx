import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Fixture } from '../../../engine/types';
import { fmtDate, monthOf } from '../../../engine/calendar';
import { club as getClub, isUser } from '../../../engine/world';
import { Badge, Card, Crest, Empty, Page } from '../../components/ui';
import { useWorld } from '../../store';
import { shortCompName } from './common';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Schedule() {
  const w = useWorld();
  const nav = useNavigate();
  const hasClub = w.user.clubId != null;
  const [mine, setMine] = useState(hasClub);
  const [compId, setCompId] = useState('all');
  const [month, setMonth] = useState<number | 'all'>(hasClub ? 'all' : monthOf(w.season, w.day));
  const comps = w.competitions.filter((c) => c.season === w.season);
  const fixtures = (() => {
    return w.fixtures
      .filter((f) => !f.cancelled && Number(f.compId.split('-').pop()) === w.season)
      .filter((f) => compId === 'all' || f.compId === compId)
      .filter((f) => !mine || isUser(w, f.homeId) || isUser(w, f.awayId))
      .filter((f) => month === 'all' || monthOf(w.season, f.day) === month)
      .sort((a, b) => a.day - b.day || a.id - b.id);
  })();
  const byDay = new Map<number, Fixture[]>();
  for (const f of fixtures) {
    const arr = byDay.get(f.day);
    if (arr) arr.push(f);
    else byDay.set(f.day, [f]);
  }
  const months = [...new Set(w.fixtures.filter((f) => Number(f.compId.split('-').pop()) === w.season).map((f) => monthOf(w.season, f.day)))];
  return (
    <Page
      title="Fixtures & results"
      actions={<>
        {hasClub && <label className="row small"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My club only</label>}
        <select value={compId} onChange={(e) => setCompId(e.target.value)}>
          <option value="all">All competitions</option>
          {comps.map((c) => <option key={c.id} value={c.id}>{shortCompName(c)}</option>)}
        </select>
        <select value={String(month)} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{MONTHS[m]}</option>)}
        </select>
      </>}
    >
      {!fixtures.length && <Empty>No fixtures match the filters.</Empty>}
      <div className="col">
        {[...byDay.entries()].map(([day, list]) => (
          <Card key={day} title={<h3>{fmtDate(w.season, day)}{day === w.day ? ' · today' : ''}</h3>}>
            <table className="tbl">
              <tbody>
                {list.map((f) => {
                  const h = getClub(w, f.homeId);
                  const a = getClub(w, f.awayId);
                  const mineRow = isUser(w, f.homeId) || isUser(w, f.awayId);
                  const gameId = f.result?.gameId;
                  const hasLog = gameId != null && w.games.some((g) => g.id === gameId);
                  const userWon = f.result && mineRow ? (isUser(w, f.homeId) ? f.result.home > f.result.away : f.result.away > f.result.home) : null;
                  return (
                    <tr key={f.id} className={mineRow ? 'me' : ''} style={{ cursor: hasLog ? 'pointer' : undefined }} onClick={() => hasLog && nav(`/game/${gameId}`)}>
                      <td className="small muted" style={{ width: 260 }}>{f.label}{f.neutral ? ' · neutral' : ''}</td>
                      <td className="r" style={{ width: '25%' }}><span className="row" style={{ justifyContent: 'flex-end' }}>{h.name} <Crest club={h} /></span></td>
                      <td className="c" style={{ width: 90 }}>
                        {f.result ? <b className="num">{f.result.home}–{f.result.away}{f.result.ot ? ` (${f.result.ot}OT)` : ''}</b> : <span className="muted">vs</span>}
                      </td>
                      <td style={{ width: '25%' }}><span className="row"><Crest club={a} /> {a.name}</span></td>
                      <td>
                        {userWon != null && <Badge tone={userWon ? 'good' : 'bad'}>{userWon ? 'W' : 'L'}</Badge>}
                        {hasLog && <span className="link small" style={{ marginLeft: 8 }}>Box score</span>}
                        {f.result && f.result.attendance > 0 && <span className="small faint" style={{ marginLeft: 8 }}>{f.result.attendance.toLocaleString('en')} fans</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </Page>
  );
}
