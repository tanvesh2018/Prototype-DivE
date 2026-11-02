import { useMemo, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { bucketAdvice, componentTag } from '../ai/tasks';
import { AIChip, Badge, Button, Empty, Icon, Modal, PageTitle, Progress, SearchBox, Table, Tabs, type IconName } from '../components/ui';
import { DecisionLog } from '../components/DecisionLog';
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
  const { params, m } = useStore();
  const [tab, setTab] = useState(params.tab === 'options' ? 'strategy' : params.tab ?? 'strategy');
  return <>
    <PageTitle eyebrow="Classify & decide" title="Separation Decisions" description="Classify every app in plain terms, compare six evidence-based strategies and record accountable decisions." action={<Button variant="secondary" icon="file" onClick={() => setTab('log')}>Decision log</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'strategy', label: 'App strategy' }, { key: 'classify', label: 'Classification (all apps)', count: m.apps.length }, { key: 'log', label: 'Decision log' }]} />
    {tab === 'strategy' && <AppStrategy />}
    {tab === 'classify' && <Classification />}
    {tab === 'log' && <DecisionLog modules={['Separation Decisions']} title="Separation decisions" subtitle="Strategy confirmations, overrides and classification changes — undo any of them" />}
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
        <p className="muted small" style={{ margin: 0 }}>{a.component} · Entanglement {a.entanglement} · {a.users} users · {a.site || '—'} · Priority score {a.PI.toFixed(2)}</p></div></div>
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
          <dl className="kv"><dt>Day-1 critical</dt><dd>{a.day1Critical ? 'Yes' : 'No'} ({a.timing})</dd><dt>Priority score</dt><dd>{a.PI.toFixed(2)} — criticality {a.C}, seller dependency {a.D}, regulatory {a.R}, security {a.S} (out of 5)</dd><dt>Entanglement</dt><dd>{a.entanglement} ({a.entBand})</dd><dt>Licence</dt><dd>{a.transferable}</dd><dt>Buyer uses / has similar</dt><dd>{a.buyerUses ? 'Yes' : 'No'} / {a.buyerHasSimilar ? 'Yes' : 'No'}</dd><dt>Go-live</dt><dd>{a.goLive}</dd></dl></div></section>
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

const SCALE: Record<'C' | 'R' | 'S', string[]> = {
  C: ['', 'Nice to have', 'Some teams slowed', 'Key team impacted', 'Major function stops', 'Business stops'],
  R: ['', 'No regulation', 'Light reporting', 'Audit relevant', 'Regulated process', 'Licence / regulator at risk'],
  S: ['', 'Public data', 'Internal data', 'Confidential data', 'Customer / personal data', 'Payment or crown-jewel data'],
};
const D_SCALE = ['', 'Barely tied to seller (0–2)', 'Lightly tied (3–5)', 'Moderately tied (6–8)', 'Heavily tied (9–12)', 'Deeply entangled (13+)'];

function PriorityExplainer({ w, threshold }: { w: { C: number; D: number; R: number; S: number }; threshold: number }) {
  return <div className="grid-2 card-body" style={{ gap: 14 }}>
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small">Four questions we ask about every app (each scored 1–5)</strong>
      <table className="calc-table"><thead><tr><th>Letter</th><th>Plain question</th><th>Who scores it</th><th>Weight</th></tr></thead><tbody>
        <tr><td><b>C</b> · Business criticality</td><td>If this app is down on Day-1, how badly does the business stop?</td><td>App owner</td><td>{Math.round(w.C * 100)}%</td></tr>
        <tr><td><b>D</b> · Seller dependency</td><td>How tied is it to things the seller keeps (servers, network, licences)?</td><td>Automatic — from the Entanglement score</td><td>{Math.round(w.D * 100)}%</td></tr>
        <tr><td><b>R</b> · Regulatory risk</td><td>Would a regulator, auditor or licence be at risk if it fails?</td><td>App owner / compliance</td><td>{Math.round(w.R * 100)}%</td></tr>
        <tr><td><b>S</b> · Security risk</td><td>How sensitive is the data it holds?</td><td>App owner / CISO</td><td>{Math.round(w.S * 100)}%</td></tr>
      </tbody></table>
    </div>
    <div className="stack" style={{ gap: 6 }}>
      <strong className="small">How the Priority score decides timing</strong>
      <p className="small" style={{ margin: 0 }}><b>Priority score</b> = {Math.round(w.C * 100)}% × C + {Math.round(w.D * 100)}% × D + {Math.round(w.R * 100)}% × R + {Math.round(w.S * 100)}% × S (a number between 1 and 5).</p>
      <table className="calc-table"><tbody>
        <tr><td><Badge tone="danger">Day-1 critical</Badge></td><td>Score ≥ {threshold}, <b>or</b> flagged as a critical tool / revenue-linked — must work on Day-1</td></tr>
        <tr><td><Badge tone="warning">Day-1 + 30</Badge></td><td>Score {(threshold - 0.75).toFixed(2)}–{threshold} — needed within the first month</td></tr>
        <tr><td><Badge>Post-TSA</Badge></td><td>Lower scores — can move later under the TSA</td></tr>
      </tbody></table>
      <p className="muted small" style={{ margin: 0 }}>Change C, R or S in the table below if the owner disagrees — the score, timing and recommended strategy update instantly, and the change is logged with undo.</p>
    </div>
  </div>;
}

function Classification() {
  const { s, m, act, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<{ res: AIResult<{ tags: { id: string; component: string; reason: string }[] }>; accept: Record<string, boolean> } | null>(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [why, setWhy] = useState<string | null>(null);
  const [n, setN] = useState(60);
  const w = s.config.priorityWeights;
  const list = m.apps.filter((a) => (filter === 'all' || (filter === 'critical' ? a.day1Critical : filter === 'overridden' ? a.overridden : a.bucket === filter)) && (!q || `${a.id} ${a.name}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.PI - a.PI);
  const setOv = (id: string, patch: Record<string, any>, label: string) => act(label, `${m.byId.get(id)?.name}: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`, (d) => { d.appOverrides[id] = { ...d.appOverrides[id], ...patch }; }, { kind: 'override' });
  const tagAll = async () => {
    setBusy(true);
    const r = await runAI(componentTag, { apps: m.apps.slice(0, 120).map((a) => ({ id: a.id, name: a.name, description: a.description, current: a.component })) });
    setBusy(false);
    setSugg({ res: r, accept: Object.fromEntries(r.data.tags.map((t) => [t.id, true])) });
  };
  const score = (id: string, k: 'C' | 'R' | 'S', v: number) => <select className="inline" title={SCALE[k][v]} value={v} onChange={(e) => setOv(id, { [k]: +e.target.value }, `Changed ${k === 'C' ? 'business criticality' : k === 'R' ? 'regulatory risk' : 'security risk'}`)}>{[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x} – {SCALE[k][x]}</option>)}</select>;
  const sel = why ? m.byId.get(why) : undefined;
  return <>
    <section className="card mb"><div className="card-header"><div><h2>How we prioritise apps — in plain words</h2><p>Every app gets four 1–5 scores. Together they give a Priority score that decides when it must be ready.</p></div></div><PriorityExplainer w={w} threshold={s.config.day1Threshold} /></section>
    <section className="card table-card">
    <div className="table-tools">
      <div className="status-filters">{[['all', 'All'], ['critical', 'Day-1 critical'], ['overridden', 'Overridden'], ...BUCKETS.map((b) => [b, b])].map(([k, l]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}<span>{k === 'all' ? m.apps.length : k === 'critical' ? m.apps.filter((a) => a.day1Critical).length : k === 'overridden' ? m.apps.filter((a) => a.overridden).length : m.apps.filter((a) => a.bucket === k).length}</span></button>)}</div>
      <SearchBox value={q} onChange={setQ} placeholder="Search apps…" />
      <span style={{ marginLeft: 'auto' }} className="row"><Button variant="secondary" icon="download" onClick={() => download('classification.csv', toCSV(m.apps.map((a) => ({ id: a.id, name: a.name, component: a.component, business_criticality_C: a.C, seller_dependency_D: a.D, regulatory_risk_R: a.R, security_risk_S: a.S, priority_score: a.PI, timing: a.timing, critical_tool: a.criticalTool, revenue_linked: a.revenueLinked, entanglement: a.entanglement, bucket: a.bucket, reason: a.bucketReason, move_group: a.moveGroup }))))}>Export</Button><Button icon="spark" loading={busy} onClick={tagAll}>AI tag components</Button></span>
    </div>
    <div className="scroll-y scroll-both" style={{ maxHeight: 640 }}><Table className="class-table" style={{ minWidth: 1180 }} cols="minmax(170px,1.6fr) minmax(120px,1.1fr) minmax(140px,1.25fr) minmax(90px,.9fr) minmax(140px,1.25fr) minmax(150px,1.3fr) 80px minmax(100px,.9fr) minmax(140px,1.3fr)" head={[<>Application</>, 'Component', <>Business criticality (C)</>, <>Seller dependency (D)</>, <>Regulatory risk (R)</>, <>Security risk (S)</>, 'Priority score', 'Timing', 'Strategy']}>
      {list.slice(0, n).map((a) => <div className={`tr ${why === a.id ? 'selected' : ''}`} key={a.id}>
        <span><strong>{a.name}</strong><small>{a.id} · <button className="text-action" style={{ fontSize: 8 }} onClick={() => setWhy(why === a.id ? null : a.id)}>{why === a.id ? 'hide why' : 'why this priority?'}</button></small></span>
        <span><select className="inline" value={a.component} onChange={(e) => setOv(a.id, { component: e.target.value as Component, componentConfirmed: true }, 'Changed component')}>{COMPONENTS.map((c) => <option key={c}>{c}</option>)}</select>{a.componentSource === 'confirmed' && <small>confirmed</small>}</span>
        <span>{score(a.id, 'C', a.C)}</span>
        <span title="Calculated from the Entanglement score — change links in the Dependency Explorer"><strong>{a.D}</strong><small>{D_SCALE[a.D]}</small></span>
        <span>{score(a.id, 'R', a.R)}</span><span>{score(a.id, 'S', a.S)}</span>
        <span><strong>{a.PI.toFixed(2)}</strong><Progress value={(a.PI / 5) * 100} tone={a.day1Critical ? 'red' : a.timing === 'Day-1 + 30' ? 'amber' : 'charcoal'} /></span>
        <span><Badge tone={a.day1Critical ? 'danger' : a.timing === 'Day-1 + 30' ? 'warning' : 'neutral'}>{a.timing}</Badge>{a.flagged && <small>{a.criticalTool ? 'critical tool' : 'revenue-linked'}</small>}</span>
        <span>{a.bucket}{a.overridden && <small>overridden (rule: {a.ruleBucket})</small>}</span>
      </div>)}
    </Table></div>
    {list.length > n && <div className="table-footer"><span>Showing {n} of {list.length}</span><Button variant="secondary" onClick={() => setN(n + 100)}>Show more</Button></div>}
    {sel && <div className="ai-box" style={{ margin: 14 }}><div className="ai-head"><Icon name="decision" size={14} />Why {sel.name} has a Priority score of {sel.PI.toFixed(2)}</div>
      {Math.round(w.C * 100)}% × C {sel.C} ({SCALE.C[sel.C]}) + {Math.round(w.D * 100)}% × D {sel.D} ({D_SCALE[sel.D]}, entanglement {sel.entanglement}) + {Math.round(w.R * 100)}% × R {sel.R} ({SCALE.R[sel.R]}) + {Math.round(w.S * 100)}% × S {sel.S} ({SCALE.S[sel.S]}) = <b>{sel.PI.toFixed(2)}</b>.{'\n'}
      {sel.PI >= s.config.day1Threshold ? `That is at or above ${s.config.day1Threshold}, so it is Day-1 critical.` : sel.flagged ? `Below ${s.config.day1Threshold}, but it is flagged as ${sel.criticalTool ? 'a critical tool' : 'revenue-linked'}, so it is always Day-1 critical.` : `Below ${s.config.day1Threshold}, so it is ${sel.timing}.`} Strategy: {sel.bucketReason}</div>}
    {sugg && <Modal wide title="AI component tags" subtitle="Accept the tags you agree with — the user confirms every AI suggestion." onClose={() => setSugg(null)} footer={<><AIChip result={sugg.res} /><Button variant="secondary" onClick={() => setSugg(null)}>Cancel</Button><Button onClick={() => { const acc = sugg.res.data.tags.filter((t) => sugg.accept[t.id]); act('Accepted AI component tags', `${acc.length} apps`, (d) => acc.forEach((t) => { d.appOverrides[t.id] = { ...d.appOverrides[t.id], component: t.component as Component, componentConfirmed: true }; }), { kind: 'approve' }); toast(`${acc.length} component tags confirmed`); setSugg(null); }}>Accept selected</Button></>}>
      <Table cols="30px 1.5fr 1.2fr 1.2fr 2fr" head={['', 'App', 'Current', 'AI tag', 'Reason']}>{sugg.res.data.tags.map((t) => { const a = m.byId.get(t.id)!; return <div className="tr" key={t.id}><span><input type="checkbox" checked={!!sugg.accept[t.id]} onChange={(e) => setSugg({ ...sugg, accept: { ...sugg.accept, [t.id]: e.target.checked } })} /></span><span>{a.name}</span><span>{a.component}</span><span>{t.component !== a.component ? <Badge tone="warning">{t.component}</Badge> : t.component}</span><span className="muted small">{t.reason}</span></div>; })}</Table>
    </Modal>}
  </section></>;
}
