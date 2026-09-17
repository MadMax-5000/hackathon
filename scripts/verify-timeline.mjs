import { createHarness, makeReporter } from "./harness.mjs";

const { check, finish } = makeReporter("CASE TIMELINE");

const KINDS = new Set(["source", "ai", "human", "simulated"]);

console.log("\n[1] Initial timeline reflects the real starting state");
{
  const h = createHarness();
  const ty3 = h.derive("TY-3").runtime.history;
  check("1a  TY-3 has two starting events", ty3.length === 2, String(ty3.length));
  check("1b  first event is source inspection", ty3[0].kind === "source" && /inspection detected/i.test(ty3[0].label), ty3[0].label);
  check("1c  second event is AI proposal", ty3[1].kind === "ai" && ty3[1].label.includes("2 × 225/45 R17"), ty3[1].label);
  check("1d  AI proposal states it is pending approval", /pending technician approval/i.test(ty3[1].label), ty3[1].label);

  const ty2 = h.derive("TY-2").runtime.history;
  check("1e  TY-2 records blocked with no proposal", ty2[1].kind === "ai" && /blocked/i.test(ty2[1].label), ty2[1].label);

  const ty4 = h.derive("TY-4").runtime.history;
  check("1f  TY-4 records no concern", ty4[1].kind === "ai" && /no offer proposed/i.test(ty4[1].label), ty4[1].label);
}

console.log("\n[2] Human decisions append human events");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  let history = h.derive("TY-3").runtime.history;
  check("2a  approve appends human event", history.at(-1).kind === "human" && /approved/i.test(history.at(-1).label), history.at(-1).label);

  h.reset();
  h.select("TY-3");
  h.edit(1, "225/45 R17", "one axle only");
  history = h.derive("TY-3").runtime.history;
  check("2b  edit appends human-corrected event", history.at(-1).kind === "human" && history.at(-1).label.includes("Human-corrected proposal: 1 × 225/45 R17"), history.at(-1).label);

  h.reset();
  h.select("TY-3");
  h.reject("Wrong size for the vehicle");
  history = h.derive("TY-3").runtime.history;
  check("2c  reject appends human event with reason", history.at(-1).kind === "human" && /Wrong size for the vehicle/.test(history.at(-1).label), history.at(-1).label);

  h.reset();
  h.select("TY-3");
  h.approve();
  h.backToReview();
  history = h.derive("TY-3").runtime.history;
  check("2d  back-to-review appends human event", history.at(-1).kind === "human" && /returned to review/i.test(history.at(-1).label), history.at(-1).label);
}

console.log("\n[3] Simulated events are explicitly labeled");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  let history = h.derive("TY-3").runtime.history;
  check("3a  stock sim appends simulated event", history.at(-1).kind === "simulated" && /SIMULATION/.test(history.at(-1).label), history.at(-1).label);

  h.runMessageSimulation();
  history = h.derive("TY-3").runtime.history;
  check("3b  message sim appends simulated event", history.at(-1).kind === "simulated" && /SIMULATED/.test(history.at(-1).label), history.at(-1).label);
  check("3c  message sim states it was not sent", /not actually sent/i.test(history.at(-1).label), history.at(-1).label);
}

console.log("\n[4] Coordinator actions are real, reversible, and append once");
{
  const h = createHarness();
  h.select("TY-2");
  h.createTask("Collect missing measurement and confirm tyre size.");
  let history = h.derive("TY-2").runtime.history;
  check("4a  review task appends human event", history.at(-1).kind === "human" && /review task created/i.test(history.at(-1).label), history.at(-1).label);
  check("4b  review task stored on runtime", h.derive("TY-2").runtime.task?.note === "Collect missing measurement and confirm tyre size.");
  const lengthAfterTask = history.length;
  h.createTask("Duplicate");
  check("4c  second review task is a no-op", h.derive("TY-2").runtime.history.length === lengthAfterTask);

  h.markReviewed();
  history = h.derive("TY-2").runtime.history;
  check("4d  mark reviewed appends human event", history.at(-1).kind === "human" && /evidence reviewed/i.test(history.at(-1).label), history.at(-1).label);
  const lengthAfterReview = history.length;
  h.markReviewed();
  check("4e  second mark reviewed is a no-op", h.derive("TY-2").runtime.history.length === lengthAfterReview);
}

console.log("\n[5] Every event has a valid, non-fabricated kind");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();
  const history = h.derive("TY-3").runtime.history;
  check("5a  all kinds valid", history.every((event) => KINDS.has(event.kind)));
  check("5b  all events have a label", history.every((event) => event.label.trim().length > 0));
  check("5c  kinds only source/ai/human/simulated", history.every((event) => ["source", "ai", "human", "simulated"].includes(event.kind)));
}

console.log("\n[6] Reset restores the starting timeline and clears coordinator state");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  h.runStockSimulation();
  h.runMessageSimulation();
  h.select("TY-2");
  h.createTask("Task");
  h.markReviewed();
  h.reset();

  check("6a  TY-3 timeline back to 2 events", h.derive("TY-3").runtime.history.length === 2, String(h.derive("TY-3").runtime.history.length));
  check("6b  TY-2 task cleared", h.derive("TY-2").runtime.task === null);
  check("6c  TY-2 evidenceReviewed cleared", h.derive("TY-2").runtime.evidenceReviewed === false);
  check("6d  TY-3 message cleared", h.derive("TY-3").runtime.messageSimulated === false);
  check("6e  TY-3 approval cleared", h.derive("TY-3").runtime.approved === false);
}

process.exit(finish());
