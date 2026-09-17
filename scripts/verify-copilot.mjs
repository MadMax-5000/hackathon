import { answerQuestion, classify, suggestedActions, suggestedQuestions } from "../src/copilot/answers.ts";
import { createHarness, makeReporter, source } from "./harness.mjs";

const { check, finish } = makeReporter("COPILOT GROUNDING");
const rules = source.rules;

function textOf(answer) {
  return answer.segments.map((segment) => segment.text).join(" ");
}

const FORBIDDEN = /(price|£|\$|€|supplier|diagnos|deliver|purchase|payment)/i;

console.log("\n[1] Intent classification");
{
  check("1a  quantity", classify("Why 2 tyres?") === "quantity", classify("Why 2 tyres?"));
  check("1b  blocked", classify("Why is this case blocked?") === "blocked");
  check("1c  missing", classify("What information is missing?") === "missing");
  check("1d  changed", classify("What changed since the inspection?") === "changed");
  check("1e  risk", classify("What risk should I check before approving?") === "risk");
  check("1f  next", classify("What should I do next?") === "next");
  check("1g  evidence", classify("What evidence supports this proposal?") === "evidence");
  check("1h  unknown falls back to summary", classify("What is the weather today?") === "summary");
}

console.log("\n[2] TY-3 — quantity answer is grounded in this case");
{
  const h = createHarness();
  const ty3 = h.derive("TY-3");
  const answer = answerQuestion("Why 2 tyres?", ty3, rules);
  const text = textOf(answer);
  check("2a  intent = quantity", answer.intent === "quantity", answer.intent);
  check("2b  mentions 2 units", /2/.test(text), text);
  check("2c  cites front observation", /front/i.test(text), text);
  check("2d  states technician approval required", /technician/i.test(text), text);
  check("2e  grounded in front observation", answer.groundedIn.includes("front observation"));
  check("2f  no cross-case size leak", !text.includes("205/55"), text);
}

console.log("\n[3] TY-3 — evidence answer cites source fields");
{
  const h = createHarness();
  const answer = answerQuestion("What evidence supports this proposal?", h.derive("TY-3"), rules);
  const text = textOf(answer);
  check("3a  intent = evidence", answer.intent === "evidence");
  check("3b  cites size 225/45 R17", text.includes("225/45 R17"), text);
  check("3c  cites review replacement", text.includes("review replacement"), text);
  check("3d  cites appointment Day 4", text.includes("Day 4"), text);
  check("3e  cites stock row ST-2", text.includes("ST-2"), text);
}

console.log("\n[4] TY-2 — blocked answer explains only real missing evidence");
{
  const h = createHarness();
  const ty2 = h.derive("TY-2");
  const answer = answerQuestion("Why is this case blocked?", ty2, rules);
  const text = textOf(answer);
  check("4a  intent = blocked", answer.intent === "blocked");
  check("4b  cites measurement missing", text.includes("measurement missing"), text);
  check("4c  cites tyre size unknown", text.includes("tyre size unknown"), text);
  check("4d  cites contact unavailable", text.includes("customer contact unavailable"), text);
  check("4e  no fabricated quantity", !/225\/45|205\/55/.test(text), text);
  check("4f  mentions review task state", /review task/i.test(text), text);
  check("4g  suggested question offers blocked", suggestedQuestions(ty2)[0].toLowerCase().includes("blocked"));
}

console.log("\n[5] TY-2 — missing answer lists gaps, not offers");
{
  const h = createHarness();
  const answer = answerQuestion("What information is missing?", h.derive("TY-2"), rules);
  const text = textOf(answer);
  check("5a  intent = missing", answer.intent === "missing");
  check("5b  lists measurement", text.includes("measurement missing"), text);
  check("5c  no quantity proposed", !text.includes("×"), text);
}

console.log("\n[6] Case isolation — answers never leak another case");
{
  const h = createHarness();
  const ty1 = answerQuestion("status", h.derive("TY-1"), rules);
  const ty1Text = textOf(ty1);
  check("6a  TY-1 summary cites 205/55 R16", ty1Text.includes("205/55 R16"), ty1Text);
  check("6b  TY-1 summary never cites 225/45", !ty1Text.includes("225/45"), ty1Text);
  check("6c  TY-1 summary never cites 4 units", !ty1Text.includes("4 units"), ty1Text);

  const ty3Text = textOf(answerQuestion("status", h.derive("TY-3"), rules));
  check("6d  TY-3 summary never cites 205/55", !ty3Text.includes("205/55"), ty3Text);
  check("6e  TY-3 summary cites 225/45 R17", ty3Text.includes("225/45 R17"), ty3Text);
}

console.log("\n[7] No fabricated commercial or safety content");
{
  const h = createHarness();
  const questions = [
    "Why 2 tyres?",
    "What evidence supports this proposal?",
    "What information is missing?",
    "Why is this case blocked?",
    "What should I do next?",
    "What changed since the inspection?",
    "What risk should I check before approving?",
    "status",
  ];
  for (const id of ["TY-1", "TY-2", "TY-3", "TY-4"]) {
    const item = h.derive(id);
    for (const question of questions) {
      const text = textOf(answerQuestion(question, item, rules));
      check(`7  ${id} · "${question}" has no fabricated content`, !FORBIDDEN.test(text), text);
    }
  }
}

console.log("\n[8] Safe action suggestions and consequential flags");
{
  const h = createHarness();
  const initial = suggestedActions(h.derive("TY-3"));
  check("8a  initial: prepare-proposal offered", initial.some((a) => a.id === "prepare-proposal"));
  check("8b  initial: no confirm-stock yet", !initial.some((a) => a.id === "confirm-stock"));

  h.select("TY-3");
  h.approve();
  const approved = suggestedActions(h.derive("TY-3"));
  const stock = approved.find((a) => a.id === "confirm-stock");
  check("8c  approved: confirm-stock offered", Boolean(stock));
  check("8d  confirm-stock flagged consequential", stock?.consequential === true);

  h.runStockSimulation();
  const ready = suggestedActions(h.derive("TY-3"));
  const message = ready.find((a) => a.id === "generate-message");
  check("8e  ready: generate-message offered", Boolean(message));
  check("8f  generate-message flagged consequential", message?.consequential === true);

  const blocked = suggestedActions(h.derive("TY-2"));
  const task = blocked.find((a) => a.id === "create-review-task");
  check("8g  blocked: create-review-task offered", Boolean(task));
  check("8h  create-review-task flagged consequential", task?.consequential === true);
}

console.log("\n[9] Copilot never mutates case state (no silent decisions)");
{
  const h = createHarness();
  const before = JSON.stringify(h.getOverlay());
  for (const question of suggestedQuestions(h.derive("TY-3"))) {
    answerQuestion(question, h.derive("TY-3"), rules);
  }
  suggestedActions(h.derive("TY-3"));
  const after = JSON.stringify(h.getOverlay());
  check("9a  overlay unchanged after copilot use", before === after);
  check("9b  TY-3 still not approved", h.derive("TY-3").runtime.approved === false);
  check("9c  TY-3 message not simulated", h.derive("TY-3").runtime.messageSimulated === false);
}

console.log("\n[10] TY-3 risk answer flags stock uncertainty");
{
  const h = createHarness();
  const answer = answerQuestion("What risk should I check before approving?", h.derive("TY-3"), rules);
  const text = textOf(answer);
  check("10a intent = risk", answer.intent === "risk");
  check("10b mentions stock not confirmed", /not confirmed/i.test(text), text);
  check("10c mentions labeled simulation", /simulation/i.test(text), text);
  check("10d mentions human approval", /approv/i.test(text), text);
}

process.exit(finish());
