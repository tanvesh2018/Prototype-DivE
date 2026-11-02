## Context
Phoenix is ~100× Rioja's record count. The v1 store (localStorage, structuredClone per action, full issue recompute per change) could not handle it, and the undo request needed reversible actions.

## Decisions
- **Immer for mutations.** `act()` runs `produce`. A structural diff of the before and after states (`diffState`) becomes the audit event's `patch`. Arrays are diffed by `_rid` / `id` / `name`, so undo survives reordering. The diff skips audit, chat and AI cache, and is capped at 6,000 operations (bigger bulk actions are logged without undo).
- **Undo = conditional revert.** Each value is restored only if the current value still equals the patched value; the remaining values are reported as conflicts. The undo is itself an audited event (`undoOf`).
- **Issue recompute only when hygiene inputs change** (datasets, issue statuses, mappings). Ingest defers recompute to the end (`deferIssues`). Phoenix builds in about 1.5 s.
- **IndexedDB** per deal (`ws:<dealId>`). The session and portfolio summaries stay in localStorage for a fast first paint.
- **Deal mode** `day1` vs `tsa_exit` drives the milestone label ("Day-1" / "TSA exit"), the phase bar and the burn-down start date.
- **Suggested date** sits in the engine (`suggestMilestone`), with industry constants in `standards.ts`, so it stays traceable and editable.
- **Funding flow state** is kept per cost line in `funding.flows[costId]`. Every step is an `act()`, so the whole flow appears in the decision log and is undoable. The bank role may act only on its own steps (`allowReadOnly`).
- **Drag-to-join**: pointer events on a node handle, with the drop target resolved through `data-id`. A drop either confirms a matching suggestion, re-targets the focused suggestion (old one marked rejected, new manual link added) or creates a manual confirmed link.

## Risks
- Recipes must be pure because React StrictMode double-invokes them; this is documented in AGENTS.md.
- Very large bulk fixes on Phoenix exceed the 6,000-operation patch cap and cannot be undone. The log says so.
