/**
 * DealSync central AI gateway (Gemini).
 *
 * Runs inside the Vite dev/preview server, so `npm start` is all you need.
 * The browser never sees the API key: it calls /api/ai/*, and this
 * middleware forwards the request to Google's Gemini API.
 *
 *   Put your key in  .env.local  (project root):   GEMINI_API_KEY=your-key
 *
 * The file is re-read on every request, so no restart is needed after
 * pasting the key. Optional: GEMINI_MODEL=gemini-2.5-flash (default).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function readEnv(root: string) {
  const env: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || env.GEMINI_MODEL || '';
  const placeholder = !key || /paste|your[-_ ]?key|xxxx/i.test(key);
  return { key: placeholder ? '' : key, model };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

let workingModel: string | null = null;

async function callGemini(key: string, preferred: string, body: { system?: string; prompt: string; json?: boolean; temperature?: number; maxTokens?: number }) {
  const models = [...new Set([workingModel, preferred, ...DEFAULT_MODELS].filter(Boolean) as string[])];
  let lastErr = '';
  for (const model of models) {
    const generationConfig: Record<string, unknown> = { temperature: body.temperature ?? 0.2, maxOutputTokens: body.maxTokens ?? 2048 };
    if (body.json) generationConfig.responseMimeType = 'application/json';
    if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const payload: Record<string, unknown> = { contents: [{ role: 'user', parts: [{ text: body.prompt }] }], generationConfig };
    if (body.system) payload.systemInstruction = { parts: [{ text: body.system }] };
    const started = Date.now();
    const r = await fetch(`${ENDPOINT}/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
    const data: any = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
      if (!text) { lastErr = `Empty response from ${model} (${data?.candidates?.[0]?.finishReason ?? 'no candidate'})`; continue; }
      workingModel = model;
      return { text, model, latencyMs: Date.now() - started };
    }
    lastErr = `${model}: ${r.status} ${data?.error?.message ?? r.statusText}`;
    // only fall through to the next model when the model itself is unavailable
    if (![404, 400].includes(r.status) || /api key|permission|unauthori/i.test(lastErr)) break;
  }
  throw new Error(lastErr || 'Gemini request failed');
}

export function geminiGateway(): Plugin {
  let root = process.cwd();
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.startsWith('/api/ai/')) return next();
    const { key, model } = readEnv(root);
    try {
      if (url === '/api/ai/status') {
        return send(res, 200, { configured: !!key, model: workingModel ?? (model || DEFAULT_MODELS[0]), keyFile: '.env.local', keyHint: key ? `…${key.slice(-4)}` : null });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      if (!key) return send(res, 503, { error: 'GEMINI_API_KEY is not set in .env.local — using rule-based fallback.' });
      const body = await readBody(req);
      if (url === '/api/ai/test') {
        const out = await callGemini(key, model, { prompt: 'Reply with the single word: ready', maxTokens: 20 });
        return send(res, 200, out);
      }
      if (url === '/api/ai/generate') {
        if (!body?.prompt) return send(res, 400, { error: 'prompt required' });
        const out = await callGemini(key, model, body);
        return send(res, 200, out);
      }
      return send(res, 404, { error: 'unknown endpoint' });
    } catch (e: any) {
      return send(res, 502, { error: String(e?.message ?? e) });
    }
  };
  return {
    name: 'dealsync-gemini-gateway',
    configResolved(c) { root = c.root; },
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
