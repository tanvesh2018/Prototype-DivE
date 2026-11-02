## Why

The Vercel deployment always shows "Rule-based fallback", because the Gemini gateway only exists inside the Vite dev/preview server. Adding `GEMINI_API_KEY` to Vercel has no effect: nothing there reads it, and `/api/ai/*` returns 404. This change makes the hosted prototype show the AI layer behind the BRD's copilot and "AI suggests, a person approves" objectives (BRD NFRs "Human control" and "Approved AI only"; solution-logic AI workflow).

The site and repo are public, so anyone can reach a hosted gateway. The owner chose no visitor sign-in, accepting that quota can be used by others and relying on guards plus a Google-side usage limit.

## What Changes

- Add hosted AI endpoints at the existing paths: `/api/ai/status`, `/api/ai/test`, `/api/ai/generate`.
- Share the Gemini-calling logic between the local gateway and the hosted endpoints, so local dev keeps working unchanged.
- Read the key on the hosted site only from a server-side Vercel environment variable.
- Accept only same-site requests on the hosted endpoints, and limit request size, output tokens and request rate.
- Show environment-appropriate setup text in Governance → AI settings.
- Stop publishing any part of the key (the `keyHint`) from the hosted status endpoint.
- Update AGENTS.md rule 5, CLAUDE.md's key rule, `.env.example` and the README, which currently say the key lives only in `.env.local` and only `server/aiPlugin.ts` reads it.

**Non-goals:** access codes, user accounts or role-based login; durable rate limiting backed by a database; new AI tasks or changes to prompts, fallbacks or formulas; streaming; securing the sample data in the public site and repo.

## Capabilities

### New Capabilities

- `hosted-ai-gateway`: Server-side Gemini access on the hosted deployment, including key handling, abuse guards, request limits and fallback behaviour.

### Modified Capabilities

None. `openspec/specs/` has no existing specs.

## Impact

- **New code:** a Vercel serverless function under `api/` and a shared Gemini module under `server/`.
- **Changed code:** `server/aiPlugin.ts`, `src/ai/client.ts`, `src/screens/Governance.tsx`, `tsconfig.json`.
- **Docs and rules:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example`.
- **Operations:** a new Vercel environment variable, `GEMINI_API_KEY`, and a usage limit on the key at Google. Deal data sent by AI tasks now reaches Google from the hosted site.
- **Dependencies:** no new runtime dependencies.
- **Unchanged:** `runAI()` remains the only AI entry point, and `src/engine/**` and sample data are untouched.
