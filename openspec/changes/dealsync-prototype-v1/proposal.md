## Why

PwC deal teams run IT carve-outs from scattered seller spreadsheets, find hidden dependencies too late, and argue about costs while Day-1 approaches (see `docs/requirements/BRD.md`). We need a working prototype of DealSync that demonstrates the full 11-step solution logic end-to-end on realistic data, with an AI layer that can use Gemini but never blocks the demo when no key is available.

## What Changes

- New: React/Vite single-page app implementing all 9 Figma screens (Deal Overview, Data & Inventory, Dependency Explorer, Separation Decisions, Execution Tracker, Day-1 Readiness, Funding & TSA Exit, Knowledge & Market Insights, Governance & Settings) with every button wired.
- New: upload pipeline for 18 file types with AI/rule column matching, PII masking, quality checks, hygiene scoring and an owner queue.
- New: deterministic scoring engine (entanglement, Priority Index, buckets, move groups, readiness with blocker cap, cost split, TSA projection, wave gate, funding, benchmarks, prospects).
- New: central Gemini gateway (`/api/ai/*`, key in `.env.local`) with 16 AI tasks, each with a rule-based fallback; AI only suggests.
- New: 19 messy sample files (`sample-data/`) plus a seeded Project Rioja demo state; `npm start` runs everything.
- New: role-based "view as", consent registry, audit log, configurable weights.
- Non-goals: real authentication/back end, multi-deal tenancy, Excel parsing, live Prowess/bank integrations.

## Capabilities

### New Capabilities
- `data-intake-cleaning`: upload, column matching, PII masking, quality issues, hygiene gate, owner queue.
- `dependency-mapping`: graph, entanglement, hidden-link suggestions, questionnaire, unclear-link trial runs, move groups.
- `classification-decisions`: components, Priority Index, six buckets with override, leadership options, board summary, decision log.
- `execution-readiness`: shared tracker, early warning, Day-1 Readiness Score with cap, drill-down, test evidence, what-if.
- `funding-tsa-exit`: cost split with SPA reader, funding options, TSA burn-down, waves with data gate, product priority.
- `knowledge-copilot`: grounded Copilot, close & learn, framework library, past-deal matching, benchmarks, prospects.
- `governance-ai-gateway`: roles, consents, controls, retention, configuration, audit, central Gemini gateway with fallback.

### Modified Capabilities
(none)

## Impact

Greenfield code in `src/`, `server/`, `scripts/`, `sample-data/`, `docs/`. Browser localStorage holds the workspace. Only external call: Gemini API (optional).
