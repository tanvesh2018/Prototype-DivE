## Context
Prototype for an academic/consulting concept; must run with `npm start` on a laptop, show credible data, and let the team iterate fast. Detailed architecture: `docs/ARCHITECTURE.md`; formulas: `docs/FORMULAS.md`; AI: `docs/AI_INTEGRATION.md`.

## Goals / Non-Goals
**Goals:** every BRD functional requirement visible and clickable; every score traceable; AI optional and swappable; deterministic demo.
**Non-Goals:** production security, persistence beyond the browser, scale beyond a few thousand records.

## Decisions
- **Single client-side store + pure derived model.** All scores are recomputed from state by `buildModel()`; avoids stale caches and makes explainability trivial. Alternative (server API) rejected for v1 setup cost.
- **`act()` as the only mutation path.** Gives read-only role enforcement, audit logging and quality-issue recomputation in one place.
- **AI via a Vite middleware gateway.** Keeps the key server-side with zero extra processes; `npm start` still a single command. Key file re-read per request so no restart.
- **Every AI task has a rule fallback.** Demo never depends on network/quota; the UI labels the source.
- **Seed = raw sample files + replayed cleaning decisions.** One source of truth for data; re-uploading a sample shows the raw (dirty) state.
- **Hygiene = share of records without open issues.** Simple, explainable, matches the 72→92 story.
- **Entanglement counts outgoing links only**, unclear links as seller; bucket rules evaluated in the order of the solution logic.

## Risks / Trade-offs
- localStorage size (~0.5 MB now) limits larger deals → move to a back end (backlog).
- Free Gemini tier rate limits → fallback covers failures; consider caching.
- Heuristic look-alike matching may miss pairs → AI duplicate check is a backlog item.
