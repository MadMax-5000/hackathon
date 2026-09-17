// Repository layer: prepared SQL statements only. No business logic lives here.

export function getMeta(db) {
  return db.prepare("SELECT * FROM case_meta WHERE id = 1").get();
}

export function listCustomers(db) {
  return db.prepare("SELECT * FROM customers ORDER BY id").all();
}

export function getCustomer(db, id) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
}

export function listWheelSets(db) {
  return db.prepare("SELECT * FROM wheel_sets ORDER BY wheel_set_id").all();
}

export function getWheelSet(db, id) {
  return db.prepare("SELECT * FROM wheel_sets WHERE wheel_set_id = ?").get(id);
}

export function listStock(db) {
  return db.prepare("SELECT * FROM stock ORDER BY stock_id").all();
}

export function getStock(db, id) {
  return db.prepare("SELECT * FROM stock WHERE stock_id = ?").get(id);
}

export function findStockBySize(db, size) {
  return db.prepare("SELECT * FROM stock WHERE tyre_size = ?").get(size);
}

export function listOffers(db) {
  return db.prepare("SELECT * FROM offers ORDER BY offer_id").all();
}

export function getOfferByWheel(db, wheelSetId) {
  return db.prepare("SELECT * FROM offers WHERE wheel_set_id = ? ORDER BY offer_id LIMIT 1").get(wheelSetId);
}

export function listEvents(db) {
  return db.prepare("SELECT * FROM events ORDER BY id").all();
}

export function listEventsByWheel(db, wheelSetId) {
  return db.prepare("SELECT * FROM events WHERE wheel_set_id = ? ORDER BY id").all(wheelSetId);
}

export function listAudit(db) {
  return db.prepare("SELECT * FROM audit_log ORDER BY id").all();
}

export function listContactMessages(db) {
  return db.prepare("SELECT * FROM contact_messages ORDER BY id").all();
}

export function listContactMessagesByWheel(db, wheelSetId) {
  return db
    .prepare("SELECT * FROM contact_messages WHERE wheel_set_id = ? ORDER BY id")
    .all(wheelSetId);
}

export function insertEvent(db, event) {
  db.prepare(
    "INSERT INTO events (wheel_set_id, event_type, source, payload, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(event.wheelSetId, event.eventType, event.source, JSON.stringify(event.payload ?? {}), event.createdAt);
}

export function insertAudit(db, entry) {
  db.prepare(
    "INSERT INTO audit_log (wheel_set_id, actor, action, detail, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(entry.wheelSetId, entry.actor, entry.action, entry.detail, entry.createdAt);
}

export function updateStockConfirmed(db, stockId, confirmed, updatedAt) {
  db.prepare("UPDATE stock SET confirmed = ?, updated_at = ? WHERE stock_id = ?").run(
    confirmed ? 1 : 0,
    updatedAt,
    stockId,
  );
}

export function updateOffer(db, wheelSetId, patch) {
  const columns = [];
  const values = [];
  for (const [key, value] of Object.entries(patch)) {
    columns.push(`${key} = ?`);
    values.push(value);
  }
  values.push(wheelSetId);
  db.prepare(`UPDATE offers SET ${columns.join(", ")} WHERE wheel_set_id = ?`).run(...values);
}

export function insertOffer(db, offer) {
  db.prepare(
    `INSERT INTO offers
      (offer_id, wheel_set_id, quantity, tyre_size, status, created_at, approved_at, approved_by,
       human_corrected, ai_quantity, ai_size, note, reject_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    offer.offerId,
    offer.wheelSetId,
    offer.quantity,
    offer.tyreSize,
    offer.status,
    offer.createdAt,
    offer.approvedAt ?? null,
    offer.approvedBy ?? null,
    offer.humanCorrected ? 1 : 0,
    offer.aiQuantity,
    offer.aiSize,
    offer.note ?? "",
    offer.rejectReason ?? "",
  );
}

export function insertContactMessage(db, message) {
  const result = db
    .prepare(
      "INSERT INTO contact_messages (wheel_set_id, channel, body, status, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(message.wheelSetId, message.channel, message.body, message.status, message.createdAt);
  return Number(result.lastInsertRowid);
}

export function updateContactMessageStatus(db, id, status) {
  db.prepare("UPDATE contact_messages SET status = ? WHERE id = ?").run(status, id);
}
