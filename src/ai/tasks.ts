import type { SettlePlan } from '../engine/model';
/**
 * AI task registry — one entry per AI feature in DealSync.
 * Each task defines: the Gemini system instruction, how to build the prompt
 * from live data, and a deterministic fallback used when no key is set.
 * To change how an AI feature behaves, edit it here (prompts live in one place).
 */
import { BUCKETS, COMPONENTS } from '../engine/glossary';
import { money } from '../engine/util';
import { frameworksText } from './frameworks';

export interface AITask<I, O> {
  id: string;
  label: string;
  system: string;
  json: boolean;
  temperature?: number;
  maxTokens?: number;
  prompt: (input: I) => string;
  parse?: (raw: any, input: I) => O;
  fallback: (input: I) => O;
}

const GUARD = 'You are DealSync, an assistant inside PwC\'s deal technology command centre. You only suggest; a human approves every change. Never invent facts that are not in the data provided. Be concise and specific; quote numbers from the data. Write every money amount in Indian rupees with the ₹ symbol (e.g. ₹1.74M, ₹700K), never $.';
const J = (o: unknown) => JSON.stringify(o, null, 1);

// ---------------------------------------------------------------- 1. column mapping
export interface ColumnMapIn { dataset: string; glossary: { key: string; label: string; description: string }[]; headers: string[]; sample: string[][]; rule: { source: string; target: string | null; confidence: number; reason: string }[] }
export interface ColumnMapOut { mappings: { source: string; target: string | null; confidence: number; reason: string }[] }
export const columnMapping: AITask<ColumnMapIn, ColumnMapOut> = {
  id: 'column-mapping', label: 'AI column matching', json: true,
  system: `${GUARD} You map spreadsheet columns to a standard glossary. Use the header words AND the sample values (e.g. values like "SRV-14" mean a server id). Only map to glossary keys provided. If nothing fits, use null. Confidence 0-1.`,
  prompt: (i) => `Dataset: ${i.dataset}\nGlossary (key: label — description):\n${i.glossary.map((g) => `${g.key}: ${g.label} — ${g.description}`).join('\n')}\n\nHeaders: ${J(i.headers)}\nFirst 3 rows:\n${i.sample.map((r) => J(r)).join('\n')}\n\nReturn JSON {"mappings":[{"source":"<header>","target":"<glossary key or null>","confidence":0.0,"reason":"<short why>"}]} with one entry per header in order.`,
  parse: (raw, i) => ({ mappings: i.headers.map((h) => { const m = (raw.mappings ?? []).find((x: any) => x.source === h); const valid = m && (m.target === null || i.glossary.some((g) => g.key === m.target)); return valid ? { source: h, target: m.target, confidence: Number(m.confidence) || 0.5, reason: m.reason ?? '' } : i.rule.find((r) => r.source === h)!; }) }),
  fallback: (i) => ({ mappings: i.rule }),
};

// ---------------------------------------------------------------- 2. gap filling
export interface GapIn { items: { id: string; dataset: string; field: string; record: Record<string, any>; clues: Record<string, any> }[] }
export interface GapOut { fills: { id: string; value: string; reason: string; confidence: number }[] }
export const gapFill: AITask<GapIn, GapOut> = {
  id: 'gap-fill', label: 'AI gap filling', json: true,
  system: `${GUARD} You fill simple descriptive fields (owner team, vendor, currency, cost centre) only when the record or its linked records give a clear clue. Otherwise answer "unknown". Always give the reason (which clue you used).`,
  prompt: (i) => `Suggest values for these blank fields. Return JSON {"fills":[{"id":"","value":"","reason":"","confidence":0.0}]}.\n${i.items.map((x) => `ID ${x.id} | dataset ${x.dataset} | blank field "${x.field}"\nrecord: ${J(x.record)}\nlinked clues: ${J(x.clues)}`).join('\n\n')}`,
  fallback: (i) => ({
    fills: i.items.map((x) => {
      const c = x.clues;
      if (x.field === 'vendor' && c.licenceVendor) return { id: x.id, value: c.licenceVendor, reason: `Linked licence ${c.licenceId} is published by ${c.licenceVendor}`, confidence: 0.86 };
      if (x.field === 'owner_team' && c.sameServerOwner) return { id: x.id, value: c.sameServerOwner, reason: `Other apps on ${x.record.hosting_server_id} are owned by ${c.sameServerOwner}`, confidence: 0.72 };
      if (x.field === 'currency') {
        const n = String(x.record.vendor_name ?? '');
        if (/sdn bhd/i.test(n)) return { id: x.id, value: 'MYR', reason: '"Sdn Bhd" is a Malaysian company suffix', confidence: 0.8 };
        if (/pvt ltd/i.test(n)) return { id: x.id, value: 'INR', reason: '"Pvt Ltd" suggests an Indian supplier', confidence: 0.7 };
        if (/inc|llc/i.test(n)) return { id: x.id, value: 'USD', reason: 'US company suffix (Inc/LLC)', confidence: 0.75 };
      }
      if (x.field === 'cost_centre' && c.glCostCentre) return { id: x.id, value: c.glCostCentre, reason: `Most vendors on GL ${x.record.gl_account} use ${c.glCostCentre}`, confidence: 0.66 };
      return { id: x.id, value: 'unknown', reason: 'No clear clue in the record or its linked records — send to the owner queue', confidence: 0.3 };
    }),
  }),
};

// ---------------------------------------------------------------- 3. hidden links
export interface LinksIn { apps: { id: string; name: string; description: string; component: string }[]; existing: string[] }
export interface LinksOut { links: { from: string; to: string; reason: string; confidence: number }[] }
const KNOWN_FLOWS: [string, string, string][] = [
  ['order', 'ledger', 'orders need to be billed, so order data flows to finance'],
  ['order', 'finance', 'orders need to be invoiced in the ERP'],
  ['design', 'vault', 'design tools save files to the design vault'],
  ['yield', 'supply', 'wafer-start plans depend on expected yield'],
  ['wafer', 'yield', 'test data feeds yield analysis'],
  ['portal', 'crm', 'customer quotes are synchronised with the CRM pipeline'],
  ['crm', 'order', 'won quotes become orders'],
  ['expense', 'ledger', 'expense claims post journals to the general ledger'],
  ['procure', 'ledger', 'purchase orders create payables in the ERP'],
  ['payroll', 'ledger', 'payroll journals post to the ledger'],
  ['employee', 'payroll', 'HR changes drive payroll'],
  ['simulation', 'licence server', 'simulation jobs check out EDA licences'],
  ['ip block', 'design', 'designs pull IP blocks from the library'],
  ['specification', 'vault', 'spec sheets reference stored design files'],
];
export const hiddenLinks: AITask<LinksIn, LinksOut> = {
  id: 'hidden-links', label: 'AI hidden-link finder', json: true,
  system: `${GUARD} You find dependencies nobody recorded, using business sense from app names and functions (e.g. "Order Processing probably sends data to Finance, because orders need to be billed"). Suggest at most 6 new links that are NOT in the existing list. Give a reason for each.`,
  prompt: (i) => `Applications:\n${i.apps.map((a) => `${a.id} ${a.name} [${a.component}] — ${a.description}`).join('\n')}\n\nAlready recorded links (from>to): ${i.existing.join(', ')}\n\nReturn JSON {"links":[{"from":"APP-xxx","to":"APP-yyy","reason":"","confidence":0.0}]}.`,
  parse: (raw, i) => ({ links: (raw.links ?? []).filter((l: any) => i.apps.some((a) => a.id === l.from) && i.apps.some((a) => a.id === l.to) && l.from !== l.to && !i.existing.includes(`${l.from}>${l.to}`)).slice(0, 6) }),
  fallback: (i) => {
    const out: LinksOut['links'] = [];
    const text = (a: LinksIn['apps'][number]) => `${a.name} ${a.description}`.toLowerCase();
    for (const [f, t, why] of KNOWN_FLOWS) {
      const A = i.apps.find((a) => text(a).includes(f));
      const B = i.apps.find((a) => a !== A && text(a).includes(t));
      if (A && B && !i.existing.includes(`${A.id}>${B.id}`) && !out.some((o) => o.from === A.id && o.to === B.id)) out.push({ from: A.id, to: B.id, reason: `${A.name} probably sends data to ${B.name} — ${why}.`, confidence: 0.7 });
    }
    return { links: out.slice(0, 6) };
  },
};

// ---------------------------------------------------------------- 4. trial run checklist
export interface TrialIn { app: string; link: string; whatBreaks: string }
export const trialChecklist: AITask<TrialIn, { steps: string[] }> = {
  id: 'trial-run', label: 'AI trial-run checklist', json: true,
  system: `${GUARD} Draft a short test checklist (5-7 steps) to safely switch off an unclear link in a test environment and see what breaks.`,
  prompt: (i) => `App: ${i.app}\nUnclear link: ${i.link}\nOwner says if switched off: ${i.whatBreaks}\nReturn JSON {"steps":["..."]}`,
  fallback: (i) => ({ steps: [`Snapshot ${i.app} test environment and record baseline health checks`, `Block the ${i.link} connection at the firewall in the test environment only`, `Run the top 5 user journeys of ${i.app} (login, open, save, export, print)`, 'Watch application and server logs for connection errors for 2 hours', 'Ask two key users to work normally and report anything that fails', 'Add every failing dependency to the DealSync map, then restore the link'] }),
};

// ---------------------------------------------------------------- 5. component tagging
export interface CompIn { apps: { id: string; name: string; description: string; current: string }[] }
export const componentTag: AITask<CompIn, { tags: { id: string; component: string; reason: string }[] }> = {
  id: 'component-tag', label: 'AI component tagging', json: true,
  system: `${GUARD} Tag each application to exactly one of these 12 deal components: ${COMPONENTS.join(', ')}.`,
  prompt: (i) => `${i.apps.map((a) => `${a.id} ${a.name} — ${a.description}`).join('\n')}\nReturn JSON {"tags":[{"id":"","component":"","reason":""}]}`,
  parse: (raw, i) => ({ tags: (raw.tags ?? []).filter((t: any) => (COMPONENTS as readonly string[]).includes(t.component) && i.apps.some((a) => a.id === t.id)) }),
  fallback: (i) => ({ tags: i.apps.map((a) => ({ id: a.id, component: a.current, reason: 'Keyword rule on app name and function' })) }),
};

// ---------------------------------------------------------------- 6. bucket advice
export interface BucketIn { app: Record<string, any>; ruleBucket: string; ruleReason: string; daysToDay1: number }
export const bucketAdvice: AITask<BucketIn, { bucket: string; reason: string }> = {
  id: 'bucket-advice', label: 'AI separation bucket', json: true,
  system: `${GUARD} Recommend one of 6 buckets: ${BUCKETS.join('; ')}. Rules: Transfer as-is (nothing shared with seller); Clone and Go (Day-1 critical, shared, can legally be copied); Commercial agreement / TSA (Day-1 critical but too tangled or not enough time, or unclear links); Stand-up new (old or cannot be copied and not needed on Day-1); Consolidate (buyer has similar); Extract and Sunset (buyer does not use). The reason must state the facts used, e.g. "TSA: Finance ERP is Day-1 critical, score 11, only 12 days to Day-1".`,
  prompt: (i) => `App facts: ${J(i.app)}\nDays to Day-1: ${i.daysToDay1}\nRule engine suggests: ${i.ruleBucket} (${i.ruleReason})\nReturn JSON {"bucket":"","reason":""}`,
  parse: (raw, i) => ((BUCKETS as readonly string[]).includes(raw.bucket) ? raw : { bucket: i.ruleBucket, reason: raw.reason ?? i.ruleReason }),
  fallback: (i) => ({ bucket: i.ruleBucket, reason: i.ruleReason }),
};

// ---------------------------------------------------------------- 7. board summary
export interface BoardIn { decision: string; approver: string; options: { name: string; security: number; productivity: number; cost: number; speed: number; total: number | null; removed: boolean }[]; recommended?: string; context?: string }
export const boardSummary: AITask<BoardIn, { summary: string }> = {
  id: 'board-summary', label: 'AI board summary', json: true,
  system: `${GUARD} Write exactly 4 short lines for a board explaining the trade-off in plain words. The recommendation comes from the formula — explain it, do not change it. Mention any option removed for failing the security check.`,
  prompt: (i) => `Decision: ${i.decision} (approver ${i.approver})\nOptions (1-5 scores; total = 35% security + 30% productivity + 20% cost + 15% speed; security < 3 removed):\n${J(i.options)}\nRecommended by formula: ${i.recommended}\nContext: ${i.context ?? ''}\nReturn JSON {"summary":"line1\\nline2\\nline3\\nline4"}`,
  fallback: (i) => {
    const ranked = i.options.filter((o) => !o.removed).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const [best, next] = ranked;
    const removed = i.options.filter((o) => o.removed);
    const lines = [
      best ? `${best.name} offers the strongest balance of security (${best.security}/5) and productivity (${best.productivity}/5), scoring ${best.total?.toFixed(2)}.` : 'No option passes the security check.',
      next ? `It is ahead of ${next.name} at ${next.total?.toFixed(2)}, which trades ${next.productivity < (best?.productivity ?? 0) ? 'staff productivity' : 'cost and speed'} for ${next.security > (best?.security ?? 0) ? 'extra security' : 'other benefits'}.` : 'There is no viable alternative.',
      removed.length ? `${removed.map((r) => r.name).join(', ')} was removed because it failed the minimum security threshold (score below 3).` : 'All options passed the minimum security threshold.',
      `Recommend ${i.approver} approves ${best?.name ?? 'a revised option'}${i.context ? `, ${i.context}` : ''}.`,
    ];
    return { summary: lines.join('\n') };
  },
};

// ---------------------------------------------------------------- 8. SPA clause reader
export interface SpaIn { clause: string; lines: { id: string; description: string; amount: number; cause: string; likeForLike: string }[] }
export interface SpaOut { lines: { id: string; answer: 'Seller' | 'Shared' | 'Buyer'; quote: string; reason: string }[] }
export const spaReader: AITask<SpaIn, SpaOut> = {
  id: 'spa-reader', label: 'AI SPA clause reader', json: true,
  system: `${GUARD} Read the cost-sharing clauses of a Share Purchase Agreement and, for each cost line, answer "what does the contract say": Seller (seller pays), Shared (split), or Buyer (buyer pays). Quote the exact sentence you relied on.`,
  prompt: (i) => `SPA text:\n"""${i.clause}"""\n\nCost lines:\n${i.lines.map((l) => `${l.id}: ${l.description} (${money(l.amount)}; cause ${l.cause}; ${l.likeForLike})`).join('\n')}\nReturn JSON {"lines":[{"id":"","answer":"Seller|Shared|Buyer","quote":"","reason":""}]}`,
  parse: (raw) => ({ lines: (raw.lines ?? []).map((l: any) => ({ ...l, answer: /^sel/i.test(l.answer) ? 'Seller' : /^buy/i.test(l.answer) ? 'Buyer' : 'Shared' })) }),
  fallback: (i) => {
    const sentences = i.clause.split(/(?<=\.)\s+|\n/).map((s) => s.trim()).filter(Boolean);
    const find = (re: RegExp) => sentences.find((s) => re.test(s)) ?? '';
    const shared = find(/shared equally|borne equally|split equally/i);
    const enh = find(/enhancement|upgrade/i);
    return {
      lines: i.lines.map((l) => {
        if (/asked for|faster|upgrade|enhanc|additional capacity/i.test(`${l.description} ${l.likeForLike}`) && enh) return { id: l.id, answer: 'Buyer' as const, quote: enh, reason: 'Purchaser-requested enhancement beyond like-for-like' };
        if (shared) return { id: l.id, answer: 'Shared' as const, quote: shared, reason: 'Separation cost — shared equally under the SPA' };
        return { id: l.id, answer: 'Shared' as const, quote: '(no explicit clause found)', reason: 'Defaulted to shared — please confirm' };
      }),
    };
  },
};

// ---------------------------------------------------------------- 9. early warning
export interface WarnIn { buyer?: string; daysToDay1: number; warnings: { id: string; title: string; workstream: string; owner: string; due: string; status: string; reason: string; critical: boolean; item?: string }[] }
export interface WarnOut { headline: string; detail: string; items: { id: string; nextStep: string }[] }
export const earlyWarning: AITask<WarnIn, WarnOut> = {
  id: 'early-warning', label: 'AI early warning', json: true,
  system: `${GUARD} Turn a list of red-flag tasks into a clear action: one headline (which workstream is likely to slip and why, with counts), one sentence detail with the single most important action today, and a concrete next step per task (who to escalate to, what to ask).`,
  prompt: (i) => `Days to Day-1: ${i.daysToDay1}\nFlagged tasks:\n${J(i.warnings)}\nReturn JSON {"headline":"","detail":"","items":[{"id":"","nextStep":""}]}`,
  fallback: (i) => {
    const byWs = new Map<string, WarnIn['warnings']>();
    i.warnings.forEach((w) => byWs.set(w.workstream, [...(byWs.get(w.workstream) ?? []), w]));
    const [ws, list] = [...byWs.entries()].sort((a, b) => b[1].filter((x) => x.critical).length - a[1].filter((x) => x.critical).length || b[1].length - a[1].length)[0] ?? ['—', []];
    const blocked = list.filter((x) => x.status === 'Blocked');
    const crit = list.some((x) => x.critical);
    return {
      headline: `Early warning: ${ws} workstream is likely to slip`,
      detail: `${list.length} ${ws.toLowerCase()} task${list.length === 1 ? ' is' : 's are'} flagged${blocked.length ? `, ${blocked.length} blocked (${blocked[0].title})` : ''}${crit ? ' on a Day-1 critical item' : ''}, with ${i.daysToDay1} days to Day-1. ${blocked.length ? `Escalate through ${i.buyer ?? "the buyer"}'s CIO today.` : 'Confirm owners and start dates today.'}`,
      items: i.warnings.map((w) => ({ id: w.id, nextStep: w.status === 'Blocked' ? `Escalate to engagement manager today; ${w.owner} to name the external dependency and a date.` : w.reason.startsWith('Not started') ? `${w.owner} to start today or hand over — due ${w.due}.` : w.reason === 'Overdue' ? `Agree a new date with ${w.owner} and record the reason.` : `${w.owner} to confirm a recovery plan at the next stand-up.` })),
    };
  },
};

// ---------------------------------------------------------------- 10. readiness path
export interface PathIn { score: number; underlying: number; signal: string; capped: boolean; blockers: string[]; weakest: { name: string; readiness: number; open: number; failed: number }[]; projections: { label: string; score: number; signal: string }[] }
export const readinessPath: AITask<PathIn, { text: string }> = {
  id: 'readiness-path', label: 'AI fastest path to GO', json: true,
  system: `${GUARD} Explain in 2-3 sentences the fastest path to a GO (90+) using ONLY the projections given (they come from the readiness formula). Name the specific items and actions.`,
  prompt: (i) => `Current: ${i.score} (${i.signal}); underlying ${i.underlying}; capped: ${i.capped}\nBlockers: ${i.blockers.join('; ') || 'none'}\nWeakest items: ${J(i.weakest)}\nFormula projections: ${J(i.projections)}\nReturn JSON {"text":""}`,
  fallback: (i) => {
    const p = i.projections;
    const first = p[0], last = p[p.length - 1];
    const w = i.weakest.slice(0, 3).map((x) => `${x.name} (${x.readiness}%: ${x.open} tasks open${x.failed ? `, ${x.failed} tests to rerun` : ''})`).join(', ');
    return { text: `${i.blockers.length ? `Clear the blocker first — ${i.blockers[0]}. ` : ''}${first ? `${first.label} moves the score to ${first.score} (${first.signal}). ` : ''}${last && last !== first ? `${last.label} takes it to ${last.score} (${last.signal}). ` : ''}Focus on ${w}. (Source: readiness formula)` };
  },
};

// ---------------------------------------------------------------- 11. learning record
export interface LearnIn { answers: Record<string, string>; hide: string[]; deal: { industry: string; dealType: string; apps: number; budget: number } }
export interface LearnOut { summary: string; keyLesson: string; hiddenTerms: string[] }
export function anonymise(text: string, hide: string[]) {
  let out = text;
  const found: string[] = [];
  let org = 0, person = 0;
  hide.forEach((h) => {
    if (!h) return;
    const re = new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const isPerson = /^[A-Z][a-z]+ [A-Z][a-z'’-]+$/.test(h) && !/(corp|co|inc|ltd|project|industries)$/i.test(h);
    const code = isPerson ? `[PERSON-${String.fromCharCode(65 + person++)}]` : `[ORG-${String.fromCharCode(65 + org++)}]`;
    if (re.test(out)) { found.push(h); out = out.replace(re, code); }
  });
  out = out.replace(/[$₹]\s?(\d+(?:\.\d+)?)\s?M\b/gi, (_, n) => { const v = +n; found.push(`₹${n}M`); return v < 1 ? '<₹1M' : v < 2 ? '₹1M to ₹2M' : v < 5 ? '₹2M to ₹5M' : '₹5M+'; });
  out = out.replace(/[$₹]\s?(\d{2,3})K\b/gi, (_, n) => { found.push(`₹${n}K`); return +n < 50 ? '<₹50K' : '₹50K to ₹250K'; });
  out = out.replace(/\b(\d{2,})\s+((?:[a-z]+\s+)?)(apps|assets|systems|users|laptops|records|services)\b/gi, (m0, n, mid, w) => { found.push(m0); const v = +n; return `${v >= 200 ? '200+' : v >= 100 ? '100+' : v >= 50 ? '50+' : '10+'} ${mid}${w}`; });
  out = out.replace(/\b(1[0-9]|2[0-9]|3[01]|[1-9]) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* 20\d\d\b/g, (m) => { found.push(m); return '[date]'; });
  return { text: out, found: [...new Set(found)] };
}
export const learningRecord: AITask<LearnIn, LearnOut> = {
  id: 'learning-record', label: 'AI anonymised learning record', json: true,
  system: `${GUARD} Rewrite closing lessons into an anonymised Learning Record. Replace every listed name (clients, vendors, people) with a code like [ORG-A] or [PERSON-A]; turn exact numbers into ranges (415 apps -> "200+ apps", ₹1.74M -> "₹1M to ₹2M"); remove dates. Keep the lesson useful.`,
  prompt: (i) => `Names to hide: ${i.hide.join(', ')}\nDeal: ${i.deal.industry} ${i.deal.dealType}, ${i.deal.apps} apps\nAnswers:\n${Object.entries(i.answers).map(([k, v]) => `${k}: ${v}`).join('\n')}\nReturn JSON {"summary":"<3-5 sentence anonymised record>","keyLesson":"<one sentence>","hiddenTerms":["each original term you replaced"]}`,
  fallback: (i) => {
    const all = Object.entries(i.answers).map(([k, v]) => `${k}: ${v}`).join(' ');
    const a = anonymise(all, i.hide);
    const k = anonymise(i.answers.lesson ?? '', i.hide);
    return { summary: a.text, keyLesson: k.text, hiddenTerms: [...new Set([...a.found, ...k.found])] };
  },
};

// ---------------------------------------------------------------- 12. copilot
export interface CopilotIn { question: string; context: any; frameworks: string; pastDeals: string; history: { role: string; text: string }[] }
export interface CopilotOut { answer: string; sources: string[] }
export const copilot: AITask<CopilotIn, CopilotOut> = {
  id: 'copilot', label: 'Deal Copilot', json: true, maxTokens: 1200,
  system: `${GUARD} Answer ONLY from the information given: (1) live dashboard numbers, (2) the PwC framework library, (3) matching past deal cards. Always name your source in brackets, e.g. "(Source: live dashboard)", "(Source: FW-06 Readiness formula)", "(Source: past deal SEMI-03)". If the answer is not in the information given, reply exactly "I don't know — this isn't in the deal data." and suggest what data would answer it. You never change data. Keep answers under 120 words unless asked for a board update.`,
  prompt: (i) => `LIVE DASHBOARD (as of ${i.context.asOf}):\n${J(i.context)}\n\nFRAMEWORK LIBRARY:\n${i.frameworks}\n\nPAST DEAL CARDS:\n${i.pastDeals}\n\nRECENT CHAT:\n${i.history.map((h) => `${h.role}: ${h.text}`).join('\n')}\n\nQUESTION: ${i.question}\n\nReturn JSON {"answer":"","sources":["live dashboard" | "FW-xx" | "past deal ID"]}`,
  fallback: (i) => copilotFallback(i),
};

function copilotFallback(i: CopilotIn): CopilotOut {
  const q = i.question.toLowerCase();
  const c = i.context;
  const blk = c.blockers?.[0];
  if (/charge|price|quote|cost of eda|how much will|salary|weather/.test(q) && !/gap|split|dispute/.test(q)) return { answer: "I don't know — this isn't in the deal data. Upload the vendor quote or contract and I can use it.", sources: [] };
  if (/no.?go|why.*(score|79|capped|not ready)|status|where are we/.test(q)) {
    return { answer: c.capped ? `The score is capped at ${c.score} (${c.signal}) because ${blk?.item ?? 'a critical item'} is blocked: ${blk?.task ?? ''} (owner ${blk?.owner ?? '—'}, due ${blk?.due ?? '—'}). The underlying score is ${c.underlying}. (Source: live dashboard; FW-06)` : `Readiness is ${c.score} — ${c.signal}. Weakest components: ${(c.components ?? []).slice(-2).map((x: any) => `${x.name} ${x.score}`).join(', ')}. (Source: live dashboard)`, sources: ['live dashboard', 'FW-06'] };
  }
  if (/90|go\b|move us|fastest|improve|raise/.test(q)) {
    const p = c.projections ?? [];
    return { answer: `${p.map((x: any) => `${x.label} → ${x.score} (${x.signal})`).join('; ')}. ${c.weakest?.length ? `Weakest items: ${c.weakest.slice(0, 3).map((w: any) => `${w.name} ${w.readiness}%`).join(', ')}.` : ''} (Source: readiness formula FW-06)`, sources: ['FW-06', 'live dashboard'] };
  }
  if (/board|update|summary|brief/.test(q)) {
    return { answer: `Board update — ${c.deal}: readiness ${c.score}/100 (${c.signal})${c.capped ? `, capped from ${c.underlying} by one blocked critical item (${blk?.item})` : ''}. ${c.tasks.done}/${c.tasks.total} tasks complete; ${c.warnings} flagged at risk. Separation costs ${c.costs.total} (seller ${c.costs.seller}, buyer ${c.costs.buyer}); ${c.costs.disputed} disputed and routed to funding. TSA run-rate ${c.tsa.monthly}/month; ${c.tsa.atRisk} service(s) at extension risk. Data hygiene average ${c.hygiene.avg}. (Source: live dashboard)`, sources: ['live dashboard'] };
  }
  if (/cost|split|dispute|fund|escrow|loan|pay/.test(q)) {
    return { answer: `Separation costs total ${c.costs.total}: seller ${c.costs.seller}, buyer ${c.costs.buyer}${c.costs.provisional ? ' (provisional — SPA contract answers not yet confirmed)' : ''}. ${c.costs.disputed} is disputed; per FW-10 it can be bridged by a loan while the seller share is held in escrow, so Day-1 is not delayed. (Source: live dashboard; FW-05; FW-10)`, sources: ['live dashboard', 'FW-05', 'FW-10'] };
  }
  if (/tsa|exit|extension|wave/.test(q)) {
    return { answer: `TSA run-rate is ${c.tsa.monthly}/month across ${c.tsa.services} services. ${c.tsa.atRiskNames ? `${c.tsa.atRiskNames} is at extension risk (extensions cost 125% of the fee).` : 'No service is at extension risk.'} Waves only start when data is 90+; Finance ERP data is ${c.hygiene.erp ?? '—'}. (Source: live dashboard; FW-08)`, sources: ['live dashboard', 'FW-08'] };
  }
  if (/hygiene|data quality|clean|duplicate|stale/.test(q)) {
    return { answer: `Average hygiene is ${c.hygiene.avg}. Files below the 90 gate: ${c.hygiene.below || 'none'}. ${c.hygiene.open} quality issues are open. (Source: live dashboard; FW-07)`, sources: ['live dashboard', 'FW-07'] };
  }
  if (/lesson|past deal|similar|benchmark|semi/.test(q)) {
    return { answer: `${i.pastDeals.split('\n')[0] ?? ''} — benchmark: deals that asked for licence consent in week 1 hit Day-1 on time ${c.benchmark.week1}% of the time vs ${c.benchmark.late}% when late. (Source: past deal cards)`, sources: ['past deal cards'] };
  }
  if (/framework|bucket|which method|how do we|approach|stage/.test(q)) {
    const fw = /cost|dispute/.test(q) ? 'FW-05' : /bucket|classif/.test(q) ? 'FW-01' : /option|decision|trade/.test(q) ? 'FW-04' : /tsa|exit/.test(q) ? 'FW-08' : 'FW-06';
    const line = i.frameworks.split('\n').find((l) => l.startsWith(`[${fw}]`)) ?? '';
    return { answer: `${line.replace(/^\[FW-\d+\]\s*/, '')} (Source: ${fw})`, sources: [fw] };
  }
  return { answer: "I don't know — this isn't in the deal data. I can answer about readiness, blockers, tasks, costs, TSA exit, data quality, decisions and PwC frameworks.", sources: [] };
}

// ---------------------------------------------------------------- 13. funding advice
export interface FundIn { disputed: number; disputedSeller: number; buyer: any; seller: any; bridge: { monthly: number; months: number; rate: number }; escrowFee: number; leaseMonthly: number }
export const fundingAdvice: AITask<FundIn, { recommendation: string }> = {
  id: 'funding-advice', label: 'AI funding recommendation', json: true,
  system: `${GUARD} Recommend a funding package for disputed separation costs using escrow, bridge loan and lease options, based on who can afford it (Prowess financial health). 3 sentences. Not a lending offer.`,
  prompt: (i) => `${J(i)}\nReturn JSON {"recommendation":""}`,
  fallback: (i) => ({ recommendation: `${i.buyer?.company ?? 'The buyer'} is cash-tight (current ratio ${i.buyer?.cr}, D/E ${i.buyer?.de}) so it should take a ${money(i.disputed)} bridge loan (≈${money(i.bridge.monthly, false)}/month for ${i.bridge.months} months at ${i.bridge.rate}%) to order equipment before Day-1. ${i.seller?.company ?? 'The seller'} can absorb its disputed ${money(i.disputedSeller)} share (cash ${money((i.seller?.cash ?? 0) * 1e6)}), which should be held in escrow (fee ≈${money(i.escrowFee, false)}) until expert determination. Leasing (≈${money(i.leaseMonthly, false)}/month) is the fallback if the lender declines.` }),
};

// ---------------------------------------------------------------- 14. TSA risk
export interface TsaIn { service: string; fee: number; target: string; projected: string; expected: number; actual: number; extensionCost: number; linkedReadiness?: number }
export const tsaAdvice: AITask<TsaIn, { text: string }> = {
  id: 'tsa-advice', label: 'AI TSA extension advice', json: true,
  system: `${GUARD} Give a 2-sentence mitigation for a TSA service at risk of extension (extensions cost 125% of the monthly fee).`,
  prompt: (i) => `${J(i)}\nReturn JSON {"text":""}`,
  fallback: (i) => ({ text: `${i.service} is ${i.expected - i.actual} points behind plan (${i.actual}% vs ${i.expected}% expected) and projects to exit ${i.projected} instead of ${i.target}, risking ≈${money(i.extensionCost)} in extension fees. Add a second migration squad for two sprints and agree a partial exit (move remaining mailboxes in batches) with the seller now.` }),
};

// ---------------------------------------------------------------- 15. prospect note
export interface ProspectIn { company: string; sector: string; score: number; drivers: string[] }
export const prospectNote: AITask<ProspectIn, { note: string }> = {
  id: 'prospect-note', label: 'AI outreach rationale', json: true,
  system: `${GUARD} Write a 2-sentence, ethical outreach rationale for a PwC partner, based only on public financial signals. No confidential information.`,
  prompt: (i) => `${J(i)}\nReturn JSON {"note":""}`,
  fallback: (i) => ({ note: `${i.company} shows divestiture signals (${i.drivers.join(', ')}), scoring ${i.score}/10. Offer a carve-out readiness diagnostic using anonymised DealSync benchmarks — public data only, human review required.` }),
};

// ---------------------------------------------------------------- 16. deal brief
export interface BriefIn { context: any }
export const dealBrief: AITask<BriefIn, { bullets: string[] }> = {
  id: 'deal-brief', label: 'AI daily brief', json: true,
  system: `${GUARD} Write a 4-bullet daily brief for the engagement manager: status, top risk, decision needed, and one action. Use only the numbers given.`,
  prompt: (i) => `${J(i.context)}\nReturn JSON {"bullets":["","","",""]}`,
  fallback: (i) => {
    const c = i.context;
    return { bullets: [
      `Readiness ${c.score}/100 — ${c.signal}${c.capped ? ` (capped from ${c.underlying})` : ''}; ${c.daysToDay1} days to Day-1.`,
      c.blockers?.[0] ? `Top risk: ${c.blockers[0].item} — ${c.blockers[0].task} (owner ${c.blockers[0].owner}).` : `Top risk: ${c.warnings} tasks flagged at risk.`,
      c.pendingDecisions ? `Decision needed: ${c.pendingDecisions}.` : 'No leadership decisions pending.',
      `Action: clear ${c.ownerOverdue} overdue owner question(s) and lift ${c.hygiene.below || 'all files'} above the 90 data gate.`,
    ] };
  },
};

// ================================================================ Funding flow (bank underwriting + escrow)
// One task per AI step of the flow. Each explains or drafts; people decide.
const FUND_SYS = `${GUARD} You support a funding flow for a disputed separation cost: a bank commits to lend now, releases the money at deal milestones, and is repaid at settlement from the seller's share held in escrow plus the buyer's share. PwC refers, takes no fee and runs independence checks. Nothing reaches the bank without client consent. The bank sees summaries only — never app lists or employee data.`;
const mk = <I, O>(id: string, label: string, ask: string, prompt: (i: I) => string, fallback: (i: I) => O): AITask<I, O> => ({ id, label, json: true, system: `${FUND_SYS} ${ask}`, prompt, fallback });

export interface FundLine { costId: string; description: string; amount: number; appName: string; component: string; critical: boolean; site: string; needBy: string; milestone: string; buyer: string; seller: string; sellerPct: number }
export interface FinRow { company: string; role: string; cash: number; de: number; cr: number; ic: number; tight: boolean }
export const fundUnderstand = mk<{ line: FundLine }, { text: string }>('fund-understand', 'Understand the cost', 'In 2-3 plain sentences: what exactly is being paid for (equipment, licences or services), when it is needed, and what stops if it is late.',
  (i) => `Cost line: ${J(i.line)}\nReturn JSON {"text":""}`,
  ({ line: l }) => ({ text: `${money(l.amount)} for ${l.description.toLowerCase()} used by ${l.appName} (${l.component.toLowerCase()}). Needed by ${l.needBy} — ${l.milestone} is close behind. Without it, ${l.critical ? `${l.appName} work stops at ${l.site || 'the site'} on ${l.milestone}` : 'the separation plan slips'}.` }));

export const fundAfford = mk<{ line: FundLine; fin: FinRow[] }, { text: string }>('fund-afford', 'Who can afford it', 'Turn the Prowess numbers into a 2-sentence plain summary of who can absorb the cost now and who would be strained.',
  (i) => `Disputed: ${money(i.line.amount)} (provisional seller share ${Math.round(i.line.sellerPct * 100)}%)\nFinancial health: ${J(i.fin)}\nReturn JSON {"text":""}`,
  ({ line, fin }) => {
    const b = fin.find((f) => /buyer/i.test(f.role)), s = fin.find((f) => /seller/i.test(f.role));
    const bt = b ? (b.tight ? `${b.company} has ${b.de > 1.5 ? 'high debt' : 'thin buffers'} after the purchase (D/E ${b.de}, current ratio ${b.cr}) and limited short-term cash, so paying ${money(line.amount)} now would strain it.` : `${b.company} has room to fund ${money(line.amount)} itself (current ratio ${b.cr}).`) : 'Buyer data missing.';
    const st = s ? (s.tight ? `${s.company} is also stretched and may need financing for its share.` : `${s.company} has strong cash (${money(s.cash * 1e6)}) and low debt (D/E ${s.de}), and could hold its share safely in escrow.`) : '';
    return { text: `${bt} ${st}` };
  });

export const fundBankPack = mk<{ line: FundLine; afford: string; readiness: { score: number; signal: string; blockers: string[] }; escrow: number }, { pack: string }>('fund-bank-pack', 'Bank pack', 'Draft a short bank pack with 4 headed sections: Deal summary, Financial health, Day-1 progress, How the bank gets repaid. Summaries only — no app lists or employee data.',
  (i) => `${J(i)}\nReturn JSON {"pack":""}`,
  ({ line, afford, readiness, escrow }) => ({ pack: `DEAL SUMMARY\n${line.buyer} is separating a business from ${line.seller}. The facility funds ${line.description.toLowerCase()} (${money(line.amount)}), needed by ${line.needBy} so ${line.milestone} is not delayed.\n\nFINANCIAL HEALTH\n${afford}\n\n${line.milestone.toUpperCase()} PROGRESS\nReadiness ${readiness.score}/100 (${readiness.signal}).${readiness.blockers.length ? ` Open blocker: ${readiness.blockers[0]}.` : ' No critical blockers.'}\n\nHOW THE BANK GETS REPAID\n${line.seller}'s disputed share (${money(escrow)}) is held in escrow and released to the bank when the dispute settles; ${line.buyer} repays the balance. Funds are released in two milestones (blocker cleared; board Go).` }));

export const fundBankAnswer = mk<{ question: string; context: any }, { answer: string }>('fund-bank-answer', 'Answer bank question', 'Draft a factual 2-3 sentence answer to the bank credit team using only the live data given. A person approves before sending.',
  (i) => `Question: ${i.question}\nLive data: ${J(i.context)}\nReturn JSON {"answer":""}`,
  ({ question, context: c }) => ({ answer: /slip|late|delay/i.test(question) ? `${c.milestone} is ${c.date}; readiness is ${c.score}/100 (${c.signal}). If it slips, the second tranche stays locked until the board gives a Go, so the bank's exposure is limited to the first ${money(c.tranche)}.` : /repay|secur|collateral/i.test(question) ? `Repayment comes first from ${c.seller}'s disputed share (${money(c.escrow)}) held in escrow under the SPA dispute clause; ${c.buyer} repays the balance over the facility term.` : `The readiness score is recalculated daily from task completion (50%), test evidence (30%) and data hygiene (20%) for every critical item; it is currently ${c.score}/100 with ${c.blockers} critical blocker(s).` }));

export const fundMilestone = mk<{ milestone: string; context: any }, { update: string }>('fund-milestone', 'Milestone update', 'Draft a 2-sentence progress update to the bank confirming a milestone was reached, with the evidence.',
  (i) => `Milestone: ${i.milestone}\nData: ${J(i.context)}\nReturn JSON {"update":""}`,
  ({ milestone, context: c }) => ({ update: `Milestone reached: ${milestone}. Readiness is now ${c.score}/100 (${c.signal}) with ${c.blockers} critical blocker(s); we request release of the next tranche of ${money(c.tranche)}.` }));

export const fundSettle = mk<{ plan: SettlePlan; buyer: string; seller: string; method: string; quote?: string }, { summary: string }>('fund-settle', 'Settlement summary', 'Draft the settlement summary in plain words using ONLY the numbers in the plan: the agreed split, what happens to any bank loan (repaid, reduced or cancelled), what the escrow pays and returns, and what each side pays directly. Settlement can happen before, during or after bank funding.',
  (i) => `${J(i)}\nReturn JSON {"summary":""}`,
  (i) => {
    const p = i.plan, sp = Math.round(p.sellerPct * 100);
    const lines = [`Final split agreed via ${i.method === 'spa' ? `the SPA reading${i.quote ? ` (“${i.quote.slice(0, 90)}…”)` : ''}` : 'negotiation at the deal board'}: ${i.seller} ${sp}% (${money(p.sellerOwes)}) · ${i.buyer} ${100 - sp}% (${money(p.buyerOwes)}).`];
    if (p.stage === 'before') lines.push(`Settled before any bank funding, so no loan is needed: ${i.seller} pays ${money(p.sellerOwes)} and ${i.buyer} pays ${money(p.buyerOwes)} directly.`);
    if (p.stage === 'during') lines.push(`Settled before any money was released, so the ${money(p.cancelled)} bank facility is cancelled. Escrow pays ${i.seller}'s ${money(p.fromEscrow)} directly${p.escrowBack ? ` and returns ${money(p.escrowBack)} to ${i.seller}` : ''}${p.sellerExtra ? `; ${i.seller} pays the extra ${money(p.sellerExtra)} itself` : ''}. ${i.buyer} pays ${money(p.buyerOwes)} directly.`);
    if (p.stage === 'after') lines.push(`The bank had released ${money(p.drawn)}: ${i.seller} repays ${money(p.sellerToBank)} from escrow and ${i.buyer} repays ${money(p.buyerToBank)}, plus interest in the same ratio.${p.cancelled ? ` The undrawn ${money(p.cancelled)} is cancelled and paid directly: ${i.seller} ${money(p.sellerDirect)}, ${i.buyer} ${money(p.buyerDirect)}.` : ''}${p.escrowBack ? ` ${money(p.escrowBack)} left in escrow goes back to ${i.seller}.` : ''}${p.sellerExtra ? ` ${i.seller} pays the extra ${money(p.sellerExtra)} itself.` : ''}`);
    return { summary: lines.join('\n') };
  });

export const fundLesson = mk<{ facts: any }, { lesson: string }>('fund-lesson', 'Close and learn', 'Write one anonymised, reusable lesson (no client or person names, numbers as ranges).',
  (i) => `${J(i.facts)}\nReturn JSON {"lesson":""}`,
  ({ facts: f }) => ({ lesson: `The disputed cost was funded by a bank against deal milestones, so ${f.milestone} was not delayed by a ${f.band} cost dispute. Agree the escrow of the seller's likely share at closing and get client consent for the bank summary early.` }));
