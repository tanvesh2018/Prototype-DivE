import { useMemo, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { earlyWarning, type WarnOut } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Menu, Modal, PageTitle, Progress, SearchBox, Table, toneFor } from '../components/ui';
import { TASK_STATUSES, WORKSTREAMS } from '../engine/glossary';
import { addDays, daysBetween, download, fmtDate, initials, toCSV, uid, type Row } from '../engine/util';
import { useStore } from '../state/store';
import { suggestMilestone } from '../engine/model';
import { DecisionLogButton, InfoTip } from '../components/DecisionLog';

const statusTone = (st: string) => (st === 'Blocked' ? 'danger' : st === 'At risk' || st === 'Review' ? 'warning' : st === 'In progress' ? 'info' : st === 'Done' ? 'success' : 'neutral');

export function Tracker() {
  const { s, m, act, toast, params } = useStore();
  const [status, setStatus] = useState('Open');
  const [ws, setWs] = useState(params.ws ?? 'All');
  const [owner, setOwner] = useState('All');
  const [q, setQ] = useState(params.q ?? params.item ?? '');
  const [flagged, setFlagged] = useState(false);
  const [n, setN] = useState(30);
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  const [upload, setUpload] = useState(false);
  const [ai, setAi] = useState<AIResult<WarnOut> | null>(null);
  const [busy, setBusy] = useState(false);

  const tasks = m.tasks;
  const flaggedIds = new Set(m.warnings.map((w) => w.task._rid));
  const owners = [...new Set(tasks.map((t) => t.owner))].sort();
  const filtered = useMemo(() => tasks.filter((t) => (status === 'All' || (status === 'Open' ? t.status !== 'Done' : t.status === status)) && (ws === 'All' || t.workstream === ws) && (owner === 'All' || t.owner === owner) && (!flagged || flaggedIds.has(t._rid)) && (!q || `${t.task_id} ${t.title} ${t.owner} ${t.linked_item} ${m.byId.get(t.linked_item)?.name ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(flaggedIds.has(b._rid)) - Number(flaggedIds.has(a._rid)) || String(a.priority).localeCompare(String(b.priority)) || String(a.due_date).localeCompare(String(b.due_date))), [tasks, status, ws, owner, q, flagged, flaggedIds, m.byId]);
  const weekEnd = addDays(s.deal.asOf, 7);
  const dueWeek = tasks.filter((t) => t.due_date >= s.deal.asOf && t.due_date <= weekEnd);
  const crit = m.warnings.filter((w) => m.byId.get(w.task.linked_item)?.flagged || w.task.priority === 'P0');
  const pct = m.totalTasks ? Math.round((100 * m.doneTasks) / m.totalTasks) : 0;

  const setTask = (t: Row, patch: Record<string, any>, label = 'Updated task') => act(label, `${t.task_id} ${t.title}: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`, (d) => { const r = d.datasets.tasks!.rows.find((x) => x._rid === t._rid); if (r) Object.assign(r, patch); }, { skipIssues: true });

  const explain = async () => {
    setBusy(true);
    const r = await runAI(earlyWarning, { buyer: s.deal.buyer, daysToDay1: m.daysToDay1, warnings: m.warnings.map((w) => ({ id: w.task.task_id, title: w.task.title, workstream: w.task.workstream, owner: w.task.owner, due: fmtDate(w.task.due_date), status: w.task.status, reason: w.reason, critical: !!m.byId.get(w.task.linked_item)?.flagged || w.task.priority === 'P0', item: m.byId.get(w.task.linked_item)?.name })) });
    setAi(r); setBusy(false);
    act('AI early warning generated', r.data.headline, () => {}, { kind: 'ai', skipIssues: true, allowReadOnly: true });
  };
  const rule = useMemo(() => earlyWarning.fallback({ buyer: s.deal.buyer, daysToDay1: m.daysToDay1, warnings: m.warnings.map((w) => ({ id: w.task.task_id, title: w.task.title, workstream: w.task.workstream, owner: w.task.owner, due: fmtDate(w.task.due_date), status: w.task.status, reason: w.reason, critical: !!m.byId.get(w.task.linked_item)?.flagged || w.task.priority === 'P0' })) }), [m]);
  const warn = ai?.data ?? rule;
  const nextStep = (id: string) => ai?.data.items.find((x) => x.id === id)?.nextStep;

  const escalate = () => {
    const top = m.warnings.find((w) => w.task.status === 'Blocked') ?? m.warnings[0];
    if (!top) return;
    act('Created escalation', `${warn.headline} — ${top.task.title}`, (d) => {
      d.ownerQueue.push({ id: uid('OQ'), question: `ESCALATION: ${top.task.title} (${top.task.task_id})`, context: warn.detail, owner: d.users.find((u) => u.title.includes('CIO'))?.name ?? 'Sophie Martin', role: 'Client CIO', due: addDays(d.deal.asOf, 1), priority: 'P0', status: 'escalated', createdAt: new Date().toISOString() });
    }, { kind: 'escalate', skipIssues: true });
    toast(`Escalation created and routed to ${s.deal.buyer}'s CIO`, 'warning');
  };

  return <>
    <PageTitle eyebrow="Track & score" title="Execution Tracker" description={`One accountable plan for ${m.totalTasks} activities across ${m.wsProgress.length} workstreams.`} action={<><DecisionLogButton modules={['Execution Tracker']} /><Button variant="secondary" icon="upload" onClick={() => setUpload(true)}>Import tracker</Button><Button variant="secondary" icon="download" onClick={() => { download('separation_plan.csv', toCSV(tasks.map((t) => ({ task_id: t.task_id, task: t.title, workstream: t.workstream, owner: t.owner, due_date: t.due_date, status: t.status, priority: t.priority, linked_item: t.linked_item, flagged: flaggedIds.has(t._rid) ? 'Yes' : '' })))); toast('Plan exported'); }}>Export plan</Button><Button icon="plus" onClick={() => setEdit('new')}>Add task</Button></>} />
    <div className="tracker-summary">
      <div><span>Overall completion</span><strong>{pct}%</strong><Progress value={pct} /></div>
      <div style={{ cursor: 'pointer' }} onClick={() => setStatus('Open')}><span>Open tasks</span><strong>{m.totalTasks - m.doneTasks}</strong><small>of {m.totalTasks} total</small></div>
      <div><span>Due this week</span><strong>{dueWeek.filter((t) => t.status !== 'Done').length}</strong><small>{dueWeek.filter((t) => t.status === 'Done').length} completed</small></div>
      <div className="risk" style={{ cursor: 'pointer' }} onClick={() => { setFlagged(true); setStatus('All'); }}><span>At risk / blocked</span><strong>{m.warnings.length}</strong><small>{crit.length} critical</small></div>
      <div><span>{s.deal.milestoneLabel} (contractual)</span><strong>{m.daysToDay1} days</strong><small>{fmtDate(s.deal.day1, true)}</small></div>
    </div>
    <SuggestedMilestone />
    {m.warnings.length > 0 && <div className="ai-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: '#fff', marginBottom: 12 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}><Icon name="spark" /><div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}><strong style={{ fontSize: 11 }}>{warn.headline}</strong><span>{warn.detail}</span><span className="row"><AIChip result={ai} />{!ai && <span className="muted small">Rule flags: due within 5 days and not started, overdue, at risk or blocked</span>}</span></div></div>
      <div className="row"><Button variant="secondary" icon="spark" loading={busy} onClick={explain}>{ai ? 'Refresh AI next steps' : 'AI next steps'}</Button><Button variant="secondary" onClick={escalate}>Create escalation</Button></div>
    </div>}
    <div className="workstream-grid card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>{m.wsProgress.map((w) => <div key={w.name} style={{ cursor: 'pointer', padding: 4, background: ws === w.name ? '#fff8f4' : undefined }} onClick={() => setWs(ws === w.name ? 'All' : w.name)}><div className="row between small"><span>{w.name}</span><strong>{w.pct}% <span className="muted">({w.done}/{w.total})</span></strong></div><Progress value={w.pct} tone={toneFor(w.pct, 85, 75)} /></div>)}</div>
    <section className="card table-card">
      <div className="table-tools">
        <div className="status-filters">{['Open', 'All', ...TASK_STATUSES].map((st) => <button key={st} className={status === st ? 'active' : ''} onClick={() => { setStatus(st); setN(30); }}>{st}<span>{st === 'All' ? tasks.length : st === 'Open' ? tasks.filter((t) => t.status !== 'Done').length : tasks.filter((t) => t.status === st).length}</span></button>)}</div>
        <SearchBox value={q} onChange={setQ} placeholder="Search tasks, owners, items…" />
        <select className="inline" value={ws} onChange={(e) => setWs(e.target.value)}><option>All</option>{WORKSTREAMS.map((w) => <option key={w}>{w}</option>)}</select>
        <select className="inline" value={owner} onChange={(e) => setOwner(e.target.value)}><option>All</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
        <label className="small row" style={{ cursor: 'pointer' }}><input type="checkbox" checked={flagged} onChange={() => setFlagged(!flagged)} />Flagged only</label>
      </div>
      {filtered.length ? <Table cols="2.4fr 1.1fr 1.2fr 70px 120px 50px 1.1fr 30px" head={['Task', 'Workstream', 'Owner', 'Due', 'Status', 'Pri.', 'Linked item', '']}>
        {filtered.slice(0, n).map((t) => {
          const overdue = t.status !== 'Done' && t.due_date < s.deal.asOf;
          const ns = nextStep(t.task_id);
          return <div className="tr" key={t._rid} style={flaggedIds.has(t._rid) ? { boxShadow: 'inset 3px 0 var(--red)' } : undefined}>
            <span><strong>{t.title}</strong><small>{t.task_id}{flaggedIds.has(t._rid) ? ` · ⚑ ${m.warnings.find((w) => w.task._rid === t._rid)?.reason}` : ''}{ns ? ` · Next: ${ns}` : ''}</small></span>
            <span>{t.workstream}</span>
            <span className="owner row"><i style={{ width: 22, height: 22, background: '#e8e9ea', borderRadius: '50%', display: 'grid', placeItems: 'center', fontStyle: 'normal', fontSize: 7, fontWeight: 600 }}>{initials(t.owner)}</i>{t.owner}</span>
            <span className={overdue ? 'overdue' : ''} style={overdue ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{fmtDate(t.due_date)}</span>
            <span><select className="inline" value={t.status} onChange={(e) => setTask(t, { status: e.target.value }, 'Changed task status')} style={{ color: `var(--${statusTone(t.status) === 'danger' ? 'red' : statusTone(t.status) === 'warning' ? 'amber' : statusTone(t.status) === 'success' ? 'green' : 'text-2'})` }}>{TASK_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></span>
            <span><span className={`priority ${String(t.priority).toLowerCase()}`} style={{ fontWeight: 700, color: t.priority === 'P0' ? 'var(--red)' : undefined }}>{t.priority}</span></span>
            <span className="muted">{t.linked_item ? `${m.byId.get(t.linked_item)?.name ?? t.linked_item}` : '—'}</span>
            <Menu items={[{ label: 'Edit task', icon: 'edit', onClick: () => setEdit(t) }, { label: 'Mark done', icon: 'check', onClick: () => setTask(t, { status: 'Done' }, 'Completed task') }, { label: 'Push due date +3 days', icon: 'calendar', onClick: () => setTask(t, { due_date: addDays(t.due_date, 3) }, 'Re-planned task') }, 'sep', { label: 'Delete task', icon: 'trash', danger: true, onClick: () => { if (confirm(`Delete ${t.task_id}?`)) act('Deleted task', `${t.task_id} ${t.title}`, (d) => { d.datasets.tasks!.rows = d.datasets.tasks!.rows.filter((x) => x._rid !== t._rid); }, { skipIssues: true }); } }]} />
          </div>;
        })}
      </Table> : <Empty title="No tasks match these filters" />}
      <div className="table-footer"><span>Showing {Math.min(n, filtered.length)} of {filtered.length}</span>{filtered.length > n && <Button variant="secondary" onClick={() => setN(n + 50)}>Show more</Button>}</div>
    </section>
    {edit && <TaskModal task={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    {upload && <UploadModal expected="tasks" onClose={() => setUpload(false)} />}
  </>;
}

function TaskModal({ task, onClose }: { task: Row | null; onClose: () => void }) {
  const { s, m, act, toast } = useStore();
  const next = `TSK-${String(Math.max(117, ...m.tasks.map((t) => +String(t.task_id).replace(/\D/g, '') || 0)) + 1).padStart(3, '0')}`;
  const [f, setF] = useState({ title: task?.title ?? '', workstream: task?.workstream ?? WORKSTREAMS[0], owner: task?.owner ?? s.currentUser, due_date: task?.due_date ?? addDays(s.deal.asOf, 3), status: task?.status ?? 'Not started', priority: task?.priority ?? 'P2', linked_item: task?.linked_item ?? '' });
  const save = () => {
    act(task ? 'Edited task' : 'Added task', `${task?.task_id ?? next} ${f.title}`, (d) => {
      if (!d.datasets.tasks) d.datasets.tasks = { key: 'tasks', fileName: 'Created in DealSync', uploadedAt: new Date().toISOString(), rawCount: 0, rows: [], mapping: [] };
      if (task) Object.assign(d.datasets.tasks.rows.find((x) => x._rid === task._rid)!, f);
      else { d.datasets.tasks.rows.unshift({ _rid: uid('tasks'), task_id: next, ...f }); d.datasets.tasks.rawCount++; }
    }, { skipIssues: true });
    toast(task ? 'Task updated' : `${next} added`); onClose();
  };
  return <Modal title={task ? `Edit ${task.task_id}` : 'Add task'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.title.trim()} onClick={save}>Save</Button></>}>
    <div className="form-grid">
      <label className="field full">Task<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field">Workstream<select value={f.workstream} onChange={(e) => setF({ ...f, workstream: e.target.value })}>{WORKSTREAMS.map((w) => <option key={w}>{w}</option>)}</select></label>
      <label className="field">Owner<input list="owners" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /><datalist id="owners">{[...new Set(m.tasks.map((t) => t.owner))].map((o) => <option key={o} value={o} />)}</datalist></label>
      <label className="field">Due date<input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></label>
      <label className="field">Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{TASK_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="field">Priority<select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['P0', 'P1', 'P2', 'P3'].map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="field">Linked Day-1 item<select value={f.linked_item} onChange={(e) => setF({ ...f, linked_item: e.target.value })}><option value="">None</option>{m.apps.map((a) => <option key={a.id} value={a.id}>{a.name}{a.day1Critical ? ' (Day-1 critical)' : ''}</option>)}</select></label>
      {f.linked_item && <p className="full muted small">Linked tasks feed the item's readiness (50% weight). {daysBetween(s.deal.asOf, f.due_date) <= 5 && f.status === 'Not started' ? 'This task will be flagged by the early-warning rule.' : ''}</p>}
    </div>
  </Modal>;
}

/** Suggested Day-1 / TSA-exit date from team pace + industry & case standards. */
function SuggestedMilestone() {
  const { s, m, act, toast, readOnly } = useStore();
  const g = useMemo(() => suggestMilestone(s, m), [s, m]);
  const L = s.deal.milestoneLabel;
  const late = g.delta > 0;
  return <div className="suggest-card" style={{ borderLeftColor: late ? 'var(--red)' : 'var(--green)' }}>
    <div className="suggest-date">
      <span className="eyebrow" style={{ margin: 0 }}>Suggested {L} date<InfoTip title={`How the suggested ${L} date is worked out`} wide>
        <p>It answers: <b>“Given how fast this team is really closing tasks, and what the industry needs for a safe cut-over, when can {L} realistically happen?”</b></p>
        <table><tbody>
          <tr><td>Open tasks</td><td><b>{g.open}</b></td></tr>
          <tr><td>Team pace (tasks closed per week, last 4 weeks)</td><td><b>{g.pacePerWeek}</b></td></tr>
          <tr><td>Days to finish open work = open ÷ pace × 7</td><td><b>{g.workDays}</b></td></tr>
          {g.consentFloor > 0 && <tr><td>Wait for a blocked third-party consent (industry lead time)</td><td><b>{g.consentFloor}</b></td></tr>}
          <tr><td>Readiness gap: ½ day per point below {s.config.goThreshold} (now {m.underlying})</td><td><b>+{g.gapDays}</b></td></tr>
          <tr><td>Industry buffer ({s.deal.industry}): {g.std.bufferWhy}</td><td><b>+{g.bufferDays}</b></td></tr>
          <tr><td><b>Total from as-of date {fmtDate(s.deal.asOf)}</b></td><td><b>{g.total} days</b></td></tr>
        </tbody></table>
        <p className="muted">Case & industry standards: {g.std.typical}. Consents: {g.std.consentWhy}.</p>
      </InfoTip></span>
      <strong style={{ fontSize: 20 }}>{fmtDate(g.suggested, true)}</strong>
      <Badge tone={late ? 'danger' : 'success'}>{late ? `${g.delta} days after the contractual date` : g.delta === 0 ? 'Matches the contractual date' : `${-g.delta} days of headroom`}</Badge>
    </div>
    <p className="suggest-why">
      Contractual {L}: <b>{fmtDate(s.deal.day1, true)}</b>. At the current pace of <b>{g.pacePerWeek} tasks/week</b>, the {g.open} open tasks finish in about {g.workDays} days, then {s.deal.industry.toLowerCase()} standards add {g.bufferDays} days ({g.std.bufferWhy}){g.gapDays ? ` and ${g.gapDays} days to close the readiness gap` : ''}.
      {late ? <> To hold the contractual date the team needs about <b>{g.neededPace} tasks/week</b> — {Math.round(g.neededPace / g.pacePerWeek * 10) / 10}× today's pace — or scope must move to the TSA.</> : <> The plan has headroom; keep the pace and protect the buffer.</>}
    </p>
    <Button variant="secondary" disabled={readOnly || g.delta === 0} onClick={() => { act(`Moved ${L} date to suggested`, `${fmtDate(s.deal.day1, true)} → ${fmtDate(g.suggested, true)}`, (d) => { d.deal.day1 = g.suggested; }, { kind: 'override', skipIssues: true }); toast(`${L} moved to ${fmtDate(g.suggested, true)} — undo from the Decision log`, 'info'); }}>Use suggested date</Button>
  </div>;
}
