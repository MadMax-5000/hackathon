# C03: Inspection → Offer

Coordinator workspace prototype for “We found the tyre issue and still never made the offer.”

Synthetic exercise data only. This is not tyre safety advice. Suitability and required quantity are human decisions.

Related: [DISCOVERY.md](DISCOVERY.md) · [HANDOFF.md](HANDOFF.md) · [design.md](design.md)

## Problem

Inspection information stays fragmented and does not reliably become the right customer conversation before the next appointment. Records can be incomplete. Quantity can be wrong.

## Workflow

Core workflow (unchanged): **Inspection → Evidence → AI proposal → Human decision → Stock state → Customer communication.**

1. Source evidence (inspection, size, appointment, reported stock)
2. AI proposal (quantity = axles marked `review replacement`)
3. Technician **Approve / Correct / Reject**; every decision is undoable via **Back to review**
4. Labeled stock confirmation simulation (TY-3)
5. Contact hub — SIMULATED customer channel drafts only after approval, and after stock is confirmed when stock is unconfirmed

- **TY-3:** happy path — proposed 2 × 225/45 R17
- **TY-2:** blocked — measurement missing, size unknown, contact unavailable
- **TY-1:** proposed 1 unit; still needs approval
- **TY-4:** no action required

## Coordinator workspace

- **Smart work queue** — cases grouped by state: Urgent · Missing evidence · Awaiting technician · Awaiting stock · Ready for customer · Complete · No action required. Each row shows only the tyre id and size; groups move as work is completed.
- **Case actions** — one obvious primary action per state (approve / correct / reject, create review task, simulate stock, simulate message, back to review).
- **Evidence explorer** — every recommendation is inspectable: WHAT WE KNOW · WHAT THE AI PROPOSED · WHY · WHAT IS UNCERTAIN · WHAT RULE APPLIES · WHO MUST DECIDE.
- **Case timeline** — chronological events tagged **Source**, **AI proposal**, **Human decision**, or **Simulated event**. Only real runtime events appear.
- **Customer communication** — a **Contact hub** shows customer identity, recorded channel availability, the preferred channel, and the approved offer. Locked until approval and, where relevant, stock confirmation. When unlocked it offers WhatsApp · Email · Call · SMS and a clean simulated composer. Every action is labeled `SIMULATED` / `NOT SENT`; nothing is ever sent.
- **AI assistant** — a chat bubble in the bottom-right corner, opened on click. Ask about the selected case, including contact channels; it offers suggested questions and keeps answers short and plain. Answers distinguish database facts, AI reasoning, human decisions, and simulated actions.

## Local persistent database (SQLite)

The prototype keeps its working state in a real local SQLite database, written through a small repository/service layer behind the Vite server. The browser never touches the database file.

- **Engine:** Node's built-in `node:sqlite` (no external dependency; prints an experimental warning).
- **File:** `data/c03.sqlite` (gitignored), overridable with `C03_DB_PATH`.
- **Seed:** on first run the database is seeded from `initial.json` — wheel sets, stock, rules, and the starting timeline all match the supplied file exactly. Synthetic customer contact records live in `server/seed/customers.json` (reserved `example.invalid` addresses and `555` numbers only).
- **Tables:** `customers`, `wheel_sets`, `stock`, `offers`, `events`, `audit_log`, plus `case_meta` and a simulated `contact_messages` outbox.
- **API:** `GET /api/state`; `POST /api/cases/:id/{approve,reject,edit,back-to-review,review-task,evidence-reviewed}`; `POST /api/cases/:id/stock/simulate`; `POST /api/cases/:id/contact/{draft,mark-simulated}`; `POST /api/reset`.
- **Operations are transactional.** Approval, rejection, correction, stock confirmation, and contact actions each write the row change plus an `events` record and an `audit_log` entry together.
- **Persistence:** refreshing the page reloads from the database, so simulated stock confirmations, approvals, and generated drafts survive a refresh. **Reset demo** restores the database to the exact supplied start state (TY-3 back to `4 units — confirmation pending`; TY-1 back to `2 units — confirmed`).
- **Case isolation:** every record is keyed by `wheel_set_id`; a TY-3 change cannot affect TY-1, TY-2, or TY-4.

This database is real *within the local prototype*. It is **not** a supplier, inventory, CRM, or messaging integration.

```bash
npm run db:seed    # create the database from initial.json if missing
npm run db:reset   # restore the exact initial state
```

## AI assistant (DeepSeek, grounded)

The assistant returns real responses from DeepSeek through a local Vite proxy. It is prompt-engineered and guarded so it stays grounded:

- The browser posts the question and a compact case snapshot (evidence, proposal, state, decisions, rules, timeline) to `POST /api/copilot`. The API key is read server-side from `.env.local` and is **never sent to the browser**.
- The server calls DeepSeek `POST https://api.deepseek.com/chat/completions` with a strict system prompt: answer only from the supplied case JSON; never invent price, supplier, order, delivery, booking, or a safety diagnosis; never claim an action was performed; never make the final decision; reply in 1–3 short sentences.
- A guardrail validates the model reply. If it contains forbidden commercial/safety content or a tyre size not present in the case, the reply is discarded.
- If there is no key, the network fails, or the guardrail rejects the reply, the assistant falls back to the existing deterministic, grounded local answers and labels the bubble `offline answer`.
- The assistant never performs an action. Approval, stock confirmation, and customer messages still require an explicit human click in the case pane.
- The case snapshot includes the stored customer contact record (channels, availability, preferred channel) and the approved offer. The assistant answers channel questions only from that record, distinguishes `DATABASE FACT` from `AI REASONING`, `HUMAN DECISION`, and `SIMULATED ACTION`, and never claims a message was sent.

### Configuration

Copy `.env.example` to `.env.local` (gitignored) and set:

```
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-v4-flash
```

`DEEPSEEK_MODEL` is optional and defaults to `deepseek-v4-flash` (current default chat model; thinking disabled for fast replies). You can also use `deepseek-v4-pro`. Legacy `deepseek-chat` routes to V4-Flash but retires 2026-07-24.

The proxy runs with `npm run dev` and `npm run preview`.

## How to run

Requires Node.js 22.20 or newer (uses the built-in `node:sqlite` module and TypeScript type stripping).

```bash
npm install
cp .env.example .env.local   # then add your DeepSeek key
npm run dev
```

Open `http://localhost:5173`. The queue opens on **TY-3**. The local SQLite database (`data/c03.sqlite`) is created and seeded automatically on first run. **Reset demo** restores the supplied start state. Without a key the app still works using local answers.

```bash
npm run build
npm run preview
npm run verify
```

## Synthetic data

All inspection and stock records come from `initial.json` / `src/data/initial.json`. Status in that file: synthetic exercise data; not real client, country, programme, or participant data. Identifiers are `TY-*` and `CUS-*` only. Customer contact values are synthetic (`server/seed/customers.json`) using reserved `example.invalid` addresses and `555` numbers.

## Simulated components

| Component | Status |
| --- | --- |
| Challenge data | Synthetic |
| Local database | Real SQLite persistence inside the prototype |
| Proposal derivation | Local rules over supplied records |
| AI assistant | DeepSeek via local proxy, constrained by a strict prompt + guardrail; local fallback |
| Stock / ST-2 confirmation | Real database write, labeled SIMULATED STOCK EVENT (not a supplier system) |
| Customer contact records | Synthetic, stored in the local database |
| Customer message / channel drafts | SIMULATED. Never sent |
| Workshop, inventory, CRM, messaging APIs | Not connected |
| Prices, appointments, safety judgment | Not real. No prices, supplier orders, diagnoses, or confirmed bookings are invented |

UI labels: `SYNTHETIC DATA`, `SIMULATED STOCK EVENT`, `SIMULATED` / `NOT SENT`, `SIMULATED INTEGRATION`, `AI`.

## Business rules

1. A technician approves fitment and required quantity.
2. Unknown measurements create a review task.
3. Only approved offers may become customer messages.
4. Unconfirmed stock stays unconfirmed until the labeled simulation.
5. Unknown size, missing measurement, and missing contact stay unknown. No prices, supplier orders, diagnoses, or confirmed bookings are invented.
6. No customer communication before approval, and none while required stock confirmation is pending.
7. A customer with contact missing (for example CUS-2) has no usable channel; no channel is fabricated and the offer stays blocked.
8. The AI never makes a final decision. It explains and suggests from the case data; a human confirms every consequential step.

## Automated verification

`npm run verify` runs eleven suites. The first seven cover the pure engine and copilot modules; the last four use an isolated temporary SQLite database per suite.

- `verify-isolation.mjs` — per-case state isolation, happy path, reset.
- `verify-copilot.mjs` — deterministic grounding, no cross-case leakage, no fabricated content.
- `verify-deepseek.mjs` — system-prompt constraints, message assembly, guardrail (forbidden content and unknown sizes), proxy request shape, and safe fallback.
- `verify-gating.mjs` — approval gating, message gating, simulated stock updates, reset.
- `verify-queue.mjs` — queue grouping, group transitions, insight derivation.
- `verify-timeline.mjs` — real vs simulated events, coordinator tasks, reset.
- `verify-overview.mjs` — case brief prompt, parsing, caching, fallback.
- `verify-db.mjs` — exact seed match, stock reads, persistent stock update, reset restore.
- `verify-contacts.mjs` — channel reads, missing contact stays missing, no fabricated channels.
- `verify-contact-gating.mjs` — no contact before approval, none while stock pending, none for blocked cases, case isolation.
- `verify-audit.mjs` — stock simulation, message simulation, and approval each create persisted events/audit records.

The tests never call DeepSeek (injected fake `fetch`) and never touch the demo database (temporary file per suite).

## Limitations

- The local database is real, but every external integration (supplier, inventory, CRM, messaging) is not connected and is labeled simulated.
- Quantity proposal is a flag count, not a fitment decision.
- Contact actions generate a draft in a simulated outbox only; no message, call, or email is ever sent.
- The assistant is constrained to the current case snapshot; it is not an open-ended agent.
- The proxy and database API only run under `npm run dev` / `npm run preview`; a static hosting build has no server and no database.
- Desktop-first layout, responsive down to narrow screens.

## Uncertainty / failure case

**TY-2** must not create an offer. The UI shows `BLOCKED: INSUFFICIENT EVIDENCE` because measurement is missing, size is unknown, and customer contact is unavailable. The contact hub reports contact unavailable, no channel is invented, a review task can be recorded, and no customer message path exists on this case.

## Next validation test

Sit with a coordinator and replay a TY-3 analogue and a TY-2 analogue. Check that they still refuse to send without approval, that they treat proposed quantity as a proposal, and that the assistant's answers match the case evidence. Details: [HANDOFF.md](HANDOFF.md).
