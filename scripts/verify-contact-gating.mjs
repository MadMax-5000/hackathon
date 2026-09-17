import { makeReporter } from "./harness.mjs";
import { createDbStore } from "./db-harness.mjs";
import { GateError } from "../server/service.mjs";

const { check, finish } = makeReporter("CONTACT GATING");

function throws(fn) {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
}

console.log("\n[1] TY-2 (missing contact) can never be contacted");
{
  const { store, cleanup } = createDbStore();
  const gate = store.getContactGate("TY-2");
  check("1a  gate reports missing contact", /missing/i.test(gate ?? ""), gate);
  const error = throws(() => store.draftContact("TY-2", "whatsapp", "hello"));
  check("1b  draft is rejected with a GateError", error instanceof GateError, String(error));
  check("1c  no contact message stored", store.getWorkspace().contactMessages.length === 0);
  cleanup();
}

console.log("\n[2] TY-3 — no contact before technician approval");
{
  const { store, cleanup } = createDbStore();
  const gate = store.getContactGate("TY-3");
  check("2a  gate mentions approval", /approval/i.test(gate ?? ""), gate);
  check("2b  draft rejected", throws(() => store.draftContact("TY-3", "whatsapp", "hello")) instanceof GateError);
  cleanup();
}

console.log("\n[3] TY-3 — no contact while stock is unconfirmed");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  const gate = store.getContactGate("TY-3");
  check("3a  gate mentions stock", /stock/i.test(gate ?? ""), gate);
  check("3b  draft rejected", throws(() => store.draftContact("TY-3", "whatsapp", "hello")) instanceof GateError);
  check("3c  no contact message stored", store.getWorkspace().contactMessages.length === 0);
  cleanup();
}

console.log("\n[4] TY-3 — contact unlocks after the simulated stock confirmation");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  store.simulateStock("TY-3");
  check("4a  gate is clear", store.getContactGate("TY-3") === null, String(store.getContactGate("TY-3")));

  const result = store.draftContact("TY-3", "whatsapp", "Hello, 2 × 225/45 R17");
  check("4b  draft returns a message id", typeof result.messageId === "number", String(result.messageId));
  check("4c  one contact message stored", result.workspace.contactMessages.length === 1);
  const message = result.workspace.contactMessages[0];
  check("4d  channel recorded", message.channel === "whatsapp", message.channel);
  check("4e  message is case-specific", message.body.includes("225/45 R17") && !message.body.includes("205/55"), message.body);
  check("4f  message status is draft", message.status === "draft", message.status);

  store.markContactSimulated("TY-3", "whatsapp");
  const ws = store.getWorkspace();
  check("4g  marked simulated", ws.contactMessages[0].status === "marked_simulated", ws.contactMessages[0].status);
  check("4h  offer marked message_simulated", ws.offers.find((o) => o.wheelSetId === "TY-3").status === "message_simulated");
  cleanup();
}

console.log("\n[5] TY-1 — confirmed stock means no stock step before contact");
{
  const { store, cleanup } = createDbStore();
  check("5a  before approval gate mentions approval", /approval/i.test(store.getContactGate("TY-1") ?? ""));
  store.approve("TY-1");
  check("5b  after approval gate is clear (stock already confirmed)", store.getContactGate("TY-1") === null, String(store.getContactGate("TY-1")));
  const result = store.draftContact("TY-1", "email", "Hello, 1 × 205/55 R16");
  check("5c  email draft stored", result.workspace.contactMessages.length === 1);
  const body = result.workspace.contactMessages[0].body;
  check("5d  TY-1 message never cites 225/45", !body.includes("225/45"), body);
  cleanup();
}

console.log("\n[6] Isolation — contact actions stay case-specific");
{
  const { store, cleanup } = createDbStore();

  store.approve("TY-3");
  store.simulateStock("TY-3");
  store.draftContact("TY-3", "whatsapp", "TY-3 only");

  store.approve("TY-1");
  store.draftContact("TY-1", "email", "TY-1 only");

  const ws = store.getWorkspace();
  const ty3 = ws.contactMessages.filter((m) => m.wheelSetId === "TY-3");
  const ty1 = ws.contactMessages.filter((m) => m.wheelSetId === "TY-1");
  check("6a  TY-3 has exactly one message", ty3.length === 1 && ty3[0].body === "TY-3 only");
  check("6b  TY-1 has exactly one message", ty1.length === 1 && ty1[0].body === "TY-1 only");
  check("6c  TY-1 was not approved by TY-3 actions", ws.overlay.runtimes["TY-1"].messageSimulated === false);
  check("6d  TY-3 stock event did not leak to TY-1", ws.stockEvents["TY-1"] !== true);
  check("6e  TY-3 stock event present", ws.stockEvents["TY-3"] === true);
  cleanup();
}

process.exit(finish());
