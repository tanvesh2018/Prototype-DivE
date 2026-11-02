## 1. Shared Gemini logic

- [x] 1.1 Create a feature branch for this change
- [x] 1.2 Move `callGemini`, the model list and the placeholder-key check from `server/aiPlugin.ts` to `server/gemini.ts`
- [x] 1.3 Update `server/aiPlugin.ts` to use the shared module, keeping `.env.local` reading and its responses
- [x] 1.5 Update the default model list to names available to new keys
- [x] 1.4 Confirm `npm run dev` and `npm run build` resolve the `.js` import path to `server/gemini.ts`

## 2. Hosted endpoints

- [x] 2.1 Add `api/ai/[action].ts` with `maxDuration: 30`, routing status, test and generate, and returning 405 for the wrong method and 404 for unknown actions
- [x] 2.2 Read `GEMINI_API_KEY` and `GEMINI_MODEL` from `process.env` only, and return no `keyHint` from status
- [x] 2.3 Reject test and generate requests that don't come from the same site, returning 403
- [x] 2.4 Measure the largest real AI task prompts, then set the size limit and return 413 above it; cap output tokens at 4,096
- [x] 2.5 Add best-effort per-IP and instance-wide request limits, returning 429
- [x] 2.6 Log upstream errors on the server and return generic messages to the client
- [x] 2.7 Add `api` to `tsconfig.json` `include`

## 3. Client and settings screen

- [x] 3.1 Add `hosted` to `AIStatus` and a hosted message when no key is set
- [x] 3.2 Show hosted-appropriate setup text and status in Governance, hiding the `.env.local` steps and key hint on the hosted site

## 4. Docs and project rules

- [x] 4.1 Update AGENTS.md rule 5 and the CLAUDE.md key rule to allow a server-side Vercel environment variable, still banning `VITE_` secrets and the repo
- [x] 4.2 Update the README with hosted Gemini setup, the public-access risk and troubleshooting; note the hosted variable in `.env.example`
- [x] 4.3 Update the `openspec/config.yaml` tech-stack context, which says there's no back end

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm run build`
- [x] 5.2 Run `npm run check:engine` and compare with the golden numbers in AGENTS.md, expecting no change
- [x] 5.3 Search `dist/` for the key value and `GEMINI_API_KEY`, expecting no key value
- [x] 5.4 Confirm local mode still works with a key and no sign-in
- [x] 5.5 Push the branch; on the Vercel preview, test status, a same-site request, a mismatched origin, wrong method, oversized request and rate limit responses
- [x] 5.6 Click through the preview: AI shows "Gemini · model" with no sign-in, and a suggestion changes data only after approval
- [x] 5.7 Confirm with the user before merging to `main`, then repeat the status and live AI checks on production
