import { isDraft, original } from 'immer';
import { useMemo, useState } from 'react';
import { DecisionLog, InfoTip } from '../components/DecisionLog';
import { runAI } from '../ai/client';
import { gapFill, type GapIn } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Conf, Empty, Icon, Menu, MetricCard, Modal, PageTitle, Progress, SearchBox, Table, Tabs, toneFor } from '../components/ui';
import { DATASET, DATASETS, type DatasetKey } from '../engine/glossary';
import { hygieneScore, issueCounts, mergeRows } from '../engine/quality';
import type { Issue, OwnerItem, WorkspaceState } from '../engine/types';
import { addDays, daysBetween, download, fmtDate, toCSV, uid } from '../engine/util';
import { useStore } from '../state/store';
import { ownersOf } from '../engine/workspace';

const TYPE_LABEL: Record<string, string> = { missing: 'Missing value', duplicate: 'Duplicate', lookalike: 'Look-alike', broken_link: 'Broken link', stale: 'Stale', orphan: 'Unused / orphan' };

// Index rows by _rid once per (draft) rows array — bulk fixes over 35,000+ records stay fast.
const rowIndex = new WeakMap<object, Map<string, number>>();
function rowOf(d: WorkspaceState, i: Issue) {
  const rows = d.datasets[i.dataset]?.rows;
  if (!rows) return undefined;
  let idx = rowIndex.get(rows);
  if (!idx) { const src = (isDraft(rows) ? original(rows) : rows) as typeof rows; idx = new Map(src.map((r, k) => [r._rid, k])); rowIndex.set(rows, idx); }
  const k = idx.get(i.rid);
  return k === undefined ? undefined : rows[k];
}
function setIssueStatus(d: WorkspaceState, id: string, status: Issue['status'], resolution?: string) { const x = d.issues.find((i) => i.id === id); if (x) { x.status = status; x.resolution = resolution; } }
function closeOwnerFor(d: WorkspaceState, issueId: string, answer: string) { d.ownerQueue.forEach((o) => { if (o.issueId === issueId && o.status !== 'answered') { o.status = 'answered'; o.answer = answer; } }); }

export function applyFix(d: WorkspaceState, i: Issue, kind: 'value' | 'merge' | 'retire' | 'in_use' | 'dismiss', value?: string) {
  const r = rowOf(d, i);
  if (kind === 'value' && r && i.field) { r[i.field] = value; closeOwnerFor(d, i.id, String(value)); }
  if (kind === 'merge' && i.relatedRid) d.datasets[i.dataset]!.rows = mergeRows(d.datasets[i.dataset]!.rows, i.relatedRid, i.rid);
  if (kind === 'retire' && r) { r._retired = true; r._retiredReason = 'Owner confirmed retired'; }
  if (kind === 'in_use' && r) { if (i.type === 'stale') r.last_updated = d.deal.asOf; else setIssueStatus(d, i.id, 'dismissed', 'Confirmed still in use'); }
  if (kind === 'dismiss') setIssueStatus(d, i.id, 'dismissed', value ?? 'Accepted as-is');
}

function IssueRow({ i }: { i: Issue }) {
  const { s, act } = useStore();
  const [val, setVal] = useState(i.suggestion && i.suggestion.value !== 'merge' && i.suggestion.value !== 'unknown' ? i.suggestion.value : '');
  const refOptions = useMemo(() => {
    if (i.type !== 'broken_link') return [];
    const fd = DATASET[i.dataset].fields.find((f) => f.key === i.field);
    const ref = fd?.ref ?? (i.field === 'app_id' ? 'applications' : undefined);
    if (!ref) return [];
    const idf = DATASET[ref].idField!;
    return [...new Set((s.datasets[ref]?.rows ?? []).filter((r) => !r._retired).map((r) => r[idf]).filter(Boolean))];
  }, [i, s.datasets]);
  const fix = (kind: Parameters<typeof applyFix>[2], v?: string, label?: string) => act(label ?? 'Resolved data quality issue', `${i.dataset} · ${i.label} · ${TYPE_LABEL[i.type]}${v ? ` → ${v}` : ''}`, (d) => applyFix(d, i, kind, v), { kind: i.suggestion && v === i.suggestion.value && i.suggestion.source !== 'rule' ? 'approve' : 'data' });
  const sendOwner = () => act('Sent issue to owner queue', i.message, (d) => {
    d.ownerQueue.push({ id: uid('OQ'), question: `${i.label}: ${i.message} — please confirm the correct value`, context: `${DATASET[i.dataset].label} · ${TYPE_LABEL[i.type]}`, owner: i.dataset === 'licences' ? ownersOf(d).procurement : i.dataset === 'erp' ? ownersOf(d).finance : i.dataset === 'network' ? ownersOf(d).network : ownersOf(d).apps, role: 'Data owner', due: addDays(d.deal.asOf, 3), priority: 'P2', status: 'open', issueId: i.id, createdAt: new Date().toISOString() });
  });
  return <div className="tr">
    <span><Badge tone={i.type === 'broken_link' ? 'danger' : i.type === 'missing' ? 'warning' : 'info'}>{TYPE_LABEL[i.type]}</Badge></span>
    <span><strong>{i.label}</strong><small>{DATASET[i.dataset].label}</small></span>
    <span>{i.message}{i.suggestion && <small>{i.suggestion.source === 'rule' ? 'Rule' : i.suggestion.source === 'ai' ? 'AI' : 'AI (fallback)'}: {i.suggestion.value === 'merge' ? 'merge records' : i.suggestion.value} — {i.suggestion.reason} (<Conf v={i.suggestion.confidence} />)</small>}</span>
    <span className="row wrap" style={{ justifyContent: 'flex-end' }}>
      {i.type === 'missing' && <>
        <input className="inline" style={{ width: 110 }} value={val} placeholder="Value…" onChange={(e) => setVal(e.target.value)} />
        <Button variant="secondary" disabled={!val} onClick={() => fix('value', val, 'Filled missing value')}>Apply</Button>
      </>}
      {(i.type === 'duplicate' || i.type === 'lookalike') && <><Button variant="secondary" icon="merge" onClick={() => fix('merge', undefined, 'Merged duplicate records')}>Merge</Button><Button variant="ghost" onClick={() => fix('dismiss', 'Not a duplicate', 'Marked not a duplicate')}>Not a duplicate</Button></>}
      {i.type === 'broken_link' && <>
        <select className="inline" value={val} onChange={(e) => setVal(e.target.value)}><option value="">Re-point to…</option>{refOptions.map((o) => <option key={o}>{o}</option>)}</select>
        <Button variant="secondary" disabled={!val} onClick={() => fix('value', val, 'Fixed broken link')}>Apply</Button>
        <Button variant="ghost" onClick={() => fix('retire', undefined, 'Retired record')}>Retire</Button>
      </>}
      {(i.type === 'stale' || i.type === 'orphan') && <><Button variant="secondary" onClick={() => fix('in_use', undefined, 'Confirmed still in use')}>Still in use</Button><Button variant="ghost" onClick={() => fix('retire', undefined, 'Retired record')}>Retired</Button></>}
      <Menu items={[{ label: 'Send to owner queue', icon: 'users', onClick: sendOwner }, { label: 'Accept as-is (dismiss)', icon: 'x', onClick: () => fix('dismiss', 'Accepted as-is', 'Dismissed quality issue') }]} />
    </span>
  </div>;
}

export function Inventory() {
  const { s, m, act, toast, params, navigate } = useStore();
  const [tab, setTab] = useState(params.tab ?? 'files');
  const [upload, setUpload] = useState<DatasetKey | 'any' | null>(null);
  const [q, setQ] = useState(params.q ?? '');
  const [compFilter, setCompFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dsFilter, setDsFilter] = useState<string>(params.dataset ?? 'all');
  const [page, setPage] = useState(1);
  const [aiBusy, setAiBusy] = useState(false);
  const [mappingView, setMappingView] = useState<DatasetKey | null>(null);
  const [answer, setAnswer] = useState<OwnerItem | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [newQ, setNewQ] = useState(false);
  const [hygFile, setHygFile] = useState<DatasetKey | null>(null);
  const [recordsDs, setRecordsDs] = useState<DatasetKey>((params.dataset as DatasetKey) ?? 'applications');

  const counts = issueCounts(s);
  const loaded = DATASETS.filter((d) => s.datasets[d.key]);
  const invRecords = loaded.filter((d) => d.hygiene).reduce((x, d) => x + (s.datasets[d.key]?.rawCount ?? 0), 0);
  const belowGate = m.datasetsHygiene.filter((d) => d.score < s.config.hygieneGate);

  const statusOf = (k: DatasetKey) => {
    const h = hygieneScore(s, k);
    if (h === null) return { label: 'Loaded', tone: 'info' as const };
    if (h >= s.config.hygieneGate) return { label: 'Ready', tone: 'success' as const };
    if (h >= s.config.hygieneGate - 3) return { label: 'Review', tone: 'warning' as const };
    return { label: 'Blocked', tone: 'danger' as const };
  };

  const openIssues = s.issues.filter((i) => i.status === 'open' && (dsFilter === 'all' || i.dataset === dsFilter) && (typeFilter === 'all' || (typeFilter === 'duplicates' ? i.type === 'duplicate' || i.type === 'lookalike' : typeFilter === 'stale' ? i.type === 'stale' || i.type === 'orphan' : typeFilter === 'broken' ? i.type === 'broken_link' : i.type === typeFilter)));
  const aiSuggestions = s.issues.filter((i) => i.status === 'open' && i.suggestion && (i.suggestion.source !== 'rule' || i.type === 'lookalike'));
  const ruleFixable = s.issues.filter((i) => i.status === 'open' && i.suggestion?.source === 'rule' && i.type === 'missing');

  const applyAllRule = () => {
    if (!ruleFixable.length) return toast('No rule-based fixes available', 'info');
    act('Applied rule-based fixes', `${ruleFixable.length} gaps filled from linked records`, (d) => ruleFixable.forEach((i) => applyFix(d, i, 'value', i.suggestion!.value)));
    toast(`${ruleFixable.length} gaps filled from linked records`);
  };

  const askAI = async () => {
    const targets = s.issues.filter((i) => i.status === 'open' && i.type === 'missing' && !i.suggestion && (dsFilter === 'all' || i.dataset === dsFilter)).slice(0, 25);
    if (!targets.length) return toast('No blank fields without a suggestion', 'info');
    setAiBusy(true);
    const apps = s.datasets.applications?.rows ?? [];
    const lic = new Map((s.datasets.licences?.rows ?? []).map((l) => [l.licence_id, l]));
    const erp = s.datasets.erp?.rows ?? [];
    const items: GapIn['items'] = targets.map((i) => {
      const r = s.datasets[i.dataset]!.rows.find((x) => x._rid === i.rid)!;
      const clean = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_')));
      const clues: Record<string, any> = {};
      if (i.dataset === 'applications') {
        const l = lic.get(r.licence_id); if (l) { clues.licenceId = l.licence_id; clues.licenceVendor = l.vendor; clues.licenceProduct = l.product; }
        const peer = apps.find((a) => a !== r && a.hosting_server_id === r.hosting_server_id && a.owner_team); if (peer) clues.sameServerOwner = peer.owner_team;
      }
      if (i.dataset === 'erp' && i.field === 'cost_centre') {
        const same = erp.filter((x) => x.gl_account?.slice(0, 4) === r.gl_account?.slice(0, 4) && x.cost_centre);
        const top = Object.entries(same.reduce((a: Record<string, number>, x) => ((a[x.cost_centre] = (a[x.cost_centre] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0];
        if (top) clues.glCostCentre = top[0];
      }
      return { id: i.id, dataset: i.dataset, field: i.field!, record: clean, clues };
    });
    const res = await runAI(gapFill, { items });
    setAiBusy(false);
    act('AI suggested values for blank fields', `${res.data.fills.length} suggestions · ${res.source === 'gemini' ? res.model : 'rule-based fallback'}`, (d) => {
      res.data.fills.forEach((f) => { const x = d.issues.find((i) => i.id === f.id); if (x) x.suggestion = { value: f.value, reason: f.reason, confidence: f.confidence, source: res.source === 'gemini' ? 'ai' : 'fallback', model: res.model }; });
    }, { kind: 'ai' });
    toast(`${res.data.fills.length} AI suggestions ready for review`, 'info');
    setTab('ai');
  };

  const answerOwner = () => {
    if (!answer) return;
    act('Owner answered question', `${answer.question} → ${answerText}`, (d) => {
      const o = d.ownerQueue.find((x) => x.id === answer.id)!; o.status = 'answered'; o.answer = answerText;
      if (o.issueId) { const i = d.issues.find((x) => x.id === o.issueId); if (i) applyFix(d, i, 'value', answerText); }
      if (/L-07/.test(o.question) && /^y/i.test(answerText)) {
        const t = d.datasets.tasks?.rows.find((x) => /EDA Corp licence consent/i.test(x.title)); if (t && t.status === 'Blocked') t.status = 'Done';
      }
    });
    toast(/L-07/.test(answer.question) && /^y/i.test(answerText) ? 'Answer saved — EDA consent task marked done; readiness recalculated' : 'Answer saved');
    setAnswer(null); setAnswerText('');
  };

  const fileRows = DATASETS.filter((d) => (compFilter === 'All' || d.component === compFilter) && (!q || `${d.label} ${s.datasets[d.key]?.fileName ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  const pageSize = 40;

  return <>
    <PageTitle eyebrow="Connect & clean" title="Data & Inventory" description="One governed baseline for applications, infrastructure, licences and people." action={<><Button variant="secondary" icon="download" onClick={() => { download('DealSync_baseline_hygiene.csv', toCSV(loaded.map((d) => ({ dataset: d.label, file: s.datasets[d.key]!.fileName, records: s.datasets[d.key]!.rows.length, hygiene: hygieneScore(s, d.key) ?? '', status: statusOf(d.key).label })))); toast('Hygiene summary downloaded'); }}>Export summary</Button><Button icon="upload" onClick={() => setUpload('any')}>Upload source file</Button></>} />
    <div className="metrics-grid compact">
      <MetricCard label="Source files" value={loaded.length} icon="file" onClick={() => setTab('files')} detail={<><span>{loaded.filter((d) => d.hygiene).length} baseline files</span><span>{DATASETS.length - loaded.length} not uploaded</span></>} />
      <MetricCard label="Records" value={invRecords.toLocaleString()} icon="database" onClick={() => setTab('records')} detail={<><span className="trend positive">mapped to glossary</span><span>across {new Set(loaded.filter((d) => d.hygiene).map((d) => d.component)).size} components</span></>} />
      <MetricCard label="Open quality issues" value={counts.open} icon="alert" tone={counts.open ? 'warning' : ''} onClick={() => setTab('quality')} detail={<><span className="trend warning">{m.openOwner.length} with owners</span><span>{aiSuggestions.length} AI suggestions</span></>} />
      <MetricCard label="Average hygiene" value={<>{m.avgHygiene}<HygieneInfo /></>} icon="shield" onClick={() => setTab('files')} detail={<><span className={`trend ${belowGate.length ? 'negative' : 'positive'}`}>{belowGate.length ? `${belowGate.length} below gate` : '90 gate passed'}</span><span>gate {s.config.hygieneGate}+ · click a file's score for its breakdown</span></>} />
    </div>
    <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} tabs={[{ key: 'files', label: 'Files' }, { key: 'quality', label: 'Quality queue', count: counts.open }, { key: 'ai', label: 'AI suggestions', count: aiSuggestions.length }, { key: 'owner', label: 'Owner queue', count: m.openOwner.length }, { key: 'records', label: 'Records' }, { key: 'decisions', label: 'Decisions', count: s.audit.filter((a) => a.module === 'Data & Inventory' && ['approve', 'override', 'data', 'escalate'].includes(a.kind) && !a.undone).length }]} />

    {tab === 'files' && <section className="card table-card">
      <div className="table-tools"><SearchBox value={q} onChange={setQ} placeholder="Search source files…" />
        <select className="inline" value={compFilter} onChange={(e) => setCompFilter(e.target.value)}><option>All</option>{[...new Set(DATASETS.map((d) => d.component))].map((c) => <option key={c}>{c}</option>)}</select>
        <span className="muted small" style={{ marginLeft: 'auto' }}>Data gate: files must score {s.config.hygieneGate}+ before use in decisions</span>
      </div>
      <Table cols="2fr 1.1fr .7fr 1.2fr .8fr 1fr 150px" head={['Source file', 'Component', 'Records', 'Hygiene', 'Status', 'Last updated', '']}>
        {fileRows.map((d) => {
          const ds = s.datasets[d.key];
          const h = hygieneScore(s, d.key);
          const st = statusOf(d.key);
          if (!ds) return <div className="tr muted-row" key={d.key}><span className="row"><span className="file-icon" style={{ background: '#eee', padding: '3px 5px', fontSize: 8 }}>—</span><span><strong>{d.label}</strong><small>Expected: {d.sampleFile}</small></span></span><span>{d.component}</span><span>—</span><span>—</span><span><Badge>Not uploaded</Badge></span><span>—</span><span><Button variant="secondary" icon="upload" onClick={() => setUpload(d.key)}>Upload</Button></span></div>;
          return <div className="tr" key={d.key}>
            <span className="row"><span className="file-icon" style={{ background: '#f1efeb', padding: '3px 5px', fontSize: 8, fontWeight: 700 }}>{ds.fileName.split('.').pop()?.toUpperCase()}</span><span><strong>{ds.fileName}</strong><small>{d.label}{ds.piiMasked ? ' · personal data hidden' : ''}</small></span></span>
            <span>{d.component}</span><span>{ds.rawCount.toLocaleString()}</span>
            <span>{h === null ? <span className="muted">n/a</span> : <button title="Show how this score is calculated" onClick={() => setHygFile(d.key)} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', alignItems: 'center', gap: 6, width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}><strong style={{ textDecoration: 'underline dotted' }}>{h}</strong><Progress value={h} tone={toneFor(h, s.config.hygieneGate, s.config.hygieneGate - 3)} /></button>}</span>
            <span><Badge tone={st.tone}>{st.label}</Badge></span>
            <span className="muted">{new Date(ds.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="row" style={{ justifyContent: 'flex-end' }}>
              {h !== null && <Button variant="ghost" onClick={() => { setDsFilter(d.key); setTab('quality'); }}>Issues</Button>}
              <Menu items={[
                { label: 'View records', icon: 'eye', onClick: () => { setRecordsDs(d.key); setTab('records'); } },
                ...(ds.mapping.length ? [{ label: 'View column mapping', icon: 'link' as const, onClick: () => setMappingView(d.key) }] : []),
                { label: 'Re-upload / replace', icon: 'upload', onClick: () => setUpload(d.key) },
                { label: 'Download standardised CSV', icon: 'download', onClick: () => download(`standardised_${d.key}.csv`, ds.text ?? toCSV(ds.rows)) },
                'sep',
                { label: 'Remove from workspace', icon: 'trash', danger: true, onClick: () => { if (confirm(`Remove ${d.label}? Scores depending on it will be recalculated.`)) act('Removed dataset', d.label, (x) => { delete x.datasets[d.key]; }); } },
              ]} />
            </span>
          </div>;
        })}
      </Table>
      <div className="table-footer"><span>Showing {fileRows.length} file types · {loaded.length} uploaded</span><span>Raw client data is deleted per the retention policy ({s.retention})</span></div>
    </section>}

    {tab === 'quality' && <section className="card">
      <div className="card-header"><div><h2>Data quality checks</h2><p>{counts.open} exceptions across completeness, duplicates, links and freshness. Rules fix first, then AI suggests, then owners confirm.</p></div>
        <div className="row"><Button variant="secondary" icon="check" onClick={applyAllRule}>Apply {ruleFixable.length} rule fixes</Button><Button icon="spark" loading={aiBusy} onClick={askAI}>Ask AI to fill blanks</Button></div></div>
      <div className="quality-cards">{[['missing', 'Missing values', counts.missing, `${ruleFixable.length} fixable by rule`], ['duplicates', 'Potential duplicates', counts.duplicates, 'exact + look-alike'], ['broken', 'Broken links', counts.broken, 'IDs pointing nowhere'], ['stale', 'Stale / unused records', counts.stale, `> ${s.config.staleMonths} months or 0 users`]].map(([k, a, b, c], i) => <div key={k as string} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--border)', padding: 12, background: typeFilter === k ? '#fff8f4' : '#fff' }}><span className={`quality-symbol q${i}`} style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', background: '#f1efeb', fontWeight: 700 }}>{i + 1}</span><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}><strong>{b} {String(a).toLowerCase()}</strong><span className="muted small">{c}</span></div><Button variant="secondary" onClick={() => { setTypeFilter(typeFilter === k ? 'all' : (k as string)); setPage(1); }}>{typeFilter === k ? 'Show all' : 'Review'}</Button></div>)}</div>
      <div className="table-tools"><select className="inline" value={dsFilter} onChange={(e) => { setDsFilter(e.target.value); setPage(1); }}><option value="all">All files</option>{loaded.filter((d) => d.hygiene).map((d) => <option key={d.key} value={d.key}>{d.label} ({s.issues.filter((i) => i.dataset === d.key && i.status === 'open').length})</option>)}</select><span className="muted small">{openIssues.length} matching issues</span></div>
      {openIssues.length ? <Table cols="110px 1.3fr 2.2fr 2.2fr" head={['Type', 'Record', 'Problem & suggestion', 'Action']}>{openIssues.slice(0, page * pageSize).map((i) => <IssueRow key={i.id} i={i} />)}</Table> : <Empty title="No open issues here">Every record in this view passes the checks.</Empty>}
      {openIssues.length > page * pageSize && <div className="table-footer"><span>Showing {page * pageSize} of {openIssues.length}</span><Button variant="secondary" onClick={() => setPage(page + 1)}>Show more</Button></div>}
    </section>}

    {tab === 'ai' && <section className="card">
      <div className="card-header"><div><h2>Suggestions awaiting human review</h2><p>AI can propose changes but never applies them without approval.</p></div><div className="row"><AIChip /><Badge tone="info"><Icon name="spark" size={12} /> Human in control</Badge>{aiSuggestions.some((x) => x.suggestion!.confidence >= 0.85 && x.suggestion!.value !== 'unknown') && <Button variant="secondary" icon="check" onClick={() => { const list = aiSuggestions.filter((x) => x.suggestion!.confidence >= 0.85 && x.suggestion!.value !== 'unknown'); act('Approved high-confidence AI suggestions', `${list.length} suggestions ≥ 85%`, (d) => list.forEach((i) => applyFix(d, i, i.suggestion!.value === 'merge' ? 'merge' : 'value', i.suggestion!.value)), { kind: 'approve' }); toast(`${list.length} suggestions approved`); }}>Approve all ≥ 85%</Button>}</div></div>
      <div className="suggestion-list">{aiSuggestions.map((i) => <div className="suggestion" key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #eee' }}>
        <div className="ai-mark" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', background: 'var(--orange-light)', color: 'var(--orange)' }}><Icon name="spark" /></div>
        <div style={{ flex: 1, fontSize: 10, display: 'flex', flexDirection: 'column', gap: 4 }}><div className="row"><strong>{i.suggestion!.value === 'merge' ? `Merge ${i.label}` : i.suggestion!.value === 'unknown' ? `${i.label}: ${i.field} unknown` : `Set ${i.label} ${DATASET[i.dataset].fields.find((f) => f.key === i.field)?.label.toLowerCase() ?? i.field} to “${i.suggestion!.value}”`}</strong><Badge tone="info">{Math.round(i.suggestion!.confidence * 100)}% confidence</Badge></div><span className="muted">{s.datasets[i.dataset]?.fileName} · {i.suggestion!.reason}</span></div>
        <div className="row">
          <Button variant="ghost" onClick={() => act('Rejected AI suggestion', `${i.label} · ${i.suggestion!.value}`, (d) => { const x = d.issues.find((y) => y.id === i.id); if (x) x.suggestion = undefined; if (i.type === 'lookalike') applyFix(d, i, 'dismiss', 'Rejected look-alike'); }, { kind: 'override' })}>Reject</Button>
          {i.suggestion!.value === 'unknown' ? <Button variant="secondary" onClick={() => act('Sent to owner queue', i.message, (d) => { d.ownerQueue.push({ id: uid('OQ'), question: `${i.label}: ${i.message}`, context: i.suggestion!.reason, owner: ownersOf(d).apps, role: 'Application Lead', due: addDays(d.deal.asOf, 2), priority: 'P2', status: 'open', issueId: i.id, createdAt: new Date().toISOString() }); })}>Ask owner</Button>
            : <Button onClick={() => { act('Approved AI suggestion', `${i.label} → ${i.suggestion!.value}`, (d) => applyFix(d, i, i.suggestion!.value === 'merge' ? 'merge' : 'value', i.suggestion!.value), { kind: 'approve' }); toast('Approved and applied'); }}>Approve</Button>}
        </div>
      </div>)}
        {!aiSuggestions.length && <Empty title="No suggestions waiting">Use “Ask AI to fill blanks” in the Quality queue to generate suggestions.</Empty>}
        {s.links.some((l) => l.status === 'suggested') && <div className="row between" style={{ padding: '12px 16px' }}><span className="small"><Icon name="network" size={14} /> {s.links.filter((l) => l.status === 'suggested').length} AI hidden-dependency suggestions are waiting in the Dependency Explorer.</span><Button variant="secondary" onClick={() => navigate('Dependency Explorer', { review: '1' })}>Review links</Button></div>}
      </div>
    </section>}

    {tab === 'owner' && <section className="card">
      <div className="card-header"><div><h2>Unresolved owner actions</h2><p>Questions that require accountable business confirmation. Overdue items escalate to the engagement manager.</p></div><Button variant="secondary" icon="plus" onClick={() => setNewQ(true)}>Add question</Button></div>
      <Table cols="40px 2.4fr 1.2fr 90px 110px 230px" head={['', 'Question', 'Owner', 'Due', 'Status', 'Actions']}>
        {[...s.ownerQueue].sort((a, b) => Number(a.status === 'answered') - Number(b.status === 'answered') || a.due.localeCompare(b.due)).map((o) => {
          const dd = daysBetween(s.deal.asOf, o.due);
          const st = o.status === 'answered' ? { t: 'Answered', tone: 'success' as const } : o.status === 'escalated' ? { t: 'Escalated', tone: 'danger' as const } : dd < 0 ? { t: 'Overdue', tone: 'danger' as const } : dd === 0 ? { t: 'Due today', tone: 'warning' as const } : dd === 1 ? { t: 'Due tomorrow', tone: 'warning' as const } : { t: 'Open', tone: 'neutral' as const };
          return <div className={`tr ${o.status === 'answered' ? 'muted-row' : ''}`} key={o.id}>
            <span><span className={`severity ${o.priority === 'P0' ? 'critical' : 'high'}`}>{o.priority}</span></span>
            <span><strong>{o.question}</strong><small>{o.answer ? `Answer: ${o.answer}` : o.context}</small></span>
            <span>{o.owner}<small>{o.role}</small></span><span>{fmtDate(o.due)}</span><span><Badge tone={st.tone}>{st.t}</Badge></span>
            <span className="row">{o.status !== 'answered' && <><Button variant="secondary" onClick={() => { setAnswer(o); setAnswerText(''); }}>Answer</Button>
              {o.status !== 'escalated' && <Button variant="ghost" onClick={() => { act('Escalated owner question', `${o.question} → engagement manager`, (d) => { d.ownerQueue.find((x) => x.id === o.id)!.status = 'escalated'; }, { kind: 'escalate' }); toast('Escalated to the engagement manager', 'warning'); }}>Escalate</Button>}
              <Menu items={s.users.filter((u) => u.role !== 'bank').map((u) => ({ label: `Reassign to ${u.name}`, icon: 'users' as const, onClick: () => act('Reassigned owner question', `${o.question} → ${u.name}`, (d) => { d.ownerQueue.find((x) => x.id === o.id)!.owner = u.name; }) }))} /></>}</span>
          </div>;
        })}
      </Table>
      {!s.ownerQueue.length && <Empty title="Owner queue is empty" />}
    </section>}

    {tab === 'records' && <RecordsView ds={recordsDs} setDs={setRecordsDs} initialQ={params.q} />}
    {tab === 'decisions' && <DecisionLog modules={['Data & Inventory']} title="Data decisions" subtitle="Every fix, merge, retirement, AI approval and owner answer taken on this screen — undo any of them" />}
    {hygFile && <HygieneBreakdown k={hygFile} onClose={() => setHygFile(null)} />}

    {upload && <UploadModal expected={upload === 'any' ? undefined : upload} onClose={() => setUpload(null)} />}
    {mappingView && <Modal title={`Column mapping · ${s.datasets[mappingView]?.fileName}`} subtitle="How the seller's columns were matched to the DealSync glossary" onClose={() => setMappingView(null)} footer={<Button onClick={() => setMappingView(null)}>Close</Button>}>
      <Table cols="1.4fr 1.2fr 70px 70px 2fr" head={['Source column', 'Standard name', 'Conf.', 'Method', 'Reason']}>{s.datasets[mappingView]!.mapping.map((mp) => <div className="tr" key={mp.source}><span><strong>{mp.source}</strong></span><span>{mp.target ?? <span className="muted">extra column</span>}</span><span><Conf v={mp.confidence} /></span><span><Badge tone={mp.method === 'ai' ? 'info' : 'neutral'}>{mp.method}</Badge></span><span className="muted small">{mp.reason}</span></div>)}</Table>
    </Modal>}
    {answer && <Modal title="Record owner answer" subtitle={answer.question} onClose={() => setAnswer(null)} footer={<><Button variant="secondary" onClick={() => setAnswer(null)}>Cancel</Button><Button disabled={!answerText.trim()} onClick={answerOwner}>Save answer</Button></>}>
      <div className="stack"><p className="muted small" style={{ margin: 0 }}>{answer.context}</p>
        {/transfer|consent/i.test(answer.question) && <div className="row">{['Yes', 'No', 'Consent required'].map((v) => <Button key={v} variant={answerText === v ? 'primary' : 'secondary'} onClick={() => setAnswerText(v)}>{v}</Button>)}</div>}
        <label className="field">Answer<textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Type the confirmed answer…" /></label>
        {answer.issueId && <p className="small muted">The answer will be written into the source record and the hygiene score recalculated.</p>}</div>
    </Modal>}
    {newQ && <NewQuestion onClose={() => setNewQ(false)} />}
  </>;
}

function NewQuestion({ onClose }: { onClose: () => void }) {
  const { s, act, toast } = useStore();
  const [f, setF] = useState({ question: '', owner: 'Marco Lee', due: addDays(s.deal.asOf, 2), priority: 'P1' as OwnerItem['priority'], context: '' });
  return <Modal title="Add owner question" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.question} onClick={() => { act('Added owner question', f.question, (d) => { d.ownerQueue.push({ id: uid('OQ'), question: f.question, context: f.context || 'Added manually', owner: f.owner, role: d.users.find((u) => u.name === f.owner)?.title ?? 'Owner', due: f.due, priority: f.priority, status: 'open', createdAt: new Date().toISOString() }); }); toast('Question added to owner queue'); onClose(); }}>Add</Button></>}>
    <div className="form-grid">
      <label className="field full">Question<input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} /></label>
      <label className="field">Owner<select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>{s.users.map((u) => <option key={u.name}>{u.name}</option>)}</select></label>
      <label className="field">Due<input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
      <label className="field">Priority<select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as OwnerItem['priority'] })}><option>P0</option><option>P1</option><option>P2</option></select></label>
      <label className="field full">Context<textarea value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} /></label>
    </div>
  </Modal>;
}

function RecordsView({ ds, setDs, initialQ }: { ds: DatasetKey; setDs: (k: DatasetKey) => void; initialQ?: string }) {
  const { s } = useStore();
  const [q, setQ] = useState(initialQ ?? '');
  const [n, setN] = useState(60);
  const d = s.datasets[ds];
  const cols = d ? (d.mapping.length ? d.mapping.filter((m) => m.target).map((m) => m.target!) : Object.keys(d.rows[0] ?? {}).filter((k) => !k.startsWith('_'))).filter((c) => !DATASET[ds].fields.find((f) => f.key === c)?.pii) : [];
  const shown = cols.length ? (d!.piiMasked ? Object.keys(d!.rows[0] ?? {}).filter((k) => !k.startsWith('_')) : cols).slice(0, 8) : [];
  const rows = (d?.rows ?? []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  const openRids = new Set(s.issues.filter((i) => i.dataset === ds && i.status === 'open').map((i) => i.rid));
  return <section className="card table-card">
    <div className="table-tools">
      <select className="inline" value={ds} onChange={(e) => setDs(e.target.value as DatasetKey)}>{DATASETS.filter((x) => s.datasets[x.key]).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
      <SearchBox value={q} onChange={setQ} placeholder="Search records…" />
      {d && <Button variant="secondary" icon="download" onClick={() => download(`standardised_${ds}.csv`, d.text ?? toCSV(d.rows))}>Download CSV</Button>}
      <span className="muted small" style={{ marginLeft: 'auto' }}>{rows.length} records{d?.piiMasked ? ` · ${d.piiMasked.originalRows} people summarised (names/emails removed)` : ''}</span>
    </div>
    {!d ? <Empty title="Not uploaded yet" /> : d.text ? <pre className="ai-box" style={{ margin: 16 }}>{d.text}</pre> :
      <div className="scroll-y"><Table cols={`repeat(${shown.length}, minmax(80px, 1fr)) 90px`} head={[...shown, 'Quality']}>{rows.slice(0, n).map((r) => <div className={`tr ${r._retired ? 'muted-row' : ''}`} key={r._rid}>{shown.map((c) => <span key={c} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof r[c] === 'boolean' ? (r[c] ? 'Yes' : 'No') : String(r[c] ?? '')}</span>)}<span>{r._retired ? <Badge>Retired</Badge> : openRids.has(r._rid) ? <Badge tone="warning">Issue</Badge> : <Badge tone="success">Clean</Badge>}</span></div>)}</Table></div>}
    {rows.length > n && <div className="table-footer"><span>Showing {n} of {rows.length}</span><Button variant="secondary" onClick={() => setN(n + 100)}>Show more</Button></div>}
  </section>;
}

const TYPE_PLAIN: Record<string, string> = { missing: 'Missing a required value', duplicate: 'Exact duplicate', lookalike: 'Look-alike duplicate', broken_link: 'Points to a record that doesn\'t exist', stale: 'Not updated in 6+ months', orphan: 'Unused (0 users / hosts nothing)' };

function HygieneInfo() {
  const { s } = useStore();
  return <InfoTip title="How is the hygiene score calculated?" wide>
    <p><b>Hygiene = share of records in a file that have no open quality problem.</b></p>
    <p style={{ fontFamily: 'monospace', background: '#f6f5f2', padding: 6 }}>hygiene = 100 × clean records ÷ total records</p>
    <p>A record is <b>not clean</b> if any of these checks is open on it:</p>
    <table><tbody>{Object.entries(TYPE_PLAIN).map(([k, v]) => <tr key={k}><td><b>{TYPE_LABEL[k]}</b></td><td>{v}</td></tr>)}</tbody></table>
    <p>Fixing, merging, retiring or accepting a record (“accept as-is”) makes it clean. Retired records count as clean because they won't move.</p>
    <p><b>{s.config.hygieneGate}+ = green.</b> Only green files can feed decisions or release a migration wave. The average shown is the simple mean of all scored files.</p>
  </InfoTip>;
}

function HygieneBreakdown({ k, onClose }: { k: DatasetKey; onClose: () => void }) {
  const { s } = useStore();
  const d = s.datasets[k]!;
  const open = s.issues.filter((i) => i.dataset === k && i.status === 'open');
  const dirty = new Set(open.map((i) => i.rid));
  const total = d.rows.length;
  const retired = d.rows.filter((r) => r._retired).length;
  const accepted = s.issues.filter((i) => i.dataset === k && i.status === 'dismissed').length;
  const clean = total - dirty.size;
  const score = hygieneScore(s, k) ?? 0;
  const byType = Object.keys(TYPE_LABEL).map((t) => ({ t, issues: open.filter((i) => i.type === t).length, records: new Set(open.filter((i) => i.type === t).map((i) => i.rid)).size })).filter((x) => x.issues);
  const needed = Math.max(0, Math.ceil((s.config.hygieneGate / 100) * total) - clean);
  return <Modal title={`Hygiene breakdown · ${d.fileName}`} subtitle={DATASET[k].label} onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
    <div className="stack">
      <table className="calc-table"><tbody>
        <tr><td>Total records in file</td><td className="num">{total.toLocaleString()}</td></tr>
        <tr><td>Records with at least one open problem</td><td className="num">− {dirty.size.toLocaleString()}</td></tr>
        <tr><td>Clean records <span className="muted">(incl. {retired} retired, {accepted} accepted as-is)</span></td><td className="num">{clean.toLocaleString()}</td></tr>
        <tr className="total"><td>Hygiene = 100 × {clean.toLocaleString()} ÷ {total.toLocaleString()}</td><td className="num">{score}</td></tr>
      </tbody></table>
      <div className="row"><Badge tone={score >= s.config.hygieneGate ? 'success' : 'danger'}>{score >= s.config.hygieneGate ? `Passes the ${s.config.hygieneGate} gate` : `Below the ${s.config.hygieneGate} gate`}</Badge>{needed > 0 && <span className="small">Clean <b>{needed.toLocaleString()}</b> more record{needed === 1 ? '' : 's'} to reach {s.config.hygieneGate}.</span>}</div>
      {byType.length > 0 && <table className="calc-table"><thead><tr><th>Problem</th><th>What it means</th><th>Open issues</th><th>Records affected</th></tr></thead><tbody>{byType.map((x) => <tr key={x.t}><td><b>{TYPE_LABEL[x.t]}</b></td><td className="muted">{TYPE_PLAIN[x.t]}</td><td>{x.issues.toLocaleString()}</td><td>{x.records.toLocaleString()}</td></tr>)}</tbody></table>}
      <p className="muted small" style={{ margin: 0 }}>A record with several problems is counted once. Go to the Quality queue to fix them — every fix is logged in the Decisions tab and can be undone.</p>
    </div>
  </Modal>;
}
