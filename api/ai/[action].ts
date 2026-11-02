/**
 * Hosted AI gateway (Vercel). Serves /api/ai/status | test | generate.
 *
 * The site is public, so test and generate need the shared access code.
 * Set GEMINI_API_KEY and DEALSYNC_ACCESS_CODE in Vercel's environment
 * variables. If either is missing, it refuses rather than running open,
 * and the app uses its deterministic fallback.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEFAULT_MODELS, callGemini, getWorkingModel, isPlaceholderKey, type GeminiRequest } from '../../server/gemini.js';

const MAX_PROMPT_CHARS = 200_000; // largest real task is about 65,000
const MAX_OUTPUT_TOKENS = 4096;
const REQUESTS_PER_MINUTE = 30;
const FAILED_CODES_PER_MINUTE = 5;
const WINDOW_MS = 60_000;

// Best effort: counters are per instance and reset on cold start. The hard
// spending limit is the quota set on the key on Google's side.
type Counter = Map<string, { count: number; resetAt: number }>;
const requests: Counter = new Map();
const failedCodes: Counter = new Map();

function current(counter: Counter, ip: string) {
  const now = Date.now();
  if (counter.size > 5000) for (const [k, v] of counter) if (v.resetAt <= now) counter.delete(k);
  let entry = counter.get(ip);
  if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + WINDOW_MS }; counter.set(ip, entry); }
  return entry;
}

function clientIp(req: IncomingMessage) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function codeMatches(given: unknown, expected: string) {
  if (typeof given !== 'string' || !given) return false;
  const digest = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Vercel usually parses the body before we run; otherwise read the stream. */
async function readBody(req: IncomingMessage): Promise<any> {
  const parsed = (req as any).body;
  if (parsed !== undefined && parsed !== null) {
    if (typeof parsed === 'string' || Buffer.isBuffer(parsed)) return parsed.length ? JSON.parse(parsed.toString()) : {};
    return parsed;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function toGeminiRequest(body: any): GeminiRequest {
  const temperature = Number(body.temperature);
  const maxTokens = Number(body.maxTokens);
  return {
    prompt: body.prompt,
    system: typeof body.system === 'string' ? body.system : undefined,
    json: body.json === true,
    temperature: Number.isFinite(temperature) ? Math.min(Math.max(temperature, 0), 2) : undefined,
    maxTokens: Math.min(Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 2048, MAX_OUTPUT_TOKENS),
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const action = (req.url ?? '').split('?')[0].split('/').filter(Boolean).pop();
  const rawKey = process.env.GEMINI_API_KEY ?? '';
  const key = isPlaceholderKey(rawKey) ? '' : rawKey;
  const preferred = process.env.GEMINI_MODEL ?? '';
  const accessCode = process.env.DEALSYNC_ACCESS_CODE ?? '';

  if (action === 'status') {
    return send(res, 200, { configured: !!key && !!accessCode, model: getWorkingModel() ?? (preferred || DEFAULT_MODELS[0]), keyFile: 'Vercel environment variable', keyHint: null, authRequired: true });
  }
  if (action !== 'test' && action !== 'generate') return send(res, 404, { error: 'unknown endpoint' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  const ip = clientIp(req);
  const failed = current(failedCodes, ip);
  if (failed.count >= FAILED_CODES_PER_MINUTE) return send(res, 429, { error: 'Too many incorrect access codes. Try again in a minute.' });
  const used = current(requests, ip);
  if (used.count >= REQUESTS_PER_MINUTE) return send(res, 429, { error: 'Too many AI requests. Try again in a minute.' });
  used.count += 1;

  if (!key || !accessCode) return send(res, 503, { error: 'Live AI is not set up on this site. Using rule-based fallback.' });
  if (!codeMatches(req.headers['x-dealsync-access'], accessCode)) {
    failed.count += 1;
    return send(res, 401, { error: 'Access code missing or incorrect.' });
  }

  try {
    if (action === 'test') return send(res, 200, await callGemini(key, preferred, { prompt: 'Reply with the single word: ready', maxTokens: 20 }));
    let body: any;
    try { body = await readBody(req); } catch { return send(res, 400, { error: 'Request body must be JSON.' }); }
    if (typeof body?.prompt !== 'string' || !body.prompt) return send(res, 400, { error: 'prompt required' });
    const request = toGeminiRequest(body);
    if (request.prompt.length + (request.system?.length ?? 0) > MAX_PROMPT_CHARS) return send(res, 413, { error: 'Prompt is too large.' });
    return send(res, 200, await callGemini(key, preferred, request));
  } catch (e) {
    console.error('[DealSync AI] Gemini call failed:', e);
    return send(res, 502, { error: 'Gemini request failed. Using rule-based fallback.' });
  }
}
