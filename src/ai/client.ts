/**
 * Central AI client. EVERY AI feature in DealSync goes through `runAI()`.
 *
 *  - When a gateway has a key, prompts are sent to Gemini via /api/ai/generate:
 *    server/aiPlugin.ts locally (key in .env.local), or api/ai/[action].ts on
 *    the hosted site (key in Vercel, and viewers need the access code).
 *  - Without a key or code (or on any error / timeout), the task's deterministic
 *    fallback runs instead, so the prototype always works offline.
 *
 * AI only ever *suggests*: callers show the result for a human to approve.
 */
import type { AITask } from './tasks';

export interface AIResult<O> {
  data: O;
  source: 'gemini' | 'fallback';
  model?: string;
  latencyMs?: number;
  error?: string;
}

export interface AIStatus { configured: boolean; model: string; keyFile: string; keyHint: string | null; checked: boolean; error?: string; authRequired: boolean; hasAccessCode: boolean; codeRejected: boolean }

const ACCESS_CODE_KEY = 'dealsync.ai.accessCode';
const NO_CODE_MESSAGE = 'Enter the access code in Governance to use live AI.';
const REJECTED_MESSAGE = 'The access code was rejected. Rule-based fallback is active.';
function getAccessCode(): string {
  try { return sessionStorage.getItem(ACCESS_CODE_KEY) ?? ''; } catch { return ''; }
}

let status: AIStatus = { configured: false, model: 'gemini-2.5-flash', keyFile: '.env.local', keyHint: null, checked: false, authRequired: false, hasAccessCode: !!getAccessCode(), codeRejected: false };
const listeners = new Set<(s: AIStatus) => void>();

export function getAIStatus() { return status; }
export function onAIStatus(fn: (s: AIStatus) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function setStatus(s: Partial<AIStatus>) { status = { ...status, ...s }; listeners.forEach((l) => l(status)); }

/** True when this viewer can reach Gemini: a key is set and any required code is entered. */
export function isLiveAIAvailable(s: AIStatus) { return s.configured && (!s.authRequired || s.hasAccessCode); }

export function setAccessCode(code: string) {
  try { sessionStorage.setItem(ACCESS_CODE_KEY, code); } catch { /* storage blocked: stays on fallback */ }
  setStatus({ hasAccessCode: !!getAccessCode(), codeRejected: false });
}

export function clearAccessCode(rejected = false) {
  try { sessionStorage.removeItem(ACCESS_CODE_KEY); } catch { /* nothing stored */ }
  setStatus({ hasAccessCode: false, codeRejected: rejected });
}

function gatewayHeaders(): Record<string, string> {
  const code = getAccessCode();
  return { 'Content-Type': 'application/json', ...(code ? { 'x-dealsync-access': code } : {}) };
}

export async function refreshAIStatus(): Promise<AIStatus> {
  try {
    const r = await fetch('/api/ai/status');
    const j = await r.json();
    setStatus({ ...j, checked: true, error: undefined });
  } catch (e: any) {
    setStatus({ configured: false, checked: true, error: 'AI gateway not reachable (static build?)' });
  }
  return status;
}

export async function testAIConnection(): Promise<{ ok: boolean; message: string }> {
  await refreshAIStatus();
  if (!status.configured) return { ok: false, message: status.authRequired ? 'Live AI is not set up on this site. Rule-based fallback is active.' : 'No GEMINI_API_KEY found in .env.local — rule-based fallback is active.' };
  if (!isLiveAIAvailable(status)) return { ok: false, message: NO_CODE_MESSAGE };
  try {
    const r = await fetch('/api/ai/test', { method: 'POST', headers: gatewayHeaders(), body: '{}' });
    const j = await r.json();
    if (r.status === 401) { clearAccessCode(true); return { ok: false, message: REJECTED_MESSAGE }; }
    if (!r.ok) return { ok: false, message: j.error ?? 'Gemini call failed' };
    setStatus({ model: j.model });
    return { ok: true, message: `Connected to ${j.model} in ${j.latencyMs} ms` };
  } catch (e: any) {
    return { ok: false, message: String(e?.message ?? e) };
  }
}

function extractJSON(text: string) {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = t.match(/[[{][\s\S]*[\]}]/);
  if (m) return JSON.parse(m[0]);
  throw new Error('AI response was not valid JSON');
}

export async function runAI<I, O>(task: AITask<I, O>, input: I, opts: { timeoutMs?: number } = {}): Promise<AIResult<O>> {
  if (!status.checked) await refreshAIStatus();
  if (!status.configured) return { data: task.fallback(input), source: 'fallback', error: status.error };
  if (!isLiveAIAvailable(status)) return { data: task.fallback(input), source: 'fallback', error: NO_CODE_MESSAGE };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 25000);
  try {
    const r = await fetch('/api/ai/generate', {
      method: 'POST', signal: ctrl.signal, headers: gatewayHeaders(),
      body: JSON.stringify({ system: task.system, prompt: task.prompt(input), json: task.json, temperature: task.temperature ?? 0.2, maxTokens: task.maxTokens ?? 2048 }),
    });
    const j = await r.json();
    if (r.status === 401) { clearAccessCode(true); throw new Error(REJECTED_MESSAGE); }
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    const parsed = task.json ? extractJSON(j.text) : j.text;
    const data = task.parse ? task.parse(parsed, input) : (parsed as O);
    setStatus({ model: j.model });
    return { data, source: 'gemini', model: j.model, latencyMs: j.latencyMs };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Gemini timed out' : String(e?.message ?? e);
    console.warn(`[DealSync AI] ${task.id} fell back to rules:`, msg);
    return { data: task.fallback(input), source: 'fallback', error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function sourceLabel(r: { source: string; model?: string; error?: string }) {
  return r.source === 'gemini' ? `Gemini · ${r.model}` : 'Rule-based fallback';
}
