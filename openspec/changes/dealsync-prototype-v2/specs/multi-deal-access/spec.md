## ADDED Requirements

### Requirement: Deal portfolio with role-based access
The system SHALL host multiple deals (Project Rioja, Project Phoenix), each with its own users, roles, owners, consents and workspace. A user SHALL see only the deals they are assigned to.

#### Scenario: Client sees only their deal
- **WHEN** the profile is switched to Laura Bennett (Meridian CIO)
- **THEN** the deal switcher lists only Project Phoenix and the workspace is read-only

#### Scenario: Engagement manager portfolio
- **WHEN** Alex Chen opens the Deal Overview
- **THEN** a portfolio strip shows both deals with their readiness score and signal
