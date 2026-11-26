import { useNavigate } from 'react-router-dom';
import { motion, type MotionStyle } from 'framer-motion';
import type { Club, Player } from '../../engine/types';
import { BodyFigure } from './BodyFigure';
import { bodyOf, FRAME_LABEL } from '../../engine/extras';
import { useWorld } from '../store';
import { ClubLogo } from './crest';

export function cardTier(ovr: number): 'bronze' | 'silver' | 'gold' | 'amethyst' | 'diamond' {
  if (ovr >= 78) return 'diamond';
  if (ovr >= 70) return 'amethyst';
  if (ovr >= 60) return 'gold';
  if (ovr >= 50) return 'silver';
  return 'bronze';
}

/** Letter grade for a 0-99 rating (2K-style attribute grades). */
export function grade(v: number): string {
  const g: [number, string][] = [[90, 'A+'], [84, 'A'], [78, 'A-'], [72, 'B+'], [66, 'B'], [60, 'B-'], [54, 'C+'], [48, 'C'], [42, 'C-'], [36, 'D+'], [30, 'D']];
  for (const [t, l] of g) if (v >= t) return l;
  return 'F';
}

export function PlayerCard({ p, club, ovrLabel, sub, index = 0 }: { p: Player; club: Club | null; ovrLabel?: string; sub?: string; index?: number }) {
  const nav = useNavigate();
  const w = useWorld();
  const body = bodyOf(w, p);
  const tier = cardTier(p.ovr);
  return (
    <motion.button
      type="button"
      className={`pcard t-${tier} ${p.injury ? 'injured' : ''}`}
      style={{ border: 'none', ['--club-c' as string]: club?.colors[0] ?? '#1e3a8a' } as unknown as MotionStyle}
      onClick={() => nav(`/player/${p.id}`)}
      initial={{ opacity: 0, y: 18, rotateY: -25 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: Math.min(index, 14) * 0.035, type: 'spring', stiffness: 260, damping: 22 }}
      whileTap={{ scale: 0.96 }}
      aria-label={`${p.firstName} ${p.lastName}, ${p.pos}, rated ${ovrLabel ?? p.ovr}`}
    >
      <div className="pc-inner">
        <span className="pc-ovr">{ovrLabel ?? p.ovr}</span>
        <span className="pc-pos">{p.pos}</span>
        {club && <span className="pc-logo"><ClubLogo club={club} size={28} /></span>}
        <div className="pc-art" title={`${(body.heightCm / 100).toFixed(2)} m · ${body.weightKg} kg · ${FRAME_LABEL[body.frame]}`}><BodyFigure body={body} jersey={p.jersey} kit={club?.colors[0] ?? '#1e3a8a'} trim={club?.colors[1] ?? '#ffffff'} /></div>
        <span className="pc-body">{(body.heightCm / 100).toFixed(2)}m · {FRAME_LABEL[body.frame]}</span>
        <div className="pc-name">
          {p.firstName[0]}. {p.lastName}
          {sub && <small>{sub}</small>}
        </div>
      </div>
    </motion.button>
  );
}
