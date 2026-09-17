import { closeDatabase, openDatabase } from "../server/db.mjs";
import { seedDatabase, seedIfEmpty } from "../server/seed.mjs";

const mode = process.argv[2] === "reset" ? "reset" : "seed";

const db = openDatabase();
if (mode === "reset") {
  seedDatabase(db);
  console.log("C03 database reset to the supplied initial state.");
} else {
  seedIfEmpty(db);
  console.log("C03 database seeded (skipped if already present).");
}
closeDatabase();
