import { useMemo, useState, type ReactNode } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { fundAfford, fundBankAnswer, fundBankPack, fundLesson, fundMilestone, fundSettle, fundUnderstand, spaReader, tsaAdvice, type FinRow, type FundLine } from '../ai/tasks';
import { DecisionLog } from '../components/DecisionLog';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Menu, PageTitle, Progress, Table, Tabs } from '../components/ui';
import type { DatasetKey } from '../engine/glossary';
import { ROADMAP_12, WAVES } from '../engine/model';
import type { FundingFlow as Flow, WorkspaceState } from '../engine/types';
import { addDays, fmtDate, money, uid } from '../engine/util';
import { useStore } from '../state/store';

export function Funding() {
  const { s, m, params, readOnly } = useStore();
  const bank = s.role === 'bank';
  const [tab, setTab] = useState(bank ? 'flow' : params.tab === 'costs' || params.tab === 'funding' ? 'flow' : params.tab ?? 'flow');
  const [upload, setUpload] = useState<DatasetKey | null>(null);
  const consent = s.consents['Bank funding summary'] === 'Granted';
  return <>
    <PageTitle eyebrow="Fund & exit" title="Funding & TSA Exit" description="When a cost is disputed, keep going: a bank lends the money against deal progress, the seller's likely share sits safely in escrow, and the argument is settled later." action={<>{consent ? <Badge tone="success"><Icon name="shield" size={13} /> Bank sharing consented</Badge> : <Badge tone="warning">Bank sharing not yet consented</Badge>}{!readOnly && <Menu trigger={<Button variant="secondary" icon="upload">Upload data</Button>} items={[{ label: 'Cost register (07)', icon: 'file', onClick: () => setUpload('costs') }, { label: 'SPA clauses (18)', icon: 'file', onClick: () => setUpload('spa') }, { label: 'TSA schedule (08)', icon: 'file', onClick: () => setUpload('tsa') }, { label: 'Product revenue (13)', icon: 'file', onClick: () => setUpload('products') }, { label: 'Prowess financials (14)', icon: 'file', onClick: () => setUpload('financials') }]} />}</>} />
    <Tabs value={tab} onChange={setTab} tabs={bank ? [{ key: 'flow', label: 'Funding flow' }] : [{ key: 'flow', label: 'Funding flow', count: m.disputed.filter((l) => !s.funding.flows?.[l.row.cost_id]?.settle?.settled).length }, { key: 'tsa', label: 'TSA exit', count: m.tsa.filter((t) => t.risk).length }, { key: 'waves', label: 'Migration waves' }, { key: 'products', label: 'Product priority' }, { key: 'log', label: 'Decision log' }]} />
    {tab === 'flow' && <FundingFlowView initialCost={params.cost} />}
    {tab === 'tsa' && !bank && <TsaExit />}
    {tab === 'waves' && !bank && <Waves />}
    {tab === 'products' && !bank && <Products />}
    {tab === 'log' && !bank && <DecisionLog modules={['Funding & TSA Exit']} title="Funding & TSA decisions" subtitle="Path choices, consents, releases, settlements, TSA and wave decisions — undo any of them" />}
    {upload && <UploadModal expected={upload} onClose={() => setUpload(null)} />}
  </>;
}

function AIText({ text, source, onChange, rows = 4 }: { text: string; source?: string; onChange?: (t: string) => void; rows?: number }) {
  return <div className="stack" style={{ gap: 4 }}>
    {onChange ? <textarea className="inline" style={{ width: '100%', minHeight: rows * 18, fontSize: 10.5, lineHeight: 1.55, padding: 8, border: '1px solid #cfcdc8' }} value={text} onChange={(e) => onChange(e.target.value)} /> : <div className="ai-box">{text}</div>}
    {source && <span className={`ai-chip ${source.startsWith('Gemini') ? '' : 'fallback'}`} style={{ alignSelf: 'flex-start' }}><Icon name="spark" size={10} />{source}</span>}
  </div>;
}
const srcOf = (r: AIResult<unknown>) => (r.source === 'gemini' ? `Gemini · ${r.model}` : 'Rule-based fallback');

const BANK_FIELDS = ['Deal summary', 'Financial health (both companies)', 'Day-1 progress & blockers', 'How the bank gets repaid (escrow)'];

type Stage = 'understand' | 'decide' | 'fund' | 'settle' | 'learn';
const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: 'understand', label: 'Understand', hint: 'What is it, and can they pay?' },
  { key: 'decide', label: 'Decide', hint: 'Agree the bank plan' },
  { key: 'fund', label: 'Get the money', hint: 'Bank lends at milestones' },
  { key: 'settle', label: 'Settle', hint: 'Who finally pays' },
  { key: 'learn', label: 'Learn', hint: 'Save the lesson' },
];
interface StepDef { key: string; stage: Stage; lane?: 'A' | 'B'; title: string; plain: string; who: string; ai?: boolean; done: boolean; ready: boolean; waitsFor: string; body: ReactNode; /** false = open but waiting on something outside the flow (e.g. a milestone) */ actionable?: boolean }

/** Short progress for a cost card: 5 milestones (explained, affordability, path, settled, lesson). */
function flowProgress(f?: Flow) {
  const marks = [!!f?.step1, !!f?.step2, !!f?.path, !!f?.settle?.settled, !!f?.learn?.saved];
  const n = marks.filter(Boolean).length;
  const label = f?.learn?.saved ? 'Closed' : f?.settle?.settled ? 'Settled — save the lesson' : f?.path ? 'Bank funding in progress' : f?.step1 ? 'Being assessed' : 'Not started';
  return { pct: Math.round((n / marks.length) * 100), label };
}

function FundingFlowView({ initialCost }: { initialCost?: string }) {
  const { s, m, act, toast, readOnly } = useStore();
  const bank = s.role === 'bank';
  const lines = m.sepLines.filter((l) => l.disputed || s.funding.flows?.[l.row.cost_id]?.path);
  const [costId, setCostIdRaw] = useState(initialCost && lines.some((l) => l.row.cost_id === initialCost) ? initialCost : lines[0]?.row.cost_id);
  const [pick, setPick] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const setCostId = (id: string) => { setCostIdRaw(id); setPick(null); setSeen(null); };
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const L = s.deal.milestoneLabel;
  const line = lines.find((l) => l.row.cost_id === costId);
  const flow: Flow = (costId && s.funding.flows?.[costId]) || { costId: costId ?? '' };
  const app = line ? m.byId.get(line.row.app_id) : undefined;
  const fin: FinRow[] = m.fin.map((f) => ({ company: f.row.company, role: f.row.role, cash: f.cash, de: f.de, cr: f.cr, ic: f.ic, tight: f.tight }));
  const buyerFin = fin.find((f) => /buyer/i.test(f.role));
  const sellerFin = fin.find((f) => /seller/i.test(f.role));
  const needBy = addDays(s.deal.day1, -3);
  const daysLeft = Math.round((new Date(needBy).getTime() - new Date(s.deal.asOf).getTime()) / 864e5);
  const fl: FundLine | null = line ? { costId: line.row.cost_id, description: line.row.description, amount: line.amount, appName: app?.name ?? line.row.app_id, component: app?.component ?? '', critical: !!app?.day1Critical, site: app?.site ?? '', needBy: fmtDate(needBy, true), milestone: L, buyer: s.deal.buyer, seller: s.deal.seller, sellerPct: line.share } : null;

  if (!line || !fl) return <Empty title="No disputed costs right now">When a separation cost line is marked Disputed in the cost register, it arrives here automatically and the funding flow starts.</Empty>;

  const upd = (action: string, detail: string, fn: (f: Flow, d: WorkspaceState) => void, kind: 'data' | 'approve' | 'override' = 'data') => act(action, `${line.row.description} · ${detail}`, (d) => {
    d.funding.flows = d.funding.flows ?? {};
    const f = d.funding.flows[costId!] ?? (d.funding.flows[costId!] = { costId: costId! });
    fn(f, d);
  }, { kind, skipIssues: true, allowReadOnly: bank });
  const ai = async <I, O>(key: string, task: Parameters<typeof runAI<I, O>>[0], input: I) => { setBusy(key); const r = await runAI(task, input); setBusy(null); return r; };

  const usesA = !!flow.path;
  const facility = line.amount;
  const escrow = Math.round(line.amount * line.share);
  const ctx = { milestone: L, date: fmtDate(s.deal.day1, true), score: m.score, signal: m.signal, blockers: m.criticalBlocked.length, seller: s.deal.seller, buyer: s.deal.buyer, escrow, tranche: Math.round(facility / 2) };
  const m1 = m.criticalBlocked.length === 0, m2 = m.signal === 'GO';
  const released = (flow.a4?.released ?? []).filter(Boolean).length;
  const aDone = !!flow.a4?.released?.every(Boolean) || (!!flow.a3?.decision && flow.a3.decision !== 'declined' && released > 0);
  const pathsDone = !!flow.path && !!flow.a3?.decision;
  const defaultQuestions = [`What happens to the facility if ${L} slips?`, 'What secures repayment?', 'How reliable is the readiness score?'];
  const sellerPct = Math.round((flow.settle?.sellerPct ?? line.share) * 100);

  const fitA: [string, boolean][] = [[`${s.deal.buyer} is short of cash after the purchase`, !!buyerFin?.tight], ['The argument should be settled within a few months', true], [`${s.deal.seller} can park its likely share in escrow`, !sellerFin?.tight], [`The amount is large (${money(line.amount)})`, line.amount >= 500000]];

  const steps: StepDef[] = [
    { key: 's1', stage: 'understand', title: 'What are we paying for?', plain: 'Get a plain-English picture of the cost: what it buys, when it is needed and what stops if it is late.', who: 'AI explains · you read', ai: true, done: !!flow.step1, ready: true, waitsFor: '',
      body: flow.step1 ? <AIText text={flow.step1.text} source={flow.step1.source} /> : <Button icon="spark" loading={busy === 's1'} disabled={readOnly} onClick={async () => { const r = await ai('s1', fundUnderstand, { line: fl }); upd('Funding step 1: cost explained', r.data.text, (f) => { f.step1 = { text: r.data.text, source: srcOf(r) }; }); }}>Explain this cost</Button> },
    { key: 's2', stage: 'understand', title: 'Can each side afford it?', plain: 'Check both companies’ finances (Prowess). If the buyer is cash-tight, paying upfront would hurt — so we look for financing.', who: 'Prowess data · AI summary', ai: true, done: !!flow.step2, ready: !!flow.step1, waitsFor: 'What are we paying for?',
      body: <><div className="afford-grid">{fin.map((f) => <div key={f.company} className={`afford-card ${f.tight ? 'tight' : 'ok'}`}><span className="eyebrow">{f.role}</span><strong>{f.company}</strong><span className="verdict">{f.tight ? 'Cash tight — needs financing' : 'Can absorb the cost'}</span><dl><div><dt>Cash</dt><dd>{money(f.cash * 1e6)}</dd></div><div><dt>Debt / equity</dt><dd>{f.de}</dd></div><div><dt>Current ratio</dt><dd>{f.cr}</dd></div><div><dt>Interest cover</dt><dd>{f.ic}x</dd></div></dl></div>)}</div>
        <p className="muted small" style={{ margin: 0 }}>“Cash tight” = current ratio below 1, debt / equity above 1.5 or interest cover below 3.</p>
        {flow.step2 ? <AIText text={flow.step2.text} source={flow.step2.source} /> : <Button icon="spark" loading={busy === 's2'} disabled={readOnly} onClick={async () => { const r = await ai('s2', fundAfford, { line: fl, fin }); upd('Funding step 2: affordability summarised', r.data.text, (f) => { f.step2 = { text: r.data.text, source: srcOf(r) }; }); }}>Summarise in plain words</Button>}</> },
    { key: 's3', stage: 'decide', title: 'Agree the bank funding plan', plain: `Neither side wants to pay while they argue, so a bank lends the money now and ${L} stays on track. ${s.deal.seller}’s likely share is held in escrow from the purchase price, so the bank knows how it will be repaid. The engagement manager and the client CFO confirm the plan.`, who: 'EM + client CFO decide', done: !!flow.path, ready: !!flow.step2, waitsFor: 'Can each side afford it?',
      body: <>
        <div className={`option-card ${flow.path ? 'chosen' : ''}`}>
          <span className="option-icon"><Icon name="funding" /></span>
          <h3>Bank funding with escrow</h3>
          <ol className="plan-steps">
            <li><b>The bank lends {money(facility)}</b> in two halves, released as the deal hits its milestones.</li>
            <li><b>{money(escrow)} goes into escrow</b> — {s.deal.seller}’s likely {Math.round(line.share * 100)}% share, held back from the purchase price by a neutral agent.</li>
            <li><b>Nobody pays new cash</b> while the argument goes on; interest builds up on the loan.</li>
            <li><b>When the dispute is settled</b>, escrow repays {s.deal.seller}’s agreed share (plus its share of interest), the rest of the escrow goes back to {s.deal.seller}, and {s.deal.buyer} repays its own share.</li>
          </ol>
          <div className="fit"><span>Why this fits</span><b>{fitA.filter(([, ok]) => ok).length}/4</b></div>
          <ul>{fitA.map(([c, ok]) => <li key={c} className={ok ? 'ok' : ''}><Icon name={ok ? 'check' : 'x'} size={12} />{c}</li>)}</ul>
          <Button variant={flow.path ? 'primary' : 'secondary'} disabled={readOnly || !!flow.path} onClick={() => upd('Bank funding plan agreed', `facility ${money(facility)} · escrow ${money(escrow)}`, (f, d) => { f.path = 'underwriting'; f.decidedBy = d.currentUser; }, 'approve')}>{flow.path ? 'Plan agreed' : 'Confirm bank funding'}</Button>
        </div>
        {flow.decidedBy && <span className="muted small">Agreed by {flow.decidedBy}</span>}</> },
  ];

  if (usesA) steps.push(
    { key: 'a1', stage: 'fund', title: 'Prepare the bank summary', plain: 'AI drafts a short pack for the bank from live deal data. You edit and approve it — nothing is sent yet.', who: 'AI drafts · EM approves', ai: true, done: !!flow.a1?.approved, ready: true, waitsFor: '',
      body: flow.a1 ? <><AIText text={draft.a1 ?? flow.a1.pack} source={flow.a1.source} onChange={flow.a1.approved || readOnly ? undefined : (t) => setDraft({ ...draft, a1: t })} rows={12} />
        {!flow.a1.approved && <div className="row"><Button icon="check" disabled={readOnly} onClick={() => { upd('Bank pack approved by EM', 'pack reviewed', (f) => { f.a1 = { ...f.a1!, pack: draft.a1 ?? f.a1!.pack, approved: true }; }, 'approve'); toast('Bank pack approved — next, the client approves what the bank may see'); }}>Approve pack</Button></div>}</>
        : <Button icon="spark" loading={busy === 'a1'} disabled={readOnly} onClick={async () => { const r = await ai('a1', fundBankPack, { line: fl, afford: flow.step2?.text ?? '', readiness: { score: m.score, signal: m.signal, blockers: m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => `${i.app.name}: ${b.title}`)) }, escrow }); upd('Bank pack drafted', 'AI draft', (f) => { f.a1 = { pack: r.data.pack, source: srcOf(r), approved: false }; }); }}>Draft bank summary</Button> },
    { key: 'a2', stage: 'fund', title: 'Client approves what the bank sees', plain: 'The client CFO ticks exactly what may be shared. PwC confirms there is no conflict of interest and takes no fee.', who: 'Client CFO · PwC Independence', done: !!flow.a2?.consented, ready: !!flow.a1?.approved, waitsFor: 'Prepare the bank summary',
      body: <><div className="consent-list">{BANK_FIELDS.map((f) => <label key={f}><input type="checkbox" disabled={!!flow.a2?.consented || readOnly} checked={flow.a2?.fields?.[f] ?? true} onChange={(e) => upd('Bank consent scope changed', `${f}: ${e.target.checked ? 'shared' : 'withheld'}`, (x) => { x.a2 = { fields: { ...Object.fromEntries(BANK_FIELDS.map((k) => [k, true])), ...x.a2?.fields, [f]: e.target.checked }, consented: false, independence: x.a2?.independence ?? false }; })} /><span>{f}</span></label>)}
        <label className="never"><input type="checkbox" disabled checked={false} /><span>App lists & employee data — never shared</span></label></div>
        <label className="row small check-line"><input type="checkbox" disabled={!!flow.a2?.consented || readOnly} checked={!!flow.a2?.independence} onChange={(e) => upd('Independence check recorded', e.target.checked ? 'no conflict between bank and client; PwC takes no fee' : 'unchecked', (x) => { x.a2 = { fields: x.a2?.fields ?? Object.fromEntries(BANK_FIELDS.map((k) => [k, true])), consented: false, independence: e.target.checked }; })} />PwC Independence: no conflict between bank and client · PwC takes no fee</label>
        {flow.a2?.consented ? <Badge tone="success">Consented — shared with {s.users.find((u) => u.role === 'bank')?.name ?? 'the bank'}</Badge> : <div><Button icon="shield" disabled={!flow.a2?.independence || readOnly} onClick={() => { upd('Client CFO consented to bank sharing', BANK_FIELDS.filter((f) => flow.a2?.fields?.[f] ?? true).join(', '), (x, d) => { x.a2 = { ...x.a2!, consented: true }; d.consents['Bank funding summary'] = 'Granted'; }, 'approve'); toast('Consent recorded — the bank can now see the approved summary'); }}>CFO approves sharing</Button>{!flow.a2?.independence && <span className="muted small" style={{ marginLeft: 8 }}>Tick the independence check first</span>}</div>}</> },
    { key: 'a3', stage: 'fund', title: 'Bank asks questions & decides', plain: 'The bank reviews the summary. AI drafts answers from live data; you approve each one before it goes. Then the bank records its credit decision.', who: 'Bank credit team · AI drafts answers', ai: true, done: !!flow.a3?.decision, ready: !!flow.a2?.consented, waitsFor: 'Client approves what the bank sees',
      body: <>{bank && flow.a1 && <div className="ai-box"><div className="ai-head"><Icon name="lock" size={13} />Consented bank pack</div>{flow.a1.pack.split('\n\n').filter((sec, i) => flow.a2?.fields?.[BANK_FIELDS[i]] ?? true).join('\n\n')}</div>}
        {(flow.a3?.questions ?? defaultQuestions.map((q) => ({ q } as { q: string; answer?: string; sent?: boolean }))).map((q, i) => <div key={i} className="qa-card"><div className="q"><Icon name="bell" size={13} /><strong>{q.q}</strong>{q.sent && <Badge tone="success">Sent</Badge>}</div>
          {q.answer ? <AIText text={draft[`q${i}`] ?? q.answer} onChange={q.sent || readOnly ? undefined : (t) => setDraft({ ...draft, [`q${i}`]: t })} rows={3} /> : !bank && <Button variant="secondary" icon="spark" loading={busy === `q${i}`} disabled={readOnly} onClick={async () => { const r = await ai(`q${i}`, fundBankAnswer, { question: q.q, context: ctx }); upd('Drafted answer to bank question', q.q, (f) => { const qs: { q: string; answer?: string; sent?: boolean }[] = f.a3?.questions ?? defaultQuestions.map((x) => ({ q: x })); qs[i] = { ...qs[i], answer: r.data.answer }; f.a3 = { ...f.a3, questions: qs }; }); }}>Draft answer from live data</Button>}
          {q.answer && !q.sent && !bank && <div><Button disabled={readOnly} onClick={() => upd('Answer approved and sent to bank', q.q, (f) => { const qs = f.a3!.questions; qs[i] = { ...qs[i], answer: draft[`q${i}`] ?? qs[i].answer, sent: true }; }, 'approve')}>Approve & send</Button></div>}</div>)}
        <div className="decision-row"><span>Bank credit decision</span>{(['approved', 'approved_with_conditions', 'declined'] as const).map((dcs) => <Button key={dcs} variant={flow.a3?.decision === dcs ? 'primary' : 'secondary'} disabled={!flow.a2?.consented || (readOnly && !bank)} onClick={() => upd('Bank credit decision recorded', dcs.replace(/_/g, ' '), (f) => { f.a3 = { questions: f.a3?.questions ?? defaultQuestions.map((x) => ({ q: x })), ...f.a3, decision: dcs }; }, 'approve')}>{dcs === 'approved' ? 'Approved' : dcs === 'approved_with_conditions' ? 'Approved with conditions' : 'Declined'}</Button>)}</div></> },
    { key: 'a4', stage: 'fund', title: 'Bank releases money at milestones', plain: `The money comes in two halves, each released when the deal proves progress. The milestones are read live from the dashboard.`, who: 'Bank releases · AI watches the dashboard', ai: true, done: aDone, ready: !!flow.a3?.decision && flow.a3.decision !== 'declined', actionable: (m1 && !flow.a4?.released?.[0]) || (m2 && !flow.a4?.released?.[1]), waitsFor: 'Bank asks questions & decides',
      body: <><div className="tranches">{[[`1st half — critical blocker cleared`, m1, m1 ? 'No critical item is blocked' : `Still blocked: ${m.criticalBlocked.map((i) => i.app.name).join(', ')}`], [`2nd half — board gives a GO for ${L}`, m2, `Readiness ${m.score}/100 (${m.signal})`]].map(([label, met, ev], i) => { const rel = flow.a4?.released?.[i]; return <div key={i} className={`tranche ${rel ? 'released' : met ? 'met' : ''}`}>
        <span className="tranche-amt">{money(facility / 2)}</span><strong>{label as string}</strong><span className="muted small">{ev as string}</span>
        {rel ? <Badge tone="success">Released</Badge> : <><Badge tone={met ? 'success' : 'neutral'}>{met ? 'Milestone met' : 'Waiting for milestone'}</Badge>
          <div className="row wrap"><Button variant="secondary" icon="spark" disabled={!met} loading={busy === `m${i}`} onClick={async () => { const r = await ai(`m${i}`, fundMilestone, { milestone: label as string, context: ctx }); upd('Milestone update drafted for bank', r.data.update, (f) => { f.a4 = { released: f.a4?.released ?? [false, false], updates: [...(f.a4?.updates ?? []), r.data.update] }; }); }}>Draft update</Button>
          <Button disabled={!met || (readOnly && !bank)} onClick={() => { upd(`Tranche ${i + 1} released`, `${money(facility / 2)} — ${label}`, (f) => { const r2 = [...(f.a4?.released ?? [false, false])]; r2[i] = true; f.a4 = { released: r2, updates: f.a4?.updates ?? [] }; }, 'approve'); toast(`${money(facility / 2)} released`); }}>Release</Button></div></>}
      </div>; })}</div>
        {!m1 && <p className="muted small" style={{ margin: 0 }}>Clear the blocked item in the Execution Tracker to unlock the first half.</p>}
        {(flow.a4?.updates ?? []).map((u, i) => <div key={i} className="ai-box">{u}</div>)}</> },
  );

  if (!bank) steps.push(
    { key: 'settle', stage: 'settle', title: 'Who finally pays?', plain: 'Buyer and seller agree the final split — by reading the contract (SPA), negotiating, or at the deal board. Then the escrow repays the seller’s share of the loan, the rest of the escrow goes back to the seller, and the buyer repays its own share.', who: 'SPA reading / negotiation · AI drafts', ai: true, done: !!flow.settle?.settled, ready: pathsDone, waitsFor: flow.path ? 'the funding steps above' : 'Agree the bank funding plan',
      body: <SettleStep line={line} flow={flow} upd={upd} facility={facility} /> },
    { key: 'learn', stage: 'learn', title: 'Save the lesson', plain: 'AI writes an anonymised lesson (no names, no exact amounts) for future deals. You approve it into the knowledge library.', who: 'AI writes · you approve', ai: true, done: !!flow.learn?.saved, ready: !!flow.settle?.settled, waitsFor: 'Who finally pays?',
      body: flow.learn ? <><AIText text={flow.learn.lesson} source={flow.learn.source} />{flow.learn.saved ? <Badge tone="success">Added to the knowledge library</Badge> : <div><Button icon="check" disabled={readOnly} onClick={() => upd('Funding lesson added to knowledge library', flow.learn!.lesson, (f, d) => { f.learn = { ...f.learn!, saved: true }; d.learning.unshift({ id: uid('LR'), answers: { worked: flow.learn!.lesson, didNot: '', day1OnTime: '', tsaExtended: '', lesson: flow.learn!.lesson }, record: { id: `FUND-${d.learning.length + 1}`, summary: flow.learn!.lesson, industry: d.deal.industry, dealType: d.deal.dealType, appsBand: '', sizeBand: line.amount < 1e6 ? '<₹1M' : '₹1M to ₹5M', keyLesson: flow.learn!.lesson, hiddenTerms: [d.deal.buyer, d.deal.seller] }, status: 'anonymised' }); }, 'approve')}>Add to knowledge library</Button></div>}</>
        : <Button icon="spark" loading={busy === 'l'} disabled={readOnly} onClick={async () => { const r = await ai('l', fundLesson, { facts: { path: flow.path, milestone: L, band: line.amount < 1e6 ? 'sub-₹1M' : '₹1M+', settled: flow.settle?.method } }); upd('Funding lesson drafted', r.data.lesson, (f) => { f.learn = { lesson: r.data.lesson, source: srcOf(r), saved: false }; }); }}>Write lesson</Button> },
  );

  const visible = bank ? steps.filter((x) => x.key === 'a3' || x.key === 'a4') : steps;
  const can = (x: StepDef) => !x.done && x.ready && x.actionable !== false;
  const auto = visible.find(can) ?? visible.find((x) => !x.done && x.ready) ?? visible.find((x) => !x.done) ?? visible[visible.length - 1];
  // Keep a step on screen after it is completed so its result can be read; "Next" moves on.
  const seenStep = seen ? visible.find((x) => x.key === seen) : undefined;
  if (seenStep?.done) { if (pick !== seen) setPick(seen); setSeen(null); }
  const focus = visible.find((x) => x.key === pick && (x.done || x.ready)) ?? auto;
  if (focus && !focus.done && seen !== focus.key && !(seenStep?.done)) setSeen(focus.key);
  const fi = visible.findIndex((x) => x.key === focus?.key);
  const nextAfter = visible.slice(fi + 1).find(can) ?? visible.find((x) => can(x) && x.key !== focus?.key) ?? visible.find((x) => !x.done && x.ready && x.key !== focus?.key);
  const stageState = (st: Stage) => { const ss = visible.filter((x) => x.stage === st); if (!ss.length) return st === 'fund' && !flow.path ? 'todo' : 'skip'; return ss.every((x) => x.done) ? 'done' : ss.some((x) => x.key === auto?.key) ? 'current' : 'todo'; };
  const doneCount = visible.filter((x) => x.done).length;

  return <div className="fdesk">
    {lines.length > 1 && <div className="cost-cards">{lines.map((l) => { const p = flowProgress(s.funding.flows?.[l.row.cost_id]); return <button key={l.row.cost_id} className={l.row.cost_id === costId ? 'active' : ''} onClick={() => setCostId(l.row.cost_id)}>
      <span className="eyebrow">{l.row.cost_id} · disputed</span><strong>{l.row.description}</strong><b>{money(l.amount)}</b>
      <span className="cc-progress"><Progress value={p.pct} tone={p.pct === 100 ? 'green' : 'orange'} /><small>{p.label}</small></span></button>; })}</div>}

    <div className="journey">{STAGES.map((st, i) => { const state = stageState(st.key); return <div key={st.key} className={`jstage ${state}`}><span className="jdot">{state === 'done' ? <Icon name="check" size={13} /> : i + 1}</span><div><strong>{st.label}</strong><small>{state === 'skip' ? 'Not needed' : st.hint}</small></div></div>; })}</div>

    <div className="fdesk-grid">
      <div className="stack" style={{ gap: 14, minWidth: 0 }}>
      <section className="card next-action">
        {!visible.length && <div className="na-head"><span className="na-kicker"><Icon name="lock" size={12} /> Nothing shared yet</span><h2>{bank ? 'Waiting for the client to share this cost' : 'No steps yet'}</h2><p>{bank ? `${s.deal.buyer}'s CFO has not yet chosen the bank route for this cost or approved what you may see. You'll see the summary and can record a credit decision as soon as they consent.` : 'Choose a cost above to begin.'}</p></div>}
        {focus && <>
          <div className="na-head">
            <span className="na-kicker">{focus.done ? <><Icon name="check" size={12} /> Done</> : focus.key === auto?.key ? 'Your next step' : 'Step'} · {STAGES.find((x) => x.key === focus.stage)?.label}</span>
            <h2>{focus.title}{focus.ai && <span className="ai-chip"><Icon name="spark" size={10} />AI helps</span>}</h2>
            <p>{focus.plain}</p>
            <span className="na-who"><Icon name="users" size={13} />{focus.who}</span>
          </div>
          <div className="na-body">{focus.body}</div>
          {focus.done && <div className="na-foot"><span className="small"><Icon name="check" size={13} /> This step is complete.</span>{nextAfter ? <Button icon="arrow" onClick={() => setPick(nextAfter.key)}>Next: {nextAfter.title}</Button> : visible.every((x) => x.done) ? <Badge tone="success">All steps done for this cost</Badge> : <span className="small muted">Remaining steps are waiting on milestones or other people.</span>}</div>}
          {!focus.done && focus.ready && focus.actionable === false && <div className="na-foot"><span className="small muted"><Icon name="clock" size={13} /> Waiting for a milestone on the dashboard.</span>{nextAfter && <Button variant="secondary" icon="arrow" onClick={() => setPick(nextAfter.key)}>Meanwhile: {nextAfter.title}</Button>}</div>}
          {!focus.done && !focus.ready && <div className="na-foot"><span className="small muted"><Icon name="lock" size={13} /> Unlocks after “{focus.waitsFor}”.</span></div>}
        </>}
      </section>
      {(() => { const upcoming = visible.filter((x) => !x.done && x.key !== focus?.key).slice(0, 4); return upcoming.length > 0 && <section className="card coming-up"><div className="card-header"><div><h2>Coming up</h2><p>What happens after this, and who acts</p></div></div>
        <ol>{upcoming.map((x) => <li key={x.key}><span className={`cu-dot ${x.ready ? 'open' : ''}`} /><div><strong>{x.title}</strong><small>{x.who}</small></div>{x.ready ? <Button variant="ghost" onClick={() => setPick(x.key)}>Open</Button> : <span className="muted small">after “{x.waitsFor}”</span>}</li>)}</ol></section>; })()}
      </div>

      <aside className="stack" style={{ gap: 14 }}>
        <section className="card money-card">
          <div className="card-header"><div><span className="eyebrow">The money picture</span><h2>{money(line.amount, false)}</h2><p>{line.row.description}</p></div></div>
          <div className="card-body stack">
            <div className="needby"><Icon name="calendar" size={14} /><span className="needby-text">Needed by <b>{fmtDate(needBy, true)}</b></span><Badge tone={daysLeft <= 7 ? 'danger' : daysLeft <= 21 ? 'warning' : 'neutral'}>{daysLeft} days</Badge></div>
            <div><div className="row between small"><span>Who pays {flow.settle?.settled ? '(agreed)' : '(provisional)'}</span><span className="muted">3-question rule{line.provisional && !flow.settle?.settled ? ' · SPA pending' : ''}</span></div>
              <div className="split-bar"><span style={{ width: `${sellerPct}%` }}>{sellerPct >= 18 && `${s.deal.seller} ${sellerPct}%`}</span><span style={{ width: `${100 - sellerPct}%` }}>{100 - sellerPct >= 18 && `${s.deal.buyer} ${100 - sellerPct}%`}</span></div>
              <div className="row between small muted"><span>{money(line.amount * sellerPct / 100)}</span><span>{money(line.amount * (100 - sellerPct) / 100)}</span></div></div>
            <dl className="kv">
              <div><dt>Route</dt><dd>{flow.path ? 'Bank funding with escrow' : <span className="muted">Not agreed yet</span>}</dd></div>
              {usesA && <div><dt>Bank facility</dt><dd>{money(facility)} · {released}/2 released</dd></div>}
              {usesA && <div><dt>Held in escrow</dt><dd>{money(escrow)} ({s.deal.seller}'s share)</dd></div>}
              
              <div><dt>Progress</dt><dd>{doneCount}/{visible.length} steps</dd></div>
            </dl>
            <ul className="guard-list"><li><Icon name="spark" size={12} />AI explains — people decide</li><li><Icon name="shield" size={12} />Nothing is shared without client consent</li><li><Icon name="lock" size={12} />PwC refers, takes no fee</li><li><Icon name="eye" size={12} />Summaries only, never app or staff lists</li></ul>
          </div>
        </section>
        <section className="card steps-card">
          <div className="card-header"><div><h2>All steps</h2><p>Click any open or finished step to view it</p></div></div>
          <ol className="steps-nav">{visible.map((x, i) => { const prev = visible[i - 1]; const header = !prev || prev.stage !== x.stage || prev.lane !== x.lane; return <li key={x.key}>
            {header && <span className="steps-group">{STAGES.find((st) => st.key === x.stage)?.label}</span>}
            <button disabled={!x.done && !x.ready} className={`${x.done ? 'done' : x.ready ? 'open' : 'locked'} ${focus?.key === x.key ? 'active' : ''}`} onClick={() => setPick(x.key)}><span className="sn">{x.done ? <Icon name="check" size={11} /> : x.ready ? '•' : <Icon name="lock" size={10} />}</span><span>{x.title}</span></button></li>; })}</ol>
        </section>
      </aside>
    </div>
  </div>;
}

function SettleStep({ line, flow, upd, facility }: { line: ReturnType<typeof useStore>['m']['disputed'][number]; flow: Flow; upd: (a: string, d: string, fn: (f: Flow, d: WorkspaceState) => void, k?: 'data' | 'approve' | 'override') => boolean; facility: number }) {
  const { s, readOnly } = useStore();
  const [pct, setPct] = useState(Math.round((flow.settle?.sellerPct ?? line.share) * 100));
  const [busy, setBusy] = useState<string | null>(null);
  const w = s.config.costSplitWeights;
  const score = (v: string) => (/^sel/i.test(v) ? 1 : /^shar/i.test(v) ? 0.5 : /^buy/i.test(v) ? 0 : 0.5);
  const lfl = (v: string) => (/^like/i.test(v) ? 1 : /^part/i.test(v) ? 0.5 : /^upg/i.test(v) ? 0 : 0.5);
  const readSpa = async () => {
    setBusy('spa');
    const r = await runAI(spaReader, { clause: s.datasets.spa?.text ?? '', lines: [{ id: line.row.cost_id, description: line.row.description, amount: line.amount, cause: line.row.cause, likeForLike: line.row.like_for_like }] });
    setBusy(null);
    const ans = r.data.lines[0];
    if (!ans) return;
    const share = w.cause * score(line.row.cause) + w.likeForLike * lfl(line.row.like_for_like) + w.contract * score(ans.answer);
    setPct(Math.round(share * 100));
    upd('SPA clause read for settlement', `contract says ${ans.answer}: “${ans.quote}”`, (f, d) => { f.settle = { sellerPct: share, method: 'spa', quote: ans.quote, settled: false, source: srcOf(r) }; const row = d.datasets.costs?.rows.find((x) => x.cost_id === line.row.cost_id); if (row) row.contract = ans.answer; });
  };
  const summarise = async () => {
    setBusy('sum');
    const r = await runAI(fundSettle, { path: flow.path ?? 'underwriting', amount: line.amount, sellerPct: pct / 100, escrow: Math.round(line.amount * (pct / 100)), buyer: s.deal.buyer, seller: s.deal.seller, method: flow.settle?.method ?? 'negotiated', quote: flow.settle?.quote });
    setBusy(null);
    upd('Settlement summary drafted', r.data.summary, (f) => { f.settle = { ...(f.settle ?? { method: 'negotiated', settled: false }), sellerPct: pct / 100, summary: r.data.summary, source: srcOf(r) } as Flow['settle']; });
  };
  return <>
    <span className="small">Buyer and seller agree the final split — through the SPA reading, negotiation or the deal board. Seller share rule: {w.cause} × who caused it + {w.likeForLike} × like-for-like + {w.contract} × what the contract says.</span>
    <div className="row wrap"><Button variant="secondary" icon="spark" loading={busy === 'spa'} disabled={readOnly || !s.datasets.spa?.text} onClick={readSpa}>Read the SPA clause with AI</Button>{flow.settle?.quote && <span className="small muted">SPA: “{flow.settle.quote}”</span>}</div>
    <div className="slider-row"><span>Agreed seller share</span><input type="range" min={0} max={100} value={pct} disabled={!!flow.settle?.settled || readOnly} onChange={(e) => setPct(+e.target.value)} /><strong className="num">{pct}%</strong><span className="small">{s.deal.seller} {money(line.amount * pct / 100)}</span></div>
    <table className="calc-table"><tbody>
      {<tr><td>Bank loan facility {money(facility)}: escrowed {s.deal.seller} share to the bank</td><td className="num">{money(line.amount * pct / 100)}</td></tr>}
      {<tr><td>{s.deal.buyer} repays the rest</td><td className="num">{money(Math.max(0, facility - line.amount * pct / 100))}</td></tr>}
    </tbody></table>
    {flow.settle?.summary ? <AIText text={flow.settle.summary} source={flow.settle.source} /> : <Button variant="secondary" icon="spark" loading={busy === 'sum'} onClick={summarise}>Draft settlement summary</Button>}
    {flow.settle?.settled ? <Badge tone="success">Settled — {s.deal.seller} {Math.round((flow.settle.sellerPct) * 100)}%</Badge> : <Button icon="check" disabled={readOnly} onClick={() => upd('Dispute settled', `${s.deal.seller} ${pct}% · ${s.deal.buyer} ${100 - pct}%`, (f, d) => { f.settle = { ...(f.settle ?? { method: 'negotiated' }), sellerPct: pct / 100, settled: true } as Flow['settle']; const row = d.datasets.costs?.rows.find((x) => x.cost_id === line.row.cost_id); if (row) row.status = 'Agreed'; }, 'approve')}>Mark dispute settled</Button>}
  </>;
}

function BurnDown() {
  const { m } = useStore();
  const pts = m.burndown;
  if (!pts.length) return null;
  const W = 560, H = 170, P = 30, max = Math.max(...pts.map((p) => Math.max(p.plan, p.projected)), 1);
  const x = (i: number) => P + (i * (W - P * 2)) / (pts.length - 1), y = (v: number) => H - P - (v * (H - P * 2)) / max;
  const line = (k: 'plan' | 'projected') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p[k])}`).join(' ');
  return <div className="chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="TSA burn-down">
    {[0, Math.ceil(max / 2), max].map((v) => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="#eee" /><text x={P - 6} y={y(v) + 3} fontSize="8" textAnchor="end" fill="#888">{v}</text></g>)}
    {pts.map((p, i) => i % 2 === 0 && <text key={p.date} x={x(i)} y={H - 10} fontSize="8" textAnchor="middle" fill="#888">{fmtDate(p.date)}</text>)}
    <path d={line('plan')} fill="none" stroke="#2b2a28" strokeWidth="2" /><path d={line('projected')} fill="none" stroke="var(--orange)" strokeWidth="2" strokeDasharray="5 4" />
  </svg><div className="legend"><span><i style={{ background: '#2b2a28' }} />Plan — services still on TSA</span><span><i style={{ background: 'var(--orange)' }} />Projected from exit progress</span></div></div>;
}

function TsaExit() {
  const { s, m, act, toast, readOnly } = useStore();
  const [advice, setAdvice] = useState<Record<string, AIResult<{ text: string }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'late' | 'ok'>('all');
  const atRisk = m.tsa.filter((t) => t.risk);
  const ask = async (t: (typeof m.tsa)[number]) => {
    setBusy(t.row.tsa_id);
    const r = await runAI(tsaAdvice, { service: t.row.service, fee: t.fee, target: fmtDate(t.row.target_exit, true), projected: fmtDate(t.projectedExit, true), expected: t.expected, actual: t.actual, extensionCost: t.extensionCost, linkedReadiness: m.items.find((i) => i.app.id === t.row.linked_system)?.readiness });
    setAdvice({ ...advice, [t.row.tsa_id]: r }); setBusy(null);
  };
  const milestone = (rid: string, delta: number) => act(delta > 0 ? 'Recorded TSA exit milestone' : 'Reverted TSA milestone', m.tsa.find((t) => t.row._rid === rid)?.row.service ?? '', (d) => { const r = d.datasets.tsa!.rows.find((x) => x._rid === rid)!; r.milestones_done = Math.max(0, Math.min(Number(r.milestones_total), Number(r.milestones_done) + delta)); }, { skipIssues: true });
  if (!m.tsa.length) return <Empty title="No TSA schedule">Upload 08_TSA_Schedule.csv.</Empty>;
  const exposure = atRisk.reduce((x, t) => x + t.extensionCost, 0);
  const lastExit = m.tsa.reduce((x, t) => (t.row.target_exit > x ? t.row.target_exit : x), '');
  const shown = m.tsa.filter((t) => (filter === 'late' ? t.risk : filter === 'ok' ? !t.risk : true)).sort((a, b) => Number(b.risk) - Number(a.risk) || b.lateDays - a.lateDays);
  const day = (d: string) => new Date(d).getTime();
  return <div className="stack" style={{ gap: 14 }}>
    <div className="tsa-summary">
      <div><span>Seller services we still rely on</span><strong>{m.tsa.length}</strong><small>{money(m.tsaMonthly)} per month in TSA fees</small></div>
      <div className="ok"><span>On track to exit</span><strong>{m.tsa.length - atRisk.length}</strong><small>will be off the TSA by their target date</small></div>
      <div className={atRisk.length ? 'bad' : 'ok'}><span>Running late</span><strong>{atRisk.length}</strong><small>{atRisk.length ? `${money(atRisk.reduce((x, t) => x + t.fee, 0))}/mo of services at risk` : 'nothing at risk today'}</small></div>
      <div className={exposure ? 'bad' : ''}><span>Cost if nothing changes</span><strong>{money(exposure)}</strong><small>extra months at 125% of the monthly fee</small></div>
    </div>
    <div className="content-grid two-thirds" style={{ marginTop: 0 }}>
      <section className="card">
        <div className="card-header"><div><h2>Getting off the seller’s services</h2><p>Each service shows where its exit work is today, when it should end, and when it will really end at the current pace.</p></div>
          <div className="seg">{([['all', `All ${m.tsa.length}`], ['late', `Running late ${atRisk.length}`], ['ok', `On track ${m.tsa.length - atRisk.length}`]] as const).map(([k, l]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div></div>
        <div className="tsa-cards">{shown.map((t) => {
          const start = t.row.prep_start || addDays(s.deal.asOf, -30);
          const end = addDays([t.row.target_exit, t.projectedExit].sort().pop()!, 10);
          const pos = (d: string) => `${Math.min(100, Math.max(0, ((day(d) - day(start)) / Math.max(1, day(end) - day(start))) * 100))}%`;
          const early = -t.lateDays;
          return <div key={t.row._rid} className={`tsa-card ${t.risk ? 'late' : ''}`}>
            <div className="tsa-head">
              <span className="tsa-icon"><Icon name="network" /></span>
              <div className="tsa-title"><strong>{t.row.service}</strong><span>{money(t.fee)}/month · owner {t.row.owner}{t.linked ? ` · replaces ${t.linked.name}` : ''}</span></div>
              <Badge tone={t.status === 'Extension risk' ? 'danger' : t.status === 'Data gate' || t.status === 'Watch' ? 'warning' : 'success'}>{t.status === 'Extension risk' ? 'Running late' : t.status === 'Data gate' ? 'Waiting on data' : t.status}</Badge>
            </div>
            <p className="tsa-say">{t.risk
              ? <>At today’s pace this exit finishes on <b className="red-text">{fmtDate(t.projectedExit, true)}</b>, about <b>{t.lateDays} days after</b> the {fmtDate(t.row.target_exit, true)} target. That means ~{t.extraMonths} extra month{t.extraMonths > 1 ? 's' : ''} of TSA at 125% → <b>{money(t.extensionCost)}</b>.</>
              : <>On track: expected to finish by <b>{fmtDate(t.projectedExit, true)}</b>{early > 0 ? <>, {early} days before the {fmtDate(t.row.target_exit, true)} target</> : <>, in line with the {fmtDate(t.row.target_exit, true)} target</>}.{t.status === 'Data gate' ? ' Its migration wave still waits for clean source data (hygiene 90+).' : ''}</>}</p>
            <div className="tsa-track" aria-label="Exit timeline">
              <div className="rail" />
              <div className="fill" style={{ left: 0, width: pos(s.deal.asOf) }} />
              <span className="mk today" style={{ left: pos(s.deal.asOf) }}><i />{Math.abs(parseFloat(pos(s.deal.asOf)) - parseFloat(pos(t.row.target_exit))) > 14 && <em>Today</em>}</span>
              <span className="mk target" style={{ left: pos(t.row.target_exit) }}><i /><em>Target {fmtDate(t.row.target_exit)}</em></span>
              <span className={`mk proj ${t.risk ? 'late' : ''}`} style={{ left: pos(t.projectedExit) }}><i /><em>Expected {fmtDate(t.projectedExit)}</em></span>
            </div>
            <div className="tsa-progress"><span>Exit milestones <b>{t.done} of {t.total}</b> done</span><div className="pbar"><div style={{ width: `${t.actual}%` }} className={t.risk ? 'late' : ''} /><i style={{ left: `${t.expected}%` }} title={`Planned by today: ${t.expected}%`} /></div><span className="muted">{t.actual}% done · {t.expected}% planned by today</span></div>
            {advice[t.row.tsa_id] && <div className="ai-box"><div className="ai-head"><Icon name="spark" size={13} />How to recover <AIChip result={advice[t.row.tsa_id]} /></div>{advice[t.row.tsa_id].data.text}</div>}
            <div className="tsa-actions">
              <Button variant="secondary" icon="check" disabled={readOnly || t.done >= t.total} onClick={() => { milestone(t.row._rid, 1); toast('Milestone recorded — expected exit date updated'); }}>Record a finished milestone</Button>
              {t.risk && <Button variant="secondary" icon="spark" loading={busy === t.row.tsa_id} onClick={() => ask(t)}>Ask AI how to recover</Button>}
              <Menu items={[{ label: 'Undo last milestone', icon: 'refresh', onClick: () => milestone(t.row._rid, -1) }, { label: 'Ask AI for advice', icon: 'spark', onClick: () => ask(t) }, { label: 'Extend target exit by 1 month (125% fee)', icon: 'calendar', onClick: () => act('Extended TSA target exit', `${t.row.service} → ${fmtDate(addDays(t.row.target_exit, 30))} (125% fee)`, (d) => { d.datasets.tsa!.rows.find((x) => x._rid === t.row._rid)!.target_exit = addDays(t.row.target_exit, 30); }, { kind: 'override', skipIssues: true }) }]} />
            </div>
          </div>; })}</div>
      </section>
      <aside className="stack" style={{ gap: 14 }}>
        <section className="card"><div className="card-header"><div><h2>Services left on the TSA</h2><p>Planned vs expected, from {s.deal.milestoneLabel} ({fmtDate(s.deal.day1)}) to the last exit ({fmtDate(lastExit)})</p></div></div><div className="card-body"><BurnDown /><p className="muted small" style={{ margin: 0 }}>When the orange line sits above the black one, services are leaving later than planned.</p></div></section>
        <section className="card"><div className="card-header"><div><h2>What these words mean</h2></div></div>
          <dl className="glossary-list">
            <div><dt>TSA</dt><dd>Transitional Service Agreement — the seller keeps running a service for the buyer, for a monthly fee, until the buyer can run it alone.</dd></div>
            <div><dt>Target exit</dt><dd>The date agreed with the seller to stop using the service.</dd></div>
            <div><dt>Expected exit</dt><dd>When we will really finish at today’s pace: milestones done so far, projected forward.</dd></div>
            <div><dt>Running late</dt><dd>Expected exit is more than 7 days after the target. Each extra month costs 125% of the fee (SPA 9.2).</dd></div>
          </dl></section>
      </aside>
    </div>
  </div>;
}

function Waves() {
  const { s, m, act, toast } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const [showGroups, setShowGroups] = useState<number | null>(null);
  const [gq, setGq] = useState('');
  return <section className="card"><div className="card-header"><div><h2>Migration waves</h2><p>Move groups go in a fixed order; a wave may start only when its source data hygiene is {s.config.hygieneGate}+</p></div></div>
    <div className="wave-list">{WAVES.map((w) => {
      const groups = m.moveGroups.filter((g) => g.wave === w.n);
      const hyg = groups.length ? Math.min(...groups.map((g) => g.hygiene)) : 100;
      const released = !!s.waveReleased[`W${w.n}`];
      const gated = hyg < s.config.hygieneGate;
      const status = released ? 'Released' : !groups.length ? 'Empty' : gated ? 'Blocked' : w.n === 0 || s.waveReleased[`W${w.n - 1}`] ? 'Ready' : 'Planned';
      const checks = s.waveChecklist[`W${w.n}`] ?? Array(12).fill(false);
      return <div key={w.n} style={{ display: 'block', padding: '10px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '38px 1.4fr 1.6fr 100px 100px 230px', gap: 12, alignItems: 'center' }}>
          <span className="wave-number">{w.n}</span>
          <div><strong>{w.name}</strong><span>{w.desc}</span></div>
          <div className="wave-groups">{groups.length ? <><strong className="small">{groups.length} move group{groups.length > 1 ? 's' : ''} · {groups.reduce((x, g) => x + g.apps.length, 0)} apps</strong><span>{groups.slice(0, 3).map((g) => `${g.id}: ${g.apps.slice(0, 3).map((a) => a.name).join(', ')}${g.apps.length > 3 ? ` +${g.apps.length - 3}` : ''}`).join(' · ')}{groups.length > 3 ? ' …' : ''}</span>{groups.length > 3 && <button className="text-action" onClick={() => setShowGroups(showGroups === w.n ? null : w.n)}>{showGroups === w.n ? 'Hide groups' : `Show all ${groups.length} groups`}</button>}</> : <span>No groups assigned</span>}</div>
          <div><small>Data hygiene</small><strong style={{ color: gated ? 'var(--red)' : undefined }}>{groups.length ? hyg : '—'}</strong></div>
          <Badge tone={status === 'Released' || status === 'Ready' ? 'success' : status === 'Blocked' ? 'danger' : 'neutral'}>{status}</Badge>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setOpen(open === w.n ? null : w.n)}>{checks.filter(Boolean).length}/12 steps</Button>
            {!released ? <Button variant="secondary" disabled={!groups.length || gated} title={gated ? `Blocked: ${groups.find((g) => g.hygiene < s.config.hygieneGate)?.hygieneSource} scores ${hyg}` : ''} onClick={() => { act(`Released Wave ${w.n}`, groups.map((g) => g.id).join(', '), (d) => { d.waveReleased[`W${w.n}`] = true; }, { kind: 'approve', skipIssues: true }); toast(`Wave ${w.n} released`); }}>Release wave</Button>
              : <Button variant="ghost" onClick={() => act(`Re-opened Wave ${w.n}`, '', (d) => { d.waveReleased[`W${w.n}`] = false; }, { kind: 'override', skipIssues: true })}>Undo</Button>}
          </div>
        </div>
        {gated && groups.length > 0 && (() => { const bySrc = new Map<string, { n: number; hyg: number }>(); groups.filter((g) => g.hygiene < s.config.hygieneGate).forEach((g) => { const e = bySrc.get(g.hygieneSource) ?? { n: 0, hyg: g.hygiene }; e.n++; e.hyg = Math.min(e.hyg, g.hygiene); bySrc.set(g.hygieneSource, e); }); return <div className="wave-gate"><Icon name="alert" size={13} /><span><b>Blocked by data quality:</b> {[...bySrc].map(([src, e]) => `${src} scores ${e.hyg} (needed by ${e.n} group${e.n > 1 ? 's' : ''})`).join(' · ')}. Clean {bySrc.size > 1 ? 'these files' : 'this file'} to {s.config.hygieneGate}+ in Data & Inventory to release the wave.</span></div>; })()}
        {showGroups === w.n && <div className="wave-group-list">{groups.map((g) => <div key={g.id}><b>{g.id}</b><span>{g.apps.map((a) => a.name).join(', ')}</span><span className={g.hygiene < s.config.hygieneGate ? 'red-text' : ''}>hygiene {g.hygiene}</span></div>)}</div>}
        {open === w.n && <div style={{ margin: '10px 0 0 50px' }}>
          <div className="grid-2">{ROADMAP_12.map((step, i) => <label key={step} className="row small" style={{ cursor: 'pointer', padding: '4px 0' }}><input type="checkbox" checked={!!checks[i]} onChange={() => act('Updated wave checklist', `Wave ${w.n}: ${step} ${checks[i] ? 'unchecked' : 'done'}`, (d) => { const c = [...(d.waveChecklist[`W${w.n}`] ?? Array(12).fill(false))]; c[i] = !c[i]; d.waveChecklist[`W${w.n}`] = c; }, { skipIssues: true })} />{i + 1}. {step}</label>)}</div>
          <div className="mt small"><div className="row" style={{ marginBottom: 6 }}>Move a group to another wave<input className="inline" placeholder="Filter groups or apps…" value={gq} onChange={(e) => setGq(e.target.value)} style={{ width: 200 }} /></div><div className="wave-reassign">{groups.filter((g) => !gq || `${g.id} ${g.apps.map((a) => a.name).join(' ')}`.toLowerCase().includes(gq.toLowerCase())).slice(0, 60).map((g) => <span key={g.id} className="chip">{g.id}<select className="inline" value={g.wave} onChange={(e) => act('Moved group to another wave', `${g.id} → Wave ${e.target.value}`, (d) => { d.waveOverrides[g.id] = +e.target.value; }, { kind: 'override', skipIssues: true })}>{WAVES.map((x) => <option key={x.n} value={x.n}>W{x.n}</option>)}</select></span>)}</div></div>
        </div>}
      </div>;
    })}</div></section>;
}

function Products() {
  const { m, act, toast } = useStore();
  if (!m.products.length) return <Empty title="No product revenue data">Upload 13_Product_Revenue.csv.</Empty>;
  return <section className="card"><div className="card-header"><div><h2>Product priority list</h2><p>Products blocked by stuck systems, ranked by revenue so the biggest blocked revenue is unlocked first</p></div><Badge tone="danger">{money(m.blockedRevenue)} / quarter blocked</Badge></div>
    <Table cols="40px 1.6fr 1fr 1fr 1.6fr 1fr 130px" head={['#', 'Product', 'Country', 'Revenue / qtr', 'Blocked by', 'Status', '']}>
      {m.products.map((p, i) => <div className={`tr ${p.blocked ? '' : 'muted-row'}`} key={p.row._rid}><span>{p.blocked ? i + 1 : '—'}</span><span><strong>{p.row.product}</strong></span><span>{p.row.country}</span><span>{money(p.revenue)}</span><span>{p.system?.name ?? p.row.blocked_by}<small>{p.system ? `${p.system.bucket}${p.systemReadiness !== null ? ` · readiness ${p.systemReadiness}%` : ''}` : ''}</small></span><span><Badge tone={p.blocked ? 'danger' : 'success'}>{p.row.status}</Badge></span><span>{p.blocked ? <Button variant="secondary" onClick={() => { act('Product registered', `${p.row.product} · ${p.row.country}`, (d) => { d.datasets.products!.rows.find((x) => x._rid === p.row._rid)!.status = 'Registered'; }, { skipIssues: true }); toast(`${money(p.revenue)}/qtr unlocked`); }}>Mark registered</Button> : <Button variant="ghost" onClick={() => act('Product re-blocked', p.row.product, (d) => { d.datasets.products!.rows.find((x) => x._rid === p.row._rid)!.status = 'Blocked'; }, { skipIssues: true })}>Undo</Button>}</span></div>)}
    </Table></section>;
}
