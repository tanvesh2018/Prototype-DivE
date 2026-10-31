import { useMemo, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { fundingAdvice, spaReader, tsaAdvice, type SpaOut } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Menu, Modal, PageTitle, Progress, Table, Tabs } from '../components/ui';
import type { DatasetKey } from '../engine/glossary';
import { ROADMAP_12, WAVES } from '../engine/model';
import { addDays, fmtDate, money, uid } from '../engine/util';
import { useStore } from '../state/store';

const emi = (amount: number, months: number, rate: number) => { const r = rate / 1200; return r === 0 ? amount / months : Math.round((amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)); };

export function Funding() {
  const { s, m, params, readOnly } = useStore();
  const [tab, setTab] = useState(params.tab ?? 'funding');
  const [upload, setUpload] = useState<DatasetKey | null>(null);
  const consent = s.consents['Bank funding summary'] === 'Granted';
  const bank = s.role === 'bank';
  return <>
    <PageTitle eyebrow="Fund & exit" title="Funding & TSA Exit" description="Keep separation moving while cost disputes resolve and seller dependencies reduce." action={<>{consent ? <Badge tone="success"><Icon name="shield" size={13} /> Bank sharing consented</Badge> : <Badge tone="warning">Bank sharing not consented</Badge>}{!readOnly && <Menu trigger={<Button variant="secondary" icon="upload">Upload data</Button>} items={[{ label: 'Cost register (07)', icon: 'file', onClick: () => setUpload('costs') }, { label: 'SPA clauses (18)', icon: 'file', onClick: () => setUpload('spa') }, { label: 'TSA schedule (08)', icon: 'file', onClick: () => setUpload('tsa') }, { label: 'Product revenue (13)', icon: 'file', onClick: () => setUpload('products') }, { label: 'Prowess financials (14)', icon: 'file', onClick: () => setUpload('financials') }]} />}</>} />
    {bank && !consent ? <Empty title="No consented data to show">The client has not consented to share the funding summary with banks.</Empty> : <>
      <Tabs value={tab} onChange={setTab} tabs={bank ? [{ key: 'funding', label: 'Funding options' }] : [{ key: 'funding', label: 'Funding options' }, { key: 'costs', label: 'Cost allocation', count: m.disputed.length }, { key: 'tsa', label: 'TSA exit', count: m.tsa.filter((t) => t.risk).length }, { key: 'waves', label: 'Migration waves' }, { key: 'products', label: 'Product priority' }]} />
      {tab === 'funding' && <FundingOptions />}
      {tab === 'costs' && !bank && <CostAllocation onUpload={() => setUpload('spa')} />}
      {tab === 'tsa' && !bank && <TsaExit />}
      {tab === 'waves' && !bank && <Waves />}
      {tab === 'products' && !bank && <Products />}
    </>}
    {upload && <UploadModal expected={upload} onClose={() => setUpload(null)} />}
  </>;
}

function FundingOptions() {
  const { s, m, act, toast } = useStore();
  const disputed = m.disputedAmount;
  const [amount, setAmount] = useState(disputed || 700000);
  const [months, setMonths] = useState(12);
  const [rate, setRate] = useState(s.config.bridgeRate);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<AIResult<{ recommendation: string }> | null>(null);
  const monthly = useMemo(() => emi(amount, months, rate), [amount, months, rate]);
  const escrowFee = Math.round((m.disputedSeller * s.config.escrowFeePct) / 100);
  const leaseMonthly = emi(amount, 36, s.config.leaseRate);
  const buyer = m.fin.find((f) => /buyer/i.test(f.row.role)), seller = m.fin.find((f) => /seller/i.test(f.row.role));
  const consent = s.consents['Bank funding summary'] === 'Granted';

  const model = async () => {
    setBusy(true);
    const r = await runAI(fundingAdvice, { disputed: amount, disputedSeller: m.disputedSeller, buyer: buyer && { company: buyer.row.company, cash: buyer.cash, de: buyer.de, cr: buyer.cr, ic: buyer.ic, verdict: buyer.verdict }, seller: seller && { company: seller.row.company, cash: seller.cash, de: seller.de, cr: seller.cr, verdict: seller.verdict }, bridge: { monthly, months, rate }, escrowFee, leaseMonthly });
    setAi(r); setBusy(false);
    act('Modelled funding package', `Bridge ${money(amount)} / ${months}m @ ${rate}% · escrow ${money(m.disputedSeller)}`, (d) => {
      d.funding.packages.unshift({ id: uid('FP'), createdAt: new Date().toISOString(), bridge: { amount, months, rate, monthly }, escrow: { amount: m.disputedSeller, fee: escrowFee }, lease: { amount, months: 36, monthly: leaseMonthly }, recommendation: r.data.recommendation, status: 'draft' });
    }, { kind: 'ai', skipIssues: true });
    toast('Funding package saved as draft');
  };

  return <>
    <div className="funding-banner"><div><span>Disputed funding requirement</span><strong>{money(disputed, false)}</strong><p>{m.disputed.map((l) => l.row.description).join(', ') || 'No disputed lines'} · {s.deal.seller} disputes allocation</p></div><div><span>Overall cost gap</span><strong>{money(m.sepTotal)}</strong><p>Seller {money(m.sellerTotal)} · {s.deal.buyer} {money(m.buyerTotal)}</p></div><div><span>Required before</span><strong>{fmtDate(addDays(s.deal.day1, -3), true)}</strong><p>3 days before Day-1</p></div></div>
    <div className="funding-grid">
      <section className="card funding-options"><div className="card-header"><div><h2>Three funding paths</h2><p>Indicative options subject to lender approval</p></div></div>
        {[
          { k: 'bridge', icon: 'funding' as const, name: 'Bridge loan', rec: !!buyer?.tight, desc: `Fund equipment now; ${buyer?.row.company ?? 'buyer'} repays after the dispute is settled.`, a: ['Est. monthly', money(monthly, false)], b: ['Total interest', money(monthly * months - amount, false)] },
          { k: 'escrow', icon: 'lock' as const, name: 'Escrow', rec: false, desc: `Bank holds ${seller?.row.company ?? 'seller'}'s disputed ${money(m.disputedSeller)} until both parties agree (SPA 7.5).`, a: ['Amount held', money(m.disputedSeller, false)], b: ['Est. fee', money(escrowFee, false)] },
          { k: 'lease', icon: 'database' as const, name: 'Equipment lease', rec: false, desc: 'Lease equipment and licences to preserve acquisition cash.', a: ['Term', '36 months'], b: ['Est. monthly', money(leaseMonthly, false)] },
        ].map((o) => <div key={o.k} className={`fund-option ${o.rec ? 'recommended' : ''}`}><div className="option-icon"><Icon name={o.icon} /></div><div><span><strong>{o.name}</strong>{o.rec && <Badge tone="orange">Recommended</Badge>}</span><p>{o.desc}</p><div><span>{o.a[0]} <strong>{o.a[1]}</strong></span><span>{o.b[0]} <strong>{o.b[1]}</strong></span></div></div><button onClick={() => setDetail(o.k)} aria-label={`${o.name} details`}><Icon name="chevron" /></button></div>)}
        <div className="card-header" style={{ borderTop: '1px solid var(--border)' }}><div><h2>Who can afford it?</h2><p>Prowess financial health · shared with banks only with client consent</p></div></div>
        <Table cols="1.4fr .8fr .8fr .8fr .8fr 1.6fr" head={['Company', 'Cash', 'D/E', 'Current ratio', 'Int. cover', 'Verdict']}>{m.fin.map((f) => <div className="tr" key={f.row._rid}><span><strong>{f.row.company}</strong><small>{f.row.role}</small></span><span>{money(f.cash * 1e6)}</span><span>{f.de}</span><span>{f.cr}</span><span>{f.ic}x</span><span><Badge tone={f.tight ? 'warning' : 'success'}>{f.verdict}</Badge></span></div>)}</Table>
      </section>
      <section className="card calculator"><div className="card-header"><div><h2>Bridge loan calculator</h2><p>Illustrative estimate, not a lending offer</p></div></div>
        <div className="card-body stack">
          <label className="field">Loan amount (USD)<input type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} /></label>
          <label className="field">Term<select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[6, 12, 18, 24].map((x) => <option key={x} value={x}>{x} months</option>)}</select></label>
          <label className="field">Indicative annual rate (%)<input type="number" step=".1" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
          <div className="monthly" style={{ background: '#f6f5f2', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}><span className="muted small">Estimated monthly repayment</span><strong style={{ fontSize: 24 }}>{money(monthly, false)}</strong><small className="muted">{months} payments · {rate}% p.a. · total interest {money(monthly * months - amount, false)}</small></div>
          <Button icon="spark" loading={busy} onClick={model}>Model funding package</Button>
          {ai && <div className="ai-box"><div className="ai-head"><Icon name="spark" size={14} />Recommendation <AIChip result={ai} /></div>{ai.data.recommendation}</div>}
        </div>
      </section>
    </div>
    <section className="card mt"><div className="card-header"><div><h2>Funding packages</h2><p>Drafts become visible to the bank only after client consent</p></div></div>
      {s.funding.packages.length ? <Table cols="120px 1.2fr 1.2fr 2.4fr 110px 220px" head={['Created', 'Bridge', 'Escrow', 'Recommendation', 'Status', '']}>{s.funding.packages.map((p) => <div className="tr" key={p.id}><span>{new Date(p.createdAt).toLocaleDateString('en-GB')}</span><span>{money(p.bridge.amount)} · {money(p.bridge.monthly, false)}/mo × {p.bridge.months}</span><span>{money(p.escrow.amount)} · fee {money(p.escrow.fee, false)}</span><span className="small muted">{p.recommendation}</span><span><Badge tone={p.status === 'approved' ? 'success' : p.status === 'shared_with_bank' ? 'info' : 'neutral'}>{p.status.replace(/_/g, ' ')}</Badge></span><span className="row">
        {p.status === 'draft' && <Button variant="secondary" disabled={!consent} title={consent ? '' : 'Client consent required (Governance)'} onClick={() => { act('Shared funding package with bank', `${money(p.bridge.amount)} bridge · consented summary only (score, cost split, financial summary)`, (d) => { d.funding.packages.find((x) => x.id === p.id)!.status = 'shared_with_bank'; }, { kind: 'access', skipIssues: true }); toast('Shared with the bank — readiness score, cost split and financial summary only'); }}>Share with bank</Button>}
        {p.status === 'shared_with_bank' && <Button variant="secondary" onClick={() => act('Bank approved funding package', money(p.bridge.amount), (d) => { d.funding.packages.find((x) => x.id === p.id)!.status = 'approved'; }, { kind: 'approve', skipIssues: true, allowReadOnly: s.role === 'bank' })}>Record bank approval</Button>}
        <Button variant="ghost" icon="trash" onClick={() => act('Deleted funding package', p.id, (d) => { d.funding.packages = d.funding.packages.filter((x) => x.id !== p.id); }, { skipIssues: true })} /></span></div>)}</Table> : <div className="empty">No packages yet — use “Model funding package”.</div>}
    </section>
    <section className="card mt"><div className="card-header"><div><h2>Products by segment</h2><p>Simple financing ideas for each party</p></div></div>
      <div className="grid-3 card-body">{[['Acquirer', 'Separation loan', 'Bridge facility sized to the disputed amount, repaid from escrow release or SPA settlement.'], ['Seller', 'Separation cost facility + escrow', 'Escrow for disputed shares; revolving facility for its committed separation costs.'], ['Smaller firms', 'Small-ticket financing', 'Lease and vendor-financing for equipment and licences under $500K.']].map(([a, b, c]) => <div key={a} className="lesson-card"><span className="eyebrow">{a}</span><strong>{b}</strong><span className="muted">{c}</span></div>)}</div>
    </section>
    {detail && <Modal title={detail === 'bridge' ? 'Bridge loan' : detail === 'escrow' ? 'Escrow' : 'Equipment lease'} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>}>
      {detail === 'bridge' && <dl className="kv"><dt>Borrower</dt><dd>{buyer?.row.company ?? 'Buyer'}</dd><dt>Amount</dt><dd>{money(amount, false)}</dd><dt>Term / rate</dt><dd>{months} months @ {rate}%</dd><dt>Monthly (EMI)</dt><dd>{money(monthly, false)}</dd><dt>Why</dt><dd>{buyer?.tight ? `Cash tight — current ratio ${buyer.cr}, D/E ${buyer.de}` : 'Optional — buyer can self-fund'}</dd><dt>Formula</dt><dd>EMI = P·r·(1+r)^n / ((1+r)^n − 1)</dd></dl>}
      {detail === 'escrow' && <dl className="kv"><dt>Held for</dt><dd>{seller?.row.company ?? 'Seller'} disputed share</dd><dt>Amount</dt><dd>{money(m.disputedSeller, false)}</dd><dt>Fee</dt><dd>{s.config.escrowFeePct}% = {money(escrowFee, false)}</dd><dt>Release</dt><dd>On agreement or expert determination (SPA 7.5 / 19)</dd></dl>}
      {detail === 'lease' && <dl className="kv"><dt>Asset</dt><dd>Engineering equipment and licences</dd><dt>Amount</dt><dd>{money(amount, false)}</dd><dt>Term / rate</dt><dd>36 months @ {s.config.leaseRate}%</dd><dt>Monthly</dt><dd>{money(leaseMonthly, false)}</dd></dl>}
    </Modal>}
  </>;
}

function CostAllocation({ onUpload }: { onUpload: () => void }) {
  const { s, m, act, toast } = useStore();
  const [clause, setClause] = useState(s.datasets.spa?.text ?? '');
  const [res, setRes] = useState<AIResult<SpaOut> | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const w = s.config.costSplitWeights;
  const setLine = (rid: string, patch: Record<string, string>, label: string) => act(label, `${m.sepLines.find((l) => l.row._rid === rid)?.row.description}: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`, (d) => { Object.assign(d.datasets.costs!.rows.find((r) => r._rid === rid)!, patch); }, { kind: 'override' });
  const read = async () => {
    setBusy(true);
    const r = await runAI(spaReader, { clause, lines: m.sepLines.map((l) => ({ id: l.row.cost_id, description: l.row.description, amount: l.amount, cause: l.row.cause, likeForLike: l.row.like_for_like })) });
    setRes(r); setBusy(false);
  };
  const confirmSpa = () => {
    if (!res) return;
    act('Confirmed AI reading of SPA clause', res.data.lines.map((l) => `${l.id}: ${l.answer}`).join('; '), (d) => {
      res.data.lines.forEach((l) => { const r = d.datasets.costs!.rows.find((x) => x.cost_id === l.id); if (r) r.contract = l.answer; });
      d.funding.spaReading = { source: res.source === 'gemini' ? `Gemini · ${res.model}` : 'Rule-based fallback', lines: Object.fromEntries(res.data.lines.map((l) => [l.id, { answer: l.answer, quote: l.quote, confirmed: true }])) };
    }, { kind: 'approve' });
    toast('Contract answers applied — cost split recalculated');
    setRes(null);
  };
  if (!m.sepLines.length) return <Empty title="No separation cost lines">Upload 07_Cost_Register.csv.</Empty>;
  return <>
    <section className="card"><div className="card-header"><div><h2>{money(m.sepTotal)} cost allocation</h2><p>Seller share = {w.cause} × who caused it + {w.likeForLike} × like-for-like + {w.contract} × what the contract says</p></div><div className="row">{m.sepLines.some((l) => l.provisional) ? <Badge tone="warning">SPA answers pending — provisional</Badge> : <Badge tone="info">SPA clause verified</Badge>}<Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>Add cost line</Button></div></div>
      <Table cols="2fr .8fr 1fr 1fr 1fr 60px .8fr .8fr 1.1fr" head={['Cost line', 'Total', 'Who caused it', 'Like-for-like?', 'Contract says', 'Seller %', 'Seller pays', `${s.deal.buyer} pays`, 'Status']}>
        {m.sepLines.map((l) => <div className="tr" key={l.row._rid}>
          <span><strong>{l.row.description}</strong><small>{l.row.cost_id} · {m.byId.get(l.row.app_id)?.name ?? l.row.app_id}</small></span><span>{money(l.amount)}</span>
          <span><select className="inline" value={l.row.cause ?? ''} onChange={(e) => setLine(l.row._rid, { cause: e.target.value }, 'Changed cost split answer')}><option value="">?</option><option>Seller</option><option>Shared</option><option>Buyer</option></select></span>
          <span><select className="inline" value={l.row.like_for_like ?? ''} onChange={(e) => setLine(l.row._rid, { like_for_like: e.target.value }, 'Changed cost split answer')}><option value="">?</option><option>Like-for-like</option><option>Partly</option><option>Upgrade</option></select></span>
          <span><select className="inline" value={l.row.contract ?? ''} onChange={(e) => setLine(l.row._rid, { contract: e.target.value }, 'Changed cost split answer')}><option value="">Pending (0.5)</option><option>Seller</option><option>Shared</option><option>Buyer</option></select>{s.funding.spaReading?.lines[l.row.cost_id] && <small title={s.funding.spaReading.lines[l.row.cost_id].quote}>SPA: “{s.funding.spaReading.lines[l.row.cost_id].quote.slice(0, 40)}…”</small>}</span>
          <span>{Math.round(l.share * 100)}%</span><span>{money(l.seller)}</span><span>{money(l.buyer)}</span>
          <span className="row"><Badge tone={l.disputed ? 'danger' : 'success'}>{l.disputed ? 'Disputed' : 'Agreed'}</Badge><Menu items={[{ label: l.disputed ? 'Mark agreed' : 'Mark disputed', icon: 'alert', onClick: () => setLine(l.row._rid, { status: l.disputed ? 'Agreed' : 'Disputed' }, l.disputed ? 'Cost line agreed' : 'Cost line disputed') }]} /></span>
        </div>)}
        <div className="tr" style={{ background: '#f5f5f5', fontWeight: 700 }}><span>Total</span><span>{money(m.sepTotal)}</span><span /><span /><span /><span /><span>{money(m.sellerTotal)}</span><span>{money(m.buyerTotal)}</span><span>{m.disputed.length ? `${money(m.disputedAmount)} to funding` : ''}</span></div>
      </Table>
      <div className="table-footer"><span>Disputed lines are routed to the funding layer automatically — the deal keeps moving.</span><span>Annual run cost across systems: {money(m.runCost)}</span></div>
    </section>
    <section className="card mt"><div className="card-header"><div><h2>Read the SPA clause with AI</h2><p>Paste or upload the cost-sharing clause; AI suggests the “contract” answer and quotes the line it relied on. You confirm.</p></div><div className="row"><AIChip result={res} /><Button variant="secondary" icon="upload" onClick={onUpload}>Upload SPA text</Button><Button icon="spark" loading={busy} disabled={!clause.trim()} onClick={read}>Read clause</Button></div></div>
      <div className="card-body stack"><label className="field">SPA clause text<textarea style={{ minHeight: 140 }} value={clause} onChange={(e) => setClause(e.target.value)} placeholder="Paste clause 7.4 Separation Costs…" /></label>
        {res && <><Table cols="1.4fr 90px 2.6fr 1.4fr" head={['Cost line', 'Contract says', 'Quoted from SPA', 'Reason']}>{res.data.lines.map((l) => <div className="tr" key={l.id}><span>{m.sepLines.find((x) => x.row.cost_id === l.id)?.row.description ?? l.id}</span><span><Badge tone={l.answer === 'Buyer' ? 'warning' : l.answer === 'Seller' ? 'info' : 'neutral'}>{l.answer}</Badge></span><span className="small">“{l.quote}”</span><span className="muted small">{l.reason}</span></div>)}</Table>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" onClick={() => setRes(null)}>Discard</Button><Button icon="check" onClick={confirmSpa}>Confirm & apply</Button></div></>}</div>
    </section>
    {adding && <AddCostLine onClose={() => setAdding(false)} />}
  </>;
}

function AddCostLine({ onClose }: { onClose: () => void }) {
  const { m, act, toast } = useStore();
  const [f, setF] = useState({ description: '', amount: 100000, app_id: m.apps[0]?.id ?? '', cause: 'Seller', like_for_like: 'Like-for-like', contract: '', status: 'Agreed' });
  return <Modal title="Add separation cost line" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!f.description} onClick={() => { act('Added cost line', `${f.description} ${money(f.amount)}`, (d) => { const rows = d.datasets.costs!.rows; rows.push({ _rid: uid('costs'), cost_id: `SEP-${String(rows.filter((r) => /SEP/.test(r.cost_id)).length + 1).padStart(3, '0')}`, cost_type: 'Separation (one-time)', ...f }); }); toast('Cost line added'); onClose(); }}>Add</Button></>}>
    <div className="form-grid">
      <label className="field full">Description<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="field">Amount (USD)<input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></label>
      <label className="field">System<select value={f.app_id} onChange={(e) => setF({ ...f, app_id: e.target.value })}>{m.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="field">Who caused it<select value={f.cause} onChange={(e) => setF({ ...f, cause: e.target.value })}><option>Seller</option><option>Shared</option><option>Buyer</option></select></label>
      <label className="field">Like-for-like?<select value={f.like_for_like} onChange={(e) => setF({ ...f, like_for_like: e.target.value })}><option>Like-for-like</option><option>Partly</option><option>Upgrade</option></select></label>
      <label className="field">Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Agreed</option><option>Disputed</option></select></label>
    </div>
  </Modal>;
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
  const { s, m, act, toast } = useStore();
  const [advice, setAdvice] = useState<Record<string, AIResult<{ text: string }>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const atRisk = m.tsa.filter((t) => t.risk);
  const ask = async (t: (typeof m.tsa)[number]) => {
    setBusy(t.row.tsa_id);
    const r = await runAI(tsaAdvice, { service: t.row.service, fee: t.fee, target: fmtDate(t.row.target_exit, true), projected: fmtDate(t.projectedExit, true), expected: t.expected, actual: t.actual, extensionCost: t.extensionCost, linkedReadiness: m.items.find((i) => i.app.id === t.row.linked_system)?.readiness });
    setAdvice({ ...advice, [t.row.tsa_id]: r }); setBusy(null);
  };
  const milestone = (rid: string, delta: number) => act(delta > 0 ? 'Recorded TSA exit milestone' : 'Reverted TSA milestone', m.tsa.find((t) => t.row._rid === rid)?.row.service ?? '', (d) => { const r = d.datasets.tsa!.rows.find((x) => x._rid === rid)!; r.milestones_done = Math.max(0, Math.min(Number(r.milestones_total), Number(r.milestones_done) + delta)); }, { skipIssues: true });
  if (!m.tsa.length) return <Empty title="No TSA schedule">Upload 08_TSA_Schedule.csv.</Empty>;
  return <div className="content-grid two-thirds">
    <section className="card"><div className="card-header"><div><h2>TSA service exit plan</h2><p>{money(m.tsaMonthly)} monthly run rate across {m.tsa.length} seller services · burn-down compared every two weeks</p></div>{atRisk.length ? <Badge tone="warning">{money(atRisk.reduce((x, t) => x + t.fee, 0))}/mo at risk</Badge> : <Badge tone="success">On plan</Badge>}</div>
      <div className="tsa-timeline">{m.tsa.map((t) => <div key={t.row._rid} style={{ gridTemplateColumns: '38px 1.2fr 1.3fr .9fr 150px' }}>
        <span className="tsa-icon"><Icon name="network" /></span>
        <div><strong>{t.row.service}</strong><span>{money(t.fee)}/mo · Owner: {t.row.owner} · {t.linked?.name ?? t.row.linked_system}</span>{advice[t.row.tsa_id] && <span style={{ color: 'var(--text-2)' }}><AIChip result={advice[t.row.tsa_id]} /> {advice[t.row.tsa_id].data.text}</span>}</div>
        <div><span>Target exit <strong>{fmtDate(t.row.target_exit)}</strong> · projected <strong style={{ color: t.risk ? 'var(--red)' : undefined }}>{fmtDate(t.projectedExit)}</strong></span><Progress value={t.actual} tone={t.risk ? 'red' : 'orange'} /><span>{t.done}/{t.total} milestones · {t.actual}% done vs {t.expected}% planned</span></div>
        <div><Badge tone={t.status === 'Extension risk' ? 'danger' : t.status === 'Data gate' ? 'warning' : t.status === 'Watch' ? 'warning' : 'success'}>{t.status}</Badge>{t.risk && <span>+{t.extraMonths} mo · {money(t.extensionCost)}</span>}</div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="secondary" onClick={() => { milestone(t.row._rid, 1); toast('Milestone recorded — projection updated'); }}>+ Milestone</Button><Menu items={[{ label: 'Undo milestone', icon: 'refresh', onClick: () => milestone(t.row._rid, -1) }, { label: 'AI mitigation advice', icon: 'spark', onClick: () => ask(t) }, { label: 'Extend target exit by 1 month', icon: 'calendar', onClick: () => act('Extended TSA target exit', `${t.row.service} → ${fmtDate(addDays(t.row.target_exit, 30))} (125% fee)`, (d) => { d.datasets.tsa!.rows.find((x) => x._rid === t.row._rid)!.target_exit = addDays(t.row.target_exit, 30); }, { kind: 'override', skipIssues: true }) }]} />{busy === t.row.tsa_id && <span className="spinner" />}</div>
      </div>)}</div>
    </section>
    <section className="card"><div className="card-header"><div><h2>Burn-down</h2><p>Services remaining on TSA after Day-1 ({fmtDate(s.deal.day1)})</p></div></div><div className="card-body"><BurnDown /><p className="muted small">Extension cost uses SPA 9.2: 125% of the monthly charge for each extra month.</p></div></section>
  </div>;
}

function Waves() {
  const { s, m, act, toast } = useStore();
  const [open, setOpen] = useState<number | null>(null);
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
          <div><span>{groups.length ? groups.map((g) => `${g.id}: ${g.apps.map((a) => a.name).join(', ')}`).join(' · ') : 'No groups assigned'}</span></div>
          <div><small>Data hygiene</small><strong style={{ color: gated ? 'var(--red)' : undefined }}>{groups.length ? hyg : '—'}</strong></div>
          <Badge tone={status === 'Released' || status === 'Ready' ? 'success' : status === 'Blocked' ? 'danger' : 'neutral'}>{status}</Badge>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setOpen(open === w.n ? null : w.n)}>{checks.filter(Boolean).length}/12 steps</Button>
            {!released ? <Button variant="secondary" disabled={!groups.length || gated} title={gated ? `Blocked: ${groups.find((g) => g.hygiene < s.config.hygieneGate)?.hygieneSource} scores ${hyg}` : ''} onClick={() => { act(`Released Wave ${w.n}`, groups.map((g) => g.id).join(', '), (d) => { d.waveReleased[`W${w.n}`] = true; }, { kind: 'approve', skipIssues: true }); toast(`Wave ${w.n} released`); }}>Release wave</Button>
              : <Button variant="ghost" onClick={() => act(`Re-opened Wave ${w.n}`, '', (d) => { d.waveReleased[`W${w.n}`] = false; }, { kind: 'override', skipIssues: true })}>Undo</Button>}
          </div>
        </div>
        {gated && groups.length > 0 && <p className="small" style={{ color: 'var(--red)', margin: '6px 0 0 50px' }}>Data gate: {groups.filter((g) => g.hygiene < s.config.hygieneGate).map((g) => `${g.id} uses ${g.hygieneSource} (${g.hygiene})`).join('; ')} — clean it in Data & Inventory to release.</p>}
        {open === w.n && <div style={{ margin: '10px 0 0 50px' }}>
          <div className="grid-2">{ROADMAP_12.map((step, i) => <label key={step} className="row small" style={{ cursor: 'pointer', padding: '4px 0' }}><input type="checkbox" checked={!!checks[i]} onChange={() => act('Updated wave checklist', `Wave ${w.n}: ${step} ${checks[i] ? 'unchecked' : 'done'}`, (d) => { const c = [...(d.waveChecklist[`W${w.n}`] ?? Array(12).fill(false))]; c[i] = !c[i]; d.waveChecklist[`W${w.n}`] = c; }, { skipIssues: true })} />{i + 1}. {step}</label>)}</div>
          <div className="row mt small">Reassign group: {m.moveGroups.map((g) => <span key={g.id} className="chip">{g.id}<select className="inline" value={g.wave} onChange={(e) => act('Moved group to another wave', `${g.id} → Wave ${e.target.value}`, (d) => { d.waveOverrides[g.id] = +e.target.value; }, { kind: 'override', skipIssues: true })}>{WAVES.map((x) => <option key={x.n} value={x.n}>W{x.n}</option>)}</select></span>)}</div>
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
