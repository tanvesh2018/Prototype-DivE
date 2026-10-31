## 1. Data Model & Setup

- [ ] 1.1 Define `DiningIntent` entity (user, cuisine, restaurant reference optional, budget ceiling, timing window, join-flow type, status)
- [ ] 1.2 Define `Group` entity (cuisine, optional `restaurant_id`, status: open/confirmed/closed, min/max size)
- [ ] 1.3 Define `GroupMembership` entity linking users to groups
- [ ] 1.4 Define threshold configuration (system-wide default min/max, optional per-cuisine/per-restaurant override)
- [ ] 1.5 Define `SharedCost` entity (group reference, amount, label, recorded-by member)
- [ ] 1.6 Define `Rating` entity (group reference, rater, ratee, score, submitted-at)

## 2. Dining Group Formation

- [ ] 2.1 Implement intent submission with field validation (reject missing budget ceiling or timing window)
- [ ] 2.2 Implement restaurant-specific join: match intent to an open group with the same `restaurant_id` and available capacity
- [ ] 2.3 Implement cuisine-based join: match intent to an open group with the same cuisine and no `restaurant_id`
- [ ] 2.4 Implement compatibility matching (cuisine match, budget range overlap, timing window overlap) to place an intent into an existing pool or open a new one
- [ ] 2.5 Implement group confirmation when a pool reaches its configured minimum size
- [ ] 2.6 Implement pool closure to new joins when a group reaches its configured maximum size or is confirmed
- [ ] 2.7 Implement fallback offer (pool into a new/different open group) when a user targets an already-confirmed group

## 3. Bill Settlement

- [ ] 3.1 Implement shared cost recording for members of a confirmed group
- [ ] 3.2 Implement even per-person share computation from a group's shared cost total and member count
- [ ] 3.3 Implement recomputation of per-person shares when shared costs are added or updated
- [ ] 3.4 Implement settlement view showing each member's owed amount with no payment/transfer action

## 4. Dining Experience Ratings

- [ ] 4.1 Implement rating submission restricted to members of a group whose scheduled dining time has passed
- [ ] 4.2 Implement rejection of rating submissions before the scheduled dining time
- [ ] 4.3 Implement per-member-pair rating storage
- [ ] 4.4 Implement matching-time deprioritization of user pairs with a history of mutually low ratings

## 5. Testing

- [ ] 5.1 Unit tests for intent validation and compatibility matching
- [ ] 5.2 Unit tests for group confirmation/closure threshold behavior (min reached, max reached, below min)
- [ ] 5.3 Unit tests for per-person share computation and recomputation
- [ ] 5.4 Unit tests for rating submission timing rules and pairing deprioritization
- [ ] 5.5 End-to-end test covering: submit intents → pool → confirm group → record shared cost → view settlement → submit ratings
