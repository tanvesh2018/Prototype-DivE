## Context

`server/aiPlugin.ts` holds both the Gemini call and the Vite middleware, and it only runs under `vite dev` or `vite preview`. Vercel serves the static `dist/` output, so `/api/ai/*` returns 404 and `runAI()` falls back. See proposal.md for motivation.

Constraints: the site and repo are public, the project has no user accounts or database, and the project avoids new runtime dependencies. `package.json` sets `"type": "module"`, which affects how Vercel resolves relative imports.

**Formulas and AI tasks:** no formulas and no entries in `src/ai/tasks.ts` change. Explainability is unaffected: scores stay in `src/engine/model.ts`, and `AIChip` keeps labelling each result's source.

## Goals / Non-Goals

**Goals:**
- Live Gemini on the hosted site for all visitors, with no sign-in.
- One implementation of the Gemini call for local and hosted use.
- Safe failure: a missing key or any Gemini error results in the fallback.

**Non-Goals:**
- Per-user identity, or proof that a request came from the real app.
- Guaranteed rate limits across serverless instances.

## Decisions

### One function with a dynamic route
Use `api/ai/[action].ts` for all three endpoints rather than one file per endpoint. They share all their checks, and the paths stay the same, so `src/ai/client.ts` keeps its URLs.

### Extract a shared module
Move `callGemini`, the model list and the placeholder-key check to `server/gemini.ts`. `aiPlugin.ts` keeps `.env.local` reading and its middleware. The hosted handler adds same-site, limit and rate checks around the same call. This avoids two copies of the model fallback logic drifting apart.

Relative imports use a `.js` extension (`../../server/gemini.js`), because ESM functions on Vercel need it. Local tools must be checked to confirm they resolve this to the `.ts` file.

### No sign-in, with guards
The owner chose no visitor sign-in, after an access code was built and offered, and accepted that the key's quota can be used by others. The gateway checks that `Origin` (or `Referer`) matches the request host, returning 403 otherwise.

This stops other websites from calling it through visitors' browsers and stops casual misuse. Scripts can fake these headers, so the real spending limit is the quota on the key at Google.

Alternatives considered:
- **Shared access code:** stronger, but visitors must enter it, which the owner declined.
- **Vercel Deployment Protection:** blocks the whole site, and may need a paid plan.

The status endpoint is public and returns only `configured`, `model`, `hosted` and setup text, with no `keyHint`.

### Model names
Default to `gemini-flash-latest`, Google's alias for the latest Flash release, with named models as backups. The original list stopped working for new keys: `gemini-2.0-flash` is past its listed shutdown date, and the 2.5 models are limited to accounts that used them before.

### Limits
| Limit | Value | Reason |
|---|---|---|
| System + prompt size | 200,000 characters, confirmed against real task sizes during implementation | Stops very large requests, while allowing upload-based tasks |
| Output tokens | Cap at 4,096 | Tasks use 2,048 or less by default |
| Requests per IP | 15 per minute, per instance | Best effort; instances don't share memory |
| Requests in total | 60 per minute, per instance | Limits use spread across many IPs |
| Function duration | `maxDuration: 30` | Must exceed the client's 25 s timeout |

The in-memory counters are deliberately simple. The hard limit comes from a quota or budget set on the Google side.

### Error messages
Gemini upstream errors are logged on the server, and the client receives a short generic message. Local mode keeps its detailed errors for debugging.

## Risks / Trade-offs

- **Anyone can use the key's quota, and scripts can fake the same-site check** → Accepted by the owner. Set a Google usage limit; remove the key or restore an access code if abuse appears.
- **Heavy use by real visitors reaches the shared limit** → The app falls back to rules, and the limits can be raised.
- **Rate limits reset on cold starts or spread across instances** → Accepted for a prototype. Rely on the Google quota for real protection.
- **Gemini free tier may use submitted data to improve Google's products**, which conflicts with the BRD's "Approved AI only" requirement if real deal data is used → Sample data only. Use a paid tier and confirm approval before any real data.
- **Sample data stays public** → Out of scope here.
- **Slow responses reach the function time limit** → `maxDuration` is above the client timeout, and the client falls back on timeout.
- **`req.body` handling differs between Vercel and the Vite middleware** → Test request parsing on a Vercel preview deployment before merging to `main`.
- **Auto-push makes every commit on `main` live** → Build this on a branch and test on its preview URL. The local hook doesn't auto-push from other branches.

## Migration Plan

1. Implement on a branch and push it to get a Vercel preview URL.
2. In Vercel, add `GEMINI_API_KEY` for Production and Preview, marked Sensitive. The person owning the key does this; the key never goes in the repo or chat.
3. Test on the preview, then merge to `main`.
4. Set a quota or budget for the key on the Google side.

**Rollback:** remove `GEMINI_API_KEY` from Vercel to return to fallback immediately, or revert the merge commit.
