# PwC DealSync Command Centre — Prototype v2

A working, clickable prototype of **DealSync**: the deal-technology command centre that turns scattered seller IT data into one deal-ready baseline, tracks Day-1 readiness (Go / No-go), settles cost disputes, plans the TSA exit and captures reusable lessons — with **Gemini** as an optional AI layer behind every "AI" feature.

> All company names and numbers are illustrative. Two deals from the case are included:
> - **Project Rioja**: ChipCo buying a chip-design business from SemiCorp. Day-1 is 15 Nov 2025, as of 05 Nov.
> - **Project Phoenix**: Meridian Payments buying a payments business from Atlas Bancorp. It is a 90-day TSA exit (~415 apps, 4,600 IT staff, 10,000+ mailboxes, 9,000+ data-centre assets, 35k network records, 23 sites), with exit due 03 Feb 2026.
>
> What changed in v2: [`openspec/changes/dealsync-prototype-v2/`](openspec/changes/dealsync-prototype-v2/proposal.md). Requirements: [`docs/requirements/BRD.md`](docs/requirements/BRD.md) · [`docs/requirements/SOLUTION_LOGIC.md`](docs/requirements/SOLUTION_LOGIC.md).

---

## 1. Start it

```bash
npm start
```

That's it. On first run `npm start` installs dependencies, creates `.env.local`, starts the app on **http://localhost:5173** and opens your browser. (Needs Node.js **18.18 or newer** — check with `node -v`. If dependencies from an older attempt are broken, `npm start` repairs them automatically.)

The app opens on the Project Rioja demo deal (as of 05 Nov 2025): readiness is **79 / NO-GO**, capped from 85 because CircuitDesign Pro's licence consent is blocked.

Switch to **Project Phoenix** from the deal switcher (top-left). It builds in a few seconds the first time; its TSA-exit readiness is **74 / NO-GO**, because the Solution Central product-registration feed is blocked.

### Who sees which deal (role-based access)
Pick a person from the profile menu (top-right) to change who you are viewing as.

| Person | Role | Deals |
|---|---|---|
| Alex Chen | PwC engagement manager | Rioja + Phoenix (portfolio strip on the Overview) |
| Priya Nair, Marco Lee, … | PwC consultants | Rioja |
| Zofia Nowak, Raj Patel, Emma Brown | PwC consultants | Phoenix |
| Sophie Martin, James Cole, Lena Fischer | ChipCo client (read-only) | Rioja |
| Laura Bennett, Daniel Ortiz | Meridian client (read-only) | Phoenix |
| Northbank Credit | Funding partner | Funding flow only, and only after the client consents |

Each deal keeps its own workspace in the browser (IndexedDB). Old v1 saved state is ignored, so the demo rebuilds itself on first start.

## 2. Turn on Gemini (optional — the prototype works without it)

1. Get a free API key at **https://aistudio.google.com/apikey**
2. Open **`.env.local`** in the project root and paste it:
   ```
   GEMINI_API_KEY=AIza...your-key...
   ```
3. Save. No restart needed — go to **Governance & Settings → AI engine → Test connection**.

Optional: `GEMINI_MODEL=gemini-2.5-flash` (default; falls back to `gemini-2.5-flash-lite`, then `gemini-2.0-flash`).

How it works: the browser calls `/api/ai/*` on the local dev server; [`server/aiPlugin.ts`](server/aiPlugin.ts) adds the key and forwards to Gemini, so the key never reaches the browser. Without a key — or if Gemini errors or times out — every AI feature falls back to deterministic rules ([`src/ai/tasks.ts`](src/ai/tasks.ts)), and the UI labels each result **"Gemini · model"** or **"Rule-based fallback"**.

### On the hosted site (Vercel)

[`api/ai/[action].ts`](api/ai/[action].ts) is the hosted gateway. In the Vercel project, go to **Settings → Environment Variables**, add `GEMINI_API_KEY` for Production and Preview (without a `VITE_` prefix), then redeploy.

Visitors get live Gemini with no sign-in, so anyone can use the key's quota. The gateway accepts same-site requests only and limits size, tokens and request rate, but a determined script can get past these. **Set a usage limit for the key on Google's side**, and don't send real deal data through a free-tier key.

## 3. The 9 screens

| Screen | What you can do |
|---|---|
| **Deal Overview** | Live readiness, estate, workstreams and funding gap; drill-down into the cap; blockers and pending decisions (click any one); AI daily brief; export a printable board pack |
| **Data & Inventory** | Click any file's hygiene score to see exactly how it is calculated. **Decisions** tab lists every cleaning decision, with Undo. Upload any file (AI column matching + confirm low-confidence columns); hygiene score per file; quality queue (missing values, duplicates, look-alikes, broken links, stale or unused records) with rule fixes, AI gap-fills, merge, retire and send-to-owner; owner queue (answer, escalate, reassign); browse every record |
| **Dependency Explorer** | Dependency map by move group (buyer / shared / seller links). **AI-suggested links** dropdown shows all AI links or one at a time. Confirm, reject, or **drag** from a node's blue handle onto another app to join or re-target a link. Entanglement score with a plain-English ⓘ explainer; AI hidden-link finder (confirm or reject); owner questionnaire; unclear links get an AI trial-run checklist and a recorded result; export the map |
| **Separation Decisions** | Six-bucket strategy cards per app with rule reasoning, AI recommendation, confirm or override (with a logged reason); classification explained in plain words (C = business criticality, D = seller dependency, R = regulatory risk, S = security risk, each 1–5, with labelled scales) plus a "why this priority?" breakdown per app; decision log with undo |
| **Execution Tracker** | **Suggested Day-1 / TSA-exit date** based on current pace, the readiness gap, industry buffer and consent lead time, with the working shown and "Use suggested date". 312 tasks with filters, search, inline status, add / edit / delete, export; early-warning rule plus AI next steps; create an escalation |
| **Day-1 Readiness** | Score with formula drill-down per component and item. A **Tune the weightages** studio sits under the component list: a colour-coded weight-mix bar, one slider per component (with the points each adds), an item-formula tab (tasks / tests / hygiene) with a worked example, and a live Now → Preview score before you apply (logged, undoable). Step-by-step **calculation logic** with a contributions table; test evidence; what-if simulator; AI "fastest path to GO"; printable board scorecard |
| **Funding & TSA Exit** | **Funding desk** for each disputed cost: pick the cost card → a 5-stage journey bar (Understand → Decide → Get the money → Settle → Learn) → one **"Your next step"** card at a time, in plain English, with who acts and what AI does. Funding is by **bank loan + escrow**: the bank lends now (released in two halves at milestones), the seller's likely share is held in escrow from the purchase price, and nobody pays new cash while the dispute runs. At settlement the escrow repays the seller's share, the remainder goes back to the seller and the buyer repays its share. A **money picture** panel shows who pays (split bar), the loan, tranches released, escrow held and days left; an "All steps" checklist lets you revisit any step. **TSA exit board**: summary tiles, one card per service with a plain-English verdict, a Today / Target / Expected timeline and milestone progress vs plan, "Record a finished milestone" and "Ask AI how to recover"; burn-down and a glossary. Migration waves gated on data hygiene; product priority by blocked revenue |
| **Knowledge & Market Insights** | Deal Copilot (live numbers + frameworks + past deals, cites sources, says "I don't know"); Close & Learn (AI anonymisation → steward approval → consent check); framework library and past-deal matches; benchmarks; prospect scoring with AI outreach notes |
| **Governance & Settings** | Decision log across all screens (with undo); AI engine status and test; role-based access (switch "View as" in the profile menu: client = read-only, bank = funding summary only); consent registry; PII and AI controls; retention; scoring weights and thresholds (no rebuild); deal dates; reset, empty or import/export the workspace; full audit log |

Top bar: global search (⌘K), notifications, profile / role switcher, deal switcher. A **Decision log** button (with undo) sits on Dependency Explorer, Execution Tracker and Readiness, and there are Decision-log tabs on Data & Inventory, Separation Decisions and Funding.

## 4. Sample upload files — `sample-data/`

Every upload button accepts these files (they're also bundled, so you can pick them from the upload dialog). They're deliberately messy: non-standard headers, blanks, duplicates, stale records, broken links and personal data.

| File | Upload from | What it exercises |
|---|---|---|
| `01_Applications.csv` | Data & Inventory | 27 apps (+1 duplicate row); blank site / vendor / owner, broken link `SRV-99`, stale FaxGateway with 0 users → hygiene **71** raw |
| `02_Server_Inventory.csv` | Data & Inventory | Look-alike pair "Payments Server 1" / `SRV-PAY-01`, exact duplicate, orphan server |
| `03_Network_Assets.csv` | Data & Inventory | 1,254 devices across 6 segments; missing site / owner, stale devices, duplicate tags |
| `04_Licence_Register.csv` | Data & Inventory | 42 licences; blank transferability → owner queue; licence for a non-existent app |
| `05_User_Accounts.csv` | Data & Inventory | 340 named users → **masked** into role/site counts at upload |
| `06_Moving_Employees_HR.csv` | Data & Inventory | 186 employees → masked |
| `07_Cost_Register.csv` | Funding → Upload data | Run cost per system + the ₹1.74M separation lines (contract answer blank → SPA step) |
| `08_TSA_Schedule.csv` | Funding → Upload data | 4 TSA services, ₹90K/month; email is behind plan |
| `09_Finance_ERP_Master_Data.csv` | Data & Inventory | ERP vendor master scoring **85** → blocks Wave 2 |
| `10_Task_Tracker.csv` | Execution Tracker → Import tracker | 312 tasks across 8 workstreams |
| `11_Test_Results.csv` | Day-1 Readiness → Upload test results | 47 Day-1 tests (42 passed) |
| `12_Owner_Questionnaire.csv` | Dependency Explorer → Upload questionnaire | Owner answers → data flows, seller-service links, one "Not sure" |
| `13_Product_Revenue.csv` | Funding → Upload data | Blocked products by revenue (T-200 USA ₹4M/qtr) |
| `14_Prowess_Financials.csv` | Funding → Upload data | ChipCo (cash-tight) vs SemiCorp (can absorb) |
| `15_Prospect_Universe.csv` | Insights → Upload prospects | 40 companies; Alpha Industries scores top |
| `16_Past_Learning_Records.json` | Insights → Upload learning records | 20 anonymised past deals (benchmark 90% vs 50%) |
| `17_Decision_Options.csv` | (kept for reference; the Leadership tab was removed in v2) | 4 leadership decisions |
| `18_SPA_Cost_Clauses.txt` | Funding flow → Step 4 → Read the SPA clause | Clause 7.4/7.5/9.2 for the AI SPA reader |
| `19_Closing_Lessons_Rioja.txt` | Insights → Close & learn → Upload notes | Closing answers to anonymise |

**Project Phoenix files** live in `sample-data/phoenix/` with the same numbering (01 apps 421 rows incl. duplicates, 02 data-centre assets 9,240, 03 network 35,824, 05 mailboxes 10,240, 06 conveying staff 4,600, 07 costs with ₹2.3M + ₹0.9M disputed, 08 12 TSA services, 10 tracker 1,210 tasks, 13 148 products…). The upload dialog offers the sample files of whichever deal is active.

Regenerate them deterministically with `npm run generate:data` (edit [`scripts/generate-sample-data.mjs`](scripts/generate-sample-data.mjs) or [`scripts/generate-phoenix-data.mjs`](scripts/generate-phoenix-data.mjs)). To practise the full upload journey, go to **Governance → Start empty** and upload the files one by one.

## 5. A 5-minute demo path

See [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md). Short version: Overview (79 NO-GO) → Data & Inventory → re-upload `01_Applications.csv` (71) → apply rule fixes + approve AI suggestions → Owner queue: answer "Has EDA Corp consented to L-07?" = **Yes** → Readiness jumps to Go-with-conditions → what-if → Copilot "What moves us to 90?" → Funding: read SPA clause → ₹1.03M / ₹0.71M split.

## 6. Scripts

| Command | Purpose |
|---|---|
| `npm start` | Install-if-needed, start dev server, open browser |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run preview` | Serve the build (the AI gateway works here too) |
| `npm run typecheck` | TypeScript only |
| `npm run check:engine` | Print headline numbers for both deals computed from `sample-data/` (`-- rioja` / `-- phoenix` for one) |
| `npm run generate:data` | Rebuild all sample files |

## 7. Project map

```
server/aiPlugin.ts        Gemini gateway (/api/ai/status | generate | test); reads .env.local per request
server/gemini.ts          Gemini call shared by both gateways
api/ai/[action].ts        Hosted gateway for Vercel; reads env vars, public with guards
src/ai/                   client.ts (runAI + fallback), tasks.ts (all prompts + rule fallbacks), context.ts, frameworks.ts
src/engine/               glossary (datasets & 12 components), ingest (CSV → standard rows, PII masking),
                          quality (issues + hygiene), model (every score/formula), workspace (seed + ingest)
src/state/store.tsx       single store: act() = Immer recipe → audit event with an undo patch; per-deal workspaces in IndexedDB; hash routing
src/engine/patch.ts       diff / revert used by Decision-log undo
src/engine/standards.ts   industry buffers used by the suggested Day-1 / TSA-exit date
src/components/DecisionLog.tsx  reusable decision log (filter by screen, undo, CSV) + ⓘ InfoTip
src/screens/              one file per screen
src/components/           UI kit (Figma language) + UploadModal
sample-data/              upload files (also bundled for the in-app sample picker)
docs/                     requirements, architecture, formulas, AI integration, demo script, backlog
openspec/                 spec-driven change history (changes/dealsync-prototype-v1, -v2)
design-reference/         original Figma Make export (visual source of truth)
```

## 8. Troubleshooting

- **Port busy** → Vite picks the next free port; read the terminal URL.
- **AI shows "Rule-based fallback"** → no key in `.env.local`, or Gemini returned an error (see the terminal and the chip tooltip). Test it in Governance. On the hosted site, also check the Vercel variable and that you redeployed after adding it.
- **Want a clean slate** → Governance → *Reset to demo data* resets the active deal (or clear the browser's site data).
- **Undo says "conflicts"** → a later change touched the same records; undo the later one first.
- **Behind a corporate proxy** → Node's `fetch` may not reach Gemini; the app keeps working on the fallback rules.
