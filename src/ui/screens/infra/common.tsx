import type { Club, FacilityKey, World } from '../../../engine/types';
import { FACILITY_INFO, MAX_LEVEL, projectOptions, projectRoi, startProject, type ProjectOption } from '../../../engine/arena';
import { boardApproves } from '../../../engine/board';
import { club as getClub, fmtMoney } from '../../../engine/world';
import { Badge, Bar, Button, Card } from '../../components/ui';
import { useAct, useNotify, useWorld } from '../../store';

export function useUserClub(): { w: World; c: Club } {
  const w = useWorld();
  return { w, c: getClub(w, w.user.clubId!) };
}

/** Board check + start a project; returns a message for the user. */
export function launchProject(w: World, c: Club, o: ProjectOption, financing: 'cash' | 'loan'): { ok: boolean; message: string } {
  if (o.needsBoard) {
    const b = boardApproves(w, c, o.cost);
    if (!b.ok) return { ok: false, message: b.message };
  }
  const res = startProject(w, c, o, financing);
  if (!res.ok) return { ok: false, message: res.reason ?? 'The project could not be started.' };
  return { ok: true, message: `Works started: ${o.label} (${fmtMoney(o.cost)}, ~${o.weeks} weeks).` };
}

/** Compact facility levels with an upgrade shortcut (cash financing). */
export function FacilityUpgrades({ keys, title }: { keys: FacilityKey[]; title: string }) {
  const { w, c } = useUserClub();
  const act = useAct();
  const notify = useNotify();
  const opts = projectOptions(w, c);
  const active = w.projects[c.id] ?? [];
  return (
    <Card title={title}>
      <div className="col">
        {keys.map((k) => {
          const info = FACILITY_INFO[k];
          const lvl = c.arena.levels[k];
          const o = opts.find((x) => x.kind === 'facility' && x.facility === k);
          const building = active.find((p) => p.kind === 'facility' && p.facility === k);
          const roi = o ? projectRoi(w, c, o) : null;
          return (
            <div key={k} className="list-item">
              <div className="row">
                <b style={{ minWidth: 220 }}>{info.label}</b>
                <div style={{ width: 120 }}><Bar value={lvl} max={MAX_LEVEL} /></div>
                <span className="small">Level {lvl}/{MAX_LEVEL}</span>
                <span className="spacer" />
                {building ? (
                  <Badge tone="info">Under construction</Badge>
                ) : o && !o.blocked ? (
                  <>
                    <span className="small muted">{fmtMoney(o.cost)} · {o.weeks} wks{roi ? ` · ${roi.annual >= 0 ? '+' : ''}${fmtMoney(roi.annual)}/yr` : ''}</span>
                    <Button size="sm" onClick={() => {
                      const r = act((ww) => launchProject(ww, getClub(ww, c.id), o, 'cash'));
                      notify(r.message, r.ok ? 'good' : 'bad');
                    }}>Upgrade</Button>
                  </>
                ) : (
                  <Badge>{o?.blocked ?? 'Max'}</Badge>
                )}
              </div>
              <div className="small faint mt8">{info.effect} Trade-off: {info.tradeoff}{roi ? ` ${roi.notes}` : ''}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
