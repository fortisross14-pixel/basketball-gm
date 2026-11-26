import type { Competition, World } from '../../../engine/types';
import { seasonLabel } from '../../../engine/calendar';

export function seasonsAvailable(w: World): number[] {
  const s = new Set(w.competitions.map((c) => c.season));
  s.add(w.season);
  return [...s].sort((a, b) => b - a);
}

export function SeasonSelect({ w, value, onChange }: { w: World; value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {seasonsAvailable(w).map((s) => <option key={s} value={s}>{seasonLabel(s)}</option>)}
    </select>
  );
}

export function shortCompName(c: Competition): string {
  return c.name.replace(/ \d{4}-\d{2}$/, '');
}
