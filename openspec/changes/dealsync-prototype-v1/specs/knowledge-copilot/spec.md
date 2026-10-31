## ADDED Requirements

### Requirement: Grounded Copilot
The system SHALL answer questions only from live dashboard numbers, the framework library and matched past deals, cite sources, reply "I don't know" when the answer is absent, never change data, and log questions, answers and ratings.

#### Scenario: Unknown fact
- **WHEN** asked "What will EDA Corp charge?"
- **THEN** the Copilot replies that it doesn't know because it isn't in the deal data

### Requirement: Close and learn
The system SHALL capture 5 closing answers, anonymise them (names to codes, numbers to ranges), require steward approval with leak detection, and save the Learning Record only with client consent.

### Requirement: Insights
The system SHALL show past-deal matches, benchmarks (e.g. consent in week 1 90% vs 50% on-time), scorecards and a scored prospect list with AI outreach rationale.
