## ADDED Requirements

### Requirement: Cost split
The system SHALL compute seller share = 0.4 cause + 0.4 like-for-like + 0.2 contract per separation line, read SPA clauses with AI quoting the sentence used, and apply contract answers only after confirmation.

#### Scenario: SPA confirmed
- **WHEN** the SPA reading is confirmed on the sample data
- **THEN** the $1.74M splits into $1.03M seller and $0.71M buyer

### Requirement: Funding layer
The system SHALL present escrow, bridge loan (EMI calculator) and lease options using Prowess affordability, save funding packages, and share them with a bank only when consent is granted.

### Requirement: TSA exit and waves
The system SHALL track TSA services against exit dates and fees, flag extension risk from milestone progress, show a burn-down, rank blocked products by revenue, and release migration waves only when their data hygiene is 90+.
