/**
 * DealSync central AI gateway (Gemini).
 *
 * Runs inside the Vite dev/preview server, so `npm start` is all you need.
 * The hosted equivalent for Vercel is api/ai/[action].ts.
 * The browser never sees the API key: it calls /api/ai/*, and this
 * middleware forwards the request to Google's Gemini API.
 *
 *   Put your key in  .env.local  (project root):   GEMINI_API_KEY=your-key
 *
 * The file is re-read on every request, so no restart is needed after
 * pasting the key. Optional: GEMINI_MODEL=gemini-flash-latest (default).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { DEFAULT_MODELS, callGemini, getWorkingModel, isPlaceholderKey } from './gemini.js';

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
  return { key: isPlaceholderKey(key) ? '' : key, model };
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

export function geminiGateway(): Plugin {
  let root = process.cwd();
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.startsWith('/api/ai/')) return next();
    const { key, model } = readEnv(root);
    try {
      if (url === '/api/ai/status') {
        return send(res, 200, { configured: !!key, model: getWorkingModel() ?? (model || DEFAULT_MODELS[0]), keyFile: '.env.local', keyHint: key ? `…${key.slice(-4)}` : null });
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
