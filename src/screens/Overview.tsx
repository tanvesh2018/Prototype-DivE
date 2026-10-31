import { useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { buildLiveContext } from '../ai/context';
import { dealBrief } from '../ai/tasks';
import { AIChip, Badge, Button, Icon, MetricCard, PageTitle, Progress, ScoreRing, signalTone, toneFor } from '../components/ui';
import { DATASET } from '../engine/glossary';
import { fmtDate, money, openPrintable } from '../engine/util';
import { useStore } from '../state/store';

export function boardPackHtml(s: ReturnType<typeof useStore>['s'], m: ReturnType<typeof useStore>['m']) {
  const tone = m.signal === 'GO' ? 'green' : m.signal === 'NO-GO' ? 'red' : 'amber';
  return `<div class="brand">pwc · DealSync</div><h1>${s.deal.name} — Day-1 board pack</h1><div class="muted">${s.deal.buyer} / ${s.deal.seller} · ${s.deal.dealType} · as of ${fmtDate(s.deal.asOf, true)} · Day-1 ${fmtDate(s.deal.day1, true)} (${m.daysToDay1} days)</div>
  <h2>Day-1 readiness</h2><span class="big">${m.score}</span> / 100 &nbsp; <span class="pill ${tone}">${m.signal}</span>${m.capped ? `<p class="muted">Underlying score ${m.underlying}, capped at ${s.config.blockerCap} because a critical item is blocked.</p>` : ''}
  <table><tr><th>Component</th><th>Weight</th><th>Readiness</th><th>Items</th></tr>${m.components.map((c) => `<tr><td>${c.name}</td><td>${Math.round(c.weight * 100)}%</td><td>${c.score}</td><td>${c.items.map((i) => `${i.app.name} ${i.readiness}${i.blocked ? ' (BLOCKED)' : ''}`).join(', ')}</td></tr>`).join('')}</table>
  <h2>Blockers & owners</h2><table><tr><th>Item</th><th>Task</th><th>Owner</th><th>Due</th></tr>${m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => `<tr><td>${i.app.name}</td><td>${b.title}</td><td>${b.owner}</td><td>${fmtDate(b.due_date)}</td></tr>`)).join('') || '<tr><td colspan=4>None</td></tr>'}</table>
  <h2>Workstreams</h2><table><tr><th>Workstream</th><th>Done</th><th>%</th></tr>${m.wsProgress.map((w) => `<tr><td>${w.name}</td><td>${w.done}/${w.total}</td><td>${w.pct}%</td></tr>`).join('')}</table>
  <h2>Separation costs</h2><table><tr><th>Line</th><th>Total</th><th>Seller</th><th>Buyer</th><th>Status</th></tr>${m.sepLines.map((l) => `<tr><td>${l.row.description}</td><td>${money(l.amount)}</td><td>${money(l.seller)}</td><td>${money(l.buyer)}</td><td>${l.row.status}</td></tr>`).join('')}<tr><th>Total</th><th>${money(m.sepTotal)}</th><th>${money(m.sellerTotal)}</th><th>${money(m.buyerTotal)}</th><th></th></tr></table>
  <h2>TSA exit</h2><table><tr><th>Service</th><th>Fee/month</th><th>Target exit</th><th>Projected</th><th>Status</th></tr>${m.tsa.map((t) => `<tr><td>${t.row.service}</td><td>${money(t.fee)}</td><td>${fmtDate(t.row.target_exit)}</td><td>${fmtDate(t.projectedExit)}</td><td>${t.status}</td></tr>`).join('')}</table>
  <h2>Decisions</h2><table><tr><th>Decision</th><th>Recommended</th><th>Status</th></tr>${m.decisions.map((d) => `<tr><td>${d.title}</td><td>${d.recommended?.name ?? '—'} (${d.recommended?.total ?? '—'})</td><td>${d.state.status}</td></tr>`).join('')}</table>
  <p class="muted" style="margin-top:30px">Illustrative prototype data. Every score is traceable to its formula in DealSync. AI-drafted text is reviewed by the engagement team.</p>`;
}

export function Overview() {
  const { s, m, act, navigate, toast } = useStore();
  const [drill, setDrill] = useState(false);
  const [brief, setBrief] = useState<AIResult<{ bullets: string[] }> | null>(null);
  const [busy, setBusy] = useState(false);

  const mapped = m.apps.filter((a) => a.serverId && s.datasets.servers?.rows.some((r) => r.server_id === a.serverId)).length;
  const review = m.apps.length - mapped + m.apps.filter((a) => a.unclear).length;
  const behind = m.wsProgress.filter((w) => w.pct < 75);
  const blockers = [
    ...m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => ({ sev: i.critical ? 'P0' : 'P1', title: b.title, sub: `${i.app.name} · ${b.owner} · Due ${fmtDate(b.due_date)}`, go: () => navigate('Execution Tracker', { q: b.task_id }) }))),
    ...m.datasetsHygiene.filter((d) => d.score < s.config.hygieneGate).map((d) => ({ sev: 'P1', title: `${DATASET[d.key as keyof typeof DATASET].label} data below gate`, sub: `Hygiene ${d.score} · ${d.key === 'erp' ? 'Wave 2 cannot commence' : 'cannot feed decisions'}`, go: () => navigate('Data & Inventory', { tab: 'quality', dataset: d.key }) })),
    ...m.disputed.map((l) => ({ sev: 'P1', title: `${money(l.amount)} ${l.row.description.toLowerCase()} disputed`, sub: 'Funding must be secured before Day-1', go: () => navigate('Funding & TSA Exit') })),
    ...m.tsa.filter((t) => t.risk).map((t) => ({ sev: 'P2', title: `TSA extension risk: ${t.row.service}`, sub: `${money(t.fee)}/mo · projected ${fmtDate(t.projectedExit)}`, go: () => navigate('Funding & TSA Exit', { tab: 'tsa' }) })),
  ];
  const nextWave = [0, 1, 2, 3, 4].find((w) => !s.waveReleased[`W${w}`]);
  const pending = [
    ...m.decisions.filter((d) => d.state.status !== 'approved').map((d) => ({ date: d.due, title: d.title, sub: `${d.approver} · ${d.state.status === 'changes_requested' ? 'Changes requested' : 'Recommendation ready'}`, go: () => navigate('Separation Decisions', { tab: 'options', decision: d.id }) })),
    ...(m.disputed.length && !s.funding.packages.some((p) => p.status !== 'draft') ? [{ date: '2025-11-12', title: 'Bridge facility approval', sub: `CFO · ${money(m.disputedAmount)} / 12 months`, go: () => navigate('Funding & TSA Exit') }] : []),
    ...(nextWave !== undefined ? [{ date: s.deal.day1, title: `Wave ${nextWave} release gate`, sub: `Deal Board · ${m.moveGroups.filter((g) => g.wave === nextWave).length} move group(s)`, go: () => navigate('Funding & TSA Exit', { tab: 'waves' }) }] : []),
  ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const genBrief = async () => {
    setBusy(true);
    const r = await runAI(dealBrief, { context: buildLiveContext(s, m) });
    setBrief(r); setBusy(false);
    act('Generated AI daily brief', r.source === 'gemini' ? `Gemini ${r.model}` : 'Rule-based fallback', () => {}, { kind: 'ai', allowReadOnly: true, skipIssues: true });
  };

  const exportPack = () => { if (!openPrintable(`${s.deal.name} board pack`, boardPackHtml(s, m))) toast('Allow pop-ups to open the board pack', 'warning'); else toast('Board pack opened — use Print / Save as PDF'); };

  return <>
    <PageTitle eyebrow="Command centre" title="Deal Overview" description={`Executive control room for ${s.deal.name}'s Day-1 separation.`} action={<><Button variant="secondary" icon="download" onClick={exportPack}>Export board pack</Button><Button icon="spark" onClick={() => navigate('Knowledge & Market Insights')}>Ask Copilot</Button></>} />
    {!s.dismissedNotice && <div className="notice"><Icon name="alert" /><div><strong>Illustrative demo data</strong><span>{s.deal.name} is an academic concept. Company names and most values are representative. Upload your own files in Data & Inventory.</span></div><button onClick={() => act('Dismissed notice', 'Demo data notice', (d) => { d.dismissedNotice = true; }, { allowReadOnly: true, skipIssues: true })}>Dismiss</button></div>}
    <div className="metrics-grid">
      <MetricCard label="Day-1 readiness" value={`${m.score} / 100`} tone={m.signal === 'NO-GO' ? 'danger' : ''} icon="readiness" onClick={() => setDrill(!drill)} detail={<><Badge tone={signalTone(m.signal)}>{m.signal}</Badge><span>{m.capped ? `Underlying score ${m.underlying} · capped` : `${m.items.length} Day-1 critical items`}</span></>} />
      <MetricCard label="Technology estate" value={m.apps.length} icon="database" onClick={() => navigate('Dependency Explorer')} detail={<><span className="trend positive">{mapped} mapped</span><span>{review} need review</span></>} />
      <MetricCard label="Active workstreams" value={m.wsProgress.filter((w) => w.total).length} icon="tasks" onClick={() => navigate('Execution Tracker')} detail={<><span className={`trend ${behind.length ? 'warning' : 'positive'}`}>{behind.length} behind plan</span><span>{m.totalTasks} activities</span></>} />
      <MetricCard label="Funding gap" value={money(m.sepTotal)} icon="funding" onClick={() => navigate('Funding & TSA Exit')} detail={<><span className="trend negative">{money(m.disputedAmount)} disputed</span><span>3 options modelled</span></>} />
    </div>
    {drill && <div className="drill-banner"><div><Icon name="alert" /><div><strong>{m.capped ? `Why is readiness capped at ${m.score}?` : `How is ${m.score} calculated?`}</strong><span>{m.capped ? `${m.criticalBlocked.map((i) => i.app.name).join(', ')} is Day-1 critical and blocked (${m.criticalBlocked[0]?.blockers[0]?.title}). The calculated score is ${m.underlying}, but the critical blocker rule caps the outcome at ${s.config.blockerCap}.` : `Weighted average of ${m.components.length} components: ${m.components.map((c) => `${c.name} ${c.score}`).join(', ')}.`}</span></div></div><Button variant="secondary" onClick={() => navigate('Day-1 Readiness')}>Open score breakdown</Button></div>}
    <div className="content-grid two-thirds">
      <section className="card">
        <div className="card-header"><div><h2>Workstream progress</h2><p>Completion across all {m.wsProgress.length} separation workstreams</p></div><button className="text-action" onClick={() => navigate('Execution Tracker')}>Open tracker <Icon name="arrow" size={15} /></button></div>
        <div className="workstream-grid">{m.wsProgress.map((w) => <div className="workstream" key={w.name} style={{ cursor: 'pointer' }} onClick={() => navigate('Execution Tracker', { ws: w.name })}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6 }}><span>{w.name}</span><strong>{w.pct}%</strong></div><Progress value={w.pct} tone={toneFor(w.pct, 85, 75)} /></div>)}</div>
      </section>
      <section className="card readiness-card">
        <div className="card-header"><div><h2>Day-1 decision</h2><p>Recalculated live · as of {fmtDate(s.deal.asOf, true)}</p></div><Badge tone={signalTone(m.signal)}>{m.signal}</Badge></div>
        <ScoreRing score={m.score} label="of 100" />
        <div className="score-legend" style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 8, color: 'var(--text-3)' }}><span><Badge tone="danger">0–79 No-go</Badge></span><span><Badge tone="warning">80–89 Conditions</Badge></span><span><Badge tone="success">90+ Go</Badge></span></div>
        <button className="full-link text-action" style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 12 }} onClick={() => navigate('Day-1 Readiness')}>View readiness drivers <Icon name="chevron" size={15} /></button>
      </section>
    </div>
    <div className="content-grid halves">
      <section className="card">
        <div className="card-header"><div><h2>Critical blockers</h2><p>Items requiring immediate intervention</p></div><Badge tone={blockers.length ? 'danger' : 'success'}>{blockers.length} open</Badge></div>
        <div className="issue-list">{blockers.length ? blockers.slice(0, 6).map((b, i) => <button key={i} onClick={b.go} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '10px 16px', border: 0, borderBottom: '1px solid #eee', background: '#fff', textAlign: 'left' }}><span className={`severity ${b.sev === 'P0' ? 'critical' : 'high'}`}>{b.sev}</span><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}><strong>{b.title}</strong><span className="muted small">{b.sub}</span></div><Icon name="chevron" /></button>) : <div className="empty">No blockers — nice.</div>}</div>
      </section>
      <section className="card">
        <div className="card-header"><div><h2>Pending decisions</h2><p>Leadership approvals awaiting action</p></div><Badge tone={pending.length ? 'warning' : 'success'}>{pending.length} pending</Badge></div>
        <div className="decision-list">{pending.slice(0, 5).map((p, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #eee' }}><span className="decision-date"><strong>{p.date?.slice(8, 10)}</strong>{fmtDate(p.date).slice(3).toUpperCase()}</span><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10 }}><strong>{p.title}</strong><span className="muted small">{p.sub}</span></div><Button variant="secondary" onClick={p.go}>Review</Button></div>)}{!pending.length && <div className="empty">All decisions closed.</div>}</div>
      </section>
    </div>
    <section className="card">
      <div className="card-header"><div><h2>AI daily brief</h2><p>Generated from live dashboard numbers — review before sharing</p></div><div className="row"><AIChip result={brief} /><Button variant="secondary" icon="spark" loading={busy} onClick={genBrief}>{brief ? 'Regenerate' : 'Generate brief'}</Button></div></div>
      <div className="card-body">{brief ? <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, lineHeight: 1.8 }}>{brief.data.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul> : <p className="muted small" style={{ margin: 0 }}>Click “Generate brief” for a 4-point summary of status, top risk, decision needed and next action.</p>}</div>
    </section>
  </>;
}
