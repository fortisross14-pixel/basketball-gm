import { Link } from 'react-router-dom';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, Meter, Page, Pills, PlayerLink } from '../../components/ui';
import { OvrCell, InjuryBadge } from '../../helpers';
import { club as getClub, roster, staffOf } from '../../../engine/world';
import { fmtAbs as fmtAbsDay } from '../../../engine/calendar';
import { OFF_LABEL, DEF_LABEL } from '../../../engine/staff';
import { offFit, defFit, OFF_INFO, DEF_INFO, coachSetsTactics, MODE_LABEL } from '../../../engine/delegation';
import type { Club, DefScheme, OffSystem, Pace, Player, RotationStyle, Tactics as T } from '../../../engine/types';

const OFFS: OffSystem[] = ['paceSpace', 'motion', 'pnr', 'post', 'isolation'];
const DEFS: DefScheme[] = ['switch', 'drop', 'packPaint', 'pressure', 'zone'];
const ROT: { id: RotationStyle; label: string; desc: string }[] = [
  { id: 'tight', label: 'Tight (8)', desc: 'Starters play heavy minutes. Best players on court more, but fatigue and injury risk rise.' },
  { id: 'balanced', label: 'Balanced (9)', desc: 'Standard nine-man rotation.' },
  { id: 'deep', label: 'Deep (11)', desc: 'Fresh legs all game; weaker bench players see the floor.' },
  { id: 'development', label: 'Development', desc: 'Young players (≤22) are favoured in the rotation: development and youth objectives, at some cost to results.' },
  { id: 'veteran', label: 'Veteran control', desc: 'Experienced players (28+) are favoured: steadier, less upside.' },
];
const SLIDERS: { key: 'threeEmphasis' | 'reboundEmphasis' | 'foulDiscipline' | 'starUsage'; label: string; lo: string; hi: string; desc: string }[] = [
  { key: 'threeEmphasis', label: 'Three-point emphasis', lo: 'Attack inside', hi: 'Bomb away', desc: 'Share of shots taken from three. Forcing threes with weak shooters lowers their accuracy.' },
  { key: 'reboundEmphasis', label: 'Offensive rebounding', lo: 'Get back', hi: 'Crash the glass', desc: 'More second chances vs. conceding fast breaks.' },
  { key: 'foulDiscipline', label: 'Defensive aggression', lo: 'Careful', hi: 'Physical', desc: 'Physical defence forces more mistakes but sends opponents to the line and creates foul trouble.' },
  { key: 'starUsage', label: 'Feed the star', lo: 'Share the ball', hi: 'Star takes over', desc: 'How often your best player takes the shot.' },
];

export default function Tactics() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const c = getClub(w, w.user.clubId!);
  const t = c.tactics;
  const squad = roster(w, c.id);
  const healthy = squad.filter((p) => !p.injury);
  const coach = staffOf(w, c, 'headCoach');
  const mode = w.user.delegation.tactics.mode;
  const delegated = mode === 'policy' || mode === 'notify' || mode === 'full';
  const set = (patch: Partial<T>) => act(() => { Object.assign(c.tactics, patch); });

  const recent = w.games.filter((g) => g.home.clubId === c.id || g.away.clubId === c.id).slice(-3).reverse();
  const order = lineupOrder(c, squad);

  return (
    <Page
      title="Tactics"
      subtitle="Games resolve instantly: your roster, your coach and these settings decide them."
      actions={<Button onClick={() => { act((ww) => coachSetsTactics(ww, getClub(ww, c.id), true)); notify(`Coach ${coach?.lastName ?? '(interim)'} set the game plan.`); }}>Let the coach decide</Button>}
    >
      {delegated && (
        <div className="mb8" style={{ marginBottom: 14 }}>
          <Callout tone="warn">
            Tactics are delegated (<b>{MODE_LABEL[mode]}</b>): the head coach rewrites systems and lineups every week. Change it in <Link className="link" to="/settings">Settings → Delegation</Link> to keep your own plan.
          </Callout>
        </div>
      )}
      <div className="grid g2">
        <Card title="Offensive system">
          <div className="col">
            {OFFS.map((o) => {
              const fit = Math.round(offFit(healthy, o));
              return (
                <SystemRow key={o} active={t.off === o} onPick={() => set({ off: o })} label={OFF_LABEL[o]} fit={fit} coachPrefers={coach?.offPref === o} info={OFF_INFO[o]} />
              );
            })}
          </div>
        </Card>
        <Card title="Defensive scheme">
          <div className="col">
            {DEFS.map((d) => {
              const fit = Math.round(defFit(healthy, d));
              return <SystemRow key={d} active={t.def === d} onPick={() => set({ def: d })} label={DEF_LABEL[d]} fit={fit} coachPrefers={coach?.defPref === d} info={DEF_INFO[d]} />;
            })}
          </div>
        </Card>
      </div>

      <div className="grid g2 mt16">
        <Card title="Tempo & rotation">
          <div className="col">
            <div>
              <div className="small muted mb8">Pace</div>
              <Pills<Pace> value={t.pace} onChange={(v) => set({ pace: v })} options={[{ id: 'slow', label: 'Slow', title: 'Fewer possessions: narrows the gap vs better teams' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Fast', title: 'More possessions and transition; more fatigue and turnovers' }]} />
            </div>
            <div>
              <div className="small muted mb8">Rotation</div>
              <Pills<RotationStyle> value={t.rotation} onChange={(v) => set({ rotation: v })} options={ROT.map((r) => ({ id: r.id, label: r.label, title: r.desc }))} />
              <div className="small faint mt8">{ROT.find((r) => r.id === t.rotation)?.desc}</div>
            </div>
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="row small"><b>{s.label}</b><span className="spacer" /><span className="muted">{t[s.key] > 0 ? `+${t[s.key]}` : t[s.key]}</span></div>
                <div className="row small">
                  <span className="faint" style={{ width: 90 }}>{s.lo}</span>
                  <input type="range" min={-2} max={2} step={1} value={t[s.key]} onChange={(e) => set({ [s.key]: Number(e.target.value) } as Partial<T>)} style={{ flex: 1 }} />
                  <span className="faint" style={{ width: 90, textAlign: 'right' }}>{s.hi}</span>
                </div>
                <div className="small faint">{s.desc}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Coach & recent feedback">
          {coach ? (
            <div className="small mb8">
              <b>{coach.firstName} {coach.lastName}</b> (rating {coach.rating}) prefers <b>{coach.offPref ? OFF_LABEL[coach.offPref] : '—'}</b> and <b>{coach.defPref ? DEF_LABEL[coach.defPref] : '—'}</b>.{' '}
              {t.off === coach.offPref && t.def === coach.defPref ? <span className="good">He fully agrees with the plan: better execution.</span> : <span className="warn">Running systems he doesn't prefer costs some execution in games.</span>}
            </div>
          ) : (
            <Callout tone="bad">No head coach: execution is poor. <Link className="link" to="/team/staff">Hire one</Link>.</Callout>
          )}
          <div className="col mt8">
            {recent.length === 0 && <div className="muted small">No games played yet this season.</div>}
            {recent.map((g) => {
              const us = g.home.clubId === c.id;
              const ours = us ? g.home.score : g.away.score;
              const theirs = us ? g.away.score : g.home.score;
              const opp = getClub(w, us ? g.away.clubId : g.home.clubId);
              const sugg = g.factors.filter((f) => f.suggestion);
              return (
                <div key={g.id} className="list-item">
                  <div className="row small">
                    <Badge tone={ours > theirs ? 'good' : 'bad'}>{ours > theirs ? 'W' : 'L'} {ours}–{theirs}</Badge>
                    <span>{us ? 'vs' : '@'} {opp.abbrev}</span>
                    <span className="faint">{fmtAbsDay(g.day)}</span>
                    <span className="spacer" />
                    <Link className="link" to={`/game/${g.id}`}>Analysis</Link>
                  </div>
                  {sugg.length ? (
                    <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {sugg.map((f, i) => <li key={i}><span className="muted">{f.title}:</span> {f.suggestion}</li>)}
                    </ul>
                  ) : (
                    <div className="small faint">{g.factors[0]?.title ?? ''}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Lineup & rotation order" className="mt16" actions={<Button size="sm" onClick={() => set({ starters: [], rotationOrder: [] })}>Reset to automatic</Button>}>
        <div className="small muted mb8">
          {t.starters.length === 5 ? 'Custom lineup: the first five start, then the bench comes in this order.' : 'Automatic: the coach picks the best balanced five each game. Move anyone to set a custom order.'} Injured players are skipped automatically. Minute cap 0 = no cap.
        </div>
        <table className="tbl">
          <thead><tr><th>#</th><th>Role</th><th>Player</th><th>Pos</th><th className="c">OVR</th><th>Health</th><th className="r">Fresh</th><th>Move</th><th>Max min</th></tr></thead>
          <tbody>
            {order.map((p, i) => (
              <tr key={p.id} className={i === 4 ? 'sep' : ''}>
                <td>{i + 1}</td>
                <td className="small muted">{i < 5 ? 'Starter' : i < 9 ? 'Rotation' : 'Reserve'}</td>
                <td><PlayerLink player={p} /></td>
                <td>{p.pos}</td>
                <td className="c"><OvrCell p={p} /></td>
                <td><InjuryBadge p={p} /></td>
                <td className="r">{Math.round(p.freshness)}</td>
                <td>
                  <span className="row gap4">
                    <Button size="sm" disabled={i === 0} onClick={() => act(() => applyOrder(c, swap(order, i, i - 1)))}>▲</Button>
                    <Button size="sm" disabled={i === order.length - 1} onClick={() => act(() => applyOrder(c, swap(order, i, i + 1)))}>▼</Button>
                  </span>
                </td>
                <td>
                  <input type="number" min={0} max={40} style={{ width: 64 }} value={t.minuteLimits[p.id] ?? 0} onChange={(e) => act(() => {
                    const v = Number(e.target.value);
                    if (!v) delete c.tactics.minuteLimits[p.id];
                    else c.tactics.minuteLimits[p.id] = Math.max(1, Math.min(40, v));
                  })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}

function SystemRow({ active, onPick, label, fit, coachPrefers, info }: { active: boolean; onPick: () => void; label: string; fit: number; coachPrefers: boolean; info: { desc: string; upside: string; downside: string } }) {
  return (
    <div className="list-item" style={{ cursor: 'pointer', borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 10 }} onClick={onPick}>
      <div className="row">
        <input type="radio" checked={active} onChange={onPick} />
        <b>{label}</b>
        {coachPrefers && <Badge tone="info" title="The head coach's preferred system: executed better">Coach's choice</Badge>}
        <span className="spacer" />
        <div style={{ width: 150 }}><Meter value={fit} label="Personnel fit" /></div>
      </div>
      <div className="small muted mt8">{info.desc}</div>
      <div className="small"><span className="good">▲ {info.upside}</span></div>
      <div className="small"><span className="bad">▼ {info.downside}</span></div>
    </div>
  );
}

function lineupOrder(c: Club, squad: Player[]): Player[] {
  const byId = new Map(squad.map((p) => [p.id, p]));
  const t = c.tactics;
  const used = new Set<number>();
  const out: Player[] = [];
  const push = (id: number) => { const p = byId.get(id); if (p && !used.has(id)) { used.add(id); out.push(p); } };
  if (t.starters.length === 5) {
    t.starters.forEach(push);
    t.rotationOrder.forEach(push);
  }
  [...squad].sort((a, b) => b.ovr - a.ovr).forEach((p) => push(p.id));
  return out;
}

function swap(arr: Player[], a: number, b: number): Player[] {
  const out = [...arr];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

function applyOrder(c: Club, order: Player[]) {
  c.tactics.starters = order.slice(0, 5).map((p) => p.id);
  c.tactics.rotationOrder = order.slice(5).map((p) => p.id);
}
