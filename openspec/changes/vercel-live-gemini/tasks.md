## 1. Shared Gemini logic

- [x] 1.1 Create a feature branch for this change
- [x] 1.2 Move `callGemini`, the model list and the placeholder-key check from `server/aiPlugin.ts` to `server/gemini.ts`
- [x] 1.3 Update `server/aiPlugin.ts` to use the shared module, keeping `.env.local` reading and its responses, and adding `authRequired: false` to status
- [x] 1.4 Confirm `npm run dev` and `npm run build` resolve the `.js` import path to `server/gemini.ts`

## 2. Hosted endpoints

- [x] 2.1 Add `api/ai/[action].ts` with `maxDuration: 30`, routing status, test and generate, and returning 405 for the wrong method and 404 for unknown actions
- [x] 2.2 Read `GEMINI_API_KEY` and `GEMINI_MODEL` from `process.env` only, and return no `keyHint` from status
- [x] 2.3 Add constant-time access-code checking, refusing test and generate when `DEALSYNC_ACCESS_CODE` is unset
- [x] 2.4 Measure the largest real AI task prompts, then set the size limit and return 413 above it; cap output tokens at 4,096
- [x] 2.5 Add best-effort per-IP limits for requests and failed codes, returning 429
- [x] 2.6 Log upstream errors on the server and return generic messages to the client
- [x] 2.7 Add `api` to `tsconfig.json` `include`

## 3. Client and settings screen

- [x] 3.1 Add `authRequired` to `AIStatus`, and set/get/clear functions for the code using `sessionStorage` with try/catch
- [x] 3.2 Send the `x-dealsync-access` header on test and generate calls
- [x] 3.3 Make `runAI()` use the fallback without calling generate when a required code is missing, and on 401 clear the code and update status
- [x] 3.4 Add code entry and clear controls to Governance → AI settings, shown only when `authRequired` is true
- [x] 3.5 Show hosted-appropriate setup text and status in Governance, hiding the `.env.local` steps and key hint on the hosted site

## 4. Docs and project rules

- [x] 4.1 Update AGENTS.md rule 5 and the CLAUDE.md key rule to allow a server-side Vercel environment variable, still banning `VITE_` secrets and the repo
- [x] 4.2 Update the README with hosted Gemini setup, the access code and troubleshooting; add `DEALSYNC_ACCESS_CODE` as a comment in `.env.example`
- [x] 4.3 Update the `openspec/config.yaml` tech-stack context, which says there's no back end

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and `npm run build`
- [x] 5.2 Run `npm run check:engine` and compare with the golden numbers in AGENTS.md, expecting no change
- [x] 5.3 Search `dist/` for the key value and `GEMINI_API_KEY`, expecting no key value
- [x] 5.4 Confirm local mode still works with a `.env.local` key and no access code
- [ ] 5.5 Push the branch; on the Vercel preview, test status, missing/wrong/correct code, wrong method, oversized request and rate limit responses
- [ ] 5.6 Click through the preview: without a code, AI shows "Rule-based fallback"; with a code, it shows "Gemini · model", and a suggestion changes data only after approval
- [ ] 5.7 Confirm with the user before merging to `main`, then repeat the status and correct-code checks on production
