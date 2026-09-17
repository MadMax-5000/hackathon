import { makeReporter } from "./harness.mjs";
import { createDbStore } from "./db-harness.mjs";

const { check, finish } = makeReporter("AUDIT TRAIL");

console.log("\n[1] Approval creates an event and an audit record");
{
  const { store, cleanup } = createDbStore();
  const ws = store.approve("TY-3");
  const event = ws.events.find((e) => e.wheelSetId === "TY-3" && e.eventType === "technician_approved");
  const audit = ws.audit.find((a) => a.wheelSetId === "TY-3" && a.action === "approve");
  check("1a  approval event recorded", Boolean(event));
  check("1b  approval event source is human", event?.source === "human", event?.source);
  check("1c  approval audit recorded", Boolean(audit));
  check("1d  audit has actor", Boolean(audit?.actor), audit?.actor);
  check("1e  audit has detail", Boolean(audit?.detail), audit?.detail);
  check("1f  audit has timestamp", Boolean(audit?.createdAt), audit?.createdAt);
  cleanup();
}

console.log("\n[2] Stock simulation creates a persisted event and audit entry");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  const ws = store.simulateStock("TY-3");
  const event = ws.events.find((e) => e.wheelSetId === "TY-3" && e.eventType === "stock_confirmed");
  const audit = ws.audit.find((a) => a.wheelSetId === "TY-3" && a.action === "stock_confirmation");
  check("2a  stock event recorded", Boolean(event));
  check("2b  stock event is labeled simulated", event?.source === "simulated", event?.source);
  check("2c  stock event label says SIMULATION", /SIMULATION/i.test(event?.label ?? ""), event?.label);
  check("2d  stock audit recorded", Boolean(audit));
  check("2e  audit detail labels it simulated", /SIMULATED/i.test(audit?.detail ?? ""), audit?.detail);
  check("2f  timeline includes the stock event", ws.overlay.runtimes["TY-3"].history.some((h) => h.eventType === "stock_confirmed"));
  cleanup();
}

console.log("\n[3] Message simulation creates an event and audit entry");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  store.simulateStock("TY-3");
  store.draftContact("TY-3", "whatsapp", "Hello");
  const { workspace: ws } = store.markContactSimulated("TY-3", "whatsapp");
  const draftEvent = ws.events.find((e) => e.eventType === "contact_draft_generated");
  const event = ws.events.find((e) => e.eventType === "message_simulated");
  const audit = ws.audit.find((a) => a.action === "message_simulated");
  check("3a  draft generation event recorded", Boolean(draftEvent));
  check("3b  message simulation event recorded", Boolean(event));
  check("3c  message event source is simulated", event?.source === "simulated", event?.source);
  check("3d  message event says not sent", /not actually sent/i.test(event?.label ?? ""), event?.label);
  check("3e  message audit recorded", Boolean(audit));
  cleanup();
}

console.log("\n[4] Full TY-3 timeline is database-backed and ordered");
{
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  store.simulateStock("TY-3");
  store.draftContact("TY-3", "whatsapp", "Hello");
  store.markContactSimulated("TY-3", "whatsapp");
  const history = store.getWorkspace().overlay.runtimes["TY-3"].history;
  check("4a  timeline has the source inspection", history.some((h) => h.eventType === "inspection_detected"));
  check("4b  timeline has the AI proposal", history.some((h) => h.eventType === "ai_proposal"));
  check("4c  timeline has the technician approval", history.some((h) => h.eventType === "technician_approved"));
  check("4d  timeline has the simulated stock confirmation", history.some((h) => h.eventType === "stock_confirmed"));
  check("4e  timeline has the simulated customer message", history.some((h) => h.eventType === "message_simulated"));
  check("4f  every event carries a timestamp", history.every((h) => Boolean(h.createdAt)));
  check("4g  every event carries a source", history.every((h) => Boolean(h.source)));
  const indexes = history.map((h) => h.eventType);
  check(
    "4h  order is inspection → proposal → approval → stock → message",
    JSON.stringify(indexes) ===
      JSON.stringify([
        "inspection_detected",
        "ai_proposal",
        "technician_approved",
        "stock_confirmed",
        "contact_draft_generated",
        "message_simulated",
      ]),
    indexes.join(" > "),
  );
  cleanup();
}

process.exit(finish());
