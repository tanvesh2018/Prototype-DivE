/**
 * The Gemini call used by both AI gateways: the local Vite one
 * (server/aiPlugin.ts) and the hosted Vercel one (api/ai/[action].ts).
 * Server-side only: never import this from src/.
 */
export const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiRequest { system?: string; prompt: string; json?: boolean; temperature?: number; maxTokens?: number }

export function isPlaceholderKey(key: string) {
  return !key || /paste|your[-_ ]?key|xxxx/i.test(key);
}

let workingModel: string | null = null;
export function getWorkingModel() { return workingModel; }

export async function callGemini(key: string, preferred: string, body: GeminiRequest) {
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
