import { createHarness, makeReporter } from "./harness.mjs";

const { check, finish } = makeReporter("SMART WORK QUEUE");

console.log("\n[1] Initial queue group per case");
{
  const h = createHarness();
  check("1a  TY-3 is Urgent", h.derive("TY-3").queueGroup === "Urgent", h.derive("TY-3").queueGroup);
  check("1b  TY-1 awaits technician", h.derive("TY-1").queueGroup === "Awaiting technician", h.derive("TY-1").queueGroup);
  check("1c  TY-2 is Missing evidence", h.derive("TY-2").queueGroup === "Missing evidence", h.derive("TY-2").queueGroup);
  check("1d  TY-4 needs no action", h.derive("TY-4").queueGroup === "No action required", h.derive("TY-4").queueGroup);
}

console.log("\n[2] groupCases ordering and contents");
{
  const h = createHarness();
  const groups = h.groups();
  check("2a  first group is Urgent", groups[0].group === "Urgent", groups[0].group);
  check("2b  Urgent contains TY-3", groups[0].cases.some((c) => c.wheel.id === "TY-3"));
  const names = groups.map((entry) => entry.group);
  check("2c  no empty groups", groups.every((entry) => entry.cases.length > 0));
  check("2d  all four cases present", groups.reduce((n, entry) => n + entry.cases.length, 0) === 4);
  check("2e  Missing evidence precedes Awaiting technician", names.indexOf("Missing evidence") < names.indexOf("Awaiting technician"));
}

console.log("\n[3] TY-3 moves through the queue as work is completed");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  check("3a  approved → Awaiting stock", h.derive("TY-3").queueGroup === "Awaiting stock", h.derive("TY-3").queueGroup);

  h.runStockSimulation();
  check("3b  stock confirmed → Ready for customer", h.derive("TY-3").queueGroup === "Ready for customer", h.derive("TY-3").queueGroup);

  h.runMessageSimulation();
  check("3c  message simulated → Complete", h.derive("TY-3").queueGroup === "Complete", h.derive("TY-3").queueGroup);
}

console.log("\n[4] Attention needed — derived from supplied synthetic data only");
{
  const h = createHarness();
  const insights = h.insights();
  const ids = insights.map((insight) => insight.id);
  check("4a  TY-2 missing-evidence insight present", ids.includes("TY-2-missing"), ids.join(", "));
  check("4b  TY-3 approval insight present", ids.includes("TY-3-approval"), ids.join(", "));
  check("4c  TY-1 approval insight present", ids.includes("TY-1-approval"), ids.join(", "));
  check("4d  TY-4 has no insight", !ids.some((id) => id.startsWith("TY-4")), ids.join(", "));
  const ty3 = insights.find((insight) => insight.id === "TY-3-approval");
  check("4e  TY-3 insight tone is urgent", ty3.tone === "urgent", ty3.tone);
  check("4f  urgent insight sorts first", insights[0].id === "TY-3-approval", insights[0].id);
}

console.log("\n[5] Attention needed updates with workflow state");
{
  const h = createHarness();
  h.select("TY-3");
  h.approve();
  let insights = h.insights();
  check("5a  after approval: awaiting-stock insight present", insights.some((i) => i.id === "TY-3-stock"));
  check("5b  after approval: approval insight gone", !insights.some((i) => i.id === "TY-3-approval"));

  h.runStockSimulation();
  insights = h.insights();
  check("5c  after stock: customer-ready insight present", insights.some((i) => i.id === "TY-3-message"));
  const ready = insights.find((i) => i.id === "TY-3-message");
  check("5d  customer-ready insight tone is ok", ready.tone === "ok", ready.tone);

  h.runMessageSimulation();
  insights = h.insights();
  check("5e  after message: TY-3 no longer needs attention", !insights.some((i) => i.id.startsWith("TY-3")));
}

console.log("\n[6] Queue is derived, never mutated by reading it");
{
  const h = createHarness();
  const before = JSON.stringify(h.getOverlay());
  h.groups();
  h.insights();
  check("6a  reading queue/insights changes no state", JSON.stringify(h.getOverlay()) === before);
}

process.exit(finish());
