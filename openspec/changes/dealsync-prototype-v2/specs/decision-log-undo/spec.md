## ADDED Requirements

### Requirement: Decision log with undo
Every data-changing action SHALL be logged with the user, screen, time and a reversible change set. Decision logs SHALL be available on Data & Inventory, Dependency Explorer, Separation Decisions, Execution Tracker, Day-1 Readiness, Funding and Governance. Users with edit rights SHALL be able to undo an action after confirming.

#### Scenario: Undo rule fixes
- **WHEN** a user applies rule fixes and then undoes that entry from the Decisions tab
- **THEN** the affected records and hygiene score return to their previous values and the undo is logged

#### Scenario: Conflict
- **WHEN** a later action changed the same values
- **THEN** those values are left alone and the user is told how many conflicts were skipped
