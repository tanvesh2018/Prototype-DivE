## Context

`server/aiPlugin.ts` holds both the Gemini call and the Vite middleware, and it only runs under `vite dev` or `vite preview`. Vercel serves the static `dist/` output, so `/api/ai/*` returns 404 and `runAI()` falls back. See proposal.md for motivation.

Constraints: the site and repo are public, the project has no user accounts or database, and the project avoids new runtime dependencies. `package.json` sets `"type": "module"`, which affects how Vercel resolves relative imports.

**Formulas and AI tasks:** no formulas and no entries in `src/ai/tasks.ts` change. Explainability is unaffected: scores stay in `src/engine/model.ts`, and `AIChip` keeps labelling each result's source.

## Goals / Non-Goals

**Goals:**
- Live Gemini on the hosted site for people holding the access code.
- One implementation of the Gemini call for local and hosted use.
- Safe failure: any missing configuration results in the fallback, not an open gateway.

**Non-Goals:**
- Per-user identity or audit of who used the code.
- Guaranteed rate limits across serverless instances.

## Decisions

### One function with a dynamic route
Use `api/ai/[action].ts` for all three endpoints rather than one file per endpoint. They share all their checks, and the paths stay the same, so `src/ai/client.ts` keeps its URLs.

### Extract a shared module
Move `callGemini`, the model list and the placeholder-key check to `server/gemini.ts`. `aiPlugin.ts` keeps `.env.local` reading and its middleware. The hosted handler adds access, limit and rate checks around the same call. This avoids two copies of the model fallback logic drifting apart.

Relative imports use a `.js` extension (`../../server/gemini.js`), because ESM functions on Vercel need it. Local tools must be checked to confirm they resolve this to the `.ts` file.

### Shared access code
A viewer enters a code, the client sends it in an `x-dealsync-access` header, and the function compares it with `DEALSYNC_ACCESS_CODE` in constant time using `node:crypto`.

Alternatives considered:
- **Vercel Deployment Protection:** also protects the data, but protecting production may need a paid plan, and it blocks the whole site, including the fallback demo.
- **Hiding the key behind `Origin` checks:** trivially spoofed.
- **User accounts:** far beyond a prototype, and needs a database.

Unset code means refuse, so forgetting the variable can't leave the gateway open.

The status endpoint stays public but returns only `configured`, `model`, `authRequired` and setup text. It does not check the code, so it can't be used to guess one. It omits `keyHint` on the hosted site.

### Client code storage
Store the code in `sessionStorage`, wrapped in try/catch, so it clears when the tab closes and never enters the workspace, audit log or exports. `runAI()` skips the generate call and uses the fallback when `authRequired` is true and no code is present. A 401 clears the code and updates status.

Local mode reports `authRequired: false`, so it behaves as it does today.

### Limits
| Limit | Value | Reason |
|---|---|---|
| System + prompt size | 200,000 characters, confirmed against real task sizes during implementation | Stops very large requests, while allowing upload-based tasks |
| Output tokens | Cap at 4,096 | Tasks use 2,048 or less by default |
| Requests | 30 per minute per IP, per instance | Best effort; instances don't share memory |
| Failed codes | 5 per minute per IP, per instance | Slows guessing |
| Function duration | `maxDuration: 30` | Must exceed the client's 25 s timeout |

The in-memory counters are deliberately simple. The hard spending limit comes from a quota or budget set on the Google side.

### Error messages
Gemini upstream errors are logged on the server, and the client receives a short generic message. Local mode keeps its detailed errors for debugging.

## Risks / Trade-offs

- **Shared code leaks** → Change `DEALSYNC_ACCESS_CODE` in Vercel and redeploy. Set a Google quota as the backstop.
- **Rate limits reset on cold starts or spread across instances** → Accepted for a prototype. Rely on the access code and Google quota for real protection.
- **Gemini free tier may use submitted data to improve Google's products**, which conflicts with the BRD's "Approved AI only" requirement if real deal data is used → Sample data only. Use a paid tier and confirm approval before any real data.
- **Sample data stays public** → Out of scope here; the access code protects only Gemini calls, not the site.
- **Slow responses reach the function time limit** → `maxDuration` is above the client timeout, and the client falls back on timeout.
- **`req.body` handling differs between Vercel and the Vite middleware** → Test request parsing on a Vercel preview deployment before merging to `main`.
- **Auto-push makes every commit on `main` live** → Build this on a branch and test on its preview URL. The local hook doesn't auto-push from other branches.

## Migration Plan

1. Implement on a branch and push it to get a Vercel preview URL.
2. In Vercel, add `GEMINI_API_KEY` and `DEALSYNC_ACCESS_CODE` for Production and Preview, marked Sensitive, with Preview using a different code if possible. The person owning the key does this; the key never goes in the repo or chat.
3. Test on the preview, then merge to `main`.
4. Set a quota or budget for the key on the Google side.

**Rollback:** remove `GEMINI_API_KEY` from Vercel to return to fallback immediately, or revert the merge commit.
