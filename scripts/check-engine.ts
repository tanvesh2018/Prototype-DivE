/**
 * Engine sanity check — builds the demo workspace from /sample-data and
 * prints the headline numbers. Run: npm run check:engine
 * Use it after changing sample data, formulas or weights.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoWorkspace } from '../src/engine/workspace';
import { buildModel } from '../src/engine/model';
import { hygieneScore } from '../src/engine/quality';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-data');
const files: Record<string, string> = {};
for (const f of fs.readdirSync(dir)) files[f] = fs.readFileSync(path.join(dir, f), 'utf8');
const s = buildDemoWorkspace(files);
const m = buildModel(s);
console.log('Datasets & hygiene:');
for (const k of Object.keys(s.datasets)) console.log(`  ${k.padEnd(14)} ${String(s.datasets[k as keyof typeof s.datasets]!.rows.length).padStart(5)} rows  hygiene ${hygieneScore(s, k as any) ?? 'n/a'}`);
console.log(`Open quality issues: ${s.issues.filter((i) => i.status === 'open').length}`);
console.log(`Apps: ${m.apps.length} · Day-1 critical: ${m.items.length} · move groups: ${m.moveGroups.length}`);
console.log('Components:', m.components.map((c) => `${c.name} ${c.score}`).join(' | '));
console.log(`Readiness: underlying ${m.underlying} → score ${m.score} ${m.signal}${m.capped ? ' (capped)' : ''}`);
console.log(`Costs: total ${m.sepTotal} seller ${m.sellerTotal} buyer ${m.buyerTotal} disputed ${m.disputedAmount}`);
console.log('TSA:', m.tsa.map((t) => `${t.row.service}=${t.status}`).join(', '));
console.log('Decisions:', m.decisions.map((d) => `${d.id}→${d.recommended?.name} (${d.recommended?.total})`).join('; '));
console.log(`Benchmark consent week1 ${m.bench.week1}% vs late ${m.bench.late}% · top prospect ${m.prospects[0]?.row.company} ${m.prospects[0]?.score}/10`);
