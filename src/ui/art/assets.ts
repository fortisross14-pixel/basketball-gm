// Optional art packs (public/art/...). Every slot has a procedural fallback:
// a file is used only once it has loaded successfully, so missing art never breaks a screen.
import { useEffect, useState } from 'react';

const status = new Map<string, 'ok' | 'missing' | Promise<boolean>>();

export function artUrl(path: string): string {
  return `${import.meta.env.BASE_URL}art/${path}`;
}

function probe(path: string): Promise<boolean> {
  const s = status.get(path);
  if (s === 'ok') return Promise.resolve(true);
  if (s === 'missing') return Promise.resolve(false);
  if (s) return s;
  const p = new Promise<boolean>((resolve) => {
    if (typeof Image === 'undefined') return resolve(false);
    const img = new Image();
    img.onload = () => { status.set(path, 'ok'); resolve(true); };
    img.onerror = () => { status.set(path, 'missing'); resolve(false); };
    img.src = artUrl(path);
  });
  status.set(path, p);
  return p;
}

/** URL of an art file if it exists (null while unknown or missing → render the fallback). */
export function useArt(path: string | null): string | null {
  const known = path ? status.get(path) : 'missing';
  const [ok, setOk] = useState(known === 'ok');
  useEffect(() => {
    let live = true;
    if (!path) { setOk(false); return; }
    probe(path).then((v) => { if (live) setOk(v); });
    return () => { live = false; };
  }, [path]);
  return path && ok ? artUrl(path) : null;
}

/** True when a whole pack is present (checked through one sentinel file). */
export function usePack(sentinel: string): boolean {
  return useArt(sentinel) != null;
}
