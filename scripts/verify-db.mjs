import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeReporter } from "./harness.mjs";
import { createDbStore, reopen } from "./db-harness.mjs";

const { check, finish } = makeReporter("DATABASE");
const __dirname = dirname(fileURLToPath(import.meta.url));
const initial = JSON.parse(readFileSync(resolve(__dirname, "../initial.json"), "utf8"));
const customersSeed = JSON.parse(
  readFileSync(resolve(__dirname, "../server/seed/customers.json"), "utf8"),
).customers;

console.log("\n[1] Seed matches the supplied initial.json exactly");
{
  const { store, cleanup } = createDbStore();
  const ws = store.getWorkspace();
  check("1a  case_id matches", ws.source.case_id === initial.case_id, ws.source.case_id);
  check("1b  wheel_sets match exactly", JSON.stringify(ws.source.wheel_sets) === JSON.stringify(initial.wheel_sets));
  check("1c  availability matches exactly", JSON.stringify(ws.source.availability) === JSON.stringify(initial.availability));
  check("1d  rules match exactly", JSON.stringify(ws.source.rules) === JSON.stringify(initial.rules));
  check("1e  data_status preserved", ws.source.data_status === initial.data_status);
  check("1f  clock preserved", ws.source.clock === initial.clock);
  cleanup();
}

console.log("\n[2] Stock is read from the database");
{
  const { store, cleanup } = createDbStore();
  const ws = store.getWorkspace();
  const st1 = ws.source.availability.find((row) => row.id === "ST-1");
  const st2 = ws.source.availability.find((row) => row.id === "ST-2");
  check("2a  ST-1 = 2 units confirmed", st1.units === 2 && st1.confirmed === true, JSON.stringify(st1));
  check("2b  ST-2 = 4 units unconfirmed", st2.units === 4 && st2.confirmed === false, JSON.stringify(st2));
  check("2c  TY-3 reads ST-2", ws.offers.find((o) => o.wheelSetId === "TY-3").tyreSize === "225/45 R17");
  cleanup();
}

console.log("\n[3] A simulated stock confirmation is a real, persistent database write");
{
  const { store, path, cleanup: _cleanup } = createDbStore();
  store.approve("TY-3");
  const after = store.simulateStock("TY-3");
  const st2 = after.source.availability.find((row) => row.id === "ST-2");
  check("3a  response reflects confirmed ST-2", st2.confirmed === true);
  check("3b  stock event recorded", after.events.some((e) => e.wheelSetId === "TY-3" && e.eventType === "stock_confirmed"));
  check("3c  audit recorded", after.audit.some((a) => a.wheelSetId === "TY-3" && a.action === "stock_confirmation"));

  // Reopen the same file to prove the write persisted beyond the process state.
  const { store: reopened, db } = reopen(path);
  const ws2 = reopened.getWorkspace();
  check("3d  persisted after reopen: ST-2 confirmed", ws2.source.availability.find((r) => r.id === "ST-2").confirmed === true);
  check("3e  persisted after reopen: TY-3 approved", ws2.overlay.runtimes["TY-3"].approved === true);
  check("3f  persisted after reopen: stock event present", ws2.overlay.runtimes["TY-3"].history.some((h) => h.eventType === "stock_confirmed"));
  db.close();
  try {
    _cleanup();
  } catch {
    // ignore
  }
}

console.log("\n[4] Reset restores the exact initial database state");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  store.simulateStock("TY-3");
  store.draftContact("TY-3", "whatsapp", "hello");
  store.markContactSimulated("TY-3", "whatsapp");
  store.approve("TY-1");

  const reset = store.reset();
  const st1 = reset.source.availability.find((r) => r.id === "ST-1");
  const st2 = reset.source.availability.find((r) => r.id === "ST-2");
  check("4a  ST-1 restored confirmed", st1.confirmed === true && st1.units === 2);
  check("4b  ST-2 restored unconfirmed", st2.confirmed === false && st2.units === 4);
  check("4c  TY-3 back to pending approval", reset.overlay.runtimes["TY-3"].approved === false);
  check("4d  TY-1 back to pending approval", reset.overlay.runtimes["TY-1"].approved === false);
  check("4e  contact messages cleared", reset.contactMessages.length === 0);
  check("4f  audit cleared", reset.audit.length === 0);
  check("4g  timeline restored to seed events", reset.overlay.runtimes["TY-3"].history.length === 2);
  check("4h  seed event count restored", reset.events.length === 8, String(reset.events.length));
  check("4i  customers seeded", reset.customers.length === customersSeed.length);
  cleanup();
}

process.exit(finish());
