/**
 * Hosted AI gateway (Vercel). Serves /api/ai/status | test | generate.
 *
 * Visitors don't log in, so these guards limit misuse of the key's quota:
 * same-site requests only, size and token caps, and rate limits. They slow
 * abuse but can't stop a determined script, so the hard spending limit must
 * be the quota set on the key on Google's side.
 *
 * Set GEMINI_API_KEY in Vercel's environment variables. Without it, the app
 * uses its deterministic fallback.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEFAULT_MODELS, callGemini, getWorkingModel, isPlaceholderKey, type GeminiRequest } from '../../server/gemini.js';

const MAX_PROMPT_CHARS = 200_000; // largest real task is about 65,000
const MAX_OUTPUT_TOKENS = 4096;
const REQUESTS_PER_MINUTE_PER_IP = 15;
const REQUESTS_PER_MINUTE_TOTAL = 60;
const WINDOW_MS = 60_000;
const ALL_CLIENTS = '*';

// Best effort: counters are per instance and reset on cold start.
const requests = new Map<string, { count: number; resetAt: number }>();

function current(id: string) {
  const now = Date.now();
  if (requests.size > 5000) for (const [k, v] of requests) if (v.resetAt <= now) requests.delete(k);
  let entry = requests.get(id);
  if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + WINDOW_MS }; requests.set(id, entry); }
  return entry;
}

function firstHeader(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0].trim() || '';
}

function clientIp(req: IncomingMessage) {
  return firstHeader(req.headers['x-forwarded-for']) || req.socket?.remoteAddress || 'unknown';
}

/** Browsers send Origin on POST. Scripts can fake it, so this only stops other websites and casual misuse. */
function isSameSite(req: IncomingMessage) {
  const source = firstHeader(req.headers.origin) || firstHeader(req.headers.referer);
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host);
  if (!source || !host) return false;
  try { return new URL(source).host === host; } catch { return false; }
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

  if (action === 'status') {
    return send(res, 200, { configured: !!key, model: getWorkingModel() ?? (preferred || DEFAULT_MODELS[0]), keyFile: 'Vercel environment variable', keyHint: null, hosted: true });
  }
  if (action !== 'test' && action !== 'generate') return send(res, 404, { error: 'unknown endpoint' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!isSameSite(req)) return send(res, 403, { error: 'Requests must come from this site.' });

  const forClient = current(clientIp(req));
  const forAll = current(ALL_CLIENTS);
  if (forClient.count >= REQUESTS_PER_MINUTE_PER_IP || forAll.count >= REQUESTS_PER_MINUTE_TOTAL) {
    return send(res, 429, { error: 'Too many AI requests. Try again in a minute.' });
  }
  forClient.count += 1;
  forAll.count += 1;

  if (!key) return send(res, 503, { error: 'Live AI is not set up on this site. Using rule-based fallback.' });

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
