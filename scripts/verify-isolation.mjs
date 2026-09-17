import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendHistory,
  createInitialRuntimes,
  deriveCase,
  draftCustomerMessage,
  findUrgentId,
  simulateMessage,
  simulateStockConfirmation,
  sortCases,
} from "../src/engine/workflow.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(readFileSync(resolve(__dirname, "../src/data/initial.json"), "utf8"));
const urgentId = findUrgentId(source.wheel_sets);

let failures = [];

function check(label, ok, detail) {
  if (ok) {
    console.log("  PASS  " + label);
  } else {
    console.log("  FAIL  " + label + (detail ? " — " + detail : ""));
    failures.push(label);
  }
}

function makeHarness(initialOverlay) {
  let overlay = initialOverlay
    ? { ...initialOverlay }
    : { runtimes: createInitialRuntimes(source), confirmedOverrides: {}, stockEvents: {} };
  let selectedId = urgentId ?? source.wheel_sets[0].id;

  function apply(id, patch, event) {
    const merged = { ...(overlay.runtimes[id] ?? {}), ...patch };
    overlay = {
      ...overlay,
      runtimes: {
        ...overlay.runtimes,
        [id]: event ? appendHistory(merged, event.kind, event.label) : merged,
      },
    };
  }

  function cases() {
    return sortCases(
      source.wheel_sets.map((w) =>
        deriveCase(w, source.availability, overlay.runtimes[w.id], overlay.confirmedOverrides, urgentId),
      ),
    );
  }

  function selected() {
    return cases().find((c) => c.wheel.id === selectedId) ?? cases()[0];
  }

  function select(id) {
    selectedId = id;
  }

  function approve() {
    const s = selected();
    apply(s.wheel.id, { approved: true, rejected: false }, { kind: "human", label: "Technician approved fitment and quantity." });
  }

  function runStockSimulation() {
    overlay = simulateStockConfirmation(overlay, selected().wheel.id, source);
  }

  function runMessageSimulation() {
    overlay = simulateMessage(overlay, selected().wheel.id);
  }

  function reset() {
    overlay = { runtimes: createInitialRuntimes(source), confirmedOverrides: {}, stockEvents: {} };
    selectedId = urgentId ?? source.wheel_sets[0].id;
  }

  function getOverlay() { return overlay; }

  function derive(id) {
    const w = source.wheel_sets.find((e) => e.id === id);
    return deriveCase(w, source.availability, overlay.runtimes[w.id], overlay.confirmedOverrides, urgentId);
  }

  return { select, approve, runStockSimulation, runMessageSimulation, reset, cases, selected, getOverlay, derive };
}

function stockLine(item) {
  if (item.blocked || item.noAction) return null;
  if (!item.stock) return "No matching stock record";
  return item.stock.confirmed ? `${item.stock.units} units confirmed` : `${item.stock.units} units reported`;
}

function heroHeadline(item) {
  if (item.blocked) return "No offer";
  if (item.noAction) return "No offer";
  if (item.runtime.quantity != null && item.runtime.size) return `${item.runtime.quantity} × ${item.runtime.size}`;
  return item.wheel.id;
}

function primaryAction(item) {
  if (item.blocked || item.noAction || item.runtime.rejected) return null;
  if (!item.runtime.approved) return "approve";
  if (item.stock && !item.stock.confirmed) return "stock";
  const lock = null;
  if (!lock && !item.runtime.messageSimulated) return "message";
  return null;
}

function isStockButtonVisible(item) {
  return primaryAction(item) === "stock";
}

// ---------------------------------------------------------------
console.log("\n[1] INITIAL STATE — per-case data isolation");
{
  const h = makeHarness();
  {
    const c = h.derive("TY-1");
    check("1a  TY-1 hero = 1 × 205/55 R16", heroHeadline(c) === "1 × 205/55 R16", heroHeadline(c));
    check("1b  TY-1 stock = 2 units confirmed", stockLine(c) === "2 units confirmed", stockLine(c));
    check("1c  TY-1 stock availability = ST-1", c.stock?.availabilityId === "ST-1", c.stock?.availabilityId);
    check("1d  TY-1 status = Pending technician approval", c.status === "Pending technician approval", c.status);
  }
  {
    const c = h.derive("TY-3");
    check("1e  TY-3 hero = 2 × 225/45 R17", heroHeadline(c) === "2 × 225/45 R17", heroHeadline(c));
    check("1f  TY-3 stock = 4 units reported (unconfirmed)", stockLine(c) === "4 units reported", stockLine(c));
    check("1g  TY-3 availability = ST-2", c.stock?.availabilityId === "ST-2", c.stock?.availabilityId);
  }
  check("1h  TY-2 is blocked", h.derive("TY-2").blocked === true, h.derive("TY-2").status);
  check("1i  TY-4 is no action", h.derive("TY-4").noAction === true, h.derive("TY-4").status);
}

// ---------------------------------------------------------------
console.log("\n[2] TY-1 — no Simulate stock confirmation button (stock already confirmed)");
{
  const h = makeHarness();
  const c = h.derive("TY-1");
  check("2a  Stock confirmed", c.stock?.confirmed === true, stockLine(c));
  check("2b  Simulate stock button NOT shown", isStockButtonVisible(c) === false, "primary=" + primaryAction(c));
}

// ---------------------------------------------------------------
console.log("\n[3] TY-1 — approve → Ready for customer message → draft = 1 × 205/55 R16");
{
  const h = makeHarness();
  h.select("TY-1");
  h.approve();
  const c = h.derive("TY-1");
  check("3a  Status = Ready for customer message", c.status === "Ready for customer message", c.status);
  check("3b  Primary action = message (not stock)", primaryAction(c) === "message", primaryAction(c));
  const draft = draftCustomerMessage(c);
  check("3c  Draft contains 1 × 205/55 R16", draft !== null && draft.includes("1 × 205/55 R16"), draft);
  check("3d  Draft does NOT contain 225/45", draft !== null && !draft.includes("225/45"), draft);
  check("3e  Draft does NOT contain '4'", draft !== null && !draft.includes("4 ×"), draft);
}

// ---------------------------------------------------------------
console.log("\n[4] TY-3 — full happy-path flow unchanged");
{
  const h = makeHarness();
  h.select("TY-3");
  let c = h.derive("TY-3");
  check("4a  Initial: Pending technician approval", c.status === "Pending technician approval", c.status);
  check("4b  Initial: hero = 2 × 225/45 R17", heroHeadline(c) === "2 × 225/45 R17", heroHeadline(c));

  h.approve();
  c = h.derive("TY-3");
  check("4c  After approve: status = Approved (stock unconfirmed)", c.status === "Approved", c.status);
  check("4d  After approve: Simulate stock button shown", isStockButtonVisible(c) === true, "primary=" + primaryAction(c));

  h.runStockSimulation();
  c = h.derive("TY-3");
  check("4e  After simulate stock: stock = 4 units confirmed", stockLine(c) === "4 units confirmed", stockLine(c));
  check("4f  After simulate stock: stockEvents[TY-3] set", h.getOverlay().stockEvents["TY-3"] === true);
  check("4g  After simulate stock: status = Ready for customer message", c.status === "Ready for customer message", c.status);

  h.runMessageSimulation();
  c = h.derive("TY-3");
  check("4h  After simulate message: status = Message simulated", c.status === "Message simulated", c.status);
  check("4i  After simulate message: primary = null (complete)", primaryAction(c) === null, primaryAction(c));
}

// ---------------------------------------------------------------
console.log("\n[5] TY-2 and TY-4 — unaffected by any flow");
{
  const h = makeHarness();

  // Do a full TY-3 flow
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();

  // Do a TY-1 approve flow
  h.select("TY-1");
  h.approve();
  h.runMessageSimulation();

  // Verify TY-2 and TY-4
  const ty2 = h.derive("TY-2");
  const ty4 = h.derive("TY-4");
  check("5a  TY-2 still blocked", ty2.blocked === true, ty2.status);
  check("5b  TY-2 hero = 'No offer'", heroHeadline(ty2) === "No offer", heroHeadline(ty2));
  check("5c  TY-2 has no proposal/runtime qty", ty2.runtime.quantity === null);
  check("5d  TY-4 still no action", ty4.noAction === true, ty4.status);
  check("5e  TY-4 has no proposal/runtime qty", ty4.runtime.quantity === null);
  check("5f  TY-4 hero = 'No offer'", heroHeadline(ty4) === "No offer", heroHeadline(ty4));
}

// ---------------------------------------------------------------
console.log("\n[6] Isolation — TY-3 flow cannot leak into TY-1 or TY-4");
{
  const h = makeHarness();

  // Simulate TY-3 full flow including stock/confirmedOverrides mutation
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();

  const overlay = h.getOverlay();
  check("6a  confirmedOverrides has ST-2 (TY-3's row)", overlay.confirmedOverrides["ST-2"] === true);
  check("6b  confirmedOverrides does NOT have ST-1 (TY-1's row)", overlay.confirmedOverrides["ST-1"] === undefined || overlay.confirmedOverrides["ST-1"] === false);
  check("6c  stockEvents[TY-3] is set", overlay.stockEvents["TY-3"] === true);
  check("6d  stockEvents[TY-1] is NOT set", overlay.stockEvents["TY-1"] !== true);

  const ty1 = h.derive("TY-1");
  const ty4 = h.derive("TY-4");
  check("6e  TY-1 hero unchanged = 1 × 205/55 R16", heroHeadline(ty1) === "1 × 205/55 R16", heroHeadline(ty1));
  check("6f  TY-1 stock unchanged = 2 units confirmed", stockLine(ty1) === "2 units confirmed", stockLine(ty1));
  check("6g  TY-1 availability still ST-1", ty1.stock?.availabilityId === "ST-1", ty1.stock?.availabilityId);
  check("6h  TY-1 status = Pending (still awaiting decision)", ty1.status === "Pending technician approval", ty1.status);
  check("6i  TY-4 hero unchanged = 'No offer'", heroHeadline(ty4) === "No offer", heroHeadline(ty4));
}

// ---------------------------------------------------------------
console.log("\n[7] Isolation — TY-1 approve+simulate cannot leak into TY-3");
{
  const h = makeHarness();

  // Approve + message on TY-1 (TY-1 stock is already confirmed — no stock override mutation)
  h.select("TY-1");
  h.approve();
  h.runMessageSimulation();

  const overlay = h.getOverlay();
  check("7a  TY-1 message simulated (no stock event needed)", h.derive("TY-1").runtime.messageSimulated === true);
  check("7b  stockEvents[TY-1] NOT set (no stock simulation happened)", overlay.stockEvents["TY-1"] !== true);
  check("7c  stockEvents[TY-3] NOT set", overlay.stockEvents["TY-3"] !== true);
  check("7d  confirmedOverrides has NO ST-2 (TY-3's row)", overlay.confirmedOverrides["ST-2"] !== true);

  const ty3 = h.derive("TY-3");
  check("7e  TY-3 hero unchanged = 2 × 225/45 R17", heroHeadline(ty3) === "2 × 225/45 R17", heroHeadline(ty3));
  check("7f  TY-3 stock unchanged = 4 units reported (unconfirmed)", stockLine(ty3) === "4 units reported", stockLine(ty3));
  check("7g  TY-3 status still Pending", ty3.status === "Pending technician approval", ty3.status);
}

// ---------------------------------------------------------------
console.log("\n[8] No TY-1 shows 4 units or 225/45 R17");
{
  const h = makeHarness();
  const ty1 = h.derive("TY-1");
  const sl = stockLine(ty1);
  check("8a  TY-1 stock line does NOT contain '4'", sl === null || !sl.includes("4"), sl);
  check("8b  TY-1 hero does NOT contain '225/45'", heroHeadline(ty1).indexOf("225/45") === -1, heroHeadline(ty1));
  check("8c  TY-1 runtime.size is 205/55 R16 (not 225/45 R17)", ty1.runtime.size === "205/55 R16", ty1.runtime.size);
  check("8d  TY-1 runtime.quantity is 1 (not 2)", ty1.runtime.quantity === 1, ty1.runtime.quantity);
}

// ---------------------------------------------------------------
console.log("\n[9] Reset — full retest after reset");
{
  const h = makeHarness();

  // Mutate everything on TY-3 and TY-1
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();
  h.select("TY-1");
  h.approve();
  h.runMessageSimulation();

  // Now reset
  h.reset();

  // Recheck every case
  const ty1 = h.derive("TY-1");
  const ty3 = h.derive("TY-3");
  const ty2 = h.derive("TY-2");
  const ty4 = h.derive("TY-4");
  check("9a  Reset: TY-1 hero = 1 × 205/55 R16", heroHeadline(ty1) === "1 × 205/55 R16", heroHeadline(ty1));
  check("9b  Reset: TY-1 stock = 2 units confirmed", stockLine(ty1) === "2 units confirmed", stockLine(ty1));
  check("9c  Reset: TY-1 status = Pending", ty1.status === "Pending technician approval", ty1.status);
  check("9d  Reset: TY-1 not yet approved", ty1.runtime.approved === false);
  check("9e  Reset: TY-3 hero = 2 × 225/45 R17", heroHeadline(ty3) === "2 × 225/45 R17", heroHeadline(ty3));
  check("9f  Reset: TY-3 stock = 4 units reported (unconfirmed)", stockLine(ty3) === "4 units reported", stockLine(ty3));
  check("9g  Reset: TY-3 status = Pending", ty3.status === "Pending technician approval", ty3.status);
  check("9h  Reset: TY-3 not yet approved", ty3.runtime.approved === false);
  check("9i  Reset: TY-2 blocked", ty2.blocked === true);
  check("9j  Reset: TY-4 no action", ty4.noAction === true);
  const overlay = h.getOverlay();
  check("9k  Reset: confirmedOverrides empty", Object.keys(overlay.confirmedOverrides).length === 0);
  check("9l  Reset: stockEvents empty", Object.keys(overlay.stockEvents).length === 0);
}

// ---------------------------------------------------------------
// Summary
console.log("\n" + "=".repeat(60));
if (failures.length === 0) {
  console.log("ALL ASSERTIONS PASSED — state isolation verified.");
} else {
  console.log(failures.length + " ASSERTION(S) FAILED:");
  for (const f of failures) console.log("  • " + f);
  process.exit(1);
}
