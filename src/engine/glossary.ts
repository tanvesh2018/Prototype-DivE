/**
 * DealSync Standard Glossary.
 *
 * Every uploaded file is mapped onto one of these datasets. The `synonyms`
 * drive the rule-based column matcher; Gemini uses the same glossary (with
 * descriptions) when AI column mapping is available.
 *
 * To add a new upload type: add a dataset here, add a sample file in
 * /sample-data, and (optionally) quality rules in engine/quality.ts.
 */

export type DatasetKey =
  | 'applications' | 'servers' | 'network' | 'licences' | 'identity' | 'people'
  | 'costs' | 'tsa' | 'erp' | 'tasks' | 'tests' | 'questionnaire' | 'products'
  | 'financials' | 'prospects' | 'learning' | 'decisions' | 'spa';

export type FieldType = 'string' | 'number' | 'date' | 'bool' | 'enum' | 'ref';

export interface FieldDef {
  key: string;
  label: string;
  description: string;
  required?: boolean;
  type?: FieldType;
  synonyms: string[];
  ref?: DatasetKey;
  pii?: boolean;
}

export interface DatasetDef {
  key: DatasetKey;
  label: string;
  component: string;
  description: string;
  sampleFile: string;
  /** Scored by the Data Hygiene gate (deal baseline files). */
  hygiene: boolean;
  idField?: string;
  nameField?: string;
  /** Where in the app this file is normally uploaded. */
  screen: string;
  fields: FieldDef[];
  filenameHints: string[];
  format: 'csv' | 'json' | 'text';
}

const f = (key: string, label: string, description: string, synonyms: string[], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, description, synonyms, ...extra });

export const DATASETS: DatasetDef[] = [
  {
    key: 'applications', label: 'Applications', component: 'Applications', format: 'csv', hygiene: true, idField: 'app_id', nameField: 'app_name',
    description: 'Application inventory: one row per system with hosting, licence, owner and risk attributes.', sampleFile: '01_Applications.csv', screen: 'Data & Inventory',
    filenameHints: ['app', 'application'],
    fields: [
      f('app_id', 'App ID', 'Unique application identifier like APP-001', ['app id', 'app ref', 'application id', 'app #', 'system id'], { required: true }),
      f('app_name', 'App name', 'Name of the application', ['application title', 'application name', 'app name', 'system name', 'name'], { required: true }),
      f('description', 'Function / description', 'What the application does', ['business function', 'description', 'function', 'purpose']),
      f('hosting_server_id', 'Hosting server', 'Server ID the app runs on (values look like SRV-14)', ['hosted on', 'server', 'host', 'server id', 'runs on'], { required: true, type: 'ref', ref: 'servers' }),
      f('network_id', 'Network segment', 'Network segment the app connects through (NET-x)', ['network zone', 'network', 'segment', 'vlan'], { type: 'ref', ref: 'network' }),
      f('licence_id', 'Licence', 'Licence reference (L-xx)', ['licence ref', 'license ref', 'licence', 'license', 'lic #']),
      f('owner_team', 'Owner team', 'Team that owns the application', ['biz owner team', 'owning team', 'owner', 'owner team', 'business owner', 'app owner'], { required: true }),
      f('vendor', 'Vendor', 'Software vendor', ['vendor', 'supplier', 'publisher'], { required: true }),
      f('user_count', 'Users', 'Number of users', ['no. of users', 'users', 'user count', 'headcount'], { type: 'number', required: true }),
      f('site', 'Site', 'Primary site / location', ['site', 'location', 'office'], { required: true }),
      f('annual_cost', 'Annual cost (₹)', 'Annual run cost', ['annual run cost', 'annual cost', 'cost', 'run cost'], { type: 'number' }),
      f('last_updated', 'Last updated', 'Date the record was last updated', ['last updated', 'updated', 'modified', 'last modified'], { type: 'date', required: true }),
      f('buyer_uses', 'Used by buyer', 'Does the buyer use this app after Day-1 (Yes/No)', ['used by buyer', 'retained by buyer', 'buyer uses', 'in scope'], { type: 'bool' }),
      f('licence_transferable', 'Licence transferable', 'Can the licence legally transfer/copy (Yes/No/Consent required/Unknown)', ['licence transferable', 'license transferable', 'can transfer', 'transferable']),
      f('go_live_year', 'Go-live year', 'Year the system went live', ['go-live year', 'go live', 'year implemented'], { type: 'number' }),
      f('critical_tool', 'Critical tool', 'Business cannot operate without it (Yes/No)', ['critical tool', 'critical'], { type: 'bool' }),
      f('revenue_linked', 'Revenue linked', 'Products or orders depend on it (Yes/No)', ['revenue linked', 'revenue'], { type: 'bool' }),
      f('criticality', 'Criticality (C)', 'Owner rated criticality 1-5', ['criticality', 'criticality (1-5)', 'c score'], { type: 'number' }),
      f('regulatory_risk', 'Regulatory risk (R)', 'Owner rated regulatory risk 1-5', ['regulatory risk', 'reg risk'], { type: 'number' }),
      f('security_risk', 'Security risk (S)', 'Owner rated security risk 1-5', ['security risk', 'sec risk'], { type: 'number' }),
      f('buyer_has_similar', 'Buyer has similar', 'Buyer already runs a similar system (Yes/No)', ['buyer has similar system', 'buyer has equivalent', 'similar system', 'duplicate capability'], { type: 'bool' }),
    ],
  },
  {
    key: 'servers', label: 'Servers', component: 'Infrastructure', format: 'csv', hygiene: true, idField: 'server_id', nameField: 'server_name',
    description: 'Server inventory with ownership and network placement.', sampleFile: '02_Server_Inventory.csv', screen: 'Data & Inventory', filenameHints: ['server', 'srv', 'host'],
    fields: [
      f('server_id', 'Server ID', 'Server identifier like SRV-14', ['server id', 'srv id', 'asset id'], { required: true }),
      f('server_name', 'Server name', 'Host name', ['host name', 'hostname', 'server name', 'name'], { required: true }),
      f('site', 'Site', 'Data centre or office location', ['location', 'data centre', 'data center', 'site', 'dc'], { required: true }),
      f('ownership', 'Ownership', 'Buyer / Shared / Seller after Day-1', ['owned by', 'owner', 'ownership'], { required: true }),
      f('os', 'Operating system', 'OS', ['operating system', 'os'], { required: true }),
      f('environment', 'Environment', 'Prod / Dev / Test', ['env', 'environment']),
      f('last_updated', 'Last updated', 'Last patched or updated', ['last patched / updated', 'last updated', 'last patched'], { type: 'date', required: true }),
      f('network_id', 'Network segment', 'Network segment', ['network segment', 'segment', 'network'], { type: 'ref', ref: 'network' }),
      f('vcpu', 'vCPU', 'CPU cores', ['vcpu', 'cpu', 'cores'], { type: 'number' }),
    ],
  },
  {
    key: 'network', label: 'Network assets', component: 'Network', format: 'csv', hygiene: true, idField: 'asset_id', nameField: 'asset_id',
    description: 'Network devices and links by segment.', sampleFile: '03_Network_Assets.csv', screen: 'Data & Inventory', filenameHints: ['network', 'net'],
    fields: [
      f('asset_id', 'Asset tag', 'Network device tag', ['asset tag', 'device id', 'tag'], { required: true }),
      f('device_type', 'Device type', 'Switch/router/firewall', ['device type', 'type'], { required: true }),
      f('network_id', 'Segment', 'Segment ID NET-x', ['segment', 'network id', 'vlan id'], { required: true }),
      f('segment_name', 'Segment name', 'Segment description', ['segment name', 'segment description', 'network name']),
      f('site', 'Site', 'Location', ['site/location', 'site', 'location'], { required: true }),
      f('ownership', 'Segment owner', 'Buyer / Shared / Seller', ['segment owner', 'owner', 'owned by'], { required: true }),
      f('mgmt_ip', 'Management IP', 'IP address', ['mgmt ip', 'ip', 'ip address']),
      f('last_updated', 'Last seen', 'Last seen on network', ['last seen', 'last updated'], { type: 'date', required: true }),
      f('status', 'Status', 'Active / Spare', ['status', 'state']),
    ],
  },
  {
    key: 'licences', label: 'Licences', component: 'Licences', format: 'csv', hygiene: true, idField: 'licence_id', nameField: 'product',
    description: 'Software licence register with transferability and contract holder.', sampleFile: '04_Licence_Register.csv', screen: 'Data & Inventory', filenameHints: ['licen', 'licens'],
    fields: [
      f('licence_id', 'Licence ID', 'Licence ref L-xx', ['lic #', 'licence id', 'license id', 'licence ref'], { required: true }),
      f('product', 'Product', 'Licensed product / SKU', ['product / sku', 'product', 'sku'], { required: true }),
      f('vendor', 'Vendor', 'Publisher', ['publisher', 'vendor'], { required: true }),
      f('app_id', 'Application', 'App that uses the licence', ['used by app', 'app id', 'application'], { required: true, type: 'ref', ref: 'applications' }),
      f('seats', 'Seats', 'Number of seats', ['seats', 'quantity'], { type: 'number' }),
      f('transferable', 'Transferable', 'Yes / No / Consent required', ['can transfer?', 'transferable', 'can transfer'], { required: true }),
      f('ownership', 'Contract holder', 'Buyer / Shared / Seller', ['contract holder', 'owner', 'holder'], { required: true }),
      f('annual_cost', 'Annual fee', 'Annual fee (₹)', ['annual fee', 'cost', 'annual cost'], { type: 'number' }),
      f('renewal_date', 'Renewal date', 'Renewal / expiry date', ['renewal date', 'expiry', 'expiry date'], { type: 'date', required: true }),
    ],
  },
  {
    key: 'identity', label: 'User accounts', component: 'Identity & security', format: 'csv', hygiene: true, nameField: 'role',
    description: 'User accounts and access. Names and emails are masked at upload into role/site counts.', sampleFile: '05_User_Accounts.csv', screen: 'Data & Inventory', filenameHints: ['user', 'account', 'identity'],
    fields: [
      f('user_name', 'User name', 'Person name (PII — masked)', ['full name', 'user name', 'name', 'display name'], { pii: true }),
      f('email', 'Email', 'Email (PII — masked)', ['email address', 'email', 'upn', 'mail'], { pii: true }),
      f('role', 'Role', 'Job role', ['job role', 'role', 'title', 'designation'], { required: true }),
      f('site', 'Site', 'Office', ['office', 'site', 'location'], { required: true }),
      f('department', 'Department', 'Department', ['department', 'business unit', 'dept']),
      f('laptop_id', 'Laptop', 'Laptop asset tag', ['laptop asset', 'laptop', 'device']),
      f('mfa_enabled', 'MFA enabled', 'Y/N', ['mfa enabled', 'mfa'], { type: 'bool' }),
      f('access_groups', 'Access groups', 'Groups', ['access groups', 'groups']),
      f('last_updated', 'Last login', 'Last login date', ['account last login', 'last login', 'last logon'], { type: 'date' }),
    ],
  },
  {
    key: 'people', label: 'Moving employees', component: 'People', format: 'csv', hygiene: true, nameField: 'role',
    description: 'HR list of employees moving to the buyer. Personal data is masked at upload.', sampleFile: '06_Moving_Employees_HR.csv', screen: 'Data & Inventory', filenameHints: ['employee', 'hr', 'people', 'moving'],
    fields: [
      f('employee_name', 'Employee name', 'PII — masked', ['employee name', 'name'], { pii: true }),
      f('email', 'Email', 'PII — masked', ['work email', 'email'], { pii: true }),
      f('employee_id', 'Employee number', 'PII — masked', ['employee no', 'employee id', 'staff id', 'emp no'], { pii: true }),
      f('role', 'Role', 'Designation', ['designation', 'role', 'job title'], { required: true }),
      f('site', 'Site', 'Base location', ['base location', 'site', 'location'], { required: true }),
      f('transfer_type', 'Transfer type', 'Moving / retained', ['transfer type', 'conveyance', 'moving'], { required: true }),
      f('transfer_date', 'Transfer date', 'Effective date', ['transfer effective', 'effective date'], { type: 'date' }),
      f('needs_reimage', 'Needs laptop reimage', 'Yes/No', ['needs laptop reimage', 'device re-image', 'reimage'], { type: 'bool' }),
    ],
  },
  {
    key: 'costs', label: 'Cost register', component: 'Finance', format: 'csv', hygiene: true, idField: 'cost_id', nameField: 'description',
    description: 'Run cost per system plus one-time separation cost lines with the 3-question split inputs.', sampleFile: '07_Cost_Register.csv', screen: 'Funding & TSA Exit', filenameHints: ['cost'],
    fields: [
      f('cost_id', 'Cost line', 'Cost line ID', ['cost line', 'cost id', 'line'], { required: true }),
      f('app_id', 'System', 'App ID', ['system', 'app id', 'application'], { type: 'ref', ref: 'applications' }),
      f('cost_type', 'Cost type', 'Annual run / Separation (one-time)', ['cost type', 'type'], { required: true }),
      f('description', 'Description', 'What the cost is', ['description', 'item'], { required: true }),
      f('amount', 'Amount (₹)', 'Amount', ['amount (usd)', 'amount', 'value', 'amount (₹)'], { type: 'number', required: true }),
      f('cause', 'Who caused it', 'Seller / Shared / Buyer', ['who caused it', 'cause']),
      f('like_for_like', 'Like-for-like?', 'Like-for-like / Partly / Upgrade', ['like-for-like?', 'like for like']),
      f('contract', 'Contract says', 'Seller / Shared / Buyer per SPA', ['contract says', 'contract', 'spa']),
      f('status', 'Status', 'Agreed / Disputed', ['status'], { required: true }),
    ],
  },
  {
    key: 'tsa', label: 'TSA schedule', component: 'TSA services', format: 'csv', hygiene: true, idField: 'tsa_id', nameField: 'service',
    description: 'Transitional services with exit dates, monthly fees and exit milestones.', sampleFile: '08_TSA_Schedule.csv', screen: 'Funding & TSA Exit', filenameHints: ['tsa', 'transitional'],
    fields: [
      f('tsa_id', 'TSA ref', 'TSA reference', ['tsa ref', 'tsa id'], { required: true }),
      f('service', 'Service', 'Service name', ['service'], { required: true }),
      f('provider', 'Provider', 'Provider', ['provider']),
      f('monthly_fee', 'Monthly fee', 'Monthly fee (₹)', ['monthly fee (usd)', 'monthly fee', 'fee', 'monthly fee (₹)'], { type: 'number', required: true }),
      f('start_date', 'Service start', 'Start', ['service start', 'start'], { type: 'date' }),
      f('target_exit', 'Target exit', 'Exit date', ['target exit', 'exit date'], { type: 'date', required: true }),
      f('owner', 'Owner', 'Owner', ['owner'], { required: true }),
      f('linked_system', 'Linked system', 'App or network ID', ['linked system', 'system']),
      f('milestones_total', 'Exit milestones', 'Number of exit milestones', ['exit milestones', 'milestones'], { type: 'number' }),
      f('milestones_done', 'Milestones done', 'Completed milestones', ['milestones done', 'done'], { type: 'number' }),
      f('prep_start', 'Exit prep start', 'When exit preparation started', ['exit prep start', 'prep start'], { type: 'date' }),
    ],
  },
  {
    key: 'erp', label: 'Finance ERP master data', component: 'Finance', format: 'csv', hygiene: true, idField: 'vendor_id', nameField: 'vendor_name',
    description: 'Finance ERP vendor master extract. Its hygiene gates migration Wave 2.', sampleFile: '09_Finance_ERP_Master_Data.csv', screen: 'Data & Inventory', filenameHints: ['erp', 'master'],
    fields: [
      f('vendor_id', 'Vendor ID', 'Vendor id', ['vendor id'], { required: true }),
      f('vendor_name', 'Vendor name', 'Vendor name', ['vendor name'], { required: true }),
      f('gl_account', 'GL account', 'GL account', ['gl account'], { required: true }),
      f('cost_centre', 'Cost centre', 'Cost centre', ['cost centre', 'cost center'], { required: true }),
      f('currency', 'Currency', 'Currency', ['currency', 'ccy'], { required: true }),
      f('payment_terms', 'Payment terms', 'Terms', ['payment terms', 'terms']),
      f('legal_entity', 'Legal entity', 'Entity', ['legal entity', 'entity']),
      f('last_updated', 'Last updated', 'Last updated', ['last updated'], { type: 'date', required: true }),
    ],
  },
  {
    key: 'tasks', label: 'Task tracker', component: 'Tracking', format: 'csv', hygiene: false, idField: 'task_id', nameField: 'title',
    description: 'One shared separation plan across 8 workstreams.', sampleFile: '10_Task_Tracker.csv', screen: 'Execution Tracker', filenameHints: ['task', 'tracker', 'plan'],
    fields: [
      f('task_id', 'Task ID', 'Task ID', ['task id', 'id'], { required: true }),
      f('title', 'Task', 'Task title', ['task', 'title', 'activity'], { required: true }),
      f('workstream', 'Workstream', 'Workstream', ['workstream', 'stream'], { required: true }),
      f('owner', 'Owner', 'Owner', ['owner', 'assignee'], { required: true }),
      f('due_date', 'Due date', 'Due date', ['due date', 'due'], { type: 'date', required: true }),
      f('status', 'Status', 'Status', ['status'], { required: true }),
      f('priority', 'Priority', 'P0-P3', ['priority']),
      f('linked_item', 'Linked item', 'App ID of the Day-1 item', ['linked item', 'item', 'app id']),
    ],
  },
  {
    key: 'tests', label: 'Test results', component: 'Readiness', format: 'csv', hygiene: false, idField: 'test_id', nameField: 'test_case',
    description: 'Day-1 test evidence per critical item.', sampleFile: '11_Test_Results.csv', screen: 'Day-1 Readiness', filenameHints: ['test'],
    fields: [
      f('test_id', 'Test ID', 'Test ID', ['test id'], { required: true }),
      f('app_id', 'System', 'App ID', ['system', 'app id'], { required: true }),
      f('test_case', 'Test case', 'Test case', ['test case', 'test'], { required: true }),
      f('result', 'Result', 'Passed / Failed / Not run', ['result', 'outcome'], { required: true }),
      f('run_date', 'Run date', 'Run date', ['run date'], { type: 'date' }),
      f('tester', 'Tester', 'Tester', ['tester']),
    ],
  },
  {
    key: 'questionnaire', label: 'Owner questionnaire', component: 'Dependencies', format: 'csv', hygiene: false, idField: 'app_id',
    description: 'App owner answers to the 3 dependency questions.', sampleFile: '12_Owner_Questionnaire.csv', screen: 'Dependency Explorer', filenameHints: ['questionnaire', 'owner'],
    fields: [
      f('app_id', 'App ID', 'App', ['app id'], { required: true }),
      f('answered_by', 'Answered by', 'Owner', ['answered by']),
      f('sends_to', 'Sends data to', 'App IDs separated by ;', ['q1 sends data to', 'sends data to']),
      f('gets_from', 'Gets data from', 'App IDs separated by ;', ['q1 gets data from', 'gets data from']),
      f('uses_seller', 'Uses seller-owned items', 'Yes/No/Not sure + detail', ['q2 uses anything owned by the seller?', 'uses seller']),
      f('what_breaks', 'What breaks if off', 'Impact', ['q3 what breaks if switched off?', 'what breaks']),
    ],
  },
  {
    key: 'products', label: 'Product revenue', component: 'Revenue systems', format: 'csv', hygiene: false, nameField: 'product',
    description: 'Products and countries blocked by stuck systems, with quarterly revenue.', sampleFile: '13_Product_Revenue.csv', screen: 'Funding & TSA Exit', filenameHints: ['product', 'revenue'],
    fields: [
      f('product', 'Product', 'Product', ['product'], { required: true }),
      f('country', 'Country', 'Country', ['country'], { required: true }),
      f('quarterly_revenue', 'Quarterly revenue', '₹ per quarter', ['quarterly revenue (usd)', 'quarterly revenue', 'revenue', 'quarterly revenue (₹)'], { type: 'number', required: true }),
      f('blocked_by', 'Blocked by system', 'App ID', ['blocked by system', 'blocked by']),
      f('status', 'Registration status', 'Blocked / Registered', ['registration status', 'status']),
    ],
  },
  {
    key: 'financials', label: 'Prowess financials', component: 'Funding', format: 'csv', hygiene: false, nameField: 'company',
    description: 'Financial health (Prowess) of buyer, seller and vendor.', sampleFile: '14_Prowess_Financials.csv', screen: 'Funding & TSA Exit', filenameHints: ['prowess', 'financ'],
    fields: [
      f('company', 'Company', 'Company', ['company'], { required: true }),
      f('role', 'Deal role', 'Buyer/Seller/Vendor', ['deal role', 'role']),
      f('revenue', 'Revenue (₹ M)', '', ['revenue (usd m)', 'revenue', 'revenue (₹ m)'], { type: 'number' }),
      f('ebitda', 'EBITDA (₹ M)', '', ['ebitda (usd m)', 'ebitda', 'ebitda (₹ m)'], { type: 'number' }),
      f('net_profit', 'Net profit (₹ M)', '', ['net profit (usd m)', 'net profit', 'net profit (₹ m)'], { type: 'number' }),
      f('total_debt', 'Total debt (₹ M)', '', ['total debt (usd m)', 'debt', 'total debt (₹ m)'], { type: 'number' }),
      f('cash', 'Cash (₹ M)', '', ['cash (usd m)', 'cash', 'cash (₹ m)'], { type: 'number' }),
      f('debt_equity', 'Debt / equity', '', ['debt / equity', 'd/e'], { type: 'number' }),
      f('interest_coverage', 'Interest coverage', '', ['interest coverage (x)', 'interest coverage'], { type: 'number' }),
      f('current_ratio', 'Current ratio', '', ['current ratio'], { type: 'number' }),
    ],
  },
  {
    key: 'prospects', label: 'Prospect universe', component: 'Insights', format: 'csv', hygiene: false, nameField: 'company',
    description: 'Prowess-style company data used to spot likely divestitures.', sampleFile: '15_Prospect_Universe.csv', screen: 'Knowledge & Market Insights', filenameHints: ['prospect', 'universe'],
    fields: [
      f('company', 'Company', '', ['company'], { required: true }),
      f('sector', 'Sector', '', ['sector', 'industry']),
      f('segments', 'Business segments', '', ['business segments', 'segments'], { type: 'number' }),
      f('loss_segment', 'Loss-making segment', '', ['loss-making segment', 'loss segment']),
      f('revenue', 'Revenue (₹ M)', '', ['revenue (usd m)', 'revenue', 'revenue (₹ m)'], { type: 'number' }),
      f('debt_equity', 'Debt / equity', '', ['debt / equity'], { type: 'number' }),
      f('margin_trend', 'EBITDA margin trend', '', ['ebitda margin trend', 'margin trend']),
      f('strategic_review', 'Strategic review announced', '', ['strategic review announced', 'strategic review']),
      f('pledge_pct', 'Promoter pledge %', '', ['promoter pledge %', 'pledge'], { type: 'number' }),
    ],
  },
  {
    key: 'learning', label: 'Past learning records', component: 'Knowledge', format: 'json', hygiene: false, idField: 'id', nameField: 'id',
    description: 'Anonymised, human-approved learning records from past deals.', sampleFile: '16_Past_Learning_Records.json', screen: 'Knowledge & Market Insights', filenameHints: ['learning', 'record'],
    fields: [],
  },
  {
    key: 'decisions', label: 'Decision options', component: 'Decisions', format: 'csv', hygiene: false, nameField: 'decision',
    description: 'Leadership decisions with up to 3 options rated 1-5 on security, productivity, cost and speed.', sampleFile: '17_Decision_Options.csv', screen: 'Separation Decisions', filenameHints: ['decision', 'option'],
    fields: [
      f('decision_id', 'Decision ID', '', ['decision id'], { required: true }),
      f('decision', 'Decision', '', ['decision'], { required: true }),
      f('approver', 'Approver', '', ['approver']),
      f('due', 'Due', '', ['due', 'due date'], { type: 'date' }),
      f('option', 'Option', '', ['option'], { required: true }),
      f('option_name', 'Option name', '', ['option name'], { required: true }),
      f('security', 'Security', '', ['security (1-5)', 'security'], { type: 'number', required: true }),
      f('productivity', 'Productivity', '', ['productivity (1-5)', 'productivity'], { type: 'number', required: true }),
      f('cost', 'Cost', '5 = cheapest', ['cost (1-5, 5 = cheapest)', 'cost'], { type: 'number', required: true }),
      f('speed', 'Speed', '', ['speed (1-5)', 'speed'], { type: 'number', required: true }),
    ],
  },
  {
    key: 'spa', label: 'SPA clauses', component: 'Legal', format: 'text', hygiene: false,
    description: 'Cost-sharing clauses from the Share Purchase Agreement (plain text).', sampleFile: '18_SPA_Cost_Clauses.txt', screen: 'Funding & TSA Exit', filenameHints: ['spa', 'clause', 'agreement'],
    fields: [],
  },
];

export const DATASET: Record<DatasetKey, DatasetDef> = Object.fromEntries(DATASETS.map((d) => [d.key, d])) as Record<DatasetKey, DatasetDef>;

export const HYGIENE_DATASETS = DATASETS.filter((d) => d.hygiene).map((d) => d.key);

/** The 12 deal components every item is tagged to. */
export const COMPONENTS = [
  'Applications', 'Infrastructure', 'Network', 'Laptops & email', 'Identity & security', 'People',
  'Licences', 'Engineering tools', 'Revenue systems', 'Finance', 'Sites', 'TSA services',
] as const;
export type Component = (typeof COMPONENTS)[number];

export const BUCKETS = ['Transfer as-is', 'Clone and Go', 'Commercial agreement / TSA', 'Stand-up new', 'Consolidate', 'Extract and Sunset'] as const;
export type Bucket = (typeof BUCKETS)[number];

export const WORKSTREAMS = ['Infrastructure', 'Applications', 'Network', 'Identity & Security', 'Licences', 'People', 'TSA Services', 'Finance & Costs'] as const;

export const TASK_STATUSES = ['Not started', 'In progress', 'Review', 'At risk', 'Blocked', 'Done'] as const;

/** Keyword rules used when AI is unavailable to tag an app to a component. */
export const COMPONENT_KEYWORDS: [Component, string[]][] = [
  ['Identity & security', ['directory', 'sign-on', 'sso', 'identity', 'endpoint', 'security', 'detection', 'access control']],
  ['Laptops & email', ['email', 'calendar', 'mail', 'laptop']],
  ['Network', ['vpn', 'network', 'wan', 'firewall', 'gateway']],
  ['Revenue systems', ['order', 'customer', 'sales', 'quote', 'product registration', 'catalogue', 'crm', 'solution central']],
  ['Finance', ['ledger', 'payable', 'receivable', 'payroll', 'expense', 'procurement', 'purchase', 'finance', 'invoice', 'erp']],
  ['Engineering tools', ['design', 'layout', 'schematic', 'wafer', 'yield', 'simulation', 'ip block', 'ip library', 'eda', 'licence server', 'specification', 'spec']],
  ['People', ['employee', 'hr', 'leave', 'onboarding']],
  ['Infrastructure', ['fax', 'server', 'backup', 'storage']],
  ['Applications', ['dashboard', 'report', 'wiki', 'ticket', 'planning', 'planner', 'knowledge', 'desk']],
];
