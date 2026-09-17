// SQLite schema for the C03 prototype.
// Real local persistent storage for a synthetic hackathon exercise.
// Not connected to any supplier, inventory, CRM or messaging system.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS case_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  case_id TEXT NOT NULL,
  data_status TEXT NOT NULL,
  clock TEXT NOT NULL,
  rules_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  sms_available INTEGER NOT NULL DEFAULT 0,
  phone_available INTEGER NOT NULL DEFAULT 0,
  whatsapp_available INTEGER NOT NULL DEFAULT 0,
  email_available INTEGER NOT NULL DEFAULT 0,
  preferred_channel TEXT
);

CREATE TABLE IF NOT EXISTS wheel_sets (
  wheel_set_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  front_finding TEXT NOT NULL,
  rear_finding TEXT NOT NULL,
  tyre_size TEXT NOT NULL,
  appointment TEXT NOT NULL,
  contact_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
  stock_id TEXT PRIMARY KEY,
  tyre_size TEXT NOT NULL,
  units INTEGER NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  offer_id TEXT PRIMARY KEY,
  wheel_set_id TEXT NOT NULL REFERENCES wheel_sets(wheel_set_id),
  quantity INTEGER,
  tyre_size TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  human_corrected INTEGER NOT NULL DEFAULT 0,
  ai_quantity INTEGER,
  ai_size TEXT,
  note TEXT NOT NULL DEFAULT '',
  reject_reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wheel_set_id TEXT NOT NULL REFERENCES wheel_sets(wheel_set_id),
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wheel_set_id TEXT NOT NULL REFERENCES wheel_sets(wheel_set_id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wheel_set_id TEXT NOT NULL REFERENCES wheel_sets(wheel_set_id),
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_wheel ON events(wheel_set_id, id);
CREATE INDEX IF NOT EXISTS idx_audit_wheel ON audit_log(wheel_set_id, id);
CREATE INDEX IF NOT EXISTS idx_offers_wheel ON offers(wheel_set_id);
CREATE INDEX IF NOT EXISTS idx_contact_wheel ON contact_messages(wheel_set_id, id);
`;
