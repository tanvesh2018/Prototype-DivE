#!/usr/bin/env node
/**
 * DealSync sample-data generator (Project Rioja — illustrative).
 *
 * Produces every upload file the prototype accepts into ./sample-data.
 * The files are deliberately "messy" (non-standard headers, blanks,
 * duplicates, stale records, broken links, personal data) so that the
 * Connect & Clean pipeline has real work to do.
 *
 * Deterministic: re-running produces identical files (seeded PRNG).
 *   npm run generate:data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'sample-data');
fs.mkdirSync(OUT, { recursive: true });

// ---------- helpers ----------
let seed = 20251115;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n, w = 3) => String(n).padStart(w, '0');
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(name, headers, rows) {
  const body = [headers.map(csvCell).join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
  fs.writeFileSync(path.join(OUT, name), body + '\n');
  console.log(`  ${name.padEnd(34)} ${rows.length} rows`);
}
const isoDaysBefore = (iso, days) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};
const AS_OF = '2025-11-05';
const ukDate = (iso) => {
  // messy source date format used by some seller teams: DD/MM/YYYY
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

console.log('Generating DealSync sample data into', OUT);

// ---------- 01 Applications ----------
// Columns intentionally use the seller's own naming, not the DealSync glossary.
const apps = [
  // id, name, function, server, net, licence, ownerTeam, vendor, users, site, cost, updated, buyerUses, transferable, goLive, critTool, revenue, C, R, S, buyerHasSimilar
  ['APP-001', 'CircuitDesign Pro', 'Chip schematic capture and physical layout design used by all design engineers', 'SRV-14', 'NET-3', 'L-07', 'Engineering IT', 'EDA Corp', 120, '', 90000, '2025-10-22', 'Yes', 'Yes - vendor consent required', 2017, 'Yes', 'No', 5, 2, 3, 'No'],
  ['APP-002', 'DesignVault', 'Design file vault and version control for chip layouts and IP blocks', 'SRV-14', 'NET-3', 'L-08', 'Engineering IT', 'VaultSoft', 140, 'Pune', 64000, '2025-10-02', 'Yes', 'Yes', 2018, 'No', 'No', 4, 2, 4, 'No'],
  ['APP-003', 'WaferTest Suite', 'Wafer probe test data capture and yield test analysis', 'SRV-15', 'NET-4', 'L-12', 'Test Systems', '', 46, 'Penang', 52000, '2025-09-18', 'Yes', 'Yes', 2016, 'Yes', 'No', 4, 2, 2, 'No'],
  ['APP-004', 'Finance ERP', 'General ledger, accounts payable, accounts receivable and month-end close', 'SRV-03', 'NET-1', 'L-02', 'Finance Systems', 'LedgerOne', 210, 'Austin', 310000, '2025-10-28', 'Yes', 'No', 2012, 'No', 'No', 4, 4, 3, 'No'],
  ['APP-005', 'Order Tracker', 'Customer order capture, order status tracking and shipment confirmation', 'SRV-99', 'NET-2', 'L-15', 'Sales Operations', 'In-house', 85, 'Austin', 41000, '2025-10-15', 'Yes', 'Yes', 2019, 'No', 'Yes', 3, 1, 2, 'No'],
  ['APP-006', 'Customer Portal', 'Customer self-service portal for quotes, datasheets and order history', 'SRV-02', 'NET-2', 'L-16', 'Digital', 'In-house', 1400, 'Austin', 76000, '2025-10-11', 'Yes', 'Yes', 2020, 'No', 'Yes', 3, 2, 4, 'No'],
  ['APP-007', 'Solution Central', 'Product registration and part-number catalogue required before a chip can be sold in a country', 'SRV-07', 'NET-2', 'L-17', 'Product Management', 'In-house', 64, 'Austin', 58000, '2025-10-08', 'Yes', 'Yes', 2015, 'No', 'Yes', 4, 3, 2, 'No'],
  ['APP-008', 'HR Portal', 'Employee self-service, leave and onboarding for the carved-out business', 'SRV-20', 'NET-6', 'L-20', 'HR Technology', 'PeopleFirst', 520, 'Pune', 38000, '2025-08-30', 'Yes', 'Yes', 2021, 'No', 'No', 2, 3, 2, 'No'],
  ['APP-009', 'Marketing Dashboard', 'Campaign performance dashboards and lead funnel reporting', 'SRV-12', 'NET-6', 'L-21', 'Marketing', 'ChartWorks', 22, 'Pune', 18000, '2025-07-14', 'Yes', 'Yes', 2019, 'No', 'No', 2, 1, 1, 'Yes'],
  ['APP-010', 'FaxGateway', 'Inbound fax to email gateway for legacy supplier documents', 'SRV-11', 'NET-1', '', 'Infrastructure Ops', 'OpenFax', 0, 'Pune', 6000, '2023-06-12', 'No', 'Yes', 2009, 'No', 'No', 1, 1, 2, 'No'],
  ['APP-011', 'SpecViewer', 'Viewer for product specification sheets and design rule documents', 'SRV-18', 'NET-3', 'L-23', '', 'DocuView', 75, 'Pune', 12000, '2025-06-21', 'Yes', 'Unknown', 2014, 'No', 'No', 2, 1, 2, 'No'],
  ['APP-012', 'Legacy Reporting Tool', 'Monthly operational reports built on the old data warehouse', 'SRV-12', 'NET-6', 'L-24', 'BI Team', 'ReportCo', 31, 'Pune', 22000, '2025-03-02', 'Yes', 'No', 2008, 'No', 'No', 2, 2, 2, 'Yes'],
  ['APP-013', 'Email & Calendar', 'Corporate email, calendar and distribution lists', 'SRV-09', 'NET-5', 'L-25', 'Workplace IT', 'Microsoft', 340, 'Austin', 102000, '2025-10-30', 'Yes', 'No', 2016, 'No', 'No', 5, 3, 4, 'No'],
  ['APP-014', 'Identity Directory', 'User directory, single sign-on and access groups', 'SRV-08', 'NET-5', 'L-26', 'Security Engineering', 'Microsoft', 340, 'Pune', 44000, '2025-10-29', 'Yes', 'No', 2015, 'No', 'No', 5, 4, 5, 'No'],
  ['APP-015', 'VPN Gateway', 'Remote access VPN for engineers and field sales', 'SRV-10', 'NET-5', 'L-27', 'Network Engineering', 'SecureLink', 300, 'Pune', 36000, '2025-10-19', 'Yes', 'Yes', 2018, 'No', 'No', 4, 2, 5, 'No'],
  ['APP-016', 'Endpoint Security', 'Endpoint detection and response agent for all laptops', 'SRV-10', 'NET-5', 'L-28', 'Security Engineering', 'ShieldOne', 340, 'Pune', 48000, '2025-10-25', 'Yes', 'Yes', 2020, 'No', 'No', 4, 3, 5, 'No'],
  ['APP-017', 'Licence Server', 'Floating licence server that issues EDA tool seats to design engineers', 'SRV-17', 'NET-5', 'L-29', 'Engineering IT', 'FlexKey', 120, 'Austin', 15000, '2025-09-04', 'Yes', 'No', 2013, 'Yes', 'No', 4, 2, 3, 'No'],
  ['APP-018', 'Payroll Connector', 'Interface that sends payroll journals and headcount to finance', 'SRV-04', 'NET-1', 'L-31', 'HR Technology', 'PayBridge', 6, 'Austin', 9000, '2025-09-27', 'Yes', 'Yes', 2017, 'No', 'No', 3, 5, 3, 'No'],
  ['APP-019', 'Procurement Hub', 'Purchase requisitions, purchase orders and supplier onboarding', 'SRV-13', 'NET-1', 'L-32', 'Procurement', 'BuyRight', 48, 'Austin', 33000, '2025-08-16', 'Yes', 'Yes', 2018, 'No', 'No', 3, 3, 2, 'No'],
  ['APP-020', 'Yield Analytics', 'Statistical yield analysis across wafer lots and test results', 'SRV-05', 'NET-4', 'L-33', 'Test Systems', 'YieldIQ', 38, 'Penang', 47000, '2025-10-05', 'Yes', 'Yes', 2019, 'No', 'No', 3, 1, 2, 'No'],
  ['APP-021', 'Simulation Grid Scheduler', 'Job scheduler for the circuit simulation compute grid', 'SRV-16', 'NET-3', 'L-34', 'Engineering IT', 'GridWorks', 95, 'Pune', 29000, '2025-09-29', 'Yes', 'Yes', 2018, 'No', 'No', 3, 1, 2, 'No'],
  ['APP-022', 'IP Library Manager', 'Catalogue of licensed and in-house IP blocks used in chip designs', 'SRV-16', 'NET-3', 'L-35', 'Engineering IT', 'IPWorks', 110, 'Pune', 26000, '2025-10-01', 'Yes', 'Yes', 2017, 'No', 'No', 3, 3, 3, 'No'],
  ['APP-023', 'Service Desk', 'IT tickets, incident and change management', 'SRV-01', 'NET-6', 'L-36', 'Workplace IT', 'DeskPro', 25, 'Pune', 21000, '2025-10-20', 'Yes', 'Yes', 2020, 'No', 'No', 2, 1, 2, 'Yes'],
  ['APP-024', 'Collaboration Wiki', 'Team wiki and engineering knowledge base', 'SRV-01', 'NET-6', 'L-37', '', 'WikiHub', 260, 'Pune', 14000, '2025-09-12', 'Yes', 'Yes', 2019, 'No', 'No', 2, 1, 2, 'No'],
  ['APP-025', 'Expense Manager', 'Employee expense claims and corporate card reconciliation', 'SRV-19', 'NET-1', 'L-38', 'Finance Systems', 'SpendWise', 330, 'Austin', 19000, '2025-08-08', 'Yes', 'Yes', 2021, 'No', 'No', 2, 3, 2, 'No'],
  ['APP-026', 'Supply Chain Planner', 'Demand and supply planning for foundry wafer starts', 'SRV-13', 'NET-1', 'L-39', 'Supply Chain', 'PlanAhead', 27, 'Austin', 54000, '2025-09-21', 'Yes', 'Yes', 2016, 'No', 'No', 3, 2, 2, 'No'],
  ['APP-027', 'Sales CRM', 'Accounts, opportunities, design-win pipeline and quotes', 'SRV-06', 'NET-2', 'L-40', 'Sales Operations', 'CloudCRM', 90, 'Austin', 67000, '2025-10-26', 'Yes', 'Yes', 2019, 'No', 'Yes', 3, 2, 3, 'No'],
];
const appHeaders = ['App Ref', 'Application Title', 'Business Function / Description', 'Hosted On', 'Network Zone', 'Licence Ref', 'Biz Owner Team', 'Vendor', 'No. of Users', 'Site', 'Annual Run Cost (₹)', 'Last Updated', 'Used by Buyer?', 'Licence Transferable?', 'Go-Live Year', 'Critical Tool?', 'Revenue Linked?', 'Criticality (1-5)', 'Regulatory Risk (1-5)', 'Security Risk (1-5)', 'Buyer Has Similar System?'];
const appRows = apps.map((a) => ({
  'App Ref': a[0], 'Application Title': a[1], 'Business Function / Description': a[2], 'Hosted On': a[3], 'Network Zone': a[4], 'Licence Ref': a[5], 'Biz Owner Team': a[6], Vendor: a[7], 'No. of Users': a[8], Site: a[9], 'Annual Run Cost (₹)': a[10], 'Last Updated': ukDate(a[11]), 'Used by Buyer?': a[12], 'Licence Transferable?': a[13], 'Go-Live Year': a[14], 'Critical Tool?': a[15], 'Revenue Linked?': a[16], 'Criticality (1-5)': a[17], 'Regulatory Risk (1-5)': a[18], 'Security Risk (1-5)': a[19], 'Buyer Has Similar System?': a[20],
}));
// exact duplicate row (same App Ref) sent twice by the seller
appRows.splice(20, 0, { ...appRows[19] });
writeCsv('01_Applications.csv', appHeaders, appRows);

// ---------- 02 Servers ----------
const servers = [
  ['SRV-01', 'PUN-APP-01', 'Pune', 'Buyer', 'Ubuntu 22.04', 'Production', '2025-10-14', 'NET-6', 16],
  ['SRV-02', 'AUS-WEB-02', 'Austin', 'Shared', 'RHEL 8', 'Production', '2025-10-18', 'NET-2', 32],
  ['SRV-03', 'AUS-ERP-03', 'Austin', 'Seller', 'RHEL 7', 'Production', '2025-10-27', 'NET-1', 64],
  ['SRV-04', 'AUS-DB-04', 'Austin', 'Seller', 'Windows Server 2019', 'Production', '2025-09-30', 'NET-1', 48],
  ['SRV-05', 'PEN-TST-05', 'Penang', 'Buyer', 'Ubuntu 20.04', 'Production', '2025-10-02', 'NET-4', 32],
  ['SRV-06', 'AUS-CRM-06', 'Austin', 'Shared', 'Windows Server 2022', 'Production', '2025-10-21', 'NET-2', 24],
  ['SRV-07', 'AUS-ORD-07', 'Austin', 'Shared', 'RHEL 8', 'Production', '2025-10-16', 'NET-2', 32],
  ['SRV-08', 'PUN-IDM-08', 'Pune', 'Shared', 'Windows Server 2022', 'Production', '2025-10-29', 'NET-5', 16],
  ['SRV-09', 'AUS-MAIL-09', 'Austin', 'Seller', 'Windows Server 2019', 'Production', '2025-10-30', 'NET-5', 32],
  ['SRV-10', 'PUN-SEC-10', 'Pune', 'Shared', 'Ubuntu 22.04', 'Production', '2025-10-24', 'NET-5', 16],
  ['SRV-11', 'PUN-FAX-11', 'Pune', 'Seller', 'Windows Server 2008', 'Production', '2023-05-30', 'NET-1', 4],
  ['SRV-12', 'PUN-RPT-12', 'Pune', 'Shared', 'Windows Server 2016', 'Production', '2025-07-10', 'NET-6', 16],
  ['SRV-13', 'AUS-SCM-13', 'Austin', 'Shared', 'RHEL 8', 'Production', '2025-09-18', 'NET-1', 32],
  ['SRV-14', 'PUN-EDA-14', 'Pune', 'Seller', 'RHEL 8', 'Production', '2025-10-20', 'NET-3', 128],
  ['SRV-15', 'PEN-WAF-15', 'Penang', 'Shared', 'RHEL 8', 'Production', '2025-09-16', 'NET-4', 64],
  ['SRV-16', 'PUN-SIM-16', 'Pune', 'Buyer', 'Rocky Linux 9', 'Production', '2025-09-28', 'NET-3', 256],
  ['SRV-17', 'AUS-LIC-17', 'Austin', 'Seller', 'RHEL 7', 'Production', '2025-09-02', 'NET-5', 8],
  ['SRV-18', 'PUN-SPEC-18', 'Pune', 'Seller', 'Windows Server 2016', 'Production', '2025-06-20', 'NET-3', 8],
  ['SRV-19', 'AUS-EXP-19', 'Austin', 'Buyer', 'Ubuntu 22.04', 'Production', '2025-08-05', 'NET-1', 8],
  ['SRV-20', 'PUN-HR-20', 'Pune', 'Buyer', 'Ubuntu 22.04', 'Production', '2025-08-28', 'NET-6', 16],
  ['SRV-21', 'PUN-DEV-21', 'Pune', 'Seller', 'Ubuntu 18.04', 'Development', '2024-11-02', 'NET-3', 8],
  ['SRV-PAY-01', 'Payments Server 01', 'Austin', 'Shared', 'Windows Server 2019', 'Production', '2025-09-26', 'NET-1', 16],
];
const serverHeaders = ['Server ID', 'Host Name', 'Location', 'Owned By', 'Operating System', 'Env', 'Last Patched / Updated', 'Network Segment', 'vCPU'];
const serverRows = servers.map((s) => ({ 'Server ID': s[0], 'Host Name': s[1], Location: s[2], 'Owned By': s[3], 'Operating System': s[4], Env: s[5], 'Last Patched / Updated': s[6], 'Network Segment': s[7], vCPU: s[8] }));
// look-alike duplicate (different ID, same physical box) and exact duplicate
serverRows.push({ 'Server ID': 'PAY-SRV-1', 'Host Name': 'Payments Server 1', Location: 'Austin', 'Owned By': 'Shared', 'Operating System': '', Env: 'Production', 'Last Patched / Updated': '2025-04-11', 'Network Segment': 'NET-1', vCPU: '' });
serverRows.splice(7, 0, { ...serverRows[5] });
writeCsv('02_Server_Inventory.csv', serverHeaders, serverRows);

// ---------- 03 Network assets (large) ----------
const segments = [
  ['NET-1', 'Austin Corporate LAN', 'Austin', 'Seller'],
  ['NET-2', 'Austin Commerce DMZ', 'Austin', 'Shared'],
  ['NET-3', 'Pune Engineering VLAN', 'Pune', 'Shared'],
  ['NET-4', 'Penang Test Lab', 'Penang', 'Buyer'],
  ['NET-5', 'Global WAN / MPLS', 'Austin', 'Seller'],
  ['NET-6', 'Pune Corporate LAN', 'Pune', 'Buyer'],
];
const devTypes = ['Access switch', 'Core switch', 'Router', 'Firewall', 'Wireless AP', 'WAN link', 'Load balancer'];
const netRows = [];
for (let i = 1; i <= 1240; i++) {
  const seg = segments[i % 6 === 0 ? 5 : i % 6];
  const segIdx = int(0, 5);
  const s = segments[(segIdx + i) % 6];
  const type = pick(devTypes);
  let lastSeen = isoDaysBefore(AS_OF, int(1, 150));
  let site = s[2];
  let owner = s[3];
  const r = rnd();
  if (r < 0.035) site = ''; // missing site
  else if (r < 0.065) lastSeen = isoDaysBefore(AS_OF, int(200, 900)); // stale
  else if (r < 0.08) owner = '';
  netRows.push({
    'Asset Tag': `ND-${pad(i, 5)}`,
    'Device Type': type,
    Segment: s[0],
    'Segment Name': s[1],
    'Site/Location': site,
    'Segment Owner': owner,
    'Mgmt IP': `10.${10 + (segIdx % 6)}.${int(0, 254)}.${int(1, 254)}`,
    'Last Seen': lastSeen,
    Status: rnd() < 0.96 ? 'Active' : 'Spare',
  });
  void seg;
}
// a handful of duplicated asset tags (rescanned devices)
for (let k = 0; k < 14; k++) netRows.push({ ...netRows[int(0, 1200)] });
writeCsv('03_Network_Assets.csv', ['Asset Tag', 'Device Type', 'Segment', 'Segment Name', 'Site/Location', 'Segment Owner', 'Mgmt IP', 'Last Seen', 'Status'], netRows);

// ---------- 04 Licence register ----------
const licences = [
  ['L-01', 'Office Productivity Suite', 'Microsoft', 'APP-013', 340, 'No', 'Seller', 74000, '2026-06-30'],
  ['L-02', 'LedgerOne ERP Enterprise', 'LedgerOne', 'APP-004', 210, 'No', 'Seller', 180000, '2026-12-31'],
  ['L-07', 'CircuitDesign Pro Seats', 'EDA Corp', 'APP-001', 120, 'Consent required', 'Seller', 90000, '2026-03-31'],
  ['L-08', 'DesignVault Enterprise', 'VaultSoft', 'APP-002', 140, 'Yes', 'Shared', 64000, '2026-09-30'],
  ['L-12', 'WaferTest Suite Runtime', 'EDA Corp', 'APP-003', 46, 'Yes', 'Shared', 52000, '2026-05-31'],
  ['L-15', 'Order Tracker DB', 'DataCore', 'APP-005', 85, 'Yes', 'Shared', 12000, '2026-08-31'],
  ['L-16', 'Portal CMS', 'WebStack', 'APP-006', 1400, 'Yes', 'Shared', 21000, '2026-10-31'],
  ['L-17', 'Catalogue Engine', 'CatalogX', 'APP-007', 64, 'Yes', 'Shared', 18000, '2026-04-30'],
  ['L-20', 'PeopleFirst HR', 'PeopleFirst', 'APP-008', 520, 'Yes', 'Buyer', 38000, '2026-12-31'],
  ['L-21', 'ChartWorks Pro', 'ChartWorks', 'APP-009', 22, 'Yes', 'Shared', 9000, '2026-01-31'],
  ['L-23', 'DocuView Server', 'DocuView', 'APP-011', 75, '', 'Seller', 7000, '2026-02-28'],
  ['L-24', 'ReportCo Classic', 'ReportCo', 'APP-012', 31, 'No', 'Seller', 11000, '2025-12-31'],
  ['L-25', 'Mail & Calendar Plan E3', 'Microsoft', 'APP-013', 340, 'No', 'Seller', 28000, '2026-06-30'],
  ['L-26', 'Directory Premium P1', 'Microsoft', 'APP-014', 340, 'No', 'Seller', 22000, '2026-06-30'],
  ['L-27', 'SecureLink VPN', 'SecureLink', 'APP-015', 300, 'Yes', 'Shared', 19000, '2026-07-31'],
  ['L-28', 'ShieldOne EDR', 'ShieldOne', 'APP-016', 340, 'Yes', 'Shared', 31000, '2026-09-30'],
  ['L-29', 'FlexKey Licence Manager', 'FlexKey', 'APP-017', 1, 'No', 'Seller', 15000, '2026-03-31'],
  ['L-31', 'PayBridge Connector', 'PayBridge', 'APP-018', 6, '', 'Seller', 9000, '2026-06-30'],
  ['L-32', 'BuyRight Procurement', 'BuyRight', 'APP-019', 48, 'Yes', 'Shared', 24000, '2026-11-30'],
  ['L-33', 'YieldIQ Analytics', 'YieldIQ', 'APP-020', 38, 'Yes', 'Buyer', 47000, '2026-05-31'],
  ['L-34', 'GridWorks Scheduler', 'GridWorks', 'APP-021', 95, 'Yes', 'Buyer', 29000, '2026-08-31'],
  ['L-35', 'IPWorks Catalogue', 'IPWorks', 'APP-022', 110, '', 'Shared', 26000, '2026-10-31'],
  ['L-36', 'DeskPro ITSM', 'DeskPro', 'APP-023', 25, 'Yes', 'Buyer', 21000, '2026-12-31'],
  ['L-37', 'WikiHub Team', 'WikiHub', 'APP-024', 260, 'Yes', 'Buyer', 14000, '2026-07-31'],
  ['L-38', 'SpendWise Expenses', 'SpendWise', 'APP-025', 330, 'Yes', 'Buyer', 19000, '2026-04-30'],
  ['L-39', 'PlanAhead Supply', 'PlanAhead', 'APP-026', 27, 'Yes', 'Shared', 54000, '2026-09-30'],
  ['L-40', 'CloudCRM Sales', 'CloudCRM', 'APP-027', 90, 'Yes', 'Shared', 67000, '2026-12-31'],
  ['L-41', 'Simulation Solver Pack', 'EDA Corp', 'APP-021', 60, 'Consent required', 'Seller', 72000, '2026-03-31'],
  ['L-42', 'Layout Verification Add-on', 'EDA Corp', 'APP-001', 40, 'Consent required', 'Seller', 38000, '2026-03-31'],
  ['L-30', 'Legacy Scanner Licence', 'ScanPro', 'APP-099', 5, 'Yes', 'Seller', 2000, '2025-12-31'],
  ['L-43', 'PDF Toolkit', 'DocuView', 'APP-011', 75, 'Yes', 'Shared', 3000, '2026-02-28'],
  ['L-44', 'Code Signing Certs', 'TrustCA', 'APP-022', 4, '', 'Seller', 6000, '2026-01-31'],
  ['L-45', 'Statistical Toolbox', 'YieldIQ', 'APP-020', 20, 'Yes', 'Buyer', 8000, '2026-05-31'],
  ['L-46', 'Backup Agent', 'SafeKeep', 'APP-004', 30, 'Yes', 'Shared', 12000, '2026-06-30'],
  ['L-47', 'Network Monitoring', 'NetWatch', 'APP-015', 1, 'Yes', 'Shared', 16000, '2026-09-30'],
  ['L-48', 'Mobile Device Mgmt', 'ShieldOne', 'APP-016', 340, 'Yes', 'Shared', 14000, '2026-09-30'],
  ['L-49', 'Data Warehouse Seats', 'ReportCo', 'APP-012', 31, 'No', 'Seller', 7000, '2025-12-31'],
  ['L-50', 'E-signature', 'SignFast', 'APP-008', 50, 'Yes', 'Buyer', 5000, '2026-03-31'],
  ['L-51', 'Translation Memory', 'LinguaPro', 'APP-006', 10, 'Yes', 'Shared', 4000, '2026-02-28'],
  ['L-52', 'Test Program Compiler', 'EDA Corp', 'APP-003', 12, 'Yes', 'Shared', 22000, '2026-05-31'],
  ['L-53', 'Fax Line Rental', 'OpenFax', 'APP-010', 1, 'Yes', 'Seller', 1800, '2024-09-30'],
  ['L-54', 'Forecasting Add-in', 'PlanAhead', 'APP-026', 8, 'Yes', 'Shared', 6000, '2026-09-30'],
];
const licRows = licences.map((l) => ({ 'Lic #': l[0], 'Product / SKU': l[1], Publisher: l[2], 'Used By App': l[3], Seats: l[4], 'Can Transfer?': l[5], 'Contract Holder': l[6], 'Annual Fee': `₹${l[7].toLocaleString('en-US')}`, 'Renewal Date': l[8] }));
writeCsv('04_Licence_Register.csv', ['Lic #', 'Product / SKU', 'Publisher', 'Used By App', 'Seats', 'Can Transfer?', 'Contract Holder', 'Annual Fee', 'Renewal Date'], licRows);

// ---------- 05 User accounts (identity — contains personal data) ----------
const first = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Neha', 'Arjun', 'Kavya', 'Rahul', 'Isha', 'Marco', 'Sophie', 'Daniel', 'Aisha', 'Ana', 'James', 'Mei', 'Jen', 'Tom', 'Lena', 'Carlos', 'Sarah', 'Wei', 'Siti', 'Hafiz', 'Nurul', 'Kumar', 'Lakshmi', 'Omar', 'Grace'];
const last = ['Nair', 'Sharma', 'Iyer', 'Rao', 'Patel', 'Joshi', 'Mehta', 'Lee', 'Martin', 'Wong', 'Khan', 'Silva', 'Cole', 'Lin', 'Park', 'Becker', 'Fischer', 'Ruiz', "O'Neil", 'Tan', 'Lim', 'Abdullah', 'Rahman', 'Chen', 'Gupta'];
const roles = [
  ['Design engineer', 'Pune', 9], ['Layout engineer', 'Pune', 4], ['Verification engineer', 'Pune', 4], ['Test engineer', 'Penang', 4], ['Product engineer', 'Penang', 2],
  ['Finance analyst', 'Austin', 2], ['Sales manager', 'Austin', 2], ['Field applications engineer', 'Austin', 2], ['IT administrator', 'Pune', 1], ['HR partner', 'Pune', 1], ['Supply planner', 'Austin', 1], ['Programme manager', 'Austin', 1],
];
const weightTotal = roles.reduce((s, r) => s + r[2], 0);
function weightedRole() {
  let x = rnd() * weightTotal;
  for (const r of roles) { x -= r[2]; if (x <= 0) return r; }
  return roles[0];
}
const idRows = [];
for (let i = 1; i <= 340; i++) {
  const f = pick(first), l = pick(last);
  const [role, site] = weightedRole();
  idRows.push({
    'Full Name': `${f} ${l}`,
    'Email Address': `${f}.${l}`.toLowerCase().replace(/[^a-z.]/g, '') + `${i}@semicorp.example`,
    'Job Role': role,
    Office: site,
    Department: role.includes('engineer') ? 'Engineering' : role.includes('Finance') ? 'Finance' : role.includes('Sales') || role.includes('Field') ? 'Sales' : 'Operations',
    'Laptop Asset': `LT-${pad(i + 4000, 5)}`,
    'MFA Enabled': rnd() < 0.93 ? 'Y' : 'N',
    'Access Groups': pick(['ENG-ALL;EDA-USERS', 'ENG-ALL', 'FIN-ALL;ERP-USERS', 'SALES-ALL;CRM-USERS', 'ALL-STAFF']),
    'Account Last Login': isoDaysBefore(AS_OF, rnd() < 0.05 ? int(190, 400) : int(0, 40)),
  });
}
writeCsv('05_User_Accounts.csv', ['Full Name', 'Email Address', 'Job Role', 'Office', 'Department', 'Laptop Asset', 'MFA Enabled', 'Access Groups', 'Account Last Login'], idRows);

// ---------- 06 Moving employees (HR — contains personal data) ----------
const hrRows = [];
for (let i = 1; i <= 186; i++) {
  const f = pick(first), l = pick(last);
  const [role, site] = weightedRole();
  hrRows.push({
    'Employee Name': `${f} ${l}`,
    'Work Email': `${f[0]}${l}`.toLowerCase().replace(/[^a-z]/g, '') + `.${i}@semicorp.example`,
    'Employee No': `E${pad(70000 + i, 6)}`,
    Designation: role,
    'Base Location': site,
    'Transfer Type': rnd() < 0.9 ? 'Moving to ChipCo' : 'Retained by seller',
    'Transfer Effective': '2025-11-15',
    'Needs Laptop Reimage': rnd() < 0.8 ? 'Yes' : 'No',
  });
}
writeCsv('06_Moving_Employees_HR.csv', ['Employee Name', 'Work Email', 'Employee No', 'Designation', 'Base Location', 'Transfer Type', 'Transfer Effective', 'Needs Laptop Reimage'], hrRows);

// ---------- 07 Cost register ----------
const costRows = apps.map((a, i) => ({ 'Cost Line': `RUN-${pad(i + 1)}`, System: a[0], 'Cost Type': 'Annual run', Description: `${a[1]} annual run cost`, 'Amount (₹)': a[10], 'Who Caused It': '', 'Like-for-like?': '', 'Contract Says': '', Status: 'Agreed' }));
costRows.push(
  { 'Cost Line': 'SEP-001', System: 'APP-001', 'Cost Type': 'Separation (one-time)', Description: 'Moving licences to ChipCo', 'Amount (₹)': 600000, 'Who Caused It': 'Seller', 'Like-for-like?': 'Like-for-like', 'Contract Says': '', Status: 'Agreed' },
  { 'Cost Line': 'SEP-002', System: 'APP-001', 'Cost Type': 'Separation (one-time)', Description: 'Copies of engineering equipment', 'Amount (₹)': 700000, 'Who Caused It': 'Seller', 'Like-for-like?': 'Partly', 'Contract Says': '', Status: 'Disputed' },
  { 'Cost Line': 'SEP-003', System: 'APP-021', 'Cost Type': 'Separation (one-time)', Description: 'Faster equipment ChipCo asked for', 'Amount (₹)': 440000, 'Who Caused It': 'Buyer', 'Like-for-like?': 'Upgrade', 'Contract Says': '', Status: 'Agreed' },
);
writeCsv('07_Cost_Register.csv', ['Cost Line', 'System', 'Cost Type', 'Description', 'Amount (₹)', 'Who Caused It', 'Like-for-like?', 'Contract Says', 'Status'], costRows);

// ---------- 08 TSA schedule ----------
const tsa = [
  ['TSA-01', 'Licence server', 'SemiCorp', 30000, '2025-11-15', '2025-12-15', 'Rahul Mehta', 'APP-017', 10, 7, '2025-10-01'],
  ['TSA-02', 'Email service', 'SemiCorp', 25000, '2025-11-15', '2026-01-15', 'Jen Park', 'APP-013', 16, 5, '2025-09-15'],
  ['TSA-03', 'Shared network', 'SemiCorp', 15000, '2025-11-15', '2026-01-31', 'Daniel Wong', 'NET-5', 15, 8, '2025-10-01'],
  ['TSA-04', 'Finance ERP', 'SemiCorp', 20000, '2025-11-15', '2026-02-28', 'Aisha Khan', 'APP-004', 20, 7, '2025-10-15'],
];
writeCsv('08_TSA_Schedule.csv', ['TSA Ref', 'Service', 'Provider', 'Monthly Fee (₹)', 'Service Start', 'Target Exit', 'Owner', 'Linked System', 'Exit Milestones', 'Milestones Done', 'Exit Prep Start'], tsa.map((t) => ({ 'TSA Ref': t[0], Service: t[1], Provider: t[2], 'Monthly Fee (₹)': t[3], 'Service Start': t[4], 'Target Exit': t[5], Owner: t[6], 'Linked System': t[7], 'Exit Milestones': t[8], 'Milestones Done': t[9], 'Exit Prep Start': t[10] })));

// ---------- 09 Finance ERP master data (wave gate) ----------
const erpRows = [];
const ccy = ['USD', 'USD', 'USD', 'MYR', 'INR'];
for (let i = 1; i <= 126; i++) {
  const row = {
    'Vendor ID': `V${pad(i + 1000, 5)}`,
    'Vendor Name': `${pick(['Apex', 'Nova', 'Delta', 'Prime', 'Vertex', 'Orion', 'Summit', 'Bright', 'Core', 'Atlas'])} ${pick(['Components', 'Logistics', 'Services', 'Materials', 'Systems', 'Labs', 'Packaging', 'Metals'])} ${pick(['Ltd', 'Inc', 'Sdn Bhd', 'Pvt Ltd', 'LLC'])}`,
    'GL Account': `${pick([5100, 5200, 5300, 6100, 6400])}-${int(10, 99)}`,
    'Cost Centre': pick(['CC-ENG-PUN', 'CC-TST-PEN', 'CC-SAL-AUS', 'CC-FIN-AUS', 'CC-OPS-AUS']),
    Currency: pick(ccy),
    'Payment Terms': pick(['NET30', 'NET45', 'NET60']),
    'Legal Entity': 'SemiCorp Design Unit',
    'Last Updated': isoDaysBefore(AS_OF, int(5, 160)),
  };
  const r = rnd();
  if (r < 0.06) row['Cost Centre'] = '';
  else if (r < 0.10) row.Currency = '';
  else if (r < 0.14) row['Last Updated'] = isoDaysBefore(AS_OF, int(220, 700));
  erpRows.push(row);
}
for (let k = 0; k < 4; k++) erpRows.push({ ...erpRows[int(0, 120)] });
writeCsv('09_Finance_ERP_Master_Data.csv', ['Vendor ID', 'Vendor Name', 'GL Account', 'Cost Centre', 'Currency', 'Payment Terms', 'Legal Entity', 'Last Updated'], erpRows);

// ---------- 10 Task tracker ----------
const people = {
  Infrastructure: ['Sophie Martin', 'Tom Becker', 'Hafiz Rahman'],
  Applications: ['Marco Lee', 'Neha Joshi', 'Wei Chen'],
  Network: ['Daniel Wong', 'Carlos Ruiz'],
  'Identity & Security': ['Lena Fischer', 'Arjun Iyer'],
  Licences: ['Priya Nair', 'Rahul Mehta'],
  People: ['Ana Silva', 'Grace Tan'],
  'TSA Services': ['Jen Park', 'Rahul Mehta', 'Daniel Wong'],
  'Finance & Costs': ['Aisha Khan', 'James Cole', 'Mei Lin'],
};
const wsPlan = {
  // total, done
  Infrastructure: [40, 35], Applications: [50, 41], Network: [38, 30], 'Identity & Security': [34, 26],
  Licences: [20, 14], People: [34, 31], 'TSA Services': [44, 37], 'Finance & Costs': [52, 38],
};
// Fixed, story-critical tasks (linked to Day-1 critical items)
const keyTasks = [
  ['Secure EDA Corp licence consent for CircuitDesign Pro', 'Licences', 'Priya Nair', '2025-11-06', 'Blocked', 'P0', 'APP-001'],
  ['Complete CircuitDesign Pro failover test', 'Applications', 'Marco Lee', '2025-11-07', 'In progress', 'P0', 'APP-001'],
  ['Remediate Finance ERP vendor master data gaps', 'Finance & Costs', 'Aisha Khan', '2025-11-08', 'At risk', 'P1', 'APP-004'],
  ['Validate NET-3 firewall rules for Pune engineering', 'Network', 'Daniel Wong', '2025-11-09', 'In progress', 'P1', 'APP-015'],
  ['Approve laptop migration option', 'Infrastructure', 'Sophie Martin', '2025-11-04', 'Review', 'P1', 'APP-016'],
  ['Confirm Wave 0 cutover roster', 'People', 'Ana Silva', '2025-11-10', 'Not started', 'P2', ''],
  ['Transfer L-42 layout verification seats', 'Licences', 'Priya Nair', '2025-11-09', 'Not started', 'P0', 'APP-001'],
  ['Re-host CircuitDesign Pro licence keys on ChipCo licence server', 'Licences', 'Rahul Mehta', '2025-11-09', 'Not started', 'P0', 'APP-001'],
  ['Clone CircuitDesign Pro runtime to ChipCo Pune DC', 'Applications', 'Marco Lee', '2025-11-03', 'Done', 'P0', 'APP-001'],
  ['Configure conditional access policies for ChipCo tenant', 'Identity & Security', 'Lena Fischer', '2025-11-08', 'In progress', 'P1', 'APP-014'],
  ['Order Tracker production cut-over rehearsal', 'Applications', 'Neha Joshi', '2025-11-12', 'In progress', 'P1', 'APP-005'],
  ['Simulation solver pack licence consent (L-41)', 'Licences', 'Priya Nair', '2025-11-07', 'At risk', 'P1', 'APP-021'],
];
// Items that each Day-1 critical system needs, with done counts
const itemTaskPlan = {
  'APP-001': [['Licences', 0], ['Applications', 0]], // handled by key tasks + extras below
};
void itemTaskPlan;
const verbs = ['Document', 'Validate', 'Migrate', 'Configure', 'Test', 'Decommission', 'Back up', 'Reconcile', 'Approve', 'Hand over', 'Map', 'Patch', 'Review'];
const objects = {
  Infrastructure: ['Pune DC rack allocation', 'backup schedule', 'server build standard', 'storage replication', 'laptop image v2', 'monitoring agents', 'DR runbook', 'print services', 'hypervisor cluster'],
  Applications: ['application runbook', 'interface catalogue', 'batch job schedule', 'service accounts', 'release calendar', 'app health checks', 'smoke test pack', 'database copy'],
  Network: ['WAN circuit order', 'IP address plan', 'DNS zones', 'firewall rule base', 'site-to-site VPN', 'Wi-Fi SSIDs', 'load balancer VIPs'],
  'Identity & Security': ['privileged access list', 'MFA enrolment', 'SSO federation', 'security groups', 'EDR policy', 'certificate inventory', 'joiner-mover-leaver flow'],
  Licences: ['licence entitlement report', 'vendor consent letter', 'seat true-up', 'licence key escrow', 'renewal calendar'],
  People: ['employee transfer letters', 'org chart', 'payroll cut-over file', 'access request forms', 'Day-1 comms pack', 'training schedule'],
  'TSA Services': ['TSA service catalogue', 'service level schedule', 'TSA invoice template', 'exit plan', 'governance calendar', 'escalation matrix'],
  'Finance & Costs': ['chart of accounts mapping', 'opening balances', 'intercompany settlement', 'bank account set-up', 'cost allocation workbook', 'vendor bank details', 'tax registrations'],
};
const critItems = {
  // item id -> [workstream, total tasks, done tasks]
  'APP-002': ['Applications', 6, 4], 'APP-003': ['Applications', 5, 5], 'APP-004': ['Finance & Costs', 9, 6], 'APP-005': ['Applications', 6, 4],
  'APP-006': ['Applications', 5, 5], 'APP-007': ['Applications', 5, 5], 'APP-013': ['Infrastructure', 7, 6], 'APP-014': ['Identity & Security', 6, 4],
  'APP-015': ['Network', 6, 3], 'APP-016': ['Identity & Security', 5, 3], 'APP-017': ['Licences', 4, 4], 'APP-027': ['Applications', 5, 5], 'APP-018': ['Finance & Costs', 4, 4],
};
const appName = Object.fromEntries(apps.map((a) => [a[0], a[1]]));
const tasks = [];
let tid = 118;
const usedPerWs = Object.fromEntries(Object.keys(wsPlan).map((w) => [w, { total: 0, done: 0 }]));
for (const k of keyTasks) {
  tasks.push({ id: `TSK-${pad(tid++)}`, title: k[0], ws: k[1], owner: k[2], due: k[3], status: k[4], pri: k[5], item: k[6] });
  usedPerWs[k[1]].total++;
}
// CircuitDesign Pro: 8 tasks total, 4 done. 4 open already in keyTasks (consent, failover, L-42, rehost, clone) -> 5 open. Add 3 done.
for (const t of ['Inventory CircuitDesign Pro design libraries', 'Size ChipCo hardware for CircuitDesign Pro', 'Confirm CircuitDesign Pro user list (120 seats)']) {
  tasks.push({ id: `TSK-${pad(tid++)}`, title: t, ws: 'Applications', owner: 'Marco Lee', due: isoDaysBefore(AS_OF, int(3, 20)), status: 'Done', pri: 'P0', item: 'APP-001' });
  usedPerWs.Applications.total++; usedPerWs.Applications.done++;
}
for (const [item, [ws, total, done]] of Object.entries(critItems)) {
  const existing = tasks.filter((t) => t.item === item).length;
  const doneAlready = tasks.filter((t) => t.item === item && t.status === 'Done').length;
  const openAlready = existing - doneAlready;
  for (let i = existing; i < total; i++) {
    const isDone = i - existing < done - doneAlready - Math.max(0, openAlready - (total - done));
    tasks.push({
      id: `TSK-${pad(tid++)}`,
      title: `${pick(verbs)} ${appName[item]} ${pick(['cut-over plan', 'data copy', 'access model', 'integration test', 'runbook', 'support handover', 'licence check', 'monitoring'])}`,
      ws, owner: pick(people[ws]),
      due: isDone ? isoDaysBefore(AS_OF, int(1, 25)) : isoDaysBefore(AS_OF, -int(2, 9)),
      status: isDone ? 'Done' : pick(['In progress', 'In progress', 'Review']),
      pri: 'P1', item,
    });
    usedPerWs[ws].total++; if (isDone) usedPerWs[ws].done++;
  }
}
for (const [ws, [total, done]] of Object.entries(wsPlan)) {
  const u = usedPerWs[ws];
  const needDone = Math.max(0, done - u.done);
  const remaining = total - u.total;
  for (let i = 0; i < remaining; i++) {
    const isDone = i < needDone;
    let status = 'Done';
    if (!isDone) status = pick(['In progress', 'In progress', 'In progress', 'Not started', 'Not started', 'Review']);
    tasks.push({
      id: `TSK-${pad(tid++)}`,
      title: `${pick(verbs)} ${pick(objects[ws])}`,
      ws, owner: pick(people[ws]),
      due: isDone ? isoDaysBefore(AS_OF, int(1, 60)) : isoDaysBefore(AS_OF, -int(1, 40)),
      status, pri: isDone ? pick(['P1', 'P2', 'P2', 'P3']) : pick(['P1', 'P2', 'P2', 'P3']), item: '',
    });
  }
}
// a couple more 'At risk' items in non-critical scope for the early warning list
let flipped = 0;
for (const t of tasks) {
  if (flipped >= 2) break;
  if (!t.item && t.status === 'Not started' && (t.ws === 'Finance & Costs' || t.ws === 'Identity & Security')) { t.status = 'At risk'; flipped++; }
}
writeCsv('10_Task_Tracker.csv', ['Task ID', 'Task', 'Workstream', 'Owner', 'Due Date', 'Status', 'Priority', 'Linked Item'], tasks.map((t) => ({ 'Task ID': t.id, Task: t.title, Workstream: t.ws, Owner: t.owner, 'Due Date': t.due, Status: t.status, Priority: t.pri, 'Linked Item': t.item })));

// ---------- 11 Test results ----------
const testPlan = {
  'APP-001': [5, 2], 'APP-002': [3, 3], 'APP-003': [3, 3], 'APP-004': [4, 4], 'APP-005': [4, 4], 'APP-006': [3, 3], 'APP-007': [3, 3],
  'APP-013': [4, 4], 'APP-014': [4, 3], 'APP-015': [3, 2], 'APP-016': [3, 3], 'APP-017': [2, 2], 'APP-027': [3, 3], 'APP-018': [3, 3],
};
const testNames = ['Login and SSO', 'Core transaction end-to-end', 'Interface to downstream', 'Performance under load', 'Backup and restore', 'Licence check-out', 'Failover'];
const tests = [];
let tn = 1;
for (const [item, [total, passed]] of Object.entries(testPlan)) {
  for (let i = 0; i < total; i++) {
    let result = i < passed ? 'Passed' : 'Failed';
    if (item === 'APP-015' && i >= passed) result = 'Not run';
    tests.push({ 'Test ID': `TST-${pad(tn++)}`, System: item, 'Test Case': `${appName[item]} — ${testNames[i % testNames.length]}`, Result: result, 'Run Date': result === 'Not run' ? '' : isoDaysBefore(AS_OF, int(0, 6)), Tester: pick(['Marco Lee', 'Neha Joshi', 'Wei Chen', 'Lena Fischer', 'Daniel Wong']) });
  }
}
writeCsv('11_Test_Results.csv', ['Test ID', 'System', 'Test Case', 'Result', 'Run Date', 'Tester'], tests);

// ---------- 12 Owner questionnaire ----------
const q = [
  ['APP-001', 'Marco Lee', 'APP-002', 'APP-022; APP-021', 'Yes - seller licence server (APP-017) issues our EDA seats', 'All chip design work stops; tape-out schedule slips'],
  ['APP-002', 'Marco Lee', '', 'APP-001', 'No', 'Engineers cannot check in or retrieve layouts'],
  ['APP-003', 'Wei Chen', 'APP-020', '', 'No', 'Wafer test data is not captured; lots cannot ship'],
  ['APP-004', 'Aisha Khan', '', 'APP-018; APP-019; APP-025; APP-005', 'Yes - runs on seller ERP instance', 'Cannot invoice customers or close the month'],
  ['APP-005', 'Neha Joshi', 'APP-004', 'APP-027; APP-006', 'No', 'Orders cannot be confirmed or shipped'],
  ['APP-006', 'Neha Joshi', 'APP-005', 'APP-007', 'No', 'Customers lose self-service quotes and order status'],
  ['APP-007', 'Tom Becker', 'APP-006', '', 'Yes - product master is shared with seller', 'New products cannot be registered for sale'],
  ['APP-008', 'Grace Tan', '', '', 'No', 'Employees cannot apply for leave'],
  ['APP-011', 'Marco Lee', '', '', 'Not sure', 'Not sure'],
  ['APP-013', 'Jen Park', '', 'APP-014', 'Yes - seller mail tenant', 'No email for 340 staff'],
  ['APP-014', 'Lena Fischer', 'APP-013; APP-015; APP-016', '', 'Yes - seller directory forest', 'Nobody can log in'],
  ['APP-017', 'Rahul Mehta', 'APP-001; APP-021', '', 'Yes - seller-owned licence server', 'EDA tools refuse to start'],
  ['APP-020', 'Wei Chen', '', 'APP-003', 'No', 'Yield reports stop'],
  ['APP-027', 'Neha Joshi', 'APP-005', '', 'No', 'Sales pipeline and quoting stop'],
];
writeCsv('12_Owner_Questionnaire.csv', ['App ID', 'Answered By', 'Q1 Sends data to', 'Q1 Gets data from', 'Q2 Uses anything owned by the seller?', 'Q3 What breaks if switched off?'], q.map((r) => ({ 'App ID': r[0], 'Answered By': r[1], 'Q1 Sends data to': r[2], 'Q1 Gets data from': r[3], 'Q2 Uses anything owned by the seller?': r[4], 'Q3 What breaks if switched off?': r[5] })));

// ---------- 13 Product revenue (blocked products) ----------
const products = [
  ['T-200 Timing Chip', 'USA', 4000000, 'APP-007', 'Blocked'],
  ['T-200 Timing Chip', 'Germany', 1600000, 'APP-007', 'Blocked'],
  ['P-410 Power Manager', 'USA', 2600000, 'APP-007', 'Blocked'],
  ['P-410 Power Manager', 'Japan', 1900000, 'APP-007', 'Blocked'],
  ['R-77 RF Front-End', 'India', 900000, 'APP-007', 'Blocked'],
  ['R-77 RF Front-End', 'Malaysia', 650000, 'APP-007', 'Registered'],
  ['S-12 Sensor Hub', 'USA', 1200000, 'APP-005', 'Blocked'],
  ['S-12 Sensor Hub', 'South Korea', 800000, 'APP-005', 'Blocked'],
  ['C-900 Clock Generator', 'China', 2100000, 'APP-007', 'Blocked'],
  ['C-900 Clock Generator', 'USA', 1400000, 'APP-007', 'Registered'],
  ['M-55 Motor Driver', 'Germany', 700000, 'APP-027', 'Blocked'],
  ['M-55 Motor Driver', 'Mexico', 300000, 'APP-027', 'Blocked'],
  ['A-3 Audio Codec', 'Japan', 450000, 'APP-006', 'Blocked'],
  ['A-3 Audio Codec', 'USA', 520000, 'APP-006', 'Registered'],
  ['T-210 Timing Chip (auto grade)', 'Germany', 1100000, 'APP-007', 'Blocked'],
  ['P-420 Power Manager', 'India', 380000, 'APP-007', 'Blocked'],
];
writeCsv('13_Product_Revenue.csv', ['Product', 'Country', 'Quarterly Revenue (₹)', 'Blocked By System', 'Registration Status'], products.map((p) => ({ Product: p[0], Country: p[1], 'Quarterly Revenue (₹)': p[2], 'Blocked By System': p[3], 'Registration Status': p[4] })));

// ---------- 14 Prowess financial health ----------
const fin = [
  ['ChipCo Ltd', 'Buyer', 820, 96, 31, 540, 38, 1.9, 2.1, 0.92],
  ['SemiCorp Inc', 'Seller', 4300, 860, 410, 900, 1250, 0.35, 11.4, 1.8],
  ['EDA Corp', 'Vendor', 2100, 520, 300, 300, 640, 0.25, 18.0, 2.2],
];
writeCsv('14_Prowess_Financials.csv', ['Company', 'Deal Role', 'Revenue (₹ M)', 'EBITDA (₹ M)', 'Net Profit (₹ M)', 'Total Debt (₹ M)', 'Cash (₹ M)', 'Debt / Equity', 'Interest Coverage (x)', 'Current Ratio'], fin.map((f) => ({ Company: f[0], 'Deal Role': f[1], 'Revenue (₹ M)': f[2], 'EBITDA (₹ M)': f[3], 'Net Profit (₹ M)': f[4], 'Total Debt (₹ M)': f[5], 'Cash (₹ M)': f[6], 'Debt / Equity': f[7], 'Interest Coverage (x)': f[8], 'Current Ratio': f[9] })));

// ---------- 15 Prospect universe (Prowess style) ----------
const sectors = ['Electronics', 'Industrial', 'Chemicals', 'Auto components', 'Pharma', 'Consumer', 'Telecom equipment', 'Software', 'Metals', 'Engineering'];
const prefixes = ['Alpha', 'Beacon', 'Crescent', 'Dynamo', 'Eastern', 'Falcon', 'Granite', 'Horizon', 'Indus', 'Jupiter', 'Kestrel', 'Lotus', 'Meridian', 'Northstar', 'Orbit', 'Pinnacle', 'Quantum', 'Riverstone', 'Sapphire', 'Titan', 'Unity', 'Vantage', 'Westfield', 'Xenon', 'Yarrow', 'Zenith', 'Arcadia', 'Bluewater', 'Coral', 'Delphi', 'Evergreen', 'Fortis', 'Galaxy', 'Harbor', 'Ironclad', 'Jasper', 'Keystone', 'Luminar', 'Monarch', 'Nimbus'];
const prospects = prefixes.map((p, i) => {
  if (p === 'Alpha') return { Company: 'Alpha Industries', Sector: 'Electronics', 'Business Segments': 6, 'Loss-making Segment': 'Electronics unit', 'Revenue (₹ M)': 2400, 'Debt / Equity': 2.3, 'EBITDA Margin Trend': 'Declining', 'Strategic Review Announced': 'No', 'Promoter Pledge %': 18 };
  const segs = int(1, 7);
  return {
    Company: `${p} ${pick(['Industries', 'Holdings', 'Technologies', 'Group', 'Enterprises', 'Corp'])}`,
    Sector: pick(sectors),
    'Business Segments': segs,
    'Loss-making Segment': rnd() < 0.35 && segs > 1 ? `${pick(['Electronics', 'Retail', 'Chemicals', 'Services', 'Components', 'Export'])} unit` : '',
    'Revenue (₹ M)': int(150, 6000),
    'Debt / Equity': Math.round(rnd() * 300) / 100,
    'EBITDA Margin Trend': pick(['Improving', 'Stable', 'Stable', 'Declining']),
    'Strategic Review Announced': rnd() < 0.12 ? 'Yes' : 'No',
    'Promoter Pledge %': int(0, 40),
  };
});
writeCsv('15_Prospect_Universe.csv', ['Company', 'Sector', 'Business Segments', 'Loss-making Segment', 'Revenue (₹ M)', 'Debt / Equity', 'EBITDA Margin Trend', 'Strategic Review Announced', 'Promoter Pledge %'], prospects);

// ---------- 16 Past learning records (anonymised) ----------
const industries = [['Semiconductor', 8], ['Electronics', 4], ['Software', 4], ['Pharma', 2], ['Auto components', 2]];
const records = [];
let rid = 1;
// licence consent requested in week 1 -> 9 of 10 on time; later -> 5 of 10 on time
const consentPlan = [...Array(10).fill(true), ...Array(10).fill(false)];
const lessonsBank = {
  Semiconductor: ['Request licence consent from design-tool vendors in week 1.', 'Clone EDA environments rather than rebuilding them before Day-1.', 'Map licence servers early — every EDA tool depends on them.', 'Register products in the buyer catalogue before Day-1 to avoid blocked revenue.'],
  Electronics: ['Ring-fence shared MES instances behind a TSA.', 'Freeze ERP master data two weeks before cut-over.', 'Image laptops in phases by site.'],
  Software: ['Split identity tenants before moving email.', 'Treat CI/CD pipelines as Day-1 critical.', 'Agree source-code escrow up front.'],
  Pharma: ['Validate GxP systems before any infrastructure move.', 'Keep regulatory submission systems on TSA until revalidated.'],
  'Auto components': ['Protect EDI links to OEM customers on Day-1.', 'Sequence plant networks after ERP.'],
};
let ci = 0;
for (const [ind, n] of industries) {
  for (let i = 0; i < n; i++) {
    const week1 = consentPlan[ci];
    const onTime = week1 ? ci !== 3 : ci % 2 === 0;
    ci++;
    const appsBand = pick(['20-50 apps', '50-100 apps', '100-200 apps', '200+ apps']);
    records.push({
      id: `${ind.slice(0, 4).toUpperCase().replace(/\s/g, '')}-${pad(rid++, 2)}`,
      industry: ind,
      dealType: pick(['Carve-out', 'Carve-out', 'Divestiture', 'Acquisition', 'Merger']),
      sizeBand: pick(['₹1M to ₹2M separation budget', '₹2M to ₹5M separation budget', '₹5M to ₹10M separation budget']),
      appsBand,
      sites: int(1, 6),
      day1OnTime: onTime,
      tsaExtended: !onTime || rnd() < 0.15,
      tsaMonths: int(3, 12),
      licenceConsentWeek1: week1,
      whatWorked: pick(['Single tracker across workstreams', 'Daily readiness stand-up', 'Early owner questionnaire', 'Clone-and-go for engineering tools', 'Escrow for disputed costs']),
      whatDidNot: pick(['Late vendor consent', 'Stale network inventory', 'Hidden link to seller file server', 'ERP data not ready for wave', 'Cost dispute held up equipment orders']),
      keyLesson: pick(lessonsBank[ind]),
      consent: true,
      approvedBy: 'Data steward',
    });
  }
}
// Make the semiconductor carve-out SEMI-03 the closest analogue
records[2] = { ...records[2], id: 'SEMI-03', industry: 'Semiconductor', dealType: 'Carve-out', appsBand: '20-50 apps', sizeBand: '₹1M to ₹2M separation budget', day1OnTime: true, licenceConsentWeek1: true, keyLesson: 'Licence consent from EDA vendors took 5 weeks — start in week 1 and escalate through the buyer CIO.', whatDidNot: 'Late vendor consent' };
fs.writeFileSync(path.join(OUT, '16_Past_Learning_Records.json'), JSON.stringify({ description: 'Anonymised, human-approved DealSync Learning Records (client consent on file). Illustrative.', records }, null, 2) + '\n');
console.log(`  ${'16_Past_Learning_Records.json'.padEnd(34)} ${records.length} records`);

// ---------- 17 Decision options ----------
const opts = [
  ['DEC-01', 'Laptop migration strategy (340 laptops)', 'CIO Steering Committee', '2025-11-04', 'A', 'Full rebuild first', 5, 2, 2, 2],
  ['DEC-01', 'Laptop migration strategy (340 laptops)', 'CIO Steering Committee', '2025-11-04', 'B', 'Move in phases', 4, 4, 3, 3],
  ['DEC-01', 'Laptop migration strategy (340 laptops)', 'CIO Steering Committee', '2025-11-04', 'C', 'Move now, secure later', 2, 5, 4, 5],
  ['DEC-02', 'Email cut-over approach', 'CIO Steering Committee', '2025-11-07', 'A', 'Big-bang tenant move on Day-1', 3, 3, 4, 4],
  ['DEC-02', 'Email cut-over approach', 'CIO Steering Committee', '2025-11-07', 'B', 'Keep seller mail under TSA, move in January', 4, 4, 3, 2],
  ['DEC-02', 'Email cut-over approach', 'CIO Steering Committee', '2025-11-07', 'C', 'Forward mail from seller tenant', 2, 3, 5, 5],
  ['DEC-03', 'Finance ERP separation path', 'CFO', '2025-11-06', 'A', 'Clone ERP instance now', 4, 3, 2, 2],
  ['DEC-03', 'Finance ERP separation path', 'CFO', '2025-11-06', 'B', 'TSA then migrate in Wave 2', 4, 4, 4, 3],
  ['DEC-03', 'Finance ERP separation path', 'CFO', '2025-11-06', 'C', 'Stand up new cloud ERP', 5, 2, 1, 1],
  ['DEC-04', 'Identity tenant split', 'CISO', '2025-11-08', 'A', 'New ChipCo tenant + B2B trust', 5, 3, 3, 3],
  ['DEC-04', 'Identity tenant split', 'CISO', '2025-11-08', 'B', 'Shared tenant with conditional access', 3, 5, 4, 4],
];
writeCsv('17_Decision_Options.csv', ['Decision ID', 'Decision', 'Approver', 'Due', 'Option', 'Option Name', 'Security (1-5)', 'Productivity (1-5)', 'Cost (1-5, 5 = cheapest)', 'Speed (1-5)'], opts.map((o) => ({ 'Decision ID': o[0], Decision: o[1], Approver: o[2], Due: o[3], Option: o[4], 'Option Name': o[5], 'Security (1-5)': o[6], 'Productivity (1-5)': o[7], 'Cost (1-5, 5 = cheapest)': o[8], 'Speed (1-5)': o[9] })));

// ---------- 18 SPA clause ----------
fs.writeFileSync(path.join(OUT, '18_SPA_Cost_Clauses.txt'), `SHARE PURCHASE AGREEMENT — EXTRACT (ILLUSTRATIVE)
Project Rioja · SemiCorp Inc ("Seller") and ChipCo Ltd ("Purchaser")

Clause 7.4 Separation Costs
(a) "Separation Costs" means all reasonable third-party costs incurred to separate the Business from the Seller's retained group, including the transfer of Transferred Licences and the replication of equipment used exclusively or predominantly by the Business.
(b) Separation Costs shall be shared equally between the Seller and the Purchaser.
(c) Notwithstanding paragraph (b), any Enhancement requested by the Purchaser shall be borne solely by the Purchaser. "Enhancement" means any upgrade, additional capacity or improved specification beyond like-for-like replacement.
(d) The Seller shall use reasonable endeavours to procure third-party consents required for the transfer of Transferred Licences, at the Seller's cost.

Clause 7.5 Disputes
Any amount of Separation Costs in dispute shall be paid into an escrow account held by an agreed bank pending resolution under Clause 19 (Expert Determination). Disputed amounts shall not delay the Completion Date.

Clause 9.2 Transitional Services
The Seller shall provide the Transitional Services set out in Schedule 6 for a period not exceeding six (6) months from Completion, at the monthly charges stated in Schedule 6. Any extension shall be charged at 125% of the stated monthly charge.
`);
console.log(`  ${'18_SPA_Cost_Clauses.txt'.padEnd(34)} text`);



// ---------- 19 Closing lessons (for Close & Learn demo) ----------
fs.writeFileSync(path.join(OUT, '19_Closing_Lessons_Rioja.txt'), `What worked: The single DealSync tracker replaced 9 separate spreadsheets, and the owner questionnaire surfaced the CircuitDesign Pro dependency on SemiCorp's licence server in week 2. Priya Nair's escalation through ChipCo's CIO unlocked EDA Corp consent on 6 Nov.
What did not work: The Finance ERP vendor master from SemiCorp scored 85 and held Wave 2 for three weeks. Email exit slipped against plan, costing an extra ₹25K per month.
Was Day-1 on time: Yes — Day-1 happened on 15 Nov 2025 with a readiness score of 96 (Go).
Was the TSA extended: Email service extended by one month; the other 3 services exited on time.
Key lesson: Ask EDA Corp and every design-tool vendor for licence consent in week 1; ChipCo's ₹1.74M separation budget and 415 tracked assets were manageable once consent was secured.
`);
console.log(`  ${'19_Closing_Lessons_Rioja.txt'.padEnd(34)} text`);
console.log('Done.');
