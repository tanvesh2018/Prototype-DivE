## 1. Foundation
- [x] 1.1 Vite + React 19 + TS project, `npm start` with prestart auto-install and `.env.local` creation
- [x] 1.2 Port Figma CSS and screen layouts; UI kit (badges, tables, modals, menus, toasts, AI chip)
- [x] 1.3 Store with `act()`, audit log, localStorage persistence, hash routing

## 2. Data
- [x] 2.1 Glossary for 18 datasets and 12 components
- [x] 2.2 Deterministic sample-data generator (19 files) and seeded demo workspace
- [x] 2.3 Ingest: CSV/JSON/TXT parsing, dataset detection, rule column matching, PII masking
- [x] 2.4 Quality issues, hygiene score, merge/retire/fill actions, owner queue

## 3. Engine
- [x] 3.1 Dependency graph, entanglement, questionnaire links, move groups
- [x] 3.2 Priority Index, timing, buckets, waves
- [x] 3.3 Tracker progress and early warning; readiness with cap and what-if
- [x] 3.4 Cost split, funding options, TSA projection, product priority, decisions scoring
- [x] 3.5 Benchmarks, past-deal matching, prospect scoring

## 4. AI
- [x] 4.1 Gemini gateway (`server/aiPlugin.ts`) with model fallback
- [x] 4.2 `runAI` client with timeout + deterministic fallbacks
- [x] 4.3 16 AI tasks wired into screens with human approval

## 5. Screens
- [x] 5.1 Deal Overview  - [x] 5.2 Data & Inventory  - [x] 5.3 Dependency Explorer
- [x] 5.4 Separation Decisions  - [x] 5.5 Execution Tracker  - [x] 5.6 Day-1 Readiness
- [x] 5.7 Funding & TSA Exit  - [x] 5.8 Knowledge & Market Insights  - [x] 5.9 Governance & Settings
- [x] 5.10 Global search, notifications, role switcher, deal switcher

## 6. Verification & docs
- [x] 6.1 Typecheck + production build
- [x] 6.2 `npm run check:engine` golden numbers
- [x] 6.3 Playwright click-through of every screen and main flow
- [x] 6.4 README, AGENTS.md/CLAUDE.md/GEMINI.md, docs/*
