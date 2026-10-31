## Purpose

Lets budget-conscious diners pool with others who want similar cuisine, budget, and timing so a group large enough to unlock better pricing or experiences forms without everyone already knowing each other.

## ADDED Requirements

### Requirement: Submit dining intent
The system SHALL let a user submit a dining intent consisting of a cuisine or restaurant, a per-person budget ceiling, a rough timing window, and a join-flow type (specific restaurant or cuisine-based outing).

#### Scenario: User submits a valid intent
- **WHEN** a user submits an intent with cuisine, budget ceiling, timing, and join-flow type
- **THEN** the system records the intent as open and eligible for pooling

#### Scenario: User submits an intent missing required fields
- **WHEN** a user submits an intent without a budget ceiling or without a timing window
- **THEN** the system rejects the submission and indicates which fields are missing

### Requirement: Join a specific restaurant
The system SHALL let a user submit intent to join an open group tied to a specific restaurant and table.

#### Scenario: User joins an open restaurant-specific group
- **WHEN** a user submits intent for a specific restaurant that has an open, unconfirmed group with available capacity
- **THEN** the system adds the user to that group's candidate pool

### Requirement: Join a cuisine-based outing
The system SHALL let a user submit intent to join an outing scoped to a cuisine or location rather than one specific restaurant, and SHALL allow the venue to be decided once the group forms.

#### Scenario: User joins a cuisine-based outing without a fixed venue
- **WHEN** a user submits intent for a cuisine-based outing with no restaurant specified
- **THEN** the system pools the user with other compatible cuisine-based intents rather than a restaurant-specific pool

### Requirement: Pool compatible intents
The system SHALL group open intents that share the same or similar cuisine, overlapping budget ceiling range, and overlapping timing window into a candidate pool.

#### Scenario: Compatible intents are pooled together
- **WHEN** two or more open intents share cuisine, an overlapping budget range, and an overlapping timing window
- **THEN** the system places them in the same candidate pool

#### Scenario: Incompatible intents are not pooled together
- **WHEN** an open intent's budget ceiling or timing window does not overlap with an existing candidate pool
- **THEN** the system does not add the intent to that pool

### Requirement: Confirm group at size threshold
The system SHALL define a minimum group size for each candidate pool and SHALL confirm the group once that minimum is reached, and SHALL enforce a maximum group size beyond which no further members may join.

#### Scenario: Pool reaches minimum size
- **WHEN** a candidate pool's member count reaches the configured minimum group size
- **THEN** the system confirms the group and locks in the meetup

#### Scenario: Pool is below minimum size
- **WHEN** a candidate pool's member count is below the configured minimum group size
- **THEN** the group remains unconfirmed and open to new compatible intents

#### Scenario: Pool reaches maximum size
- **WHEN** a candidate pool's member count reaches the configured maximum group size
- **THEN** the system closes the pool to further joins even if not yet confirmed

### Requirement: Close joins after confirmation
The system SHALL prevent new members from joining a group once it has been confirmed.

#### Scenario: User attempts to join a confirmed group
- **WHEN** a user submits intent matching a group that has already been confirmed
- **THEN** the system does not add the user to that group and instead offers to pool them into a new or different open group
