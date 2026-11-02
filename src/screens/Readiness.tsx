import { useMemo, useState, type CSSProperties } from 'react';
import { runAI, type AIResult } from '../ai/client';
import { readinessProjections } from '../ai/context';
import { readinessPath } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Empty, Icon, Modal, PageTitle, Progress, ScoreRing, signalTone, Table, toneFor } from '../components/ui';
import { buildModel, isFinanceCore, simulateReadiness } from '../engine/model';
import { DEFAULT_CONFIG } from '../engine/workspace';
import { DecisionLogButton } from '../components/DecisionLog';
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
  const L = s.deal.milestoneLabel;
  const [selected, setSelected] = useState(m.components.find((c) => c.blocked)?.name ?? m.components[0]?.name);
  const [testsOpen, setTestsOpen] = useState(false);
  const [upload, setUpload] = useState(false);
  const [whatIf, setWhatIf] = useState<Record<string, { unblock?: boolean; tasks?: boolean; tests?: boolean }>>({});
  const [ai, setAi] = useState<AIResult<{ text: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [showLogic, setShowLogic] = useState(true);

  const comp = m.components.find((c) => c.name === selected) ?? m.components[0];
  const projections = useMemo(() => readinessProjections(s, m), [s, m]);
  const sim = useMemo(() => {
    const ids = Object.entries(whatIf);
    if (!ids.some(([, v]) => v.unblock || v.tasks || v.tests)) return null;
    return simulateReadiness(s, { unblock: ids.filter(([, v]) => v.unblock).map(([k]) => k), completeTasksFor: ids.filter(([, v]) => v.tasks).map(([k]) => k), passTestsFor: ids.filter(([, v]) => v.tests).map(([k]) => k) });
  }, [whatIf, s]);

  const fastest = async () => {
    setBusy(true);
    const r = await runAI(readinessPath, { score: m.score, underlying: m.underlying, signal: m.signal, capped: m.capped, blockers: m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => `${i.app.name}: ${b.title} (owner ${b.owner}, due ${fmtDate(b.due_date)})`)), weakest: [...m.items].sort((a, b) => a.readiness - b.readiness).slice(0, 5).map((i) => ({ name: i.app.name, readiness: i.readiness, open: i.tasksTotal - i.tasksDone, failed: i.testsTotal - i.testsPassed })), projections });
    setAi(r); setBusy(false);
  };
  const setTest = (rid: string, result: string) => act('Recorded test result', `${s.datasets.tests?.rows.find((t) => t._rid === rid)?.test_case} → ${result}`, (d) => { const t = d.datasets.tests!.rows.find((x) => x._rid === rid); if (t) { t.result = result; t.run_date = d.deal.asOf; t.tester = d.currentUser; } }, { skipIssues: true });
  const rw = s.config.readinessWeights;
  const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

  if (!m.items.length) return <><PageTitle eyebrow="Track & score" title={`${L} Readiness`} description="Explainable readiness by component, test evidence and critical dependency." /><Empty title={`No ${L} critical items yet`}>Upload applications, tasks and test results to calculate readiness.</Empty></>;

  return <>
    <PageTitle eyebrow="Track & score" title={`${L} Readiness`} description="Explainable readiness by component, test evidence and critical dependency — with adjustable weightages." action={<><DecisionLogButton modules={['Day-1 Readiness']} /><Button variant="secondary" icon="upload" onClick={() => setUpload(true)}>Upload test results</Button><Button variant="secondary" icon="download" onClick={() => { openPrintable('Readiness scorecard', scorecardHtml(s, m)) ? toast('Scorecard opened — print or save as PDF') : toast('Allow pop-ups to open the scorecard', 'warning'); }}>Board scorecard</Button></>} />
    <div className="readiness-hero" style={{ borderTopColor: m.signal === 'GO' ? 'var(--green)' : m.signal === 'NO-GO' ? 'var(--red)' : '#d99a1e' }}>
      <div className="hero-score" style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 22 }}><ScoreRing large score={m.score} label={m.signal} /><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Badge tone={m.capped ? 'danger' : signalTone(m.signal)}>{m.capped ? 'CRITICAL BLOCKER ACTIVE' : m.signal}</Badge><h2 style={{ margin: 0, fontSize: 20 }}>{m.signal === 'GO' ? `${L} is ready` : m.signal === 'NO-GO' ? `${L} is not yet ready` : `${L} is ready with conditions`}</h2><p style={{ margin: 0, fontSize: 11 }}>The weighted readiness result is <strong>{m.underlying}</strong>.{m.capped ? <> {m.criticalBlocked.map((i) => i.app.name).join(', ')} is blocked, activating the critical-item cap at {s.config.blockerCap}.</> : m.criticalBlocked.length ? <> {m.criticalBlocked.map((i) => i.app.name).join(', ')} is blocked (the cap at {s.config.blockerCap} applies, but the score is already lower).</> : null}</p><button className="text-action" onClick={() => { setShowLogic(true); document.getElementById('calc-logic')?.scrollIntoView({ behavior: 'smooth' }); }}>How is this calculated? <Icon name="chevron" size={14} /></button></div></div>
      <div className="readiness-meta"><div><Icon name="calendar" /><span>{L} date<strong>{fmtDate(s.deal.day1, true)}</strong></span></div><div><Icon name="clock" /><span>Time remaining<strong>{m.daysToDay1} days</strong></span></div><div style={{ cursor: 'pointer' }} onClick={() => navigate('Execution Tracker', { q: m.criticalBlocked[0]?.app.id ?? '' })}><Icon name="alert" /><span>Critical blockers<strong className={m.criticalBlocked.length ? 'red-text' : ''}>{m.criticalBlocked.length} open</strong></span></div><div style={{ cursor: 'pointer' }} onClick={() => setTestsOpen(true)}><Icon name="check" /><span>Tests passed<strong>{m.testsPassed} / {m.tests.length}</strong></span></div></div>
    </div>
    <div className="content-grid two-thirds readiness-layout mt">
      <div className="readiness-left">
      <section className="card">
        <div className="card-header"><div><h2>Readiness by component</h2><p>Click a component to inspect its evidence and calculation</p></div><span className="updated small muted">Recalculated live</span></div>
        <div className="component-list">{m.components.map((c) => { const tone = c.blocked ? 'red' : toneFor(c.score); const wsum = m.components.reduce((x, k) => x + k.weight, 0) || 1; return <button key={c.name} className={selected === c.name ? 'selected' : ''} onClick={() => setSelected(c.name)}><span className={`component-status ${tone}`}><Icon name={tone === 'green' ? 'check' : tone === 'red' ? 'alert' : 'clock'} /></span><span><strong>{c.name}</strong><small>{c.blocked ? `${c.items.filter((i) => i.blocked).map((i) => i.app.name).join(', ')} blocked · ` : ''}{c.items.length} item{c.items.length > 1 ? 's' : ''} · weight {Math.round((100 * c.weight) / wsum)}%</small></span><div><strong>{c.score}%</strong><Progress value={c.score} tone={tone} /></div><Icon name="chevron" /></button>; })}</div>
        {m.noEvidence.length > 0 && <div className="ai-box" style={{ margin: 14, borderLeftColor: 'var(--amber)' }}><div className="ai-head"><Icon name="alert" size={14} />{m.noEvidence.length} critical item{m.noEvidence.length > 1 ? 's have' : ' has'} no tasks or tests yet</div>Not scored until a plan exists: {m.noEvidence.slice(0, 8).map((a) => a.name).join(', ')}{m.noEvidence.length > 8 ? ` +${m.noEvidence.length - 8} more` : ''}. Add tasks in the Execution Tracker to bring them into the score.</div>}
      </section>
      <WeightSliders onPick={(n) => setSelected(n as typeof selected)} />
      </div>
      <section className="card evidence-panel">
        <div className="card-header"><div><span className="eyebrow">Selected component</span><h2>{comp.name}</h2></div><Badge tone={comp.blocked ? 'danger' : toneFor(comp.score) === 'green' ? 'success' : 'warning'}>{comp.score}% {comp.blocked ? '· Blocked' : ''}</Badge></div>
        <div className="card-body stack">
          <div className="ai-box" style={{ borderLeftColor: '#2b2a28' }}><div className="ai-head"><Icon name="readiness" size={14} />How {comp.name} = {comp.score}% is calculated</div>
            Component score = average of its items = ({comp.items.map((i) => i.readiness).join(' + ')}) ÷ {comp.items.length} = <b>{comp.score}%</b>.{'\n'}It counts for <b>{Math.round((100 * comp.weight) / (m.components.reduce((x, k) => x + k.weight, 0) || 1))}%</b> of the overall score → contributes <b>{(comp.score * comp.weight / (m.components.reduce((x, k) => x + k.weight, 0) || 1)).toFixed(1)}</b> points.</div>
          {comp.items.map((i) => { const tp = pct(i.tasksDone, i.tasksTotal), te = pct(i.testsPassed, i.testsTotal); return <div key={i.app.id} className="lesson-card">
            <header><strong>{i.app.name}</strong>{i.blocked ? <Badge tone="danger">Blocked</Badge> : <Badge tone={toneFor(i.readiness) === 'green' ? 'success' : 'warning'}>{i.readiness}%</Badge>}</header>
            {i.blockers.map((b) => <div key={b._rid} className="evidence-item critical row" style={{ background: 'var(--red-bg)', padding: 8 }}><Icon name="alert" size={14} /><div style={{ flex: 1 }}><strong>{b.title}</strong><div className="muted small">Owner: {b.owner}</div></div><Badge tone="danger">Due {fmtDate(b.due_date)}</Badge></div>)}
            <div className="bar-row"><span>Tasks complete <b>{i.tasksDone} / {i.tasksTotal}</b></span><Progress value={tp} tone={toneFor(tp)} /><button className="text-action" onClick={() => navigate('Execution Tracker', { q: i.app.id })}>Open</button></div>
            <div className="bar-row"><span>Tests passed <b>{i.testsPassed} / {i.testsTotal}</b></span><Progress value={te} tone={toneFor(te)} /><button className="text-action" onClick={() => setTestsOpen(true)}>Tests</button></div>
            <div className="bar-row"><span>Data hygiene <b>{i.hygiene} / 100</b></span><Progress value={i.hygiene} tone={toneFor(i.hygiene)} /><button className="text-action" onClick={() => navigate('Data & Inventory', { tab: 'quality', dataset: isFinanceCore(i.app) ? 'erp' : 'applications' })}>Data</button></div>
            <table className="calc-table"><tbody>
              <tr><td>Tasks {tp}% × {Math.round(rw.tasks * 100)}%</td><td className="num">{(tp * rw.tasks).toFixed(1)}</td></tr>
              <tr><td>Tests {te}% × {Math.round(rw.tests * 100)}%</td><td className="num">{(te * rw.tests).toFixed(1)}</td></tr>
              <tr><td>Hygiene {i.hygiene} × {Math.round(rw.hygiene * 100)}%</td><td className="num">{(i.hygiene * rw.hygiene).toFixed(1)}</td></tr>
              <tr className="total"><td>Item readiness</td><td className="num">{i.readiness}%</td></tr>
            </tbody></table>
          </div>; })}
        </div>
      </section>
    </div>
    <section className="card mt" id="calc-logic">
      <div className="card-header"><div><h2>Calculation logic</h2><p>Exactly how the {L} Readiness Score is built — every number below is live</p></div><Button variant="ghost" onClick={() => setShowLogic(!showLogic)}>{showLogic ? 'Hide' : 'Show'}</Button></div>
      {showLogic && <div className="card-body stack">
        <ol className="step-list">
          <li><span><b>Pick the items that matter.</b> Only {L}-critical items are scored: Priority score ≥ {s.config.day1Threshold}, or flagged as a critical tool / revenue-linked ({m.items.length} items{m.noEvidence.length ? `; ${m.noEvidence.length} more have no plan yet and are listed separately` : ''}).</span></li>
          <li><span><b>Score each item (0–100).</b> Item readiness = {Math.round(rw.tasks * 100)}% × % of its tasks done + {Math.round(rw.tests * 100)}% × % of its tests passed + {Math.round(rw.hygiene * 100)}% × hygiene of its source data.</span></li>
          <li><span><b>Score each component.</b> Component score = simple average of its items' readiness.</span></li>
          <li><span><b>Weight the components.</b> Each component's weight reflects how much it can stop the business. Weights are normalised to add up to 100%. Overall = Σ (component score × weight) ÷ Σ weights = <b>{m.underlying}</b>.</span></li>
          <li><span><b>Apply the blocker rule.</b> If any critical-tool or revenue-linked item has a Blocked task, the score is capped at {s.config.blockerCap}.{m.capped ? ` Active now → ${m.underlying} becomes ${m.score}.` : ' Not reducing the score right now.'}</span></li>
          <li><span><b>Read the signal.</b> {s.config.goThreshold}+ = GO · {s.config.conditionsThreshold}–{s.config.goThreshold - 1} = GO with conditions · below {s.config.conditionsThreshold} = NO-GO. Current: <b>{m.score} → {m.signal}</b>.</span></li>
        </ol>
        <table className="calc-table"><thead><tr><th>Component</th><th>Items</th><th>Component score</th><th>Weight (raw)</th><th>Weight (share)</th><th>Contribution</th></tr></thead><tbody>
          {(() => { const wsum = m.components.reduce((x, c) => x + c.weight, 0) || 1; return <>{m.components.map((c) => <tr key={c.name}><td>{c.name}{c.blocked ? ' ⚠' : ''}</td><td>{c.items.length}</td><td>{c.score}</td><td>{c.weight.toFixed(2)}</td><td>{Math.round((100 * c.weight) / wsum)}%</td><td>{(c.score * c.weight / wsum).toFixed(1)}</td></tr>)}
            <tr className="total"><td colSpan={5}>Underlying score (Σ contributions)</td><td>{m.underlying}</td></tr>
            <tr className="total"><td colSpan={5}>Final score {m.capped ? `(capped at ${s.config.blockerCap} — critical blocker)` : ''}</td><td>{m.score} · {m.signal}</td></tr></>; })()}
        </tbody></table>
      </div>}
    </section>
    <div className="content-grid halves mt">
      <section className="card"><div className="card-header"><div><h2>What-if simulator</h2><p>Projects the score if actions complete — simulation only, data is not changed</p></div>{sim && <Button variant="ghost" onClick={() => setWhatIf({})}>Reset</Button>}</div>
        <div className="card-body what-if"><div className="scroll-y" style={{ maxHeight: 320 }}><Table cols="1.6fr 80px 80px 80px" head={['Item (weakest first)', 'Unblock', 'All tasks', 'All tests']}>{[...m.items].sort((a, b) => a.readiness - b.readiness).map((i) => <div className="tr" key={i.app.id}><span><strong>{i.app.name}</strong><small>{i.readiness}% now</small></span>{(['unblock', 'tasks', 'tests'] as const).map((k) => <span key={k}><input type="checkbox" disabled={k === 'unblock' && !i.blocked} checked={!!whatIf[i.app.id]?.[k]} onChange={(e) => setWhatIf({ ...whatIf, [i.app.id]: { ...whatIf[i.app.id], [k]: e.target.checked } })} /></span>)}</div>)}</Table></div>
          <div className="what-if-result"><span className="muted small">Projected</span><strong>{sim?.score ?? m.score}</strong><Badge tone={signalTone(sim?.signal ?? m.signal)}>{sim?.signal ?? m.signal}</Badge><span className="muted small">{sim ? `underlying ${sim.underlying}${sim.capped ? ' · still capped' : ''}` : 'tick actions above'}</span></div></div></section>
      <section className="card"><div className="card-header"><div><h2>Fastest path to GO</h2><p>AI explains the formula projections — every number comes from the readiness formula</p></div><div className="row"><AIChip result={ai} /><Button variant="secondary" icon="spark" loading={busy} onClick={fastest}>{ai ? 'Refresh' : 'Explain with AI'}</Button></div></div>
        <div className="card-body stack">{projections.map((p) => <div key={p.label} className="row between small" style={{ borderBottom: '1px solid #f1f0ee', padding: '6px 0' }}><span>{p.label}</span><span className="row"><strong>{p.score}</strong><Badge tone={signalTone(p.signal)}>{p.signal}</Badge></span></div>)}
          {ai && <div className="next-step ai-box"><div className="ai-head"><Icon name="spark" size={14} />Fastest path to GO</div>{ai.data.text}</div>}</div></section>
    </div>
    {testsOpen && <Modal wide title={`${L} test evidence`} subtitle={`${m.testsPassed} of ${m.tests.length} tests passed · record results as tests are run`} onClose={() => setTestsOpen(false)} footer={<Button onClick={() => setTestsOpen(false)}>Done</Button>}>
      <Table cols="80px 2fr 1.2fr 90px 90px 170px" head={['Test', 'Case', 'Item', 'Result', 'Run', 'Record result']}>{m.tests.map((t) => <div className="tr" key={t._rid}><span>{t.test_id}</span><span>{t.test_case}</span><span>{m.byId.get(t.app_id)?.name ?? t.app_id}</span><span><Badge tone={/pass/i.test(t.result) ? 'success' : /fail/i.test(t.result) ? 'danger' : 'neutral'}>{t.result}</Badge></span><span className="muted">{fmtDate(t.run_date)}</span><span className="row"><Button variant="ghost" onClick={() => setTest(t._rid, 'Passed')}>Pass</Button><Button variant="ghost" onClick={() => setTest(t._rid, 'Failed')}>Fail</Button></span></div>)}</Table>
    </Modal>}
    {upload && <UploadModal expected="tests" onClose={() => setUpload(false)} />}
  </>;
}

const MIX = ['#1a1a1a', '#fd5108', '#2764a8', '#18864b', '#b66a00', '#8a6fb0', '#74797f', '#c43131', '#3d8c8c', '#a05a2c', '#5b6b8c', '#9a9a2c'];

/** Weightage studio: sits under the component list. Preview the score live, then apply (logged + undoable). */
function WeightSliders({ onPick }: { onPick?: (name: string) => void }) {
  const { s, m, act, toast, readOnly } = useStore();
  const names = m.components.map((c) => c.name);
  const [cw, setCw] = useState<Record<string, number>>(() => Object.fromEntries(names.map((n) => [n, Math.round((s.config.componentWeights[n] ?? 0.05) * 100)])));
  const [iw, setIw] = useState(() => ({ tasks: Math.round(s.config.readinessWeights.tasks * 100), tests: Math.round(s.config.readinessWeights.tests * 100), hygiene: Math.round(s.config.readinessWeights.hygiene * 100) }));
  const [mode, setMode] = useState<'components' | 'items'>('components');
  const totalCw = names.reduce((x, n) => x + (cw[n] ?? 0), 0) || 1;
  const totalIw = iw.tasks + iw.tests + iw.hygiene || 1;
  const draftConfig = useMemo(() => ({ ...s.config, componentWeights: { ...s.config.componentWeights, ...Object.fromEntries(names.map((n) => [n, (cw[n] ?? 0) / 100])) }, readinessWeights: { tasks: iw.tasks / totalIw, tests: iw.tests / totalIw, hygiene: iw.hygiene / totalIw } }), [s.config, cw, iw, names, totalIw]);
  const changed = names.some((n) => Math.round((s.config.componentWeights[n] ?? 0.05) * 100) !== cw[n]) || Math.round(s.config.readinessWeights.tasks * 100) !== Math.round((iw.tasks / totalIw) * 100) || Math.round(s.config.readinessWeights.tests * 100) !== Math.round((iw.tests / totalIw) * 100);
  const preview = useMemo(() => (changed ? buildModel({ ...s, config: draftConfig }) : null), [changed, s, draftConfig]);
  const apply = () => {
    act('Changed readiness weightages', `Components: ${names.map((n) => `${n} ${Math.round(((cw[n] ?? 0) / totalCw) * 100)}%`).join(', ')} · Item: tasks ${Math.round((iw.tasks / totalIw) * 100)}% / tests ${Math.round((iw.tests / totalIw) * 100)}% / hygiene ${Math.round((iw.hygiene / totalIw) * 100)}%`, (d) => {
      names.forEach((n) => { d.config.componentWeights[n] = (cw[n] ?? 0) / 100; });
      d.config.readinessWeights = { tasks: iw.tasks / totalIw, tests: iw.tests / totalIw, hygiene: iw.hygiene / totalIw };
    }, { kind: 'override', skipIssues: true });
    toast('Weightages applied — score recalculated. Undo from the Decision log.');
  };
  const reset = () => { setCw(Object.fromEntries(names.map((n) => [n, Math.round((DEFAULT_CONFIG.componentWeights[n] ?? 0.05) * 100)]))); setIw({ tasks: 50, tests: 30, hygiene: 20 }); };
  const discard = () => { setCw(Object.fromEntries(names.map((n) => [n, Math.round((s.config.componentWeights[n] ?? 0.05) * 100)]))); setIw({ tasks: Math.round(s.config.readinessWeights.tasks * 100), tests: Math.round(s.config.readinessWeights.tests * 100), hygiene: Math.round(s.config.readinessWeights.hygiene * 100) }); };
  const share = (n: string) => Math.round(((cw[n] ?? 0) / totalCw) * 100);
  const ITEM = [['tasks', 'Tasks completed', '#1a1a1a'], ['tests', 'Tests passed', '#fd5108'], ['hygiene', 'Data hygiene', '#2764a8']] as const;
  const after = preview ?? m;
  return <section className="card weight-studio">
    <div className="card-header"><div><h2>Tune the weightages</h2><p>Drag a slider to change what counts most. The score previews live — nothing changes until you apply.</p></div>
      <div className="ws-score"><div><span>Now</span><strong>{m.score}</strong></div><Icon name="arrow" size={14} /><div className={preview ? 'changed' : ''}><span>Preview</span><strong>{after.score}</strong></div><Badge tone={signalTone(after.signal)}>{after.signal}</Badge></div></div>
    <div className="ws-tabs"><button className={mode === 'components' ? 'active' : ''} onClick={() => setMode('components')}>Component weights<small>How much each area can stop the business</small></button><button className={mode === 'items' ? 'active' : ''} onClick={() => setMode('items')}>Item formula<small>What makes one item “ready”</small></button></div>
    {mode === 'components' ? <div className="card-body ws-body">
      <div className="mix-bar" aria-label="Weight mix">{names.map((n, i) => share(n) > 0 && <span key={n} title={`${n} ${share(n)}%`} style={{ width: `${share(n)}%`, background: MIX[i % MIX.length] }}>{share(n) >= 9 ? `${share(n)}%` : ''}</span>)}</div>
      <div className="ws-rows">{names.map((n, i) => { const c = m.components[i]; return <div className="ws-row" key={n}>
        <button className="ws-name" onClick={() => onPick?.(n)} title="Show this component's evidence"><i style={{ background: MIX[i % MIX.length] }} /><span>{n}<small>score {c.score}% · {c.items.length} item{c.items.length > 1 ? 's' : ''}</small></span></button>
        <input type="range" min={0} max={50} step={1} value={cw[n] ?? 0} disabled={readOnly} onChange={(e) => setCw({ ...cw, [n]: +e.target.value })} style={{ '--c': MIX[i % MIX.length], '--p': `${((cw[n] ?? 0) / 50) * 100}%` } as CSSProperties} />
        <strong className="num">{share(n)}%</strong>
        <span className="num muted small" title="Points this component adds to the overall score">+{((c.score * share(n)) / 100).toFixed(1)}</span></div>; })}</div>
      <p className="muted small" style={{ margin: 0 }}>Bar = each area’s share of the score (weights are normalised to 100%). “+pts” = component score × share. Components with no {s.deal.milestoneLabel}-critical items don’t appear.</p>
    </div> : <div className="card-body ws-body">
      <div className="mix-bar">{ITEM.map(([k, label, col]) => <span key={k} style={{ width: `${(iw[k] / totalIw) * 100}%`, background: col }}>{iw[k] / totalIw >= 0.1 ? `${label.split(' ')[0]} ${Math.round((iw[k] / totalIw) * 100)}%` : ''}</span>)}</div>
      <div className="ws-rows">{ITEM.map(([k, label, col]) => <div className="ws-row" key={k}>
        <span className="ws-name static"><i style={{ background: col }} /><span>{label}<small>{k === 'tasks' ? '% of the item’s tracker tasks marked Done' : k === 'tests' ? '% of its ' + s.deal.milestoneLabel + ' tests passed' : 'hygiene score of its source data file'}</small></span></span>
        <input type="range" min={0} max={100} step={5} value={iw[k]} disabled={readOnly} onChange={(e) => setIw({ ...iw, [k]: +e.target.value })} style={{ '--c': col, '--p': `${iw[k]}%` } as CSSProperties} />
        <strong className="num">{Math.round((iw[k] / totalIw) * 100)}%</strong><span /></div>)}</div>
      <div className="ws-example">Example — <b>{m.items[0]?.app.name}</b>: {Math.round((iw.tasks / totalIw) * 100)}% × tasks + {Math.round((iw.tests / totalIw) * 100)}% × tests + {Math.round((iw.hygiene / totalIw) * 100)}% × hygiene = <b>{(after.items.find((x) => x.app.id === m.items[0]?.app.id)?.readiness ?? 0)}%</b> (now {m.items[0]?.readiness}%).</div>
      <p className="muted small" style={{ margin: 0 }}>Default 50 / 30 / 20 (PwC readiness framework). Signal thresholds and the blocker cap live in Governance → Scoring configuration.</p>
    </div>}
    <div className="ws-foot">{preview ? <span className="small">Preview: <b>{m.score} → {preview.score}</b> ({preview.score - m.score >= 0 ? '+' : ''}{preview.score - m.score}) · underlying {m.underlying} → <b>{preview.underlying}</b>{preview.capped ? ` · final score held at ${s.config.blockerCap} by the critical blocker` : ''}</span> : <span className="small muted">Current weightages are applied.</span>}
      <span className="row"><Button variant="ghost" onClick={reset}>Defaults</Button>{changed && <Button variant="secondary" onClick={discard}>Discard</Button>}<Button disabled={!changed || readOnly} onClick={apply}>Apply weightages</Button></span></div>
  </section>;
}
