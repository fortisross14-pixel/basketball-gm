import { useState } from 'react';
import { useAct, useNotify, useWorld } from '../../store';
import { Badge, Button, Callout, Card, ClubLink, Money, NumberField, Page, PlayerLink, Table, Tabs, type Column } from '../../components/ui';
import { OvrCell, PotCell, teamName } from '../../helpers';
import { absDay, type Player, type Position, type Region } from '../../../engine/types';
import { age, club as getClub, freeAgents, userClub } from '../../../engine/world';
import { salaryAsk } from '../../../engine/player';
import { canSignNow } from '../../../engine/market';
import { transferWindowOpen, buildCalendar, fmtAbs, fmtDate } from '../../../engine/calendar';
import { addScoutAssignment } from '../../../engine/squad';
import { knowledge } from '../../../engine/squad';
import ContractModal from '../club/ContractModal';
import BidModal from './BidModal';

type Tab = 'fa' | 'all' | 'short' | 'scout' | 'history';
const POS: (Position | 'any')[] = ['any', 'PG', 'SG', 'SF', 'PF', 'C'];

export default function Market() {
  const w = useWorld();
  const uc = userClub(w);
  const [tab, setTab] = useState<Tab>('fa');
  const [neg, setNeg] = useState<Player | null>(null);
  const [bid, setBid] = useState<Player | null>(null);
  const open = transferWindowOpen(w.season, w.day);
  const faOk = canSignNow(w, false);
  const cal = buildCalendar(w.season);
  return (
    <Page title="Transfers & Scouting" subtitle={uc ? `Transfer budget €${Math.round(uc.finances.budget.transfer / 1000)}k · cash €${Math.round(uc.finances.cash / 1000)}k` : 'Read-only: you have no club'}>
      <div className="row wrap mb8" style={{ marginBottom: 12 }}>
        <Badge tone={open ? 'good' : 'bad'}>Transfer window {open ? 'OPEN' : 'CLOSED'}</Badge>
        <span className="small muted">Summer window until {fmtDate(w.season, cal.summerWindowClose)} · winter window {fmtDate(w.season, cal.winterWindowOpen)}–{fmtDate(w.season, cal.winterWindowClose)}</span>
        <Badge tone={faOk.ok ? 'good' : 'warn'} title={faOk.reason}>Free-agent signings {faOk.ok ? 'allowed' : 'closed'}</Badge>
        {!faOk.ok && <span className="small warn">{faOk.reason}</span>}
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'fa', label: 'Free agents' }, { id: 'all', label: 'All players' }, { id: 'short', label: `Shortlist (${w.user.shortlist.length})` }, { id: 'scout', label: 'Scouting' }, { id: 'history', label: 'Transfer history' }]} />
      {tab === 'fa' && <PlayerSearch pool="fa" onNegotiate={setNeg} onBid={setBid} />}
      {tab === 'all' && <PlayerSearch pool="all" onNegotiate={setNeg} onBid={setBid} />}
      {tab === 'short' && <Shortlist onNegotiate={setNeg} onBid={setBid} />}
      {tab === 'scout' && <Scouting />}
      {tab === 'history' && <History />}
      {neg && <ContractModal player={neg} mode="sign" onClose={() => setNeg(null)} />}
      {bid && <BidModal player={bid} onClose={() => setBid(null)} />}
    </Page>
  );
}

function usePlayerColumns(onNegotiate: (p: Player) => void, onBid: (p: Player) => void): Column<Player>[] {
  const w = useWorld();
  const act = useAct();
  const uc = userClub(w);
  const short = new Set(w.user.shortlist.map((s) => s.playerId));
  return [
    { key: 'n', label: 'Name', render: (p) => <PlayerLink player={p} face />, sort: (p) => p.lastName },
    { key: 'pos', label: 'Pos', render: (p) => p.pos },
    { key: 'age', label: 'Age', render: (p) => age(w, p), sort: (p) => age(w, p), align: 'r' },
    { key: 'reg', label: 'Reg.', render: (p) => <span className="row gap4">{p.region === 'NONEU' ? <Badge tone="warn">Non-EU</Badge> : <Badge>{p.region}</Badge>}{p.homegrown && <Badge tone="good">HG</Badge>}</span> },
    { key: 'club', label: 'Club', render: (p) => (p.teamId == null ? <span className="muted">Free agent</span> : <ClubLink club={getClub(w, p.teamId)} />), sort: (p) => teamName(w, p.teamId) },
    { key: 'ovr', label: 'OVR', render: (p) => <OvrCell p={p} />, sort: (p) => p.ovr, align: 'c' },
    { key: 'pot', label: 'POT', render: (p) => <PotCell p={p} />, sort: (p) => p.pot, align: 'c' },
    { key: 'k', label: 'Scouted', render: (p) => `${Math.round(knowledge(w, p))}%`, sort: (p) => knowledge(w, p), align: 'r', title: 'Scouting knowledge: higher = narrower rating ranges' },
    { key: 'ask', label: 'Asks', render: (p) => <Money v={salaryAsk(w, p, uc ?? undefined)} />, sort: (p) => salaryAsk(w, p), align: 'r', title: 'Asking salary per year' },
    { key: 'val', label: 'Value', render: (p) => (p.teamId == null ? '—' : <Money v={p.value} />), sort: (p) => p.value, align: 'r' },
    { key: 'ct', label: 'Contract', render: (p) => (p.contract ? `${Math.round(p.contract.salary / 1000)}k → ${p.contract.expires + 1}` : '—'), sort: (p) => p.contract?.expires ?? 0 },
    { key: 'bo', label: 'Clause', render: (p) => (p.contract?.buyout != null ? <Money v={p.contract.buyout} /> : '—'), sort: (p) => p.contract?.buyout ?? 0, align: 'r', title: 'Release clause: a bid at or above it cannot be refused' },
    {
      key: 'act', label: '', render: (p) => (
        <span className="row gap4">
          <Button size="sm" variant="ghost" title={short.has(p.id) ? 'Remove from shortlist' : 'Add to shortlist (scouts follow him weekly)'} onClick={() => act((ww) => {
            if (short.has(p.id)) ww.user.shortlist = ww.user.shortlist.filter((s) => s.playerId !== p.id);
            else ww.user.shortlist.push({ playerId: p.id, note: '', addedDay: absDay(ww) });
          })}>{short.has(p.id) ? '★' : '☆'}</Button>
          {uc && p.teamId == null && <Button size="sm" onClick={() => onNegotiate(p)}>Negotiate</Button>}
          {uc && p.teamId != null && p.teamId !== uc.id && !p.loan && <Button size="sm" onClick={() => onBid(p)}>Bid</Button>}
        </span>
      ),
    },
  ];
}

function PlayerSearch({ pool, onNegotiate, onBid }: { pool: 'fa' | 'all'; onNegotiate: (p: Player) => void; onBid: (p: Player) => void }) {
  const w = useWorld();
  const uc = userClub(w);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<Position | 'any'>('any');
  const [maxAge, setMaxAge] = useState(40);
  const [maxAsk, setMaxAsk] = useState(0);
  const [region, setRegion] = useState<Region | 'any'>('any');
  const [league, setLeague] = useState<string>('any');
  const cols = usePlayerColumns(onNegotiate, onBid);
  const rows = (() => {
    const base = pool === 'fa' ? freeAgents(w) : w.players.filter((p) => !p.retired && !p.academy && p.teamId !== uc?.id);
    const s = q.trim().toLowerCase();
    return base.filter((p) => {
      if (s && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(s)) return false;
      if (pos !== 'any' && p.pos !== pos) return false;
      if (age(w, p) > maxAge) return false;
      if (region !== 'any' && p.region !== region) return false;
      if (maxAsk > 0 && salaryAsk(w, p, uc ?? undefined) > maxAsk * 1000) return false;
      if (league !== 'any') {
        const cl = p.teamId != null ? getClub(w, p.teamId) : null;
        if (league === 'FA' ? cl != null : league === 'FOREIGN' ? !cl?.foreign : cl?.leagueId !== league) return false;
      }
      return true;
    });
  })();
  return (
    <Card className="flush">
      <div className="row wrap" style={{ padding: '12px 16px' }}>
        <input placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={pos} onChange={(e) => setPos(e.target.value as Position | 'any')}>{POS.map((x) => <option key={x} value={x}>{x === 'any' ? 'Any position' : x}</option>)}</select>
        <label className="row small muted" style={{ minWidth: 260 }}>Max age <NumberField label="Max age" value={maxAge} min={16} max={40} onChange={setMaxAge} width={50} /></label>
        <label className="row small muted" style={{ minWidth: 300 }} title="0 = no limit">Max ask €k <NumberField label="Max asking salary (thousands, 0 = no limit)" value={maxAsk} min={0} max={3000} step={5} onChange={setMaxAsk} width={60} /></label>
        <select value={region} onChange={(e) => setRegion(e.target.value as Region | 'any')}><option value="any">Any origin</option><option value="ESP">Spanish</option><option value="EU">EU</option><option value="NONEU">Non-EU</option></select>
        {pool === 'all' && (
          <select value={league} onChange={(e) => setLeague(e.target.value)}>
            <option value="any">All leagues</option>
            <option value="ELITE">{w.rules.leagues.ELITE.name}</option>
            <option value="ORO">{w.rules.leagues.ORO.name}</option>
            <option value="PLATA">{w.rules.leagues.PLATA.name}</option>
            <option value="FOREIGN">Continental clubs</option>
            <option value="FA">Free agents</option>
          </select>
        )}
        <span className="spacer" />
        <span className="small muted">{rows.length} players</span>
      </div>
      <Table rows={rows} rowKey={(p) => p.id} columns={cols} initialSort="ovr" limit={150} empty="No players match these filters." />
    </Card>
  );
}

function Shortlist({ onNegotiate, onBid }: { onNegotiate: (p: Player) => void; onBid: (p: Player) => void }) {
  const w = useWorld();
  const cols = usePlayerColumns(onNegotiate, onBid);
  const rows = w.user.shortlist.map((s) => w.players.find((p) => p.id === s.playerId)).filter((p): p is Player => !!p && !p.retired);
  return (
    <Card className="flush">
      <div className="small muted" style={{ padding: '12px 16px 0' }}>Scouts follow shortlisted players every week, narrowing their rating ranges.</div>
      <Table rows={rows} rowKey={(p) => p.id} columns={cols} initialSort="ovr" empty="Your shortlist is empty. Use ☆ to add players." />
    </Card>
  );
}

function Scouting() {
  const w = useWorld();
  const act = useAct();
  const notify = useNotify();
  const uc = userClub(w);
  const [region, setRegion] = useState<'ESP' | 'EU' | 'NONEU' | 'YOUTH'>('EU');
  const [pos, setPos] = useState<Position | 'any'>('any');
  const [maxAge, setMaxAge] = useState(28);
  const scout = uc ? w.staff.find((s) => s.id === uc.staff.scoutDirector) : null;
  return (
    <div className="grid g2">
      <Card title="New assignment">
        {!uc ? <div className="muted">You need a club to send scouts.</div> : (
          <div className="col">
            <div className="small muted">Scouting director: {scout ? `${scout.firstName} ${scout.lastName} (rating ${scout.rating})` : <span className="bad">vacant — reports will be poor</span>}. An assignment lasts 4 weeks, scans a market and adds the best three finds to your shortlist.</div>
            <div className="row wrap">
              <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)}>
                <option value="ESP">Domestic (Spain)</option>
                <option value="EU">European market</option>
                <option value="NONEU">Non-EU market</option>
                <option value="YOUTH">Young talent (≤21)</option>
              </select>
              <select value={pos} onChange={(e) => setPos(e.target.value as Position | 'any')}>{POS.map((x) => <option key={x} value={x}>{x === 'any' ? 'Any position' : x}</option>)}</select>
              <label className="row small muted" style={{ minWidth: 260 }}>Max age <NumberField label="Max age" value={maxAge} min={16} max={40} onChange={setMaxAge} width={50} /></label>
              <Button variant="primary" disabled={w.user.scoutAssignments.length >= 3} onClick={() => {
                act((ww) => addScoutAssignment(ww, { region, focusPos: pos, maxAge }));
                notify('Scouts dispatched. Weekly travel costs apply.', 'good');
              }}>Send scouts</Button>
            </div>
            {w.user.scoutAssignments.length >= 3 && <div className="small warn">Maximum of three simultaneous assignments.</div>}
          </div>
        )}
      </Card>
      <Card title="Active assignments">
        {w.user.scoutAssignments.length === 0 ? <div className="muted small">None.</div> : (
          <div className="col">
            {w.user.scoutAssignments.map((a) => (
              <div key={a.id} className="list-item row">
                <b>{a.region === 'YOUTH' ? 'Young talent' : a.region}</b>
                <span className="small muted">{a.focusPos === 'any' ? 'any position' : a.focusPos} · max age {a.maxAge}</span>
                <span className="spacer" />
                <Badge>{a.weeksLeft} wk left</Badge>
                <Button size="sm" variant="ghost" onClick={() => act((ww) => { ww.user.scoutAssignments = ww.user.scoutAssignments.filter((x) => x.id !== a.id); })}>Cancel</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="span2"><Callout>Ratings of players you have not scouted are shown as ranges. Players in your own league are partially known; foreign players are mostly unknown. Better scouts give tighter, more accurate ranges — weaker scouts can misjudge prospects.</Callout></div>
    </div>
  );
}

function History() {
  const w = useWorld();
  const uc = userClub(w);
  const [mine, setMine] = useState(false);
  const rows = w.transfers.filter((t) => !mine || (uc && (t.fromId === uc.id || t.toId === uc.id)));
  const name = (id: number | null) => (id == null ? '—' : getClub(w, id).abbrev);
  return (
    <Card className="flush" title={<label className="row small"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only my club</label>}>
      <Table
        rows={rows}
        rowKey={(t) => t.id}
        limit={200}
        columns={[
          { key: 'd', label: 'Date', render: (t) => fmtAbs(t.day), sort: (t) => t.day },
          { key: 'p', label: 'Player', render: (t) => { const p = w.players.find((x) => x.id === t.playerId); return p ? <PlayerLink player={p} face /> : t.playerName; } },
          { key: 'k', label: 'Type', render: (t) => <Badge tone={t.kind === 'transfer' ? 'info' : t.kind === 'release' ? 'bad' : undefined}>{t.kind}</Badge> },
          { key: 'f', label: 'From', render: (t) => name(t.fromId) },
          { key: 't', label: 'To', render: (t) => name(t.toId) },
          { key: 'fee', label: 'Fee', render: (t) => (t.fee ? <Money v={t.fee} /> : '—'), sort: (t) => t.fee, align: 'r' },
          { key: 's', label: 'Salary', render: (t) => (t.salary ? <Money v={t.salary} /> : '—'), sort: (t) => t.salary, align: 'r' },
        ]}
      />
    </Card>
  );
}
