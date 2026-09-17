import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../server/db.mjs";
import { createStore } from "../server/service.mjs";

let counter = 0;

// Each suite gets a throwaway SQLite file so the demo database is never touched.
export function createDbStore() {
  const path = join(tmpdir(), `c03-test-${process.pid}-${Date.now()}-${counter++}.sqlite`);
  const db = openDatabase(path);
  const store = createStore(db);

  function cleanup() {
    try {
      db.close();
    } catch {
      // already closed
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        rmSync(path + suffix, { force: true });
      } catch {
        // best effort
      }
    }
  }

  return { store, db, path, cleanup };
}

export function reopen(path) {
  const db = openDatabase(path);
  return { db, store: createStore(db) };
}
