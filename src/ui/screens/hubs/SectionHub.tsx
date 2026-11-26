import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon, type IconName } from '../../art/icons';
import './hubs.css';

export interface HubMetric {
  label: string;
  value: ReactNode;
  tone?: 'good' | 'bad' | 'warn';
}

export interface HubTileData {
  to: string;
  label: string;
  icon: IconName;
  blurb: string;
  metrics?: HubMetric[];
  alert?: { text: string; tone: 'bad' | 'warn' | 'good' | 'info' } | null;
  /** Optional mini visual rendered at the bottom of the tile. */
  extra?: ReactNode;
  wide?: boolean;
}

export function SectionHub({ kicker, title, icon, tagline, stats, tiles, children, aside }: { kicker: string; title: string; icon: IconName; tagline: string; stats: HubMetric[]; tiles: HubTileData[]; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="hub">
      <motion.section className="hub-hero" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
        <div className="hub-hero-art" aria-hidden="true"><Icon name={icon} size={220} /></div>
        <div className="hub-hero-copy">
          <div className="kicker">{kicker}</div>
          <motion.h1 initial={{ opacity: 0, x: -24, skewX: -8 }} animate={{ opacity: 1, x: 0, skewX: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>{title}</motion.h1>
          <p className="muted">{tagline}</p>
        </div>
        <div className="hub-stats">
          {stats.map((s, i) => (
            <motion.div key={s.label} className="hub-stat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
              <span>{s.label}</span>
              <b className={s.tone ?? ''}>{s.value}</b>
            </motion.div>
          ))}
        </div>
        {aside && <div className="hub-aside">{aside}</div>}
      </motion.section>
      {children}
      <div className="hub-grid">
        {tiles.map((t, i) => <HubTile key={t.to} t={t} i={i} />)}
      </div>
    </div>
  );
}

function HubTile({ t, i }: { t: HubTileData; i: number }) {
  return (
    <motion.div
      className={`hub-tile-wrap ${t.wide ? 'wide' : ''}`}
      initial={{ opacity: 0, y: 26, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.12 + i * 0.055, type: 'spring', stiffness: 260, damping: 24 }}
    >
      <Link to={t.to} className={`hub-tile ${t.alert?.tone === 'bad' ? 'alerting' : ''}`}>
        <div className="hub-tile-bg" aria-hidden="true"><Icon name={t.icon} size={150} /></div>
        <div className="hub-tile-top">
          <span className="hub-tile-icon"><Icon name={t.icon} size={30} /></span>
          {t.alert && <span className={`badge ${t.alert.tone}`}>{t.alert.tone === 'bad' ? '! ' : t.alert.tone === 'warn' ? '▲ ' : t.alert.tone === 'good' ? '✓ ' : ''}{t.alert.text}</span>}
        </div>
        <div className="hub-tile-title">{t.label}</div>
        <div className="hub-tile-blurb">{t.blurb}</div>
        {t.metrics && t.metrics.length > 0 && (
          <div className="hub-tile-metrics">
            {t.metrics.map((m) => (
              <div key={m.label}><span>{m.label}</span><b className={m.tone ?? ''}>{m.value}</b></div>
            ))}
          </div>
        )}
        {t.extra}
        <div className="hub-tile-go">Open <Icon name="chevronRight" size={16} /></div>
      </Link>
    </motion.div>
  );
}
