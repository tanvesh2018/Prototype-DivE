## ADDED Requirements

### Requirement: Upload and match columns
The system SHALL accept CSV, JSON and TXT uploads, detect the dataset type, and map every source column to the DealSync glossary using rules and (when configured) AI, showing confidence and reason per column.

#### Scenario: Low-confidence column
- **WHEN** a column maps with confidence below 0.8
- **THEN** the user must confirm or change it before import

### Requirement: Hide personal data at upload
The system SHALL drop names, emails and employee numbers from identity and HR files and store counts by role and site when masking is enabled.

#### Scenario: HR file uploaded
- **WHEN** `06_Moving_Employees_HR.csv` is imported with masking on
- **THEN** no personal fields are stored and rows read like "Design engineer, Pune: 2"

### Requirement: Quality issues and hygiene gate
The system SHALL flag missing required values, duplicates, look-alikes, broken links, stale and unused records, score each file 0-100 as the share of clean records, and treat files below 90 as blocked.

#### Scenario: Raw applications file
- **WHEN** the raw applications sample is uploaded
- **THEN** its hygiene is 71 and status Blocked, with SRV-99 flagged as a broken link

### Requirement: Fix with rules, AI, then owners
The system SHALL apply rule fills from linked records, offer AI suggestions with reasons for approval, and route unresolved items to an owner queue with due dates and escalation.

#### Scenario: Owner answers licence consent
- **WHEN** the owner answers "Yes" to the L-07 consent question
- **THEN** the blocked consent task is completed and readiness is recalculated
