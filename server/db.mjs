import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_SQL } from "./schema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = resolve(__dirname, "..");
export const DEFAULT_DB_PATH = resolve(PROJECT_ROOT, "data", "c03.sqlite");

let singleton = null;

// Open (and create if needed) a database at the given path.
// Tests pass their own temporary path so the demo database is never touched.
export function openDatabase(path = process.env.C03_DB_PATH || DEFAULT_DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDatabase() {
  if (!singleton) singleton = openDatabase();
  return singleton;
}

export function closeDatabase() {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}

// Run a callback inside a transaction. Rolls back on any error.
export function inTransaction(db, work) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure, surface the original error
    }
    throw error;
  }
}
