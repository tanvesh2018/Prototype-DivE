## ADDED Requirements

### Requirement: Shared tracker with early warning
The system SHALL hold all tasks in one tracker with filters, inline status edits, add/edit/delete and export, and flag tasks that are blocked, at risk, overdue or not started within 5 days of due, with AI-written next steps and escalation.

### Requirement: Day-1 Readiness Score
The system SHALL compute item readiness as 50% tasks + 30% tests + 20% data hygiene, roll up by weighted component, signal GO (90+), conditions (80-89) or NO-GO, and cap at 79 when a critical-tool or revenue-linked item is blocked.

#### Scenario: Blocked critical tool
- **WHEN** CircuitDesign Pro has a Blocked task
- **THEN** the score shows 79 NO-GO with the underlying score and the blocker owner and due date

### Requirement: Drill-down and what-if
The system SHALL show per-item formula evidence, allow recording test results, and simulate projected scores without changing data.
