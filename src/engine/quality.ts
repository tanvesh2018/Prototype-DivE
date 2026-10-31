import { DATASET, HYGIENE_DATASETS, type DatasetKey } from './glossary';
import type { Issue, WorkspaceState } from './types';
import { addDays, similarity, type Row } from './util';

const blank = (v: any) => v === null || v === undefined || String(v).trim() === '';

export function rowLabel(key: DatasetKey, r: Row) {
  const d = DATASET[key];
  const id = d.idField ? r[d.idField] : '';
  const name = d.nameField ? r[d.nameField] : '';
  if (r.label) return r.label;
  return [id, name && name !== id ? name : ''].filter(Boolean).join(' · ') || r._rid;
}

function staleCutoff(asOf: string, months: number) {
  return addDays(asOf, -Math.round(months * 30.4));
}

/** Recompute all quality issues; keep user decisions/AI suggestions from previous runs. */
export function recomputeIssues(s: WorkspaceState): Issue[] {
  const fresh: Issue[] = [];
  const ds = s.datasets;
  const cut = staleCutoff(s.deal.asOf, s.config.staleMonths);
  const ids = (k: DatasetKey, field: string) => new Set((ds[k]?.rows ?? []).filter((r) => !r._retired).map((r) => String(r[field] ?? '').trim()).filter(Boolean));
  const serverIds = ds.servers ? ids('servers', 'server_id') : null;
  const appIds = ds.applications ? ids('applications', 'app_id') : null;
  const segIds = ds.network ? ids('network', 'network_id') : null;
  const serverById = new Map((ds.servers?.rows ?? []).map((r) => [r.server_id, r]));
  const licById = new Map((ds.licences?.rows ?? []).map((r) => [r.licence_id, r]));

  // segment majority values for network fills
  const segSite = new Map<string, Map<string, number>>();
  const segOwner = new Map<string, Map<string, number>>();
  (ds.network?.rows ?? []).forEach((r) => {
    const inc = (m: Map<string, Map<string, number>>, v: string) => {
      if (blank(v)) return;
      const mm = m.get(r.network_id) ?? new Map();
      mm.set(v, (mm.get(v) ?? 0) + 1);
      m.set(r.network_id, mm);
    };
    inc(segSite, r.site); inc(segOwner, r.ownership);
  });
  const majority = (m: Map<string, Map<string, number>>, seg: string) => {
    const mm = m.get(seg);
    if (!mm) return null;
    return [...mm.entries()].sort((a, b) => b[1] - a[1])[0];
  };

  for (const key of HYGIENE_DATASETS) {
    const d = ds[key];
    if (!d) continue;
    const def = DATASET[key];
    const rows = d.rows.filter((r) => !r._retired);
    const seen = new Map<string, Row>();
    const push = (i: Omit<Issue, 'id' | 'dataset' | 'status' | 'label' | 'rid'> & { r: Row }) => {
      const { r, ...rest } = i;
      fresh.push({ id: `${key}:${i.type}:${r._rid}:${i.field ?? ''}`, dataset: key, status: 'open', label: rowLabel(key, r), ...rest, rid: r._rid });
    };
    for (const r of rows) {
      // exact duplicates
      const idv = def.idField ? String(r[def.idField] ?? '').trim() : '';
      if (idv) {
        const first = seen.get(idv);
        if (first) push({ r, type: 'duplicate', message: `Duplicate of ${idv} (same ID appears twice)`, relatedRid: first._rid, suggestion: { value: 'merge', reason: 'Exact ID match — keep the more complete record', source: 'rule', confidence: 0.99 } });
        else seen.set(idv, r);
      }
      // missing required values
      for (const fd of def.fields) {
        if (!fd.required || fd.pii) continue;
        if (!(fd.key in r) && d.mapping.length && !d.mapping.some((m) => m.target === fd.key)) continue;
        if (!blank(r[fd.key])) continue;
        let suggestion: Issue['suggestion'];
        if (key === 'applications' && fd.key === 'site') {
          const srv = serverById.get(r.hosting_server_id);
          if (srv?.site) suggestion = { value: srv.site, reason: `Copied from linked server ${srv.server_id} (${srv.site})`, source: 'rule', confidence: 0.95 };
        }
        if (key === 'network' && (fd.key === 'site' || fd.key === 'ownership')) {
          const mj = majority(fd.key === 'site' ? segSite : segOwner, r.network_id);
          if (mj) suggestion = { value: mj[0], reason: `${mj[1]} other devices on ${r.network_id} use "${mj[0]}"`, source: 'rule', confidence: 0.9 };
        }
        if (key === 'applications' && fd.key === 'vendor') {
          const lic = licById.get(r.licence_id);
          if (lic?.vendor) suggestion = undefined; // left for AI — linked licence is a clue it can use
        }
        push({ r, type: 'missing', field: fd.key, message: `${fd.label} is blank`, suggestion });
      }
      // broken links
      if (key === 'applications') {
        if (serverIds && r.hosting_server_id && !serverIds.has(r.hosting_server_id)) push({ r, type: 'broken_link', field: 'hosting_server_id', message: `Runs on ${r.hosting_server_id}, but no such server exists in the server file` });
        if (segIds && r.network_id && !segIds.has(r.network_id)) push({ r, type: 'broken_link', field: 'network_id', message: `Network ${r.network_id} not found in network assets` });
        if (r.user_count === 0) push({ r, type: 'orphan', message: 'App has 0 users — still in use or retired?' });
      }
      if (key === 'licences' && appIds && r.app_id && !appIds.has(r.app_id)) push({ r, type: 'broken_link', field: 'app_id', message: `Licence belongs to ${r.app_id}, which does not exist` });
      if (key === 'costs' && appIds && r.app_id && !appIds.has(r.app_id)) push({ r, type: 'broken_link', field: 'app_id', message: `Cost line points to unknown system ${r.app_id}` });
      if (key === 'servers' && ds.applications) {
        const hosted = ds.applications.rows.some((a) => !a._retired && a.hosting_server_id === r.server_id);
        if (!hosted && !blank(r.server_id)) push({ r, type: 'orphan', message: 'Server hosts no application — still needed?' });
      }
      // stale
      const last = r.last_updated as string | null;
      if (key !== 'identity' && key !== 'people' && last && /^\d{4}-/.test(last) && last < cut) {
        push({ r, type: 'stale', field: 'last_updated', message: `Not updated since ${last} (> ${s.config.staleMonths} months)` });
      }
    }
    // look-alike duplicates (names) for small inventories
    if ((key === 'servers' || key === 'applications') && rows.length < 400) {
      const nameF = def.nameField!;
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i], b = rows[j];
          if (a[def.idField!] === b[def.idField!]) continue;
          const sim = similarity(a[nameF], b[nameF]);
          if (sim >= 0.6 && (a.site ?? '') === (b.site ?? '') && (a.ownership ?? a.owner_team ?? '') === (b.ownership ?? b.owner_team ?? '')) {
            const conf = Math.min(0.97, 0.6 + sim * 0.35);
            push({ r: b, type: 'lookalike', relatedRid: a._rid, message: `"${b[nameF]}" (${b[def.idField!]}) looks like "${a[nameF]}" (${a[def.idField!]})`, suggestion: { value: 'merge', reason: `Similar name, same site (${a.site || '—'}) and same owner (${a.ownership ?? a.owner_team ?? '—'})`, source: 'rule', confidence: Math.round(conf * 100) / 100 } });
          }
        }
      }
    }
  }

  const prev = new Map(s.issues.map((i) => [i.id, i]));
  return fresh.map((i) => {
    const p = prev.get(i.id);
    if (!p) return i;
    return { ...i, status: p.status === 'dismissed' ? 'dismissed' : i.status, suggestion: p.suggestion && p.suggestion.source !== 'rule' ? p.suggestion : i.suggestion, resolution: p.resolution };
  });
}

export function hygieneScore(s: WorkspaceState, key: DatasetKey): number | null {
  const d = s.datasets[key];
  if (!d || !DATASET[key].hygiene) return null;
  const total = d.rows.length;
  if (!total) return 100;
  const dirty = new Set(s.issues.filter((i) => i.dataset === key && i.status === 'open').map((i) => i.rid));
  return Math.round((100 * (total - dirty.size)) / total);
}

export function issueCounts(s: WorkspaceState) {
  const open = s.issues.filter((i) => i.status === 'open');
  return {
    open: open.length,
    missing: open.filter((i) => i.type === 'missing').length,
    duplicates: open.filter((i) => i.type === 'duplicate' || i.type === 'lookalike').length,
    broken: open.filter((i) => i.type === 'broken_link').length,
    stale: open.filter((i) => i.type === 'stale' || i.type === 'orphan').length,
    aiPending: open.filter((i) => i.suggestion && i.suggestion.source !== 'rule').length,
  };
}

/** Merge b into a: fill a's blanks from b, then drop b. */
export function mergeRows(rows: Row[], keepRid: string, dropRid: string): Row[] {
  const keep = rows.find((r) => r._rid === keepRid);
  const drop = rows.find((r) => r._rid === dropRid);
  if (!keep || !drop) return rows;
  const filledKeep = Object.keys(keep).filter((k) => !blank(keep[k])).length;
  const filledDrop = Object.keys(drop).filter((k) => !blank(drop[k])).length;
  const [winner, loser] = filledKeep >= filledDrop ? [keep, drop] : [drop, keep];
  const merged = { ...winner };
  Object.keys(loser).forEach((k) => { if (blank(merged[k]) && !blank(loser[k])) merged[k] = loser[k]; });
  merged._mergedFrom = [...(winner._mergedFrom ?? []), loser[Object.keys(loser).find((k) => k.endsWith('_id')) ?? '_rid']];
  return rows.filter((r) => r._rid !== loser._rid).map((r) => (r._rid === winner._rid ? merged : r));
}
