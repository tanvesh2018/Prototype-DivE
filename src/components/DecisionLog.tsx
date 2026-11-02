import { useMemo, useState, type ReactNode } from 'react';
import type { AuditEvent } from '../engine/types';
import { download, toCSV } from '../engine/util';
import { useStore } from '../state/store';
import { Badge, Button, Empty, Icon, Modal, SearchBox, Table, useClickOutside } from './ui';

const DECISION_KINDS = new Set(['approve', 'override', 'data', 'escalate']);

/**
 * Decision log with undo. Every change made through act() records exactly what
 * it changed, so any decision listed here can be reversed — even if it isn't the
 * latest one. Undo itself is logged ("Undid: …").
 */
export function DecisionLog({ modules, title = 'Decision log', subtitle, limit = 200, embedded }: { modules?: string[]; title?: string; subtitle?: string; limit?: number; embedded?: boolean }) {
  const { s, undo, readOnly } = useStore();
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = useMemo(() => s.audit.filter((a) => DECISION_KINDS.has(a.kind) || a.undoOf)
    .filter((a) => !modules || (a.module && modules.includes(a.module)))
    .filter((a) => !q || `${a.actor} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase())), [s.audit, modules, q]);
  const body = <>
    <div className="table-tools"><SearchBox value={q} onChange={setQ} placeholder="Search decisions…" /><span className="muted small">{list.length} decision{list.length === 1 ? '' : 's'}{modules ? ` on ${modules.join(', ')}` : ''}</span>
      <Button variant="secondary" icon="download" onClick={() => download('decision_log.csv', toCSV(list.map((a) => ({ time: a.ts, who: a.actor, decision: a.action, detail: a.detail, screen: a.module ?? '', type: a.kind, undone: a.undone ? 'yes' : '' }))))}>Export</Button></div>
    {list.length ? <div className="scroll-y"><Table cols={`120px 110px 1.4fr 2.2fr ${modules?.length === 1 ? '' : '120px '}90px 120px`} head={['When', 'Who', 'Decision', 'Detail', ...(modules?.length === 1 ? [] : ['Screen']), 'Type', '']}>
      {list.slice(0, limit).map((a: AuditEvent) => <div className={`tr ${a.undone ? 'muted-row' : ''}`} key={a.id}>
        <span>{new Date(a.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        <span>{a.actor}</span>
        <span><strong style={a.undone ? { textDecoration: 'line-through' } : undefined}>{a.action}</strong></span>
        <span className="muted small">{a.detail}</span>
        {modules?.length !== 1 && <span className="small">{a.module ?? '—'}</span>}
        <span><Badge tone={a.undoOf ? 'warning' : a.kind === 'approve' ? 'success' : a.kind === 'override' || a.kind === 'escalate' ? 'warning' : 'neutral'}>{a.undoOf ? 'undo' : a.kind}</Badge></span>
        <span className="row" style={{ justifyContent: 'flex-end' }}>
          {a.undone ? <Badge>Undone</Badge> : a.patch && !readOnly ? (confirm === a.id
            ? <><Button variant="danger" onClick={() => { undo(a.id); setConfirm(null); }}>Confirm undo</Button><Button variant="ghost" onClick={() => setConfirm(null)}>×</Button></>
            : <Button variant="secondary" icon="refresh" onClick={() => setConfirm(a.id)}>Undo</Button>) : <span className="muted small" title="Uploads, AI drafts and access changes are logged but can't be undone">—</span>}
        </span>
      </div>)}
    </Table></div> : <Empty title="No decisions yet">Approvals, overrides and data fixes on this screen will appear here, each with an undo.</Empty>}
  </>;
  if (embedded) return body;
  return <section className="card"><div className="card-header"><div><h2>{title}</h2><p>{subtitle ?? 'Who decided what, when — every decision can be undone'}</p></div><Badge tone="info"><Icon name="refresh" size={11} /> Undo available</Badge></div>{body}</section>;
}

export function DecisionLogButton({ modules, label = 'Decision log' }: { modules: string[]; label?: string }) {
  const { s } = useStore();
  const [open, setOpen] = useState(false);
  const n = s.audit.filter((a) => (DECISION_KINDS.has(a.kind) || a.undoOf) && a.module && modules.includes(a.module)).length;
  return <>
    <Button variant="secondary" icon="file" onClick={() => setOpen(true)}>{label}{n ? ` (${n})` : ''}</Button>
    {open && <Modal wide title={`${label} · ${modules.join(', ')}`} subtitle="Every decision taken on this screen — undo any of them" onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Close</Button>}><DecisionLog modules={modules} embedded /></Modal>}
  </>;
}

/** Small ⓘ button that opens a plain-language explanation. */
export function InfoTip({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLSpanElement>(open, () => setOpen(false));
  return <span className="info-tip" ref={ref}>
    <button type="button" className="info-btn" aria-label={`About ${title}`} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>i</button>
    {open && <div className={`info-pop ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}><div className="row between"><strong>{title}</strong><button className="kebab" onClick={() => setOpen(false)}>×</button></div><div className="info-body">{children}</div></div>}
  </span>;
}
