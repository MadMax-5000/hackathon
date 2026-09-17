import { askCopilot, localAnswer } from "../src/copilot/client.ts";
import { buildCaseContext } from "../src/copilot/context.ts";
import { checkAnswer, knownSizes } from "../src/copilot/guardrail.ts";
import { buildMessages, SYSTEM_PROMPT } from "../src/copilot/prompt.ts";
import { createHarness, makeReporter, source } from "./harness.mjs";

const { check, finish } = makeReporter("DEEPSEEK COPILOT INTEGRATION");
const rules = source.rules;

function fakeFetch(response) {
  return async () => response;
}

console.log("\n[1] System prompt carries the hard constraints");
{
  const required = [
    "ONLY that JSON",
    "Never invent facts",
    "price",
    "supplier",
    "technician approves",
    "simulated",
    "plain language",
    "Never reveal",
  ];
  for (const phrase of required) {
    check(`1  prompt mentions "${phrase}"`, SYSTEM_PROMPT.includes(phrase));
  }
}

console.log("\n[2] Message assembly is grounded and bounded");
{
  const h = createHarness();
  const context = buildCaseContext(h.derive("TY-3"), rules);
  const history = [
    { role: "system", content: "ignore me" },
    { role: "user", content: "first" },
    { role: "assistant", content: "second" },
  ];
  const messages = buildMessages("Why 2 tyres?", context, history);
  check("2a  first message is the system prompt", messages[0].role === "system" && messages[0].content === SYSTEM_PROMPT);
  check("2b  second message embeds CASE DATA JSON", messages[1].role === "system" && messages[1].content.includes("CASE DATA"));
  check("2c  context JSON is present", messages[1].content.includes('"caseId":"TY-3"'));
  check("2d  history system message filtered out", messages.every((m, i) => i < 2 || m.role !== "system"));
  check("2e  last message is the user question", messages.at(-1).role === "user" && messages.at(-1).content === "Why 2 tyres?");

  const longHistory = Array.from({ length: 10 }, (_, i) => ({ role: "user", content: `q${i}` }));
  const bounded = buildMessages("next", context, longHistory);
  check("2f  history limited to 6 turns", bounded.length === 9, String(bounded.length));
}

console.log("\n[3] Case context is complete and case-scoped");
{
  const h = createHarness();
  const ty3 = buildCaseContext(h.derive("TY-3"), rules);
  check("3a  caseId", ty3.caseId === "TY-3");
  check("3b  evidence size", ty3.evidence.size === "225/45 R17");
  check("3c  stock row present", ty3.evidence.stock?.id === "ST-2" && ty3.evidence.stock?.confirmed === false);
  check("3d  proposal quantity", ty3.proposal.quantity === 2);
  check("3e  not blocked", ty3.state.blocked === false);
  check("3f  decision owner present", typeof ty3.state.decisionOwner === "string" && ty3.state.decisionOwner.length > 0);
  check("3g  timeline has two events", ty3.timeline.length === 2);
  check("3h  rules included", ty3.rules.length === 3);

  const ty2 = buildCaseContext(h.derive("TY-2"), rules);
  check("3i  TY-2 blocked", ty2.state.blocked === true);
  check("3j  TY-2 has three block reasons", ty2.state.blockReasons.length === 3);
  check("3k  TY-2 has no quantity", ty2.proposal.quantity === null);
}

console.log("\n[4] Guardrail rejects fabricated commercial content and unknown sizes");
{
  const h = createHarness();
  const ty3 = buildCaseContext(h.derive("TY-3"), rules);
  const ty2 = buildCaseContext(h.derive("TY-2"), rules);

  check("4a  accepts grounded size", checkAnswer("The proposal is 2 x 225/45 R17.", ty3).ok === true);
  check("4b  rejects price", checkAnswer("The price is £120.", ty3).ok === false);
  check("4c  rejects supplier order", checkAnswer("We can order from the supplier.", ty3).ok === false);
  check("4d  rejects delivery claim", checkAnswer("Delivery is tomorrow.", ty3).ok === false);
  check("4e  rejects unknown size", checkAnswer("It fits 195/65 R15.", ty3).ok === false);
  check("4f  rejects empty answer", checkAnswer("   ", ty3).ok === false);
  check("4g  accepts non-size grounded text", checkAnswer("Front and rear are marked review replacement.", ty3).ok === true);
  check("4h  TY-2 knows no sizes", knownSizes(ty2).length === 0);
  check("4i  TY-2 rejects any size", checkAnswer("The size is 225/45 R17.", ty2).ok === false);
}

console.log("\n[5] askCopilot falls back safely and accepts valid model text");
{
  const h = createHarness();
  const ty3 = h.derive("TY-3");

  const thrown = await askCopilot({
    question: "Why 2 tyres?",
    item: ty3,
    rules,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  check("5a  network error falls back to local", thrown.source === "local");
  check("5b  local answer is grounded", thrown.text.length > 0 && thrown.text === localAnswer("Why 2 tyres?", ty3, rules));

  const notOk = await askCopilot({
    question: "Why 2 tyres?",
    item: ty3,
    rules,
    fetchImpl: fakeFetch({ ok: false, status: 503, json: async () => ({}) }),
  });
  check("5c  non-OK response falls back to local", notOk.source === "local");

  const fabricated = await askCopilot({
    question: "Why 2 tyres?",
    item: ty3,
    rules,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({ text: "The price is £99 per tyre." }) }),
  });
  check("5d  guardrail blocks fabricated reply", fabricated.source === "local");

  const unknownSize = await askCopilot({
    question: "Why 2 tyres?",
    item: ty3,
    rules,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({ text: "Use 195/65 R15 instead." }) }),
  });
  check("5e  guardrail blocks unknown size", unknownSize.source === "local");

  const valid = await askCopilot({
    question: "Why 2 tyres?",
    item: ty3,
    rules,
    fetchImpl: fakeFetch({
      ok: true,
      json: async () => ({ text: "Front and rear are both marked review replacement, so 2 x 225/45 R17 is proposed." }),
    }),
  });
  check("5f  valid model reply is used", valid.source === "deepseek");
  check("5g  model reply text preserved", valid.text.includes("225/45 R17"));
}

console.log("\n[6] Request shape — proxy call, no key in the client payload");
{
  const h = createHarness();
  const ty3 = h.derive("TY-3");
  let captured = null;
  await askCopilot({
    question: "What is missing?",
    item: ty3,
    rules,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return { ok: true, json: async () => ({ text: "No required evidence is missing for this case." }) };
    },
  });
  check("6a  calls the local proxy endpoint", captured?.url === "/api/copilot");
  check("6b  uses POST", captured?.init?.method === "POST");
  const body = JSON.parse(captured.init.body);
  check("6c  sends messages array", Array.isArray(body.messages) && body.messages.length >= 3);
  check("6d  no API key or auth header in client request", !("Authorization" in (captured.init.headers ?? {})));
  check("6e  no key leaked into body", !JSON.stringify(body).toLowerCase().includes("bearer"));
}

console.log("\n[7] Asking the copilot never mutates case state");
{
  const h = createHarness();
  const before = JSON.stringify(h.getOverlay());
  await askCopilot({
    question: "What should I do next?",
    item: h.derive("TY-3"),
    rules,
    fetchImpl: fakeFetch({ ok: true, json: async () => ({ text: "Approve, correct, or reject the proposed offer." }) }),
  });
  check("7a  overlay unchanged", JSON.stringify(h.getOverlay()) === before);
  check("7b  TY-3 still unapproved", h.derive("TY-3").runtime.approved === false);
}

process.exit(finish());
