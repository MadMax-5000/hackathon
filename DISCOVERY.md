# Discovery record — C03

Synthetic exercise. This file records what is known from the supplied brief and what has **not** been received as live client input.

## 1. Initial pain

Tyre and service coordinators inspect stored wheels, but the useful observation does not reliably become the correct customer conversation before the next appointment.

Two recurring failures from the supplied brief:

1. Inspection records can be incomplete.
2. Proposed offers can contain the wrong quantity.

Core question from the brief: how can an observation become the right proposed offer, with a clear path for incomplete records?

## 2. Workflow questions

Questions that would be asked in a live coordinator interview (not yet answered by a named client in this session):

- Who is allowed to decide fitment and quantity?
- What must be present before a customer message is allowed?
- What should happen when measurement or size is missing?
- Which information change (stock, contact, measurement) should move the queue?

The supplied `initial.json` already encodes three hard rules used in the prototype:

1. A technician approves fitment and required quantity.
2. Unknown measurements create a review task.
3. Only approved offers may become customer messages.

## 3. What the client said

**Placeholder — not received in this session.**

No live interview transcript is on file. The brief includes fictional role-play dialogue for the coordinator role. That dialogue is synthetic exercise text, not a quote from a real person, and is not repeated here as if it were field research.

When a coordinator interview happens, record the exact words in this section.

## 4. Feedback received

**Placeholder — no additional client feedback recorded.**

Changes in this prototype follow the supplied challenge brief, working agreement, and judge-facing demo script. They are not based on unrecorded verbal feedback.

If feedback is later captured, add dated notes here (who, what they asked to change, what remained a hypothesis).

## 5. What we changed because of that feedback

Not applicable until section 4 contains real notes.

Changes made against the written brief (not invented interview notes):

- Incomplete records (TY-2) never produce an offer or a customer message.
- Quantity is proposed from inspection flags only, and stays a proposal until technician approval, edit, or reject.
- Unconfirmed stock stays unconfirmed until a labeled simulation.
- State is now kept in a real local SQLite database behind a repository/service layer; approvals, stock confirmation, contact drafts, events and audit persist, and **Reset demo** restores the exact seed. External supplier/inventory/CRM/messaging systems remain unconnected and labeled simulated.
- Discovery and Wolf handoff documents state placeholders instead of fabricated client quotes.

## 6. Why the change matters

If uncertain inspection data is treated as a finished offer, the wrong quantity or an incomplete record still becomes a customer conversation. Keeping source evidence, AI proposal, human decision, and simulated events visually separate makes that failure mode inspectable in a 2–4 minute demo.

## 7. Remaining hypothesis

Hypothesis, not validated with a live coordinator:

Coordinators will accept “count of axles marked review replacement” as a **proposal**, and will refuse to send a message when measurement, size, or contact is missing.

Next validation test: sit with a coordinator and replay a TY-3 analogue and a TY-2 analogue on real-like records (see [HANDOFF.md](HANDOFF.md)).
