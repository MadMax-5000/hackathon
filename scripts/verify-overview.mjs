import { askOverview, localOverview, parseOverview } from "../src/copilot/client.ts";
import {
  clearOverviewCache,
  getCachedOverview,
  loadOverview,
  regenerateOverview,
} from "../src/copilot/overviewCache.ts";
import {
  buildOverviewMessages,
  OVERVIEW_INSTRUCTION,
  OVERVIEW_SYSTEM_PROMPT,
} from "../src/copilot/prompt.ts";
import { nextStep } from "../src/engine/workflow.ts";
import { createHarness, makeReporter, source } from "./harness.mjs";

const { check, finish } = makeReporter("CASE OVERVIEW BRIEF");
const rules = source.rules;
const FORBIDDEN = /(price|£|\$|€|supplier|diagnos|deliver|purchase|payment)/i;

function fakeFetch(response) {
  return async () => response;
}

console.log("\n[1] Overview prompt and message assembly");
{
  const required = ["CONTEXT:", "NEXT:", "ONLY that JSON", "Never invent facts"];
  for (const phrase of required) {
    check(`1  overview prompt mentions "${phrase}"`, OVERVIEW_SYSTEM_PROMPT.includes(phrase));
  }

  const messages = buildOverviewMessages({
    caseId: "TY-3",
    customerId: "C-1",
    appointment: "Day 4",
    contact: "x",
    evidence: { front: "review replacement", rear: "review replacement", size: "225/45 R17", stock: null },
    proposal: { aiQuantity: 2, aiSize: "225/45 R17", quantity: 2, size: "225/45 R17", humanCorrected: false },
    state: {
      status: "Needs review",
      offerState: "Proposal generated",
      queueGroup: "Urgent",
      blocked: false,
      noAction: false,
      blockReasons: [],
      uncertainties: [],
      decisionOwner: "Technician",
      whyProposed: null,
    },
    decisions: {
      approved: false,
      rejected: false,
      rejectReason: "",
      messageSimulated: false,
      evidenceReviewed: false,
      task: null,
    },
    rules,
    timeline: [],
  });
  check("1b  three messages assembled", messages.length === 3, String(messages.length));
  check("1c  first message is overview system prompt", messages[0].content === OVERVIEW_SYSTEM_PROMPT);
  check("1d  case data embedded", messages[1].content.includes("CASE DATA") && messages[1].content.includes('"caseId":"TY-3"'));
  check("1e  last message is overview instruction", messages.at(-1).content === OVERVIEW_INSTRUCTION);
}

console.log("\n[2] Local overview is grounded, actionable, and case-scoped");
{
  const h = createHarness();
  const ty3 = localOverview(h.derive("TY-3"), rules);
  check("2a  context present", ty3.context.length > 0);
  check("2b  action equals nextStep", ty3.action === nextStep(h.derive("TY-3")), ty3.action);
  check("2c  context cites its own case id", ty3.context.includes("TY-3"), ty3.context);
  check("2d  context cites its own size", ty3.context.includes("225/45 R17"), ty3.context);
  check("2e  no forbidden content", !FORBIDDEN.test(`${ty3.context} ${ty3.action}`));

  const ty1 = localOverview(h.derive("TY-1"), rules);
  check("2f  TY-1 never leaks TY-3 size", !ty1.context.includes("225/45"), ty1.context);
  check("2g  TY-1 next action is grounded", ty1.action === nextStep(h.derive("TY-1")), ty1.action);
}

console.log("\n[3] Overview parsing");
{
  const parsed = parseOverview("CONTEXT: Front and rear flagged.\nNEXT: Get technician approval.");
  check("3a  context parsed", parsed.context === "Front and rear flagged.", parsed.context);
  check("3b  action parsed", parsed.action === "Get technician approval.", parsed.action);

  const single = parseOverview("CONTEXT: Only context here.");
  check("3c  missing NEXT keeps context", single.context === "Only context here.", single.context);
  check("3d  missing NEXT leaves action empty", single.action === "", single.action);
}

console.log("\n[4] askOverview uses the model reply or falls back safely");
{
  const h = createHarness();
  const ty3 = h.derive("TY-3");

  const offline = await askOverview({
    item: ty3,
    rules,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  check("4a  network error falls back to local", offline.source === "local");
  check("4b  fallback still actioned", offline.context.length > 0 && offline.action === nextStep(ty3));

  const notOk = await askOverview({
    item: ty3,
    rules,
    fetchImpl: fakeFetch({ ok: false, status: 503, json: async () => ({}) }),
  });
  check("4c  non-OK response falls back to local", notOk.source === "local");

  const valid = await askOverview({
    item: ty3,
    rules,
    fetchImpl: fakeFetch({
      ok: true,
      json: async () => ({
        text: "CONTEXT: TY-3 has two axles flagged review replacement.\nNEXT: Get technician approval.",
      }),
    }),
  });
  check("4d  valid model reply is used", valid.source === "deepseek");
  check("4e  model context parsed", valid.context.startsWith("TY-3"), valid.context);
  check("4f  model action parsed", valid.action === "Get technician approval.", valid.action);

  const fabricated = await askOverview({
    item: ty3,
    rules,
    fetchImpl: fakeFetch({
      ok: true,
      json: async () => ({ text: "CONTEXT: The price is £120.\nNEXT: Order from the supplier." }),
    }),
  });
  check("4g  guardrail blocks fabricated reply", fabricated.source === "local");
}

console.log("\n[5] Brief is generated once per case and cached");
{
  clearOverviewCache();
  const h = createHarness();
  const ty3 = h.derive("TY-3");

  const first = loadOverview(ty3, rules);
  const second = loadOverview(ty3, rules);
  check("5a  concurrent requests share one in-flight call", first === second);

  const resolved = await first;
  check("5b  result is cached", getCachedOverview("TY-3") === resolved);
  check("5c  cached result keeps its shape", typeof resolved.context === "string" && typeof resolved.action === "string");

  const cachedAgain = await loadOverview(ty3, rules);
  check("5d  later load returns the same cached object", cachedAgain === resolved);

  const regenerated = await regenerateOverview(ty3, rules);
  check("5e  regenerate refreshes the entry", getCachedOverview("TY-3") === regenerated);
  check("5f  regenerate still produces an action", regenerated.action.length > 0);

  clearOverviewCache();
  check("5g  clearing removes the cached entry", getCachedOverview("TY-3") === undefined);
}

process.exit(finish());
