## Why

Budget-conscious diners are priced out of experiences that only make sense in a group — tasting menus, family-style large-format dishes, group-menu pricing, or simply a delivery order that clears the minimum. Today, forming that group requires already knowing enough people who want the same thing at the same time. This change lets strangers with compatible intent (same or similar cuisine, similar budget, same rough time/location) pool together so the group forms itself, unlocking pricing and experiences none of them could reach alone.

## What Changes

- New: users submit **dining intent** — cuisine, per-person budget ceiling, target restaurant or cuisine/location, rough timing.
- New: the app **pools compatible intents** and forms a candidate group once it reaches a minimum size threshold.
- New: a formed group is **confirmed and locked in** (the meetup/reservation is set); further joins after confirmation are closed.
- New: support two related join flows — joining a **specific restaurant/table** and joining a **cuisine-based outing** that isn't tied to one venue yet.
- New: after a group is confirmed, the app computes and displays each member's **per-person share** of shared/fixed costs (delivery fee, service charge, deposit) for members to settle outside the app — no in-app payment processing.
- New: after the experience, members can **rate the outing**, and ratings feed future matching quality.
- Explicit non-goals for this change: live/real-time geolocation pooling, restaurant partnership deals or negotiated pricing, in-app payments/wallet, and no-show/trust-reputation scoring. These are deferred to later changes.

## Capabilities

### New Capabilities
- `dining-group-formation`: capturing dining intent, pooling compatible users, applying the group-size threshold, and confirming/locking in a group (covers both same-restaurant and same-cuisine join flows).
- `bill-settlement`: computing each confirmed group member's per-person share of shared costs and displaying it for external settlement (no payment processing).
- `dining-experience-ratings`: post-experience rating capture that feeds into future group-formation matching quality.

### Modified Capabilities
(none — this is a new project with no existing specs)

## Impact

- Greenfield build: no existing codebase, APIs, or systems affected.
- Establishes the foundational data model for intents, groups, and group membership that all three new capabilities and future changes (restaurant partnerships, payments, reputation) will build on.
