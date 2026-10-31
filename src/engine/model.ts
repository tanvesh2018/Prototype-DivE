/**
 * Derived deal model — every score in the UI is computed here from the
 * workspace state, so each number can be traced to its formula and inputs
 * (BRD NFR: Explainability). Pure functions, no side effects.
 */
import { COMPONENT_KEYWORDS, WORKSTREAMS, type Bucket, type Component } from './glossary';
import { hygieneScore } from './quality';
import type { LinkType, Ownership, WorkspaceState } from './types';
import { addDays, clamp, daysBetween, parseNumber, round, yes, type Row } from './util';

export interface App {
  id: string; rid: string; name: string; description: string; serverId: string; networkId: string; licenceIds: string[];
  ownerTeam: string; vendor: string; users: number; site: string; annualCost: number; lastUpdated: string;
  buyerUses: boolean; transferable: string; goLive: number; criticalTool: boolean; revenueLinked: boolean;
  C: number; R: number; S: number; buyerHasSimilar: boolean;
}

export interface GraphNode { id: string; label: string; type: 'Application' | 'Server' | 'Network' | 'Licence' | 'Seller service'; owner: Ownership; site?: string; sub?: string }
export interface GraphLink { id: string; from: string; to: string; type: LinkType; ownership: Ownership; source: string; status: 'confirmed' | 'suggested' | 'unclear' | 'rejected'; reason?: string; manualId?: string }

export interface ClassifiedApp extends App {
  component: Component; componentSource: 'rule' | 'confirmed';
  entanglement: number; entBand: 'Low' | 'Medium' | 'High'; D: number; PI: number;
  timing: 'Day-1 critical' | 'Day-1 + 30' | 'Post-TSA'; flagged: boolean; day1Critical: boolean;
  bucket: Bucket; ruleBucket: Bucket; bucketReason: string; overridden: boolean;
  moveGroup: string; links: GraphLink[]; unclear: boolean;
}

export interface ReadinessItem {
  app: ClassifiedApp; tasksTotal: number; tasksDone: number; testsTotal: number; testsPassed: number; hygiene: number;
  readiness: number; blocked: boolean; blockers: Row[]; critical: boolean;
}

const OWN_SCORE: Record<Ownership, number> = { buyer: 1, shared: 2, seller: 3 };
export const normOwner = (v: any): Ownership => {
  const s = String(v ?? '').toLowerCase();
  if (s.startsWith('buy')) return 'buyer';
  if (s.startsWith('sel')) return 'seller';
  return 'shared';
};

const hit = (text: string, w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
/** Rule-based component tag: name first (strongest clue), then the description. */
export function tagComponent(name: string, description: string): Component {
  for (const text of [name, description]) {
    for (const [c, words] of COMPONENT_KEYWORDS) if (words.some((w) => hit(text, w))) return c;
  }
  return 'Applications';
}

export function entToD(e: number) { return e <= 2 ? 1 : e <= 5 ? 2 : e <= 8 ? 3 : e <= 12 ? 4 : 5; }
export const entBand = (e: number) => (e <= 3 ? 'Low' : e <= 8 ? 'Medium' : 'High') as 'Low' | 'Medium' | 'High';

export function getApps(s: WorkspaceState): App[] {
  const rows = s.datasets.applications?.rows ?? [];
  const lic = s.datasets.licences?.rows ?? [];
  return rows.filter((r) => !r._retired).map((r) => {
    const ids = new Set<string>();
    if (r.licence_id) ids.add(r.licence_id);
    lic.forEach((l) => { if (l.app_id === r.app_id && !l._retired) ids.add(l.licence_id); });
    return {
      id: r.app_id, rid: r._rid, name: r.app_name || r.app_id, description: r.description ?? '', serverId: r.hosting_server_id ?? '', networkId: r.network_id ?? '',
      licenceIds: [...ids], ownerTeam: r.owner_team ?? '', vendor: r.vendor ?? '', users: parseNumber(r.user_count) ?? 0, site: r.site ?? '',
      annualCost: parseNumber(r.annual_cost) ?? 0, lastUpdated: r.last_updated ?? '', buyerUses: r.buyer_uses === undefined || r.buyer_uses === '' ? true : yes(r.buyer_uses),
      transferable: r.licence_transferable ?? 'Unknown', goLive: parseNumber(r.go_live_year) ?? 2018, criticalTool: yes(r.critical_tool), revenueLinked: yes(r.revenue_linked),
      C: parseNumber(r.criticality) ?? 3, R: parseNumber(r.regulatory_risk) ?? 2, S: parseNumber(r.security_risk) ?? 2, buyerHasSimilar: yes(r.buyer_has_similar),
    };
  });
}

export function buildGraph(s: WorkspaceState, apps: App[]) {
  const nodes = new Map<string, GraphNode>();
  const servers = new Map((s.datasets.servers?.rows ?? []).filter((r) => !r._retired).map((r) => [r.server_id, r]));
  const licences = new Map((s.datasets.licences?.rows ?? []).filter((r) => !r._retired).map((r) => [r.licence_id, r]));
  const segOwner = new Map<string, Map<Ownership, number>>();
  const segName = new Map<string, string>();
  const segSite = new Map<string, string>();
  (s.datasets.network?.rows ?? []).forEach((r) => {
    if (!r.network_id) return;
    const m = segOwner.get(r.network_id) ?? new Map();
    if (r.ownership) m.set(normOwner(r.ownership), (m.get(normOwner(r.ownership)) ?? 0) + 1);
    segOwner.set(r.network_id, m);
    if (r.segment_name) segName.set(r.network_id, r.segment_name);
    if (r.site) segSite.set(r.network_id, r.site);
  });
  const segOwn = (id: string): Ownership => {
    const m = segOwner.get(id);
    if (!m || !m.size) return 'shared';
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const appById = new Map(apps.map((a) => [a.id, a]));
  const appOwner = (id: string): Ownership => {
    const a = appById.get(id);
    const srv = a && servers.get(a.serverId);
    return srv ? normOwner(srv.ownership) : 'shared';
  };
  apps.forEach((a) => nodes.set(a.id, { id: a.id, label: a.name, type: 'Application', owner: appOwner(a.id), site: a.site, sub: a.ownerTeam || 'Owner unknown' }));
  const links: GraphLink[] = [];
  const add = (l: GraphLink) => links.push(l);
  for (const a of apps) {
    const srv = servers.get(a.serverId);
    if (srv) {
      nodes.set(srv.server_id, { id: srv.server_id, label: srv.server_id, type: 'Server', owner: normOwner(srv.ownership), site: srv.site, sub: srv.server_name });
      add({ id: `${a.id}>${srv.server_id}`, from: a.id, to: srv.server_id, type: 'runs_on', ownership: normOwner(srv.ownership), source: 'data', status: 'confirmed' });
    }
    if (a.networkId && (segOwner.has(a.networkId) || !s.datasets.network)) {
      nodes.set(a.networkId, { id: a.networkId, label: a.networkId, type: 'Network', owner: segOwn(a.networkId), site: segSite.get(a.networkId), sub: segName.get(a.networkId) ?? 'Network segment' });
      add({ id: `${a.id}>${a.networkId}`, from: a.id, to: a.networkId, type: 'connects_via', ownership: segOwn(a.networkId), source: 'data', status: 'confirmed' });
    }
    for (const lid of a.licenceIds) {
      const l = licences.get(lid);
      if (!l) continue;
      nodes.set(lid, { id: lid, label: `Licence ${lid}`, type: 'Licence', owner: normOwner(l.ownership), sub: `${l.vendor} · ${l.transferable || 'transfer unknown'}` });
      add({ id: `${a.id}>${lid}`, from: a.id, to: lid, type: 'requires_licence', ownership: normOwner(l.ownership), source: 'data', status: 'confirmed', reason: `${l.product} (${l.vendor})` });
    }
  }
  for (const m of s.links) {
    if (!appById.has(m.from)) continue;
    let ownership: Ownership = 'shared';
    if (m.to === 'SELLER-SVC') {
      nodes.set('SELLER-SVC', { id: 'SELLER-SVC', label: 'Seller service (unconfirmed)', type: 'Seller service', owner: 'seller', sub: 'Treated as seller-owned until trial run' });
      ownership = 'seller';
    } else if (m.type === 'uses_seller_service') ownership = 'seller';
    else ownership = appOwner(m.to);
    if (!nodes.has(m.to) && m.to !== 'SELLER-SVC') continue;
    add({ id: m.id, from: m.from, to: m.to, type: m.type, ownership: m.status === 'unclear' ? 'seller' : ownership, source: m.source, status: m.status === 'unclear' ? 'unclear' : m.status, reason: m.reason, manualId: m.id });
  }
  return { nodes, links };
}

export function bucketFor(a: App & { day1Critical: boolean; entanglement: number; unclear: boolean; hasSellerOrShared: boolean }, daysToDay1: number): { bucket: Bucket; reason: string } {
  const t = a.transferable.toLowerCase();
  const canCopy = t.startsWith('yes') || t.includes('consent');
  const facts = `${a.day1Critical ? 'Day-1 critical' : 'not Day-1 critical'}, entanglement ${a.entanglement}, licence "${a.transferable || 'unknown'}", ${daysToDay1} days to Day-1`;
  if (!a.buyerUses) return { bucket: 'Extract and Sunset', reason: `Extract and Sunset: the buyer does not use ${a.name} (${a.users} users) — archive data and retire.` };
  if (a.buyerHasSimilar && !a.day1Critical) return { bucket: 'Consolidate', reason: `Consolidate: ChipCo already runs a similar system; migrate ${a.name}'s data and save run cost (${facts}).` };
  if (!a.hasSellerOrShared) return { bucket: 'Transfer as-is', reason: `Transfer as-is: ${a.name} shares nothing with the seller (all links buyer-owned).` };
  if (a.unclear) return { bucket: 'Commercial agreement / TSA', reason: `TSA: an unclear link is treated as seller-owned, so ${a.name} stays under the TSA until a trial run confirms it.` };
  if (a.day1Critical && canCopy) return { bucket: 'Clone and Go', reason: `Clone and Go: ${a.name} is needed on Day-1, shares assets with the seller and the licence can be copied (${facts}).` };
  if (a.day1Critical) return { bucket: 'Commercial agreement / TSA', reason: `TSA: ${a.name} is Day-1 critical but cannot be legally copied or separated in time (${facts}).` };
  if (a.goLive <= 2012 || t === 'no') return { bucket: 'Stand-up new', reason: `Stand-up new: ${a.name} is ${a.goLive <= 2012 ? `old (go-live ${a.goLive})` : 'not transferable'} and not needed on Day-1.` };
  return { bucket: 'Clone and Go', reason: `Clone and Go: shared with the seller and copyable; not needed on Day-1 so it can follow in a later wave (${facts}).` };
}

class UF {
  p = new Map<string, string>();
  find(x: string): string { if (!this.p.has(x)) this.p.set(x, x); const y = this.p.get(x)!; if (y === x) return x; const r = this.find(y); this.p.set(x, r); return r; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

export interface MoveGroup { id: string; apps: ClassifiedApp[]; wave: number; ruleWave: number; waveReason: string; hygiene: number; hygieneSource: string }

export const WAVES = [
  { n: 0, name: 'Day-1 critical', desc: 'Groups that must work on Day-1' },
  { n: 1, name: 'Security', desc: 'Logins, identity, endpoints' },
  { n: 2, name: 'Most tangled', desc: 'Seller-entangled systems held under TSA' },
  { n: 3, name: 'Revenue systems', desc: 'Customer and order systems' },
  { n: 4, name: 'Consolidate & save cost', desc: 'Consolidate and sunset' },
];

export const ROADMAP_12 = ['Confirm scope & owners', 'Freeze data & changes', 'Data hygiene ≥ 90', 'Build target environment', 'Copy / migrate data', 'Re-point integrations', 'Security & access set-up', 'Functional testing', 'User acceptance', 'Cut-over rehearsal', 'Go-live & hypercare', 'Decommission at seller'];

export function buildModel(s: WorkspaceState) {
  const cfg = s.config;
  const asOf = s.deal.asOf;
  const daysToDay1 = daysBetween(asOf, s.deal.day1);
  const apps = getApps(s);
  const { nodes, links } = buildGraph(s, apps);
  const activeLinks = links.filter((l) => l.status === 'confirmed' || l.status === 'unclear');

  // --- classification ---
  const classified: ClassifiedApp[] = apps.map((a) => {
    const own = activeLinks.filter((l) => l.from === a.id);
    const entanglement = own.reduce((sum, l) => sum + OWN_SCORE[l.ownership], 0);
    const o = s.appOverrides[a.id] ?? {};
    const C = o.C ?? a.C, R = o.R ?? a.R, S = o.S ?? a.S;
    const D = entToD(entanglement);
    const w = cfg.priorityWeights;
    const PI = round(w.C * C + w.D * D + w.R * R + w.S * S, 2);
    const flagged = a.criticalTool || a.revenueLinked;
    const timing = PI >= cfg.day1Threshold || flagged ? 'Day-1 critical' : PI >= cfg.day1Threshold - 0.75 ? 'Day-1 + 30' : 'Post-TSA';
    const day1Critical = timing === 'Day-1 critical';
    const unclear = own.some((l) => l.status === 'unclear');
    const hasSellerOrShared = own.some((l) => l.ownership !== 'buyer');
    const component = o.component ?? tagComponent(a.name, a.description);
    const { bucket: ruleBucket, reason } = bucketFor({ ...a, day1Critical, entanglement, unclear, hasSellerOrShared }, daysToDay1);
    return {
      ...a, C, R, S, D, PI, entanglement, entBand: entBand(entanglement), timing, flagged, day1Critical, component,
      componentSource: o.componentConfirmed ? 'confirmed' : 'rule', ruleBucket, bucket: o.bucket ?? ruleBucket,
      bucketReason: o.bucket && o.bucket !== ruleBucket ? (o.bucketReason ?? `Overridden by consultant (rule suggested ${ruleBucket}).`) : (o.bucketReason ?? reason),
      overridden: !!o.bucket && o.bucket !== ruleBucket, moveGroup: '', links: own, unclear,
    };
  });
  const byId = new Map(classified.map((a) => [a.id, a]));

  // --- move groups ---
  const uf = new UF();
  classified.forEach((a) => uf.find(a.id));
  const byServer = new Map<string, string>();
  classified.forEach((a) => { if (!a.serverId) return; const o = byServer.get(a.serverId); if (o) uf.union(a.id, o); else byServer.set(a.serverId, a.id); });
  activeLinks.filter((l) => l.type === 'data_flow' && byId.has(l.from) && byId.has(l.to)).forEach((l) => uf.union(l.from, l.to));
  const groupsMap = new Map<string, ClassifiedApp[]>();
  classified.forEach((a) => { const r = uf.find(a.id); groupsMap.set(r, [...(groupsMap.get(r) ?? []), a]); });
  const hyg = (k: Parameters<typeof hygieneScore>[1]) => hygieneScore(s, k);
  const appsHyg = hyg('applications') ?? 0;
  const erpHyg = hyg('erp');
  const groupList = [...groupsMap.values()].sort((a, b) => Math.max(...b.map((x) => x.PI)) - Math.max(...a.map((x) => x.PI)) || b.length - a.length);
  const moveGroups: MoveGroup[] = groupList.map((g, i) => {
    const id = `MG-${String(i + 1).padStart(2, '0')}`;
    g.forEach((a) => (a.moveGroup = id));
    const has = (fn: (a: ClassifiedApp) => boolean) => g.some(fn);
    let ruleWave = 0, waveReason = 'Contains Day-1 critical systems';
    if (g.every((a) => a.bucket === 'Consolidate' || a.bucket === 'Extract and Sunset' || a.bucket === 'Stand-up new') || (!has((a) => a.day1Critical) && has((a) => a.bucket === 'Consolidate'))) { ruleWave = 4; waveReason = 'Consolidate / sunset — saves run cost'; }
    else if (has((a) => a.component === 'Identity & security' || a.component === 'Laptops & email')) { ruleWave = 1; waveReason = 'Logins, endpoints and email move first after Day-1'; }
    else if (has((a) => a.criticalTool)) { ruleWave = 0; waveReason = 'Contains a critical tool — must work on Day-1'; }
    else if (has((a) => a.bucket === 'Commercial agreement / TSA' && a.entanglement >= 9)) { ruleWave = 2; waveReason = 'Most tangled with the seller — currently on TSA'; }
    else if (has((a) => a.component === 'Revenue systems') && !has((a) => a.criticalTool)) { ruleWave = 3; waveReason = 'Revenue systems'; }
    else if (!has((a) => a.day1Critical)) { ruleWave = 3; waveReason = 'Not Day-1 critical — later wave'; }
    const usesErp = has((a) => a.id === 'APP-004');
    const hygiene = usesErp && erpHyg !== null ? Math.min(appsHyg, erpHyg) : appsHyg;
    return { id, apps: g, ruleWave, wave: s.waveOverrides[id] ?? ruleWave, waveReason, hygiene, hygieneSource: usesErp ? 'Finance ERP master data' : 'Applications file' };
  });

  // --- tasks ---
  const tasks = (s.datasets.tasks?.rows ?? []) as Row[];
  const isDone = (t: Row) => /^done|complete/i.test(t.status ?? '');
  const wsProgress = WORKSTREAMS.map((w) => {
    const list = tasks.filter((t) => t.workstream === w);
    const done = list.filter(isDone).length;
    return { name: w, total: list.length, done, pct: list.length ? Math.round((100 * done) / list.length) : 0 };
  });
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(isDone).length;
  const in5 = addDays(asOf, 5);
  const warnings = tasks.filter((t) => !isDone(t) && (t.status === 'Blocked' || t.status === 'At risk' || (t.status === 'Not started' && t.due_date && t.due_date <= in5) || (t.due_date && t.due_date < asOf)))
    .map((t) => ({ task: t, reason: t.status === 'Blocked' ? 'Blocked' : t.status === 'At risk' ? 'Flagged at risk' : t.due_date < asOf ? 'Overdue' : `Not started, due in ${daysBetween(asOf, t.due_date)} days` }));

  // --- tests & readiness ---
  const tests = (s.datasets.tests?.rows ?? []) as Row[];
  const rw = cfg.readinessWeights;
  const items: ReadinessItem[] = classified.filter((a) => a.day1Critical).map((a) => {
    const t = tasks.filter((x) => x.linked_item === a.id);
    const te = tests.filter((x) => x.app_id === a.id);
    const tasksDone = t.filter(isDone).length;
    const testsPassed = te.filter((x) => /pass/i.test(x.result ?? '')).length;
    const hygiene = a.id === 'APP-004' && erpHyg !== null ? erpHyg : appsHyg;
    const taskPct = t.length ? (100 * tasksDone) / t.length : 0;
    const testPct = te.length ? (100 * testsPassed) / te.length : 0;
    const readiness = round(rw.tasks * taskPct + rw.tests * testPct + rw.hygiene * hygiene, 1);
    const blockers = t.filter((x) => x.status === 'Blocked');
    return { app: a, tasksTotal: t.length, tasksDone, testsTotal: te.length, testsPassed, hygiene, readiness, blocked: blockers.length > 0, blockers, critical: a.flagged };
  });
  const compNames = [...new Set(items.map((i) => i.app.component))];
  const components = compNames.map((c) => {
    const its = items.filter((i) => i.app.component === c);
    const score = round(its.reduce((x, i) => x + i.readiness, 0) / its.length, 1);
    return { name: c, score, items: its, weight: cfg.componentWeights[c] ?? 0.05, blocked: its.some((i) => i.blocked) };
  }).sort((a, b) => b.weight - a.weight);
  const wsum = components.reduce((x, c) => x + c.weight, 0) || 1;
  const underlying = round(components.reduce((x, c) => x + c.score * c.weight, 0) / wsum, 0);
  const criticalBlocked = items.filter((i) => i.blocked && i.critical);
  const capped = criticalBlocked.length > 0 && underlying > cfg.blockerCap;
  const score = capped ? cfg.blockerCap : underlying;
  const signal = score >= cfg.goThreshold ? 'GO' : score >= cfg.conditionsThreshold ? 'GO WITH CONDITIONS' : 'NO-GO';
  const testsPassed = tests.filter((x) => /pass/i.test(x.result ?? '')).length;

  // --- costs ---
  const cw = cfg.costSplitWeights;
  const causeScore = (v: string) => (/^sell/i.test(v) ? 1 : /^shar/i.test(v) ? 0.5 : /^buy/i.test(v) ? 0 : null);
  const lflScore = (v: string) => (/^like/i.test(v) ? 1 : /^part/i.test(v) ? 0.5 : /^upg/i.test(v) ? 0 : null);
  const costRows = (s.datasets.costs?.rows ?? []) as Row[];
  const sepLines = costRows.filter((r) => /separation/i.test(r.cost_type ?? '')).map((r) => {
    const c1 = causeScore(r.cause ?? ''), c2 = lflScore(r.like_for_like ?? ''), c3 = causeScore(r.contract ?? '');
    const provisional = c3 === null;
    const share = round(cw.cause * (c1 ?? 0.5) + cw.likeForLike * (c2 ?? 0.5) + cw.contract * (c3 ?? 0.5), 3);
    const amount = parseNumber(r.amount) ?? 0;
    return { row: r, amount, share, seller: Math.round(amount * share), buyer: Math.round(amount * (1 - share)), provisional, disputed: /disput/i.test(r.status ?? '') };
  });
  const sepTotal = sepLines.reduce((x, l) => x + l.amount, 0);
  const sellerTotal = sepLines.reduce((x, l) => x + l.seller, 0);
  const disputed = sepLines.filter((l) => l.disputed);
  const disputedAmount = disputed.reduce((x, l) => x + l.amount, 0);
  const disputedSeller = disputed.reduce((x, l) => x + l.seller, 0);
  const runCost = costRows.filter((r) => /run/i.test(r.cost_type ?? '')).reduce((x, r) => x + (parseNumber(r.amount) ?? 0), 0);

  // --- TSA ---
  const tsa = ((s.datasets.tsa?.rows ?? []) as Row[]).map((r) => {
    const fee = parseNumber(r.monthly_fee) ?? 0;
    const total = parseNumber(r.milestones_total) ?? 0, done = parseNumber(r.milestones_done) ?? 0;
    const prep = r.prep_start || addDays(asOf, -30);
    const span = Math.max(1, daysBetween(prep, r.target_exit));
    const elapsed = clamp(daysBetween(prep, asOf), 0, span);
    const expected = Math.round((100 * elapsed) / span);
    const actual = total ? Math.round((100 * done) / total) : 0;
    const projectedDays = actual > 0 ? Math.round(elapsed / (actual / 100)) : span * 3;
    const projectedExit = addDays(prep, Math.max(projectedDays, elapsed));
    const lateDays = daysBetween(r.target_exit, projectedExit);
    const linked = byId.get(r.linked_system);
    const dataGate = r.linked_system === 'APP-004' && erpHyg !== null && erpHyg < cfg.hygieneGate;
    const risk = lateDays > 7;
    const extraMonths = risk ? Math.ceil(lateDays / 30) : 0;
    const status = risk ? 'Extension risk' : dataGate ? 'Data gate' : actual >= expected ? 'On plan' : 'Watch';
    return { row: r, fee, total, done, expected, actual, projectedExit, lateDays, risk, extraMonths, extensionCost: extraMonths * fee * 1.25, status, linked };
  });
  const tsaMonthly = tsa.reduce((x, t) => x + t.fee, 0);
  const burndown = (() => {
    if (!tsa.length) return [];
    const start = s.deal.day1;
    const pts: { date: string; plan: number; projected: number }[] = [];
    for (let i = 0; i <= 10; i++) {
      const d = addDays(start, i * 14);
      pts.push({ date: d, plan: tsa.filter((t) => t.row.target_exit > d).length, projected: tsa.filter((t) => t.projectedExit > d).length });
    }
    return pts;
  })();

  // --- products ---
  const itemById = new Map(items.map((i) => [i.app.id, i]));
  const products = ((s.datasets.products?.rows ?? []) as Row[]).map((r) => {
    const sys = byId.get(r.blocked_by);
    const it = itemById.get(r.blocked_by);
    return { row: r, revenue: parseNumber(r.quarterly_revenue) ?? 0, system: sys, systemReadiness: it?.readiness ?? null, blocked: /block/i.test(r.status ?? '') };
  }).sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.revenue - a.revenue);
  const blockedRevenue = products.filter((p) => p.blocked).reduce((x, p) => x + p.revenue, 0);

  // --- decisions ---
  const ow = cfg.optionWeights;
  const decMap = new Map<string, Row[]>();
  ((s.datasets.decisions?.rows ?? []) as Row[]).forEach((r) => decMap.set(r.decision_id, [...(decMap.get(r.decision_id) ?? []), r]));
  const decisions = [...decMap.entries()].map(([id, rows]) => {
    const options = rows.map((r) => {
      const sec = parseNumber(r.security) ?? 0, pro = parseNumber(r.productivity) ?? 0, cost = parseNumber(r.cost) ?? 0, sp = parseNumber(r.speed) ?? 0;
      const removed = sec < cfg.securityFloor;
      return { row: r, code: r.option, name: r.option_name, security: sec, productivity: pro, cost, speed: sp, removed, total: removed ? null : round(ow.security * sec + ow.productivity * pro + ow.cost * cost + ow.speed * sp, 2) };
    });
    const ranked = options.filter((o) => !o.removed).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    return { id, title: rows[0].decision, approver: rows[0].approver, due: rows[0].due, options, recommended: ranked[0], runnerUp: ranked[1], state: s.decisions[id] ?? { status: 'pending' as const } };
  }).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  // --- funding ---
  const fin = ((s.datasets.financials?.rows ?? []) as Row[]).map((r) => {
    const cash = parseNumber(r.cash) ?? 0, de = parseNumber(r.debt_equity) ?? 0, ic = parseNumber(r.interest_coverage) ?? 0, cr = parseNumber(r.current_ratio) ?? 0;
    const tight = cr < 1 || de > 1.5 || ic < 3;
    return { row: r, cash, de, ic, cr, tight, verdict: tight ? 'Cash tight — needs financing' : 'Can absorb the cost' };
  });

  // --- hygiene & data ---
  const datasetsHygiene = Object.keys(s.datasets).map((k) => ({ key: k, score: hygieneScore(s, k as any) })).filter((x) => x.score !== null) as { key: string; score: number }[];
  const avgHygiene = datasetsHygiene.length ? round(datasetsHygiene.reduce((x, d) => x + d.score, 0) / datasetsHygiene.length, 1) : 0;

  // --- learning & insights ---
  const learning = (s.datasets.learning?.rows ?? []) as Row[];
  const bench = (() => {
    const w1 = learning.filter((r) => r.licenceConsentWeek1 === true || r.licenceConsentWeek1 === 'true');
    const late = learning.filter((r) => !(r.licenceConsentWeek1 === true || r.licenceConsentWeek1 === 'true'));
    const rate = (arr: Row[]) => (arr.length ? Math.round((100 * arr.filter((r) => r.day1OnTime === true || r.day1OnTime === 'true').length) / arr.length) : 0);
    const industries = [...new Set(learning.map((r) => r.industry))].map((ind) => {
      const l = learning.filter((r) => r.industry === ind);
      return { industry: ind, deals: l.length, onTime: rate(l), tsaExtended: Math.round((100 * l.filter((r) => r.tsaExtended === true).length) / l.length) };
    });
    return { total: learning.length, week1: rate(w1), late: rate(late), week1N: w1.length, lateN: late.length, onTime: rate(learning), industries };
  })();
  const matches = learning.map((r) => {
    let score = 0;
    if (String(r.industry).toLowerCase() === s.deal.industry.toLowerCase()) score += 50;
    else if (['Electronics', 'Semiconductor'].includes(r.industry) && ['Electronics', 'Semiconductor'].includes(s.deal.industry)) score += 30;
    if (String(r.dealType).toLowerCase() === s.deal.dealType.toLowerCase()) score += 30;
    const n = apps.length;
    const band = n < 50 ? '20-50 apps' : n < 100 ? '50-100 apps' : n < 200 ? '100-200 apps' : '200+ apps';
    if (r.appsBand === band) score += 15;
    if (r.licenceConsentWeek1 !== undefined) score += 5;
    return { record: r, score: Math.min(99, score) };
  }).sort((a, b) => b.score - a.score);
  const prospects = ((s.datasets.prospects?.rows ?? []) as Row[]).map((r) => {
    const segs = parseNumber(r.segments) ?? 0, de = parseNumber(r.debt_equity) ?? 0, pledge = parseNumber(r.pledge_pct) ?? 0;
    const parts: string[] = [];
    let sc = 0;
    if (segs >= 5) { sc += 3; parts.push(`${segs} segments`); } else if (segs >= 3) { sc += 1; parts.push(`${segs} segments`); }
    if (r.loss_segment) { sc += 3; parts.push(`loss-making ${String(r.loss_segment).toLowerCase()}`); }
    if (de > 1.5) { sc += 2; parts.push(`high debt (D/E ${de})`); }
    if (/declin/i.test(r.margin_trend ?? '')) { sc += 1; parts.push('declining margins'); }
    if (yes(r.strategic_review)) { sc += 1; parts.push('strategic review announced'); }
    if (pledge > 30) parts.push(`promoter pledge ${pledge}%`);
    return { row: r, score: Math.min(10, sc), drivers: parts };
  }).sort((a, b) => b.score - a.score);

  // --- data quality / ownership ---
  const openOwner = s.ownerQueue.filter((o) => o.status !== 'answered');
  const overdueOwner = openOwner.filter((o) => o.due < asOf);

  return {
    asOf, daysToDay1, apps: classified, byId, nodes, links, activeLinks, moveGroups, tasks, totalTasks, doneTasks, wsProgress, warnings,
    tests, testsPassed, items, components, underlying, score, capped, signal, criticalBlocked,
    sepLines, sepTotal, sellerTotal, buyerTotal: sepTotal - sellerTotal, disputed, disputedAmount, disputedSeller, runCost,
    tsa, tsaMonthly, burndown, products, blockedRevenue, decisions, fin, datasetsHygiene, avgHygiene, appsHyg, erpHyg,
    learning, bench, matches, prospects, openOwner, overdueOwner,
  };
}

export type Model = ReturnType<typeof buildModel>;

/** What-if: recompute readiness with hypothetical task/test completions — never changes data. */
export function simulateReadiness(s: WorkspaceState, opts: { unblock?: string[]; completeTasksFor?: string[]; passTestsFor?: string[] }) {
  const clone: WorkspaceState = structuredClone(s);
  const tasks = clone.datasets.tasks?.rows ?? [];
  tasks.forEach((t) => {
    if (opts.unblock?.includes(t.linked_item) && t.status === 'Blocked') t.status = 'Done';
    if (opts.completeTasksFor?.includes(t.linked_item)) t.status = 'Done';
  });
  (clone.datasets.tests?.rows ?? []).forEach((t) => { if (opts.passTestsFor?.includes(t.app_id)) t.result = 'Passed'; });
  const m = buildModel(clone);
  return { score: m.score, underlying: m.underlying, signal: m.signal, capped: m.capped };
}
