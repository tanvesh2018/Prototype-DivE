export type Row = Record<string, any> & { _rid: string };

// ---------- CSV ----------
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) out.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x.trim() !== '')) out.push(row); }
  const [headers = [], ...rows] = out;
  return { headers: headers.map((h) => h.trim()), rows };
}

export function toCSV(rows: Record<string, any>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((c) => !c.startsWith('_'));
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export function download(fileName: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPrintable(title: string, html: string) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Inter,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:900px}h1{font-size:24px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #fd5108;padding-bottom:4px}
  table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f4f4f4}.muted{color:#666;font-size:12px}
  .big{font-size:44px;font-weight:700}.pill{display:inline-block;padding:3px 10px;border-radius:10px;font-weight:700;font-size:12px}.red{background:#fff0ef;color:#c43131}.amber{background:#fff5df;color:#b66a00}.green{background:#eaf6ef;color:#18864b}
  .brand{font-weight:700;border-bottom:4px solid #fd5108;display:inline-block;margin-bottom:18px}@media print{button{display:none}}</style></head><body>
  <button onclick="window.print()" style="float:right;padding:8px 14px;background:#fd5108;color:#fff;border:0;border-radius:4px;cursor:pointer">Print / Save as PDF</button>
  ${html}</body></html>`);
  w.document.close();
  return true;
}

// ---------- values ----------
export function normaliseHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9#%/ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[$₹,\s]|INR|Rs\.?/gi, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY (if day>12 ambiguity resolves). */
export function parseDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

export function yes(v: any): boolean {
  return /^(y|yes|true|1)\b/i.test(String(v ?? '').trim());
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso?: string | null, withYear = false) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS[+m - 1]}${withYear ? ' ' + y : ''}`;
}
export function money(n: number | null | undefined, compact = true) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (compact) {
    if (Math.abs(n) >= 1e6) return `₹${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
    if (Math.abs(n) >= 1e3) return `₹${Math.round(n / 1e3)}K`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
export const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
export const initials = (name: string) => name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

// ---------- similarity ----------
export function tokens(s: string) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map((t) => t.replace(/^0+(\d)/, '$1'));
}
export function similarity(a: string, b: string) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}
