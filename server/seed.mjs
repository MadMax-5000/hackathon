import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inTransaction, PROJECT_ROOT } from "./db.mjs";

// resolve() against process.cwd() first so the files are found when the
// function is bundled on Vercel (includeFiles land in the function root).
function firstExisting(candidates) {
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

const INITIAL_PATH = firstExisting([
  resolve(process.cwd(), "initial.json"),
  resolve(PROJECT_ROOT, "initial.json"),
]);
const CUSTOMERS_PATH = firstExisting([
  resolve(process.cwd(), "server", "seed", "customers.json"),
  resolve(PROJECT_ROOT, "server", "seed", "customers.json"),
]);

const REVIEW = "review replacement";
const MEASUREMENT_MISSING = "measurement missing";
const SIZE_UNKNOWN = "unknown";
const CONTACT_MISSING = "missing";

// Deterministic exercise-local timestamps. Kept in the past relative to any
// live mutation so seeded history always sorts before new events.
const SEED_BASE = Date.UTC(2026, 0, 1, 9, 0, 0);
function seedTime(step) {
  return new Date(SEED_BASE + step * 60_000).toISOString();
}

export function readInitial(path = INITIAL_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readCustomers(path = CUSTOMERS_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function isBlocked(wheel) {
  if (wheel.front === MEASUREMENT_MISSING || wheel.rear === MEASUREMENT_MISSING) return true;
  if (!wheel.size || wheel.size.toLowerCase() === SIZE_UNKNOWN) return true;
  if (wheel.contact === CONTACT_MISSING) return true;
  return false;
}

function reviewCount(wheel) {
  return [wheel.front, wheel.rear].filter((value) => value === REVIEW).length;
}

function knownSize(wheel) {
  if (!wheel.size || wheel.size.toLowerCase() === SIZE_UNKNOWN) return null;
  return wheel.size;
}

// Starting history labels are identical to the pure engine's startingHistory()
// so the database-backed timeline matches the existing derivation exactly.
export function startingEvents(wheel) {
  const events = [
    {
      eventType: "inspection_detected",
      source: "source",
      label:
        "Inspection detected — front and rear observations loaded from synthetic exercise data.",
    },
  ];

  if (isBlocked(wheel)) {
    events.push({
      eventType: "offer_blocked",
      source: "ai",
      label:
        "Offer blocked: insufficient evidence. No proposal generated. Review task required.",
    });
    return events;
  }

  const quantity = reviewCount(wheel);
  const size = knownSize(wheel);
  if (quantity === 0 || !size) {
    events.push({
      eventType: "no_offer",
      source: "ai",
      label: "No concern recorded. No offer proposed.",
    });
    return events;
  }

  events.push({
    eventType: "ai_proposal",
    source: "ai",
    label: `AI proposal generated: ${quantity} × ${size} from ${quantity} axle${
      quantity === 1 ? "" : "s"
    } marked review replacement. Pending technician approval.`,
  });
  return events;
}

function isOfferable(wheel) {
  return !isBlocked(wheel) && reviewCount(wheel) > 0 && knownSize(wheel) !== null;
}

export function isEmpty(db) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM case_meta").get();
  return !row || row.count === 0;
}

// Wipe every table and insert the exact supplied starting state.
export function seedDatabase(db) {
  const data = readInitial();
  const customers = readCustomers().customers;

  inTransaction(db, () => {
    for (const table of ["contact_messages", "audit_log", "events", "offers", "stock", "wheel_sets", "customers", "case_meta"]) {
      db.exec(`DELETE FROM ${table};`);
    }

    db.prepare(
      "INSERT INTO case_meta (id, case_id, data_status, clock, rules_json) VALUES (1, ?, ?, ?, ?)",
    ).run(data.case_id, data.data_status, data.clock, JSON.stringify(data.rules));

    const insertCustomer = db.prepare(
      `INSERT INTO customers
        (id, display_name, phone, whatsapp, email,
         sms_available, phone_available, whatsapp_available, email_available, preferred_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const customer of customers) {
      insertCustomer.run(
        customer.id,
        customer.display_name,
        customer.phone,
        customer.whatsapp,
        customer.email,
        customer.sms_available ? 1 : 0,
        customer.phone_available ? 1 : 0,
        customer.whatsapp_available ? 1 : 0,
        customer.email_available ? 1 : 0,
        customer.preferred_channel,
      );
    }

    const insertWheel = db.prepare(
      `INSERT INTO wheel_sets
        (wheel_set_id, customer_id, front_finding, rear_finding, tyre_size, appointment, contact_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const wheel of data.wheel_sets) {
      insertWheel.run(
        wheel.id,
        wheel.customer_id,
        wheel.front,
        wheel.rear,
        wheel.size,
        wheel.appointment,
        wheel.contact,
      );
    }

    const insertStock = db.prepare(
      "INSERT INTO stock (stock_id, tyre_size, units, confirmed, updated_at) VALUES (?, ?, ?, ?, ?)",
    );
    data.availability.forEach((row, index) => {
      insertStock.run(row.id, row.size, row.units, row.confirmed ? 1 : 0, seedTime(index));
    });

    const insertOffer = db.prepare(
      `INSERT INTO offers
        (offer_id, wheel_set_id, quantity, tyre_size, status, created_at, approved_at, approved_by,
         human_corrected, ai_quantity, ai_size, note, reject_reason)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, '', '')`,
    );
    let offerIndex = 0;
    for (const wheel of data.wheel_sets) {
      if (!isOfferable(wheel)) continue;
      offerIndex += 1;
      const quantity = reviewCount(wheel);
      const size = knownSize(wheel);
      insertOffer.run(
        `OFF-${offerIndex}`,
        wheel.id,
        quantity,
        size,
        "proposal_generated",
        seedTime(offerIndex),
        quantity,
        size,
      );
    }

    const insertEvent = db.prepare(
      "INSERT INTO events (wheel_set_id, event_type, source, payload, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    let step = data.wheel_sets.length + data.availability.length;
    for (const wheel of data.wheel_sets) {
      for (const event of startingEvents(wheel)) {
        step += 1;
        insertEvent.run(
          wheel.id,
          event.eventType,
          event.source,
          JSON.stringify({ label: event.label }),
          seedTime(step),
        );
      }
    }

    // Stock availability is a supplied fact, not a per-case mutation.
  });

  return db;
}

export function seedIfEmpty(db) {
  if (isEmpty(db)) seedDatabase(db);
  return db;
}
