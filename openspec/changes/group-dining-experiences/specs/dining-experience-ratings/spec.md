## Purpose

Captures how a confirmed group's dining experience actually went so future group-formation matching can favor combinations that tend to work well.

## ADDED Requirements

### Requirement: Submit a post-experience rating
The system SHALL let a member of a confirmed group submit a rating for that group's experience after the scheduled dining time has passed.

#### Scenario: Member submits a rating after the meetup
- **WHEN** a member of a confirmed group submits a rating once the group's scheduled dining time has passed
- **THEN** the system records the rating against that group and that member

#### Scenario: Member attempts to rate before the meetup occurs
- **WHEN** a member attempts to submit a rating before the group's scheduled dining time has passed
- **THEN** the system rejects the submission

### Requirement: Ratings inform future matching
The system SHALL factor a user's rating history into future candidate pool placement so that users are not repeatedly pooled with combinations that have received poor ratings.

#### Scenario: Poorly rated combination is deprioritized
- **WHEN** two users have a history of mutually low ratings from a prior shared group
- **THEN** the system deprioritizes placing them into the same candidate pool again
