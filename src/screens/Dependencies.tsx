import { useMemo, useRef, useState } from 'react';
import { DecisionLogButton, InfoTip } from '../components/DecisionLog';
import { runAI, type AIResult } from '../ai/client';
import { hiddenLinks, trialChecklist } from '../ai/tasks';
import { UploadModal } from '../components/UploadModal';
import { AIChip, Badge, Button, Conf, Empty, Icon, Modal, PageTitle, Progress, Table, type IconName } from '../components/ui';
import type { GraphLink, GraphNode } from '../engine/model';
import type { ManualLink } from '../engine/types';
import { download, toCSV } from '../engine/util';
import { useStore } from '../state/store';

const COLS: Record<GraphNode['type'], number> = { Application: 56, Server: 262, Network: 462, Licence: 662, 'Seller service': 662 };
const NODE_W = 160, NODE_H = 46, GAP = 60;
const ownTone = (o: string) => (o === 'seller' ? 'danger' : o === 'shared' ? 'warning' : 'success');
const typeIcon = (t: GraphNode['type']): IconName => (t === 'Application' ? 'overview' : t === 'Server' ? 'database' : t === 'Network' ? 'network' : t === 'Licence' ? 'lock' : 'alert');
const LINK_LABEL: Record<string, string> = { runs_on: 'Runs on', connects_via: 'Connects via', requires_licence: 'Requires', data_flow: 'Sends data to', uses_seller_service: 'Uses seller service' };

export function DependencyExplorer() {
  const { s, m, act, toast, params, readOnly } = useStore();
  const firstApp = params.node ? m.byId.get(params.node)?.id : m.apps.find((a) => a.id === 'APP-001')?.id ?? m.apps[0]?.id;
  const [selected, setSelected] = useState<string | undefined>(params.node ?? firstApp);
  const [group, setGroup] = useState<string>(() => (firstApp ? m.byId.get(firstApp)?.moveGroup ?? 'all' : 'all'));
  const [owners, setOwners] = useState({ buyer: true, shared: true, seller: true });
  const [showSuggested, setShowSuggested] = useState(true);
  const [review, setReview] = useState(params.review === '1');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiRes, setAiRes] = useState<AIResult<unknown> | null>(null);
  const [questionnaire, setQuestionnaire] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [checklist, setChecklist] = useState<{ app: string; steps: string[]; res: AIResult<unknown> } | null>(null);
  const [aiView, setAiView] = useState<string>(params.review === '1' ? 'all' : '');
  const [drag, setDrag] = useState<{ from: string; x1: number; y1: number; x2: number; y2: number; over?: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const suggestedLinks = s.links.filter((l) => l.status === 'suggested');
  const focusLink = aiView && aiView !== 'all' ? s.links.find((l) => l.id === aiView) : undefined;

  const scopeApps = useMemo(() => {
    if (aiView) {
      const ids = new Set((aiView === 'all' ? suggestedLinks : focusLink ? [focusLink] : []).flatMap((l) => [l.from, l.to]));
      if (focusLink) m.activeLinks.filter((l) => l.type === 'data_flow' && (ids.has(l.from) || ids.has(l.to))).forEach((l) => { ids.add(l.from); ids.add(l.to); });
      return m.apps.filter((a) => ids.has(a.id));
    }
    return m.apps.filter((a) => group === 'all' || a.moveGroup === group);
  }, [m.apps, m.activeLinks, group, aiView, suggestedLinks.length, focusLink]); // eslint-disable-line
  const visibleLinks = useMemo(() => m.links.filter((l) => scopeApps.some((a) => a.id === l.from || (l.type === 'data_flow' && a.id === l.to)) && (!aiView || (m.byId.has(l.from) && m.byId.has(l.to))) && owners[l.ownership] && (showSuggested || l.status !== 'suggested') && l.status !== 'rejected'), [m.links, m.byId, scopeApps, owners, showSuggested, aiView]);
  const layout = useMemo(() => {
    const ids = new Set<string>(scopeApps.map((a) => a.id));
    visibleLinks.forEach((l) => { ids.add(l.from); ids.add(l.to); });
    const cols: Record<string, GraphNode[]> = {};
    ids.forEach((id) => { const n = m.nodes.get(id); if (n) (cols[n.type] = cols[n.type] ?? []).push(n); });
    const pos = new Map<string, { x: number; y: number; n: GraphNode }>();
    Object.entries(cols).forEach(([t, list]) => {
      list.sort((a, b) => (t === 'Application' ? (m.byId.get(b.id)?.PI ?? 0) - (m.byId.get(a.id)?.PI ?? 0) : a.id.localeCompare(b.id)));
      const offset = t === 'Seller service' ? (cols.Licence?.length ?? 0) : 0;
      list.forEach((n, i) => pos.set(n.id, { x: COLS[n.type as GraphNode['type']], y: 36 + (i + offset) * GAP, n }));
    });
    const h = Math.max(...[...pos.values()].map((p) => p.y + NODE_H + 20), 400);
    return { pos, h };
  }, [scopeApps, visibleLinks, m.nodes, m.byId]);

  const sel = selected ? m.nodes.get(selected) : undefined;
  const selApp = selected ? m.byId.get(selected) : undefined;
  const related = new Set(selected ? m.links.filter((l) => l.from === selected || l.to === selected).flatMap((l) => [l.from, l.to]) : []);
  const suggested = s.links.filter((l) => l.status === 'suggested');
  const unclear = s.links.filter((l) => l.status === 'unclear');

  const decide = (l: ManualLink, status: 'confirmed' | 'rejected') => {
    act(status === 'confirmed' ? 'Confirmed dependency link' : 'Rejected dependency link', `${l.from} → ${l.to} (${l.source})`, (d) => { const x = d.links.find((y) => y.id === l.id); if (x) x.status = status; }, { kind: status === 'confirmed' ? 'approve' : 'override' });
    toast(status === 'confirmed' ? 'Link confirmed — entanglement, move groups and buckets recalculated' : 'Link rejected');
  };

  /** Drag-to-join: confirm a matching AI suggestion, re-target the focused one, or draw a new link. */
  const join = (from: string, to: string) => {
    if (from === to || !m.byId.has(to)) return;
    const fromName = m.byId.get(from)?.name, toName = m.byId.get(to)?.name;
    const match = s.links.find((l) => l.status === 'suggested' && ((l.from === from && l.to === to) || (l.from === to && l.to === from)));
    if (match) { decide(match, 'confirmed'); return; }
    if (m.activeLinks.some((l) => l.type === 'data_flow' && ((l.from === from && l.to === to) || (l.from === to && l.to === from)))) { toast(`${fromName} and ${toName} are already linked`, 'info'); return; }
    const retarget = focusLink && focusLink.status === 'suggested' && (focusLink.from === from || focusLink.to === from) ? focusLink : undefined;
    act(retarget ? 'Re-targeted AI-suggested link' : 'Drew dependency link', retarget ? `AI suggested ${m.byId.get(retarget.from)?.name} → ${m.byId.get(retarget.to)?.name}; consultant joined ${fromName} → ${toName}` : `${fromName} → ${toName} (manual)`, (d) => {
      if (retarget) { const x = d.links.find((y) => y.id === retarget.id); if (x) x.status = 'rejected'; }
      d.links.push({ id: `M:${from}>${to}:${Date.now()}`, from, to, type: 'data_flow', source: 'manual', status: 'confirmed', reason: retarget ? `Re-targeted from AI suggestion (${retarget.reason})` : `Joined manually by ${d.currentUser}` });
    }, { kind: retarget ? 'override' : 'data' });
    toast(retarget ? 'AI suggestion re-targeted — map, entanglement and move groups recalculated' : 'Link added — map, entanglement and move groups recalculated');
  };
  const pt = (e: React.MouseEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const findLinks = async () => {
    setAiBusy(true);
    const r = await runAI(hiddenLinks, { apps: m.apps.map((a) => ({ id: a.id, name: a.name, description: a.description, component: a.component })), existing: m.links.filter((l) => l.status !== 'rejected').map((l) => `${l.from}>${l.to}`) });
    setAiBusy(false); setAiRes(r);
    const fresh = r.data.links.filter((l) => !s.links.some((x) => x.from === l.from && x.to === l.to));
    if (!fresh.length) return toast('AI found no new dependency candidates', 'info');
    act('AI suggested hidden dependencies', `${fresh.length} candidates · ${r.source === 'gemini' ? r.model : 'rule-based fallback'}`, (d) => {
      fresh.forEach((l) => d.links.push({ id: `AI:${l.from}>${l.to}`, from: l.from, to: l.to, type: 'data_flow', source: 'ai', status: 'suggested', reason: l.reason, confidence: l.confidence }));
    }, { kind: 'ai' });
    setReview(true);
  };

  const trial = async (appId: string) => {
    const a = m.byId.get(appId)!;
    const q = s.datasets.questionnaire?.rows.find((r) => r.app_id === appId);
    const r = await runAI(trialChecklist, { app: a.name, link: 'unconfirmed seller service', whatBreaks: q?.what_breaks ?? 'not sure' });
    setChecklist({ app: appId, steps: r.data.steps, res: r });
  };

  const exportMap = () => { download(`${s.deal.name.replace(/\s/g, '_')}_dependency_map.csv`, toCSV(m.links.map((l) => ({ from: l.from, from_name: m.nodes.get(l.from)?.label, type: l.type, to: l.to, to_name: m.nodes.get(l.to)?.label, ownership: l.ownership, status: l.status, source: l.source, move_group: m.byId.get(l.from)?.moveGroup, reason: l.reason ?? '' })))); toast('Dependency map exported (CSV)'); };

  const edgePath = (l: GraphLink) => {
    const a = layout.pos.get(l.from), b = layout.pos.get(l.to);
    if (!a || !b) return null;
    if (a.n.type === 'Application' && b.n.type === 'Application') {
      const y1 = a.y + NODE_H / 2, y2 = b.y + NODE_H / 2;
      return `M${a.x} ${y1} C${a.x - 55} ${y1}, ${b.x - 55} ${y2}, ${b.x} ${y2}`;
    }
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return <>
    <PageTitle eyebrow="Clean & map" title="Dependency Explorer" description="Trace application, server, network and licence dependencies across the separation perimeter." action={<><DecisionLogButton modules={['Dependency Explorer']} /><Button variant="secondary" icon="upload" onClick={() => setUpload(true)}>Upload questionnaire</Button><Button variant="secondary" icon="download" onClick={exportMap}>Export map</Button><Button icon="spark" loading={aiBusy} onClick={findLinks}>Find hidden links with AI</Button></>} />
    <div className="map-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 330px' }}>
      <section className="card map-card">
        <div className="map-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <select className="inline" value={aiView} onChange={(e) => { setAiView(e.target.value); const l = s.links.find((x) => x.id === e.target.value); if (l) setSelected(l.from); }} style={{ borderColor: aiView ? 'var(--blue)' : undefined }}>
            <option value="">AI suggested links ({suggestedLinks.length}) — off</option>
            <option value="all">Show all AI-suggested links ({suggestedLinks.length})</option>
            {suggestedLinks.map((l) => <option key={l.id} value={l.id}>{m.byId.get(l.from)?.name} → {m.byId.get(l.to)?.name} ({Math.round((l.confidence ?? 0.7) * 100)}%)</option>)}
          </select>
          {!aiView && <select className="inline" value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">All move groups ({m.apps.length} apps)</option>{m.moveGroups.map((g) => <option key={g.id} value={g.id}>{g.id} · {g.apps.map((a) => a.name).slice(0, 3).join(', ')}{g.apps.length > 3 ? ` +${g.apps.length - 3}` : ''}</option>)}</select>}
          <div className="legend">{(['buyer', 'shared', 'seller'] as const).map((o) => <label key={o} style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={owners[o]} onChange={() => setOwners({ ...owners, [o]: !owners[o] })} /><i className={`own ${o}`} style={{ width: 8, height: 8, borderRadius: '50%' }} />{o === 'buyer' ? 'Buyer owned' : o === 'shared' ? 'Shared' : 'Seller owned'}</label>)}
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={showSuggested} onChange={() => setShowSuggested(!showSuggested)} /><i style={{ background: 'var(--blue)' }} />AI suggested</label></div>
          <span className="muted small" style={{ marginLeft: 'auto' }}>{visibleLinks.length} links</span>
        </div>
        {aiView && <div className="row between" style={{ padding: '8px 14px', background: '#edf5fe', borderBottom: '1px solid var(--border)', fontSize: 10, gap: 10 }}>
          {focusLink ? <span><Icon name="spark" size={13} /> <b>{m.byId.get(focusLink.from)?.name} → {m.byId.get(focusLink.to)?.name}</b> · {focusLink.reason} {focusLink.status !== 'suggested' && <Badge tone={focusLink.status === 'confirmed' ? 'success' : 'neutral'}>{focusLink.status}</Badge>}</span>
            : <span><Icon name="spark" size={13} /> Showing every app with an AI-suggested link (dotted blue). <b>Drag</b> from a node's blue handle ● onto another app to join them.</span>}
          {focusLink?.status === 'suggested' && <span className="row"><Button variant="ghost" onClick={() => decide(focusLink, 'rejected')}>Reject</Button><Button onClick={() => decide(focusLink, 'confirmed')}>Confirm</Button><span className="muted">or drag from {m.byId.get(focusLink.from)?.name}'s handle to re-target</span></span>}
        </div>}
        <div className="graph-wrap">
          <div ref={canvasRef} style={{ position: 'relative', height: layout.h, minWidth: 830, userSelect: drag ? 'none' : undefined }}
            onMouseMove={(e) => { if (!drag) return; const p = pt(e); const over = (e.target as HTMLElement).closest('.gnode')?.getAttribute('data-id') ?? undefined; setDrag({ ...drag, x2: p.x, y2: p.y, over }); }}
            onMouseUp={(e) => { if (!drag) return; const over = (e.target as HTMLElement).closest('.gnode')?.getAttribute('data-id'); setDrag(null); if (over) join(drag.from, over); }}
            onMouseLeave={() => setDrag(null)}>
            {(['Applications', 'Servers', 'Network', 'Licences / seller services'] as const).map((l, i) => <span key={l} className="gcol-label" style={{ left: [56, 262, 462, 662][i] }}>{l}</span>)}
            <svg className="edges" width="830" height={layout.h}>{visibleLinks.map((l) => { const d = edgePath(l); if (!d) return null; const hl = selected && (l.from === selected || l.to === selected); return <path key={l.id} d={d} className={`${l.ownership} ${l.status === 'suggested' ? 'suggested' : ''} ${l.status === 'unclear' ? 'unclear' : ''} ${hl || l.id === aiView ? 'hl' : ''}`} />; })}{drag && <path className="drag" d={`M${drag.x1} ${drag.y1} L${drag.x2} ${drag.y2}`} />}</svg>
            {[...layout.pos.values()].map(({ x, y, n }) => {
              const app = m.byId.get(n.id);
              return <div role="button" tabIndex={0} key={n.id} data-id={n.id} className={`gnode ${n.type.toLowerCase().replace(' ', '-')} ${selected === n.id ? 'sel' : ''} ${selected && !aiView && !drag && !related.has(n.id) && selected !== n.id ? 'dim' : ''} ${drag && drag.over === n.id && drag.from !== n.id && app ? 'drop-target' : ''}`} style={{ left: x, top: y }} onClick={() => setSelected(n.id)} title={`${n.label} · ${n.owner}${app ? ' — drag the blue handle onto another app to link them' : ''}`}>
                <Icon name={typeIcon(n.type)} size={14} /><span><strong>{n.label}</strong><small>{app ? `${app.id} · ent ${app.entanglement}` : n.sub}</small></span><i className={`own ${n.owner}`} />
                {app && !readOnly && <span className="handle" title="Drag onto another app to create / confirm a link" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); const r = canvasRef.current!.getBoundingClientRect(); const x1 = x + NODE_W, y1 = y + NODE_H / 2; setDrag({ from: n.id, x1, y1, x2: e.clientX - r.left, y2: e.clientY - r.top }); }} />}
              </div>;
            })}
          </div>
        </div>
        <div className="map-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 10 }}>
          <span className="row"><Icon name="spark" size={14} /> {suggested.length ? `AI detected ${suggested.length} unrecorded dependency candidate${suggested.length > 1 ? 's' : ''}` : 'No AI suggestions pending'}{unclear.length > 0 && ` · ${unclear.length} unclear link${unclear.length > 1 ? 's' : ''} treated as seller-owned`}</span>
          <span className="row"><AIChip result={aiRes} /><Button variant="secondary" disabled={!suggested.length} onClick={() => setReview(true)}>Review suggestions</Button></span>
        </div>
      </section>
      <aside className="card detail-panel" style={{ borderLeft: '1px solid var(--border)' }}>
        {!sel ? <Empty title="Select a node" /> : <div className="stack" style={{ padding: 16, gap: 14 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}><span className="large-node" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: '#f1efeb' }}><Icon name={typeIcon(sel.type)} /></span>
            <div style={{ flex: 1 }}>{selApp ? <Badge tone={selApp.entBand === 'High' ? 'danger' : selApp.entBand === 'Medium' ? 'warning' : 'success'}>{selApp.entBand} entanglement</Badge> : <Badge tone={ownTone(sel.owner)}>{sel.owner} owned</Badge>}<h2 style={{ margin: '6px 0 2px', fontSize: 16 }}>{sel.label}</h2><p className="muted small" style={{ margin: 0 }}>{sel.type}{selApp ? ` · ${selApp.moveGroup}` : ''} · {sel.sub}</p></div></div>
          {selApp && <div><div className="row between small"><span className="muted">Entanglement score<EntanglementInfo appId={selApp.id} /></span><strong style={{ fontSize: 18 }}>{selApp.entanglement}</strong></div><p className="muted small" style={{ margin: '0 0 4px' }}>Sum of links: buyer 1 · shared 2 · seller 3 (0–3 low, 4–8 medium, 9+ high)</p><Progress value={(selApp.entanglement / 20) * 100} tone={selApp.entanglement >= 9 ? 'red' : selApp.entanglement >= 4 ? 'amber' : 'green'} /><p className="muted small">{selApp.entanglement >= 9 ? 'High dependency on seller-owned and shared services.' : selApp.entanglement >= 4 ? 'Moderate dependency. Validate before separation.' : 'Low dependency — little shared with the seller.'}</p></div>}
          {selApp && <dl className="kv"><dt>Owner team</dt><dd>{selApp.ownerTeam || '—'}</dd><dt>Site</dt><dd>{selApp.site || '—'}</dd><dt>Day-1 critical</dt><dd>{selApp.day1Critical ? <Badge tone="danger">Yes{selApp.flagged ? ' · flagged' : ''}</Badge> : 'No'}</dd><dt>Strategy</dt><dd>{selApp.bucket}</dd><dt>Component</dt><dd>{selApp.component}</dd><dt>Users</dt><dd>{selApp.users}</dd></dl>}
          {!selApp && <dl className="kv"><dt>Ownership</dt><dd>{sel.owner}</dd><dt>Site</dt><dd>{sel.site ?? '—'}</dd><dt>Used by</dt><dd>{m.links.filter((l) => l.to === sel.id).map((l) => m.nodes.get(l.from)?.label).join(', ') || '—'}</dd></dl>}
          <div><h3 className="small" style={{ textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)' }}>Dependencies</h3>
            {m.links.filter((l) => l.from === sel.id || l.to === sel.id).map((l) => { const other = m.nodes.get(l.from === sel.id ? l.to : l.from); const out = l.from === sel.id; return <div key={l.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid #f1f0ee', fontSize: 10 }}><Icon name={typeIcon(other?.type ?? 'Application')} size={14} /><span style={{ flex: 1 }}><strong style={{ cursor: 'pointer' }} onClick={() => other && setSelected(other.id)}>{other?.label}</strong><small className="muted" style={{ display: 'block' }}>{out ? LINK_LABEL[l.type] : `Receives from (${LINK_LABEL[l.type].toLowerCase()})`} · {l.source}{l.status !== 'confirmed' ? ` · ${l.status}` : ''}</small></span><Badge tone={l.status === 'suggested' ? 'info' : ownTone(l.ownership)}>{l.status === 'suggested' ? 'AI' : l.ownership}</Badge></div>; })}
          </div>
          {s.links.filter((l) => l.status === 'suggested' && (l.from === sel.id || l.to === sel.id)).map((l) => <div key={l.id} className="ai-box"><div className="ai-head"><Icon name="spark" size={14} />AI suggestion · <Conf v={l.confidence ?? 0.7} /></div>{l.reason}<div className="row" style={{ marginTop: 8 }}><Button variant="ghost" onClick={() => decide(l, 'rejected')}>Reject</Button><Button onClick={() => decide(l, 'confirmed')}>Confirm link</Button></div></div>)}
          {s.links.filter((l) => l.status === 'unclear' && l.from === sel.id).map((l) => <div key={l.id} className="ai-box" style={{ borderLeftColor: 'var(--red)' }}><div className="ai-head"><Icon name="alert" size={14} />Unclear link — treated as seller-owned</div>{l.reason}. Kept under TSA until a trial run confirms it.
            <div className="row wrap" style={{ marginTop: 8 }}><Button variant="secondary" icon="spark" onClick={() => trial(sel.id)}>Draft trial-run checklist</Button>
              <Button variant="secondary" onClick={() => { act('Recorded trial-run result', `${sel.label}: link to seller file server confirmed`, (d) => { const x = d.links.find((y) => y.id === l.id)!; x.status = 'confirmed'; x.source = 'trial_run'; x.reason = 'Trial run: switching off the seller link broke document loading — hidden link to seller file server confirmed'; }); toast('Trial run recorded — dependency added to the map'); }}>Trial found a dependency</Button>
              <Button variant="ghost" onClick={() => { act('Recorded trial-run result', `${sel.label}: no seller dependency`, (d) => { d.links.find((y) => y.id === l.id)!.status = 'rejected'; }); toast('Trial run recorded — link removed'); }}>Nothing broke</Button></div></div>)}
          {selApp && <Button variant="secondary" icon="users" onClick={() => setQuestionnaire(sel.id)}>Owner questionnaire</Button>}
        </div>}
      </aside>
    </div>

    <section className="card mt">
      <div className="card-header"><div><h2>Move groups</h2><p>Apps on the same server or sending data to each other move together</p></div><Badge tone="info">{m.moveGroups.length} groups</Badge></div>
      <Table cols="80px 3fr 90px 110px 100px 1.6fr" head={['Group', 'Applications', 'Max ent.', 'Data hygiene', 'Wave', 'Wave rule']}>
        {m.moveGroups.map((g) => <div className={`tr clickable ${group === g.id ? 'selected' : ''}`} key={g.id} onClick={() => { setGroup(g.id); setSelected(g.apps[0].id); }}><span><strong>{g.id}</strong></span><span>{g.apps.map((a) => a.name).join(', ')}</span><span>{Math.max(...g.apps.map((a) => a.entanglement))}</span><span><Badge tone={g.hygiene >= s.config.hygieneGate ? 'success' : 'danger'}>{g.hygiene}</Badge></span><span>Wave {g.wave}</span><span className="muted small">{g.waveReason}</span></div>)}
      </Table>
    </section>

    {review && <Modal wide title="AI dependency suggestions" subtitle="Hidden links inferred from app names and functions. Confirm the ones that make business sense." onClose={() => setReview(false)} footer={<><Button variant="secondary" icon="spark" loading={aiBusy} onClick={findLinks}>Find more</Button><Button onClick={() => setReview(false)}>Done</Button></>}>
      {suggested.length ? <Table cols="1.3fr 1.3fr 70px 2.6fr 170px" head={['From', 'To', 'Conf.', 'Reason', '']}>{suggested.map((l) => <div className="tr" key={l.id}><span><strong>{m.nodes.get(l.from)?.label}</strong><small>{l.from}</small></span><span><strong>{m.nodes.get(l.to)?.label}</strong><small>{l.to}</small></span><span><Conf v={l.confidence ?? 0.7} /></span><span className="small">{l.reason}</span><span className="row"><Button variant="ghost" onClick={() => decide(l, 'rejected')}>Reject</Button><Button onClick={() => decide(l, 'confirmed')}>Confirm</Button></span></div>)}</Table> : <Empty title="No pending suggestions">Click “Find more” to ask AI again.</Empty>}
    </Modal>}
    {questionnaire && <QuestionnaireModal appId={questionnaire} onClose={() => setQuestionnaire(null)} />}
    {upload && <UploadModal expected="questionnaire" onClose={() => setUpload(false)} />}
    {checklist && <Modal title={`Trial-run checklist · ${m.byId.get(checklist.app)?.name}`} subtitle="Switch off the unclear link in a test environment; anything that breaks is added to the map." onClose={() => setChecklist(null)} footer={<><AIChip result={checklist.res} /><Button variant="secondary" icon="download" onClick={() => download(`trial_run_${checklist.app}.txt`, checklist.steps.map((x, i) => `${i + 1}. ${x}`).join('\n'), 'text/plain')}>Download</Button><Button onClick={() => setChecklist(null)}>Close</Button></>}>
      <ol style={{ fontSize: 11, lineHeight: 1.9, margin: 0 }}>{checklist.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
    </Modal>}
  </>;
}

function QuestionnaireModal({ appId, onClose }: { appId: string; onClose: () => void }) {
  const { s, m, act, toast } = useStore();
  const app = m.byId.get(appId)!;
  const existing = s.datasets.questionnaire?.rows.find((r) => r.app_id === appId);
  const [sends, setSends] = useState<string[]>(s.links.filter((l) => l.from === appId && l.type === 'data_flow' && l.status === 'confirmed').map((l) => l.to));
  const [gets, setGets] = useState<string[]>(s.links.filter((l) => l.to === appId && l.type === 'data_flow' && l.status === 'confirmed').map((l) => l.from));
  const [seller, setSeller] = useState<string>(existing?.uses_seller?.startsWith('Yes') ? 'Yes' : existing?.uses_seller?.startsWith('No') ? 'No' : existing ? 'Not sure' : 'No');
  const [sellerWhat, setSellerWhat] = useState<string>((existing?.uses_seller?.match(/APP-\d+/) ?? [''])[0]);
  const [breaks, setBreaks] = useState(existing?.what_breaks ?? '');
  const others = m.apps.filter((a) => a.id !== appId);
  const save = () => {
    act('Owner questionnaire submitted', `${app.name}: sends ${sends.length}, gets ${gets.length}, seller-owned ${seller}`, (d) => {
      d.links = d.links.filter((l) => !(l.source === 'questionnaire' && (l.from === appId || (l.to === appId && l.type === 'data_flow'))));
      sends.forEach((t) => d.links.push({ id: `Q:${appId}>${t}>data_flow`, from: appId, to: t, type: 'data_flow', source: 'questionnaire', status: 'confirmed', reason: `${d.currentUser}: sends data to ${t}` }));
      gets.forEach((t) => d.links.push({ id: `Q:${t}>${appId}>data_flow`, from: t, to: appId, type: 'data_flow', source: 'questionnaire', status: 'confirmed', reason: `${d.currentUser}: gets data from ${t}` }));
      if (seller === 'Yes') d.links.push({ id: `Q:${appId}>${sellerWhat || 'SELLER-SVC'}>uses_seller_service`, from: appId, to: sellerWhat || 'SELLER-SVC', type: 'uses_seller_service', source: 'questionnaire', status: 'confirmed', reason: 'Owner: uses a seller-owned item' });
      if (seller === 'Not sure') d.links.push({ id: `Q:${appId}>SELLER-SVC>uses_seller_service`, from: appId, to: 'SELLER-SVC', type: 'uses_seller_service', source: 'questionnaire', status: 'unclear', reason: 'Owner answered "Not sure" — treated as seller-owned until a trial run' });
      const qd = d.datasets.questionnaire;
      const row = { app_id: appId, answered_by: d.currentUser, sends_to: sends.join('; '), gets_from: gets.join('; '), uses_seller: seller === 'Yes' ? `Yes${sellerWhat ? ` - ${sellerWhat}` : ''}` : seller, what_breaks: breaks };
      if (qd) { const r = qd.rows.find((x) => x.app_id === appId); if (r) Object.assign(r, row); else qd.rows.push({ ...row, _rid: `questionnaire-m${qd.rows.length}` }); }
    });
    toast('Answers saved — map, entanglement and buckets recalculated');
    onClose();
  };
  const multi = (val: string[], set: (v: string[]) => void) => <div className="row wrap" style={{ gap: 4 }}>{val.map((v) => <span className="chip" key={v}>{m.byId.get(v)?.name ?? v}<button onClick={() => set(val.filter((x) => x !== v))}>×</button></span>)}<select className="inline" value="" onChange={(e) => e.target.value && set([...val, e.target.value])}><option value="">+ add app</option>{others.filter((a) => !val.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>;
  return <Modal title={`Owner questionnaire · ${app.name}`} subtitle="Three questions every app owner answers in DealSync" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Submit answers</Button></>}>
    <div className="stack">
      <div className="field">1a. Which systems does your app send data to?{multi(sends, setSends)}</div>
      <div className="field">1b. Which systems does it get data from?{multi(gets, setGets)}</div>
      <label className="field">2. Does it use anything owned by the seller?<div className="row">{['Yes', 'No', 'Not sure'].map((v) => <Button key={v} variant={seller === v ? 'primary' : 'secondary'} onClick={() => setSeller(v)}>{v}</Button>)}{seller === 'Yes' && <select className="inline" value={sellerWhat} onChange={(e) => setSellerWhat(e.target.value)}><option value="">Unspecified seller service</option>{others.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</div></label>
      <label className="field">3. What breaks if it is switched off?<textarea value={breaks} onChange={(e) => setBreaks(e.target.value)} /></label>
    </div>
  </Modal>;
}

/** Plain-language explainer for the Entanglement score, with this app's own breakdown. */
function EntanglementInfo({ appId }: { appId: string }) {
  const { m } = useStore();
  const a = m.byId.get(appId);
  if (!a) return null;
  const pts = { buyer: 1, shared: 2, seller: 3 } as const;
  return <InfoTip title="What is the Entanglement score?" wide>
    <p><b>In one line:</b> it measures how tangled an app is with things the <b>seller keeps</b> after the deal. The higher it is, the harder and riskier it is to cut the app loose.</p>
    <p><b>Think of it like moving house.</b> Furniture you own moves easily (1 point). Things you share with a flatmate need agreement (2 points). Things that belong to the landlord can't come with you at all — you must replace them or keep renting them (3 points).</p>
    <p>For every link the app has — the server it runs on, the network it uses, its licences, the systems it sends data to — we look at who owns the other end and add up the points:</p>
    <table><thead><tr><th>Link</th><th>Owner</th><th>Points</th></tr></thead><tbody>
      {a.links.map((l) => <tr key={l.id}><td>{m.nodes.get(l.to)?.label ?? l.to}<br /><span className="muted">{LINK_LABEL[l.type]}{l.status === 'unclear' ? ' · unclear → treated as seller' : ''}</span></td><td>{l.ownership}</td><td><b>{pts[l.ownership]}</b></td></tr>)}
      <tr><td><b>{a.name}</b></td><td></td><td><b>{a.entanglement}</b></td></tr>
    </tbody></table>
    <p><b>Reading it:</b> 0–3 low (move as-is), 4–8 medium (validate before moving), 9+ high (plan a clone, a TSA or a replacement). {a.name} is <b>{a.entBand.toLowerCase()}</b>.</p>
    <p className="muted">It also feeds “Seller dependency (D)” in the Priority score and decides which apps must move together (move groups).</p>
  </InfoTip>;
}
