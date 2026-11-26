import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSaves, loadWorld, deleteSave, deserialize, type SaveMeta } from '../../engine/save';
import { useGame } from '../store';
import { Button, Card, Badge } from '../components/ui';

export default function MainMenu() {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const setWorld = useGame((s) => s.setWorld);
  const notify = useGame((s) => s.notify);
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listSaves().then((s) => { setSaves(s); setLoading(false); });
  useEffect(() => { refresh(); }, []);

  const load = async (id: string) => {
    const w = await loadWorld(id);
    if (!w) return notify('Save not found.', 'bad');
    setWorld(w);
    nav('/today');
  };

  const importFile = async (f: File) => {
    try {
      const w = deserialize(await f.text());
      setWorld(w);
      nav('/today');
    } catch (e) {
      notify(`Could not import: ${(e as Error).message}`, 'bad');
    }
  };

  return (
    <div className="menu-hero court-bg">
      <div style={{ width: 'min(880px, 94vw)' }}>
        <div className="row" style={{ marginBottom: 24 }}>
          <div className="logo" style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, var(--accent), #c2410c)', display: 'grid', placeItems: 'center', fontSize: 34 }}>🏀</div>
          <div>
            <h1 style={{ fontSize: 34 }}>Basketball Dynasty</h1>
            <div className="muted">Build a club from the lower divisions into a European powerhouse.</div>
          </div>
        </div>
        <div className="grid g2">
          <Card title="Start">
            <div className="col">
              <Button variant="primary" size="lg" onClick={() => nav('/new')}>New career</Button>
              <Button onClick={() => fileRef.current?.click()}>Import save file…</Button>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <p className="small muted mt8">
                PC Fútbol-style club building for basketball: finances, arena, tickets, sponsors, staff and roster drive your climb. Games resolve as instant results; your influence is who you sign, who coaches and the tactics you set.
              </p>
            </div>
          </Card>
          <Card title="Saved careers">
            {loading ? <div className="muted">Loading…</div> : saves.length === 0 ? <div className="muted">No saved careers yet.</div> : (
              <div className="list">
                {saves.map((s) => (
                  <div key={s.id} className="list-item row">
                    <div style={{ flex: 1 }}>
                      <b>{s.name}</b> {s.auto && <Badge>autosave</Badge>}
                      <div className="small muted">{s.clubName} · {s.season} · {s.date}</div>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => load(s.id)}>Load</Button>
                    <Button size="sm" variant="danger" onClick={async () => { if (confirm(`Delete "${s.name}"?`)) { await deleteSave(s.id); refresh(); } }}>✕</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
