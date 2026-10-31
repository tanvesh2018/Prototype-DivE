## ADDED Requirements

### Requirement: Role-based views
The system SHALL support PwC (full), client leadership (read-only), seller IT (assigned screens) and bank (consented funding summary) roles, blocking data changes for read-only roles.

### Requirement: Controls, consent, retention, audit
The system SHALL maintain a consent registry, PII/AI controls, retention policy, configurable weights and thresholds, and an exportable audit log of every change, approval, override and AI call.

### Requirement: Central AI gateway
The system SHALL route all AI calls through one server-side gateway reading `GEMINI_API_KEY` from `.env.local`, and fall back to deterministic rules on missing key, error or timeout, labelling the source of every AI result.

#### Scenario: No key
- **WHEN** no key is configured
- **THEN** every AI feature still returns a result labelled "Rule-based fallback"
