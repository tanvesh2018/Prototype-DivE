import { useMemo, useState } from 'react';

type IconName =
  | 'overview'
  | 'database'
  | 'network'
  | 'decision'
  | 'tasks'
  | 'readiness'
  | 'funding'
  | 'insights'
  | 'settings'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'arrow'
  | 'upload'
  | 'spark'
  | 'check'
  | 'alert'
  | 'calendar'
  | 'shield'
  | 'download'
  | 'filter'
  | 'send'
  | 'lock'
  | 'clock'
  | 'users'
  | 'file';

const paths: Record<IconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  network: <><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m7.3 10.9 9.4-4.7M7.3 13.1l9.4 4.7"/></>,
  decision: <><path d="M9 5H4v5M4 5l6 6"/><path d="M15 19h5v-5m0 5-7-7"/><path d="M15 5h5v5m0-5-6 6"/></>,
  tasks: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 8 1.5 1.5L12 7M14 9h3M8 14l1.5 1.5L12 13M14 15h3"/></>,
  readiness: <><path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.5"/></>,
  funding: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2M3 11h18M9 15h6"/></>,
  insights: <><path d="M9 18h6M10 22h4"/><path d="M8.5 15.5A7 7 0 1 1 15.5 15.5C14.6 16.2 14 17 14 18h-4c0-1-.6-1.8-1.5-2.5Z"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
  spark: <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/><path d="m19 15 .6 2.1L22 18l-2.4.9L19 21l-.6-2.1L16 18l2.4-.9L19 15Z"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/></>,
  download: <><path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 20h16"/></>,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>,
  send: <><path d="m22 2-8 20-4-8-8-4 20-8Z"/><path d="M10 14 22 2"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20"/></>,
  file: <><path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const modules = [
  ['Deal Overview', 'overview'],
  ['Data & Inventory', 'database'],
  ['Dependency Explorer', 'network'],
  ['Separation Decisions', 'decision'],
  ['Execution Tracker', 'tasks'],
  ['Day-1 Readiness', 'readiness'],
  ['Funding & TSA Exit', 'funding'],
  ['Knowledge & Market Insights', 'insights'],
  ['Governance & Settings', 'settings'],
] as const;

const PageTitle = ({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) => (
  <div className="page-title">
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action && <div className="title-actions">{action}</div>}
  </div>
);

function Badge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange'; children: React.ReactNode }) {
  return <span className={`badge ${tone}`}><span className="badge-dot" />{children}</span>;
}

function Progress({ value, tone = 'orange' }: { value: number; tone?: 'orange' | 'green' | 'amber' | 'red' | 'charcoal' }) {
  return <div className="progress"><div className={`progress-fill ${tone}`} style={{ width: `${value}%` }} /></div>;
}

function MetricCard({ label, value, detail, icon, tone = 'default', onClick }: { label: string; value: string; detail: React.ReactNode; icon: IconName; tone?: string; onClick?: () => void }) {
  return <button className={`metric-card ${tone}`} onClick={onClick}>
    <div className="metric-top"><span>{label}</span><div className="metric-icon"><Icon name={icon} /></div></div>
    <div className="metric-value">{value}</div>
    <div className="metric-detail">{detail}</div>
  </button>;
}

const Button = ({ children, variant = 'primary', icon, onClick, disabled = false }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; onClick?: () => void; disabled?: boolean }) => (
  <button className={`btn ${variant}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={16} />}{children}</button>
);

function Overview({ navigate }: { navigate: (page: string) => void }) {
  const [drill, setDrill] = useState(false);
  const workstreams = [
    ['Infrastructure', 88, 'green'], ['Applications', 82, 'green'], ['Network', 79, 'amber'],
    ['Identity & Security', 76, 'amber'], ['Licences', 70, 'red'], ['People', 91, 'green'],
    ['TSA Services', 84, 'green'], ['Finance & Costs', 73, 'amber'],
  ] as const;
  return <>
    <PageTitle eyebrow="Command centre" title="Deal Overview" description="Executive control room for Project Rioja’s Day-1 separation." action={<><Button variant="secondary" icon="download">Export board pack</Button><Button icon="spark" onClick={() => navigate('Knowledge & Market Insights')}>Ask Copilot</Button></>} />
    <div className="notice"><Icon name="alert" /><div><strong>Illustrative demo data</strong><span>Project Rioja is an academic concept. Company names and most values are representative.</span></div><button>Dismiss</button></div>
    <div className="metrics-grid">
      <MetricCard label="Day-1 readiness" value="79 / 100" tone="danger" icon="readiness" onClick={() => setDrill(!drill)} detail={<><Badge tone="danger">NO-GO</Badge><span>Underlying score 86 · capped</span></>} />
      <MetricCard label="Technology estate" value="27" icon="database" detail={<><span className="trend positive">24 mapped</span><span>3 need review</span></>} />
      <MetricCard label="Active workstreams" value="8" icon="tasks" detail={<><span className="trend warning">1 behind plan</span><span>300+ activities</span></>} />
      <MetricCard label="Funding gap" value="$1.74M" icon="funding" detail={<><span className="trend negative">$700K disputed</span><span>3 options modelled</span></>} />
    </div>
    {drill && <div className="drill-banner"><div><Icon name="alert" /><div><strong>Why is readiness capped at 79?</strong><span>CircuitDesign Pro is Day-1 critical and vendor consent is blocked. The calculated score is 86, but the critical blocker rule caps the outcome at 79.</span></div></div><Button variant="secondary" onClick={() => navigate('Day-1 Readiness')}>Open score breakdown</Button></div>}
    <div className="content-grid two-thirds">
      <section className="card">
        <div className="card-header"><div><h2>Workstream progress</h2><p>Completion across all 8 separation workstreams</p></div><button className="text-action" onClick={() => navigate('Execution Tracker')}>Open tracker <Icon name="arrow" size={15} /></button></div>
        <div className="workstream-grid">
          {workstreams.map(([name, value, tone]) => <div className="workstream" key={name}><div><span>{name}</span><strong>{value}%</strong></div><Progress value={value} tone={tone} /></div>)}
        </div>
      </section>
      <section className="card readiness-card">
        <div className="card-header"><div><h2>Day-1 decision</h2><p>Updated today, 09:42</p></div><Badge tone="danger">NO-GO</Badge></div>
        <div className="score-ring" style={{ '--score': 79 } as React.CSSProperties}><div><strong>79</strong><span>of 100</span></div></div>
        <div className="score-legend"><span><i className="red" />0–79 No-go</span><span><i className="amber" />80–89 Conditions</span><span><i className="green" />90+ Go</span></div>
        <button className="full-link" onClick={() => navigate('Day-1 Readiness')}>View readiness drivers <Icon name="chevron" size={15} /></button>
      </section>
    </div>
    <div className="content-grid halves">
      <section className="card">
        <div className="card-header"><div><h2>Critical blockers</h2><p>Items requiring immediate intervention</p></div><Badge tone="danger">3 open</Badge></div>
        <div className="issue-list">
          <button onClick={() => navigate('Execution Tracker')}><span className="severity critical">P0</span><div><strong>EDA Corp licence consent blocked</strong><span>CircuitDesign Pro · Procurement Lead · Due 06 Nov</span></div><Icon name="chevron" /></button>
          <button onClick={() => navigate('Data & Inventory')}><span className="severity high">P1</span><div><strong>Finance ERP data below gate</strong><span>Hygiene 85 · Wave 2 cannot commence</span></div><Icon name="chevron" /></button>
          <button onClick={() => navigate('Funding & TSA Exit')}><span className="severity high">P1</span><div><strong>$700K equipment line disputed</strong><span>Funding must be secured before Day-1</span></div><Icon name="chevron" /></button>
        </div>
      </section>
      <section className="card">
        <div className="card-header"><div><h2>Pending decisions</h2><p>Leadership approvals awaiting action</p></div><Badge tone="warning">4 pending</Badge></div>
        <div className="decision-list">
          <div><span className="decision-date"><strong>04</strong>NOV</span><div><strong>Laptop migration strategy</strong><span>CIO Steering Committee · Recommendation ready</span></div><button onClick={() => navigate('Separation Decisions')}>Review</button></div>
          <div><span className="decision-date"><strong>05</strong>NOV</span><div><strong>Bridge facility approval</strong><span>CFO · $700K / 12 months</span></div><button onClick={() => navigate('Funding & TSA Exit')}>Review</button></div>
          <div><span className="decision-date"><strong>06</strong>NOV</span><div><strong>Wave 0 release gate</strong><span>Deal Board · 3 critical applications</span></div><button onClick={() => navigate('Day-1 Readiness')}>Review</button></div>
        </div>
      </section>
    </div>
  </>;
}

function Inventory() {
  const [tab, setTab] = useState('Files');
  const [uploading, setUploading] = useState(false);
  const [approved, setApproved] = useState<string[]>([]);
  const files = [
    ['Applications.xlsx', 'Applications', '27', 92, 'Ready', '02 Nov, 14:32'],
    ['Server_Inventory.csv', 'Infrastructure', '18', 96, 'Ready', '02 Nov, 13:18'],
    ['Network_Assets.xlsx', 'Network', '35,412', 91, 'Ready', '01 Nov, 17:44'],
    ['Licence_Register.xlsx', 'Licences', '42', 88, 'Review', '02 Nov, 11:06'],
    ['Finance_ERP_Export.csv', 'Applications', '126', 85, 'Blocked', '01 Nov, 15:20'],
  ];
  const suggestions = [
    ['Map “Application Title” to app_name', '98%', 'Applications.xlsx', 'Header and sample values match glossary'],
    ['Merge “Payments Server 1” with “SRV-PAY-01”', '94%', 'Server_Inventory.csv', 'Same site, owner and matching name pattern'],
    ['Set WaferTest Suite vendor to EDA Corp', '91%', 'Licence_Register.xlsx', 'Linked licence L-12 identifies vendor'],
  ];
  const approve = (name: string) => setApproved(v => v.includes(name) ? v : [...v, name]);
  return <>
    <PageTitle eyebrow="Connect & clean" title="Data & Inventory" description="One governed baseline for applications, infrastructure, licences and people." action={<Button icon="upload" onClick={() => { setUploading(true); setTimeout(() => setUploading(false), 1200); }}>{uploading ? 'Scanning file…' : 'Upload source file'}</Button>} />
    <div className="metrics-grid compact">
      <MetricCard label="Source files" value="8" icon="file" detail={<><span>7 connected</span><span>1 in review</span></>} />
      <MetricCard label="Records" value="35,667" icon="database" detail={<><span className="trend positive">98.4% mapped</span><span>across 12 components</span></>} />
      <MetricCard label="Open quality issues" value="17" icon="alert" tone="warning" detail={<><span className="trend warning">6 need owner</span><span>11 AI suggestions</span></>} />
      <MetricCard label="Average hygiene" value="91.2" icon="shield" detail={<><span className="trend positive">+5.8 this week</span><span>90 gate passed</span></>} />
    </div>
    <div className="tabs">{['Files', 'Quality queue', 'AI suggestions', 'Owner queue'].map(x => <button className={tab === x ? 'active' : ''} onClick={() => setTab(x)} key={x}>{x}{x === 'AI suggestions' && <span>3</span>}</button>)}</div>
    {tab === 'Files' && <section className="card table-card">
      <div className="table-tools"><div className="search-box"><Icon name="search" /><input placeholder="Search source files…" /></div><Button variant="secondary" icon="filter">Filter</Button></div>
      <div className="data-table">
        <div className="tr th"><span>Source file</span><span>Component</span><span>Records</span><span>Hygiene</span><span>Status</span><span>Last updated</span><span /></div>
        {files.map(([name, component, records, hygiene, status, updated]) => <div className="tr" key={name as string}><span className="file-name"><span className="file-icon">XL</span><strong>{name}</strong></span><span>{component}</span><span>{records}</span><span className="quality"><strong>{hygiene}</strong><Progress value={hygiene as number} tone={(hygiene as number) >= 90 ? 'green' : (hygiene as number) >= 87 ? 'amber' : 'red'} /></span><span><Badge tone={status === 'Ready' ? 'success' : status === 'Review' ? 'warning' : 'danger'}>{status}</Badge></span><span className="muted">{updated}</span><button className="kebab">•••</button></div>)}
      </div>
      <div className="table-footer"><span>Showing 5 of 8 files</span><span>Data gate: files must score 90+ before use in decisions</span></div>
    </section>}
    {tab === 'AI suggestions' && <section className="card">
      <div className="card-header"><div><h2>Suggestions awaiting human review</h2><p>AI can propose changes but never applies them without approval.</p></div><Badge tone="info"><Icon name="spark" size={12} /> Human in control</Badge></div>
      <div className="suggestion-list">{suggestions.map(([name, confidence, source, reason]) => <div className="suggestion" key={name}><div className="ai-mark"><Icon name="spark" /></div><div><div><strong>{name}</strong><Badge tone="info">{confidence} confidence</Badge></div><span>{source} · {reason}</span></div><div className="suggestion-actions">{approved.includes(name) ? <Badge tone="success">Approved</Badge> : <><Button variant="ghost">Reject</Button><Button onClick={() => approve(name)}>Approve</Button></>}</div></div>)}</div>
    </section>}
    {tab === 'Quality queue' && <section className="card"><div className="card-header"><div><h2>Data quality checks</h2><p>17 exceptions identified across completeness, duplicates, links and freshness.</p></div></div><div className="quality-cards">{[['Missing values', '8', '4 assigned'], ['Potential duplicates', '3', '2 high confidence'], ['Broken links', '2', 'SRV-99 critical'], ['Stale records', '4', '> 6 months old']].map(([a,b,c],i)=><div key={a}><span className={`quality-symbol q${i}`}>{i+1}</span><div><strong>{b} {a.toLowerCase()}</strong><span>{c}</span></div><Button variant="secondary">Review</Button></div>)}</div></section>}
    {tab === 'Owner queue' && <section className="card"><div className="card-header"><div><h2>Unresolved owner actions</h2><p>Questions that require accountable business confirmation.</p></div></div><div className="issue-list"><button><span className="severity critical">P0</span><div><strong>Can licence L-07 transfer?</strong><span>Priya Nair · Procurement Lead · Due 05 Nov</span></div><Badge tone="danger">Overdue</Badge></button><button><span className="severity high">P1</span><div><strong>Confirm SpecViewer seller dependency</strong><span>Marco Lee · Application Owner · Due 06 Nov</span></div><Badge tone="warning">Due tomorrow</Badge></button></div></section>}
  </>;
}

const mapNodes = [
  { id: 'circuit', label: 'CircuitDesign Pro', type: 'Application', x: 70, y: 115, risk: 'Critical', owner: 'Engineering IT', ent: 12 },
  { id: 'vault', label: 'DesignVault', type: 'Application', x: 340, y: 45, risk: 'High', owner: 'Engineering IT', ent: 8 },
  { id: 'wafer', label: 'WaferTest Suite', type: 'Application', x: 340, y: 205, risk: 'Medium', owner: 'Test Systems', ent: 6 },
  { id: 'server', label: 'SRV-14', type: 'Server', x: 615, y: 45, risk: 'High', owner: 'SemiCorp', ent: 9 },
  { id: 'network', label: 'NET-3', type: 'Network', x: 615, y: 205, risk: 'High', owner: 'Shared', ent: 9 },
  { id: 'licence', label: 'Licence L-07', type: 'Licence', x: 860, y: 115, risk: 'Critical', owner: 'EDA Corp', ent: 11 },
];

function DependencyExplorer() {
  const [selected, setSelected] = useState(mapNodes[0]);
  const [confirmed, setConfirmed] = useState(false);
  return <>
    <PageTitle eyebrow="Clean & map" title="Dependency Explorer" description="Trace application, server, network and licence dependencies across the separation perimeter." action={<><Button variant="secondary" icon="filter">Map filters</Button><Button icon="download">Export map</Button></>} />
    <div className="map-layout">
      <section className="card map-card">
        <div className="map-toolbar"><div className="map-legend"><span><i className="node app" />Application</span><span><i className="node server" />Server</span><span><i className="node network" />Network</span><span><i className="node licence" />Licence</span></div><div><Badge tone="danger">Seller owned</Badge><Badge tone="warning">Shared</Badge></div></div>
        <div className="map-canvas">
          <svg className="map-lines" viewBox="0 0 1020 310" preserveAspectRatio="none"><path d="M180 145 C250 145 250 75 340 75"/><path d="M180 145 C250 145 250 235 340 235"/><path d="M465 75 C530 75 540 75 615 75"/><path d="M465 235 C530 235 540 235 615 235"/><path className="risk-line" d="M740 75 C800 75 800 145 860 145"/><path className="risk-line dashed" d="M740 235 C800 235 800 145 860 145"/></svg>
          {mapNodes.map(n => <button key={n.id} className={`map-node ${n.type.toLowerCase()} ${selected.id === n.id ? 'selected' : ''}`} style={{ left: n.x, top: n.y }} onClick={() => setSelected(n)}><span className="node-icon"><Icon name={n.type === 'Application' ? 'overview' : n.type === 'Server' ? 'database' : n.type === 'Network' ? 'network' : 'lock'} size={16} /></span><span><strong>{n.label}</strong><small>{n.owner}</small></span>{n.risk === 'Critical' && <i className="critical-dot" />}</button>)}
          <div className="map-group">MOVE GROUP 01</div>
        </div>
        <div className="map-footer"><span><Icon name="spark" /> AI detected 2 unrecorded dependency candidates</span><Button variant="secondary">Review suggestions</Button></div>
      </section>
      <aside className="card detail-panel">
        <div className="detail-head"><span className={`large-node ${selected.type.toLowerCase()}`}><Icon name={selected.type === 'Application' ? 'overview' : selected.type === 'Server' ? 'database' : selected.type === 'Network' ? 'network' : 'lock'} /></span><div><Badge tone={selected.risk === 'Critical' ? 'danger' : selected.risk === 'High' ? 'warning' : 'info'}>{selected.risk} risk</Badge><h2>{selected.label}</h2><p>{selected.type} · Move Group 01</p></div></div>
        <div className="risk-score"><div><span>Entanglement score</span><strong>{selected.ent}<small>/ 15</small></strong></div><Progress value={(selected.ent / 15) * 100} tone={selected.ent >= 10 ? 'red' : 'amber'} /><p>{selected.ent >= 9 ? 'High dependency on seller-owned and shared services.' : 'Moderate dependency. Validate before separation.'}</p></div>
        <dl className="details"><div><dt>Ownership</dt><dd>{selected.owner}</dd></div><div><dt>Site</dt><dd>Pune, India</dd></div><div><dt>Day-1 critical</dt><dd><Badge tone="danger">Yes</Badge></dd></div><div><dt>Separation strategy</dt><dd>Clone and Go</dd></div></dl>
        <div className="dependency-list"><h3>Direct dependencies</h3>{selected.id === 'circuit' ? <><div><Icon name="database" /><span><strong>SRV-14</strong><small>Runs on · Seller owned</small></span><Badge tone="danger">High</Badge></div><div><Icon name="network" /><span><strong>NET-3</strong><small>Connects via · Shared</small></span><Badge tone="warning">Shared</Badge></div><div><Icon name="lock" /><span><strong>Licence L-07</strong><small>Requires · Transfer unknown</small></span><Badge tone="danger">Blocked</Badge></div></> : <div><Icon name="network" /><span><strong>Move Group 01</strong><small>Connected dependency cluster</small></span><Badge tone="warning">Review</Badge></div>}</div>
        <div className="ai-suggestion"><div><Icon name="spark" /><strong>AI suggestion</strong></div><p>CircuitDesign Pro may write design files to DesignVault based on function and owner data.</p>{confirmed ? <Badge tone="success">Link confirmed by you</Badge> : <div><Button variant="ghost">Reject</Button><Button onClick={() => setConfirmed(true)}>Confirm link</Button></div>}</div>
      </aside>
    </div>
  </>;
}

function Decisions() {
  const [selected, setSelected] = useState('Clone and Go');
  const [approved, setApproved] = useState(false);
  const strategies = [
    ['Transfer as-is', 'Direct transfer with minimal change', '$120K', 'Low', '18 days'],
    ['Clone and Go', 'Copy environment for Day-1 continuity', '$310K', 'Medium', '12 days'],
    ['Commercial agreement / TSA', 'Retain seller service temporarily', '$90K/mo', 'High', '3 days'],
    ['Stand-up new', 'Build a clean replacement platform', '$680K', 'Low', '60 days'],
    ['Consolidate', 'Migrate to an existing buyer platform', '$240K', 'Medium', '35 days'],
    ['Extract and Sunset', 'Archive data and retire the system', '$75K', 'Low', '21 days'],
  ];
  return <>
    <PageTitle eyebrow="Classify & decide" title="Separation Decisions" description="Compare six evidence-based strategies and route recommendations for accountable approval." action={<Button variant="secondary" icon="file">Decision log</Button>} />
    <div className="decision-context"><div><span className="app-tile"><Icon name="overview" /></span><div><span>Decision SD-014 · Day-1 critical</span><h2>CircuitDesign Pro</h2><p>Engineering tool · Entanglement 12 · 120 users · Pune</p></div></div><div><span>Decision due</span><strong>04 Nov 2025</strong></div><div><span>Approver</span><strong>Technology Steering Committee</strong></div></div>
    <div className="strategy-grid">{strategies.map(([name, desc, cost, risk, timing]) => <button key={name} className={`strategy-card ${selected === name ? 'selected' : ''}`} onClick={() => { setSelected(name); setApproved(false); }}><div className="select-circle">{selected === name && <span />}</div><div className="strategy-top"><span className="strategy-icon"><Icon name={name === 'Clone and Go' ? 'database' : name.includes('TSA') ? 'clock' : name === 'Consolidate' ? 'network' : 'arrow'} /></span>{name === 'Clone and Go' && <Badge tone="orange"><Icon name="spark" size={11} /> Recommended</Badge>}</div><h3>{name}</h3><p>{desc}</p><div className="strategy-stats"><span><small>Indicative cost</small><strong>{cost}</strong></span><span><small>Delivery risk</small><strong>{risk}</strong></span><span><small>Timing</small><strong>{timing}</strong></span></div></button>)}</div>
    <div className="content-grid two-thirds decision-bottom">
      <section className="card">
        <div className="card-header"><div><h2>Options assessment</h2><p>Weighted score after mandatory security screening</p></div><Badge tone="info">Formula controlled</Badge></div>
        <div className="score-table">
          <div className="tr th"><span>Option</span><span>Security 35%</span><span>Productivity 30%</span><span>Cost 20%</span><span>Speed 15%</span><span>Total</span></div>
          <div className="tr"><span><strong>Move in phases</strong><small>Recommended</small></span><span>4.0</span><span>4.0</span><span>3.0</span><span>3.0</span><strong>3.65</strong></div>
          <div className="tr"><span><strong>Full rebuild first</strong></span><span>5.0</span><span>2.0</span><span>2.0</span><span>2.0</span><strong>3.05</strong></div>
          <div className="tr disabled"><span><strong>Move now, secure later</strong><Badge tone="danger">Removed</Badge></span><span>2.0</span><span>5.0</span><span>4.0</span><span>5.0</span><strong>—</strong></div>
        </div>
      </section>
      <section className="card board-summary">
        <div className="card-header"><div><h2>Board summary</h2><p>AI drafted · review required</p></div><Icon name="spark" /></div>
        <blockquote>Move in phases offers the strongest balance of security and staff continuity. It scores <strong>3.65</strong>, ahead of a full rebuild at 3.05. Moving now and securing later was removed because it failed the minimum security threshold. Recommend approval subject to vendor consent by 06 Nov.</blockquote>
        <div className="source-line"><Icon name="shield" /> Based on approved assessment criteria and live deal data</div>
        {approved ? <div className="approval-success"><Icon name="check" /> Approved and added to decision log</div> : <div className="approval-actions"><Button variant="secondary">Request changes</Button><Button icon="check" onClick={() => setApproved(true)}>Approve recommendation</Button></div>}
      </section>
    </div>
  </>;
}

function Tracker() {
  const [status, setStatus] = useState('All');
  const tasks = [
    ['Secure EDA Corp licence consent', 'Licences', 'Priya Nair', '06 Nov', 'Blocked', 'P0'],
    ['Complete CircuitDesign Pro failover test', 'Applications', 'Marco Lee', '07 Nov', 'In progress', 'P0'],
    ['Remediate Finance ERP data gaps', 'Data', 'Aisha Khan', '08 Nov', 'At risk', 'P1'],
    ['Validate NET-3 firewall rules', 'Network', 'Daniel Wong', '09 Nov', 'In progress', 'P1'],
    ['Approve laptop migration option', 'End User', 'Sophie Martin', '04 Nov', 'Review', 'P1'],
    ['Confirm Wave 0 cutover roster', 'People', 'Ana Silva', '10 Nov', 'Not started', 'P2'],
  ];
  const filtered = status === 'All' ? tasks : tasks.filter(t => t[4] === status);
  return <>
    <PageTitle eyebrow="Track & score" title="Execution Tracker" description="One accountable plan for 300+ activities across eight workstreams." action={<><Button variant="secondary" icon="download">Export plan</Button><Button icon="tasks">Add task</Button></>} />
    <div className="tracker-summary"><div><span>Overall completion</span><strong>78%</strong><Progress value={78} /></div><div><span>Open tasks</span><strong>67</strong><small>of 312 total</small></div><div><span>Due this week</span><strong>24</strong><small>8 completed</small></div><div className="risk"><span>At risk / blocked</span><strong>7</strong><small>3 critical</small></div><div><span>Day-1</span><strong>10 days</strong><small>15 Nov 2025</small></div></div>
    <div className="ai-warning"><div><Icon name="spark" /><div><strong>Early warning: Licence workstream is likely to slip</strong><span>3 of 5 licence tasks are waiting on vendor consent for a Day-1 critical design tool. Escalate through ChipCo’s CIO today.</span></div></div><Button variant="secondary">Create escalation</Button></div>
    <section className="card table-card">
      <div className="table-tools"><div className="status-filters">{['All', 'Blocked', 'At risk', 'In progress', 'Not started'].map(s => <button className={status === s ? 'active' : ''} onClick={() => setStatus(s)} key={s}>{s}</button>)}</div><div className="search-box"><Icon name="search" /><input placeholder="Search tasks…" /></div><Button variant="secondary" icon="filter">Filter</Button></div>
      <div className="task-table">
        <div className="tr th"><span>Task</span><span>Workstream</span><span>Owner</span><span>Due</span><span>Status</span><span>Priority</span><span /></div>
        {filtered.map((t, i) => <div className="tr" key={t[0]}><span><strong>{t[0]}</strong><small>TSK-{String(118+i).padStart(3,'0')}</small></span><span>{t[1]}</span><span className="owner"><i>{t[2].split(' ').map(x=>x[0]).join('')}</i>{t[2]}</span><span className={i === 0 ? 'overdue' : ''}>{t[3]}</span><span><Badge tone={t[4] === 'Blocked' ? 'danger' : t[4] === 'At risk' || t[4] === 'Review' ? 'warning' : t[4] === 'In progress' ? 'info' : 'neutral'}>{t[4]}</Badge></span><span><span className={`priority ${t[5].toLowerCase()}`}>{t[5]}</span></span><button className="kebab">•••</button></div>)}
      </div>
    </section>
  </>;
}

function Readiness() {
  const [formula, setFormula] = useState(false);
  const [selected, setSelected] = useState('Engineering tools');
  const components = [
    ['Engineering tools', 63, 'CircuitDesign Pro blocked', 'red'],
    ['Revenue systems', 99, 'All critical tests passed', 'green'],
    ['Finance', 93, '2 minor data actions', 'green'],
    ['Laptops & email', 94, '340 users validated', 'green'],
    ['Identity & security', 89, 'Conditional access test open', 'amber'],
    ['Network', 87, 'NET-3 firewall validation', 'amber'],
  ] as const;
  return <>
    <PageTitle eyebrow="Track & score" title="Day-1 Readiness" description="Explainable readiness by component, test evidence and critical dependency." action={<Button variant="secondary" icon="download">Board scorecard</Button>} />
    <div className="readiness-hero">
      <div className="hero-score"><div className="score-ring large" style={{ '--score': 79 } as React.CSSProperties}><div><strong>79</strong><span>NO-GO</span></div></div><div><Badge tone="danger">CRITICAL BLOCKER ACTIVE</Badge><h2>Day-1 is not yet ready</h2><p>The weighted readiness result is <strong>86</strong>. CircuitDesign Pro is blocked, activating the critical-item cap at 79.</p><button className="text-action" onClick={() => setFormula(!formula)}>How is this calculated? <Icon name="chevron" size={14} /></button></div></div>
      <div className="readiness-meta"><div><Icon name="calendar" /><span>Day-1 date<strong>15 Nov 2025</strong></span></div><div><Icon name="clock" /><span>Time remaining<strong>10 days</strong></span></div><div><Icon name="alert" /><span>Critical blockers<strong className="red-text">1 open</strong></span></div><div><Icon name="check" /><span>Tests passed<strong>42 / 47</strong></span></div></div>
    </div>
    {formula && <div className="formula-panel"><strong>Item readiness formula</strong><span>50% tasks complete</span><b>+</b><span>30% tests passed</span><b>+</b><span>20% data hygiene</span><i>Critical tool or revenue-linked blocker → score capped at 79</i></div>}
    <div className="content-grid two-thirds readiness-layout">
      <section className="card">
        <div className="card-header"><div><h2>Readiness by component</h2><p>Click a component to inspect its evidence</p></div><span className="updated"><i />Updated 12 min ago</span></div>
        <div className="component-list">{components.map(([name, score, note, tone]) => <button key={name} className={selected === name ? 'selected' : ''} onClick={() => setSelected(name)}><span className={`component-status ${tone}`}><Icon name={tone === 'green' ? 'check' : tone === 'red' ? 'alert' : 'clock'} /></span><span><strong>{name}</strong><small>{note}</small></span><div><strong>{score}%</strong><Progress value={score} tone={tone} /></div><Icon name="chevron" /></button>)}</div>
      </section>
      <section className="card evidence-panel">
        <div className="card-header"><div><span className="eyebrow">Selected component</span><h2>{selected}</h2></div><Badge tone={selected === 'Engineering tools' ? 'danger' : 'warning'}>{selected === 'Engineering tools' ? '63% · Blocked' : 'Action required'}</Badge></div>
        {selected === 'Engineering tools' ? <><div className="evidence-item critical"><div><Icon name="alert" /><div><strong>Vendor consent not received</strong><span>CircuitDesign Pro · Owner: Priya Nair</span></div></div><Badge tone="danger">Due 06 Nov</Badge></div><div className="evidence-breakdown"><h3>CircuitDesign Pro readiness</h3><div><span>Tasks complete <b>4 / 8</b></span><Progress value={50} tone="red" /></div><div><span>Tests passed <b>2 / 5</b></span><Progress value={40} tone="amber" /></div><div><span>Data hygiene <b>92 / 100</b></span><Progress value={92} tone="green" /></div><div className="calculation">50% × 50 + 40% × 30 + 92% × 20 = <strong>55.4%</strong></div></div><div className="next-step"><Icon name="spark" /><div><strong>Fastest path to GO</strong><p>Secure vendor consent, complete four remaining tasks and rerun three tests. Projected portfolio score: <b>96 / GO</b>.</p></div></div></> : <><div className="evidence-item"><div><Icon name="clock" /><div><strong>Final evidence review</strong><span>{selected} has no critical blockers.</span></div></div><Badge tone="warning">In progress</Badge></div><div className="next-step"><Icon name="spark" /><div><strong>Suggested next step</strong><p>Close the remaining validation action before 10 Nov to preserve schedule confidence.</p></div></div></>}
      </section>
    </div>
  </>;
}

function Funding() {
  const [tab, setTab] = useState('Funding options');
  const [amount, setAmount] = useState(700000);
  const [months, setMonths] = useState(12);
  const [rate, setRate] = useState(10.2);
  const monthly = useMemo(() => {
    const r = rate / 1200;
    return Math.round(amount * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
  }, [amount, months, rate]);
  return <>
    <PageTitle eyebrow="Fund & exit" title="Funding & TSA Exit" description="Keep separation moving while cost disputes resolve and seller dependencies reduce." action={<Badge tone="success"><Icon name="shield" size={13} /> Bank sharing consented</Badge>} />
    <div className="tabs">{['Funding options', 'Cost allocation', 'TSA exit', 'Migration waves'].map(x => <button className={tab === x ? 'active' : ''} onClick={() => setTab(x)} key={x}>{x}</button>)}</div>
    {tab === 'Funding options' && <><div className="funding-banner"><div><span>Disputed funding requirement</span><strong>$700,000</strong><p>Copies of engineering equipment · SemiCorp disputes allocation</p></div><div><span>Overall cost gap</span><strong>$1.74M</strong><p>Seller $1.03M · ChipCo $0.71M</p></div><div><span>Required before</span><strong>12 Nov 2025</strong><p>3 days before Day-1</p></div></div>
      <div className="funding-grid">
        <section className="card funding-options"><div className="card-header"><div><h2>Three funding paths</h2><p>Indicative options subject to lender approval</p></div></div>
          <div className="fund-option recommended"><div className="option-icon"><Icon name="funding" /></div><div><span><strong>Bridge loan</strong><Badge tone="orange">Recommended</Badge></span><p>Fund equipment now; repay after cost dispute is settled.</p><div><span>Est. monthly <strong>${monthly.toLocaleString()}</strong></span><span>Total interest <strong>${(monthly * months - amount).toLocaleString()}</strong></span></div></div><button><Icon name="chevron" /></button></div>
          <div className="fund-option"><div className="option-icon"><Icon name="lock" /></div><div><span><strong>Escrow</strong></span><p>Bank holds SemiCorp’s disputed $490K until both parties agree.</p><div><span>Amount held <strong>$490,000</strong></span><span>Est. fee <strong>$7,350</strong></span></div></div><button><Icon name="chevron" /></button></div>
          <div className="fund-option"><div className="option-icon"><Icon name="database" /></div><div><span><strong>Equipment lease</strong></span><p>Lease equipment and licences to preserve acquisition cash.</p><div><span>Term <strong>36 months</strong></span><span>Est. monthly <strong>$23,100</strong></span></div></div><button><Icon name="chevron" /></button></div>
        </section>
        <section className="card calculator"><div className="card-header"><div><h2>Bridge loan calculator</h2><p>Illustrative estimate, not a lending offer</p></div></div>
          <label>Loan amount <div><span>$</span><input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div></label>
          <label>Term <select value={months} onChange={e => setMonths(Number(e.target.value))}><option value={6}>6 months</option><option value={12}>12 months</option><option value={18}>18 months</option></select></label>
          <label>Indicative annual rate <div><input type="number" step=".1" value={rate} onChange={e => setRate(Number(e.target.value))} /><span>%</span></div></label>
          <div className="monthly"><span>Estimated monthly repayment</span><strong>${monthly.toLocaleString()}</strong><small>{months} payments · {rate}% p.a.</small></div>
          <Button>Model funding package</Button>
        </section>
      </div></>}
    {tab === 'Cost allocation' && <section className="card"><div className="card-header"><div><h2>$1.74M cost allocation</h2><p>Seller share = 0.4 × cause + 0.4 × like-for-like + 0.2 × contract</p></div><Badge tone="info">SPA clause verified</Badge></div><div className="cost-table"><div className="tr th"><span>Cost line</span><span>Total</span><span>Seller pays</span><span>ChipCo pays</span><span>Status</span></div>{[['Moving licences to ChipCo','$600K','$540K','$60K','Agreed'],['Copies of engineering equipment','$700K','$490K','$210K','Disputed'],['Faster equipment requested by ChipCo','$440K','$0','$440K','Agreed']].map(r=><div className="tr" key={r[0]}>{r.map((x,i)=><span key={x}>{i===0?<strong>{x}</strong>:i===4?<Badge tone={x==='Agreed'?'success':'danger'}>{x}</Badge>:x}</span>)}</div>)}<div className="tr total"><span>Total</span><span>$1.74M</span><span>$1.03M</span><span>$0.71M</span><span /></div></div></section>}
    {tab === 'TSA exit' && <section className="card"><div className="card-header"><div><h2>TSA service exit plan</h2><p>$90K monthly run rate across four seller services</p></div><Badge tone="warning">$25K/mo at risk</Badge></div><div className="tsa-timeline">{[['Licence server','$30K/mo','15 Dec',70,'On plan'],['Email service','$25K/mo','15 Jan',44,'Extension risk'],['Shared network','$15K/mo','31 Jan',53,'On plan'],['Finance ERP','$20K/mo','28 Feb',35,'Data gate']].map(([n,c,d,p,s])=><div key={n as string}><span className="tsa-icon"><Icon name="network" /></span><div><strong>{n}</strong><span>{c as string} · Owner: Separation PMO</span></div><div><span>Target exit <strong>{d}</strong></span><Progress value={p as number} tone={s==='Extension risk'?'red':'orange'} /></div><Badge tone={s==='Extension risk'?'danger':s==='Data gate'?'warning':'success'}>{s as string}</Badge></div>)}</div></section>}
    {tab === 'Migration waves' && <section className="card"><div className="card-header"><div><h2>Migration waves</h2><p>A wave may start only when source data hygiene is 90+</p></div></div><div className="wave-list">{[['0','Day-1 critical','Group 01, Order Tracker','92','Released'],['1','Security','Logins and laptops','94','Ready'],['2','Entanglement','Finance ERP','85','Blocked'],['3','Revenue','Customer portal','91','Planned'],['4','Consolidate & save','Marketing Dashboard, Legacy Reporting','93','Planned']].map(r=><div key={r[0]}><span className="wave-number">{r[0]}</span><div><strong>{r[1]}</strong><span>{r[2]}</span></div><div><small>Data hygiene</small><strong>{r[3]}</strong></div><Badge tone={r[4]==='Released'||r[4]==='Ready'?'success':r[4]==='Blocked'?'danger':'neutral'}>{r[4]}</Badge></div>)}</div></section>}
  </>;
}

function Insights() {
  const [messages, setMessages] = useState<{ q?: string; a?: string }[]>([{ a: 'Project Rioja is NO-GO because CircuitDesign Pro’s vendor consent is blocked. Ask me what would move the score to GO, or request a board update.' }]);
  const [input, setInput] = useState('');
  const ask = (text?: string) => {
    const q = text || input;
    if (!q.trim()) return;
    let answer = 'I don’t know from the approved deal data. I can only answer using live metrics, PwC frameworks and consented learning records.';
    if (/90|go|readiness/i.test(q)) answer = 'Secure EDA Corp consent, complete CircuitDesign Pro’s 4 remaining tasks and rerun 3 failed tests. The projected score then rises from 79 to about 96 / GO. (Source: live readiness formula)';
    if (/board|update/i.test(q)) answer = 'Rioja remains NO-GO at 79 due to one blocked critical engineering tool. The underlying score is 86. Vendor consent is due 06 Nov; resolution unlocks remaining tests and projects readiness to 96. (Source: live dashboard)';
    if (/cost|fund/i.test(q)) answer = 'The total gap is $1.74M: $1.03M seller and $0.71M buyer. The disputed $700K equipment line can be bridged while $490K is held in escrow. (Source: approved cost allocation)';
    setMessages(m => [...m, { q }, { a: answer }]); setInput('');
  };
  return <>
    <PageTitle eyebrow="Learn & advise" title="Knowledge & Market Insights" description="Sourced deal intelligence, reusable firm knowledge and ethical growth signals." action={<Badge tone="info"><Icon name="shield" size={13} /> Approved sources only</Badge>} />
    <div className="insights-layout">
      <section className="card copilot">
        <div className="copilot-head"><div className="copilot-logo"><Icon name="spark" /></div><div><h2>DealSync Copilot</h2><p>Live metrics · PwC methods · Consented lessons</p></div><span><i />Online</span></div>
        <div className="chat">{messages.map((m,i) => m.q ? <div className="message user" key={i}>{m.q}</div> : <div className="message ai" key={i}><span className="mini-ai"><Icon name="spark" size={14} /></span><div>{m.a}<div className="message-actions"><button>Helpful</button><button>Copy</button><button>View sources</button></div></div></div>)}</div>
        <div className="quick-prompts">{['What moves us to GO?', 'Draft a board update', 'Explain the cost gap'].map(q=><button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
        <div className="chat-input"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask about Project Rioja…" /><button onClick={() => ask()}><Icon name="send" /></button></div>
        <div className="copilot-note"><Icon name="lock" size={13} />Copilot cannot change deal data. Every answer and override is logged.</div>
      </section>
      <div className="insight-column">
        <section className="card benchmark-card"><div className="card-header"><div><span className="eyebrow">Sourced benchmark</span><h2>Licence consent timing</h2></div><Badge tone="success">20 deals</Badge></div><p>Deals requesting design-tool consent in week 1 were materially more likely to hit Day-1 on time.</p><div className="benchmark-bars"><div><span>Requested in week 1 <strong>90%</strong></span><Progress value={90} tone="green" /></div><div><span>Requested later <strong>50%</strong></span><Progress value={50} tone="amber" /></div></div><div className="source-line"><Icon name="file" /> Anonymised Learning Records · Semiconductor carve-outs</div></section>
        <section className="card scorecard-mini"><div className="card-header"><div><span className="eyebrow">Board scorecard</span><h2>Project Rioja</h2></div><span className="mini-score">79</span></div><div><span>Data confidence<strong>91</strong></span><span>Execution<strong>78</strong></span><span>TSA exit<strong>68</strong></span></div><Button variant="secondary" icon="download">Generate one-page scorecard</Button></section>
        <section className="card prospect-card"><div className="card-header"><div><span className="eyebrow">Ethical market signal</span><h2>Alpha Industries</h2></div><strong>8<span>/10</span></strong></div><p>Potential divestiture signal based on 6 segments, a loss-making electronics unit and high debt.</p><div className="source-line"><Icon name="shield" /> Public company data only · Human review required</div></section>
      </div>
    </div>
  </>;
}

function Governance() {
  const [retention, setRetention] = useState('90 days after TSA exit');
  const [toggles, setToggles] = useState([true, true, false]);
  const toggle = (i: number) => setToggles(v => v.map((x,n)=>n===i?!x:x));
  return <>
    <PageTitle eyebrow="Control & assure" title="Governance & Settings" description="Access, consent, auditability and retention controls for Project Rioja." action={<Button variant="secondary" icon="download">Export audit report</Button>} />
    <div className="governance-banner"><Icon name="shield" /><div><strong>Control posture: Healthy</strong><span>All required access, AI, consent and retention controls are active. Last review: today, 08:30.</span></div><Badge tone="success">8 / 8 controls passed</Badge></div>
    <div className="governance-grid">
      <section className="card"><div className="card-header"><div><h2>Role-based access</h2><p>Users only see the data required for their role</p></div><Button variant="secondary">Manage access</Button></div><div className="role-list">{[['PwC engagement team','12 users','Full deal access'],['Client leadership','5 users','Read-only, own deal'],['Seller IT team','8 users','Assigned requests only'],['Funding partner','2 users','Consented summary only']].map(([a,b,c],i)=><div key={a}><span className={`role-icon r${i}`}><Icon name={i===3?'funding':'users'} /></span><div><strong>{a}</strong><span>{c}</span></div><Badge tone="neutral">{b}</Badge><Icon name="chevron" /></div>)}</div></section>
      <section className="card"><div className="card-header"><div><h2>Consent registry</h2><p>Purpose-specific client permissions</p></div></div><div className="consent-list">{[['Bank funding summary','Granted','01 Nov 2025'],['Anonymised learning record','Granted','28 Oct 2025'],['Benchmark contribution','Pending','Awaiting Legal'],['Marketing case study','Not granted','No external use']].map(([a,b,c])=><div key={a}><span className={b==='Granted'?'ok':b==='Pending'?'pending':'off'}><Icon name={b==='Granted'?'check':b==='Pending'?'clock':'lock'} /></span><div><strong>{a}</strong><span>{c}</span></div><Badge tone={b==='Granted'?'success':b==='Pending'?'warning':'neutral'}>{b}</Badge></div>)}</div></section>
      <section className="card"><div className="card-header"><div><h2>Data & AI controls</h2><p>Approved processing boundaries</p></div></div><div className="setting-list">{[['Mask personal data on upload','Names and emails replaced with counts and roles'],['Require human approval for AI','Suggestions never modify source records automatically'],['Allow cross-deal model training','Disabled by policy']].map(([a,b],i)=><div key={a}><div><strong>{a}</strong><span>{b}</span></div><button className={`toggle ${toggles[i]?'on':''}`} onClick={()=>toggle(i)}><span /></button></div>)}</div><div className="approved-ai"><Icon name="shield" /><div><strong>Approved AI boundary</strong><span>Deal data is processed only in approved services with no retention or training.</span></div></div></section>
      <section className="card"><div className="card-header"><div><h2>Retention policy</h2><p>Raw deal data lifecycle</p></div></div><label className="select-label">Delete raw client data<select value={retention} onChange={e=>setRetention(e.target.value)}><option>At deal close</option><option>90 days after TSA exit</option><option>180 days after TSA exit</option></select></label><div className="retention-timeline"><div className="complete"><span><Icon name="check" /></span><strong>Upload & process</strong><small>Personal data minimised</small></div><div className="active"><span>2</span><strong>Active deal + TSA</strong><small>Encrypted, access controlled</small></div><div><span>3</span><strong>Secure deletion</strong><small>{retention}</small></div></div></section>
    </div>
    <section className="card audit-card"><div className="card-header"><div><h2>Recent audit activity</h2><p>Immutable record of access, approvals and overrides</p></div><button className="text-action">View all 1,248 events <Icon name="arrow" size={14} /></button></div><div className="audit-list">{[['09:42','Priya Nair','Approved AI field mapping','Applications.xlsx · app_name'],['09:31','James Cole','Viewed funding summary','Bank consent scope'],['09:18','System','Recalculated readiness score','86 capped to 79 · critical blocker'],['08:56','Marco Lee','Overrode dependency classification','NET-3 · Shared → Seller owned']].map(([a,b,c,d],i)=><div key={a}><span className={`audit-dot a${i}`}><Icon name={i===2?'readiness':i===3?'alert':'check'} /></span><time>{a}</time><div><strong>{c}</strong><span>{b} · {d}</span></div><button>View details</button></div>)}</div></section>
  </>;
}

function App() {
  const [page, setPage] = useState('Deal Overview');
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const renderPage = () => {
    switch (page) {
      case 'Data & Inventory': return <Inventory />;
      case 'Dependency Explorer': return <DependencyExplorer />;
      case 'Separation Decisions': return <Decisions />;
      case 'Execution Tracker': return <Tracker />;
      case 'Day-1 Readiness': return <Readiness />;
      case 'Funding & TSA Exit': return <Funding />;
      case 'Knowledge & Market Insights': return <Insights />;
      case 'Governance & Settings': return <Governance />;
      default: return <Overview navigate={setPage} />;
    }
  };
  return <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="pwc-wordmark">pwc</div><div className="brand-title"><strong>DealSync</strong><span>Academic Concept Prototype</span></div></div>
      <div className="deal-switcher"><div className="deal-avatar">R</div><div><small>ACTIVE DEAL</small><strong>Project Rioja</strong><span>Technology carve-out</span></div><Icon name="chevron" size={15} /></div>
      <div className="nav-label">Deal workspace</div>
      <nav>{modules.map(([label, icon]) => <button key={label} className={page === label ? 'active' : ''} onClick={() => setPage(label)} title={label}><Icon name={icon} /><span>{label}</span>{label === 'Execution Tracker' && <b>7</b>}{label === 'Day-1 Readiness' && <i />}</button>)}</nav>
      <div className="sidebar-footer"><div><Icon name="shield" /><span><strong>Deal data protected</strong><small>DPDP · GDPR aligned</small></span></div><button onClick={() => setCollapsed(!collapsed)}><Icon name="chevron" /></button></div>
    </aside>
    <main>
      <header className="topbar">
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}><span /><span /><span /></button>
        <div className="subtitle"><strong>Project Rioja</strong><span>/</span> Deals Technology Command Centre</div>
        <div className="top-actions"><div className="global-search"><Icon name="search" /><input placeholder="Search Project Rioja" /><kbd>⌘ K</kbd></div><button className="notification" onClick={() => setNotifications(false)}><Icon name="bell" />{notifications && <i />}</button><div className="profile"><span>AC</span><div><strong>Alex Chen</strong><small>Engagement Manager</small></div><Icon name="chevron" size={14} /></div></div>
      </header>
      <div className="phasebar">
        <div className="phase-label"><span>DEAL PHASE</span><strong>Execution to Day-1</strong></div>
        <div className="phase-track">
          {['Baseline', 'Classify', 'Decide', 'Execute', 'Day-1', 'TSA exit'].map((phase, index) => <div className={index < 3 ? 'complete' : index === 3 ? 'active' : ''} key={phase}><span>{index < 3 ? <Icon name="check" size={11} /> : index + 1}</span><strong>{phase}</strong></div>)}
        </div>
        <div className="phase-date"><span>DAY-1</span><strong>15 NOV 2025</strong><small>10 days remaining</small></div>
      </div>
      <div className="page">{renderPage()}</div>
    </main>
  </div>;
}

export default App;
