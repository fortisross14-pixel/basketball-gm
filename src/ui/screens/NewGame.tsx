import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Background, Club, ExecutiveStyle, LeagueId, Settings, UserRole, World } from '../../engine/types';
import { BACKGROUND_INFO, COUNTRY_OPTIONS, careerStartOffers } from '../../engine/career';
import { createWorld, assignUser, SCENARIOS, scenarioClub } from '../../engine/worldgen';
import { estimateRevenue } from '../../engine/economy';
import { payroll } from '../../engine/finance';
import { capacity } from '../../engine/arena';
import { clubStrength } from '../../engine/matchday';
import { roster, fmtMoney } from '../../engine/world';
import { useGame } from '../store';
import { applyPack, getAutoApply, loadStoredPack } from '../clubPack';
import { Badge, Button, Card, Crest, Pills, Table, Rating } from '../components/ui';

type Mode = 'career' | 'founder' | 'existing' | 'scenario';

const STYLES: { id: ExecutiveStyle; label: string; desc: string }[] = [
  { id: 'owner', label: 'Owner', desc: 'Basketball operations are delegated (coach sets tactics, sporting director handles routine roster moves). You focus on finance, facilities, brand and big hires.' },
  { id: 'gm', label: 'General Manager', desc: 'You own the roster, staff, tactics and budget (the coach recommends). Day-to-day business (tickets, sponsors, marketing, press) is delegated within policy.' },
  { id: 'obsessive', label: 'Basketball obsessive', desc: 'You control tactics, roster, scouting and key commercial calls. Staff recommend, you decide.' },
  { id: 'custom', label: 'Custom', desc: 'Start from recommendations everywhere and configure each department in Settings.' },
];

export default function NewGame() {
  const nav = useNavigate();
  const setWorld = useGame((s) => s.setWorld);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('gm');
  const [mode, setMode] = useState<Mode>('career');
  const [nationality, setNationality] = useState('ESP');
  const [background, setBackground] = useState<Background>('business');
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [clubId, setClubId] = useState<number | null>(null);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [league, setLeague] = useState<LeagueId>('ORO');
  const [custom, setCustom] = useState({ name: 'CB Nueva Era', nickname: 'Pioneros', abbrev: 'NUE', city: '', colors: ['#0ea5e9', '#ffffff'] as [string, string] });
  const [style, setStyle] = useState<ExecutiveStyle>('gm');
  const [difficulty, setDifficulty] = useState<Settings['difficulty']>('standard');
  const [noise, setNoise] = useState<Settings['worldNoise']>('normal');
  const [busy, setBusy] = useState(false);

  // preview world (generated once, deterministic from seed)
  const preview = useMemo<World>(() => createWorld({ seed, userName: 'Preview', role: 'gm', clubId: null, style: 'gm', difficulty: 'standard', worldNoise: 'normal' }), [seed]);
  // the user's stored club pack (real names/logos) is applied on top of the generated world
  const [packClubs, setPackClubs] = useState(0);
  useEffect(() => {
    let live = true;
    void (async () => {
      if (!(await getAutoApply())) return;
      const pack = await loadStoredPack();
      if (live && pack) setPackClubs(applyPack(preview, pack));
    })();
    return () => { live = false; };
  }, [preview]);

  const start = () => {
    setBusy(true);
    setTimeout(() => {
      const w = preview;
      let cid: number | null = clubId;
      let sc: string | null = null;
      if (mode === 'career') cid = null;
      if (mode === 'scenario') { sc = scenario; cid = scenarioClub(w, scenario); }
      if (mode === 'founder' && cid == null) cid = founderDefault(w);
      assignUser(w, {
        userName: name || 'Executive', role: mode === 'career' ? 'gm' : role, clubId: cid, style, difficulty, worldNoise: noise, nationality, background,
        customClub: mode === 'founder' ? { ...custom, city: custom.city } : null, scenario: sc,
      });
      if (mode === 'career') careerStartOffers(w);
      setWorld(w);
      nav('/today');
    }, 30);
  };

  return (
    <div className="menu-hero court-bg">
      <div style={{ width: 'min(1100px, 96vw)' }}>
        <div className="row mb8">
          <h1>New career</h1>
          <span className="spacer" />
          <Button variant="ghost" onClick={() => nav('/')}>← Menu</Button>
        </div>
        <div className="row mb8 small muted">
          {['You', 'Starting point', 'Executive style'].map((s, i) => (
            <span key={s} className={`badge ${i === step ? 'accent' : ''}`}>{i + 1}. {s}</span>
          ))}
          {packClubs > 0 && <span className="badge" title="Turn this off in Settings → Club editor">Club pack: {packClubs} clubs</span>}
        </div>

        {step === 0 && (
          <div className="grid g2">
            <Card title="Your executive">
              <div className="col">
                <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
                <label className="field">Nationality
                  <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
                    {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </label>
                <p className="small muted">Where you come from decides your first job offers: Spaniards start in the Spanish lower divisions, Americans at struggling US college programs, other nationalities get a mix.</p>
                <label className="field">Background</label>
                <div className="col gap4">
                  {(Object.keys(BACKGROUND_INFO) as Background[]).map((b) => (
                    <label key={b} className="row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input type="radio" checked={background === b} onChange={() => setBackground(b)} style={{ marginTop: 3 }} />
                      <div><b>{BACKGROUND_INFO[b].label}</b> <span className="small muted">— {BACKGROUND_INFO[b].desc}</span></div>
                    </label>
                  ))}
                </div>
                {mode !== 'career' && (
                  <>
                    <label className="field">Formal role</label>
                    <Pills value={role} onChange={setRole} options={[{ id: 'gm', label: 'General Manager' }, { id: 'owner', label: 'Owner-President' }]} />
                    <p className="small muted">
                      {role === 'owner'
                        ? 'Owner-President: you cannot be fired and you can inject personal wealth (€1.5M), but if the club goes into administration your career ends.'
                        : 'General Manager: the board sets objectives and can dismiss you. Success earns job offers from bigger clubs.'}
                    </p>
                  </>
                )}
              </div>
            </Card>
            <Card title="Start mode">
              <div className="col">
                {([
                  ['career', 'Career (recommended)', 'Start as an unknown executive and choose between your first job offers. Fans and owner judge you every week: get fired, or earn offers from bigger clubs.'],
                  ['founder', 'Founder (quick start)', 'Take over a small Segunda FEB club and rebrand it as your own project.'],
                  ['existing', 'Existing club (quick start)', 'Begin at any club in Spain or the US college league.'],
                  ['scenario', 'Challenge scenario', 'Curated short starts with special conditions.'],
                ] as [Mode, string, string][]).map(([id, label, desc]) => (
                  <label key={id} className="row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input type="radio" checked={mode === id} onChange={() => setMode(id)} style={{ marginTop: 3 }} />
                    <div><b>{label}</b><div className="small muted">{desc}</div></div>
                  </label>
                ))}
              </div>
            </Card>
            <div className="span2 row"><span className="spacer" /><Button variant="primary" onClick={() => setStep(1)}>Next →</Button></div>
          </div>
        )}

        {step === 1 && (
          <div className="col">
            {mode === 'founder' && (
              <div className="grid g2">
                <Card title="Your club identity">
                  <div className="grid g2">
                    <label className="field">Club name<input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
                    <label className="field">Nickname<input value={custom.nickname} onChange={(e) => setCustom({ ...custom, nickname: e.target.value })} /></label>
                    <label className="field">Abbreviation<input maxLength={3} value={custom.abbrev} onChange={(e) => setCustom({ ...custom, abbrev: e.target.value.toUpperCase() })} /></label>
                    <label className="field">City (blank = keep)<input value={custom.city} onChange={(e) => setCustom({ ...custom, city: e.target.value })} /></label>
                    <label className="field">Primary colour<input type="color" value={custom.colors[0]} onChange={(e) => setCustom({ ...custom, colors: [e.target.value, custom.colors[1]] })} /></label>
                    <label className="field">Secondary colour<input type="color" value={custom.colors[1]} onChange={(e) => setCustom({ ...custom, colors: [custom.colors[0], e.target.value] })} /></label>
                  </div>
                </Card>
                <Card title="Which Segunda FEB club do you take over?">
                  <p className="small muted">You inherit its city, arena, finances, roster and fanbase. Small markets are harder; bigger cities have higher ceilings.</p>
                  <ClubPicker w={preview} league="PLATA" value={clubId ?? founderDefault(preview)} onChange={setClubId} compact />
                </Card>
              </div>
            )}
            {mode === 'existing' && (
              <Card title="Choose your club" actions={<Pills value={league} onChange={(l) => { setLeague(l); setClubId(null); }} options={[{ id: 'ELITE', label: 'Liga ACB' }, { id: 'ORO', label: 'Primera FEB' }, { id: 'PLATA', label: 'Segunda FEB' }, { id: 'COLLEGE', label: 'US College (NCAA)' }]} />}>
                <ClubPicker w={preview} league={league} value={clubId} onChange={setClubId} />
              </Card>
            )}
            {mode === 'career' && (
              <Card title="Your first offers">
                <p>You start without a club. On day one you will receive two or three offers that match a {COUNTRY_OPTIONS.find((c) => c.code === nationality)?.label} {BACKGROUND_INFO[background].label.toLowerCase()} with no track record — {nationality === 'USA' || nationality === 'CAN' ? 'mostly struggling US college programs' : nationality === 'ESP' ? 'clubs in the Spanish third and second divisions' : 'mostly Spanish lower-division clubs'}. Accept one to begin, or decline and wait for others.</p>
                <p className="small muted">From then on the owner and the supporters grade you weekly against what your club is expected to achieve.</p>
              </Card>
            )}
            {mode === 'scenario' && (
              <Card title="Challenge scenarios">
                <div className="col">
                  {SCENARIOS.map((s) => (
                    <label key={s.id} className="row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="radio" checked={scenario === s.id} onChange={() => setScenario(s.id)} style={{ marginTop: 3 }} />
                      <div><b>{s.name}</b> <Badge>{s.tier}</Badge><div className="small muted">{s.description}</div></div>
                    </label>
                  ))}
                </div>
              </Card>
            )}
            <div className="row"><Button onClick={() => setStep(0)}>← Back</Button><span className="spacer" /><Button variant="primary" disabled={mode === 'existing' && clubId == null} onClick={() => setStep(2)}>Next →</Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="col">
            <Card title="Executive style — how much do you delegate?">
              <div className="grid g2">
                {STYLES.map((s) => (
                  <label key={s.id} className="card" style={{ cursor: 'pointer', borderColor: style === s.id ? 'var(--accent)' : undefined }}>
                    <div className="row"><input type="radio" checked={style === s.id} onChange={() => setStyle(s.id)} /><b>{s.label}</b></div>
                    <div className="small muted mt8">{s.desc}</div>
                  </label>
                ))}
              </div>
              <p className="small faint mt8">You can change every department individually later in Settings → Delegation.</p>
            </Card>
            <div className="grid g2">
              <Card title="Difficulty">
                <Pills value={difficulty} onChange={setDifficulty} options={[{ id: 'relaxed', label: 'Relaxed' }, { id: 'standard', label: 'Standard' }, { id: 'demanding', label: 'Demanding' }, { id: 'brutal', label: 'Brutal' }]} />
                <p className="small muted mt8">Difficulty sets your starting cash cushion, board and fan patience, how hard AI clubs chase upgrades, and a small on-court edge for your team (Relaxed +, Standard none, Demanding/Brutal −). Opponents never get hidden boosts.</p>
              </Card>
              <Card title="World noise">
                <Pills value={noise} onChange={setNoise} options={[{ id: 'quiet', label: 'Quiet' }, { id: 'normal', label: 'Normal' }, { id: 'handsOn', label: 'Hands-on' }]} />
                <p className="small muted mt8">How often midweek events, offers and media storylines ask for your attention.</p>
              </Card>
            </div>
            <div className="row"><Button onClick={() => setStep(1)}>← Back</Button><span className="spacer" /><Button variant="primary" size="lg" disabled={busy} onClick={start}>{busy ? 'Building world…' : 'Start career'}</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function founderDefault(w: World): number {
  return w.clubs.filter((c) => c.leagueId === 'PLATA').sort((a, b) => a.prestige - b.prestige)[3].id;
}

function ClubPicker({ w, league, value, onChange, compact }: { w: World; league: LeagueId; value: number | null; onChange: (id: number) => void; compact?: boolean }) {
  const clubs = w.clubs.filter((c) => c.leagueId === league);
  const rows = clubs.map((c) => ({ c, rev: estimateRevenue(w, c).total, str: clubStrength(w, c), pay: payroll(w, c) }));
  const rank = [...rows].sort((a, b) => b.str - a.str).map((r) => r.c.id);
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.c.id}
      initialSort="prestige"
      rowClass={(r) => (r.c.id === value ? 'me' : '')}
      columns={[
        { key: 'pick', label: '', render: (r) => <input type="radio" checked={r.c.id === value} onChange={() => onChange(r.c.id)} /> },
        { key: 'club', label: 'Club', render: (r) => <span className="row gap4"><Crest club={r.c} /> {r.c.name}</span>, sort: (r) => r.c.name },
        { key: 'city', label: 'City', render: (r) => `${r.c.city} (${Math.round(r.c.population / 1000)}k)`, sort: (r) => r.c.population },
        { key: 'prestige', label: 'Prestige', render: (r) => r.c.prestige, sort: (r) => r.c.prestige, align: 'r' },
        ...(compact ? [] : [
          { key: 'squad', label: 'Squad rank', render: (r: { c: Club }) => `#${rank.indexOf(r.c.id) + 1}`, sort: (r: { c: Club }) => -rank.indexOf(r.c.id), align: 'r' as const },
          { key: 'best', label: 'Best player', render: (r: { c: Club }) => <Rating v={Math.max(...roster(w, r.c.id).map((p) => p.ovr))} />, align: 'c' as const },
        ]),
        { key: 'rev', label: 'Revenue', render: (r) => fmtMoney(r.rev), sort: (r) => r.rev, align: 'r' },
        { key: 'cash', label: 'Cash', render: (r) => fmtMoney(r.c.finances.cash), sort: (r) => r.c.finances.cash, align: 'r' },
        { key: 'arena', label: 'Arena', render: (r) => capacity(r.c).toLocaleString('en'), sort: (r) => capacity(r.c), align: 'r' },
      ]}
    />
  );
}
