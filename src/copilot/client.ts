import type { DerivedCase } from "../engine/types.ts";
import { nextStep } from "../engine/workflow.ts";
import { answerQuestion } from "./answers.ts";
import { buildCaseContext } from "./context.ts";
import { checkAnswer } from "./guardrail.ts";
import { buildMessages, buildOverviewMessages, type ChatMessage } from "./prompt.ts";

export type CopilotSource = "deepseek" | "local";
export type CopilotResult = { text: string; source: CopilotSource };
export type OverviewResult = { context: string; action: string; source: CopilotSource };

export type AskOptions = {
  question: string;
  item: DerivedCase;
  rules: string[];
  history?: ChatMessage[];
  fetchImpl?: typeof fetch;
};

export type AskOverviewOptions = {
  item: DerivedCase;
  rules: string[];
  fetchImpl?: typeof fetch;
};

export function localAnswer(question: string, item: DerivedCase, rules: string[]): string {
  return answerQuestion(question, item, rules)
    .segments.map((segment) => segment.text)
    .join(" ");
}

async function requestText(
  messages: ChatMessage[],
  fetchImpl: typeof fetch | undefined,
): Promise<string> {
  const doFetch = fetchImpl ?? fetch;
  const response = await doFetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) return "";
  const data = (await response.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

export async function askCopilot({
  question,
  item,
  rules,
  history = [],
  fetchImpl,
}: AskOptions): Promise<CopilotResult> {
  const context = buildCaseContext(item, rules);
  const messages = buildMessages(question, context, history);

  try {
    const text = await requestText(messages, fetchImpl);
    if (text && checkAnswer(text, context).ok) {
      return { text, source: "deepseek" };
    }
  } catch {
    // fall through to the deterministic local answer
  }

  return { text: localAnswer(question, item, rules), source: "local" };
}

export function parseOverview(text: string): { context: string; action: string } {
  const match = /NEXT\s*:\s*/i.exec(text);
  if (match && match.index > 0) {
    const context = text
      .slice(0, match.index)
      .replace(/^\s*CONTEXT\s*:\s*/i, "")
      .trim();
    const action = text.slice(match.index + match[0].length).trim();
    if (context && action) return { context, action };
  }
  return { context: text.replace(/^\s*CONTEXT\s*:\s*/i, "").trim(), action: "" };
}

export function localOverview(
  item: DerivedCase,
  rules: string[],
): { context: string; action: string } {
  const context = localAnswer("Give an overview of this case.", item, rules);
  return { context, action: nextStep(item) };
}

export async function askOverview({
  item,
  rules,
  fetchImpl,
}: AskOverviewOptions): Promise<OverviewResult> {
  const context = buildCaseContext(item, rules);
  const messages = buildOverviewMessages(context);

  try {
    const text = await requestText(messages, fetchImpl);
    if (text && checkAnswer(text, context).ok) {
      const parsed = parseOverview(text);
      if (parsed.context) return { ...parsed, source: "deepseek" };
    }
  } catch {
    // fall through to the deterministic local overview
  }

  return { ...localOverview(item, rules), source: "local" };
}
