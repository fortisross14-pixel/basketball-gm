import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createContext, useContext } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';
import { ClubLogo } from '../art/crest';
import { Link } from 'react-router-dom';
import type { Club, Player } from '../../engine/types';
import { fmtMoney } from '../../engine/world';

// ---------------------------------------------------------------- layout
export function Page({ title, subtitle, actions, children, kicker, tone }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; kicker?: ReactNode; tone?: 'quiet' }) {
  return (
    <div className={tone === 'quiet' ? 'page-quiet' : undefined}>
      <div className="page-head">
        <div>
          {kicker && <div className="kicker">{kicker}</div>}
          <motion.h1 initial={{ opacity: 0, x: -24, skewX: -8 }} animate={{ opacity: 1, x: 0, skewX: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>{title}</motion.h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
        <div className="spacer" />
        {actions && <div className="row">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className = '', style }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          <div className="spacer" />
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone, title }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn'; title?: string }) {
  return (
    <div className="stat" title={title}>
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone, title }: { children: ReactNode; tone?: 'good' | 'bad' | 'warn' | 'info' | 'accent'; title?: string }) {
  return <span className={`badge ${tone ?? ''}`} title={title}>{children}</span>;
}

export function Button({ children, onClick, variant, size, disabled, title, type }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'good' | 'ghost'; size?: 'sm' | 'lg'; disabled?: boolean; title?: string; type?: 'button' | 'submit' }) {
  return (
    <button type={type ?? 'button'} className={`btn ${variant ?? ''} ${size ?? ''}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const group = useId();
  return (
    <div className="tabs" role="tablist" onKeyDown={(e) => {
      const i = tabs.findIndex((t) => t.id === value);
      if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id);
      if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
    }}>
      {tabs.map((t) => (
        <button type="button" role="tab" aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} key={t.id} className={`tab ${t.id === value ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.id === value && <motion.span layoutId={`tabline-${group}`} className="tab-line" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
        </button>
      ))}
    </div>
  );
}

export function Pills<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pill-group">
      {options.map((o) => (
        <button type="button" key={o.id} className={o.id === value ? 'on' : ''} aria-pressed={o.id === value} onClick={() => onChange(o.id)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Lets content inside a Modal close it with the exit animation. */
export const ModalCloseContext = createContext<() => void>(() => undefined);
export function useModalClose() {
  return useContext(ModalCloseContext);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible animated dialog (portal): focuses its primary control, traps Tab, Esc/backdrop close with an exit animation, restores focus. */
export function Modal({ title, onClose, children, wide, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const reduce = useReducedMotion();
  const closeRef = useRef<() => void>(() => undefined);
  closeRef.current = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, reduce ? 0 : 170);
  };
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = (el.querySelector('[data-autofocus], input, .btn.primary') ?? el.querySelector(FOCUSABLE)) as HTMLElement | null;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, []);
  return createPortal(
    <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: closing ? 0 : 1 }} transition={{ duration: 0.17 }} onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <motion.div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.9, y: 24, rotateX: 8 }}
        animate={closing ? { opacity: 0, scale: 0.95, y: 12 } : { opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={closing ? { duration: 0.16, ease: [0.4, 0, 1, 1] } : { type: 'spring', stiffness: 420, damping: 30 }}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <div className="spacer" />
          {actions}
          <button type="button" className="btn ghost sm" aria-label="Close dialog" onClick={() => closeRef.current()}>✕</button>
        </div>
        <ModalCloseContext.Provider value={() => closeRef.current()}>{children}</ModalCloseContext.Provider>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Callout({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return <div className={`callout ${tone ?? ''}`}>{children}</div>;
}

// ---------------------------------------------------------------- data
export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T, i: number) => ReactNode;
  sort?: (row: T) => number | string;
  align?: 'r' | 'c';
  title?: string;
  width?: number;
}

export function Table<T>({ columns, rows, rowKey, initialSort, initialDir = 'desc', rowClass, empty, limit }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; initialSort?: string; initialDir?: 'asc' | 'desc'; rowClass?: (row: T) => string; empty?: ReactNode; limit?: number }) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSort);
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    const s = [...rows].sort((a, b) => {
      const va = col.sort!(a);
      const vb = col.sort!(b);
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return s;
  }, [rows, sortKey, dir, columns]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  if (!rows.length) return <Empty>{empty ?? 'Nothing to show.'}</Empty>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.align ?? ''} ${c.sort ? 'sortable' : ''}`}
                title={c.title}
                style={c.width ? { width: c.width } : undefined}
                aria-sort={sortKey === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                tabIndex={c.sort ? 0 : undefined}
                onKeyDown={(e) => { if (c.sort && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}
                onClick={() => {
                  if (!c.sort) return;
                  if (sortKey === c.key) setDir(dir === 'asc' ? 'desc' : 'asc');
                  else {
                    setSortKey(c.key);
                    setDir('desc');
                  }
                }}
              >
                {c.label}
                {sortKey === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={rowKey(r)} className={rowClass?.(r) ?? ''}>
              {columns.map((c) => (
                <td key={c.key} className={c.align ?? ''}>
                  {c.render(r, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Money({ v, signed, tone }: { v: number; signed?: boolean; tone?: boolean }) {
  const cls = tone ? (v > 0 ? 'good' : v < 0 ? 'bad' : '') : '';
  return <span className={`num ${cls}`}>{fmtMoney(v, signed)}</span>;
}

export function Bar({ value, max = 100, color, title }: { value: number; max?: number; color?: string; title?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" title={title}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ratingColor(v: number): string {
  if (v >= 75) return '#16a34a';
  if (v >= 65) return '#65a30d';
  if (v >= 55) return '#ca8a04';
  if (v >= 45) return '#ea580c';
  return '#b91c1c';
}

/** Mid-tone chips use dark text for WCAG contrast. */
function ratingText(v: number) {
  return v >= 75 || v < 45 ? 'white' : '#111';
}

export function Rating({ v, range, title }: { v: number; range?: [number, number] | null; title?: string }) {
  if (range && range[0] !== range[1]) {
    return (
      <span className="rating" style={{ background: ratingColor((range[0] + range[1]) / 2), color: ratingText((range[0] + range[1]) / 2) }} title={title ?? 'Scouted range — scout the player for more precision'}>
        {range[0]}–{range[1]}
      </span>
    );
  }
  return (
    <span className="rating" style={{ background: ratingColor(v), color: ratingText(v) }} title={title}>
      {Math.round(v)}
    </span>
  );
}

export function Crest({ club, size }: { club: Pick<Club, 'abbrev' | 'colors'> & Partial<Pick<Club, 'id' | 'name' | 'nickname'>> & { logoUrl?: string }; size?: 'lg' | 'xl' | number }) {
  const px = typeof size === 'number' ? size : size === 'xl' ? 96 : size === 'lg' ? 60 : 32;
  return (
    <span className="crest" title={club.name}>
      <ClubLogo club={{ id: club.id ?? 0, name: club.name ?? club.abbrev, nickname: club.nickname ?? '', abbrev: club.abbrev, colors: club.colors, logoUrl: club.logoUrl }} size={px} />
    </span>
  );
}

/** Animated number (counts up on change). */
export function CountUp({ value, duration = 0.9, format }: { value: number; duration?: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) { el.textContent = format ? format(value) : String(Math.round(value)); return; }
    const ctl = animate(prev.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => { el.textContent = format ? format(v) : String(Math.round(v)); } });
    prev.current = value;
    return () => ctl.stop();
  }, [value, duration, format, reduce]);
  return <span ref={ref} className="num">{format ? format(0) : 0}</span>;
}

export function ClubLink({ club }: { club: Pick<Club, 'id' | 'name' | 'abbrev' | 'colors'> }) {
  return (
    <Link to={`/clubs/${club.id}`} className="link">
      {club.name}
    </Link>
  );
}

export function PlayerLink({ player, short }: { player: Pick<Player, 'id' | 'firstName' | 'lastName'>; short?: boolean }) {
  return (
    <Link to={`/player/${player.id}`} className="link">
      {short ? `${player.firstName[0]}. ${player.lastName}` : `${player.firstName} ${player.lastName}`}
    </Link>
  );
}

// ---------------------------------------------------------------- charts (inline SVG)
export function Sparkline({ data, width = 220, height = 50, color = 'var(--accent2)', zero = true }: { data: number[]; width?: number; height?: number; color?: string; zero?: boolean }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data, zero ? 0 : Infinity);
  const max = Math.max(...data, zero ? 0 : -Infinity);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  const zeroY = height - ((0 - min) / span) * (height - 4) - 2;
  const gid = `sp${Math.abs(Math.round(data.reduce((a, v, i) => a + v * (i + 1), 0))) % 100000}${width}`;
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {zero && min < 0 && <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="var(--bad)" strokeDasharray="3 3" strokeWidth={1} />}
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} className="spark-area" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} pathLength={1} className="spark-line" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

export function BarChart({ items, height = 160, format }: { items: { label: string; value: number; color?: string }[]; height?: number; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const hasNeg = items.some((i) => i.value < 0);
  const mid = hasNeg ? height / 2 : height;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, height: height + 34 }}>
      {items.map((it) => {
        const h = (Math.abs(it.value) / max) * (hasNeg ? height / 2 : height);
        return (
          <div key={it.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} title={`${it.label}: ${format ? format(it.value) : it.value}`}>
            <div style={{ position: 'relative', height, width: '100%' }}>
              <div className={`bc-bar ${it.value < 0 ? 'neg' : ''}`} style={{ position: 'absolute', left: '15%', right: '15%', borderRadius: '3px 3px 0 0', background: it.color ?? (it.value < 0 ? 'linear-gradient(0deg, #f87171, #7f1d1d)' : 'linear-gradient(180deg, var(--electric), var(--accent2) 60%, #1d4ed8)'), boxShadow: it.value < 0 ? undefined : '0 0 14px rgba(54, 209, 255, 0.35)', top: it.value >= 0 ? mid - h : mid, height: Math.max(1, h) }} />
              {hasNeg && <div style={{ position: 'absolute', left: 0, right: 0, top: mid, borderTop: '1px solid var(--line)' }} />}
            </div>
            <div className="small muted" style={{ marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{it.label}</div>
            <div className="small num">{format ? format(it.value) : it.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Meter({ value, label, max = 100 }: { value: number; label?: ReactNode; max?: number }) {
  const v = Math.round(value);
  const color = v / max >= 0.66 ? 'var(--good)' : v / max >= 0.4 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div>
      {label && (
        <div className="row small" style={{ marginBottom: 3 }}>
          <span className="muted">{label}</span>
          <span className="spacer" />
          <b>{v / max >= 0.66 ? '▲ ' : v / max >= 0.4 ? '' : '▼ '}{v}</b>
        </div>
      )}
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

/**
 * Numeric control: a slider is the primary input, with a compact box for typing an exact value.
 * When min/max are not given the range is derived once from the starting value (0 → ~3×).
 */
export function NumberField({ value, onChange, step = 1, min, max, prefix, suffix, width = 96, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; prefix?: string; suffix?: string; width?: number; label?: string }) {
  const [range] = useState(() => ({ lo: min ?? 0, hi: max ?? niceCeil(Math.max(Math.abs(value) * 3, step * 20)) }));
  const lo = min ?? range.lo;
  const hi = Math.max(max ?? range.hi, value);
  const pct = hi > lo ? ((value - lo) / (hi - lo)) * 100 : 0;
  const clampV = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return (
    <span className="slider-field">
      <input
        type="range"
        aria-label={label ?? 'Value'}
        min={lo}
        max={hi}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(clampV(Number(e.target.value)))}
      />
      <span className="slider-box">
        {prefix && <span className="muted">{prefix}</span>}
        <input type="number" aria-label={`${label ?? 'Value'} (exact)`} value={value} step={step} min={min} max={max} style={{ width }} onChange={(e) => onChange(clampV(Number(e.target.value)))} />
        {suffix && <span className="muted">{suffix}</span>}
      </span>
    </span>
  );
}
