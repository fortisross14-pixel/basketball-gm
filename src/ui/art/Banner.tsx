// Section header art from banners.png (2 × 4 cells of 1024 × 256). Renders nothing until the
// sheet exists, so callers keep their current look.
import { useSheetCellUrl } from './sheets';

export type BannerKey = 'today' | 'calendar' | 'club' | 'team' | 'infrastructure' | 'results' | 'legacy' | 'menu';
const INDEX: Record<BannerKey, number> = { today: 0, calendar: 1, club: 2, team: 3, infrastructure: 4, results: 5, legacy: 6, menu: 7 };

export function Banner({ which, className, height }: { which: BannerKey; className?: string; height?: number }) {
  const url = useSheetCellUrl('banners', INDEX[which]);
  if (!url) return null;
  return <div className={`section-banner ${className ?? ''}`} style={height ? { height } : undefined} aria-hidden="true"><img src={url} alt="" /></div>;
}
