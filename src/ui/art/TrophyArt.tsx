// Trophy cells of emblems.png (25 league, 26 copa, 27 continental, 28 promotion, 29 MVP, 30 coach, 31 champions); emoji fallback.
import { useSheet, SheetCell } from './sheets';

export function trophyCell(name: string): number {
  if (/continental/i.test(name)) return 27;
  if (/copa|cup/i.test(name)) return 26;
  if (/promot/i.test(name)) return 28;
  if (/mvp/i.test(name)) return 29;
  if (/coach/i.test(name)) return 30;
  if (/regular season/i.test(name)) return 31;
  return 25;
}

export function TrophyArt({ name, size = 22 }: { name: string; size?: number }) {
  const sheet = useSheet('emblems');
  if (!sheet) return <span aria-hidden="true">🏆</span>;
  return <SheetCell sheet="emblems" data={sheet} index={trophyCell(name)} style={{ width: size, height: size, verticalAlign: 'middle' }} />;
}
