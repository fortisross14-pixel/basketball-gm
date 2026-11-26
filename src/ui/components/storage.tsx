import { useEffect, useState } from 'react';

/** Shows where saves live (IndexedDB), whether the browser keeps them persistently, and space used. */
export function StorageStatus() {
  const [info, setInfo] = useState<{ idb: boolean; persisted: boolean | null; usage: number | null; quota: number | null }>({ idb: typeof indexedDB !== 'undefined', persisted: null, usage: null, quota: null });
  const refresh = async () => {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    setInfo({ idb: typeof indexedDB !== 'undefined', persisted, usage: est?.usage ?? null, quota: est?.quota ?? null });
  };
  useEffect(() => { refresh(); }, []);
  const mb = (v: number | null) => (v == null ? '?' : `${(v / 1048576).toFixed(1)} MB`);
  return (
    <div className="small muted row wrap gap4">
      <span className={`badge ${info.idb ? 'good' : 'bad'}`}>{info.idb ? 'Saved in IndexedDB on this device' : 'IndexedDB unavailable'}</span>
      {info.persisted != null && <span className={`badge ${info.persisted ? 'good' : 'warn'}`}>{info.persisted ? 'Persistent storage' : 'Best-effort storage'}</span>}
      {info.usage != null && <span>{mb(info.usage)} used of {mb(info.quota)}</span>}
      {info.persisted === false && (
        <button type="button" className="btn sm" onClick={async () => { await navigator.storage?.persist?.(); refresh(); }} title="Ask the browser not to clear your saves when space runs low">Keep my saves</button>
      )}
    </div>
  );
}
