import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Club, Player } from '../../engine/types';
import { fmtMoney } from '../../engine/world';

// ---------------------------------------------------------------- layout
export function Page({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
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
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${t.id === value ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </div>
      ))}
    </div>
  );
}

export function Pills<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="pill-group">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)} title={o.title}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          {actions}
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        {children}
      </div>
    </div>
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

export function Rating({ v, range, title }: { v: number; range?: [number, number] | null; title?: string }) {
  if (range && range[0] !== range[1]) {
    return (
      <span className="rating" style={{ background: ratingColor((range[0] + range[1]) / 2), color: 'white' }} title={title ?? 'Scouted range — scout the player for more precision'}>
        {range[0]}–{range[1]}
      </span>
    );
  }
  return (
    <span className="rating" style={{ background: ratingColor(v), color: 'white' }} title={title}>
      {Math.round(v)}
    </span>
  );
}

export function Crest({ club, size }: { club: Pick<Club, 'abbrev' | 'colors'>; size?: 'lg' }) {
  return (
    <span className={`crest ${size ?? ''}`} style={{ background: club.colors[0], color: club.colors[1], borderColor: club.colors[1] }}>
      {club.abbrev}
    </span>
  );
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
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {zero && min < 0 && <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="var(--bad)" strokeDasharray="3 3" strokeWidth={1} />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} />
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
              <div style={{ position: 'absolute', left: '15%', right: '15%', borderRadius: 4, background: it.color ?? (it.value < 0 ? 'var(--bad)' : 'var(--accent2)'), top: it.value >= 0 ? mid - h : mid, height: Math.max(1, h) }} />
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
          <b>{v}</b>
        </div>
      )}
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

export function NumberField({ value, onChange, step = 1, min, max, prefix, width = 110 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; prefix?: string; width?: number }) {
  return (
    <span className="row gap4">
      {prefix && <span className="muted">{prefix}</span>}
      <input type="number" value={value} step={step} min={min} max={max} style={{ width }} onChange={(e) => onChange(Number(e.target.value))} />
    </span>
  );
}
