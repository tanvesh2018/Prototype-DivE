# PwC DealSync Command Centre — Prototype v1

A working, clickable prototype of **DealSync**: the deal-technology command centre that turns scattered seller IT data into one deal-ready baseline, tracks Day-1 readiness (Go / No-go), settles cost disputes, plans the TSA exit and captures reusable lessons — with **Gemini** as an optional AI layer behind every "AI" feature.

> All company names and numbers are illustrative (Project Rioja: ChipCo buying a chip-design business from SemiCorp, Day-1 15 Nov 2025). Requirements: [`docs/requirements/BRD.md`](docs/requirements/BRD.md) · [`docs/requirements/SOLUTION_LOGIC.md`](docs/requirements/SOLUTION_LOGIC.md).

---

## 1. Start it

```bash
npm start
```

That's it. On first run `npm start` installs dependencies, creates `.env.local`, starts the app on **http://localhost:5173** and opens your browser. (Needs Node.js **18.18 or newer** — check with `node -v`. If dependencies from an older attempt are broken, `npm start` repairs them automatically.)

The app opens pre-loaded with the Project Rioja demo deal (as of 05 Nov 2025: readiness **79 / NO-GO**, capped from 85 because CircuitDesign Pro's licence consent is blocked).

## 2. Turn on Gemini (optional — the prototype works without it)

1. Get a free API key at **https://aistudio.google.com/apikey**
2. Open **`.env.local`** in the project root and paste it:
   ```
   GEMINI_API_KEY=AIza...your-key...
   ```
3. Save. No restart needed — go to **Governance & Settings → AI engine → Test connection**.

Optional: `GEMINI_MODEL=gemini-2.5-flash` (default; falls back to `gemini-2.5-flash-lite`, then `gemini-2.0-flash`).

How it works: the browser calls `/api/ai/*` on the local dev server; [`server/aiPlugin.ts`](server/aiPlugin.ts) adds the key and forwards to Gemini, so the key never reaches the browser. Without a key — or if Gemini errors or times out — every AI feature falls back to deterministic rules ([`src/ai/tasks.ts`](src/ai/tasks.ts)), and the UI labels each result **"Gemini · model"** or **"Rule-based fallback"**.

## 3. The 9 screens

| Screen | What you can do |
|---|---|
| **Deal Overview** | Live readiness, estate, workstreams and funding gap; drill-down into the cap; blockers and pending decisions (click any one); AI daily brief; export a printable board pack |
| **Data & Inventory** | Upload any file (AI column matching + confirm low-confidence columns); hygiene score per file; quality queue (missing values, duplicates, look-alikes, broken links, stale or unused records) with rule fixes, AI gap-fills, merge, retire and send-to-owner; owner queue (answer, escalate, reassign); browse every record |
| **Dependency Explorer** | Dependency map by move group (buyer / shared / seller links); entanglement score; AI hidden-link finder (confirm or reject); owner questionnaire; unclear links get an AI trial-run checklist and a recorded result; export the map |
| **Separation Decisions** | Six-bucket strategy cards per app with rule reasoning, AI recommendation, confirm or override (with a logged reason); classification table (component, C/D/R/S, Priority Index, timing); leadership options with security gate, editable scores, AI board summary, approve or request changes; decision log |
| **Execution Tracker** | 312 tasks with filters, search, inline status, add / edit / delete, export; early-warning rule plus AI next steps; create an escalation |
| **Day-1 Readiness** | Score with formula drill-down per component and item; record test results; what-if simulator; AI "fastest path to GO"; printable board scorecard |
| **Funding & TSA Exit** | Escrow, bridge (EMI calculator) and lease options; Prowess affordability; save a funding package and share it with the bank (consent-gated); 3-question cost split with AI SPA-clause reader; TSA burn-down and extension risk; migration waves gated on data hygiene, with a 12-step checklist; product priority by blocked revenue |
| **Knowledge & Market Insights** | Deal Copilot (live numbers + frameworks + past deals, cites sources, says "I don't know"); Close & Learn (AI anonymisation → steward approval → consent check); framework library and past-deal matches; benchmarks; prospect scoring with AI outreach notes |
| **Governance & Settings** | AI engine status and test; role-based access (switch "View as" in the profile menu: client = read-only, bank = funding summary only); consent registry; PII and AI controls; retention; scoring weights and thresholds (no rebuild); deal dates; reset, empty or import/export the workspace; full audit log |

Top bar: global search (⌘K), notifications, profile / role switcher, deal switcher.

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
| `07_Cost_Register.csv` | Funding → Upload data | Run cost per system + the $1.74M separation lines (contract answer blank → SPA step) |
| `08_TSA_Schedule.csv` | Funding → Upload data | 4 TSA services, $90K/month; email is behind plan |
| `09_Finance_ERP_Master_Data.csv` | Data & Inventory | ERP vendor master scoring **85** → blocks Wave 2 |
| `10_Task_Tracker.csv` | Execution Tracker → Import tracker | 312 tasks across 8 workstreams |
| `11_Test_Results.csv` | Day-1 Readiness → Upload test results | 47 Day-1 tests (42 passed) |
| `12_Owner_Questionnaire.csv` | Dependency Explorer → Upload questionnaire | Owner answers → data flows, seller-service links, one "Not sure" |
| `13_Product_Revenue.csv` | Funding → Upload data | Blocked products by revenue (T-200 USA $4M/qtr) |
| `14_Prowess_Financials.csv` | Funding → Upload data | ChipCo (cash-tight) vs SemiCorp (can absorb) |
| `15_Prospect_Universe.csv` | Insights → Upload prospects | 40 companies; Alpha Industries scores top |
| `16_Past_Learning_Records.json` | Insights → Upload learning records | 20 anonymised past deals (benchmark 90% vs 50%) |
| `17_Decision_Options.csv` | Separation Decisions → Upload decision options | 4 leadership decisions incl. laptops (B 3.65 vs A 3.05, C removed) |
| `18_SPA_Cost_Clauses.txt` | Funding → Cost allocation → Upload SPA text | Clause 7.4/7.5/9.2 for the AI SPA reader |
| `19_Closing_Lessons_Rioja.txt` | Insights → Close & learn → Upload notes | Closing answers to anonymise |

Regenerate them deterministically with `npm run generate:data` (edit [`scripts/generate-sample-data.mjs`](scripts/generate-sample-data.mjs)). To practise the full upload journey, go to **Governance → Start empty** and upload the files one by one.

## 5. A 5-minute demo path

See [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md). Short version: Overview (79 NO-GO) → Data & Inventory → re-upload `01_Applications.csv` (71) → apply rule fixes + approve AI suggestions → Owner queue: answer "Has EDA Corp consented to L-07?" = **Yes** → Readiness jumps to Go-with-conditions → what-if → Copilot "What moves us to 90?" → Funding: read SPA clause → $1.03M / $0.71M split.

## 6. Scripts

| Command | Purpose |
|---|---|
| `npm start` | Install-if-needed, start dev server, open browser |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run preview` | Serve the build (the AI gateway works here too) |
| `npm run typecheck` | TypeScript only |
| `npm run check:engine` | Print headline numbers computed from `sample-data/` (use after changing data or formulas) |
| `npm run generate:data` | Rebuild all sample files |

## 7. Project map

```
server/aiPlugin.ts        Gemini gateway (/api/ai/status | generate | test); reads .env.local per request
src/ai/                   client.ts (runAI + fallback), tasks.ts (all prompts + rule fallbacks), context.ts, frameworks.ts
src/engine/               glossary (datasets & 12 components), ingest (CSV → standard rows, PII masking),
                          quality (issues + hygiene), model (every score/formula), workspace (seed + ingest)
src/state/store.tsx       single store: act() = audited mutation, persisted to localStorage, hash routing
src/screens/              one file per screen
src/components/           UI kit (Figma language) + UploadModal
sample-data/              upload files (also bundled for the in-app sample picker)
docs/                     requirements, architecture, formulas, AI integration, demo script, backlog
openspec/                 spec-driven change history (changes/dealsync-prototype-v1)
design-reference/         original Figma Make export (visual source of truth)
```

## 8. Troubleshooting

- **Port busy** → Vite picks the next free port; read the terminal URL.
- **AI shows "Rule-based fallback"** → no key in `.env.local`, or Gemini returned an error (see the terminal and the chip tooltip). Test it in Governance.
- **Want a clean slate** → Governance → *Reset to demo data* (or clear the browser's site data).
- **Behind a corporate proxy** → Node's `fetch` may not reach Gemini; the app keeps working on the fallback rules.
