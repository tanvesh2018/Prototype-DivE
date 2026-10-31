import { useMemo, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { boardSummary, bucketAdvice, componentTag } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Modal, PageTitle, Table, Tabs, type IconName } from '../components/ui';
import { BUCKETS, COMPONENTS, type Bucket, type Component } from '../engine/glossary';
import type { ClassifiedApp } from '../engine/model';
import { addDays, download, fmtDate, money, toCSV } from '../engine/util';
import { useStore } from '../state/store';

const BUCKET_META: Record<Bucket, { desc: string; icon: IconName; mult: number; days: number; monthly?: boolean }> = {
  'Transfer as-is': { desc: 'Direct transfer with minimal change', icon: 'arrow', mult: 1.3, days: 18 },
  'Clone and Go': { desc: 'Copy environment for Day-1 continuity', icon: 'database', mult: 3.4, days: 9 },
  'Commercial agreement / TSA': { desc: 'Retain seller service temporarily', icon: 'clock', mult: 1.25 / 12, days: 3, monthly: true },
  'Stand-up new': { desc: 'Build a clean replacement platform', icon: 'plus', mult: 7.5, days: 60 },
  Consolidate: { desc: 'Migrate to an existing buyer platform', icon: 'network', mult: 2.6, days: 35 },
  'Extract and Sunset': { desc: 'Archive data and retire the system', icon: 'trash', mult: 0.8, days: 21 },
};

function indicative(a: ClassifiedApp, b: Bucket, daysToDay1: number) {
  const meta = BUCKET_META[b];
  const base = Math.max(a.annualCost, 10000);
  const cost = meta.monthly ? `${money(base * meta.mult)}/mo` : money(base * meta.mult);
  const tooSlow = meta.days > daysToDay1 && a.day1Critical;
  const risk = b === 'Transfer as-is' ? (a.entanglement >= 9 ? 'High' : 'Low') : b === 'Clone and Go' ? (a.transferable.toLowerCase().startsWith('no') ? 'High' : 'Medium') : b === 'Commercial agreement / TSA' ? (a.entanglement >= 9 ? 'Medium' : 'Low') : b === 'Stand-up new' ? (tooSlow ? 'High' : 'Medium') : b === 'Consolidate' ? (a.buyerHasSimilar ? 'Low' : 'High') : a.buyerUses ? 'High' : 'Low';
  return { cost, risk: tooSlow && risk !== 'High' ? 'High' : risk, timing: `${meta.days} days` };
}

export function Decisions() {
  const { params } = useStore();
  const [tab, setTab] = useState(params.tab ?? 'strategy');
  const [upload, setUpload] = useState(false);
  const { s, m } = useStore();
  const pendingDec = m.decisions.filter((d) => d.state.status !== 'approved').length;
  return <>
    <PageTitle eyebrow="Classify & decide" title="Separation Decisions" description="Classify every app, compare six evidence-based strategies and route recommendations for accountable approval." action={<><Button variant="secondary" icon="upload" onClick={() => setUpload(true)}>Upload decision options</Button><Button variant="secondary" icon="file" onClick={() => setTab('log')}>Decision log</Button></>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'strategy', label: 'App strategy' }, { key: 'classify', label: 'Classification (all apps)', count: m.apps.length }, { key: 'options', label: 'Leadership options', count: pendingDec }, { key: 'log', label: 'Decision log' }]} />
    {tab === 'strategy' && <AppStrategy />}
    {tab === 'classify' && <Classification />}
    {tab === 'options' && <LeadershipOptions />}
    {tab === 'log' && <DecisionLog />}
    {upload && <UploadModal expected="decisions" onClose={() => setUpload(false)} />}
  </>;
}

function AppStrategy() {
  const { s, m, act, toast, params } = useStore();
  const sorted = [...m.apps].sort((a, b) => Number(b.day1Critical) - Number(a.day1Critical) || b.PI - a.PI);
  const [appId, setAppId] = useState(params.app ?? sorted.find((a) => a.id === 'APP-001')?.id ?? sorted[0]?.id);
  const a = m.byId.get(appId);
  const [selected, setSelected] = useState<Bucket | null>(null);
  const [ai, setAi] = useState<AIResult<{ bucket: string; reason: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  if (!a) return <Empty title="No applications loaded" />;
  const current = selected ?? a.bucket;
  const idx = sorted.findIndex((x) => x.id === a.id);
  const askAI = async () => {
    setBusy(true);
    const r = await runAI(bucketAdvice, { app: { name: a.name, function: a.description, day1Critical: a.day1Critical, flagged: a.flagged, buyerUses: a.buyerUses, buyerHasSimilar: a.buyerHasSimilar, entanglement: a.entanglement, goLive: a.goLive, licenceTransferable: a.transferable, unclearLinks: a.unclear, priorityIndex: a.PI, ownerAnswers: s.datasets.questionnaire?.rows.find((q) => q.app_id === a.id) ?? null }, ruleBucket: a.ruleBucket, ruleReason: a.bucketReason, daysToDay1: m.daysToDay1 });
    setAi(r); setBusy(false);
  };
  const confirm = (b: Bucket, reason?: string) => {
    const override = b !== a.ruleBucket;
    act(override ? 'Overrode separation bucket' : 'Confirmed separation bucket', `${a.name}: ${b}${override ? ` (rule suggested ${a.ruleBucket}) — ${reason}` : ''}`, (d) => {
      d.appOverrides[a.id] = { ...d.appOverrides[a.id], bucket: override ? b : undefined, bucketReason: override ? `Override by ${d.currentUser}: ${reason}` : (ai?.data.bucket === b ? `${ai.data.reason}` : undefined) };
      if (!override) d.decisions[`SD-${a.id}`] = { status: 'approved', chosen: b, approvedAt: new Date().toISOString(), approvedBy: d.currentUser };
    }, { kind: override ? 'override' : 'approve' });
    toast(override ? 'Override logged — waves and TSA plan recalculated' : 'Strategy confirmed and added to decision log');
    setSelected(null); setOverrideReason(null);
  };
  const approvedState = s.decisions[`SD-${a.id}`];
  return <>
    <div className="decision-context" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', background: '#fff', border: '1px solid var(--border)', padding: '14px 18px', marginBottom: 14, alignItems: 'center', gap: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}><span className="app-tile" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', background: '#f1efeb' }}><Icon name="overview" /></span><div><span className="muted small">Decision SD-{a.id.slice(4)} · {a.timing}{a.flagged ? (a.criticalTool ? ' · critical tool' : ' · revenue-linked') : ''}</span>
        <div className="row"><select className="inline" style={{ fontSize: 15, fontWeight: 650, border: 0, padding: 0 }} value={a.id} onChange={(e) => { setAppId(e.target.value); setSelected(null); setAi(null); }}>{sorted.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><Button variant="ghost" disabled={idx <= 0} onClick={() => { setAppId(sorted[idx - 1].id); setSelected(null); setAi(null); }}>‹</Button><Button variant="ghost" disabled={idx >= sorted.length - 1} onClick={() => { setAppId(sorted[idx + 1].id); setSelected(null); setAi(null); }}>›</Button></div>
        <p className="muted small" style={{ margin: 0 }}>{a.component} · Entanglement {a.entanglement} · {a.users} users · {a.site || '—'} · PI {a.PI}</p></div></div>
      <div><span className="muted small">Decision due</span><br /><strong>{fmtDate(addDays(s.deal.day1, -10), true)}</strong></div>
      <div><span className="muted small">Approver</span><br /><strong>{a.day1Critical ? 'Technology Steering Committee' : 'Separation PMO'}</strong></div>
      <div><span className="muted small">Status</span><br />{approvedState?.status === 'approved' && approvedState.chosen === a.bucket ? <Badge tone="success">Confirmed</Badge> : a.overridden ? <Badge tone="warning">Overridden</Badge> : <Badge tone="info">Awaiting confirmation</Badge>}</div>
    </div>
    <div className="strategy-grid">{BUCKETS.map((b) => { const ind = indicative(a, b, m.daysToDay1); return <button key={b} className={`strategy-card ${current === b ? 'selected' : ''}`} onClick={() => setSelected(b)} style={{ textAlign: 'left', padding: 14, background: '#fff', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="row between"><span className="strategy-icon" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', background: '#f1efeb' }}><Icon name={BUCKET_META[b].icon} /></span><span className="row">{a.ruleBucket === b && <Badge tone="orange"><Icon name="spark" size={11} /> Recommended</Badge>}{ai?.data.bucket === b && ai.data.bucket !== a.ruleBucket && <Badge tone="info">AI</Badge>}{a.bucket === b && a.overridden && <Badge tone="warning">Chosen</Badge>}</span></div>
      <h3 style={{ margin: '4px 0 0', fontSize: 12 }}>{b}</h3><p className="muted small" style={{ margin: 0 }}>{BUCKET_META[b].desc}</p>
      <div className="strategy-stats" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', fontSize: 9 }}><span><small className="muted">Indicative cost</small><br /><strong>{ind.cost}</strong></span><span><small className="muted">Delivery risk</small><br /><strong style={{ color: ind.risk === 'High' ? 'var(--red)' : undefined }}>{ind.risk}</strong></span><span><small className="muted">Timing</small><br /><strong>{ind.timing}</strong></span></div>
    </button>; })}</div>
    <div className="content-grid halves mt">
      <section className="card"><div className="card-header"><div><h2>Why this strategy?</h2><p>Rule engine reasoning — every fact is from the live data</p></div><Badge tone="info">Formula controlled</Badge></div>
        <div className="card-body stack"><div className="ai-box" style={{ borderLeftColor: '#2b2a28' }}><div className="ai-head"><Icon name="decision" size={14} />{a.ruleBucket}</div>{a.bucketReason}</div>
          <dl className="kv"><dt>Day-1 critical</dt><dd>{a.day1Critical ? 'Yes' : 'No'} ({a.timing})</dd><dt>Priority Index</dt><dd>{a.PI} = 0.35×C{a.C} + 0.25×D{a.D} + 0.20×R{a.R} + 0.20×S{a.S}</dd><dt>Entanglement</dt><dd>{a.entanglement} ({a.entBand})</dd><dt>Licence</dt><dd>{a.transferable}</dd><dt>Buyer uses / has similar</dt><dd>{a.buyerUses ? 'Yes' : 'No'} / {a.buyerHasSimilar ? 'Yes' : 'No'}</dd><dt>Go-live</dt><dd>{a.goLive}</dd></dl></div></section>
      <section className="card board-summary"><div className="card-header"><div><h2>AI recommendation</h2><p>AI weighs the same facts and explains — you decide</p></div><div className="row"><AIChip result={ai} /><Button variant="secondary" icon="spark" loading={busy} onClick={askAI}>{ai ? 'Ask again' : 'Ask AI'}</Button></div></div>
        <div className="card-body stack">{ai ? <div className="ai-box"><div className="ai-head"><Icon name="spark" size={14} />{ai.data.bucket}{ai.data.bucket !== a.ruleBucket && <Badge tone="warning">differs from rule</Badge>}</div>{ai.data.reason}</div> : <p className="muted small">Ask AI to review the app facts, owner answers and days left to Day-1.</p>}
          {current !== a.bucket || !approvedState || approvedState.chosen !== a.bucket ? <div className="row" style={{ justifyContent: 'flex-end' }}>
            {current !== a.ruleBucket ? <Button icon="edit" onClick={() => setOverrideReason('')}>Override to “{current}”</Button> : <Button icon="check" onClick={() => confirm(current)}>Confirm “{current}”</Button>}
            {a.overridden && <Button variant="ghost" onClick={() => { act('Reverted bucket override', `${a.name} back to ${a.ruleBucket}`, (d) => { d.appOverrides[a.id] = { ...d.appOverrides[a.id], bucket: undefined, bucketReason: undefined }; }, { kind: 'override' }); setSelected(null); }}>Revert to rule</Button>}
          </div> : <div className="approval-success row" style={{ color: 'var(--green)', fontSize: 11 }}><Icon name="check" /> Confirmed by {approvedState.approvedBy} and added to the decision log</div>}</div></section>
    </div>
    {overrideReason !== null && <Modal title={`Override ${a.name}`} subtitle={`Rule suggests ${a.ruleBucket}; you are choosing ${current}. Overrides are logged.`} onClose={() => setOverrideReason(null)} footer={<><Button variant="secondary" onClick={() => setOverrideReason(null)}>Cancel</Button><Button disabled={overrideReason.trim().length < 5} onClick={() => confirm(current, overrideReason)}>Log override</Button></>}>
      <label className="field">Reason for override<textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Vendor confirmed consent will not arrive before Day-1" /></label>
    </Modal>}
  </>;
}

function Classification() {
  const { s, m, act, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<{ res: AIResult<{ tags: { id: string; component: string; reason: string }[] }>; accept: Record<string, boolean> } | null>(null);
  const [filter, setFilter] = useState('all');
  const list = m.apps.filter((a) => filter === 'all' || (filter === 'critical' ? a.day1Critical : filter === 'overridden' ? a.overridden : a.bucket === filter)).sort((a, b) => b.PI - a.PI);
  const setOv = (id: string, patch: Record<string, any>, label: string) => act(label, `${m.byId.get(id)?.name}: ${JSON.stringify(patch)}`, (d) => { d.appOverrides[id] = { ...d.appOverrides[id], ...patch }; }, { kind: 'override' });
  const tagAll = async () => {
    setBusy(true);
    const r = await runAI(componentTag, { apps: m.apps.map((a) => ({ id: a.id, name: a.name, description: a.description, current: a.component })) });
    setBusy(false);
    setSugg({ res: r, accept: Object.fromEntries(r.data.tags.map((t) => [t.id, true])) });
  };
  const score = (id: string, k: 'C' | 'R' | 'S', v: number) => <select className="inline" value={v} onChange={(e) => setOv(id, { [k]: +e.target.value }, `Changed ${k} score`)}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>;
  return <section className="card table-card">
    <div className="table-tools">
      <div className="status-filters">{[['all', 'All'], ['critical', 'Day-1 critical'], ['overridden', 'Overridden'], ...BUCKETS.map((b) => [b, b])].map(([k, l]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}<span>{k === 'all' ? m.apps.length : k === 'critical' ? m.apps.filter((a) => a.day1Critical).length : k === 'overridden' ? m.apps.filter((a) => a.overridden).length : m.apps.filter((a) => a.bucket === k).length}</span></button>)}</div>
      <span style={{ marginLeft: 'auto' }} className="row"><Button variant="secondary" icon="download" onClick={() => download('classification.csv', toCSV(m.apps.map((a) => ({ id: a.id, name: a.name, component: a.component, C: a.C, D: a.D, R: a.R, S: a.S, PI: a.PI, timing: a.timing, critical_tool: a.criticalTool, revenue_linked: a.revenueLinked, entanglement: a.entanglement, bucket: a.bucket, reason: a.bucketReason, move_group: a.moveGroup }))))}>Export</Button><Button icon="spark" loading={busy} onClick={tagAll}>AI tag components</Button></span>
    </div>
    <p className="muted small" style={{ padding: '6px 14px', margin: 0 }}>Priority Index = {s.config.priorityWeights.C}C + {s.config.priorityWeights.D}D + {s.config.priorityWeights.R}R + {s.config.priorityWeights.S}S · D comes from the Entanglement Score · {s.config.day1Threshold}+ is Day-1 critical · critical tools and revenue-linked items are always Day-1 critical. Edit C/R/S to reflect owner input.</p>
    <div className="scroll-y" style={{ maxHeight: 640 }}><Table cols="1.7fr 1.3fr 45px 45px 45px 45px 55px 1.1fr 1.6fr 60px" head={['Application', 'Component', 'C', 'D', 'R', 'S', 'PI', 'Timing', 'Bucket', 'Group']}>
      {list.map((a) => <div className="tr" key={a.id}>
        <span><strong>{a.name}</strong><small>{a.id} · ent {a.entanglement}</small></span>
        <span><select className="inline" value={a.component} onChange={(e) => setOv(a.id, { component: e.target.value as Component, componentConfirmed: true }, 'Changed component')}>{COMPONENTS.map((c) => <option key={c}>{c}</option>)}</select>{a.componentSource === 'confirmed' && <small>confirmed</small>}</span>
        <span>{score(a.id, 'C', a.C)}</span><span title="From entanglement">{a.D}</span><span>{score(a.id, 'R', a.R)}</span><span>{score(a.id, 'S', a.S)}</span>
        <span><strong>{a.PI.toFixed(2)}</strong></span>
        <span><Badge tone={a.day1Critical ? 'danger' : a.timing === 'Day-1 + 30' ? 'warning' : 'neutral'}>{a.timing}</Badge>{a.flagged && <small>{a.criticalTool ? 'critical tool' : 'revenue-linked'}</small>}</span>
        <span>{a.bucket}{a.overridden && <small>overridden (rule: {a.ruleBucket})</small>}</span><span>{a.moveGroup}</span>
      </div>)}
    </Table></div>
    {sugg && <Modal wide title="AI component tags" subtitle="Accept the tags you agree with — the user confirms every AI suggestion." onClose={() => setSugg(null)} footer={<><AIChip result={sugg.res} /><Button variant="secondary" onClick={() => setSugg(null)}>Cancel</Button><Button onClick={() => { const acc = sugg.res.data.tags.filter((t) => sugg.accept[t.id]); act('Accepted AI component tags', `${acc.length} apps`, (d) => acc.forEach((t) => { d.appOverrides[t.id] = { ...d.appOverrides[t.id], component: t.component as Component, componentConfirmed: true }; }), { kind: 'approve' }); toast(`${acc.length} component tags confirmed`); setSugg(null); }}>Accept selected</Button></>}>
      <Table cols="30px 1.5fr 1.2fr 1.2fr 2fr" head={['', 'App', 'Current', 'AI tag', 'Reason']}>{sugg.res.data.tags.map((t) => { const a = m.byId.get(t.id)!; return <div className="tr" key={t.id}><span><input type="checkbox" checked={!!sugg.accept[t.id]} onChange={(e) => setSugg({ ...sugg, accept: { ...sugg.accept, [t.id]: e.target.checked } })} /></span><span>{a.name}</span><span>{a.component}</span><span>{t.component !== a.component ? <Badge tone="warning">{t.component}</Badge> : t.component}</span><span className="muted small">{t.reason}</span></div>; })}</Table>
    </Modal>}
  </section>;
}

function LeadershipOptions() {
  const { s, m, act, toast, params } = useStore();
  const [decId, setDecId] = useState(params.decision ?? m.decisions[0]?.id);
  const d = m.decisions.find((x) => x.id === decId) ?? m.decisions[0];
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AIResult<{ summary: string }> | null>(null);
  const [changes, setChanges] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const summary = res?.data.summary ?? d?.state.summary;
  const genSummary = async () => {
    if (!d) return;
    setBusy(true);
    const r = await runAI(boardSummary, { decision: d.title, approver: d.approver, options: d.options.map((o) => ({ name: o.name, security: o.security, productivity: o.productivity, cost: o.cost, speed: o.speed, total: o.total, removed: o.removed })), recommended: d.recommended?.name, context: d.id === 'DEC-01' && m.criticalBlocked.length ? `subject to vendor consent by ${fmtDate(m.criticalBlocked[0].blockers[0]?.due_date)}` : undefined });
    setRes(r); setBusy(false);
    act('AI drafted board summary', `${d.title} · ${r.source === 'gemini' ? r.model : 'fallback'}`, (x) => { x.decisions[d.id] = { ...(x.decisions[d.id] ?? { status: 'pending' }), summary: r.data.summary, summarySource: r.source === 'gemini' ? `Gemini · ${r.model}` : 'Rule-based fallback' }; }, { kind: 'ai', skipIssues: true });
  };
  const setScore = (rid: string, field: string, v: number) => act('Edited option score', `${d!.title}: ${field} = ${v}`, (x) => { const r = x.datasets.decisions!.rows.find((y) => y._rid === rid); if (r) r[field] = v; }, { kind: 'override', skipIssues: true });
  if (!d) return <Empty title="No leadership decisions loaded">Upload 17_Decision_Options.csv.</Empty>;
  const ow = s.config.optionWeights;
  return <div className="content-grid" style={{ gridTemplateColumns: '260px 1fr' }}>
    <section className="card"><div className="card-header"><div><h2>Decisions</h2><p>{m.decisions.length} open trade-offs</p></div></div>
      {m.decisions.map((x) => <button key={x.id} onClick={() => { setDecId(x.id); setRes(null); }} style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', textAlign: 'left', padding: '11px 14px', border: 0, borderBottom: '1px solid #eee', background: x.id === d.id ? '#fff8f4' : '#fff', boxShadow: x.id === d.id ? 'inset 3px 0 var(--orange)' : undefined, fontSize: 10 }}><strong>{x.title}</strong><span className="muted small">{x.approver} · due {fmtDate(x.due)}</span><Badge tone={x.state.status === 'approved' ? 'success' : x.state.status === 'changes_requested' ? 'warning' : 'info'}>{x.state.status.replace('_', ' ')}</Badge></button>)}
    </section>
    <div className="stack" style={{ gap: 14 }}>
      <section className="card">
        <div className="card-header"><div><h2>Options assessment · {d.title}</h2><p>Weighted score after mandatory security screening (security below {s.config.securityFloor} is removed)</p></div><div className="row"><Badge tone="info">Formula controlled</Badge><Button variant="ghost" icon="edit" onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : 'Edit scores'}</Button></div></div>
        <Table cols="1.8fr repeat(4, .8fr) .8fr" head={['Option', `Security ${ow.security * 100}%`, `Productivity ${ow.productivity * 100}%`, `Cost ${ow.cost * 100}%`, `Speed ${ow.speed * 100}%`, 'Total']}>
          {[...d.options].sort((a, b) => (b.total ?? -1) - (a.total ?? -1)).map((o) => <div className={`tr ${o.removed ? 'muted-row' : ''}`} key={o.code}>
            <span><strong>{o.code}. {o.name}</strong>{d.recommended?.code === o.code ? <small style={{ color: 'var(--orange-dark)' }}>Recommended</small> : o.removed ? <Badge tone="danger">Removed — security {o.security}</Badge> : null}</span>
            {(['security', 'productivity', 'cost', 'speed'] as const).map((k) => <span key={k}>{editing ? <select className="inline" value={o[k]} onChange={(e) => setScore(o.row._rid, k, +e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select> : o[k].toFixed(1)}</span>)}
            <strong>{o.total?.toFixed(2) ?? '—'}</strong>
          </div>)}
        </Table>
      </section>
      <section className="card board-summary">
        <div className="card-header"><div><h2>Board summary</h2><p>AI drafted · review required · {d.state.summarySource ?? (res ? (res.source === 'gemini' ? `Gemini · ${res.model}` : 'Rule-based fallback') : 'not generated')}</p></div><div className="row"><AIChip result={res} /><Button variant="secondary" icon="spark" loading={busy} onClick={genSummary}>{summary ? 'Regenerate' : 'Draft with AI'}</Button></div></div>
        <div className="card-body stack">
          {summary ? <blockquote style={{ margin: 0, borderLeft: '3px solid var(--orange)', padding: '8px 14px', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fbf8f4' }}>{summary}</blockquote> : <p className="muted small">Draft a 4-line board note explaining the trade-off. The recommendation comes from the formula; AI explains it.</p>}
          <div className="source-line muted small row"><Icon name="shield" size={13} /> Based on approved assessment criteria and live deal data</div>
          {d.state.status === 'approved' ? <div className="row" style={{ color: 'var(--green)', fontSize: 11 }}><Icon name="check" /> Approved by {d.state.approvedBy} on {new Date(d.state.approvedAt!).toLocaleDateString('en-GB')} — {d.state.chosen}<Button variant="ghost" onClick={() => act('Re-opened decision', d.title, (x) => { x.decisions[d.id] = { ...x.decisions[d.id], status: 'pending' }; }, { kind: 'override', skipIssues: true })}>Re-open</Button></div>
            : <div className="row" style={{ justifyContent: 'flex-end' }}>{d.state.status === 'changes_requested' && <Badge tone="warning">Changes requested: {d.state.comment}</Badge>}<Button variant="secondary" onClick={() => setChanges('')}>Request changes</Button><Button icon="check" disabled={!d.recommended} onClick={() => { act('Approved leadership decision', `${d.title}: ${d.recommended!.name} (${d.recommended!.total})`, (x) => { x.decisions[d.id] = { ...x.decisions[d.id], status: 'approved', chosen: d.recommended!.name, approvedAt: new Date().toISOString(), approvedBy: x.currentUser, summary: summary ?? x.decisions[d.id]?.summary }; if (d.id === 'DEC-01') { const t = x.datasets.tasks?.rows.find((y) => /laptop migration option/i.test(y.title)); if (t) t.status = 'Done'; } }, { kind: 'approve', skipIssues: true }); toast('Approved and added to decision log'); }}>Approve recommendation</Button></div>}
        </div>
      </section>
    </div>
    {changes !== null && <Modal title="Request changes" subtitle={d.title} onClose={() => setChanges(null)} footer={<><Button variant="secondary" onClick={() => setChanges(null)}>Cancel</Button><Button disabled={!changes.trim()} onClick={() => { act('Requested changes on decision', `${d.title}: ${changes}`, (x) => { x.decisions[d.id] = { ...x.decisions[d.id], status: 'changes_requested', comment: changes }; }, { kind: 'override', skipIssues: true }); toast('Change request logged', 'info'); setChanges(null); }}>Send</Button></>}>
      <label className="field">What needs to change?<textarea value={changes} onChange={(e) => setChanges(e.target.value)} /></label>
    </Modal>}
  </div>;
}

function DecisionLog() {
  const { s } = useStore();
  const rows = useMemo(() => s.audit.filter((a) => a.kind === 'approve' || a.kind === 'override'), [s.audit]);
  return <section className="card">
    <div className="card-header"><div><h2>Decision log</h2><p>Every approval and override with who, when and why</p></div><Button variant="secondary" icon="download" onClick={() => download('decision_log.csv', toCSV(rows.map((r) => ({ time: r.ts, actor: r.actor, action: r.action, detail: r.detail, kind: r.kind }))))}>Export</Button></div>
    {rows.length ? <Table cols="140px 130px 1.4fr 2.6fr 90px" head={['When', 'Who', 'Action', 'Detail', 'Type']}>{rows.map((r) => <div className="tr" key={r.id}><span>{new Date(r.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>{r.actor}</span><span><strong>{r.action}</strong></span><span className="muted">{r.detail}</span><span><Badge tone={r.kind === 'approve' ? 'success' : 'warning'}>{r.kind}</Badge></span></div>)}</Table> : <Empty title="No decisions logged yet" />}
  </section>;
}
