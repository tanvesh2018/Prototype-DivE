## 1. Multi-deal
- [x] 1.1 Phoenix data generator and sample files
- [x] 1.2 Deal registry, per-deal users, owners and consents; deal and profile switchers; portfolio strip
- [x] 1.3 IndexedDB store, lazy sample loading, boot and busy states
- [x] 1.4 Engine performance (deferred issues, server-only unused rule, light what-if)

## 2. Decision log & undo
- [x] 2.1 Immer `act()`, `diffState` / `revertPatch`, `undo(eventId)`
- [x] 2.2 `DecisionLog` component and button on every decision screen; all-screens log in Governance

## 3. Explainability
- [x] 3.1 Hygiene ⓘ and per-file breakdown modal
- [x] 3.2 Entanglement ⓘ (plain English, per-link points)
- [x] 3.3 C/D/R/S plain-words table, labelled scales, "why this priority?"
- [x] 3.4 Readiness calculation logic and contributions table

## 4. Control
- [x] 4.1 AI-link dropdown, confirm/reject, drag-to-join / re-target
- [x] 4.2 Readiness weight sliders (component and item formula) with preview
- [x] 4.3 Suggested Day-1 / TSA-exit date with breakdown and "use suggested date"

## 5. Funding
- [x] 5.1 Remove Leadership, Funding options and Cost allocation tabs
- [x] 5.2 Funding flow Steps 1–5 with bank underwriting + escrow; bank-only view (rental route removed in v2.2)
- [x] 5.3 AI tasks for each step, each with a rule fallback

## 6. Usability pass (v2.1)
- [x] 6.1 Readiness: weightage studio moved into the component column (mix bar, colour-matched sliders, Now → Preview, item-formula tab with worked example)
- [x] 6.2 Funding desk: cost cards, journey bar, single "next step" card with plain-English purpose, bank funding plan card, money picture, all-steps checklist, coming-up list; completed steps stay visible with a Next button
- [x] 6.3 TSA exit board: summary tiles, per-service plain-English verdict, Today / Target / Expected timeline, milestone progress vs plan, glossary
- [x] 6.5 Rental route removed: funding is bank loan + escrow only; rental quotes dataset, sample files and AI tasks removed; Dependency Explorer toolbar no longer clips its legend
- [x] 6.4 Layout fixes: Tracker suggested-date card, wrapping table toolbars, needed-by badge, classification table min-width + scroll, retention steps, migration-wave summaries for 400+ app estates, phase-date wrap

- [x] 6.6 Settlement available at any time (`settlementPlan()` in the engine): before plan / before release / after release
- [x] 6.7 Governance → **Fresh demo** button: resets both deals and the session for a clean demo

## 7. Verify
- [x] 7.1 Typecheck, build, `check:engine` for both deals (Rioja golden numbers unchanged)
- [x] 7.2 Browser click-through of both deals, RBAC and the bank view
- [x] 7.3 Docs: README, AGENTS, FORMULAS, ARCHITECTURE, DEMO_SCRIPT, BACKLOG
