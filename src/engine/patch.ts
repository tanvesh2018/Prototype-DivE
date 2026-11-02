/**
 * Undo support. Every audited action stores a small change set (patch):
 * the exact values it changed, so that ANY decision in a decision log can be
 * reverted later — not just the last one.
 *
 * Arrays of records are diffed by identity (`_rid`, `id`, or `name`), so an
 * undo still finds the right record after other rows were added or removed.
 */
import type { PatchOp, WorkspaceState } from './types';

/** Top-level keys never captured (derived, noisy or append-only). */
const SKIP = new Set(['audit', 'aiCache', 'readNotifications', 'chat']);
const MAX_OPS = 6000;

const keyOf = (v: any): string | undefined => (v && typeof v === 'object' ? v._rid ?? v.id ?? v.name : undefined);
const isKeyedArray = (a: any[]) => a.length > 0 && a.every((x) => keyOf(x) !== undefined);

function equal(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => equal(a[k], b[k]));
}

function diffInto(a: any, b: any, path: (string | number)[], ops: PatchOp[]) {
  if (ops.length > MAX_OPS) return;
  if (a === b) return;
  if (Array.isArray(a) && Array.isArray(b) && (isKeyedArray(a) || isKeyedArray(b)) && [...a, ...b].every((x) => keyOf(x) !== undefined)) {
    const ma = new Map(a.map((x, i) => [keyOf(x)!, { x, i }]));
    const mb = new Map(b.map((x, i) => [keyOf(x)!, { x, i }]));
    ma.forEach(({ x, i }, k) => { if (!mb.has(k)) ops.push({ path: [...path, `k:${k}`], op: 'remove', before: x, index: i }); });
    mb.forEach(({ x, i }, k) => {
      const old = ma.get(k);
      if (!old) ops.push({ path: [...path, `k:${k}`], op: 'insert', after: x, index: i });
      else diffInto(old.x, x, [...path, `k:${k}`], ops);
    });
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
      if (path.length === 0 && SKIP.has(k)) return;
      diffInto(a[k], b[k], [...path, k], ops);
    });
    return;
  }
  if (!equal(a, b)) ops.push({ path, op: 'set', before: a === undefined ? undefined : structuredClone(a), after: b === undefined ? undefined : structuredClone(b) });
}

export function diffState(before: WorkspaceState, after: WorkspaceState): PatchOp[] | null {
  const ops: PatchOp[] = [];
  diffInto(before, after, [], ops);
  return ops.length > MAX_OPS ? null : ops;
}

function resolveParent(root: any, path: (string | number)[]) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (cur == null) return null;
    if (typeof seg === 'string' && seg.startsWith('k:') && Array.isArray(cur)) cur = cur.find((x: any) => keyOf(x) === seg.slice(2));
    else cur = cur[seg as any];
  }
  return cur;
}

/** Apply the inverse of a patch to a draft. Returns the number of conflicting ops (value changed since). */
export function revertPatch(draft: any, ops: PatchOp[]): number {
  let conflicts = 0;
  for (const o of [...ops].reverse()) {
    const last = o.path[o.path.length - 1];
    const parent = resolveParent(draft, o.path);
    if (parent == null) { conflicts++; continue; }
    if (o.op === 'set') {
      const cur = typeof last === 'string' && last.startsWith('k:') ? undefined : parent[last as any];
      if (!equal(cur, o.after)) conflicts++;
      if (o.before === undefined) delete parent[last as any];
      else parent[last as any] = structuredClone(o.before);
    } else if (Array.isArray(parent)) {
      const key = String(last).slice(2);
      const idx = parent.findIndex((x: any) => keyOf(x) === key);
      if (o.op === 'insert') { if (idx >= 0) parent.splice(idx, 1); else conflicts++; }
      else if (o.op === 'remove') { if (idx < 0) parent.splice(Math.min(o.index ?? parent.length, parent.length), 0, structuredClone(o.before)); else conflicts++; }
    } else conflicts++;
  }
  return conflicts;
}
