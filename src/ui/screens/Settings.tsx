import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Department, DelegationMode, ExecutiveStyle, HoldKind } from '../../engine/types';
import { DEPARTMENTS } from '../../engine/types';
import { DEPT_LABEL, MODE_DESC, MODE_LABEL } from '../../engine/delegation';
import { delegationPreset } from '../../engine/worldgen';
import { serialize, deserialize, deleteSave } from '../../engine/save';
import { fmtMoney } from '../../engine/world';
import { fmtAbs } from '../../engine/calendar';
import { useAct, useGame, useNotify, useWorld } from '../store';
import { Button, Card, Page, Pills, Tabs, Table, NumberField } from '../components/ui';

const HOLD_LABEL: Record<HoldKind, string> = {
  userGame: 'Before each of your games',
  decision: 'New decisions (offers, events)',
  injury: 'Injuries to your players',
  boardUltimatum: 'Board warnings & ultimatums',
  budgetBreach: 'Budget breaches / negative cash',
  transferBid: 'Bids for your players',
  contractExpiry: 'Contract expiry reminders',
  jobOffer: 'Job offers & dismissals',
  seasonEvent: 'Season events (qualification, elimination, promotion)',
  projectComplete: 'Construction projects completed',
  windowClose: 'Transfer window closing',
};

const MODES: DelegationMode[] = ['manual', 'recommend', 'policy', 'notify', 'full'];

export default function Settings() {
  const w = useWorld();
  const [tab, setTab] = useState<'delegation' | 'log' | 'game' | 'saves'>('delegation');
  return (
    <Page title="Settings & saves">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'delegation', label: 'Delegation' }, { id: 'log', label: `Delegation log (${w.delegationLog.length})` }, { id: 'game', label: 'Game options' }, { id: 'saves', label: 'Save / load' }]} />
      {tab === 'delegation' && <Delegation />}
      {tab === 'log' && <DelegationLog />}
      {tab === 'game' && <GameOptions />}
      {tab === 'saves' && <Saves />}
    </Page>
  );
}

function Delegation() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const set = (d: Department, patch: Partial<(typeof w.user.delegation)[Department]>) => act((ww) => { ww.user.delegation[d] = { ...ww.user.delegation[d], ...patch }; });
  return (
    <div className="col gap16">
      <Card title="Executive style presets">
        <div className="row wrap">
          {(['owner', 'gm', 'obsessive', 'custom'] as ExecutiveStyle[]).map((s) => (
            <Button key={s} variant={w.user.style === s ? 'primary' : undefined} onClick={() => { act((ww) => { ww.user.style = s; ww.user.delegation = delegationPreset(s); }); notify(`Delegation reset to the ${s} preset.`); }}>
              {s === 'owner' ? 'Owner' : s === 'gm' ? 'General Manager' : s === 'obsessive' ? 'Basketball obsessive' : 'Custom'}
            </Button>
          ))}
        </div>
        <p className="small muted mt8">Staff never make irreversible decisions outside your policy. Every delegated decision is recorded in the delegation log with its rationale and responsible staff member.</p>
      </Card>
      <Card title="Departments">
        <div className="list">
          {DEPARTMENTS.map((d) => {
            const pol = w.user.delegation[d];
            return (
              <div key={d} className="list-item">
                <div className="row wrap">
                  <b style={{ minWidth: 300 }}>{DEPT_LABEL[d]}</b>
                  <Pills value={pol.mode} onChange={(m) => set(d, { mode: m })} options={MODES.map((m) => ({ id: m, label: MODE_LABEL[m], title: MODE_DESC[m] }))} />
                </div>
                <div className="small muted mt8">{MODE_DESC[pol.mode]}</div>
                <div className="row wrap mt8 small">
                  {d === 'transfers' && (
                    <>
                      <span className="muted">Max salary for delegated signings</span>
                      <NumberField value={pol.maxSalary ?? 0} step={5000} min={0} onChange={(v) => set(d, { maxSalary: v })} prefix="€" />
                      <span className="faint">(0 = whatever the payroll budget allows)</span>
                      <span className="muted">Recommend selling when bid ≥</span>
                      <NumberField value={pol.minSellMultiple ?? 1.4} step={0.1} min={0.5} onChange={(v) => set(d, { minSellMultiple: v })} width={70} />
                      <span className="faint">× market value</span>
                    </>
                  )}
                  {d === 'sponsors' && (
                    <>
                      <span className="muted">Accept offers ≥</span>
                      <NumberField value={Math.round((pol.sponsorFloor ?? 0.9) * 100)} step={5} min={50} max={150} onChange={(v) => set(d, { sponsorFloor: v / 100 })} width={70} />
                      <span className="faint">% of slot benchmark · Excluded categories:</span>
                      {['Betting', 'Crypto', 'Energy', 'Real estate'].map((cat) => (
                        <label key={cat} className="row gap4">
                          <input type="checkbox" checked={pol.excludedCategories?.includes(cat) ?? false} onChange={(e) => set(d, { excludedCategories: e.target.checked ? [...(pol.excludedCategories ?? []), cat] : (pol.excludedCategories ?? []).filter((x) => x !== cat) })} />
                          {cat}
                        </label>
                      ))}
                    </>
                  )}
                  {d === 'marketing' && (
                    <>
                      <span className="muted">Weekly spend cap</span>
                      <NumberField value={pol.spendCap ?? 0} step={500} min={0} onChange={(v) => set(d, { spendCap: v })} prefix="€" />
                      <span className="faint">(0 = marketing budget / 52)</span>
                    </>
                  )}
                  {d === 'medical' && (
                    <>
                      <span className="muted">Accept re-injury risk up to</span>
                      <NumberField value={pol.riskTolerance ?? 30} step={5} min={0} max={80} onChange={(v) => set(d, { riskTolerance: v })} width={70} />
                      <span className="faint">%</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function DelegationLog() {
  const w = useWorld();
  return (
    <Card>
      <Table
        rows={w.delegationLog}
        rowKey={(e) => e.id}
        empty="Nothing delegated yet."
        columns={[
          { key: 'day', label: 'Date', render: (e) => fmtAbs(e.day), sort: (e) => e.day },
          { key: 'dept', label: 'Department', render: (e) => DEPT_LABEL[e.dept] },
          { key: 'staff', label: 'Staff', render: (e) => e.staff },
          { key: 'action', label: 'What happened', render: (e) => <div style={{ whiteSpace: 'normal', maxWidth: 380 }}>{e.action}</div> },
          { key: 'why', label: 'Why', render: (e) => <div className="small muted" style={{ whiteSpace: 'normal', maxWidth: 340 }}>{e.rationale}</div> },
          { key: 'exp', label: 'Expected impact', render: (e) => <div className="small" style={{ whiteSpace: 'normal', maxWidth: 220 }}>{e.expected}</div> },
        ]}
      />
    </Card>
  );
}

function GameOptions() {
  const w = useWorld();
  const act = useAct();
  return (
    <div className="grid g2">
      <Card title="Calendar holds — advancing stops when…">
        <div className="col">
          {(Object.keys(HOLD_LABEL) as HoldKind[]).map((k) => (
            <label key={k} className="row">
              <input type="checkbox" checked={w.settings.holds[k]} onChange={(e) => act((ww) => { ww.settings.holds[k] = e.target.checked; })} />
              {HOLD_LABEL[k]}
            </label>
          ))}
        </div>
      </Card>
      <div className="col gap16">
        <Card title="World noise">
          <Pills value={w.settings.worldNoise} onChange={(v) => act((ww) => { ww.settings.worldNoise = v; })} options={[{ id: 'quiet', label: 'Quiet' }, { id: 'normal', label: 'Normal' }, { id: 'handsOn', label: 'Hands-on' }]} />
          <p className="small muted mt8">Frequency of midweek events, offers and media storylines.</p>
        </Card>
        <Card title="Difficulty">
          <Pills value={w.settings.difficulty} onChange={(v) => act((ww) => { ww.settings.difficulty = v; })} options={[{ id: 'relaxed', label: 'Relaxed' }, { id: 'standard', label: 'Standard' }, { id: 'demanding', label: 'Demanding' }, { id: 'brutal', label: 'Brutal' }]} />
          <p className="small muted mt8">What difficulty changes: board warning thresholds (patience). Starting cash is set at career start. Opponents never receive hidden boosts.</p>
        </Card>
        <Card title="Career">
          <div className="kv small">
            <span>Executive</span><span>{w.user.name}</span>
            <span>Role</span><span>{w.user.role === 'owner' ? 'Owner-President' : 'General Manager'}</span>
            {w.user.role === 'owner' && <><span>Personal wealth</span><span>{fmtMoney(w.user.personalWealth)}</span></>}
            <span>World seed</span><span className="mono">{w.settings.seed}</span>
            <span>Ruleset</span><span>{w.rules.version}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Saves() {
  const w = useWorld();
  const save = useGame((s) => s.save);
  const setWorld = useGame((s) => s.setWorld);
  const notify = useNotify();
  const act = useAct();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const exportSave = () => {
    const blob = new Blob([serialize(w)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `basketball-dynasty-${w.season}-${w.day}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="grid g2">
      <Card title="This career">
        <div className="col">
          <label className="field">Save name<input value={w.saveName} placeholder="(automatic)" onChange={(e) => act((ww) => { ww.saveName = e.target.value; })} /></label>
          <div className="row wrap">
            <Button variant="primary" onClick={() => save(false)}>Save now</Button>
            <Button onClick={exportSave}>Export to file</Button>
            <Button onClick={() => fileRef.current?.click()}>Import file…</Button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { setWorld(deserialize(await f.text())); notify('Save imported.', 'good'); nav('/today'); } catch (err) { notify(`Import failed: ${(err as Error).message}`, 'bad'); }
            }} />
          </div>
          <p className="small muted">The game autosaves after every advance and keeps one rolling backup.</p>
        </div>
      </Card>
      <Card title="Leave">
        <div className="col">
          <Button onClick={async () => { await save(true); setWorld(null); nav('/'); }}>Save & quit to menu</Button>
          <Button variant="danger" onClick={async () => { if (confirm('Delete this career permanently?')) { await deleteSave(w.saveId); setWorld(null); nav('/'); } }}>Delete this career</Button>
        </div>
      </Card>
    </div>
  );
}
