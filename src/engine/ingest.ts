import { DATASET, DATASETS, type DatasetKey } from './glossary';
import type { ColumnMapping, DatasetState } from './types';
import { normaliseHeader, parseCSV, parseDate, parseNumber, similarity, type Row } from './util';

export interface ParsedUpload {
  fileName: string;
  kind: 'csv' | 'json' | 'text';
  headers: string[];
  rows: string[][];
  text: string;
  json?: any;
}

export function parseUpload(fileName: string, text: string): ParsedUpload {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) {
    const json = JSON.parse(text);
    return { fileName, kind: 'json', headers: [], rows: [], text, json };
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return { fileName, kind: 'text', headers: [], rows: [], text };
  const { headers, rows } = parseCSV(text);
  return { fileName, kind: 'csv', headers, rows, text };
}

/** Pick the most likely dataset from file name + headers. */
export function detectDataset(p: ParsedUpload): { key: DatasetKey; confidence: number } {
  if (p.kind === 'json') return { key: 'learning', confidence: 0.95 };
  const fn = p.fileName.toLowerCase();
  if (p.kind === 'text') return { key: /lesson|closing/.test(fn) ? 'spa' : 'spa', confidence: 0.9 };
  let best: { key: DatasetKey; score: number } = { key: 'applications', score: -1 };
  for (const d of DATASETS) {
    if (d.format !== 'csv') continue;
    let score = 0;
    for (const h of p.headers) {
      const m = bestFieldFor(h, d.key);
      if (m && m.confidence >= 0.75) score += m.confidence;
    }
    score = score / Math.max(4, d.fields.length * 0.6);
    if (d.filenameHints.some((x) => fn.includes(x))) score += 0.6;
    if (score > best.score) best = { key: d.key, score };
  }
  return { key: best.key, confidence: Math.min(0.99, best.score / 2) };
}

function bestFieldFor(header: string, key: DatasetKey) {
  const h = normaliseHeader(header);
  let best: { target: string; confidence: number; reason: string } | null = null;
  for (const fd of DATASET[key].fields) {
    for (const syn of [fd.key.replace(/_/g, ' '), fd.label.toLowerCase(), ...fd.synonyms]) {
      const s = normaliseHeader(syn);
      let c = 0;
      let why = '';
      if (h === s) { c = 0.97; why = `Header "${header}" matches glossary synonym "${syn}"`; }
      else if (h.startsWith(s) || h.includes(s)) { c = 0.86; why = `Header "${header}" contains "${syn}"`; }
      else {
        const sim = similarity(h, s);
        if (sim >= 0.5) { c = 0.55 + sim * 0.3; why = `Header words overlap with "${syn}"`; }
      }
      if (c > (best?.confidence ?? 0)) best = { target: fd.key, confidence: c, reason: why };
    }
  }
  return best;
}

/** Rule-based column matcher (the AI matcher refines this when Gemini is configured). */
export function ruleMapColumns(headers: string[], key: DatasetKey): ColumnMapping[] {
  const used = new Set<string>();
  const cand = headers.map((h) => ({ h, m: bestFieldFor(h, key) }));
  // assign highest confidence first to avoid two headers claiming one field
  const order = [...cand].sort((a, b) => (b.m?.confidence ?? 0) - (a.m?.confidence ?? 0));
  const result = new Map<string, ColumnMapping>();
  for (const { h, m } of order) {
    if (m && !used.has(m.target) && m.confidence >= 0.6) {
      used.add(m.target);
      result.set(h, { source: h, target: m.target, confidence: Math.round(m.confidence * 100) / 100, reason: m.reason, method: 'rule', confirmed: m.confidence >= 0.8 });
    } else {
      result.set(h, { source: h, target: null, confidence: 0, reason: 'No glossary match — will be kept as an extra column', method: 'rule', confirmed: false });
    }
  }
  return headers.map((h) => result.get(h)!);
}

export interface IngestOptions { maskPII: boolean }

/** Convert raw rows to standard rows using the confirmed mapping. */
export function applyMapping(p: ParsedUpload, key: DatasetKey, mapping: ColumnMapping[], opts: IngestOptions): DatasetState {
  const def = DATASET[key];
  const now = new Date().toISOString();
  if (def.format === 'text') {
    return { key, fileName: p.fileName, uploadedAt: now, rawCount: p.text.split('\n').filter(Boolean).length, rows: [], mapping: [], text: p.text };
  }
  if (def.format === 'json') {
    const recs: any[] = Array.isArray(p.json) ? p.json : p.json?.records ?? [];
    return { key, fileName: p.fileName, uploadedAt: now, rawCount: recs.length, rows: recs.map((r, i) => ({ ...r, _rid: `${key}-${i}` })), mapping: [] };
  }
  const fieldType = Object.fromEntries(def.fields.map((f) => [f.key, f.type ?? 'string']));
  let rows: Row[] = p.rows.map((r, i) => {
    const o: Row = { _rid: `${key}-${i}` };
    mapping.forEach((m, ci) => {
      const raw = (r[ci] ?? '').trim();
      const target = m.target ?? `x_${normaliseHeader(m.source).replace(/\s+/g, '_')}`;
      const t = m.target ? fieldType[m.target] : 'string';
      if (t === 'number') o[target] = parseNumber(raw);
      else if (t === 'date') o[target] = parseDate(raw) ?? (raw || null);
      else o[target] = raw;
    });
    return o;
  });
  const notes: string[] = [];
  let piiMasked: DatasetState['piiMasked'];
  const piiFields = def.fields.filter((f) => f.pii).map((f) => f.key);
  if (piiFields.length) {
    if (opts.maskPII) {
      const original = rows.length;
      rows = maskPersonalData(rows, key, piiFields);
      piiMasked = { fields: piiFields, originalRows: original };
      notes.push(`Personal data hidden: ${piiFields.join(', ')} removed; ${original} people summarised into ${rows.length} role/site groups.`);
    } else {
      notes.push('WARNING: personal-data masking is switched OFF in Governance — names and emails were stored.');
    }
  }
  return { key, fileName: p.fileName, uploadedAt: now, rawCount: p.rows.length, rows, mapping, piiMasked, ingestNotes: notes };
}

/** Replace names/emails with counts per role + site (+ useful aggregates). */
function maskPersonalData(rows: Row[], key: DatasetKey, pii: string[]): Row[] {
  const groups = new Map<string, Row>();
  rows.forEach((r) => {
    const k = `${r.role || 'Unknown role'}|${r.site || ''}`;
    const g = groups.get(k) ?? { _rid: `${key}-g${groups.size}`, role: r.role || '', site: r.site || '', count: 0 } as Row;
    g.count++;
    if (key === 'identity') {
      g.department = r.department;
      g.mfa_missing = (g.mfa_missing ?? 0) + (/^n/i.test(String(r.mfa_enabled ?? '')) ? 1 : 0);
      g.laptops = (g.laptops ?? 0) + (r.laptop_id ? 1 : 0);
      g.stale_accounts = (g.stale_accounts ?? 0);
      const last = r.last_updated as string | null;
      if (!g.last_updated || (last && last > g.last_updated)) g.last_updated = last;
      g._oldest = !g._oldest || (last && last < g._oldest) ? last : g._oldest;
    } else {
      g.transfer_type = r.transfer_type;
      g.moving = (g.moving ?? 0) + (/moving/i.test(r.transfer_type ?? '') ? 1 : 0);
      g.needs_reimage = (g.needs_reimage ?? 0) + (/^y/i.test(String(r.needs_reimage ?? '')) ? 1 : 0);
      g.transfer_date = r.transfer_date;
    }
    pii.forEach((f) => delete r[f]);
    groups.set(k, g);
  });
  return Array.from(groups.values()).map((g) => ({ ...g, label: `${g.role}, ${g.site}: ${g.count}` }));
}

/** Count stale identity accounts before masking removes the detail. */
export function staleAccountCount(p: ParsedUpload, mapping: ColumnMapping[], asOf: string, months: number) {
  const idx = mapping.findIndex((m) => m.target === 'last_updated');
  if (idx < 0) return 0;
  const limit = new Date(asOf + 'T00:00:00Z');
  limit.setUTCMonth(limit.getUTCMonth() - months);
  const cut = limit.toISOString().slice(0, 10);
  return p.rows.filter((r) => { const d = parseDate(r[idx]); return d && d < cut; }).length;
}
