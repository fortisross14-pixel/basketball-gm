import { useRef, useState } from 'react';
import type { Club } from '../../engine/types';
import { CLUB_SEEDS } from '../../engine/data/clubs';
import { useGame, useNotify } from '../store';
import { applyClubEdit, clubEditOf, imageFileToDataUrl, mergeIntoStoredPack, sanitizeLogoUrl, seedOf, type ClubEdit } from '../clubPack';
import { Button, Crest, Modal } from './ui';

/** Apply an edit to a club in the loaded world, autosave, and remember it in the global pack. */
export async function commitClubEdit(clubId: number, e: ClubEdit) {
  const { act, save } = useGame.getState();
  const c = act((w) => {
    const club = w.clubs.find((x) => x.id === clubId)!;
    applyClubEdit(w, club, e);
    return club;
  });
  await save(true);
  await mergeIntoStoredPack({ [seedOf(c)]: clubEditOf(c) });
}

export function ClubEditorModal({ club, onClose }: { club: Club; onClose: () => void }) {
  const notify = useNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  const [d, setD] = useState({ name: club.name, nickname: club.nickname, abbrev: club.abbrev, colors: [club.colors[0], club.colors[1]] as [string, string], arena: club.arena.name, logoUrl: club.logoUrl ?? '' });
  const [urlText, setUrlText] = useState(club.logoUrl && !club.logoUrl.startsWith('data:') ? club.logoUrl : '');
  const [busy, setBusy] = useState(false);
  const seed = CLUB_SEEDS.find((s) => s.name === seedOf(club));
  const valid = d.name.trim().length > 0 && d.abbrev.trim().length === 3;

  const upload = async (f: File) => {
    try {
      const url = await imageFileToDataUrl(f);
      setD((x) => ({ ...x, logoUrl: url }));
      setUrlText('');
    } catch (err) { notify((err as Error).message, 'bad'); }
  };
  const applyUrl = () => {
    const u = sanitizeLogoUrl(urlText);
    if (!u) { notify('Paste an http(s) image address.', 'bad'); return; }
    setD((x) => ({ ...x, logoUrl: u }));
  };
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    await commitClubEdit(club.id, { name: d.name.trim(), nickname: d.nickname.trim(), abbrev: d.abbrev.trim().toUpperCase(), colors: d.colors, arena: d.arena.trim() || club.arena.name, logoUrl: d.logoUrl });
    notify(`${d.name.trim()} updated.`, 'good');
    onClose();
  };
  const resetAll = () => {
    if (!seed) return;
    setD({ name: seed.name, nickname: seed.nickname, abbrev: seed.abbrev, colors: [seed.colors[0], seed.colors[1]], arena: seed.arena, logoUrl: '' });
    setUrlText('');
  };

  const preview = { ...club, name: d.name || club.name, nickname: d.nickname, abbrev: d.abbrev || club.abbrev, colors: d.colors, logoUrl: d.logoUrl || undefined };
  return (
    <Modal title="Club editor" onClose={onClose} wide>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div className="col" style={{ alignItems: 'center', minWidth: 150 }}>
          <Crest club={preview} size="xl" />
          <div className="row gap4"><Crest club={preview} size="lg" /><Crest club={preview} /></div>
          <div className="small muted" style={{ textAlign: 'center' }}>{d.logoUrl ? (d.logoUrl.startsWith('data:') ? `Uploaded logo · ${Math.round(d.logoUrl.length / 1024 * 0.75)} KB` : 'Logo from URL') : 'Generated emblem'}</div>
        </div>
        <div className="col" style={{ flex: 1, minWidth: 280 }}>
          <div className="grid g2">
            <label className="field">Club name<input value={d.name} maxLength={60} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
            <label className="field">Nickname<input value={d.nickname} maxLength={60} onChange={(e) => setD({ ...d, nickname: e.target.value })} /></label>
            <label className="field">Abbreviation (3)<input value={d.abbrev} maxLength={3} onChange={(e) => setD({ ...d, abbrev: e.target.value.toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑÇ]/g, '') })} /></label>
            <label className="field">Arena name<input value={d.arena} maxLength={80} onChange={(e) => setD({ ...d, arena: e.target.value })} /></label>
            <label className="field">Primary colour<input type="color" value={d.colors[0]} onChange={(e) => setD({ ...d, colors: [e.target.value, d.colors[1]] })} /></label>
            <label className="field">Secondary colour<input type="color" value={d.colors[1]} onChange={(e) => setD({ ...d, colors: [d.colors[0], e.target.value] })} /></label>
          </div>
          <label className="field">Logo</label>
          <div className="row wrap">
            <Button onClick={() => fileRef.current?.click()}>Upload image…</Button>
            <input ref={fileRef} type="file" accept="image/*" aria-label="Upload logo image" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
            <input placeholder="…or paste an image URL" aria-label="Logo image URL" value={urlText} onChange={(e) => setUrlText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyUrl(); }} style={{ flex: 1, minWidth: 180 }} />
            <Button onClick={applyUrl} disabled={!urlText.trim()}>Use URL</Button>
            <Button variant="ghost" disabled={!d.logoUrl} onClick={() => { setD({ ...d, logoUrl: '' }); setUrlText(''); }}>Reset to generated emblem</Button>
          </div>
          <p className="small faint">Uploads are downscaled to 160 px and stored inside the save. Linked URLs need an internet connection to display. Edits are for your personal game only.</p>
          {seed && <p className="small muted">Original identity: {seed.name} (“{seed.nickname}”, {seed.abbrev}) · {seed.arena}</p>}
          <div className="row">
            {seed && <Button variant="ghost" onClick={resetAll}>Restore original identity</Button>}
            <span className="spacer" />
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!valid || busy} onClick={() => void submit()}>Save changes</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
