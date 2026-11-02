# Formulas & rules (traceability)

All in `src/engine/model.ts` / `quality.ts`; weights in `DEFAULT_CONFIG` (`src/engine/workspace.ts`) and editable in Governance.

| Metric | Rule | Source step |
|---|---|---|
| Data hygiene (file) | 100 × records with no open issue ÷ records. 90+ green (gate) | Step 2 |
| Stale | `last_updated` older than 6 months; apps with 0 users, servers hosting no app → "unused" | Step 2 |
| Look-alike duplicate | token similarity of names ≥ 0.6 + same site + same owner → confidence 0.6–0.97 | Step 2 |
| Entanglement | Σ outgoing links: buyer 1, shared 2, seller 3 (unclear = seller). 0–3 low, 4–8 medium, 9+ high | Step 2 |
| D (dependency) | from entanglement: ≤2→1, ≤5→2, ≤8→3, ≤12→4, else 5 | Step 3 |
| Priority Index | 0.35C + 0.25D + 0.20R + 0.20S. ≥3.5 Day-1 critical; ≥2.75 Day-1+30; else post-TSA. Critical tool / revenue-linked ⇒ always Day-1 critical | Step 3 |
| Bucket | not used → Extract & Sunset; similar & not critical → Consolidate; no seller/shared link → Transfer as-is; unclear link → TSA; critical & copyable → Clone and Go; critical → TSA; old (≤2012) or not transferable → Stand-up new; else Clone and Go | Step 3 |
| Move group | union of apps sharing a server or a confirmed data flow | Step 2 |
| Seller share | 0.4 × cause + 0.4 × like-for-like + 0.2 × contract (1 / 0.5 / 0; blank contract = 0.5 provisional) | Step 4 |
| Early warning | not done AND (blocked, at risk, overdue, or not started & due ≤ 5 days) | Step 5 |
| Item readiness | 0.5 × tasks done% + 0.3 × tests passed% + 0.2 × hygiene (ERP data for Finance ERP). The 50/30/20 split is editable with the Readiness sliders. Items with no tasks and no tests are excluded (no evidence) | Step 6 |
| Readiness score | Σ component avg × component weight ÷ Σ weights (component weights editable with sliders, normalised to 100%, change logged and undoable); cap 79 if a critical-tool / revenue-linked item has a Blocked task. 90+ GO, 80–89 conditions, <80 NO-GO | Step 6 |
| TSA projection | expected% = elapsed ÷ (exit − prep start); actual% = milestones; projected exit = prep + elapsed ÷ actual%; risk if > 7 days late; extension cost = months × fee × 125% | Step 7 |
| Wave gate | wave may release only if min hygiene of its groups ≥ 90 | Step 7 |
| Affordability | "tight" if current ratio < 1 or D/E > 1.5 or interest cover < 3 | Step 10 |
| Past-deal match | industry 50 (related 30) + deal type 30 + apps band 15 + 5 | Step 9 |
| Prospect score | ≥5 segments +3 (≥3: +1), loss segment +3, D/E>1.5 +2, declining margin +1, strategic review +1 (max 10) | Step 11 |
| Suggested Day-1 / TSA exit | asOf + max(work days, consent floor) + readiness-gap days + industry buffer. Work days = open tasks ÷ pace (tasks done in the last 4 weeks ÷ 4, min 3/week) × 7. Gap days = ½ day per readiness point below GO. Consent floor = consent lead ÷ 5 when a critical item is blocked on consent/licence. Buffer and consent lead from `engine/standards.ts` (Semiconductor 7 d / 35 d, Financial services 14 d / 30 d, default 10 d / 30 d) | Step 5 |
| Funding flow | Disputed (or already-planned) separation lines. Affordability from Prowess as above. Bank loan = full disputed amount, released in two halves (M1 no blocked critical item, M2 readiness GO). Escrow = seller's provisional share × amount, held back from the purchase price. At settlement: seller owes agreed % × loan (+ same % of interest), paid from escrow (any excess paid directly); escrow remainder returned to seller; buyer repays the rest | Funding plan |

## Undo
Every `act()` stores a patch (before → after values, keyed by `_rid` / `id` / `name` for arrays). Undo re-applies the "before" values only where the current value still equals the "after" value; anything changed since is counted as a conflict and left alone. The undo itself is logged.
