import { useEffect, useState } from 'react';
import { getAIStatus, onAIStatus, refreshAIStatus, testAIConnection } from '../ai/client';
import { Badge, Button, Icon, Modal, PageTitle, SearchBox, Table, Toggle } from '../components/ui';
import { DecisionLog } from '../components/DecisionLog';
import type { AuditEvent, Config, RoleKey, WorkspaceState } from '../engine/types';
import { download, toCSV } from '../engine/util';
import { DEFAULT_CONFIG, ROLES } from '../engine/workspace';
import { blankWorkspace, resetToDemo, useStore } from '../state/store';
import { resetSavedData } from '../components/ErrorBoundary';

export function Governance() {
  const { s, act, toast, replaceWorkspace, readOnly, params } = useStore();
  const [access, setAccess] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [auditAll, setAuditAll] = useState(false);
  const [detail, setDetail] = useState<AuditEvent | null>(null);
  const [ai, setAi] = useState(getAIStatus());
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [deletePreview, setDeletePreview] = useState(false);
  useEffect(() => { refreshAIStatus(); return onAIStatus(setAi); }, []);
  useEffect(() => { if (params.tab === 'deal') document.getElementById('deal-settings')?.scrollIntoView({ behavior: 'smooth' }); }, [params.tab]);

  const controls = [
    ['Role-based access', true], ['Personal data masked at upload', s.controls.maskPII], ['Human approval for AI', s.controls.humanApproval], ['No cross-deal model training', !s.controls.crossDealTraining],
    ['Consent registry maintained', Object.keys(s.consents).length > 0], ['Retention policy set', !!s.retention], ['Approved AI boundary', true], ['Audit log active', true],
  ] as const;
  const passed = controls.filter((c) => c[1]).length;
  const cycle = (k: string) => {
    const order = ['Granted', 'Pending', 'Not granted'] as const;
    const next = order[(order.indexOf(s.consents[k] as any) + 1) % 3];
    act('Changed consent', `${k}: ${s.consents[k]} → ${next}`, (d) => { d.consents[k] = next; }, { kind: 'access', skipIssues: true });
  };
  const toggle = (k: keyof WorkspaceState['controls'], label: string) => act('Changed data & AI control', `${label}: ${s.controls[k] ? 'on → off' : 'off → on'}`, (d) => { d.controls[k] = !d.controls[k]; }, { kind: 'access', skipIssues: true });
  const exportAudit = () => { download('dealsync_audit_log.csv', toCSV(s.audit.map((a) => ({ time: a.ts, actor: a.actor, action: a.action, detail: a.detail, type: a.kind })))); toast('Audit report exported'); };
  const test = async () => { setTesting(true); setTestMsg(await testAIConnection()); setTesting(false); };

  return <>
    <PageTitle eyebrow="Control & assure" title="Governance & Settings" description={`Access, consent, auditability, AI and retention controls for ${s.deal.name}.`} action={<><Button variant="secondary" icon="refresh" onClick={() => setFresh(true)} title="Wipe all demo changes and start the app from the beginning">Fresh demo</Button><Button variant="secondary" icon="download" onClick={exportAudit}>Export audit report</Button></>} />
    {fresh && <Modal title="Start a fresh demo?" subtitle="Puts the whole app back exactly as it was on first start" onClose={() => !resetting && setFresh(false)}
      footer={<><Button variant="secondary" disabled={resetting} onClick={() => setFresh(false)}>Cancel</Button><Button icon="refresh" loading={resetting} onClick={() => { setResetting(true); void resetSavedData(); }}>Reset everything</Button></>}>
      <div className="stack small">
        <p style={{ margin: 0 }}>This clears every change made in this browser, for <b>both</b> deals:</p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Project Rioja and Project Phoenix go back to their original demo data</li>
          <li>All decisions, approvals, uploads, funding steps, consents, AI drafts and Copilot chats are removed</li>
          <li>The decision log and audit trail start again</li>
          <li>You start as <b>Alex Chen</b> on <b>Project Rioja</b>, Deal Overview</li>
        </ul>
        <p className="muted" style={{ margin: 0 }}>Your Gemini key and the project files are not affected. This can’t be undone.</p>
      </div>
    </Modal>}
    <div className="governance-banner" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', marginBottom: 14, background: passed === 8 ? '#20392d' : '#3d2f12', borderLeftColor: passed === 8 ? '#6fbd90' : 'var(--amber)' }}><Icon name="shield" /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}><strong style={{ fontSize: 11 }}>Control posture: {passed === 8 ? 'Healthy' : 'Attention needed'}</strong><span>{passed === 8 ? 'All required access, AI, consent and retention controls are active.' : `Failing: ${controls.filter((c) => !c[1]).map((c) => c[0]).join(', ')}`}</span></div><Badge tone={passed === 8 ? 'success' : 'warning'}>{passed} / 8 controls passed</Badge></div>

    <section className="card mb" style={{ borderTop: '3px solid var(--orange)' }}>
      <div className="card-header"><div><h2>AI engine (Gemini)</h2><p>One central gateway serves every AI feature — column matching, gap filling, hidden links, buckets, board notes, SPA reading, early warnings, readiness path, learning records, funding advice and the Copilot</p></div><div className="row">{ai.configured ? <Badge tone="success">Connected · {ai.model}</Badge> : <Badge tone="warning">No key — rule-based fallback active</Badge>}<Button variant="secondary" icon="refresh" loading={testing} onClick={test}>Test connection</Button></div></div>
      <div className="card-body grid-2">
        <div className="stack small"><strong>Where the API key goes</strong><ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}><li>Get a free key at <b>aistudio.google.com/apikey</b></li><li>Open <code>.env.local</code> in the project root (copy of <code>.env.example</code>)</li><li>Set <code>GEMINI_API_KEY=your-key</code> and save — no restart needed</li><li>Click <b>Test connection</b></li></ol><span className="muted">The key stays on your machine: the browser calls <code>/api/ai/*</code> and the local server (server/aiPlugin.ts) forwards to Gemini. Optional: <code>GEMINI_MODEL=gemini-2.5-flash</code>.</span></div>
        <div className="stack small"><dl className="kv"><dt>Status</dt><dd>{ai.configured ? `Key loaded (${ai.keyHint})` : 'Not configured'}</dd><dt>Model</dt><dd>{ai.model}</dd><dt>Key file</dt><dd>{ai.keyFile}</dd><dt>Fallback</dt><dd>Deterministic rules (always on)</dd><dt>Data boundary</dt><dd>Only the fields a task needs are sent; nothing is stored by DealSync</dd></dl>{testMsg && <div className="ai-box" style={{ borderLeftColor: testMsg.ok ? 'var(--green)' : 'var(--red)' }}>{testMsg.message}</div>}</div>
      </div>
    </section>

    <div className="governance-grid">
      <section className="card"><div className="card-header"><div><h2>Role-based access</h2><p>Users only see the data required for their role — try “View as” in the profile menu</p></div><Button variant="secondary" onClick={() => setAccess(true)}>Manage access</Button></div>
        <div className="role-list">{(Object.keys(ROLES) as RoleKey[]).map((r, i) => <div key={r}><span className={`role-icon r${i}`}><Icon name={r === 'bank' ? 'funding' : 'users'} /></span><div><strong>{ROLES[r].label}</strong><span>{ROLES[r].description}{ROLES[r].readOnly ? ' · read-only' : ''}</span></div><Badge tone="neutral">{s.users.filter((u) => u.role === r).length} users</Badge></div>)}</div></section>
      <section className="card"><div className="card-header"><div><h2>Consent registry</h2><p>Purpose-specific client permissions · click a status to change it</p></div></div>
        <div className="consent-list">{Object.entries(s.consents).map(([k, v]) => <div key={k}><span className={v === 'Granted' ? 'ok' : v === 'Pending' ? 'pending' : 'off'}><Icon name={v === 'Granted' ? 'check' : v === 'Pending' ? 'clock' : 'lock'} /></span><div><strong>{k}</strong><span>{k === 'Bank funding summary' ? 'Readiness score, cost split and financial summary only' : k === 'Anonymised learning record' ? 'Required before a Learning Record is saved' : k === 'Benchmark contribution' ? 'Include in anonymised benchmarks' : 'External marketing use'}</span></div><button style={{ border: 0, background: 'transparent' }} disabled={readOnly} onClick={() => cycle(k)}><Badge tone={v === 'Granted' ? 'success' : v === 'Pending' ? 'warning' : 'neutral'}>{v}</Badge></button></div>)}</div></section>
      <section className="card"><div className="card-header"><div><h2>Data & AI controls</h2><p>Approved processing boundaries</p></div></div>
        <div className="setting-list">{([['maskPII', 'Mask personal data on upload', 'Names and emails replaced with counts and roles'], ['humanApproval', 'Require human approval for AI', 'Suggestions never modify source records automatically'], ['crossDealTraining', 'Allow cross-deal model training', 'Disabled by policy']] as const).map(([k, a, b]) => <div key={k}><div><strong>{a}</strong><span>{b}</span></div><Toggle on={s.controls[k]} label={a} onClick={() => toggle(k, a)} /></div>)}</div>
        <div className="approved-ai row" style={{ padding: 14, fontSize: 10 }}><Icon name="shield" /><div><strong>Approved AI boundary</strong><div className="muted">Deal data is processed only in approved services with no retention or training.</div></div></div></section>
      <section className="card"><div className="card-header"><div><h2>Retention policy</h2><p>Raw deal data lifecycle</p></div><Button variant="ghost" onClick={() => setDeletePreview(true)}>Preview deletion</Button></div>
        <div className="card-body stack"><label className="field">Delete raw client data<select value={s.retention} disabled={readOnly} onChange={(e) => act('Changed retention policy', e.target.value, (d) => { d.retention = e.target.value; }, { kind: 'access', skipIssues: true })}><option>At deal close</option><option>90 days after TSA exit</option><option>180 days after TSA exit</option></select></label>
          <div className="retention-steps"><div className="lesson-card"><strong>1. Upload & process</strong><span className="muted">Personal data minimised</span></div><div className="lesson-card" style={{ borderColor: 'var(--orange)' }}><strong>2. Active deal + TSA</strong><span className="muted">Encrypted, access controlled</span></div><div className="lesson-card"><strong>3. Secure deletion</strong><span className="muted">{s.retention}</span></div></div></div></section>
    </div>

    <div className="governance-grid mt">
      <ScoringConfig />
      <DealSettings />
    </div>

    <section className="card mt"><div className="card-header"><div><h2>Workspace data · {s.deal.name}</h2><p>Each deal is stored separately in your browser (IndexedDB). Reset any time — other deals are not affected.</p></div></div>
      <div className="card-body row wrap">
        <Button variant="secondary" icon="refresh" onClick={() => { if (confirm(`Reset ${s.deal.name} to its demo data? Your changes to this deal will be lost.`)) { resetToDemo(s.deal.id).then((w) => { replaceWorkspace(w, 'Reset to demo data'); toast('Demo workspace restored'); }); } }}>Reset to demo data</Button>
        <Button variant="secondary" icon="trash" onClick={() => { if (confirm('Start with an empty workspace? You can then upload the sample files one by one.')) { replaceWorkspace(blankWorkspace(s.deal.id), 'Started empty workspace'); toast('Empty workspace — upload files in Data & Inventory', 'info'); } }}>Start empty (upload from scratch)</Button>
        <Button variant="secondary" icon="download" onClick={() => download(`dealsync_workspace_${s.deal.asOf}.json`, JSON.stringify(s), 'application/json')}>Export workspace JSON</Button>
        <label className="btn secondary" style={{ cursor: 'pointer' }}><Icon name="upload" size={14} />Import workspace JSON<input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0]?.text().then((t) => { try { const w = JSON.parse(t); if (!w.deal || !w.datasets) throw new Error('not a DealSync workspace'); replaceWorkspace(w, 'Imported workspace'); toast('Workspace imported'); } catch (err: any) { toast(`Import failed: ${err.message}`, 'danger'); } })} /></label>
      </div></section>

    <div className="mt"><DecisionLog title="Decision log — all screens" subtitle={`Every decision on ${s.deal.name}, with undo. Uploads, AI drafts and access changes are in the audit log below.`} limit={100} /></div>

    <section className="card audit-card"><div className="card-header"><div><h2>Recent audit activity</h2><p>Immutable record of access, approvals, AI use and overrides</p></div><button className="text-action" onClick={() => setAuditAll(true)}>View all {s.audit.length} events <Icon name="arrow" size={14} /></button></div>
      <div className="audit-list">{s.audit.slice(0, 6).map((a) => <div key={a.id}><span className={`audit-dot ${a.kind === 'override' || a.kind === 'escalate' ? 'a3' : a.kind === 'system' ? 'a2' : ''}`}><Icon name={a.kind === 'ai' ? 'spark' : a.kind === 'override' ? 'alert' : a.kind === 'system' ? 'readiness' : 'check'} size={13} /></span><time>{new Date(a.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time><div><strong>{a.action}</strong><span>{a.actor} · {a.detail}</span></div><button onClick={() => setDetail(a)}>View details</button></div>)}</div></section>

    {access && <ManageAccess onClose={() => setAccess(false)} />}
    {auditAll && <AuditModal onClose={() => setAuditAll(false)} onExport={exportAudit} />}
    {detail && <Modal title={detail.action} subtitle={new Date(detail.ts).toLocaleString('en-GB')} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>}><dl className="kv"><dt>Actor</dt><dd>{detail.actor}</dd><dt>Type</dt><dd>{detail.kind}</dd><dt>Detail</dt><dd>{detail.detail || '—'}</dd><dt>Event ID</dt><dd>{detail.id}</dd></dl></Modal>}
    {deletePreview && <Modal title="Deletion preview" subtitle={`Policy: ${s.retention}`} onClose={() => setDeletePreview(false)} footer={<Button onClick={() => setDeletePreview(false)}>Close</Button>}>
      <p className="small">At the retention date these raw client files would be securely deleted. Consented, anonymised Learning Records are kept.</p>
      <Table cols="2fr 1fr 1fr" head={['File', 'Records', 'Action']}>{Object.values(s.datasets).map((d) => d && <div className="tr" key={d.key}><span>{d.fileName}</span><span>{d.rows.length}</span><span><Badge tone={d.key === 'learning' ? 'success' : 'danger'}>{d.key === 'learning' ? 'Keep (anonymised)' : 'Delete'}</Badge></span></div>)}</Table>
    </Modal>}
  </>;
}

function ManageAccess({ onClose }: { onClose: () => void }) {
  const { s, act, toast } = useStore();
  const [nu, setNu] = useState({ name: '', title: '', role: 'pwc_consultant' as RoleKey });
  return <Modal wide title="Manage access" subtitle="Each user sees only their own deal and what their role needs" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
    <Table cols="1.4fr 1.4fr 1.6fr 80px" head={['User', 'Title', 'Role', '']}>{s.users.map((u) => <div className="tr" key={u.name}><span><strong>{u.name}</strong></span><span>{u.title}</span><span><select className="inline" value={u.role} onChange={(e) => act('Changed user role', `${u.name} → ${ROLES[e.target.value].label}`, (d) => { d.users.find((x) => x.name === u.name)!.role = e.target.value as RoleKey; if (d.currentUser === u.name) d.role = e.target.value as RoleKey; }, { kind: 'access', skipIssues: true })}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></span><span>{u.name !== s.currentUser && <Button variant="ghost" icon="trash" onClick={() => act('Removed user', u.name, (d) => { d.users = d.users.filter((x) => x.name !== u.name); }, { kind: 'access', skipIssues: true })} />}</span></div>)}</Table>
    <div className="form-grid mt" style={{ gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'end' }}><label className="field">Name<input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label><label className="field">Title<input value={nu.title} onChange={(e) => setNu({ ...nu, title: e.target.value })} /></label><label className="field">Role<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as RoleKey })}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></label><Button icon="plus" disabled={!nu.name.trim() || s.users.some((u) => u.name === nu.name)} onClick={() => { act('Added user', `${nu.name} · ${ROLES[nu.role].label}`, (d) => { d.users.push({ ...nu, title: nu.title || ROLES[nu.role].label }); }, { kind: 'access', skipIssues: true }); toast(`${nu.name} added`); setNu({ name: '', title: '', role: 'pwc_consultant' }); }}>Add user</Button></div>
  </Modal>;
}

function AuditModal({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const { s } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const list = s.audit.filter((a) => (kind === 'all' || a.kind === kind) && (!q || `${a.actor} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase())));
  return <Modal wide title={`Audit log · ${s.audit.length} events`} onClose={onClose} footer={<><Button variant="secondary" icon="download" onClick={onExport}>Export CSV</Button><Button onClick={onClose}>Close</Button></>}>
    <div className="row mb"><SearchBox value={q} onChange={setQ} placeholder="Search actor, action, detail…" /><select className="inline" value={kind} onChange={(e) => setKind(e.target.value)}>{['all', 'approve', 'override', 'ai', 'data', 'access', 'escalate', 'system'].map((k) => <option key={k}>{k}</option>)}</select><span className="muted small">{list.length} events</span></div>
    <div className="scroll-y"><Table cols="140px 120px 1.4fr 2.6fr 80px" head={['When', 'Who', 'Action', 'Detail', 'Type']}>{list.slice(0, 300).map((a) => <div className="tr" key={a.id}><span>{new Date(a.ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><span>{a.actor}</span><span><strong>{a.action}</strong></span><span className="muted small">{a.detail}</span><span><Badge tone={a.kind === 'approve' ? 'success' : a.kind === 'override' || a.kind === 'escalate' ? 'warning' : a.kind === 'ai' ? 'info' : 'neutral'}>{a.kind}</Badge></span></div>)}</Table></div>
  </Modal>;
}

function ScoringConfig() {
  const { s, act, toast, readOnly } = useStore();
  const [c, setC] = useState<Config>(structuredClone(s.config));
  const num = (v: number, set: (n: number) => void, step = 0.05) => <input className="inline" type="number" step={step} style={{ width: 70 }} value={v} disabled={readOnly} onChange={(e) => set(Number(e.target.value))} />;
  const sum = (o: Record<string, number>) => Math.round(Object.values(o).reduce((a, b) => a + b, 0) * 100) / 100;
  const valid = sum(c.priorityWeights) === 1 && sum(c.readinessWeights) === 1 && sum(c.optionWeights) === 1 && sum(c.costSplitWeights) === 1;
  const group = (title: string, key: 'priorityWeights' | 'readinessWeights' | 'optionWeights' | 'costSplitWeights') => <div className="stack" style={{ gap: 4 }}><div className="row between small"><strong>{title}</strong><span className={sum(c[key] as any) === 1 ? 'muted' : ''} style={{ color: sum(c[key] as any) === 1 ? undefined : 'var(--red)' }}>Σ {sum(c[key] as any)}</span></div><div className="row wrap">{Object.entries(c[key]).map(([k, v]) => <label key={k} className="small row" style={{ gap: 4 }}>{k}{num(v as number, (n) => setC({ ...c, [key]: { ...(c[key] as any), [k]: n } }))}</label>)}</div></div>;
  return <section className="card"><div className="card-header"><div><h2>Scoring configuration</h2><p>Weights and thresholds change without rebuilding the app (BRD: easy to update)</p></div><div className="row"><Button variant="ghost" onClick={() => setC(structuredClone(DEFAULT_CONFIG))}>Defaults</Button><Button disabled={!valid || readOnly} onClick={() => { act('Changed scoring configuration', 'Weights / thresholds updated', (d) => { d.config = c; }, { kind: 'override' }); toast('Configuration saved — all scores recalculated'); }}>Save</Button></div></div>
    <div className="card-body stack">{group('Priority Index weights (C, D, R, S)', 'priorityWeights')}{group('Item readiness weights', 'readinessWeights')}{group('Leadership option weights', 'optionWeights')}{group('Cost split weights', 'costSplitWeights')}
      <div className="row wrap small"><label className="row" style={{ gap: 4 }}>Day-1 PI threshold{num(c.day1Threshold, (n) => setC({ ...c, day1Threshold: n }), 0.1)}</label><label className="row" style={{ gap: 4 }}>Go ≥{num(c.goThreshold, (n) => setC({ ...c, goThreshold: n }), 1)}</label><label className="row" style={{ gap: 4 }}>Conditions ≥{num(c.conditionsThreshold, (n) => setC({ ...c, conditionsThreshold: n }), 1)}</label><label className="row" style={{ gap: 4 }}>Blocker cap{num(c.blockerCap, (n) => setC({ ...c, blockerCap: n }), 1)}</label><label className="row" style={{ gap: 4 }}>Hygiene gate{num(c.hygieneGate, (n) => setC({ ...c, hygieneGate: n }), 1)}</label><label className="row" style={{ gap: 4 }}>Stale after (months){num(c.staleMonths, (n) => setC({ ...c, staleMonths: n }), 1)}</label><label className="row" style={{ gap: 4 }}>Security floor{num(c.securityFloor, (n) => setC({ ...c, securityFloor: n }), 1)}</label></div>
      {!valid && <span className="small" style={{ color: 'var(--red)' }}>Each weight group must add up to 1.</span>}</div></section>;
}

function DealSettings() {
  const { s, act, toast, readOnly } = useStore();
  const [d, setD] = useState(s.deal);
  return <section className="card" id="deal-settings"><div className="card-header"><div><h2>Deal settings</h2><p>Change the “as of” date to replay the deal timeline</p></div><Button disabled={readOnly} onClick={() => { act('Changed deal settings', `${d.name} · as of ${d.asOf} · Day-1 ${d.day1}`, (x) => { x.deal = d; }, { kind: 'override' }); toast('Deal settings saved'); }}>Save</Button></div>
    <div className="card-body form-grid">
      <label className="field">Deal name<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
      <label className="field">Industry<input value={d.industry} onChange={(e) => setD({ ...d, industry: e.target.value })} /></label>
      <label className="field">Buyer<input value={d.buyer} onChange={(e) => setD({ ...d, buyer: e.target.value })} /></label>
      <label className="field">Seller<input value={d.seller} onChange={(e) => setD({ ...d, seller: e.target.value })} /></label>
      <label className="field">As-of date (today in the deal)<input type="date" value={d.asOf} onChange={(e) => setD({ ...d, asOf: e.target.value })} /></label>
      <label className="field">Day-1 date<input type="date" value={d.day1} onChange={(e) => setD({ ...d, day1: e.target.value })} /></label>
      <label className="field">Deal type<select value={d.dealType} onChange={(e) => setD({ ...d, dealType: e.target.value })}>{['Carve-out', 'Acquisition', 'Divestiture', 'Merger'].map((x) => <option key={x}>{x}</option>)}</select></label>
    </div></section>;
}
