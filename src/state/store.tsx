import { produce, setAutoFreeze } from 'immer';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildModel, type Model } from '../engine/model';
import { diffState, revertPatch } from '../engine/patch';
import { recomputeIssues } from '../engine/quality';
import { DATASET, HYGIENE_DATASETS } from '../engine/glossary';
import type { AuditEvent, WorkspaceState } from '../engine/types';
import { uid } from '../engine/util';
import { buildDemoWorkspace, DEALS, dealsForUser, emptyWorkspace, ROLES } from '../engine/workspace';
import { idbGet, idbSet } from './idb';

setAutoFreeze(false);

const STORE_VERSION = 2;
const SESSION_KEY = 'dealsync.session.v2';
const SUMMARY_KEY = 'dealsync.summaries.v2';

/** Sample files per deal. Rioja is bundled; Phoenix (6 MB) loads on demand. */
const RIOJA_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('/sample-data/*.{csv,json,txt}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(([k, v]) => [k.split('/').pop()!, v]),
);
const PHOENIX_LOADERS = import.meta.glob('/sample-data/phoenix/*.{csv,json,txt}', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const SHARED_FILES = ['15_Prospect_Universe.csv', '16_Past_Learning_Records.json'];

export async function loadSampleFiles(dealId: string): Promise<Record<string, string>> {
  if (dealId !== 'phoenix') return RIOJA_FILES;
  const entries = await Promise.all(Object.entries(PHOENIX_LOADERS).map(async ([k, f]) => [k.split('/').pop()!, await f()] as const));
  const files = Object.fromEntries(entries);
  SHARED_FILES.forEach((f) => { files[f] = RIOJA_FILES[f]; });
  return files;
}
/** Kept for modules that only need Rioja samples synchronously. */
export const SAMPLE_FILES = RIOJA_FILES;

export const PAGES = [
  ['Deal Overview', 'overview'], ['Data & Inventory', 'database'], ['Dependency Explorer', 'network'], ['Separation Decisions', 'decision'],
  ['Execution Tracker', 'tasks'], ['Day-1 Readiness', 'readiness'], ['Funding & TSA Exit', 'funding'], ['Knowledge & Market Insights', 'insights'], ['Governance & Settings', 'settings'],
] as const;
export type PageName = (typeof PAGES)[number][0];

export interface Toast { id: string; text: string; tone: 'success' | 'info' | 'warning' | 'danger' }
type Recipe = (draft: WorkspaceState) => void;
interface ActOpts { kind?: AuditEvent['kind']; allowReadOnly?: boolean; silent?: boolean; skipIssues?: boolean; noUndo?: boolean }
export interface DealSummary { id: string; name: string; score: number; signal: string; milestone: string; label: string; apps: number; updatedAt: string }

interface Store {
  s: WorkspaceState;
  m: Model;
  act: (action: string, detail: string, recipe: Recipe, opts?: ActOpts) => boolean;
  undo: (eventId: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  page: PageName;
  params: Record<string, string>;
  navigate: (page: PageName, params?: Record<string, string>) => void;
  readOnly: boolean;
  replaceWorkspace: (w: WorkspaceState, label: string) => void;
  switchDeal: (dealId: string) => Promise<void>;
  switchUser: (name: string) => void;
  samples: Record<string, string>;
  summaries: Record<string, DealSummary>;
  busy: string | null;
}

const Ctx = createContext<Store | null>(null);

function readHash(): { page: PageName; params: Record<string, string> } {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [p, q] = h.split('?');
  const page = (PAGES.find(([n]) => n === p)?.[0] ?? 'Deal Overview') as PageName;
  return { page, params: Object.fromEntries(new URLSearchParams(q ?? '')) };
}

const readJSON = <T,>(k: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T; } catch { return fallback; } };

function hygieneInputsChanged(a: WorkspaceState, b: WorkspaceState) {
  if (a.issues !== b.issues || a.deal.asOf !== b.deal.asOf || a.config.staleMonths !== b.config.staleMonths) return true;
  return HYGIENE_DATASETS.some((k) => a.datasets[k] !== b.datasets[k]);
}

/**
 * Make a saved / imported workspace safe for the current code: drop datasets and issues for
 * data types that no longer exist (e.g. the removed rental quotes) and old funding-flow fields.
 */
export function sanitizeWorkspace(w: WorkspaceState): WorkspaceState {
  const known = (k: string) => k in DATASET;
  const datasets = Object.fromEntries(Object.entries(w.datasets ?? {}).filter(([k]) => known(k))) as WorkspaceState['datasets'];
  const issues = (w.issues ?? []).filter((i) => known(i.dataset));
  const flows = w.funding?.flows ? Object.fromEntries(Object.entries(w.funding.flows).map(([k, f]) => {
    const { b1, b2, b3, b4, b5, recommendation, ...rest } = f as any; // removed rental route
    return [k, { ...rest, ...(rest.path ? { path: 'underwriting' } : {}) }];
  })) : undefined;
  return { ...w, datasets, issues, funding: { ...w.funding, ...(flows ? { flows } : {}) } };
}

async function loadWorkspace(dealId: string): Promise<{ w: WorkspaceState; samples: Record<string, string> }> {
  const samples = await loadSampleFiles(dealId);
  const saved = await idbGet<WorkspaceState>(`ws:${dealId}`).catch(() => undefined);
  if (saved && saved.version === STORE_VERSION && saved.deal?.id === dealId) {
    try { return { w: sanitizeWorkspace(saved), samples }; } catch { /* unreadable save: rebuild below */ }
  }
  return { w: buildDemoWorkspace(samples, dealId), samples };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<WorkspaceState | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>(RIOJA_FILES);
  const [busy, setBusy] = useState<string | null>('Loading deal workspace…');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DealSummary>>(() => readJSON(SUMMARY_KEY, {}));
  const [{ page, params }, setRoute] = useState(readHash);
  const saveTimer = useRef<number>(0);
  const sRef = useRef<WorkspaceState | null>(null);
  sRef.current = s;

  // first load: last deal + user from the session (role-based access applied)
  useEffect(() => {
    const sess = readJSON<{ dealId?: string; user?: string }>(SESSION_KEY, {});
    const user = sess.user ?? 'Alex Chen';
    const allowed = dealsForUser(user);
    const dealId = allowed.find((d) => d.id === sess.dealId)?.id ?? allowed[0]?.id ?? 'rioja';
    loadWorkspace(dealId).then(({ w, samples: sm }) => {
      const u = w.users.find((x) => x.name === user);
      if (u) { w.currentUser = u.name; w.role = u.role; }
      setSamples(sm); setS(w); setBusy(null);
    });
  }, []);

  // persist (debounced) to IndexedDB + session + portfolio summary
  useEffect(() => {
    if (!s) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      idbSet(`ws:${s.deal.id}`, s).catch((e) => console.warn('Could not persist workspace', e));
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ dealId: s.deal.id, user: s.currentUser })); } catch { /* ignore */ }
    }, 600);
  }, [s]);

  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = uid('t');
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const role = s ? ROLES[s.role] : ROLES.pwc_manager;
  const readOnly = role?.readOnly ?? false;
  const pageRef = useRef(page);
  pageRef.current = page;

  const act = useCallback((action: string, detail: string, recipe: Recipe, opts: ActOpts = {}) => {
    const cur = sRef.current;
    if (!cur) return false;
    if (ROLES[cur.role]?.readOnly && !opts.allowReadOnly) {
      toast(`${ROLES[cur.role].label} has read-only access — switch user in the profile menu to make changes.`, 'warning');
      return false;
    }
    setS((prev) => {
      if (!prev) return prev;
      let next = produce(prev, (d) => { recipe(d as WorkspaceState); });
      const patch = opts.noUndo || opts.kind === 'ai' || opts.kind === 'access' && opts.allowReadOnly ? null : diffState(prev, next);
      if (!opts.skipIssues && hygieneInputsChanged(prev, next)) next = { ...next, issues: recomputeIssues(next) };
      const ev: AuditEvent = { id: uid('a'), ts: new Date().toISOString(), actor: next.currentUser, action, detail, kind: opts.kind ?? 'data', module: pageRef.current, ...(patch && patch.length ? { patch } : {}) };
      return { ...next, audit: [ev, ...next.audit].slice(0, 1500) };
    });
    return true;
  }, [toast]);

  const undo = useCallback((eventId: string) => {
    const cur = sRef.current;
    if (!cur) return;
    if (ROLES[cur.role]?.readOnly) { toast('Read-only users cannot undo decisions.', 'warning'); return; }
    const ev = cur.audit.find((a) => a.id === eventId);
    if (!ev?.patch || ev.undone) return;
    let conflicts = 0;
    setS((prev) => {
      if (!prev) return prev;
      let next = produce(prev, (d) => { conflicts = revertPatch(d, ev.patch!); });
      next = { ...next, issues: recomputeIssues(next) };
      const undoEv: AuditEvent = { id: uid('a'), ts: new Date().toISOString(), actor: next.currentUser, action: `Undid: ${ev.action}`, detail: ev.detail, kind: 'override', module: pageRef.current, undoOf: ev.id };
      return { ...next, audit: [undoEv, ...next.audit.map((a) => (a.id === ev.id ? { ...a, undone: true } : a))] };
    });
    setTimeout(() => toast(conflicts ? `Undone — ${conflicts} value(s) had changed since and were reset too. Check the result.` : `Undone: ${ev.action}`, conflicts ? 'warning' : 'success'));
  }, [toast]);

  const navigate = useCallback((p: PageName, prm: Record<string, string> = {}) => {
    const q = new URLSearchParams(prm).toString();
    location.hash = `/${encodeURIComponent(p)}${q ? `?${q}` : ''}`;
    setRoute({ page: p, params: prm });
    window.scrollTo({ top: 0 });
  }, []);

  const replaceWorkspace = useCallback((w0: WorkspaceState, label: string) => {
    const cur = sRef.current;
    const w = sanitizeWorkspace(w0);
    w.issues = recomputeIssues(w);
    if (cur) { const u = w.users.find((x) => x.name === cur.currentUser); if (u) { w.currentUser = u.name; w.role = u.role; } }
    w.audit = [{ id: uid('a'), ts: new Date().toISOString(), actor: w.currentUser, action: label, detail: 'Workspace replaced', kind: 'system' }, ...w.audit];
    setS(w);
  }, []);

  const switchDeal = useCallback(async (dealId: string) => {
    const cur = sRef.current;
    if (!cur || cur.deal.id === dealId) return;
    const user = cur.currentUser;
    if (!dealsForUser(user).some((d) => d.id === dealId)) { toast(`${user} has no access to ${DEALS[dealId]?.info.name}.`, 'danger'); return; }
    window.clearTimeout(saveTimer.current);
    await idbSet(`ws:${cur.deal.id}`, cur).catch(() => undefined);
    setBusy(`Opening ${DEALS[dealId].info.name}…`);
    const { w, samples: sm } = await loadWorkspace(dealId);
    const u = w.users.find((x) => x.name === user);
    if (u) { w.currentUser = u.name; w.role = u.role; }
    setSamples(sm); setS(w); setBusy(null);
    navigate('Deal Overview');
    toast(`Switched to ${w.deal.name}`, 'info');
  }, [navigate, toast]);

  const switchUser = useCallback((name: string) => {
    const cur = sRef.current;
    if (!cur) return;
    const u = cur.users.find((x) => x.name === name);
    if (!u) return;
    setS((prev) => prev && ({ ...prev, currentUser: u.name, role: u.role, audit: [{ id: uid('a'), ts: new Date().toISOString(), actor: u.name, action: 'Switched user / role', detail: `${u.name} · ${ROLES[u.role].label}`, kind: 'access' as const }, ...prev.audit] }));
    toast(`Now viewing as ${u.name} (${ROLES[u.role].label})`, 'info');
  }, [toast]);

  const m = useMemo(() => (s ? buildModel(s) : null), [s]);

  // keep the portfolio summary of this deal fresh (shown in the deal switcher)
  useEffect(() => {
    if (!s || !m) return;
    const sum: DealSummary = { id: s.deal.id, name: s.deal.name, score: m.score, signal: m.signal, milestone: s.deal.day1, label: s.deal.milestoneLabel, apps: m.apps.length, updatedAt: new Date().toISOString() };
    setSummaries((prev) => {
      const nextS = { ...prev, [s.deal.id]: sum };
      try { localStorage.setItem(SUMMARY_KEY, JSON.stringify(nextS)); } catch { /* ignore */ }
      return nextS;
    });
  }, [m, s]);

  const value = useMemo(() => (s && m ? { s, m, act, undo, toast, toasts, page, params, navigate, readOnly, replaceWorkspace, switchDeal, switchUser, samples, summaries, busy } : null), [s, m, act, undo, toast, toasts, page, params, navigate, readOnly, replaceWorkspace, switchDeal, switchUser, samples, summaries, busy]);
  if (!value) return <div className="boot"><div className="pwc-wordmark">pwc</div><strong>DealSync</strong><span className="spinner" /> <span>{busy ?? 'Loading…'}</span></div>;
  return <Ctx.Provider value={value}>{children}{busy && <div className="busy-overlay"><span className="spinner" /> {busy}</div>}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

export async function resetToDemo(dealId: string) { return buildDemoWorkspace(await loadSampleFiles(dealId), dealId); }
export function blankWorkspace(dealId: string) { return emptyWorkspace(dealId); }
