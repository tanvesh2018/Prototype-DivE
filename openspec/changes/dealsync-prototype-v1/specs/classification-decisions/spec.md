## ADDED Requirements

### Requirement: Priority Index and timing
The system SHALL compute PI = 0.35C + 0.25D + 0.20R + 0.20S (D from entanglement), mark PI ≥ 3.5 or critical-tool/revenue-linked items as Day-1 critical, and let users edit C, R, S and component.

### Requirement: Six buckets with override
The system SHALL suggest one of six buckets per app with a fact-based reason, offer an AI recommendation, and require a logged reason to override.

#### Scenario: Override
- **WHEN** a user picks a bucket different from the rule
- **THEN** a reason is required and the override appears in the decision log

### Requirement: Leadership options
The system SHALL remove options with security below 3, score the rest (35/30/20/15), recommend the highest, draft a 4-line board summary with AI, and record approval or change requests.

#### Scenario: Laptop decision
- **WHEN** DEC-01 is shown
- **THEN** "Move in phases" scores 3.65, "Full rebuild first" 3.05 and "Move now, secure later" is removed
