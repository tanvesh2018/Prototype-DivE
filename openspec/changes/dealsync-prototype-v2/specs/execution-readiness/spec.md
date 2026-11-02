## MODIFIED Requirements

### Requirement: Suggested milestone date
The system SHALL suggest a Day-1 (or TSA-exit) date = as-of + max(remaining work at current pace, consent floor) + ½ day per readiness point below GO + industry buffer, show the breakdown, and let a user adopt it (logged, undoable).

#### Scenario: Rioja
- **WHEN** the Rioja demo is loaded
- **THEN** the suggested Day-1 is 27 Nov 2025, 12 days after the contractual date

### Requirement: Adjustable readiness weights
The system SHALL let users change component weights and the item formula (tasks / tests / hygiene) with sliders, preview the score before applying, and state the calculation logic step by step.
