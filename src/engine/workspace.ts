import { DATASET, type DatasetKey } from './glossary';
import { applyMapping, detectDataset, parseUpload, ruleMapColumns, type ParsedUpload } from './ingest';
import { mergeRows, recomputeIssues } from './quality';
import type { ColumnMapping, Config, ManualLink, OwnerItem, WorkspaceState } from './types';
import { addDays, uid } from './util';

export const DEFAULT_CONFIG: Config = {
  priorityWeights: { C: 0.35, D: 0.25, R: 0.2, S: 0.2 },
  day1Threshold: 3.5,
  readinessWeights: { tasks: 0.5, tests: 0.3, hygiene: 0.2 },
  goThreshold: 90, conditionsThreshold: 80, blockerCap: 79,
  hygieneGate: 90,
  staleMonths: 6,
  optionWeights: { security: 0.35, productivity: 0.3, cost: 0.2, speed: 0.15 },
  securityFloor: 3,
  costSplitWeights: { cause: 0.4, likeForLike: 0.4, contract: 0.2 },
  componentWeights: { 'Engineering tools': 0.25, 'Revenue systems': 0.25, Finance: 0.15, 'Identity & security': 0.13, 'Laptops & email': 0.12, Network: 0.1, Applications: 0.05, Infrastructure: 0.04, People: 0.04, Licences: 0.04, Sites: 0.02, 'TSA services': 0.02 },
  bridgeRate: 10.2, leaseRate: 11.5, escrowFeePct: 1.5,
};

export const ROLES: Record<string, { label: string; readOnly: boolean; pages: string[] | 'all'; description: string }> = {
  pwc_manager: { label: 'PwC Engagement Manager', readOnly: false, pages: 'all', description: 'Full deal access' },
  pwc_consultant: { label: 'PwC Consultant', readOnly: false, pages: 'all', description: 'Full deal access' },
  client_leader: { label: 'Client leadership (CIO/CFO/CISO)', readOnly: true, pages: ['Deal Overview', 'Day-1 Readiness', 'Separation Decisions', 'Execution Tracker', 'Funding & TSA Exit', 'Knowledge & Market Insights'], description: 'Read-only, own deal' },
  seller_it: { label: 'Seller IT team', readOnly: false, pages: ['Data & Inventory', 'Dependency Explorer', 'Funding & TSA Exit'], description: 'Assigned requests only' },
  bank: { label: 'Funding partner (bank)', readOnly: true, pages: ['Funding & TSA Exit'], description: 'Consented summary only' },
};

export function emptyWorkspace(): WorkspaceState {
  return {
    version: 1,
    deal: { name: 'Project Rioja', buyer: 'ChipCo', seller: 'SemiCorp', dealType: 'Carve-out', industry: 'Semiconductor', asOf: '2025-11-05', day1: '2025-11-15', sites: ['Pune', 'Austin', 'Penang'] },
    datasets: {}, issues: [], ownerQueue: [], links: [], appOverrides: {}, decisions: {}, waveOverrides: {}, waveReleased: {}, waveChecklist: {},
    funding: { packages: [] }, learning: [], chat: [],
    consents: { 'Bank funding summary': 'Granted', 'Anonymised learning record': 'Granted', 'Benchmark contribution': 'Pending', 'Marketing case study': 'Not granted' },
    controls: { maskPII: true, humanApproval: true, crossDealTraining: false },
    retention: '90 days after TSA exit',
    users: [
      { name: 'Alex Chen', role: 'pwc_manager', title: 'Engagement Manager' },
      { name: 'Priya Nair', role: 'pwc_consultant', title: 'Procurement Lead (PwC)' },
      { name: 'Marco Lee', role: 'pwc_consultant', title: 'Application Lead' },
      { name: 'Aisha Khan', role: 'pwc_consultant', title: 'Finance Data Lead' },
      { name: 'Daniel Wong', role: 'pwc_consultant', title: 'Network Lead' },
      { name: 'Sophie Martin', role: 'client_leader', title: 'ChipCo CIO' },
      { name: 'James Cole', role: 'client_leader', title: 'ChipCo CFO' },
      { name: 'Lena Fischer', role: 'client_leader', title: 'ChipCo CISO' },
      { name: 'Rahul Mehta', role: 'seller_it', title: 'SemiCorp IT Lead' },
      { name: 'Jen Park', role: 'seller_it', title: 'SemiCorp Workplace IT' },
      { name: 'Northbank Credit', role: 'bank', title: 'Funding partner' },
    ],
    currentUser: 'Alex Chen', role: 'pwc_manager',
    config: structuredClone(DEFAULT_CONFIG),
    audit: [], readNotifications: [], dismissedNotice: false, aiCache: {},
  };
}

/** Ingest one parsed file into the workspace (pure — returns a new draft-able state). */
export function ingest(s: WorkspaceState, p: ParsedUpload, key: DatasetKey, mapping: ColumnMapping[]): { state: WorkspaceState; notes: string[] } {
  const ds = applyMapping(p, key, mapping, { maskPII: s.controls.maskPII });
  const notes = [...(ds.ingestNotes ?? [])];
  s.datasets[key] = ds;
  if (key === 'questionnaire') {
    const created = linksFromQuestionnaire(ds.rows);
    s.links = [...s.links.filter((l) => l.source !== 'questionnaire'), ...created];
    notes.push(`${created.length} dependency links captured from owner answers (${created.filter((l) => l.status === 'unclear').length} unclear).`);
    created.filter((l) => l.status === 'unclear').forEach((l) => {
      addOwnerItem(s, { question: `Confirm whether ${l.from} depends on anything owned by the seller`, context: 'Owner answered "Not sure" — treated as seller-owned and kept under TSA until a trial run.', owner: 'Marco Lee', role: 'Application Owner', due: addDays(s.deal.asOf, 1), priority: 'P1' });
    });
  }
  if (key === 'decisions') {
    ds.rows.forEach((r) => { if (!s.decisions[r.decision_id]) s.decisions[r.decision_id] = { status: 'pending' }; });
  }
  s.issues = recomputeIssues(s);
  if (key === 'licences') {
    s.issues.filter((i) => i.dataset === 'licences' && i.field === 'transferable' && i.status === 'open').forEach((i) => {
      const r = ds.rows.find((x) => x._rid === i.rid);
      addOwnerItem(s, { question: `Can licence ${r?.licence_id} (${r?.product}) be transferred to ${s.deal.buyer}?`, context: `Transferability blank in licence register · vendor ${r?.vendor}`, owner: 'Priya Nair', role: 'Procurement Lead', due: addDays(s.deal.asOf, 2), priority: 'P1', issueId: i.id });
    });
  }
  if (key === 'erp') {
    const n = s.issues.filter((i) => i.dataset === 'erp' && i.status === 'open').length;
    if (n) addOwnerItem(s, { question: `Fix ${n} Finance ERP master-data exceptions (cost centre, currency, stale vendors)`, context: 'Finance ERP data scores below the 90 gate — Wave 2 cannot start.', owner: 'Aisha Khan', role: 'Finance Data Lead', due: addDays(s.deal.asOf, 3), priority: 'P1' });
  }
  return { state: s, notes };
}

export function addOwnerItem(s: WorkspaceState, o: Omit<OwnerItem, 'id' | 'status' | 'createdAt'>) {
  if (s.ownerQueue.some((x) => x.question === o.question && x.status !== 'answered')) return;
  s.ownerQueue.push({ ...o, id: uid('OQ'), status: 'open', createdAt: new Date().toISOString() });
}

export function linksFromQuestionnaire(rows: any[]): ManualLink[] {
  const out: ManualLink[] = [];
  const ids = (v: string) => (String(v ?? '').match(/APP-\d+/g) ?? []);
  const seen = new Set<string>();
  const push = (l: Omit<ManualLink, 'id'>) => {
    const k = `${l.from}>${l.to}>${l.type}`;
    if (seen.has(k) || l.from === l.to) return;
    seen.add(k);
    out.push({ ...l, id: `Q:${k}` });
  };
  for (const r of rows) {
    ids(r.sends_to).forEach((t) => push({ from: r.app_id, to: t, type: 'data_flow', source: 'questionnaire', status: 'confirmed', reason: `${r.answered_by || 'Owner'}: "${r.app_id} sends data to ${t}"` }));
    ids(r.gets_from).forEach((t) => push({ from: t, to: r.app_id, type: 'data_flow', source: 'questionnaire', status: 'confirmed', reason: `${r.answered_by || 'Owner'}: "${r.app_id} gets data from ${t}"` }));
    const u = String(r.uses_seller ?? '');
    if (/not sure|unsure|unknown|\?/i.test(u)) push({ from: r.app_id, to: 'SELLER-SVC', type: 'uses_seller_service', source: 'questionnaire', status: 'unclear', reason: `Owner answered "${u}" — treated as seller-owned until a trial run` });
    else if (/^y/i.test(u)) {
      const t = ids(u);
      if (t.length) t.forEach((x) => push({ from: r.app_id, to: x, type: 'uses_seller_service', source: 'questionnaire', status: 'confirmed', reason: u }));
      else push({ from: r.app_id, to: 'SELLER-SVC', type: 'uses_seller_service', source: 'questionnaire', status: 'confirmed', reason: u });
    }
  }
  return out;
}

/** Build the seeded demo workspace from the sample files (state as at 05 Nov). */
export function buildDemoWorkspace(files: Record<string, string>): WorkspaceState {
  let s = emptyWorkspace();
  const order = ['02_Server_Inventory.csv', '03_Network_Assets.csv', '01_Applications.csv', '04_Licence_Register.csv', '05_User_Accounts.csv', '06_Moving_Employees_HR.csv', '07_Cost_Register.csv', '08_TSA_Schedule.csv', '09_Finance_ERP_Master_Data.csv', '10_Task_Tracker.csv', '11_Test_Results.csv', '12_Owner_Questionnaire.csv', '13_Product_Revenue.csv', '14_Prowess_Financials.csv', '15_Prospect_Universe.csv', '16_Past_Learning_Records.json', '17_Decision_Options.csv', '18_SPA_Cost_Clauses.txt'];
  for (const name of order) {
    const text = files[name];
    if (!text) continue;
    const p = parseUpload(name, text);
    const { key } = detectDataset(p);
    const k = DATASET_BY_FILE[name] ?? key;
    const mapping = p.kind === 'csv' ? ruleMapColumns(p.headers, k).map((m) => ({ ...m, confirmed: true })) : [];
    s = ingest(s, p, k, mapping).state;
    s.datasets[k]!.uploadedAt = SEED_TIMES[name] ?? '2025-11-02T10:00:00Z';
  }
  // --- replay the cleaning decisions the team made before 05 Nov ---
  const apps = s.datasets.applications!;
  const setApp = (id: string, patch: Record<string, any>) => { const r = apps.rows.find((x) => x.app_id === id); if (r) Object.assign(r, patch); };
  setApp('APP-001', { site: 'Pune' });
  setApp('APP-003', { vendor: 'EDA Corp' });
  setApp('APP-005', { hosting_server_id: 'SRV-07' });
  setApp('APP-012', { last_updated: '2025-10-30' });
  setApp('APP-010', { _retired: true, _retiredReason: 'Owner confirmed retired (0 users, not updated since 2023)' });
  const dupApp = apps.rows.filter((r) => r.app_id === 'APP-020');
  if (dupApp.length > 1) apps.rows = mergeRows(apps.rows, dupApp[0]._rid, dupApp[1]._rid);
  const srv = s.datasets.servers!;
  const dupSrv = srv.rows.filter((r) => r.server_id === 'SRV-06');
  if (dupSrv.length > 1) srv.rows = mergeRows(srv.rows, dupSrv[0]._rid, dupSrv[1]._rid);
  const pay = srv.rows.find((r) => r.server_id === 'SRV-PAY-01'), pay2 = srv.rows.find((r) => r.server_id === 'PAY-SRV-1');
  if (pay && pay2) srv.rows = mergeRows(srv.rows, pay._rid, pay2._rid);
  srv.rows.forEach((r) => { if (['SRV-11', 'SRV-21'].includes(r.server_id)) { r._retired = true; r._retiredReason = 'Confirmed retired by owner'; } });
  srv.rows.forEach((r) => { if (r.server_id === 'SRV-PAY-01') { r._retired = true; r._retiredReason = 'Payments box decommissioned in 2025 refresh'; } });
  s.datasets.licences?.rows.forEach((r) => { if (['L-30', 'L-53'].includes(r.licence_id)) { r._retired = true; r._retiredReason = 'Licence for retired system'; } });
  const net = s.datasets.network!;
  const seen = new Set<string>();
  net.rows = net.rows.filter((r) => { if (seen.has(r.asset_id)) return false; seen.add(r.asset_id); return true; });
  s.issues = recomputeIssues(s);
  // network: apply only the owner fills (site fills + stale devices still open, as at 05 Nov)
  s.issues.filter((i) => i.dataset === 'network' && i.field === 'ownership' && i.suggestion).forEach((i) => {
    const r = net.rows.find((x) => x._rid === i.rid); if (r) r.ownership = i.suggestion!.value;
  });
  s.issues = recomputeIssues(s);
  // pending AI suggestions on the remaining app gaps
  s.issues.forEach((i) => {
    if (i.dataset === 'applications' && i.field === 'owner_team') {
      const app = apps.rows.find((r) => r._rid === i.rid);
      if (app?.app_id === 'APP-024') i.suggestion = { value: 'Workplace IT', reason: 'Runs on SRV-01 alongside Service Desk (owned by Workplace IT); knowledge base for all staff', source: 'fallback', confidence: 0.78 };
      if (app?.app_id === 'APP-011') i.suggestion = { value: 'unknown', reason: 'No clear clue — viewer used by engineering but hosted on a seller server; ask the owner', source: 'fallback', confidence: 0.4 };
    }
  });
  // seeded owner queue (story items)
  addOwnerItem(s, { question: 'Has EDA Corp consented to transfer licence L-07 (CircuitDesign Pro) to ChipCo?', context: 'Day-1 critical design tool · Clone and Go depends on it', owner: 'Priya Nair', role: 'Procurement Lead', due: '2025-11-04', priority: 'P0' });
  addOwnerItem(s, { question: 'Who owns Collaboration Wiki and SpecViewer?', context: 'Owner team blank in the applications file', owner: 'Marco Lee', role: 'Application Lead', due: '2025-11-07', priority: 'P2' });
  // AI-suggested hidden links awaiting review
  s.links.push(
    { id: 'AI:APP-020>APP-026', from: 'APP-020', to: 'APP-026', type: 'data_flow', source: 'ai', status: 'suggested', confidence: 0.82, reason: 'Yield Analytics probably feeds Supply Chain Planner — wafer-start plans depend on expected yield.' },
    { id: 'AI:APP-006>APP-027', from: 'APP-006', to: 'APP-027', type: 'data_flow', source: 'ai', status: 'suggested', confidence: 0.79, reason: 'Customer Portal quotes are usually synchronised with the Sales CRM pipeline.' },
  );
  s.chat = [{ id: 'c0', role: 'ai', text: 'Hi Alex — I answer from the live Project Rioja dashboard, PwC frameworks and consented past-deal lessons, and I always name my source. Try “Why are we No-go?” or “What moves us to 90?”', sources: ['DealSync Copilot'] }];
  s.audit = [
    { id: 'a1', ts: '2025-11-05T08:56:00Z', actor: 'Marco Lee', action: 'Overrode dependency classification', detail: 'NET-3 · Shared → treated as seller for SpecViewer', kind: 'override' },
    { id: 'a2', ts: '2025-11-05T09:18:00Z', actor: 'System', action: 'Recalculated readiness score', detail: 'Daily recalculation', kind: 'system' },
    { id: 'a3', ts: '2025-11-05T09:31:00Z', actor: 'James Cole', action: 'Viewed funding summary', detail: 'Bank consent scope', kind: 'access' },
    { id: 'a4', ts: '2025-11-05T09:42:00Z', actor: 'Priya Nair', action: 'Approved AI field mapping', detail: '01_Applications.csv · "Application Title" → app_name', kind: 'approve' },
  ];
  return s;
}

const DATASET_BY_FILE: Record<string, DatasetKey> = {
  '01_Applications.csv': 'applications', '02_Server_Inventory.csv': 'servers', '03_Network_Assets.csv': 'network', '04_Licence_Register.csv': 'licences',
  '05_User_Accounts.csv': 'identity', '06_Moving_Employees_HR.csv': 'people', '07_Cost_Register.csv': 'costs', '08_TSA_Schedule.csv': 'tsa',
  '09_Finance_ERP_Master_Data.csv': 'erp', '10_Task_Tracker.csv': 'tasks', '11_Test_Results.csv': 'tests', '12_Owner_Questionnaire.csv': 'questionnaire',
  '13_Product_Revenue.csv': 'products', '14_Prowess_Financials.csv': 'financials', '15_Prospect_Universe.csv': 'prospects', '16_Past_Learning_Records.json': 'learning',
  '17_Decision_Options.csv': 'decisions', '18_SPA_Cost_Clauses.txt': 'spa',
};
const SEED_TIMES: Record<string, string> = {
  '01_Applications.csv': '2025-11-02T14:32:00Z', '02_Server_Inventory.csv': '2025-11-02T13:18:00Z', '03_Network_Assets.csv': '2025-11-01T17:44:00Z',
  '04_Licence_Register.csv': '2025-11-02T11:06:00Z', '09_Finance_ERP_Master_Data.csv': '2025-11-01T15:20:00Z',
};

export { DATASET };
