# AGENTS.md — instructions for AI coding agents (Claude, Gemini, Codex, Copilot…)

You are working on **DealSync prototype v2** (two deals: Project Rioja and Project Phoenix), a React 19 + Vite 5 + TypeScript single-page app (runs on Node 18.18+) with a tiny AI gateway (Vite middleware locally, a Vercel function when hosted). Read this before changing anything. Product context lives in `docs/requirements/` (BRD + solution logic) and `README.md`.

## Run / verify
- `npm start` — dev server on :5173 (auto-installs on first run). `npm run dev` skips the browser.
- Before you finish ANY change: `npm run typecheck` and `npm run build`. If you touched `src/engine/**` or `sample-data/**`, also run `npm run check:engine` and compare with the "Golden numbers" below.
- There's no test runner yet; `scripts/check-engine.ts` is the regression harness.

## Architecture rules (do not break)
1. **All formulas live in `src/engine/model.ts`** (plus hygiene in `engine/quality.ts`). Screens only display `m` (the model) — never compute scores in components. Each score must stay traceable to its formula (BRD NFR "Explainability").
2. **All mutations go through `act(action, detail, recipe, opts)`** from `useStore()`. The recipe is an **Immer** draft recipe. `act` enforces read-only roles, recomputes quality issues if needed, and writes an audit event with the current screen (`module`) and an undo `patch`. Keep recipes **pure**: in StrictMode they can run twice, so never push into arrays captured from outside the recipe. Never call `setState` on the workspace directly. Show decisions with `<DecisionLog modules={[...]} />` or `<DecisionLogButton />`.
3. **All AI goes through `runAI(task, input)`** (`src/ai/client.ts`). Each AI feature is one entry in `src/ai/tasks.ts` with: `system` prompt, `prompt(input)`, optional `parse`, and a deterministic `fallback(input)`. A task MUST work without a key. Show results with `<AIChip result={r} />` so users can see the source.
4. **AI only suggests.** Never let an AI result change data without a human click (approve / confirm / apply). Log approvals with `kind: 'approve'`, overrides with `kind: 'override'`, AI calls with `kind: 'ai'`.
5. **The key never reaches the browser.** Only the two gateways read `GEMINI_API_KEY`: `server/aiPlugin.ts` locally (from `.env.local`, re-read per request) and `api/ai/[action].ts` when hosted (from Vercel's server-side environment variables). Both share `server/gemini.ts`, which must never be imported from `src/`. The hosted gateway must stay closed without `DEALSYNC_ACCESS_CODE`. Don't add `VITE_`-prefixed secrets or commit a key.
6. **Personal data** (`pii: true` glossary fields) is masked at ingest when `controls.maskPII` is on. Don't add features that store names/emails from identity or HR files.
7. Styling follows the Figma export (`design-reference/`): CSS classes in `src/styles.css` (Figma rules first, prototype additions at the bottom). Prefer existing classes (`card`, `card-header`, `gtable` + `--cols`, `btn`, `badge`, `ai-box`, `lesson-card`, `tabs`…). No CSS framework — plain CSS with a small reset at the top of `src/styles.css`. Keep Node 18 compatibility (Vite 5, @vitejs/plugin-react 4).

## How to…
- **Add an upload type**: add a `DatasetDef` in `src/engine/glossary.ts` (fields + synonyms + `screen`), a sample file in `sample-data/` (and the generator), optional quality rules in `engine/quality.ts`, then consume it in `engine/model.ts`. Uploads use `<UploadModal expected="key" />`.
- **Add an AI feature**: add a task in `src/ai/tasks.ts` (with fallback), call `runAI` from the screen, render `AIChip`, and require a human action to apply.
- **Add a screen**: create `src/screens/X.tsx`, add it to `PAGES` in `src/state/store.tsx`, route it in `src/App.tsx`, and add an icon name.
- **Change weights/thresholds**: `DEFAULT_CONFIG` in `src/engine/workspace.ts` (users can also edit in Governance → Scoring configuration). Bump `STORE_VERSION` in `store.tsx` if the saved-state shape changes incompatibly.
- **Add a deal**: add an entry to `DEALS` in `src/engine/workspace.ts` (info, users, owners, consents), a `sample-data/<deal>/` folder (+ generator), a `build<Deal>Demo`, and a loader in `store.tsx` (`import.meta.glob`).
- **Change demo state**: `buildDemoWorkspace(files, dealId)` in `src/engine/workspace.ts` replays the "cleaning decisions made before 05 Nov" on top of the raw sample files.

## Golden numbers (`npm run check:engine`)
**Rioja:** Applications hygiene 93 (raw upload 71) · ERP 85 · readiness underlying 85 → capped 79 NO-GO · suggested Day-1 27 Nov 2025 (+12 days) · separation ₹1.74M, seller ₹1.074M provisional → ₹1.03M after SPA reading · disputed ₹700K · email TSA = extension risk · benchmark 90% vs 50% · top prospect Alpha Industries.
**Phoenix:** 415 apps · servers 89 · network 81 · apps 86 · readiness 74 NO-GO (Solution Central blocked) · suggested TSA exit 12 Jan 2026 vs 03 Feb · separation ₹5.9M, disputed ₹3.2M · 5 TSA services at extension risk · build < 2 s.

## Spec-driven workflow (OpenSpec)
This repo uses OpenSpec (`openspec/`, slash commands under `.claude/commands/opsx/`, skills under `.claude/skills/`). For any new feature: `/opsx:propose` → review → `/opsx:apply` → `/opsx:archive`. The v1 build is captured in `openspec/changes/dealsync-prototype-v1/`, and the v2 changes in `openspec/changes/dealsync-prototype-v2/` (all tasks done). Next ideas are in `docs/BACKLOG.md`.

## Conventions
- TypeScript strict; functional React components; no new runtime dependencies without a reason (currently react, react-dom, immer).
- Dates are ISO `YYYY-MM-DD`; "today" in the deal is `s.deal.asOf` (not the system clock).
- Money is shown in rupees (₹, compact K/M); always format with `money()` from `engine/util.ts`, never hard-code a currency symbol.
- Keep sample data deterministic (seeded PRNG in the generator).
