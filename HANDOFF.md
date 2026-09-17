# Wolf handoff — C03 Inspection → Offer

Synthetic exercise. No production system is connected.

## Problem

Inspection findings do not reliably become the correct customer offer before the next appointment. Records can be incomplete. Proposed quantity can be wrong. Uncertain facts must not become silent conclusions.

## Current prototype

Working local workflow (synthetic data only):

Inspection → evidence → AI proposal → technician approval / edit / reject → simulated stock update → simulated customer contact (channel draft in a simulated outbox).

The prototype now uses a real local SQLite database (`data/c03.sqlite`) behind a repository/service layer: seed, approvals, stock confirmation, contact drafts, events and audit are persisted, and refresh/reset behave against the database. Storage and simulated event processing are real *within the local prototype*; the external systems below remain unconnected.

Primary demo: **TY-3** (proposal 2 × 225/45 R17, stock unconfirmed until simulation).
Failure demo: **TY-2** (blocked — measurement missing, size unknown, contact unavailable).

Nothing in this prototype is a live workshop, inventory, CRM, or messaging integration.

## Next real integration

**Workshop / inspection system** — first.

The workflow starts from an observation. Until inspection flags, size, and appointment arrive from the system of record, the queue is still a labeled simulation of `initial.json`.

Later (not now):

- Stock / inventory (confirmation state)
- CRM / customer contact availability
- Messaging (outbound send after approval)

## Integration required

Read access to wheel-set inspection records:

- axle observations (front / rear)
- recorded size or explicit unknown
- appointment day/window as recorded, not assumed confirmed
- customer/job identifier as used internally

No write-back in the first integration. Suitability remains a named human decision.

## Access required

- Read: inspection / workshop records
- Later read: inventory confirmation state, contact availability
- Named technician / coordinator role for approve, edit, reject
- Messaging send permission only after approval (not granted here)

## Proposed owner

Tyre and service coordinator for the queue and approval. Workshop systems owner for the inspection feed. Product/ops owner for the handoff of this prototype.

## Unresolved risk

If inspection flags are treated as a diagnosis or a confirmed quantity, the wrong offer still goes to the customer. Human approval only works if it is a real decision, not a click-through.

Second risk: stock and inspection live in different systems. Acting on “reported” units before confirmation recreates today’s failure.

## Next validation test

Replay two coordinator-owned records:

1. Happy-path analogue of TY-3: both axles flagged, size known, contact present, stock unconfirmed.
2. Incomplete analogue of TY-2: measurement missing.

Check: they still refuse a customer message without approval, and they treat flagged-axle quantity as a proposal rather than a fact.

## Required access summary

| Need | Status |
| --- | --- |
| Inspection feed | Future — not connected |
| Inventory confirmation | Future — not connected |
| CRM contact | Future — not connected |
| Messaging send | Future — not connected |
| This prototype | Local, synthetic, simulated events only |
