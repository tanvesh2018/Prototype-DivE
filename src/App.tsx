import { useEffect, useMemo, useRef, useState } from 'react';
import { refreshAIStatus } from './ai/client';
import { Badge, Icon, useClickOutside, type IconName } from './components/ui';
import { fmtDate, initials } from './engine/util';
import { ROLES } from './engine/workspace';
import { PAGES, useStore, type PageName } from './state/store';
import { Overview } from './screens/Overview';
import { Inventory } from './screens/Inventory';
import { DependencyExplorer } from './screens/Dependencies';
import { Decisions } from './screens/Decisions';
import { Tracker } from './screens/Tracker';
import { Readiness } from './screens/Readiness';
import { Funding } from './screens/Funding';
import { Insights } from './screens/Insights';
import { Governance } from './screens/Governance';

function useNotifications() {
  const { s, m } = useStore();
  return useMemo(() => {
    const n: { id: string; title: string; detail: string; page: PageName; params?: Record<string, string>; tone: 'danger' | 'warning' | 'info' }[] = [];
    m.criticalBlocked.forEach((i) => n.push({ id: `blk-${i.app.id}`, title: `${i.app.name} is blocked`, detail: `Readiness capped at ${s.config.blockerCap} · ${i.blockers[0]?.title}`, page: 'Day-1 Readiness', tone: 'danger' }));
    m.overdueOwner.forEach((o) => n.push({ id: `oq-${o.id}`, title: 'Owner question overdue', detail: `${o.question} · ${o.owner}`, page: 'Data & Inventory', params: { tab: 'owner' }, tone: 'danger' }));
    m.tsa.filter((t) => t.risk).forEach((t) => n.push({ id: `tsa-${t.row.tsa_id}`, title: `TSA extension risk: ${t.row.service}`, detail: `Projected exit ${fmtDate(t.projectedExit)} vs ${fmtDate(t.row.target_exit)}`, page: 'Funding & TSA Exit', params: { tab: 'tsa' }, tone: 'warning' }));
    m.datasetsHygiene.filter((d) => d.score < s.config.hygieneGate).forEach((d) => n.push({ id: `hyg-${d.key}-${d.score}`, title: `Data below the 90 gate`, detail: `${s.datasets[d.key as keyof typeof s.datasets]?.fileName} scores ${d.score}`, page: 'Data & Inventory', tone: 'warning' }));
    s.links.filter((l) => l.status === 'suggested').length && n.push({ id: `ai-links-${s.links.filter((l) => l.status === 'suggested').length}`, title: 'AI found unrecorded dependencies', detail: `${s.links.filter((l) => l.status === 'suggested').length} suggestions awaiting review`, page: 'Dependency Explorer', tone: 'info' });
    m.decisions.filter((d) => d.state.status === 'pending').forEach((d) => n.push({ id: `dec-${d.id}`, title: `Decision pending: ${d.title}`, detail: `${d.approver} · due ${fmtDate(d.due)}`, page: 'Separation Decisions', params: { tab: 'options', decision: d.id }, tone: 'info' }));
    return n;
  }, [s, m]);
}

function GlobalSearch() {
  const { m, s, navigate } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const r: { label: string; sub: string; go: () => void }[] = [];
    m.apps.filter((a) => `${a.id} ${a.name} ${a.vendor}`.toLowerCase().includes(t)).slice(0, 6).forEach((a) => r.push({ label: a.name, sub: `${a.id} · ${a.bucket}`, go: () => navigate('Separation Decisions', { app: a.id }) }));
    (s.datasets.servers?.rows ?? []).filter((x) => `${x.server_id} ${x.server_name}`.toLowerCase().includes(t)).slice(0, 4).forEach((x) => r.push({ label: x.server_id, sub: `Server · ${x.server_name} · ${x.ownership}`, go: () => navigate('Dependency Explorer', { node: x.server_id }) }));
    m.tasks.filter((x) => `${x.task_id} ${x.title} ${x.owner}`.toLowerCase().includes(t)).slice(0, 6).forEach((x) => r.push({ label: x.title, sub: `${x.task_id} · ${x.owner} · ${x.status}`, go: () => navigate('Execution Tracker', { q: x.task_id }) }));
    (s.datasets.licences?.rows ?? []).filter((x) => `${x.licence_id} ${x.product} ${x.vendor}`.toLowerCase().includes(t)).slice(0, 4).forEach((x) => r.push({ label: `${x.licence_id} ${x.product}`, sub: `Licence · ${x.vendor}`, go: () => navigate('Data & Inventory', { tab: 'records', dataset: 'licences', q: x.licence_id }) }));
    PAGES.filter(([p]) => p.toLowerCase().includes(t)).forEach(([p]) => r.push({ label: p, sub: 'Screen', go: () => navigate(p) }));
    return r.slice(0, 14);
  }, [q, m, s, navigate]);
  return <div className="global-search" ref={ref}>
    <Icon name="search" size={15} />
    <input ref={inputRef} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder={`Search ${s.deal.name}`} onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { results[0].go(); setOpen(false); setQ(''); } }} />
    <kbd>⌘ K</kbd>
    {open && q.length >= 2 && <div className="search-results">{results.length ? results.map((r, i) => <button key={i} onClick={() => { r.go(); setOpen(false); setQ(''); }}><span>{r.label}</span><small>{r.sub}</small></button>) : <div className="empty">No matches for “{q}”</div>}</div>}
  </div>;
}

function Notifications() {
  const { s, act, navigate } = useStore();
  const list = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const unread = list.filter((n) => !s.readNotifications.includes(n.id));
  const markAll = () => act('Marked notifications read', `${unread.length} notifications`, (d) => { d.readNotifications = [...new Set([...d.readNotifications, ...list.map((n) => n.id)])]; }, { kind: 'access', allowReadOnly: true, skipIssues: true });
  return <div className="menu-wrap" ref={ref}>
    <button className="notification" onClick={() => setOpen(!open)} aria-label="Notifications"><Icon name="bell" />{unread.length > 0 && <i />}</button>
    {open && <div className="popover">
      <div className="pop-head"><span>Notifications ({unread.length} new)</span>{unread.length > 0 && <button className="text-action" onClick={markAll}>Mark all read</button>}</div>
      {list.length === 0 && <div className="empty">All clear.</div>}
      {list.map((n) => <button key={n.id} className={`pop-item ${s.readNotifications.includes(n.id) ? '' : 'unread'}`} onClick={() => { act('Opened notification', n.title, (d) => { if (!d.readNotifications.includes(n.id)) d.readNotifications.push(n.id); }, { kind: 'access', allowReadOnly: true, skipIssues: true }); navigate(n.page, n.params); setOpen(false); }}>
        <Badge tone={n.tone}>{n.tone === 'danger' ? 'Critical' : n.tone === 'warning' ? 'Risk' : 'Info'}</Badge>
        <div><strong>{n.title}</strong><span>{n.detail}</span></div>
      </button>)}
    </div>}
  </div>;
}

function ProfileMenu() {
  const { s, act, toast } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const me = s.users.find((u) => u.name === s.currentUser);
  const switchTo = (name: string) => {
    const u = s.users.find((x) => x.name === name)!;
    act('Switched user / role', `${u.name} · ${ROLES[u.role].label}`, (d) => { d.currentUser = u.name; d.role = u.role; }, { kind: 'access', allowReadOnly: true, skipIssues: true });
    toast(`Now viewing as ${u.name} (${ROLES[u.role].label})`, 'info');
    setOpen(false);
  };
  return <div className="profile" ref={ref} onClick={() => setOpen(!open)}>
    <span>{initials(s.currentUser)}</span><div><strong>{s.currentUser}</strong><small>{me?.title ?? ROLES[s.role].label}</small></div><Icon name="chevron" size={14} />
    {open && <div className="menu" onClick={(e) => e.stopPropagation()} style={{ minWidth: 280 }}>
      <div className="menu-label">View as (role-based access demo)</div>
      {s.users.map((u) => <button key={u.name} onClick={() => switchTo(u.name)}>{u.name === s.currentUser ? <Icon name="check" size={13} /> : <span style={{ width: 13 }} />}<span style={{ flex: 1 }}>{u.name}<br /><small className="muted">{u.title} · {ROLES[u.role].description}</small></span></button>)}
    </div>}
  </div>;
}

function DealSwitcher() {
  const { s, navigate } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  return <div className="deal-switcher" ref={ref} onClick={() => setOpen(!open)}>
    <div className="deal-avatar">{s.deal.name.split(' ').pop()?.[0]}</div>
    <div><small>ACTIVE DEAL</small><strong>{s.deal.name}</strong><span>{s.deal.industry} {s.deal.dealType.toLowerCase()}</span></div>
    <Icon name="chevron" size={15} />
    {open && <div className="menu left" style={{ color: '#222', minWidth: 230 }} onClick={(e) => e.stopPropagation()}>
      <div className="menu-label">Your deals</div>
      <button onClick={() => setOpen(false)}><Icon name="check" size={13} />{s.deal.name} · {s.deal.buyer} / {s.deal.seller}</button>
      <hr />
      <div className="menu-label">Other deals are hidden — each user sees only their own deal</div>
      <button onClick={() => { setOpen(false); navigate('Governance & Settings', { tab: 'deal' }); }}><Icon name="settings" size={13} />Deal settings</button>
    </div>}
  </div>;
}

export default function App() {
  const { s, m, page, params, navigate, toasts, readOnly } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { refreshAIStatus(); }, []);
  const role = ROLES[s.role];
  const allowed = (p: string) => role.pages === 'all' || role.pages.includes(p);
  useEffect(() => { if (!allowed(page)) navigate((role.pages === 'all' ? 'Deal Overview' : role.pages[0]) as PageName); }, [s.role, page]); // eslint-disable-line

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
      default: return <Overview />;
    }
  };
  const phases = ['Baseline', 'Classify', 'Decide', 'Execute', 'Day-1', 'TSA exit'];
  const active = m.daysToDay1 > 0 ? 3 : m.daysToDay1 === 0 ? 4 : 5;
  const openTasksAtRisk = m.warnings.length;

  return <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="pwc-wordmark">pwc</div><div className="brand-title"><strong>DealSync</strong></div></div>
      <DealSwitcher />
      <div className="nav-label">Deal workspace</div>
      <nav>{PAGES.map(([label, icon]) => allowed(label) && <button key={label} className={page === label ? 'active' : ''} onClick={() => navigate(label)} title={label}><Icon name={icon as IconName} /><span>{label}</span>{label === 'Execution Tracker' && openTasksAtRisk > 0 && <b>{openTasksAtRisk}</b>}{label === 'Day-1 Readiness' && m.signal === 'NO-GO' && <i />}</button>)}</nav>
      <div className="sidebar-footer"><div><Icon name="shield" /><span><strong>Deal data protected</strong><small>DPDP · GDPR aligned</small></span></div><button onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar"><Icon name="chevron" /></button></div>
    </aside>
    <main>
      <header className="topbar">
        <div className="subtitle"><strong>{s.deal.name}</strong><span>/</span> Deals Technology Command Centre</div>
        <div className="top-actions"><GlobalSearch /><Notifications /><ProfileMenu /></div>
      </header>
      {readOnly && <div className="readonly-banner"><Icon name="lock" size={13} />Viewing as {s.currentUser} — {role.label}: {role.description}. Actions that change data are disabled.</div>}
      <div className="phasebar">
        <div className="phase-label"><span>DEAL PHASE</span><strong>{active === 3 ? 'Execution to Day-1' : active === 4 ? 'Day-1' : 'TSA period'}</strong></div>
        <div className="phase-track">{phases.map((p, i) => <div className={i < active ? 'complete' : i === active ? 'active' : ''} key={p}><span>{i < active ? <Icon name="check" size={11} /> : i + 1}</span><strong>{p}</strong></div>)}</div>
        <div className="phase-date"><span>DAY-1</span><strong>{fmtDate(s.deal.day1, true).toUpperCase()}</strong><small>{m.daysToDay1 > 0 ? `${m.daysToDay1} days remaining · as of ${fmtDate(s.deal.asOf)}` : 'Day-1 passed'}</small></div>
      </div>
      <div className="page" key={page + JSON.stringify(params)}>{renderPage()}</div>
    </main>
    <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}><Icon name={t.tone === 'success' ? 'check' : t.tone === 'danger' || t.tone === 'warning' ? 'alert' : 'spark'} size={14} />{t.text}</div>)}</div>
  </div>;
}
