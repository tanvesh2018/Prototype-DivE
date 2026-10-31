# Backlog — candidate changes for v2+

Propose each with `/opsx:propose <name>`.

- **Excel upload (.xlsx)** via SheetJS, multi-sheet detection.
- **Backend + auth**: persist workspaces server-side (SQLite/Postgres), real login, per-deal tenancy, bank portal.
- **Multi-deal portfolio** (Project Phoenix: 400+ apps, 35k records) — performance of quality checks & graph (virtualised tables, graph clustering).
- **Daily readiness history** chart (BRD: score updated daily; Go/No-go ≥ 2 weeks before Day-1).
- **Copilot evaluation set** (200 questions, ≥85% correct) and answer feedback analytics.
- **Owner questionnaire links** emailed to seller owners; SLA escalation automation.
- **Real Prowess feed** and lender product catalogue; EMI amortisation schedule export.
- **PPTX/PDF board pack** generation; branded scorecard.
- **Gemini structured output schemas** (`responseSchema`) per task; streaming Copilot.
- **Unit tests** (Vitest) for engine formulas using the golden numbers.
- Retention job that actually purges raw data at policy date.
