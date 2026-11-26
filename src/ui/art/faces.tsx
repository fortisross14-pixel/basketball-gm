import type { Player, Staff } from '../../engine/types';
import { playerLook, staffLook } from '../../engine/looks';
import { useWorld } from '../store';
import { Portrait } from './Portrait';

const NEUTRAL: [string, string] = ['#334155', '#94a3b8'];

function colorsOf(w: ReturnType<typeof useWorld>, teamId: number | null): [string, string] {
  const c = teamId != null ? w.clubs.find((x) => x.id === teamId) : undefined;
  return c ? [c.colors[0], c.colors[1]] : NEUTRAL;
}

export function PlayerFace({ player, size = 36, round }: { player: Player; size?: number; round?: boolean }) {
  const w = useWorld();
  return <Portrait look={playerLook(w, player)} colors={colorsOf(w, player.teamId)} size={size} round={round} title={`${player.firstName} ${player.lastName}`} />;
}

export function StaffFace({ staff, size = 36, round }: { staff: Staff; size?: number; round?: boolean }) {
  const w = useWorld();
  return <Portrait look={staffLook(w, staff)} colors={colorsOf(w, staff.teamId)} size={size} round={round} title={`${staff.firstName} ${staff.lastName}`} />;
}
