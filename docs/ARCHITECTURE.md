# Architecture — DealSync prototype v1

```
Browser (React 19 SPA)                              Local Node (Vite dev/preview server)
┌──────────────────────────────────────────┐        ┌──────────────────────────────────┐
│ screens/*  ──read──▶ m = buildModel(s)    │        │ server/aiPlugin.ts               │
│     │                    ▲                │  POST  │  /api/ai/status  /generate /test │
│     └─act(recipe)──▶ store (s)            │ ─────▶ │  reads .env.local per request    │
│            │   audit + recomputeIssues    │        │  → Gemini generateContent        │
│            ▼                              │        └──────────────────────────────────┘
│      localStorage (dealsync.workspace.v1) │
│ ai/client.runAI(task) ──fallback()──▶ rules (no key / error / timeout)
└──────────────────────────────────────────┘
```

## Layers
| Layer | Files | Responsibility |
|---|---|---|
| Glossary | `src/engine/glossary.ts` | 18 dataset definitions (fields, synonyms, PII flags, sample file, screen), 12 components, 6 buckets, workstreams |
| Ingest | `src/engine/ingest.ts` | Parse CSV/JSON/TXT, detect dataset, rule column matching, apply mapping (dates/numbers normalised), PII masking into role/site counts |
| Quality | `src/engine/quality.ts` | Issues (missing, duplicate, look-alike, broken link, stale, orphan) with rule suggestions; hygiene = % records with no open issue; merge |
| Model | `src/engine/model.ts` | Graph + entanglement, classification (PI, timing, bucket), move groups, waves, tasks/early warning, readiness + cap, cost split, TSA burn-down, products, decisions, funding, benchmarks, matches, prospects, what-if |
| Workspace | `src/engine/workspace.ts` | Default config, roles, empty workspace, `ingest()` side effects (questionnaire → links, owner queue), demo seed |
| State | `src/state/store.tsx` | Single store, `act()` (read-only guard, issue recompute, audit), persistence, hash routing, toasts |
| AI | `src/ai/*` | `runAI` client, task registry (prompts + fallbacks), live context builder, framework library |
| UI | `src/components/*`, `src/screens/*`, `src/styles.css` | Figma visual language; one file per screen |

## State shape
`WorkspaceState` (`src/engine/types.ts`): deal, datasets (standardised rows), issues, ownerQueue, links (questionnaire/AI/manual/trial), appOverrides, decisions, wave overrides/releases/checklists, funding packages + SPA reading, learning drafts, chat, consents, controls, retention, users/role, config (all weights), audit, notifications read.

Everything derived (scores, buckets, groups, readiness…) is recomputed from state on every change — there is no cached score to go stale.

## Production gaps (deliberate for v1)
No auth/server DB (localStorage), no multi-deal tenancy, no file storage of raw uploads, no real Prowess/bank integration, Gemini via API key rather than an approved enterprise endpoint. See `BACKLOG.md`.
