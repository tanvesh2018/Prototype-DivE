import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getAIStatus, isLiveAIAvailable, type AIResult } from '../ai/client';

export type IconName =
  | 'overview' | 'database' | 'network' | 'decision' | 'tasks' | 'readiness' | 'funding' | 'insights' | 'settings' | 'search' | 'bell'
  | 'chevron' | 'arrow' | 'upload' | 'spark' | 'check' | 'alert' | 'calendar' | 'shield' | 'download' | 'filter' | 'send' | 'lock'
  | 'clock' | 'users' | 'file' | 'plus' | 'x' | 'trash' | 'edit' | 'refresh' | 'eye' | 'copy' | 'link' | 'merge';

const paths: Record<IconName, ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  network: <><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="m7.3 10.9 9.4-4.7M7.3 13.1l9.4 4.7" /></>,
  decision: <><path d="M9 5H4v5M4 5l6 6" /><path d="M15 19h5v-5m0 5-7-7" /><path d="M15 5h5v5m0-5-6 6" /></>,
  tasks: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 8 1.5 1.5L12 7M14 9h3M8 14l1.5 1.5L12 13M14 15h3" /></>,
  readiness: <><path d="M4 18a9 9 0 1 1 16 0" /><path d="m12 13 4-5" /><circle cx="12" cy="13" r="1.5" /></>,
  funding: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M7 6V4h10v2M3 11h18M9 15h6" /></>,
  insights: <><path d="M9 18h6M10 22h4" /><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5C14.6 16.2 14 17 14 18h-4c0-1-.6-1.8-1.5-2.5Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
  spark: <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" /><path d="m19 15 .6 2.1L22 18l-2.4.9L19 21l-.6-2.1L16 18l2.4-.9L19 15Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17.5h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  download: <><path d="M12 4v12m-5-5 5 5 5-5" /><path d="M4 20h16" /></>,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
  send: <><path d="m22 2-8 20-4-8-8-4 20-8Z" /><path d="M10 14 22 2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20" /></>,
  file: <><path d="M6 2h8l4 4v16H6V2Z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  merge: <><path d="M6 3v6a6 6 0 0 0 6 6h6" /><path d="M6 21v-6" /><path d="m15 12 3 3-3 3" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';
export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span className={`badge ${tone}`} title={title}><span className="badge-dot" />{children}</span>;
}

export function Progress({ value, tone = 'orange' }: { value: number; tone?: 'orange' | 'green' | 'amber' | 'red' | 'charcoal' }) {
  return <div className="progress"><div className={`progress-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
export const toneFor = (v: number, gate = 90, mid = 80): 'green' | 'amber' | 'red' => (v >= gate ? 'green' : v >= mid ? 'amber' : 'red');

export function MetricCard({ label, value, detail, icon, tone = 'default', onClick }: { label: string; value: ReactNode; detail: ReactNode; icon: IconName; tone?: string; onClick?: () => void }) {
  return <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} className={`metric-card ${tone} ${onClick ? '' : 'static'}`} onClick={onClick} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
    <div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon name={icon} /></div></div>
    <div className="metric-value">{value}</div>
    <div className="metric-detail">{detail}</div>
  </div>;
}

export function Button({ children, variant = 'primary', icon, onClick, disabled = false, loading = false, title, type = 'button' }: { children?: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; onClick?: () => void; disabled?: boolean; loading?: boolean; title?: string; type?: 'button' | 'submit' }) {
  return <button type={type} className={`btn ${variant}`} onClick={onClick} disabled={disabled || loading} title={title}>{loading ? <span className="spinner" /> : icon && <Icon name={icon} size={15} />}{children}</button>;
}

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="title-actions">{action}</div>}</div>;
}

export function Modal({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="x" onClick={onClose} aria-label="Close">×</button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>
  </div>;
}

export function useClickOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    setTimeout(() => document.addEventListener('mousedown', h));
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
}

export interface MenuItem { label: string; icon?: IconName; onClick: () => void; danger?: boolean; disabled?: boolean }
export function Menu({ items, trigger, left }: { items: (MenuItem | 'sep' | { label: string; header: true })[]; trigger?: ReactNode; left?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  return <div className="menu-wrap" ref={ref}>
    <span onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger ?? <button className="kebab" aria-label="More actions">•••</button>}</span>
    {open && <div className={`menu ${left ? 'left' : ''}`}>{items.map((it, i) => it === 'sep' ? <hr key={i} /> : 'header' in it ? <div className="menu-label" key={i}>{it.label}</div> : <button key={i} className={it.danger ? 'danger' : ''} disabled={it.disabled} onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}>{it.icon && <Icon name={it.icon} size={14} />}{it.label}</button>)}</div>}
  </div>;
}

export function AIChip({ result }: { result?: Pick<AIResult<unknown>, 'source' | 'model' | 'error'> | null }) {
  const st = getAIStatus();
  const live = isLiveAIAvailable(st);
  if (!result) return <span className={`ai-chip ${live ? '' : 'fallback'}`} title={live ? 'Gemini configured' : st.configured ? 'Access code needed — rule-based fallback' : 'No API key — rule-based fallback'}><Icon name="spark" size={10} />{live ? `Gemini ready` : 'Rule-based AI'}</span>;
  return <span className={`ai-chip ${result.source === 'gemini' ? '' : 'fallback'}`} title={result.error ?? ''}><Icon name="spark" size={10} />{result.source === 'gemini' ? `Gemini · ${result.model}` : 'Rule-based fallback'}</span>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return <div className="tabs">{tabs.map((t) => <button key={t.key} className={value === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>{t.label}{!!t.count && <span>{t.count}</span>}</button>)}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <div className="search-box"><Icon name="search" size={15} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />{value && <button className="kebab" onClick={() => onChange('')}>×</button>}</div>;
}

export function Table({ cols, head, children, className = '', style }: { cols: string; head: ReactNode[]; children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`gtable ${className}`} style={{ ['--cols' as any]: cols, ...style }}>
    <div className="tr th">{head.map((h, i) => <span key={i}>{h}</span>)}</div>
    {children}
  </div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>;
}

export function ScoreRing({ score, label, large }: { score: number; label: string; large?: boolean }) {
  const color = score >= 90 ? 'var(--green)' : score >= 80 ? '#d99a1e' : 'var(--red)';
  return <div className={`score-ring ${large ? 'large' : ''}`} style={{ ['--score' as any]: score, ['--ring' as any]: color }}><div><strong>{score}</strong><span>{label}</span></div></div>;
}

export function signalTone(signal: string): Tone { return signal === 'GO' ? 'success' : signal === 'NO-GO' ? 'danger' : 'warning'; }

export function Conf({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  return <span className={`conf ${pct >= 85 ? 'high' : pct >= 65 ? 'mid' : 'low'}`}>{pct}%</span>;
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}><span /></button>;
}
