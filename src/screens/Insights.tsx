import { useEffect, useRef, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { buildLiveContext, pastDealsText } from '../ai/context';
import { FRAMEWORKS, frameworksText } from '../ai/frameworks';
import { copilot, learningRecord, prospectNote, type LearnOut } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Modal, PageTitle, Progress, Table, Tabs } from '../components/ui';
import type { DatasetKey } from '../engine/glossary';
import type { ChatMessage, LearningDraft } from '../engine/types';
import { openPrintable, uid } from '../engine/util';
import { SAMPLE_FILES, useStore } from '../state/store';
import { scorecardHtml } from './Readiness';

export function Insights() {
  const { params, s, m } = useStore();
  const [tab, setTab] = useState(params.tab ?? 'copilot');
  const [upload, setUpload] = useState<DatasetKey | null>(null);
  return <>
    <PageTitle eyebrow="Learn & advise" title="Knowledge & Market Insights" description="Sourced deal intelligence, reusable firm knowledge and ethical growth signals." action={<><Badge tone="info"><Icon name="shield" size={13} /> Approved sources only</Badge><Button variant="secondary" icon="upload" onClick={() => setUpload('learning')}>Upload learning records</Button><Button variant="secondary" icon="upload" onClick={() => setUpload('prospects')}>Upload prospects</Button></>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'copilot', label: 'Deal Copilot' }, { key: 'learn', label: 'Close & learn', count: s.learning.filter((l) => l.status !== 'saved').length }, { key: 'library', label: 'Knowledge library', count: m.learning.length }, { key: 'market', label: 'Benchmarks & prospects' }]} />
    {tab === 'copilot' && <CopilotTab />}
    {tab === 'learn' && <CloseAndLearn />}
    {tab === 'library' && <Library />}
    {tab === 'market' && <Market />}
    {upload && <UploadModal expected={upload} onClose={() => setUpload(null)} />}
  </>;
}

function CopilotTab() {
  const { s, m, act, toast, navigate } = useStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<AIResult<unknown> | null>(null);
  const [sources, setSources] = useState<ChatMessage | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [s.chat.length, busy]);
  const ask = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput(''); setBusy(true);
    act('Asked Copilot', q, (d) => { d.chat.push({ id: uid('c'), role: 'user', text: q }); }, { kind: 'ai', allowReadOnly: true, skipIssues: true });
    const r = await runAI(copilot, { question: q, context: buildLiveContext(s, m), frameworks: frameworksText(), pastDeals: pastDealsText(m), history: s.chat.slice(-6).map((c) => ({ role: c.role, text: c.text })) }, { timeoutMs: 20000 });
    setLast(r); setBusy(false);
    act('Copilot answered', `${r.source === 'gemini' ? r.model : 'fallback'} · sources: ${r.data.sources.join(', ') || 'none'}`, (d) => { d.chat.push({ id: uid('c'), role: 'ai', text: r.data.answer, sources: r.data.sources, model: r.source === 'gemini' ? r.model : 'Rule-based fallback' }); }, { kind: 'ai', allowReadOnly: true, skipIssues: true });
  };
  const feedback = (id: string, f: 'helpful' | 'not_helpful') => act('Rated Copilot answer', f, (d) => { const c = d.chat.find((x) => x.id === id); if (c) c.feedback = c.feedback === f ? undefined : f; }, { kind: 'ai', allowReadOnly: true, skipIssues: true });
  const top = m.prospects[0];
  return <div className="insights-layout">
    <section className="card copilot">
      <div className="copilot-head"><div className="copilot-logo"><Icon name="spark" /></div><div><h2>DealSync Copilot</h2><p>Live metrics · PwC methods · Consented lessons</p></div><span className="row"><AIChip result={last} /><Button variant="ghost" onClick={() => act('Cleared Copilot chat', '', (d) => { d.chat = d.chat.slice(0, 1); }, { allowReadOnly: true, skipIssues: true })}>Clear</Button></span></div>
      <div className="chat" ref={chatRef}>{s.chat.map((c) => c.role === 'user' ? <div className="message user" key={c.id}>{c.text}</div> : <div className="message ai" key={c.id}><span className="mini-ai"><Icon name="spark" size={14} /></span><div style={{ whiteSpace: 'pre-wrap' }}>{c.text}{c.sources && c.sources.length > 0 && <div className="muted small" style={{ marginTop: 4 }}>Sources: {c.sources.join(' · ')}{c.model ? ` · ${c.model}` : ''}</div>}<div className="message-actions"><button className={c.feedback === 'helpful' ? 'on' : ''} onClick={() => feedback(c.id, 'helpful')}>Helpful</button><button className={c.feedback === 'not_helpful' ? 'on' : ''} onClick={() => feedback(c.id, 'not_helpful')}>Not helpful</button><button onClick={() => { navigator.clipboard?.writeText(c.text); toast('Copied'); }}>Copy</button><button onClick={() => setSources(c)}>View sources</button></div></div></div>)}
        {busy && <div className="message ai"><span className="mini-ai"><span className="spinner" /></span><div className="muted">Reading live dashboard, frameworks and past deals…</div></div>}</div>
      <div className="quick-prompts">{['Why are we No-go?', 'What moves us to 90?', 'Draft a board update', 'Explain the cost gap', 'Which framework fits the cost dispute?', 'What will EDA Corp charge?'].map((q) => <button key={q} onClick={() => ask(q)} disabled={busy}>{q}</button>)}</div>
      <div className="chat-input"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder={`Ask about ${s.deal.name}…`} /><button onClick={() => ask()} disabled={busy} aria-label="Send"><Icon name="send" /></button></div>
      <div className="copilot-note"><Icon name="lock" size={13} />Copilot cannot change deal data. Every question, answer and rating is logged.</div>
    </section>
    <div className="insight-column" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section className="card benchmark-card"><div className="card-header"><div><span className="eyebrow">Sourced benchmark</span><h2>Licence consent timing</h2></div><Badge tone="success">{m.bench.total} deals</Badge></div><div className="card-body stack"><p className="small" style={{ margin: 0 }}>Deals requesting design-tool consent in week 1 were materially more likely to hit Day-1 on time.</p><div><div className="row between small"><span>Requested in week 1 ({m.bench.week1N})</span><strong>{m.bench.week1}%</strong></div><Progress value={m.bench.week1} tone="green" /></div><div><div className="row between small"><span>Requested later ({m.bench.lateN})</span><strong>{m.bench.late}%</strong></div><Progress value={m.bench.late} tone="amber" /></div><div className="source-line muted small"><Icon name="file" size={12} /> Anonymised Learning Records</div></div></section>
      <section className="card scorecard-mini"><div className="card-header"><div><span className="eyebrow">Board scorecard</span><h2>{s.deal.name}</h2></div><span className="mini-score" style={{ borderColor: m.signal === 'GO' ? 'var(--green)' : m.signal === 'NO-GO' ? 'var(--red)' : '#d99a1e' }}>{m.score}</span></div><div><span>Data confidence<strong>{m.avgHygiene}</strong></span><span>Execution<strong>{Math.round((100 * m.doneTasks) / (m.totalTasks || 1))}</strong></span><span>TSA exit<strong>{m.tsa.length ? Math.round(m.tsa.reduce((x, t) => x + t.actual, 0) / m.tsa.length) : '—'}</strong></span></div><Button variant="secondary" icon="download" onClick={() => openPrintable('Scorecard', scorecardHtml(s, m)) ? toast('Scorecard opened') : toast('Allow pop-ups', 'warning')}>Generate one-page scorecard</Button></section>
      {top && <section className="card prospect-card"><div className="card-header"><div><span className="eyebrow">Ethical market signal</span><h2>{top.row.company}</h2></div><strong style={{ fontSize: 20 }}>{top.score}<span className="muted small">/10</span></strong></div><div className="card-body stack"><p className="small" style={{ margin: 0 }}>Potential divestiture signal based on {top.drivers.join(', ')}.</p><div className="source-line muted small"><Icon name="shield" size={12} /> Public company data only · Human review required</div><Button variant="ghost" onClick={() => navigate('Knowledge & Market Insights', { tab: 'market' })}>See full prospect list</Button></div></section>}
    </div>
    {sources && <Modal wide title="Answer sources" subtitle="What the Copilot was given — it may only answer from this" onClose={() => setSources(null)} footer={<Button onClick={() => setSources(null)}>Close</Button>}>
      <div className="stack"><div><strong>Cited:</strong> {sources.sources?.join(', ') || 'none'} {sources.model && <Badge tone="info">{sources.model}</Badge>}</div>
        {sources.sources?.filter((x) => /^FW-/.test(x)).map((id) => { const f = FRAMEWORKS.find((y) => y.id === id); return f && <div key={id} className="ai-box"><div className="ai-head">{f.id} · {f.title}</div>{f.body}</div>; })}
        <details open><summary className="small"><strong>Live dashboard snapshot</strong></summary><pre style={{ fontSize: 9, background: '#f6f5f2', padding: 10, maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(buildLiveContext(s, m), null, 1)}</pre></details>
        <details><summary className="small"><strong>Matched past deals</strong></summary><pre style={{ fontSize: 9, whiteSpace: 'pre-wrap' }}>{pastDealsText(m)}</pre></details></div>
    </Modal>}
  </div>;
}

function CloseAndLearn() {
  const { s, act, toast } = useStore();
  const empty = { worked: '', didNot: '', day1OnTime: '', tsaExtended: '', lesson: '' };
  const [answers, setAnswers] = useState(empty);
  const [hide, setHide] = useState([s.deal.buyer, s.deal.seller, 'EDA Corp', ...s.users.filter((u) => u.role !== 'bank').map((u) => u.name), s.deal.name].join(', '));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AIResult<LearnOut> | null>(null);
  const [edited, setEdited] = useState('');
  const consent = s.consents['Anonymised learning record'];
  const loadSample = () => {
    const t = SAMPLE_FILES['19_Closing_Lessons_Rioja.txt'] ?? '';
    const get = (k: string) => (t.match(new RegExp(`${k}:\\s*(.*)`))?.[1] ?? '').trim();
    setAnswers({ worked: get('What worked'), didNot: get('What did not work'), day1OnTime: get('Was Day-1 on time'), tsaExtended: get('Was the TSA extended'), lesson: get('Key lesson') });
  };
  const loadFile = (f?: File) => f?.text().then((t) => { const get = (k: string) => (t.match(new RegExp(`${k}:\\s*(.*)`, 'i'))?.[1] ?? '').trim(); setAnswers({ worked: get('What worked'), didNot: get('What did not work'), day1OnTime: get('Was Day-1 on time'), tsaExtended: get('Was the TSA extended'), lesson: get('Key lesson') }); });
  const generate = async () => {
    setBusy(true);
    const r = await runAI(learningRecord, { answers: { 'What worked': answers.worked, 'What did not work': answers.didNot, 'Day-1 on time': answers.day1OnTime, 'TSA extended': answers.tsaExtended, lesson: answers.lesson }, hide: hide.split(',').map((x) => x.trim()).filter(Boolean), deal: { industry: s.deal.industry, dealType: s.deal.dealType, apps: s.datasets.applications?.rows.length ?? 0, budget: 1740000 } });
    setRes(r); setEdited(r.data.summary); setBusy(false);
  };
  const leaks = res ? hide.split(',').map((x) => x.trim()).filter((h) => h && edited.toLowerCase().includes(h.toLowerCase())) : [];
  const save = (approved: boolean) => {
    if (!res) return;
    const id = `${s.deal.industry.slice(0, 4).toUpperCase()}-${String((s.datasets.learning?.rows.length ?? 0) + 1).padStart(2, '0')}`;
    const blocked = consent !== 'Granted';
    act(blocked ? 'Learning record blocked (no consent)' : approved ? 'Data steward approved learning record' : 'Saved learning record draft', `${id}: ${res.data.keyLesson}`, (d) => {
      const draft: LearningDraft = { id: uid('LR'), answers: { ...answers }, record: { id, summary: edited, industry: d.deal.industry, dealType: d.deal.dealType, appsBand: '20-50 apps', sizeBand: '$1M to $2M separation budget', keyLesson: res.data.keyLesson, hiddenTerms: res.data.hiddenTerms }, status: blocked ? 'blocked' : approved ? 'saved' : 'anonymised', stewardNote: blocked ? 'Client has not consented to anonymised reuse' : undefined };
      d.learning.unshift(draft);
      if (approved && !blocked && d.datasets.learning) d.datasets.learning.rows.push({ _rid: uid('learning'), id, industry: d.deal.industry, dealType: d.deal.dealType, appsBand: '20-50 apps', sizeBand: '$1M to $2M separation budget', sites: d.deal.sites.length, day1OnTime: /^y/i.test(answers.day1OnTime), tsaExtended: /^y|extended by/i.test(answers.tsaExtended), licenceConsentWeek1: false, whatWorked: answers.worked.slice(0, 80), whatDidNot: answers.didNot.slice(0, 80), keyLesson: res.data.keyLesson, consent: true, approvedBy: d.currentUser });
    }, { kind: approved ? 'approve' : 'data', skipIssues: true });
    toast(blocked ? 'Not saved — client consent for anonymised reuse is missing' : approved ? `${id} saved to the knowledge hub` : 'Draft saved', blocked ? 'danger' : 'success');
    if (!blocked && approved) { setRes(null); setAnswers(empty); }
  };
  const Q = (k: keyof typeof answers, label: string) => <label className="field">{label}<textarea style={{ minHeight: 56 }} value={answers[k]} onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })} /></label>;
  return <div className="content-grid halves">
    <section className="card"><div className="card-header"><div><h2>Capture closing lessons</h2><p>5 questions answered by the team at deal close</p></div><div className="row"><Button variant="ghost" onClick={loadSample}>Load sample answers</Button><label className="btn secondary" style={{ cursor: 'pointer' }}><Icon name="upload" size={14} />Upload notes<input type="file" accept=".txt" hidden onChange={(e) => loadFile(e.target.files?.[0])} /></label></div></div>
      <div className="card-body stack">{Q('worked', '1. What worked?')}{Q('didNot', '2. What did not work?')}{Q('day1OnTime', '3. Was Day-1 on time?')}{Q('tsaExtended', '4. Was the TSA extended?')}{Q('lesson', '5. Key lesson')}
        <label className="field">Names to hide (comma separated)<input value={hide} onChange={(e) => setHide(e.target.value)} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button icon="spark" loading={busy} disabled={!answers.lesson.trim()} onClick={generate}>Generate anonymised record</Button></div></div></section>
    <section className="card"><div className="card-header"><div><h2>Learning Record</h2><p>AI anonymises · a data steward reviews · saved only with client consent</p></div><div className="row"><AIChip result={res} /><Badge tone={consent === 'Granted' ? 'success' : 'danger'}>Consent: {consent}</Badge></div></div>
      <div className="card-body stack">{res ? <>
        <label className="field">Anonymised record (steward can edit)<textarea style={{ minHeight: 170 }} value={edited} onChange={(e) => setEdited(e.target.value)} /></label>
        <div className="ai-box"><div className="ai-head">Key lesson</div>{res.data.keyLesson}</div>
        <div className="small"><strong>Hidden / rounded:</strong> {res.data.hiddenTerms.map((t) => <span className="chip" key={t} style={{ margin: 2 }}>{t}</span>)}</div>
        {leaks.length > 0 && <div className="ai-box" style={{ borderLeftColor: 'var(--red)' }}><div className="ai-head"><Icon name="alert" size={14} />Identifying detail still present</div>{leaks.join(', ')} — remove before approval.</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => save(false)}>Save draft</Button><Button icon="check" disabled={leaks.length > 0} onClick={() => save(true)}>Steward approve & save</Button></div>
      </> : <p className="muted small">Generate a record from the closing answers. Client and people names become codes and exact numbers become ranges.</p>}
        {s.learning.length > 0 && <><h3 className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 0 }}>Records from this deal</h3>{s.learning.map((l) => <div key={l.id} className="lesson-card"><header><strong>{l.record?.id}</strong><Badge tone={l.status === 'saved' ? 'success' : l.status === 'blocked' ? 'danger' : 'neutral'}>{l.status}</Badge></header><span className="muted">{l.record?.keyLesson}</span>{l.stewardNote && <span className="small" style={{ color: 'var(--red)' }}>{l.stewardNote}</span>}</div>)}</>}
      </div></section>
  </div>;
}

function Library() {
  const { m } = useStore();
  const [ind, setInd] = useState('All');
  const list = m.matches.filter((x) => ind === 'All' || x.record.industry === ind);
  return <>
    <section className="card mb"><div className="card-header"><div><h2>Framework library</h2><p>PwC methods the Copilot is grounded on</p></div><Badge tone="info">{FRAMEWORKS.length} frameworks</Badge></div>
      <div className="grid-3 card-body">{FRAMEWORKS.map((f) => <div key={f.id} className="lesson-card"><header><strong>{f.title}</strong><Badge>{f.stage}</Badge></header><span className="muted">{f.body}</span><small className="muted">{f.id}</small></div>)}</div></section>
    <section className="card"><div className="card-header"><div><h2>Past deal cards</h2><p>Matched to this deal by industry, deal type and size</p></div><select className="inline" value={ind} onChange={(e) => setInd(e.target.value)}><option>All</option>{[...new Set(m.learning.map((r) => r.industry))].map((x) => <option key={x}>{x}</option>)}</select></div>
      {list.length ? <div className="grid-3 card-body">{list.map(({ record: r, score }) => <div key={r._rid} className="lesson-card"><header><strong>{r.id}</strong><Badge tone={score >= 85 ? 'success' : score >= 50 ? 'warning' : 'neutral'}>{score}% match</Badge></header><span className="muted small">{r.industry} · {r.dealType} · {r.appsBand} · {r.sizeBand}</span><span><b>Lesson:</b> {r.keyLesson}</span><span className="small">Worked: {r.whatWorked} · Didn't: {r.whatDidNot}</span><span className="row"><Badge tone={r.day1OnTime ? 'success' : 'danger'}>Day-1 {r.day1OnTime ? 'on time' : 'late'}</Badge><Badge tone={r.tsaExtended ? 'warning' : 'success'}>TSA {r.tsaExtended ? 'extended' : 'on time'}</Badge></span></div>)}</div> : <Empty title="No learning records">Upload 16_Past_Learning_Records.json.</Empty>}
    </section>
  </>;
}

function Market() {
  const { s, m, act, toast } = useStore();
  const [notes, setNotes] = useState<Record<string, AIResult<{ note: string }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [n, setN] = useState(12);
  const write = async (p: (typeof m.prospects)[number]) => {
    setBusy(p.row._rid);
    const r = await runAI(prospectNote, { company: p.row.company, sector: p.row.sector, score: p.score, drivers: p.drivers });
    setNotes({ ...notes, [p.row._rid]: r }); setBusy(null);
    act('Drafted outreach rationale', p.row.company, () => {}, { kind: 'ai', skipIssues: true, allowReadOnly: true });
  };
  return <>
    <div className="content-grid halves">
      <section className="card"><div className="card-header"><div><h2>Benchmarks by industry</h2><p>Anonymised past deals · {s.consents['Benchmark contribution'] === 'Granted' ? 'this deal contributes' : 'this deal not yet contributing (consent pending)'}</p></div></div>
        <Table cols="1.4fr 70px 1.5fr 90px" head={['Industry', 'Deals', 'Day-1 on time', 'TSA extended']}>{m.bench.industries.map((b) => <div className="tr" key={b.industry}><span>{b.industry}</span><span>{b.deals}</span><span className="row"><Progress value={b.onTime} tone={b.onTime >= 75 ? 'green' : 'amber'} /><strong>{b.onTime}%</strong></span><span>{b.tsaExtended}%</span></div>)}</Table>
        <div className="card-body small">Overall Day-1 on-time rate: <strong>{m.bench.onTime}%</strong> · Consent in week 1: <strong>{m.bench.week1}%</strong> vs late: <strong>{m.bench.late}%</strong></div></section>
      <section className="card"><div className="card-header"><div><h2>Board scorecard (pitch sample)</h2><p>Anonymised version of this deal's readiness scorecard for client pitches</p></div></div>
        <div className="card-body stack"><p className="small" style={{ margin: 0 }}>{s.consents['Marketing case study'] === 'Granted' ? 'Client consented to marketing use.' : 'Marketing use is NOT consented — the scorecard is for internal and client-board use only.'}</p><Button variant="secondary" icon="download" onClick={() => openPrintable('Scorecard', scorecardHtml(s, m)) ? toast('Scorecard opened') : toast('Allow pop-ups', 'warning')}>Open scorecard</Button></div></section>
    </div>
    <section className="card"><div className="card-header"><div><h2>Prospect list</h2><p>Prowess-style signals: many segments, a loss-making segment, high debt, declining margins, strategic review</p></div><Badge tone="info">Public data only · human review</Badge></div>
      {m.prospects.length ? <Table cols="40px 1.4fr 1fr 60px 2.4fr 2.4fr" head={['Score', 'Company', 'Sector', 'Segs', 'Drivers', 'Outreach rationale']}>{m.prospects.slice(0, n).map((p) => <div className="tr" key={p.row._rid}><span><strong style={{ fontSize: 14, color: p.score >= 7 ? 'var(--orange-dark)' : undefined }}>{p.score}</strong></span><span><strong>{p.row.company}</strong><small>Revenue ${p.row.revenue}M · D/E {p.row.debt_equity}</small></span><span>{p.row.sector}</span><span>{p.row.segments}</span><span className="small">{p.drivers.join(', ') || '—'}</span><span className="small">{notes[p.row._rid] ? <>{notes[p.row._rid].data.note} <AIChip result={notes[p.row._rid]} /></> : <Button variant="ghost" icon="spark" loading={busy === p.row._rid} onClick={() => write(p)}>Draft rationale</Button>}</span></div>)}</Table> : <Empty title="No prospect data">Upload 15_Prospect_Universe.csv.</Empty>}
      {m.prospects.length > n && <div className="table-footer"><span>{n} of {m.prospects.length}</span><Button variant="secondary" onClick={() => setN(n + 20)}>Show more</Button></div>}
    </section>
  </>;
}
