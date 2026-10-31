import { useMemo, useState } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { readinessProjections } from '../ai/context';
import { readinessPath } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Modal, PageTitle, Progress, ScoreRing, signalTone, Table, toneFor } from '../components/ui';
import { simulateReadiness } from '../engine/model';
import { fmtDate, openPrintable } from '../engine/util';
import { useStore } from '../state/store';

export function scorecardHtml(s: ReturnType<typeof useStore>['s'], m: ReturnType<typeof useStore>['m']) {
  const tone = m.signal === 'GO' ? 'green' : m.signal === 'NO-GO' ? 'red' : 'amber';
  return `<div class="brand">pwc · DealSync</div><h1>Day-1 Readiness Scorecard</h1><div class="muted">${s.deal.name} · ${fmtDate(s.deal.asOf, true)} · Day-1 ${fmtDate(s.deal.day1, true)}</div>
  <div style="display:flex;gap:40px;align-items:center;margin:24px 0"><div><div class="big">${m.score}</div><span class="pill ${tone}">${m.signal}</span></div><div class="muted">${m.capped ? `Underlying ${m.underlying}; capped at ${s.config.blockerCap} — critical blocker: ${m.criticalBlocked.map((i) => i.app.name).join(', ')}` : 'No critical blocker cap applied'}<br/>Tests passed ${m.testsPassed}/${m.tests.length} · Data hygiene ${m.avgHygiene} · Tasks ${m.doneTasks}/${m.totalTasks}</div></div>
  <h2>By component</h2><table><tr><th>Component</th><th>Weight</th><th>Score</th></tr>${m.components.map((c) => `<tr><td>${c.name}</td><td>${Math.round(c.weight * 100)}%</td><td>${c.score}${c.blocked ? ' (blocked)' : ''}</td></tr>`).join('')}</table>
  <h2>Day-1 critical items</h2><table><tr><th>Item</th><th>Tasks</th><th>Tests</th><th>Hygiene</th><th>Readiness</th></tr>${m.items.map((i) => `<tr><td>${i.app.name}${i.blocked ? ' — BLOCKED' : ''}</td><td>${i.tasksDone}/${i.tasksTotal}</td><td>${i.testsPassed}/${i.testsTotal}</td><td>${i.hygiene}</td><td>${i.readiness}</td></tr>`).join('')}</table>
  <p class="muted">Formula: item readiness = ${s.config.readinessWeights.tasks * 100}% tasks + ${s.config.readinessWeights.tests * 100}% tests + ${s.config.readinessWeights.hygiene * 100}% data hygiene; components weighted by business impact; 90+ Go, 80–89 conditions, below 80 No-go.</p>`;
}

export function Readiness() {
  const { s, m, act, toast, navigate } = useStore();
  const [formula, setFormula] = useState(false);
  const [selected, setSelected] = useState(m.components.find((c) => c.blocked)?.name ?? m.components[0]?.name);
  const [testsOpen, setTestsOpen] = useState(false);
  const [upload, setUpload] = useState(false);
  const [whatIf, setWhatIf] = useState<Record<string, { unblock?: boolean; tasks?: boolean; tests?: boolean }>>({});
  const [ai, setAi] = useState<AIResult<{ text: string }> | null>(null);
  const [busy, setBusy] = useState(false);

  const comp = m.components.find((c) => c.name === selected) ?? m.components[0];
  const sim = useMemo(() => {
    const ids = Object.entries(whatIf);
    if (!ids.some(([, v]) => v.unblock || v.tasks || v.tests)) return null;
    return simulateReadiness(s, { unblock: ids.filter(([, v]) => v.unblock).map(([k]) => k), completeTasksFor: ids.filter(([, v]) => v.tasks).map(([k]) => k), passTestsFor: ids.filter(([, v]) => v.tests).map(([k]) => k) });
  }, [whatIf, s]);

  const fastest = async () => {
    setBusy(true);
    const r = await runAI(readinessPath, { score: m.score, underlying: m.underlying, signal: m.signal, capped: m.capped, blockers: m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => `${i.app.name}: ${b.title} (owner ${b.owner}, due ${fmtDate(b.due_date)})`)), weakest: [...m.items].sort((a, b) => a.readiness - b.readiness).slice(0, 5).map((i) => ({ name: i.app.name, readiness: i.readiness, open: i.tasksTotal - i.tasksDone, failed: i.testsTotal - i.testsPassed })), projections: readinessProjections(s, m) });
    setAi(r); setBusy(false);
  };
  const setTest = (rid: string, result: string) => act('Recorded test result', `${s.datasets.tests?.rows.find((t) => t._rid === rid)?.test_case} → ${result}`, (d) => { const t = d.datasets.tests!.rows.find((x) => x._rid === rid); if (t) { t.result = result; t.run_date = d.deal.asOf; t.tester = d.currentUser; } }, { skipIssues: true });

  if (!m.items.length) return <><PageTitle eyebrow="Track & score" title="Day-1 Readiness" description="Explainable readiness by component, test evidence and critical dependency." /><Empty title="No Day-1 critical items yet">Upload applications, tasks and test results to calculate readiness.</Empty></>;

  return <>
    <PageTitle eyebrow="Track & score" title="Day-1 Readiness" description="Explainable readiness by component, test evidence and critical dependency." action={<><Button variant="secondary" icon="upload" onClick={() => setUpload(true)}>Upload test results</Button><Button variant="secondary" icon="download" onClick={() => { openPrintable('Readiness scorecard', scorecardHtml(s, m)) ? toast('Scorecard opened — print or save as PDF') : toast('Allow pop-ups to open the scorecard', 'warning'); }}>Board scorecard</Button></>} />
    <div className="readiness-hero" style={{ borderTopColor: m.signal === 'GO' ? 'var(--green)' : m.signal === 'NO-GO' ? 'var(--red)' : '#d99a1e' }}>
      <div className="hero-score" style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 22 }}><ScoreRing large score={m.score} label={m.signal} /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Badge tone={m.capped ? 'danger' : signalTone(m.signal)}>{m.capped ? 'CRITICAL BLOCKER ACTIVE' : m.signal}</Badge><h2 style={{ margin: 0, fontSize: 20 }}>{m.signal === 'GO' ? 'Day-1 is ready' : m.signal === 'NO-GO' ? 'Day-1 is not yet ready' : 'Day-1 is ready with conditions'}</h2><p style={{ margin: 0, fontSize: 11 }}>The weighted readiness result is <strong>{m.underlying}</strong>.{m.capped ? <> {m.criticalBlocked.map((i) => i.app.name).join(', ')} is blocked, activating the critical-item cap at {s.config.blockerCap}.</> : null}</p><button className="text-action" onClick={() => setFormula(!formula)}>How is this calculated? <Icon name="chevron" size={14} /></button></div></div>
      <div className="readiness-meta"><div><Icon name="calendar" /><span>Day-1 date<strong>{fmtDate(s.deal.day1, true)}</strong></span></div><div><Icon name="clock" /><span>Time remaining<strong>{m.daysToDay1} days</strong></span></div><div style={{ cursor: 'pointer' }} onClick={() => navigate('Execution Tracker', { q: m.criticalBlocked[0]?.app.id ?? '' })}><Icon name="alert" /><span>Critical blockers<strong className={m.criticalBlocked.length ? 'red-text' : ''}>{m.criticalBlocked.length} open</strong></span></div><div style={{ cursor: 'pointer' }} onClick={() => setTestsOpen(true)}><Icon name="check" /><span>Tests passed<strong>{m.testsPassed} / {m.tests.length}</strong></span></div></div>
    </div>
    {formula && <div className="formula-panel" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fff', padding: '12px 16px', margin: '12px 0', fontSize: 10 }}><strong>Item readiness</strong><span>{s.config.readinessWeights.tasks * 100}% tasks complete</span><b>+</b><span>{s.config.readinessWeights.tests * 100}% tests passed</span><b>+</b><span>{s.config.readinessWeights.hygiene * 100}% data hygiene</span><b>→</b><span>components weighted: {m.components.map((c) => `${c.name} ${Math.round(c.weight * 100)}%`).join(', ')}</span><i>Critical tool or revenue-linked blocker → capped at {s.config.blockerCap}. 90+ Go · 80–89 conditions · &lt;80 No-go</i></div>}
    <div className="content-grid two-thirds readiness-layout mt">
      <section className="card">
        <div className="card-header"><div><h2>Readiness by component</h2><p>Click a component to inspect its evidence</p></div><span className="updated small muted">Recalculated live</span></div>
        <div className="component-list">{m.components.map((c) => { const tone = c.blocked ? 'red' : toneFor(c.score); return <button key={c.name} className={selected === c.name ? 'selected' : ''} onClick={() => setSelected(c.name)}><span className={`component-status ${tone}`}><Icon name={tone === 'green' ? 'check' : tone === 'red' ? 'alert' : 'clock'} /></span><span><strong>{c.name}</strong><small>{c.blocked ? `${c.items.filter((i) => i.blocked).map((i) => i.app.name).join(', ')} blocked` : `${c.items.length} item${c.items.length > 1 ? 's' : ''} · weight ${Math.round(c.weight * 100)}%`}</small></span><div><strong>{c.score}%</strong><Progress value={c.score} tone={tone} /></div><Icon name="chevron" /></button>; })}</div>
      </section>
      <section className="card evidence-panel">
        <div className="card-header"><div><span className="eyebrow">Selected component</span><h2>{comp.name}</h2></div><Badge tone={comp.blocked ? 'danger' : toneFor(comp.score) === 'green' ? 'success' : 'warning'}>{comp.score}% {comp.blocked ? '· Blocked' : ''}</Badge></div>
        <div className="card-body stack">{comp.items.map((i) => <div key={i.app.id} className="lesson-card">
          <header><strong>{i.app.name}</strong>{i.blocked ? <Badge tone="danger">Blocked</Badge> : <Badge tone={toneFor(i.readiness) === 'green' ? 'success' : 'warning'}>{i.readiness}%</Badge>}</header>
          {i.blockers.map((b) => <div key={b._rid} className="evidence-item critical row" style={{ background: 'var(--red-bg)', padding: 8 }}><Icon name="alert" size={14} /><div style={{ flex: 1 }}><strong>{b.title}</strong><div className="muted small">Owner: {b.owner}</div></div><Badge tone="danger">Due {fmtDate(b.due_date)}</Badge></div>)}
          <div className="bar-row"><span>Tasks complete <b>{i.tasksDone} / {i.tasksTotal}</b></span><Progress value={(100 * i.tasksDone) / (i.tasksTotal || 1)} tone={toneFor((100 * i.tasksDone) / (i.tasksTotal || 1))} /><button className="text-action" onClick={() => navigate('Execution Tracker', { q: i.app.id })}>Open</button></div>
          <div className="bar-row"><span>Tests passed <b>{i.testsPassed} / {i.testsTotal}</b></span><Progress value={(100 * i.testsPassed) / (i.testsTotal || 1)} tone={toneFor((100 * i.testsPassed) / (i.testsTotal || 1))} /><button className="text-action" onClick={() => setTestsOpen(true)}>Tests</button></div>
          <div className="bar-row"><span>Data hygiene <b>{i.hygiene} / 100</b></span><Progress value={i.hygiene} tone={toneFor(i.hygiene)} /><button className="text-action" onClick={() => navigate('Data & Inventory', { tab: 'quality', dataset: i.app.id === 'APP-004' ? 'erp' : 'applications' })}>Data</button></div>
          <div className="calculation muted small">{s.config.readinessWeights.tasks * 100}% × {Math.round((100 * i.tasksDone) / (i.tasksTotal || 1))} + {s.config.readinessWeights.tests * 100}% × {Math.round((100 * i.testsPassed) / (i.testsTotal || 1))} + {s.config.readinessWeights.hygiene * 100}% × {i.hygiene} = <strong>{i.readiness}%</strong></div>
        </div>)}</div>
      </section>
    </div>
    <div className="content-grid halves">
      <section className="card"><div className="card-header"><div><h2>What-if simulator</h2><p>Projects the score if actions complete — simulation only, data is not changed</p></div>{sim && <Button variant="ghost" onClick={() => setWhatIf({})}>Reset</Button>}</div>
        <div className="card-body what-if"><Table cols="1.6fr 80px 80px 80px" head={['Item (weakest first)', 'Unblock', 'All tasks', 'All tests']}>{[...m.items].sort((a, b) => a.readiness - b.readiness).map((i) => <div className="tr" key={i.app.id}><span><strong>{i.app.name}</strong><small>{i.readiness}% now</small></span>{(['unblock', 'tasks', 'tests'] as const).map((k) => <span key={k}><input type="checkbox" disabled={k === 'unblock' && !i.blocked} checked={!!whatIf[i.app.id]?.[k]} onChange={(e) => setWhatIf({ ...whatIf, [i.app.id]: { ...whatIf[i.app.id], [k]: e.target.checked } })} /></span>)}</div>)}</Table>
          <div className="what-if-result"><span className="muted small">Projected</span><strong>{sim?.score ?? m.score}</strong><Badge tone={signalTone(sim?.signal ?? m.signal)}>{sim?.signal ?? m.signal}</Badge><span className="muted small">{sim ? `underlying ${sim.underlying}${sim.capped ? ' · still capped' : ''}` : 'tick actions above'}</span></div></div></section>
      <section className="card"><div className="card-header"><div><h2>Fastest path to GO</h2><p>AI explains the formula projections — every number comes from the readiness formula</p></div><div className="row"><AIChip result={ai} /><Button variant="secondary" icon="spark" loading={busy} onClick={fastest}>{ai ? 'Refresh' : 'Explain with AI'}</Button></div></div>
        <div className="card-body stack">{readinessProjections(s, m).map((p) => <div key={p.label} className="row between small" style={{ borderBottom: '1px solid #f1f0ee', padding: '6px 0' }}><span>{p.label}</span><span className="row"><strong>{p.score}</strong><Badge tone={signalTone(p.signal)}>{p.signal}</Badge></span></div>)}
          {ai && <div className="next-step ai-box"><div className="ai-head"><Icon name="spark" size={14} />Fastest path to GO</div>{ai.data.text}</div>}</div></section>
    </div>
    {testsOpen && <Modal wide title="Day-1 test evidence" subtitle={`${m.testsPassed} of ${m.tests.length} tests passed · record results as tests are run`} onClose={() => setTestsOpen(false)} footer={<Button onClick={() => setTestsOpen(false)}>Done</Button>}>
      <Table cols="80px 2fr 1.2fr 90px 90px 170px" head={['Test', 'Case', 'Item', 'Result', 'Run', 'Record result']}>{m.tests.map((t) => <div className="tr" key={t._rid}><span>{t.test_id}</span><span>{t.test_case}</span><span>{m.byId.get(t.app_id)?.name ?? t.app_id}</span><span><Badge tone={/pass/i.test(t.result) ? 'success' : /fail/i.test(t.result) ? 'danger' : 'neutral'}>{t.result}</Badge></span><span className="muted">{fmtDate(t.run_date)}</span><span className="row"><Button variant="ghost" onClick={() => setTest(t._rid, 'Passed')}>Pass</Button><Button variant="ghost" onClick={() => setTest(t._rid, 'Failed')}>Fail</Button></span></div>)}</Table>
    </Modal>}
    {upload && <UploadModal expected="tests" onClose={() => setUpload(false)} />}
  </>;
}
