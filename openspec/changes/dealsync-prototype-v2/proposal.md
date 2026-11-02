## Why

Feedback on prototype v1 (design and colours accepted as-is) asked for:
- the second case deal, Project Phoenix;
- more explainability: hygiene, entanglement, C/D/R/S, readiness calculation;
- human control: decision logs with undo, manual link joining, weight sliders;
- a realistic suggested Day-1 date;
- the funding approach from the "Funding plan alternative" document (bank underwriting with escrow) in place of the generic funding options.

## What Changes

- New: **Project Phoenix** (Meridian Payments / Atlas Bancorp, 90-day TSA exit, ~415 apps, 46k+ records, 23 sites).
  - Comes with its own generated sample data, its own users, and role-based deal access through a deal switcher and profile switcher.
  - Adds a portfolio strip for multi-deal users.
  - Workspaces are stored per deal in IndexedDB.
- New: **Decision log with undo** everywhere decisions are made.
  - Tabs on Data & Inventory, Separation Decisions and Funding.
  - Buttons on Dependency Explorer, Tracker and Readiness.
  - All screens in Governance.
  - Implemented with Immer patches.
- New: hygiene score explainer (ⓘ and per-file breakdown).
- New: entanglement ⓘ written for non-M&A readers.
- New: plain-words C/D/R/S classification with per-app "why this priority?".
- New: Dependency Explorer AI-link dropdown, plus drag-to-join and re-target for AI-suggested links.
- New: **Suggested Day-1 / TSA-exit date** based on pace, readiness gap, industry buffer and consent lead.
- New: Readiness **weight sliders**, with a live preview and stated calculation logic.
- New: **Funding flow**:
  1. Understand the cost.
  2. Check affordability.
  3. Agree the bank funding plan: bank pack, consent + independence, bank Q&A, milestone releases; the seller's likely share is held in escrow.
  4. Settle the dispute.
  5. Record the lesson.
- **BREAKING (UI):** removed the Leadership options tab, the Funding options tab and the Cost allocation tab. Cost-split logic is retained inside Funding flow Step 4.

## Capabilities

### New Capabilities
- `multi-deal-access`: deal registry, per-deal users/RBAC, deal switching, portfolio view.
- `decision-log-undo`: audit events carry module + reversible patch; undo with conflict detection.

### Modified Capabilities
- `data-intake-cleaning`, `dependency-mapping`, `classification-decisions`, `execution-readiness`, `funding-tsa-exit`.

## Impact

- New dependency: `immer`.
- New files:
  - `src/engine/patch.ts`
  - `src/engine/standards.ts`
  - `src/state/idb.ts`
  - `src/components/DecisionLog.tsx`
  - `scripts/generate-phoenix-data.mjs`
  - `sample-data/phoenix/*`
- Rewritten: `src/state/store.tsx`, Funding screen head, Readiness screen.
- v1 saved browser state is ignored (store version 2).
- Rioja golden numbers are unchanged.
