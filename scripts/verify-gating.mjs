import {
  customerMessageLockReason,
  draftCustomerMessage,
  nextActionKind,
} from "../src/engine/workflow.ts";
import { createHarness, makeReporter, source } from "./harness.mjs";

const { check, finish } = makeReporter("APPROVAL + MESSAGE GATING");

console.log("\n[1] TY-3 — message stays locked until approval AND stock confirmation");
{
  const h = createHarness();
  let ty3 = h.derive("TY-3");
  check("1a  before approval: no draft", draftCustomerMessage(ty3) === null);
  check("1b  before approval: lock reason present", Boolean(customerMessageLockReason(ty3)), customerMessageLockReason(ty3));
  check("1c  before approval: next action = approve", nextActionKind(ty3) === "approve", nextActionKind(ty3));

  h.select("TY-3");
  h.approve();
  ty3 = h.derive("TY-3");
  check("1d  after approval: draft still null (stock unconfirmed)", draftCustomerMessage(ty3) === null);
  check("1e  after approval: lock mentions stock", /stock/i.test(customerMessageLockReason(ty3) ?? ""), customerMessageLockReason(ty3));
  check("1f  after approval: next action = stock", nextActionKind(ty3) === "stock", nextActionKind(ty3));

  h.runStockSimulation();
  ty3 = h.derive("TY-3");
  const draft = draftCustomerMessage(ty3);
  check("1g  after stock sim: draft generated", draft !== null);
  check("1h  draft cites 2 × 225/45 R17", draft.includes("2 × 225/45 R17"), draft);
  check("1i  draft cites technician approval", /technician approved/i.test(draft), draft);
  check("1j  next action = message", nextActionKind(ty3) === "message", nextActionKind(ty3));
}

console.log("\n[2] TY-3 — simulated message requires approval");
{
  const h = createHarness();
  h.select("TY-3");
  h.runMessageSimulation();
  check("2a  message sim before approval is a no-op", h.derive("TY-3").runtime.messageSimulated === false);
  check("2b  overlay stock event not created", h.getOverlay().stockEvents["TY-3"] !== true);

  h.approve();
  h.runMessageSimulation();
  check("2c  message sim after approval succeeds", h.derive("TY-3").runtime.messageSimulated === true);
}

console.log("\n[3] Stock simulation requires a matching stock row");
{
  const h = createHarness();
  h.select("TY-2");
  const before = JSON.stringify(h.getOverlay());
  h.runStockSimulation();
  check("3a  blocked case: stock sim is a no-op", JSON.stringify(h.getOverlay()) === before);

  h.select("TY-4");
  const before4 = JSON.stringify(h.getOverlay());
  h.runStockSimulation();
  check("3b  no-action case: stock sim is a no-op", JSON.stringify(h.getOverlay()) === before4);
}

console.log("\n[4] TY-1 — confirmed stock skips the simulation gate");
{
  const h = createHarness();
  h.select("TY-1");
  let ty1 = h.derive("TY-1");
  check("4a  before approval: no draft", draftCustomerMessage(ty1) === null);
  check("4b  next action = approve", nextActionKind(ty1) === "approve", nextActionKind(ty1));

  h.approve();
  ty1 = h.derive("TY-1");
  const draft = draftCustomerMessage(ty1);
  check("4c  after approval: draft generated (stock already confirmed)", draft !== null);
  check("4d  draft cites 1 × 205/55 R16", draft.includes("1 × 205/55 R16"), draft);
  check("4e  next action = message (no stock step)", nextActionKind(ty1) === "message", nextActionKind(ty1));
  check("4f  no stock event recorded for TY-1", h.getOverlay().stockEvents["TY-1"] !== true);
}

console.log("\n[5] Rejected case cannot produce a message");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.reject("Wrong size for the vehicle");
  const ty3 = h.derive("TY-3");
  check("5a  draft is null after rejection", draftCustomerMessage(ty3) === null);
  check("5b  lock mentions rejection", /rejected/i.test(customerMessageLockReason(ty3) ?? ""), customerMessageLockReason(ty3));
  h.runMessageSimulation();
  check("5c  message sim after rejection is a no-op", h.derive("TY-3").runtime.messageSimulated === false);
}

console.log("\n[6] Simulated stock updates are isolated to the case row");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  const overlay = h.getOverlay();
  check("6a  ST-2 confirmed override set", overlay.confirmedOverrides["ST-2"] === true);
  check("6b  ST-1 override untouched", overlay.confirmedOverrides["ST-1"] !== true);
  check("6c  TY-3 stock confirmed", h.derive("TY-3").stock.confirmed === true);
  check("6d  TY-1 stock unchanged", h.derive("TY-1").stock.confirmed === true && h.derive("TY-1").stock.availabilityId === "ST-1");
  check("6e  TY-3 timeline records a simulated stock event", h.derive("TY-3").runtime.history.some((e) => e.kind === "simulated" && /stock/i.test(e.label)));
}

console.log("\n[7] Reset clears every gate and simulation");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();
  h.reset();
  const ty3 = h.derive("TY-3");
  check("7a  reset: not approved", ty3.runtime.approved === false);
  check("7b  reset: message not simulated", ty3.runtime.messageSimulated === false);
  check("7c  reset: stock unconfirmed again", ty3.stock.confirmed === false);
  check("7d  reset: confirmedOverrides empty", Object.keys(h.getOverlay().confirmedOverrides).length === 0);
  check("7e  reset: stockEvents empty", Object.keys(h.getOverlay().stockEvents).length === 0);
  check("7f  reset: source rules unchanged", source.rules.length === 3);
}

process.exit(finish());
