import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildModel, type Model } from '../engine/model';
import { recomputeIssues } from '../engine/quality';
import type { AuditEvent, WorkspaceState } from '../engine/types';
import { uid } from '../engine/util';
import { buildDemoWorkspace, emptyWorkspace, ROLES } from '../engine/workspace';

const STORAGE_KEY = 'dealsync.workspace.v1';

/** Raw text of every file in /sample-data (bundled so the demo works offline). */
export const SAMPLE_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('/sample-data/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(([k, v]) => [k.split('/').pop()!, v]),
);

export const PAGES = [
  ['Deal Overview', 'overview'], ['Data & Inventory', 'database'], ['Dependency Explorer', 'network'], ['Separation Decisions', 'decision'],
  ['Execution Tracker', 'tasks'], ['Day-1 Readiness', 'readiness'], ['Funding & TSA Exit', 'funding'], ['Knowledge & Market Insights', 'insights'], ['Governance & Settings', 'settings'],
] as const;
export type PageName = (typeof PAGES)[number][0];

export interface Toast { id: string; text: string; tone: 'success' | 'info' | 'warning' | 'danger' }
type Recipe = (draft: WorkspaceState) => void;
interface ActOpts { kind?: AuditEvent['kind']; allowReadOnly?: boolean; silent?: boolean; skipIssues?: boolean }

interface Store {
  s: WorkspaceState;
  m: Model;
  act: (action: string, detail: string, recipe: Recipe, opts?: ActOpts) => boolean;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  page: PageName;
  params: Record<string, string>;
  navigate: (page: PageName, params?: Record<string, string>) => void;
  readOnly: boolean;
  replaceWorkspace: (w: WorkspaceState, label: string) => void;
}

const Ctx = createContext<Store | null>(null);

function load(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const w = JSON.parse(raw) as WorkspaceState;
      if (w.version === 1 && w.deal) return w;
    }
  } catch { /* storage unavailable */ }
  return buildDemoWorkspace(SAMPLE_FILES);
}

function readHash(): { page: PageName; params: Record<string, string> } {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [p, q] = h.split('?');
  const page = (PAGES.find(([n]) => n === p)?.[0] ?? 'Deal Overview') as PageName;
  return { page, params: Object.fromEntries(new URLSearchParams(q ?? '')) };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<WorkspaceState>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [{ page, params }, setRoute] = useState(readHash);
  const saveTimer = useRef<number>(0);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { console.warn('Could not persist workspace', e); }
    }, 300);
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

  const readOnly = ROLES[s.role]?.readOnly ?? false;

  const act = useCallback((action: string, detail: string, recipe: Recipe, opts: ActOpts = {}) => {
    if (readOnly && !opts.allowReadOnly) {
      toast(`${ROLES[s.role].label} has read-only access — switch role in the profile menu to make changes.`, 'warning');
      return false;
    }
    setS((prev) => {
      const draft = structuredClone(prev);
      recipe(draft);
      if (!opts.skipIssues) draft.issues = recomputeIssues(draft);
      draft.audit = [{ id: uid('a'), ts: new Date().toISOString(), actor: draft.currentUser, action, detail, kind: opts.kind ?? 'data' }, ...draft.audit].slice(0, 2000);
      return draft;
    });
    return true;
  }, [readOnly, s.role, toast]);

  const navigate = useCallback((p: PageName, prm: Record<string, string> = {}) => {
    const q = new URLSearchParams(prm).toString();
    location.hash = `/${encodeURIComponent(p)}${q ? `?${q}` : ''}`;
    setRoute({ page: p, params: prm });
    window.scrollTo({ top: 0 });
  }, []);

  const replaceWorkspace = useCallback((w: WorkspaceState, label: string) => {
    w.issues = recomputeIssues(w);
    w.audit = [{ id: uid('a'), ts: new Date().toISOString(), actor: w.currentUser, action: label, detail: 'Workspace replaced', kind: 'system' }, ...w.audit];
    setS(w);
  }, []);

  const m = useMemo(() => buildModel(s), [s]);

  const value = useMemo(() => ({ s, m, act, toast, toasts, page, params, navigate, readOnly, replaceWorkspace }), [s, m, act, toast, toasts, page, params, navigate, readOnly, replaceWorkspace]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

export function resetToDemo() { return buildDemoWorkspace(SAMPLE_FILES); }
export function blankWorkspace() { return emptyWorkspace(); }
