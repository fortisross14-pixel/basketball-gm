import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSaves, loadWorld, loadBackup, deleteSave, importWorld, type SaveMeta } from '../../engine/save';
import { useGame } from '../store';
import { Button, Card, Badge } from '../components/ui';
import { BrandMark } from '../art/icons';
import { InstallButton } from '../components/install';
import { StorageStatus } from '../components/storage';
import { motion } from 'framer-motion';

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
    try {
      const res = await loadWorld(id);
      if (!res) return notify('Save not found.', 'bad');
      setWorld(res.world);
      if (res.warning) notify(res.warning, 'warn');
      nav('/today');
    } catch (e) {
      notify(`Could not load: ${(e as Error).message}`, 'bad');
    }
  };

  const restore = async (s: SaveMeta) => {
    if (!confirm(`Restore the previous autosave of "${s.name}"? Progress since then is lost.`)) return;
    try {
      const w = await loadBackup(s.id);
      if (!w) return notify('No backup exists for this career yet.', 'warn');
      setWorld(w);
      notify('Backup restored.', 'good');
      nav('/today');
    } catch (e) {
      notify(`Could not restore: ${(e as Error).message}`, 'bad');
    }
  };

  const importFile = async (f: File) => {
    try {
      const w = await importWorld(await f.text());
      setWorld(w);
      notify('Save imported into its own slot.', 'good');
      nav('/today');
    } catch (e) {
      notify(`Could not import: ${(e as Error).message}`, 'bad');
    }
  };

  return (
    <div className="title-screen">
      <div style={{ width: 'min(960px, 94vw)', position: 'relative' }}>
        <div className="row" style={{ gap: 26, marginBottom: 28, alignItems: 'center' }}>
          <motion.div initial={{ scale: 0.3, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
            <BrandMark size={150} />
          </motion.div>
          <div>
            <motion.div className="title-word" initial={{ x: -60, opacity: 0, skewX: -12 }} animate={{ x: 0, opacity: 1, skewX: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>Basketball</motion.div>
            <motion.div className="title-word accent" initial={{ x: 60, opacity: 0, skewX: -12 }} animate={{ x: 0, opacity: 1, skewX: 0 }} transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>Dynasty</motion.div>
            <motion.div className="muted mt8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>From a lower-division club or a struggling college program to a basketball powerhouse.</motion.div>
          </div>
        </div>
        <div className="grid g2">
          <Card title="Start">
            <div className="col">
              <Button variant="primary" size="lg" onClick={() => nav('/new')}>New career</Button>
              <InstallButton />
              <Button onClick={() => fileRef.current?.click()}>Import save file…</Button>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <p className="small muted mt8">
                PC Fútbol-style club building for basketball: finances, arena, tickets, sponsors, staff and roster drive your climb. Games resolve as instant results; your influence is who you sign, who coaches and the tactics you set.
              </p>
            </div>
          </Card>
          <Card title="Saved careers" actions={<StorageStatus />}>
            {loading ? <div className="muted">Loading…</div> : saves.length === 0 ? <div className="muted">No saved careers yet.</div> : (
              <div className="list">
                {saves.map((s) => (
                  <div key={s.id} className="list-item row">
                    <div style={{ flex: 1 }}>
                      <b>{s.name}</b> {s.auto && <Badge>autosave</Badge>}
                      <div className="small muted">{s.clubName} · {s.season} · {s.date}</div>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => load(s.id)}>Load</Button>
                    <Button size="sm" onClick={() => restore(s)} title="Load the previous autosave">Restore backup</Button>
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
