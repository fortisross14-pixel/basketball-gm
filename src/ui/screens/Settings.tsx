import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Department, DelegationMode, ExecutiveStyle, HoldKind } from '../../engine/types';
import { DEPARTMENTS } from '../../engine/types';
import { DEPT_LABEL, MODE_DESC, MODE_LABEL } from '../../engine/delegation';
import { delegationPreset } from '../../engine/worldgen';
import { serialize, importWorld, deleteSave } from '../../engine/save';
import { fmtMoney } from '../../engine/world';
import { fmtAbs } from '../../engine/calendar';
import { useAct, useGame, useNotify, useWorld } from '../store';
import { StorageStatus } from '../components/storage';
import { InstallButton } from '../components/install';
import { Badge, Button, Card, ClubLink, Crest, Page, Pills, Tabs, Table, NumberField } from '../components/ui';
import { ClubEditorModal } from '../components/clubEditor';
import { applyPack, buildPack, downloadPack, getAutoApply, isEdited, loadStoredPack, mergeIntoStoredPack, packSize, parsePack, setAutoApply, storePack, type ClubPack } from '../clubPack';

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
  const [tab, setTab] = useState<'delegation' | 'log' | 'game' | 'clubs' | 'saves'>('delegation');
  return (
    <Page title="Settings & saves">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'delegation', label: 'Delegation' }, { id: 'log', label: `Delegation log (${w.delegationLog.length})` }, { id: 'game', label: 'Game options' }, { id: 'clubs', label: 'Club editor' }, { id: 'saves', label: 'Save / load' }]} />
      {tab === 'delegation' && <Delegation />}
      {tab === 'log' && <DelegationLog />}
      {tab === 'game' && <GameOptions />}
      {tab === 'clubs' && <ClubEditor />}
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
            <Button key={s} variant={w.user.style === s ? 'primary' : undefined} onClick={() => { if (!confirm('Reset every department to this preset? Your custom delegation settings will be replaced.')) return; act((ww) => { ww.user.style = s; ww.user.delegation = delegationPreset(s); }); notify(`Delegation reset to the ${s} preset.`); }}>
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
        <Card title="Your games">
          <label className="row"><input type="checkbox" checked={w.settings.liveGames !== false} onChange={(e) => act((ww) => { ww.settings.liveGames = e.target.checked; })} /> Watch my games live, minute by minute (stops at every quarter)</label>
          <p className="small muted mt8">Off: your games simulate instantly like everyone else's. Month and holiday advances always simulate instantly.</p>
        </Card>
        <Card title="Text size">
          <Pills value={String(w.settings.textScale ?? 1)} onChange={(v) => act((ww) => { ww.settings.textScale = Number(v); })} options={[{ id: '1', label: '100%' }, { id: '1.15', label: '115%' }, { id: '1.3', label: '130%' }, { id: '1.5', label: '150%' }, { id: '2', label: '200%' }]} />
        </Card>
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

function ClubEditor() {
  const w = useWorld();
  const act = useAct();
  const save = useGame((s) => s.save);
  const notify = useNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [stored, setStored] = useState<ClubPack | null>(null);
  const [auto, setAuto] = useState(true);
  const reloadStored = () => { void loadStoredPack().then(setStored); };
  useEffect(() => { reloadStored(); void getAutoApply().then(setAuto); }, [editId]);
  const needle = q.trim().toLowerCase();
  const rows = w.clubs.filter((c) => (!onlyEdited || isEdited(c)) && (!needle || [c.name, c.nickname, c.abbrev, c.city, c.seedName ?? ''].some((x) => x.toLowerCase().includes(needle))));
  const editing = editId != null ? w.clubs.find((c) => c.id === editId) : undefined;
  const league = (c: (typeof w.clubs)[number]) => (c.leagueId ? w.rules.leagues[c.leagueId].short : c.foreign ? 'Continental' : '—');
  const edited = buildPack(w);
  const importPack = async (f: File) => {
    try {
      const pack = parsePack(await f.text());
      const n = act((ww) => applyPack(ww, pack));
      await save(true);
      await mergeIntoStoredPack(pack.clubs);
      reloadStored();
      notify(`Club pack applied to ${n} club${n === 1 ? '' : 's'} (${packSize(pack)} in the file).`, n ? 'good' : 'warn');
    } catch (err) { notify(`Import failed: ${(err as Error).message}`, 'bad'); }
  };
  return (
    <div className="col gap16">
      <div className="grid g2">
        <Card title="Club packs">
          <div className="col">
            <div className="row wrap">
              <Button variant="primary" disabled={!packSize(edited)} onClick={() => downloadPack(edited, `club-pack-${packSize(edited)}-clubs.json`)}>Export pack ({packSize(edited)} edited)</Button>
              <Button onClick={() => fileRef.current?.click()}>Import pack…</Button>
              <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Import club pack" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importPack(f); }} />
            </div>
            <p className="small muted">A pack holds names, nicknames, abbreviations, colours, arena names and logos, keyed by each club's original name, so it works in any career. Importing overrides only the fields the pack contains.</p>
          </div>
        </Card>
        <Card title="New games">
          <div className="col">
            <label className="row"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); void setAutoApply(e.target.checked); }} /> Apply my stored club pack to new careers automatically</label>
            <div className="small muted">Stored pack (this browser): {packSize(stored) ? `${packSize(stored)} club${packSize(stored) === 1 ? '' : 's'}` : 'empty'}. It is updated every time you edit a club or import a pack.</div>
            <div className="row wrap">
              <Button size="sm" disabled={!packSize(stored)} onClick={() => stored && downloadPack(stored, 'club-pack-stored.json')}>Download stored pack</Button>
              <Button size="sm" disabled={!packSize(stored)} onClick={async () => { if (stored && confirm(`Apply the stored pack (${packSize(stored)} clubs) to this career?`)) { const n = act((ww) => applyPack(ww, stored)); await save(true); notify(`Stored pack applied to ${n} clubs.`, 'good'); } }}>Apply stored pack here</Button>
              <Button size="sm" variant="danger" disabled={!packSize(stored)} onClick={async () => { if (confirm('Clear the stored club pack? Clubs in existing careers keep their edits.')) { await storePack(null); reloadStored(); notify('Stored club pack cleared.'); } }}>Clear stored pack</Button>
            </div>
          </div>
        </Card>
      </div>
      <Card title={`Clubs (${rows.length})`} actions={<div className="row"><label className="row gap4 small"><input type="checkbox" checked={onlyEdited} onChange={(e) => setOnlyEdited(e.target.checked)} /> Edited only</label><input placeholder="Search clubs…" aria-label="Search clubs" value={q} onChange={(e) => setQ(e.target.value)} /></div>}>
        <Table
          rows={rows}
          rowKey={(c) => c.id}
          initialSort="club"
          initialDir="asc"
          empty="No club matches."
          columns={[
            { key: 'crest', label: '', render: (c) => <Crest club={c} /> },
            { key: 'club', label: 'Club', render: (c) => <span><b><ClubLink club={c} /></b> <span className="small muted">“{c.nickname}”</span>{c.seedName && c.seedName !== c.name && <div className="small faint">originally {c.seedName}</div>}</span>, sort: (c) => c.name },
            { key: 'abbr', label: 'Abbr.', render: (c) => <span className="mono">{c.abbrev}</span>, sort: (c) => c.abbrev },
            { key: 'lg', label: 'League', render: league, sort: league },
            { key: 'city', label: 'City', render: (c) => c.city, sort: (c) => c.city },
            { key: 'arena', label: 'Arena', render: (c) => <span className="small">{c.arena.name}</span> },
            { key: 'st', label: '', render: (c) => (isEdited(c) ? <Badge tone="accent">{c.logoUrl ? 'Edited · logo' : 'Edited'}</Badge> : null) },
            { key: 'edit', label: '', render: (c) => <Button size="sm" onClick={() => setEditId(c.id)}>Edit</Button>, align: 'r' },
          ]}
        />
      </Card>
      {editing && <ClubEditorModal club={editing} onClose={() => setEditId(null)} />}
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
              if (!confirm('Import this file? Your current career stays saved in its own slot; the import opens in a new one.')) return;
              try { await save(true); setWorld(await importWorld(await f.text())); notify('Save imported into its own slot.', 'good'); nav('/today'); } catch (err) { notify(`Import failed: ${(err as Error).message}`, 'bad'); }
            }} />
          </div>
          <p className="small muted">The game autosaves after every advance and keeps one rolling backup.</p>
          <StorageStatus />
          <InstallButton />
        </div>
      </Card>
      <Card title="Leave">
        <div className="col">
          <Button onClick={async () => { await save(false); setWorld(null); nav('/'); }}>Save & quit to menu</Button>
          <Button variant="danger" onClick={async () => { if (confirm('Delete this career permanently?')) { await deleteSave(w.saveId); setWorld(null); nav('/'); } }}>Delete this career</Button>
        </div>
      </Card>
    </div>
  );
}
