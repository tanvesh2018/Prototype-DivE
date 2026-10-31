## Context

Greenfield project — no existing services, data model, or tech stack constraints. Three new capabilities (`dining-group-formation`, `bill-settlement`, `dining-experience-ratings`) share one underlying entity graph: intents roll up into candidate pools, pools become confirmed groups, groups accumulate shared costs and ratings. See proposal.md - Why for motivation.

## Goals / Non-Goals

**Goals:**
- Define a data model and matching approach that supports both same-restaurant and cuisine-based join flows without duplicating logic.
- Keep matching deterministic and explainable (rule-based on cuisine/budget/timing overlap), not a black-box recommendation system.
- Keep settlement and ratings decoupled from formation so they can evolve (e.g. real payments, reputation scoring) without reworking pooling.

**Non-Goals:**
- Live/real-time geolocation-based pooling (per proposal — deferred).
- Restaurant-side systems: no POS integration, no restaurant-facing deal management in this change.
- Payment processing, escrow, or money movement of any kind.
- Sophisticated reputation/trust scoring beyond the simple "deprioritize repeat poor pairings" signal in `dining-experience-ratings`.

## Decisions

**Single `group` entity for both join flows, differentiated by an optional `restaurant_id`.**
Rather than modeling "restaurant-specific group" and "cuisine-based outing" as separate entities, a group always has a cuisine and optional restaurant reference. Same-restaurant intents must match an existing group's `restaurant_id`; cuisine-based intents match on cuisine with `restaurant_id` unset, and a restaurant can be attached once the group agrees on one (attaching a venue is out of scope for this change — the requirement only says the system must allow the venue to be undecided at formation time). Alternative considered: two separate entities — rejected because formation, thresholding, settlement, and ratings logic would otherwise need to be duplicated for no behavioral difference.

**Matching runs synchronously on intent submission, not as a periodic batch job.**
When a user submits an intent, the system immediately evaluates open pools for overlap (cuisine match, budget range overlap, timing window overlap) and either joins an existing pool or opens a new one. This keeps the MVP simple (no scheduler/queue infra) and gives users immediate feedback ("you're in a pool of 3, need 1 more"). Alternative considered: periodic batch matching (e.g. every 15 minutes) — better for optimizing pool composition at scale, but adds infrastructure and latency the MVP doesn't need; revisit if synchronous matching starts producing poor-quality pools under real load.

**Group size thresholds are configurable per cuisine/venue type, with a system-wide default.**
A tasting menu might need 6+ to unlock pricing; a delivery-minimum split might only need 2. Rather than hardcoding one threshold, thresholds are configuration data attached to a cuisine or restaurant, falling back to a system default (proposal leaves the exact floor/ceiling open — this makes it a config decision, not a code decision).

**Settlement is a flat even split of recorded shared costs, entered manually by any member.**
No itemized per-person line items (who ordered what) in this change — just a single shared-cost total divided evenly, matching the "fixed-cost amortization" value mechanism in the proposal. Itemized splitting is a plausible fast-follow but adds meaningfully more UI/data-model surface than the MVP needs.

**Ratings are captured per member-pair per group, not a single group-level score.**
This is what makes the "deprioritize repeat poor pairings" requirement possible — a group-level average can't tell you which specific pairing didn't work. Alternative considered: single overall group rating — simpler, but insufficient to drive the matching-quality requirement in the spec.

## Risks / Trade-offs

- **Synchronous matching may produce lower-quality pools than batch optimization would.** → Acceptable for MVP scale; instrument pool formation time and final group cohesion (budget/timing spread) to detect if this becomes a real problem.
- **Manual, unitemized shared-cost entry is open to error or dispute (one member mis-enters the total).** → Explicitly a v1 limitation; each entry is attributed to the member who recorded it so disputes are at least traceable, without building itemization.
- **Configurable per-cuisine/venue thresholds add operational surface (someone has to set sensible values).** → Ship with one conservative system-wide default (e.g. min 4 / max 8) and treat per-cuisine overrides as optional tuning, not a required setup step.
- **No venue-attachment workflow for cuisine-based outings means a confirmed cuisine-based group could stall on "which restaurant."** → Out of scope for this change per the spec (system only needs to allow the venue to be undecided at formation); flag as the first candidate for a fast-follow change.

## Open Questions

- Exact default min/max group size values — can be tuned post-launch via configuration without changing specs or task breakdown.
- Whether budget ceiling should be a hard per-person cap or allow a tolerance band (e.g. ±20%) when computing "overlapping budget range" for pooling — affects matching tuning, not the shape of the data model or requirements, so safe to defer to implementation.
