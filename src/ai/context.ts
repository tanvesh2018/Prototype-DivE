/** Builds the compact "live dashboard" context the Copilot and briefs are grounded on. */
import type { Model } from '../engine/model';
import { simulateReadiness } from '../engine/model';
import type { WorkspaceState } from '../engine/types';
import { fmtDate, money } from '../engine/util';
import { DATASET } from '../engine/glossary';

export function readinessProjections(s: WorkspaceState, m: Model) {
  const out: { label: string; score: number; signal: string }[] = [];
  const blockedIds = m.criticalBlocked.map((i) => i.app.id);
  if (blockedIds.length) {
    const a = simulateReadiness(s, { unblock: blockedIds });
    out.push({ label: `Unblock ${m.criticalBlocked.map((i) => i.app.name).join(', ')}`, score: a.score, signal: a.signal });
    const b = simulateReadiness(s, { completeTasksFor: blockedIds, passTestsFor: blockedIds });
    out.push({ label: `…and finish ${m.criticalBlocked.map((i) => i.app.name).join(', ')}'s remaining tasks and tests`, score: b.score, signal: b.signal });
  }
  const weak = [...m.items].sort((a, b) => a.readiness - b.readiness).slice(0, 4).map((i) => i.app.id);
  const c = simulateReadiness(s, { completeTasksFor: weak, passTestsFor: weak, unblock: blockedIds });
  out.push({ label: `Close all open tasks and tests on the ${weak.length} weakest items`, score: c.score, signal: c.signal });
  return out;
}

export function buildLiveContext(s: WorkspaceState, m: Model) {
  const blockers = m.items.filter((i) => i.blocked).flatMap((i) => i.blockers.map((b) => ({ item: i.app.name, task: b.title, owner: b.owner, due: fmtDate(b.due_date), critical: i.critical })));
  const below = m.datasetsHygiene.filter((d) => d.score < s.config.hygieneGate).map((d) => `${DATASET[d.key as keyof typeof DATASET]?.label ?? d.key} ${d.score}`).join(', ');
  const pending = m.decisions.filter((d) => d.state.status !== 'approved').map((d) => `${d.title} (${d.approver}, due ${fmtDate(d.due)})`).join('; ');
  return {
    deal: `${s.deal.name} (${s.deal.buyer} buying from ${s.deal.seller}, ${s.deal.dealType})`, asOf: fmtDate(s.deal.asOf, true), day1: fmtDate(s.deal.day1, true), daysToDay1: m.daysToDay1,
    score: m.score, underlying: m.underlying, signal: m.signal, capped: m.capped,
    components: m.components.map((c) => ({ name: c.name, score: c.score, weight: c.weight })),
    blockers,
    weakest: [...m.items].sort((a, b) => a.readiness - b.readiness).slice(0, 5).map((i) => ({ name: i.app.name, readiness: i.readiness, open: i.tasksTotal - i.tasksDone, failed: i.testsTotal - i.testsPassed })),
    projections: readinessProjections(s, m),
    tasks: { total: m.totalTasks, done: m.doneTasks, byWorkstream: m.wsProgress.map((w) => `${w.name} ${w.pct}%`).join(', ') },
    warnings: m.warnings.length,
    costs: { total: money(m.sepTotal), seller: money(m.sellerTotal), buyer: money(m.buyerTotal), disputed: money(m.disputedAmount), provisional: m.sepLines.some((l) => l.provisional) },
    tsa: { monthly: money(m.tsaMonthly), services: m.tsa.length, atRisk: m.tsa.filter((t) => t.risk).length, atRiskNames: m.tsa.filter((t) => t.risk).map((t) => `${t.row.service} (${money(t.fee)}/mo)`).join(', ') },
    hygiene: { avg: m.avgHygiene, below, open: s.issues.filter((i) => i.status === 'open').length, erp: m.erpHyg },
    blockedRevenue: money(m.blockedRevenue) + ' per quarter',
    topBlockedProduct: m.products[0] ? `${m.products[0].row.product} in ${m.products[0].row.country} (${money(m.products[0].revenue)}/qtr)` : null,
    benchmark: { week1: m.bench.week1, late: m.bench.late },
    pendingDecisions: pending, ownerOverdue: m.overdueOwner.length,
    buckets: Object.entries(m.apps.reduce((a: Record<string, number>, x) => ((a[x.bucket] = (a[x.bucket] ?? 0) + 1), a), {})).map(([k, v]) => `${k}: ${v}`).join(', '),
  };
}

export function pastDealsText(m: Model, n = 4) {
  return m.matches.slice(0, n).map((x) => `${x.record.id} (${x.score}% match): ${x.record.industry} ${x.record.dealType}, ${x.record.appsBand}, Day-1 ${x.record.day1OnTime ? 'on time' : 'late'}, TSA ${x.record.tsaExtended ? 'extended' : 'not extended'}. Lesson: ${x.record.keyLesson}`).join('\n');
}
