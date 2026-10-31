# AI integration (Gemini)

**Key location:** `.env.local` → `GEMINI_API_KEY=...` (optional `GEMINI_MODEL`). Read on every request by `server/aiPlugin.ts`; never sent to the browser. Free key: https://aistudio.google.com/apikey.

**Flow:** screen → `runAI(task, input)` → `POST /api/ai/generate {system, prompt, json}` → Gemini `v1beta/models/{model}:generateContent` (JSON mode, temperature 0.2, thinking budget 0 on 2.5 models) → `task.parse` → UI shows result + `AIChip`. On missing key / error / 25 s timeout → `task.fallback(input)`.

Model fallback chain: `GEMINI_MODEL` → gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash (only on 404/400 model errors).

| Task id (`src/ai/tasks.ts`) | Where | Human control |
|---|---|---|
| column-mapping | Upload dialog | low-confidence columns must be confirmed |
| gap-fill | Data & Inventory → Ask AI to fill blanks | Approve / Reject / Ask owner |
| hidden-links | Dependency Explorer | Confirm / Reject per link |
| trial-run | Dependency Explorer (unclear link) | checklist only; user records result |
| component-tag | Decisions → Classification | accept per app |
| bucket-advice | Decisions → App strategy | Confirm or logged override |
| board-summary | Decisions → Leadership options | Approve / Request changes |
| spa-reader | Funding → Cost allocation | Confirm & apply |
| early-warning | Execution Tracker | Create escalation |
| readiness-path | Day-1 Readiness | explanation only (numbers from formula) |
| learning-record | Insights → Close & learn | steward edit + approve; consent check |
| copilot | Insights → Deal Copilot | read-only; cites sources or "I don't know" |
| funding-advice | Funding options | save package; share needs consent |
| tsa-advice | TSA exit | advice only |
| prospect-note | Benchmarks & prospects | advice only |
| deal-brief | Deal Overview | advice only |

Copilot grounding (`src/ai/context.ts`): live dashboard snapshot (score, blockers, projections from the formula, tasks, costs, TSA, hygiene, decisions), framework library (`frameworks.ts`) and top-4 matched past deals.

To change an AI behaviour, edit its entry in `tasks.ts` only.
