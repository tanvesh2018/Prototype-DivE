## ADDED Requirements

### Requirement: Dependency map and entanglement
The system SHALL draw app→server, app→network, app→licence, data-flow and seller-service links tagged buyer/shared/seller and compute each app's Entanglement Score (1/2/3 per link).

#### Scenario: Seller-heavy app
- **WHEN** an app's links sum to 9 or more
- **THEN** it is shown as High entanglement

### Requirement: Hidden links and questionnaire
The system SHALL suggest unrecorded links with reasons (AI or rules) for confirm/reject, and capture the 3-question owner questionnaire as links.

#### Scenario: Unclear answer
- **WHEN** an owner answers "Not sure" to seller dependency
- **THEN** the link is treated as seller-owned, the app goes to TSA, and a trial-run checklist can be generated and its result recorded

### Requirement: Move groups
The system SHALL group apps sharing a server or a confirmed data flow into move groups.
