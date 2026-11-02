#!/usr/bin/env node
/**
 * Project Phoenix sample data (illustrative) — TSA exit & IT separation for a
 * global financial-services / payments-technology client (Meridian Payments)
 * that acquired a Credit Issuing business from Atlas Bancorp.
 *
 * Scale from the case: ~415 applications, 4,600 conveying IT employees,
 * 10,000+ mailboxes, 9,000+ data-centre assets, 23 global sites,
 * 35,000+ network records, 90-day TSA exit planning mandate, 148 products
 * blocked by "Solution Central".
 *
 * Deterministic: `npm run generate:data` rebuilds identical files.
 * Output: sample-data/phoenix/*.  Same column conventions as the Rioja files
 * (deliberately messy, non-standard headers).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'sample-data', 'phoenix');
fs.mkdirSync(OUT, { recursive: true });

let seed = 20260203;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w = 3) => String(n).padStart(w, '0');
const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function writeCsv(name, headers, rows) {
  fs.writeFileSync(path.join(OUT, name), [headers.map(cell).join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\n') + '\n');
  console.log(`  phoenix/${name.padEnd(34)} ${rows.length} rows`);
}
const AS_OF = '2025-11-05';
const before = (days) => { const d = new Date(AS_OF + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); };

console.log('Generating Project Phoenix sample data…');

// ---------- 23 sites ----------
const SITES = ['Charlotte', 'New York', 'Chicago', 'Toronto', 'Mexico City', 'São Paulo', 'London', 'Dublin', 'Frankfurt', 'Warsaw', 'Kraków', 'Johannesburg', 'Dubai', 'Pune', 'Bengaluru', 'Hyderabad', 'Kuala Lumpur', 'Singapore', 'Manila', 'Hong Kong', 'Tokyo', 'Sydney', 'Phoenix AZ'];
const DCS = ['Charlotte', 'Dublin', 'Pune', 'Singapore'];

// ---------- 40 network segments ----------
const segOwners = ['Seller', 'Seller', 'Shared', 'Shared', 'Buyer'];
const segments = Array.from({ length: 40 }, (_, i) => ({ id: `NET-P${pad(i + 1, 2)}`, site: SITES[i % SITES.length], owner: segOwners[i % 5], name: `${SITES[i % SITES.length]} ${pick(['Corporate LAN', 'DC Fabric', 'DMZ', 'Card Processing VLAN', 'Branch WAN', 'PCI Zone'])}` }));

// ---------- applications (415) ----------
const core = [
  ['Card Issuing Platform', 'Issues and manages credit card accounts, limits and card lifecycle', 'Issuing Technology', 'CoreCard Systems', 1, 0, 5, 5, 5],
  ['Authorization Switch', 'Real-time card authorization and transaction routing to networks', 'Payments Engineering', 'SwitchWorks', 1, 1, 5, 5, 5],
  ['Credit Decision Engine', 'Automated credit underwriting and limit decisions for applications', 'Risk Technology', 'DecisionIQ', 1, 0, 5, 5, 4],
  ['Fraud Detection Hub', 'Real-time fraud scoring and case management for card transactions', 'Fraud Technology', 'FraudShield', 1, 0, 5, 4, 5],
  ['Solution Central', 'Product registration and catalogue required before a card product can be sold in a country', 'Product Management', 'In-house', 0, 1, 4, 4, 2],
  ['Statement Generation', 'Monthly card statements, print and e-statement delivery', 'Customer Operations', 'DocuGen', 0, 1, 4, 4, 2],
  ['Collections Platform', 'Delinquency management, dunning and collections workflows', 'Collections IT', 'CollectPro', 0, 1, 4, 5, 3],
  ['Dispute & Chargeback Portal', 'Customer disputes and network chargeback processing', 'Customer Operations', 'DisputeHub', 0, 0, 4, 5, 3],
  ['KYC Onboarding', 'Know-your-customer checks and digital onboarding for new cardholders', 'Onboarding Technology', 'VerifyNow', 0, 1, 4, 5, 4],
  ['Rewards Engine', 'Points accrual, redemption catalogue and partner rewards', 'Loyalty Technology', 'LoyaltyOne', 0, 1, 3, 2, 2],
  ['Card Personalisation', 'Card embossing, chip personalisation and PIN mailer bureau interface', 'Issuing Technology', 'EmbossTech', 1, 0, 4, 3, 4],
  ['Customer Servicing CRM', 'Agent desktop for cardholder servicing across contact centres', 'Customer Operations', 'CloudCRM', 0, 0, 4, 3, 3],
  ['IVR & Contact Routing', 'Interactive voice response and call routing for card servicing', 'Contact Centre IT', 'VoiceFlow', 0, 0, 4, 2, 3],
  ['Regulatory Reporting Suite', 'Regulatory returns, credit bureau reporting and audit extracts', 'Finance Technology', 'RegReport', 0, 0, 4, 5, 3],
  ['General Ledger', 'Credit Issuing general ledger, sub-ledgers and month-end close', 'Finance Technology', 'LedgerOne', 0, 0, 4, 5, 3],
  ['Treasury & Settlement', 'Network settlement, funding and liquidity management', 'Treasury IT', 'TreasuryPro', 0, 1, 5, 5, 4],
  ['Enterprise Data Warehouse', 'Credit Issuing data warehouse and analytics marts', 'Data Platform', 'DataCore', 0, 0, 3, 3, 3],
  ['Identity & Access Directory', 'User directory, single sign-on and privileged access', 'Security Engineering', 'Microsoft', 0, 0, 5, 4, 5],
  ['Email & Collaboration', 'Corporate email, calendar and collaboration for 10,000+ mailboxes', 'Workplace Technology', 'Microsoft', 0, 0, 5, 3, 4],
  ['Endpoint Security & MDM', 'Endpoint detection, encryption and mobile device management', 'Security Engineering', 'ShieldOne', 0, 0, 4, 4, 5],
];
const domains = ['Issuing', 'Payments', 'Risk', 'Fraud', 'Collections', 'Servicing', 'Finance', 'Treasury', 'Data', 'Marketing', 'HR', 'Compliance', 'Workplace', 'Security', 'Product'];
const functions = ['Batch Scheduler', 'Reporting Mart', 'API Gateway', 'Workflow Tool', 'Reconciliation', 'Document Archive', 'Case Manager', 'Analytics Dashboard', 'Interface Hub', 'Rules Engine', 'Portal', 'Notification Service', 'Data Feed', 'Admin Console', 'Monitoring'];
const teams = { Issuing: 'Issuing Technology', Payments: 'Payments Engineering', Risk: 'Risk Technology', Fraud: 'Fraud Technology', Collections: 'Collections IT', Servicing: 'Customer Operations', Finance: 'Finance Technology', Treasury: 'Treasury IT', Data: 'Data Platform', Marketing: 'Marketing Technology', HR: 'HR Technology', Compliance: 'Compliance IT', Workplace: 'Workplace Technology', Security: 'Security Engineering', Product: 'Product Management' };
const vendors = ['In-house', 'In-house', 'CloudCRM', 'DataCore', 'WorkflowCo', 'ArchivePro', 'ReportCo', 'IntegrateX', 'RulesNet', 'ObservaOne', 'SAPient', 'OracleWorks'];

const apps = [];
const nServers = 1850; // app/database servers among 9,200 DC assets
core.forEach((c, i) => apps.push({ id: `PHX-${pad(i + 1)}`, name: c[0], desc: c[1], team: c[2], vendor: c[3], crit: c[4], rev: c[5], C: c[6], R: c[7], S: c[8] }));
const usedNames = new Set(apps.map((a) => a.name));
while (apps.length < 415) {
  const d = pick(domains), f = pick(functions);
  let name = `${d} ${f}`;
  let k = 2;
  while (usedNames.has(name)) name = `${d} ${f} ${k++}`;
  usedNames.add(name);
  apps.push({ id: `PHX-${pad(apps.length + 1)}`, name, desc: `${f.toLowerCase()} supporting ${d.toLowerCase()} operations for the Credit Issuing business`, team: teams[d], vendor: pick(vendors), crit: 0, rev: d === 'Product' && rnd() < 0.3 ? 1 : 0, C: int(1, 4), R: d === 'Compliance' || d === 'Finance' ? int(3, 5) : int(1, 3), S: d === 'Security' ? int(3, 5) : int(1, 3) });
}
const appRows = apps.map((a, i) => {
  const seg = segments[i % segments.length];
  const srvIdx = i < 20 ? i * 7 + 1 : int(1, nServers);
  const r = rnd();
  return {
    'Application ID': a.id,
    'Application Name': a.name,
    'Description': a.desc,
    'Primary Host': r < 0.012 ? `DCA-${pad(99000 + i, 5)}` : `DCA-${pad(srvIdx, 5)}`, // a few broken links
    'Network Zone': seg.id,
    'Licence Ref': `LP-${pad(i + 1, 4)}`,
    'Owning Team': r > 0.012 && r < 0.05 ? '' : a.team,
    'Vendor': r > 0.05 && r < 0.075 ? '' : a.vendor,
    'User Count': i < 20 ? int(400, 4600) : (r > 0.075 && r < 0.085 ? 0 : int(5, 900)),
    'Location': r > 0.085 && r < 0.105 ? '' : seg.site,
    'Run Cost (₹)': int(8, 900) * 1000,
    'Last Modified': r > 0.105 && r < 0.13 ? before(int(200, 900)) : before(int(1, 160)),
    'Retained by Buyer': r > 0.13 && r < 0.15 ? 'No' : 'Yes',
    'Licence Transferable': pick(['Yes', 'Yes', 'Yes', 'No', 'Consent required', 'Unknown']),
    'Go Live': int(2004, 2023),
    'Critical Tool': a.crit ? 'Yes' : 'No',
    'Revenue Linked': a.rev ? 'Yes' : 'No',
    'Criticality': a.C, 'Regulatory Risk': a.R, 'Security Risk': a.S,
    'Buyer Has Equivalent': i >= 20 && rnd() < 0.12 ? 'Yes' : 'No',
  };
});
for (let k = 0; k < 6; k++) appRows.push({ ...appRows[int(25, 400)] });
writeCsv('01_Applications.csv', Object.keys(appRows[0]), appRows);

// ---------- data-centre assets (9,200) ----------
const dcRows = [];
for (let i = 1; i <= 9200; i++) {
  const isServer = i <= nServers;
  const site = DCS[i % 4];
  const r = rnd();
  dcRows.push({
    'Asset ID': `DCA-${pad(i, 5)}`,
    'Asset Name': isServer ? `${site.slice(0, 3).toUpperCase()}-SRV-${pad(i, 5)}` : `${site.slice(0, 3).toUpperCase()}-${pick(['STO', 'BKP', 'LB', 'HSM', 'FW'])}-${pad(i, 5)}`,
    'Data Centre': r < 0.02 ? '' : site,
    'Owner Entity': pick(['Seller', 'Seller', 'Shared', 'Buyer']),
    'OS / Platform': isServer ? pick(['RHEL 8', 'RHEL 7', 'Windows Server 2019', 'Windows Server 2022', 'AIX 7.2', 'z/OS']) : pick(['Storage array', 'Backup appliance', 'Load balancer', 'HSM', 'Firewall']),
    'Environment': pick(['Production', 'Production', 'Production', 'DR', 'UAT', 'Development']),
    'Last Updated': r > 0.02 && r < 0.05 ? before(int(200, 1000)) : before(int(1, 150)),
    'Segment': segments[i % 40].id,
    'Cores': isServer ? pick([8, 16, 32, 64, 128]) : '',
  });
}
for (let k = 0; k < 40; k++) dcRows.push({ ...dcRows[int(1, 9000)] });
writeCsv('02_DataCentre_Assets.csv', Object.keys(dcRows[0]), dcRows);

// ---------- network records (35,412) ----------
const devTypes = ['Access switch', 'Core switch', 'Router', 'Firewall', 'Wireless AP', 'WAN circuit', 'Load balancer', 'VPN concentrator'];
const netRows = [];
for (let i = 1; i <= 35412; i++) {
  const s = segments[(i * 7 + int(0, 39)) % 40];
  const r = rnd();
  netRows.push({
    'Device Tag': `NR-${pad(i, 6)}`,
    'Type': pick(devTypes),
    'Network Segment': s.id,
    'Segment Description': s.name,
    'Site': r < 0.07 ? '' : s.site,
    'Owner': r > 0.07 && r < 0.11 ? '' : s.owner,
    'IP': `10.${int(20, 90)}.${int(0, 254)}.${int(1, 254)}`,
    'Last Seen': r > 0.11 && r < 0.18 ? before(int(200, 1200)) : before(int(0, 150)),
    'State': rnd() < 0.95 ? 'Active' : 'Spare',
  });
}
for (let k = 0; k < 412; k++) netRows.push({ ...netRows[int(1, 35000)] });
writeCsv('03_Network_Records.csv', Object.keys(netRows[0]), netRows);

// ---------- licences ----------
const licRows = apps.map((a, i) => ({
  'Licence ID': `LP-${pad(i + 1, 4)}`, 'Product': `${a.name} ${pick(['Enterprise', 'Runtime', 'Seats', 'Subscription'])}`, 'Vendor': a.vendor === 'In-house' ? 'Internal' : a.vendor,
  'Application': a.id, 'Quantity': int(5, 4600), 'Transferable': rnd() < 0.06 ? '' : pick(['Yes', 'Yes', 'No', 'Consent required']),
  'Holder': pick(['Seller', 'Seller', 'Shared', 'Buyer']), 'Annual Cost': `₹${(int(2, 400) * 1000).toLocaleString('en-US')}`, 'Expiry': `${pick([2026, 2026, 2027])}-${pad(int(1, 12), 2)}-28`,
}));
writeCsv('04_Licence_Register.csv', Object.keys(licRows[0]), licRows);

// ---------- mailboxes / identity (10,240) ----------
const first = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Sofia', 'Mateo', 'Chen', 'Wei', 'Yuki', 'Hana', 'Kofi', 'Amara', 'Omar', 'Layla', 'Lukas', 'Zofia', 'Jakub', 'Siobhan', 'Sean', 'Maria', 'Carlos', 'Thandi', 'Raj', 'Meera', 'Daniel'];
const last = ['Sharma', 'Iyer', 'Smith', 'Brown', 'Garcia', 'Silva', 'Murphy', 'Kowalski', 'Nowak', 'Müller', 'Tan', 'Lim', 'Wong', 'Sato', 'Mensah', 'Khan', 'Haddad', 'Patel', 'Rao', 'Lopez', 'Kelly', 'Novak', 'Ndlovu', 'Chen'];
const roles = ['Card operations analyst', 'Collections agent', 'Contact centre agent', 'Fraud analyst', 'Credit risk analyst', 'Software engineer', 'Data engineer', 'Product manager', 'Finance analyst', 'Compliance officer', 'IT support engineer', 'Relationship manager'];
const idRows = [];
for (let i = 1; i <= 10240; i++) {
  const f = pick(first), l = pick(last);
  idRows.push({ 'Display Name': `${f} ${l}`, 'Mailbox': `${f}.${l}.${i}@atlasbancorp.example`.toLowerCase(), 'Title': pick(roles), 'Office': pick(SITES), 'Business Unit': 'Credit Issuing', 'Device': `EUC-${pad(i, 6)}`, 'MFA': rnd() < 0.91 ? 'Y' : 'N', 'Groups': pick(['CI-ALL', 'CI-OPS;CRM-USERS', 'CI-RISK;DECISION-USERS', 'CI-FIN;GL-USERS', 'CI-ENG;DEVOPS']), 'Last Logon': before(rnd() < 0.06 ? int(190, 500) : int(0, 30)) });
}
writeCsv('05_Mailboxes_Accounts.csv', Object.keys(idRows[0]), idRows);

// ---------- conveying IT employees (4,600) ----------
const itRoles = ['Application support engineer', 'Infrastructure engineer', 'Network engineer', 'Security analyst', 'Database administrator', 'Service desk analyst', 'Business analyst', 'Project manager', 'Software engineer', 'Data engineer'];
const hrRows = [];
for (let i = 1; i <= 4600; i++) {
  const f = pick(first), l = pick(last);
  hrRows.push({ 'Name': `${f} ${l}`, 'Email': `${f[0]}${l}.${i}@atlasbancorp.example`.toLowerCase(), 'Staff ID': `AB${pad(400000 + i, 7)}`, 'Role': pick(itRoles), 'Location': pick(SITES), 'Conveyance': rnd() < 0.93 ? 'Conveying to Meridian' : 'Retained by seller', 'Effective Date': '2025-08-01', 'Device Re-image': rnd() < 0.7 ? 'Yes' : 'No' });
}
writeCsv('06_Conveying_IT_Employees.csv', Object.keys(hrRows[0]), hrRows);

// ---------- cost register ----------
const costRows = apps.slice(0, 60).map((a, i) => ({ 'Cost Line': `RUN-${pad(i + 1)}`, 'System': a.id, 'Cost Type': 'Annual run', 'Description': `${a.name} annual run cost`, 'Amount (₹)': appRows[i]['Run Cost (₹)'], 'Who Caused It': '', 'Like-for-like?': '', 'Contract Says': '', 'Status': 'Agreed' }));
costRows.push(
  { 'Cost Line': 'SEP-P01', 'System': 'PHX-019', 'Cost Type': 'Separation (one-time)', 'Description': 'Mailbox migration for 10,000+ mailboxes', 'Amount (₹)': 1100000, 'Who Caused It': 'Seller', 'Like-for-like?': 'Like-for-like', 'Contract Says': 'Shared', 'Status': 'Agreed' },
  { 'Cost Line': 'SEP-P02', 'System': 'PHX-020', 'Cost Type': 'Separation (one-time)', 'Description': 'End-user devices and security tooling for 4,600 conveying staff', 'Amount (₹)': 2300000, 'Who Caused It': 'Seller', 'Like-for-like?': 'Partly', 'Contract Says': '', 'Status': 'Disputed' },
  { 'Cost Line': 'SEP-P03', 'System': 'PHX-001', 'Cost Type': 'Separation (one-time)', 'Description': 'Data-centre asset transfer and re-racking (9,000+ assets)', 'Amount (₹)': 1600000, 'Who Caused It': 'Shared', 'Like-for-like?': 'Like-for-like', 'Contract Says': 'Shared', 'Status': 'Agreed' },
  { 'Cost Line': 'SEP-P04', 'System': 'PHX-002', 'Cost Type': 'Separation (one-time)', 'Description': 'Network re-IP and segmentation across 23 sites', 'Amount (₹)': 900000, 'Who Caused It': 'Seller', 'Like-for-like?': 'Like-for-like', 'Contract Says': '', 'Status': 'Disputed' },
);
writeCsv('07_Cost_Register.csv', Object.keys(costRows[0]), costRows);

// ---------- TSA schedule (90-day exit mandate from 05 Nov → 03 Feb) ----------
const tsa = [
  ['TSA-P01', 'Email & collaboration (10,000+ mailboxes)', 410000, '2026-01-15', 'PHX-019', 24, 9, '2025-09-15'],
  ['TSA-P02', 'Identity & access directory', 180000, '2026-01-10', 'PHX-018', 18, 9, '2025-09-20'],
  ['TSA-P03', 'Data-centre hosting (Charlotte, Dublin)', 620000, '2026-02-03', 'PHX-001', 30, 12, '2025-09-01'],
  ['TSA-P04', 'Network & WAN services', 260000, '2026-01-31', 'NET-P01', 22, 7, '2025-09-15'],
  ['TSA-P05', 'Authorization switch hosting', 340000, '2026-02-03', 'PHX-002', 20, 9, '2025-10-01'],
  ['TSA-P06', 'Fraud scoring service', 150000, '2026-01-20', 'PHX-004', 14, 7, '2025-10-01'],
  ['TSA-P07', 'Statement print & mail', 90000, '2025-12-31', 'PHX-006', 10, 8, '2025-09-15'],
  ['TSA-P08', 'Service desk & end-user support', 210000, '2026-01-31', 'PHX-020', 16, 4, '2025-09-15'],
  ['TSA-P09', 'General ledger & finance ops', 120000, '2026-02-03', 'PHX-015', 18, 8, '2025-10-01'],
  ['TSA-P10', 'Data warehouse & reporting', 80000, '2026-02-03', 'PHX-017', 12, 5, '2025-10-15'],
  ['TSA-P11', 'Contact centre telephony', 110000, '2026-01-15', 'PHX-013', 12, 3, '2025-09-20'],
  ['TSA-P12', 'Solution Central product registration', 60000, '2025-12-15', 'PHX-005', 10, 6, '2025-10-01'],
];
writeCsv('08_TSA_Schedule.csv', ['TSA Ref', 'Service', 'Provider', 'Monthly Fee (₹)', 'Service Start', 'Target Exit', 'Owner', 'Linked System', 'Exit Milestones', 'Milestones Done', 'Exit Prep Start'],
  tsa.map((t, i) => ({ 'TSA Ref': t[0], Service: t[1], Provider: 'Atlas Bancorp', 'Monthly Fee (₹)': t[2], 'Service Start': '2025-08-01', 'Target Exit': t[3], Owner: pick(['Kofi Mensah', 'Zofia Nowak', 'Raj Patel', 'Siobhan Kelly', 'Mateo Garcia']), 'Linked System': t[4], 'Exit Milestones': t[5], 'Milestones Done': t[6], 'Exit Prep Start': t[7] })));

// ---------- finance master data ----------
const erpRows = [];
for (let i = 1; i <= 640; i++) {
  const r = rnd();
  erpRows.push({ 'Vendor ID': `PV${pad(i, 5)}`, 'Vendor Name': `${pick(['Global', 'Prime', 'Apex', 'Union', 'Metro', 'Pacific', 'Atlantic', 'Summit'])} ${pick(['Card Services', 'Print', 'Data', 'Telecom', 'Facilities', 'Consulting', 'Software'])} ${pick(['Ltd', 'Inc', 'GmbH', 'Pvt Ltd', 'Sp. z o.o.', 'LLC'])}`, 'GL Account': `${pick([6100, 6200, 6300, 7100])}-${int(10, 99)}`, 'Cost Centre': r < 0.05 ? '' : `CC-CI-${pick(['OPS', 'RISK', 'TECH', 'FIN', 'CX'])}`, 'Currency': r > 0.05 && r < 0.08 ? '' : pick(['USD', 'USD', 'EUR', 'GBP', 'INR', 'PLN']), 'Payment Terms': pick(['NET30', 'NET45', 'NET60']), 'Legal Entity': 'Atlas Credit Issuing', 'Last Updated': r > 0.08 && r < 0.12 ? before(int(220, 800)) : before(int(3, 150)) });
}
writeCsv('09_Finance_Master_Data.csv', Object.keys(erpRows[0]), erpRows);

// ---------- tasks (~1,200) ----------
const WS = ['Infrastructure', 'Applications', 'Network', 'Identity & Security', 'Licences', 'People', 'TSA Services', 'Finance & Costs'];
const owners = { Infrastructure: ['Kofi Mensah', 'Lukas Müller'], Applications: ['Zofia Nowak', 'Wei Tan', 'Aarav Sharma'], Network: ['Raj Patel', 'Sean Murphy'], 'Identity & Security': ['Amara Khan', 'Yuki Sato'], Licences: ['Siobhan Kelly'], People: ['Meera Iyer', 'Thandi Ndlovu'], 'TSA Services': ['Mateo Garcia', 'Kofi Mensah'], 'Finance & Costs': ['Emma Brown', 'Carlos Lopez'] };
const verbs = ['Migrate', 'Validate', 'Cut over', 'Decommission', 'Document', 'Test', 'Reconcile', 'Re-point', 'Approve', 'Configure'];
const crit = apps.filter((a) => a.crit || a.rev || a.C >= 5 || (a.C >= 4 && a.S >= 4)).slice(0, 40);
const tasks = [];
let tid = 1;
const add = (t) => tasks.push({ 'Task ID': `PT-${pad(tid++, 4)}`, ...t });
crit.forEach((a, i) => {
  const total = int(5, 9), done = Math.max(1, total - int(0, 4));
  for (let k = 0; k < total; k++) {
    const isDone = k < done;
    add({ 'Task': `${pick(verbs)} ${a.name} ${pick(['cut-over plan', 'data copy', 'interfaces', 'access model', 'runbook', 'DR test', 'support handover'])}`, 'Workstream': i % 3 === 0 ? 'Applications' : i % 3 === 1 ? 'Infrastructure' : 'Identity & Security', 'Owner': pick(owners.Applications), 'Due Date': isDone ? before(int(1, 40)) : before(-int(2, 60)), 'Status': isDone ? 'Done' : pick(['In progress', 'In progress', 'Not started', 'Review']), 'Priority': 'P1', 'Linked Item': a.id });
  }
});
// story blockers
add({ 'Task': 'Unblock Solution Central product registration feed from seller catalogue', 'Workstream': 'Applications', 'Owner': 'Siobhan Kelly', 'Due Date': '2025-11-08', 'Status': 'Blocked', 'Priority': 'P0', 'Linked Item': 'PHX-005' });
add({ 'Task': 'Approve end-user device migration security baseline (security vs productivity)', 'Workstream': 'Identity & Security', 'Owner': 'Amara Khan', 'Due Date': '2025-11-07', 'Status': 'At risk', 'Priority': 'P0', 'Linked Item': 'PHX-020' });
add({ 'Task': 'Clean 35,000+ network records before re-IP wave', 'Workstream': 'Network', 'Owner': 'Raj Patel', 'Due Date': '2025-11-12', 'Status': 'In progress', 'Priority': 'P0', 'Linked Item': '' });
add({ 'Task': 'Mailbox migration wave 1 (2,500 mailboxes)', 'Workstream': 'TSA Services', 'Owner': 'Mateo Garcia', 'Due Date': '2025-11-09', 'Status': 'Not started', 'Priority': 'P0', 'Linked Item': 'PHX-019' });
while (tasks.length < 1210) {
  const w = pick(WS);
  const isDone = rnd() < 0.62;
  add({ 'Task': `${pick(verbs)} ${pick(['site', 'rack', 'mailbox batch', 'VLAN', 'firewall rule set', 'interface', 'cost centre', 'licence pool', 'device batch', 'runbook', 'TSA exit milestone'])} ${int(1, 180)}`, 'Workstream': w, 'Owner': pick(owners[w]), 'Due Date': isDone ? before(int(1, 90)) : before(-int(1, 90)), 'Status': isDone ? 'Done' : pick(['In progress', 'In progress', 'Not started', 'Not started', 'Review', 'At risk']), 'Priority': pick(['P1', 'P2', 'P2', 'P3']), 'Linked Item': '' });
}
writeCsv('10_Task_Tracker.csv', ['Task ID', 'Task', 'Workstream', 'Owner', 'Due Date', 'Status', 'Priority', 'Linked Item'], tasks);

// ---------- tests ----------
const tests = [];
let tn = 1;
crit.forEach((a) => {
  const total = int(3, 6), pass = total - (rnd() < 0.35 ? int(1, 2) : 0);
  for (let k = 0; k < total; k++) tests.push({ 'Test ID': `PTST-${pad(tn++, 4)}`, System: a.id, 'Test Case': `${a.name} — ${pick(['End-to-end transaction', 'Failover', 'Interface reconciliation', 'Access review', 'Performance', 'Backup restore'])}`, Result: k < pass ? 'Passed' : pick(['Failed', 'Not run']), 'Run Date': before(int(0, 10)), Tester: pick(['Wei Tan', 'Zofia Nowak', 'Amara Khan']) });
});
writeCsv('11_Test_Results.csv', Object.keys(tests[0]), tests);

// ---------- owner questionnaire ----------
const q = [];
const ids = apps.map((a) => a.id);
for (let i = 0; i < 120; i++) {
  const a = apps[i];
  const sends = rnd() < 0.6 ? [pick(ids.slice(0, 40))] : [];
  q.push({ 'App ID': a.id, 'Answered By': pick(['Zofia Nowak', 'Wei Tan', 'Aarav Sharma']), 'Q1 Sends data to': sends.filter((x) => x !== a.id).join('; '), 'Q1 Gets data from': '', 'Q2 Uses anything owned by the seller?': i === 4 ? 'Yes - seller product master catalogue' : rnd() < 0.07 ? 'Not sure' : rnd() < 0.35 ? 'Yes - shared mainframe batch' : 'No', 'Q3 What breaks if switched off?': pick(['Card transactions decline', 'Statements stop', 'Agents cannot service customers', 'Month-end close delayed', 'Reports late', 'Nothing immediate']) });
}
q[1]['Q1 Sends data to'] = 'PHX-016; PHX-004';
q[0]['Q1 Sends data to'] = 'PHX-002; PHX-011';
writeCsv('12_Owner_Questionnaire.csv', Object.keys(q[0]), q);

// ---------- 148 products blocked by Solution Central ----------
const lines = ['Platinum Rewards Card', 'Cashback Classic', 'Business Card', 'Secured Card', 'Travel Elite', 'Student Card', 'Co-brand Retail Card', 'Fuel Card', 'Corporate Purchasing Card', 'Premium Metal Card', 'Virtual Card', 'Installment Card'];
const countries = ['USA', 'Canada', 'Mexico', 'Brazil', 'UK', 'Ireland', 'Germany', 'Poland', 'South Africa', 'UAE', 'India', 'Malaysia', 'Singapore', 'Philippines', 'Hong Kong', 'Japan', 'Australia'];
const prods = [];
const seen = new Set();
while (prods.length < 148) {
  const p = pick(lines), c = pick(countries);
  if (seen.has(p + c)) continue;
  seen.add(p + c);
  prods.push({ Product: p, Country: c, 'Quarterly Revenue (₹)': int(40, 3200) * 1000, 'Blocked By System': rnd() < 0.8 ? 'PHX-005' : pick(['PHX-002', 'PHX-009', 'PHX-006']), 'Registration Status': rnd() < 0.82 ? 'Blocked' : 'Registered' });
}
writeCsv('13_Product_Revenue.csv', Object.keys(prods[0]), prods);

// ---------- Prowess financials ----------
writeCsv('14_Prowess_Financials.csv', ['Company', 'Deal Role', 'Revenue (₹ M)', 'EBITDA (₹ M)', 'Net Profit (₹ M)', 'Total Debt (₹ M)', 'Cash (₹ M)', 'Debt / Equity', 'Interest Coverage (x)', 'Current Ratio'], [
  { Company: 'Meridian Payments Inc', 'Deal Role': 'Buyer', 'Revenue (₹ M)': 6200, 'EBITDA (₹ M)': 1400, 'Net Profit (₹ M)': 520, 'Total Debt (₹ M)': 7800, 'Cash (₹ M)': 260, 'Debt / Equity': 1.7, 'Interest Coverage (x)': 3.1, 'Current Ratio': 0.96 },
  { Company: 'Atlas Bancorp', 'Deal Role': 'Seller', 'Revenue (₹ M)': 21000, 'EBITDA (₹ M)': 6100, 'Net Profit (₹ M)': 3400, 'Total Debt (₹ M)': 9000, 'Cash (₹ M)': 4800, 'Debt / Equity': 0.6, 'Interest Coverage (x)': 9.5, 'Current Ratio': 1.6 },
  { Company: 'CoreCard Systems', 'Deal Role': 'Vendor', 'Revenue (₹ M)': 900, 'EBITDA (₹ M)': 210, 'Net Profit (₹ M)': 80, 'Total Debt (₹ M)': 600, 'Cash (₹ M)': 140, 'Debt / Equity': 1.1, 'Interest Coverage (x)': 5.2, 'Current Ratio': 1.3 },
]);



// ---------- SPA ----------
fs.writeFileSync(path.join(OUT, '18_SPA_Cost_Clauses.txt'), `SHARE AND ASSET PURCHASE AGREEMENT — EXTRACT (ILLUSTRATIVE)
Project Phoenix · Atlas Bancorp ("Seller") and Meridian Payments Inc ("Purchaser")

Clause 8.2 Separation Costs
(a) Separation Costs shall be borne equally by the Seller and the Purchaser.
(b) Any upgrade, additional capacity or improved specification requested by the Purchaser shall be borne solely by the Purchaser.
(c) The Seller shall bear the cost of migrating mailboxes and user identities it is obliged to deliver under Schedule 4.

Clause 8.3 Disputes
Disputed Separation Costs shall be held in escrow pending expert determination and shall not delay TSA exit.

Clause 11.1 Transitional Services
The TSA term is ninety (90) days from the Exit Planning Notice. Extensions are charged at 130% of the monthly charge.
`);
console.log('  phoenix/18_SPA_Cost_Clauses.txt');
// ---------- Firm-wide knowledge library (shared across deals) ----------
fs.copyFileSync(path.resolve(__dirname, '..', 'sample-data', '16_Past_Learning_Records.json'), path.join(OUT, '16_Past_Learning_Records.json'));
console.log('  phoenix/16_Past_Learning_Records.json (firm-wide library, copied)');
console.log('Done.');
