## Purpose

Shows each member of a confirmed dining group what they owe toward shared and fixed costs so the group captures the benefit of splitting those costs, without the system handling any money itself.

## ADDED Requirements

### Requirement: Record shared cost total
The system SHALL let a member of a confirmed group record the group's shared or fixed costs (e.g. delivery fee, service charge, deposit) as a total amount.

#### Scenario: Member records a shared cost
- **WHEN** a member of a confirmed group enters a shared cost amount and a label
- **THEN** the system adds it to that group's shared cost total

### Requirement: Compute per-person share
The system SHALL divide a confirmed group's recorded shared cost total evenly across all confirmed members and display each member's share.

#### Scenario: Shared costs are split evenly
- **WHEN** a confirmed group has recorded shared costs and a fixed member count
- **THEN** the system computes and displays each member's share as the total divided by the member count

#### Scenario: Shared cost total changes after members are added
- **WHEN** a shared cost is recorded or updated for a group that is already confirmed
- **THEN** the system recomputes and redisplays each member's per-person share

### Requirement: No in-app payment processing
The system SHALL display each member's computed share for external settlement and SHALL NOT process, hold, or transfer funds between users.

#### Scenario: Member views their share
- **WHEN** a member views their group's settlement breakdown
- **THEN** the system shows the amount owed and does not offer any in-app payment or transfer action
