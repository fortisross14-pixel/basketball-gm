import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { Club, CompType, Player, SeasonStats, Staff, StaffRole, StatLine, World } from '../engine/types';
import { age, club as getClub, staffOf, fmtMoney, tierOf } from '../engine/world';
import { scoutedRange } from '../engine/player';
import { knowledge } from '../engine/squad';
import { STAFF_EFFECT, STAFF_LABEL, staffAsk, severance, hireStaff, fireStaff, OFF_LABEL, DEF_LABEL } from '../engine/staff';
import { book } from '../engine/world';
import { canAddStaff } from '../engine/facilities';
import { Badge, Button, Card, Modal, Rating, Table } from './components/ui';
import { StaffFace } from './art/faces';
import { recordLine, candidateScore } from '../engine/coaching';
import { useAct, useNotify, useWorld } from './store';

// ---------------------------------------------------------------- stats
export function emptyLine(): StatLine {
  return { gp: 0, gs: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pm: 0 };
}

export function addLine(a: StatLine, b: StatLine): StatLine {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof StatLine)[]) out[k] = a[k] + b[k];
  return out;
}

/** Season totals for a player (optionally one comp / one team). */
export function seasonLine(p: Player, season: number, comp?: CompType, teamId?: number): StatLine {
  return p.stats.filter((s: SeasonStats) => s.season === season && (comp ? s.comp === comp : s.comp !== 'friendly') && (teamId == null || s.teamId === teamId)).reduce((a, s) => addLine(a, s), emptyLine());
}

export function perGame(l: StatLine, k: keyof StatLine): string {
  if (!l.gp) return '–';
  return (l[k] / l.gp).toFixed(1);
}

export function pctStr(m: number, a: number): string {
  if (!a) return '–';
  return `${((m / a) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------- scouting view
export function ovrRange(w: World, p: Player): [number, number] | null {
  const k = knowledge(w, p);
  if (k >= 95) return null;
  return scoutedRange(p.ovr, k, p.id);
}

export function potRange(w: World, p: Player): [number, number] {
  const k = knowledge(w, p);
  const base = scoutedRange(p.pot, Math.min(k, age(w, p) >= 27 ? 100 : k * 0.85), p.id * 7);
  return [Math.max(base[0], ovrRange(w, p)?.[0] ?? p.ovr), base[1]];
}

export function OvrCell({ p }: { p: Player }) {
  const w = useWorld();
  return <Rating v={p.ovr} range={ovrRange(w, p)} />;
}

export function PotCell({ p }: { p: Player }) {
  const w = useWorld();
  const r = potRange(w, p);
  return <Rating v={p.pot} range={r[0] === r[1] ? null : r} title="Potential range — better scouting narrows it" />;
}

export function teamName(w: World, id: number | null): string {
  return id == null ? 'Free agent' : getClub(w, id).name;
}

export function moraleTone(m: number): 'good' | 'warn' | 'bad' {
  return m >= 65 ? 'good' : m >= 45 ? 'warn' : 'bad';
}

export function MoraleBadge({ p }: { p: Player }) {
  const m = Math.round(p.morale);
  return <Badge tone={moraleTone(m)} title="Morale">{m >= 65 ? '😊' : m >= 45 ? '😐' : '😠'} {m}</Badge>;
}

export function InjuryBadge({ p }: { p: Player }) {
  if (!p.injury) return null;
  return <Badge tone={p.injury.playThroughRisk ? 'warn' : 'bad'} title={p.injury.type}>🩹 {p.injury.daysOut}d</Badge>;
}

// ---------------------------------------------------------------- staff
export function StaffPanel({ roles, title }: { roles: StaffRole[]; title: string }) {
  const w = useWorld();
  const c = getClub(w, w.user.clubId!);
  const [hiring, setHiring] = useState<StaffRole | null>(null);
  const act = useAct();
  const notify = useNotify();
  return (
    <Card title={title}>
      <div className="col">
        {roles.map((role) => {
          const s = staffOf(w, c, role);
          return (
            <div key={role} className="list-item">
              <div className="row">
                <div style={{ minWidth: 220 }}>
                  <div className="small muted">{STAFF_LABEL[role]}</div>
                  {s ? <Link to={`/staff/${s.id}`} className="plink-face link"><StaffFace staff={s} size={30} round /><b>{s.firstName} {s.lastName}</b></Link> : <b className="bad">Vacant</b>}
                </div>
                {s && <Rating v={s.rating} title="Overall competence" />}
                {s && (
                  <div className="small muted" style={{ flex: 1 }}>
                    Age {w.season - s.born} · {fmtMoney(s.contract?.salary ?? 0)}/yr to {(s.contract?.expires ?? w.season) + 1}
                    {s.offPref && ` · prefers ${OFF_LABEL[s.offPref]}`}{s.defPref && ` / ${DEF_LABEL[s.defPref]}`}
                    {role.startsWith('assistant') || role === 'headCoach' ? ` · dev ${s.development} · motivation ${s.motivation}` : ''}
                  </div>
                )}
                {!s && <div className="small muted" style={{ flex: 1 }}>{STAFF_EFFECT[role]}</div>}
                <Button size="sm" onClick={() => setHiring(role)}>{s ? 'Replace' : 'Hire'}</Button>
                {s && (
                  <Button size="sm" variant="danger" onClick={() => {
                    if (!confirm(`Dismiss ${s.firstName} ${s.lastName}? Severance: ${fmtMoney(severance(w, s))}.`)) return;
                    act((ww) => { const cost = fireStaff(ww, c, s); book(ww, c, 'severance', -cost); });
                    notify(`${s.lastName} dismissed.`);
                  }}>Dismiss</Button>
                )}
              </div>
              {s && <div className="small faint mt8">{STAFF_EFFECT[role]}</div>}
            </div>
          );
        })}
      </div>
      {hiring && <HireStaffModal club={c} role={hiring} onClose={() => setHiring(null)} />}
    </Card>
  );
}

export function HireStaffModal({ club, role, onClose }: { club: Club; role: StaffRole; onClose: () => void }) {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const tier = tierOf(w, club) || 1;
  const current = staffOf(w, club, role);
  const pool = w.staff.filter((s) => s.teamId == null && !s.nba && s.role === role).sort((a, b) => b.rating - a.rating);
  const interested = (s: Staff) => s.reputation <= club.prestige + 30 + w.user.reputation / 4;
  const room = current ? { ok: true as const, reason: undefined } : canAddStaff(w, club);
  return (
    <Modal title={`Hire: ${STAFF_LABEL[role]}`} onClose={onClose} wide>
      <p className="muted small">{STAFF_EFFECT[role]} {current ? `Replacing ${current.firstName} ${current.lastName} costs ${fmtMoney(severance(w, current))} in severance.` : ''}</p>
      {!room.ok && <div className="callout warn small mb8">{room.reason} <Link className="link" to="/infrastructure/club-facilities">Expand offices</Link></div>}
      <Table
        rows={pool}
        rowKey={(s) => s.id}
        initialSort="rating"
        columns={[
          { key: 'name', label: 'Name', render: (s) => <span className="plink-face"><StaffFace staff={s} size={26} round /><Link className="link" to={`/staff/${s.id}`}>{s.firstName} {s.lastName}</Link></span> },
          { key: 'rec', label: 'Record', render: (s) => <span className="small muted">{(s.record ?? []).length ? recordLine(s) : '—'}</span> },
          { key: 'age', label: 'Age', render: (s) => w.season - s.born, sort: (s) => s.born, align: 'r' },
          { key: 'rating', label: 'Rating', render: (s) => <Rating v={s.rating} />, sort: (s) => s.rating, align: 'c' },
          { key: 'dev', label: 'Dev', render: (s) => s.development, sort: (s) => s.development, align: 'r', title: 'Player development' },
          { key: 'mot', label: 'Motiv.', render: (s) => s.motivation, sort: (s) => s.motivation, align: 'r' },
          { key: 'sys', label: 'Philosophy', render: (s) => [s.offPref && OFF_LABEL[s.offPref], s.defPref && DEF_LABEL[s.defPref]].filter(Boolean).join(' / ') || '—' },
          { key: 'rep', label: 'Rep.', render: (s) => s.reputation, sort: (s) => s.reputation, align: 'r' },
          ...(role === 'headCoach' ? [{ key: 'score', label: 'Fit score', render: (s: Staff) => Math.round(candidateScore(w, s, club)), sort: (s: Staff) => candidateScore(w, s, club), align: 'r' as const, title: 'Results vs expectations, league level, continental record, development and tactical fit with your squad' }] : []),
          { key: 'ask', label: 'Asks', render: (s) => fmtMoney(staffAsk(w, s, tier)) + '/yr', sort: (s) => staffAsk(w, s, tier), align: 'r' },
          {
            key: 'act', label: '', render: (s) => !room.ok ? <Badge title={room.reason}>No desk free</Badge> : interested(s) ? (
              <Button size="sm" variant="primary" onClick={() => {
                act((ww) => {
                  if (current) book(ww, club, 'severance', -severance(ww, current));
                  hireStaff(ww, club, s, staffAsk(ww, s, tier), 2);
                });
                notify(`${s.firstName} ${s.lastName} hired as ${STAFF_LABEL[role]}.`, 'good');
                onClose();
              }}>Hire (2 yrs)</Button>
            ) : <Badge title="Your club's prestige and your reputation are not enough">Not interested</Badge>,
          },
        ]}
      />
    </Modal>
  );
}

export function clubOf(w: World, p: Player): Club | null {
  return p.teamId == null ? null : getClub(w, p.teamId);
}
