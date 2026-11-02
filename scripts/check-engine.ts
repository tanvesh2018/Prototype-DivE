/**
 * Engine sanity check — builds each demo deal workspace from /sample-data and
 * prints the headline numbers. Run: npm run check:engine  (optionally: -- phoenix)
 * Use it after changing sample data, formulas or weights; compare with the
 * "Golden numbers" in AGENTS.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoWorkspace } from '../src/engine/workspace';
import { buildModel, suggestMilestone } from '../src/engine/model';
import { hygieneScore } from '../src/engine/quality';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-data');
const readDir = (dir: string) => {
  const files: Record<string, string> = {};
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isFile()) files[f] = fs.readFileSync(p, 'utf8'); }
  return files;
};
const only = process.argv[2];
const deals: [string, string][] = [['rioja', root], ['phoenix', path.join(root, 'phoenix')]];

for (const [id, dir] of deals) {
  if (only && only !== id) continue;
  const t0 = Date.now();
  const s = buildDemoWorkspace(readDir(dir), id);
  const m = buildModel(s);
  console.log(`\n=== ${s.deal.name} (${s.deal.buyer} / ${s.deal.seller}) — built in ${Date.now() - t0} ms ===`);
  console.log('Datasets & hygiene:');
  for (const k of Object.keys(s.datasets)) console.log(`  ${k.padEnd(14)} ${String(s.datasets[k as keyof typeof s.datasets]!.rows.length).padStart(6)} rows  hygiene ${hygieneScore(s, k as any) ?? 'n/a'}`);
  console.log(`Open quality issues: ${s.issues.filter((i) => i.status === 'open').length}`);
  console.log(`Apps: ${m.apps.length} · ${s.deal.milestoneLabel}-critical: ${m.items.length} · move groups: ${m.moveGroups.length}`);
  console.log('Components:', m.components.map((c) => `${c.name} ${c.score}`).join(' | '));
  console.log(`Readiness: underlying ${m.underlying} → score ${m.score} ${m.signal}${m.capped ? ' (capped)' : ''}`);
  const sg = suggestMilestone(s, m);
  console.log(`Suggested ${s.deal.milestoneLabel}: ${sg.suggested} (${sg.delta >= 0 ? '+' : ''}${sg.delta} days vs ${s.deal.day1})`);
  console.log(`Costs: total ${m.sepTotal} seller ${m.sellerTotal} buyer ${m.buyerTotal} disputed ${m.disputedAmount}`);
  console.log('TSA:', m.tsa.map((t) => `${t.row.service}=${t.status}`).join(', '));
  if (m.decisions.length) console.log('Decisions:', m.decisions.map((d) => `${d.id}→${d.recommended?.name} (${d.recommended?.total})`).join('; '));
  console.log(`Benchmark consent week1 ${m.bench.week1}% vs late ${m.bench.late}%${m.prospects[0] ? ` · top prospect ${m.prospects[0].row.company} ${m.prospects[0].score}/10` : ''}`);
}
