import type { DescriptiveMetrics, Insight } from "../types.ts";
import { checkGrounded } from "./guardrail.ts";
import { buildExplainMessages, type ChatMessage } from "./prompt.ts";

export type InsightEvidence = {
  insight: {
    id: string;
    title: string;
    detail: string;
    metricLabel: string;
    unit: "rate" | "hours";
    withValue: number;
    withoutValue: number;
    withLabel: string;
    withoutLabel: string;
    withCount: number;
    withoutCount: number;
    factorLabel: string;
    workflowGroups: string[];
  };
  dataset: {
    casesAnalyzed: number;
    offerPopulation: number;
    delayRate: number;
    averageHoursToOffer: number;
    averageHoursToContact: number;
    missingEvidenceRate: number;
    stockDelayRate: number;
    approvalRate: number;
    rejectionRate: number;
  };
  allowedNumbers: number[];
};

export type ExplainSource = "deepseek" | "local";
export type ExplainResult = { text: string; source: ExplainSource };

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildInsightEvidence(
  insight: Insight,
  metrics: DescriptiveMetrics,
): InsightEvidence {
  const allowedNumbers = new Set<number>();
  const add = (value: number) => {
    if (Number.isFinite(value)) allowedNumbers.add(value);
  };

  add(insight.withValue);
  add(insight.withValue * 100);
  add(insight.withoutValue);
  add(insight.withoutValue * 100);
  add(insight.withCount);
  add(insight.withoutCount);
  add(insight.withCount + insight.withoutCount);
  add(insight.difference);
  add(insight.difference * 100);

  add(metrics.casesAnalyzed);
  add(metrics.offerPopulation);
  add(metrics.avgHoursToOffer);
  add(metrics.avgHoursToContact);
  add(metrics.casesWithDelays);
  add(metrics.missingEvidenceRate);
  add(metrics.missingEvidenceRate * 100);
  add(metrics.stockDelayRate);
  add(metrics.stockDelayRate * 100);
  add(metrics.approvalRate);
  add(metrics.approvalRate * 100);
  add(metrics.rejectionRate);
  add(metrics.rejectionRate * 100);
  add(metrics.delayRate);
  add(metrics.delayRate * 100);
  add(48);

  return {
    insight: {
      id: insight.id,
      title: insight.title,
      detail: insight.detail,
      metricLabel: insight.metricLabel,
      unit: insight.unit,
      withValue: insight.withValue,
      withoutValue: insight.withoutValue,
      withLabel: insight.withLabel,
      withoutLabel: insight.withoutLabel,
      withCount: insight.withCount,
      withoutCount: insight.withoutCount,
      factorLabel: insight.factorLabel,
      workflowGroups: insight.workflowGroups,
    },
    dataset: {
      casesAnalyzed: metrics.casesAnalyzed,
      offerPopulation: metrics.offerPopulation,
      delayRate: metrics.delayRate,
      averageHoursToOffer: metrics.avgHoursToOffer,
      averageHoursToContact: metrics.avgHoursToContact,
      missingEvidenceRate: metrics.missingEvidenceRate,
      stockDelayRate: metrics.stockDelayRate,
      approvalRate: metrics.approvalRate,
      rejectionRate: metrics.rejectionRate,
    },
    allowedNumbers: [...allowedNumbers],
  };
}

function whyItMatters(insight: Insight): string {
  switch (insight.id) {
    case "measurement":
      return "Missing evidence can push the offer past the appointment window, so the customer never hears about it in time.";
    case "correction":
      return "Corrections cost coordinator and technician time and can delay the approved offer.";
    case "stock":
      return "If stock is unconfirmed, the customer conversation is held back until confirmation is simulated.";
    case "contact":
      return "Without a usable channel the approved offer cannot become a customer conversation at all.";
    case "appointment":
      return "Cases with little lead time have the least room to recover from missing evidence or stock delay.";
    default:
      return "This pattern points at where coordinator attention is most likely to change the outcome.";
  }
}

function investigateNext(insight: Insight): string {
  if (insight.workflowGroups.length === 0) {
    return "Review the supporting synthetic records and compare them with current cases.";
  }
  return `Start with the ${insight.workflowGroups.join(" and ")} queue group and the supporting synthetic records.`;
}

export function localExplanation(
  insight: Insight,
  metrics: DescriptiveMetrics,
): string {
  const evidence =
    insight.unit === "rate"
      ? `${percent(insight.withValue)} of the ${insight.withCount} ${insight.withLabel} records missed the target, compared with ${percent(insight.withoutValue)} of the ${insight.withoutCount} ${insight.withoutLabel} records.`
      : `${insight.withLabel} averaged ${insight.withValue.toFixed(1)} h to customer contact, compared with ${insight.withoutValue.toFixed(1)} h for ${insight.withoutLabel}.`;

  return [
    `What we observed: ${insight.title}`,
    `Evidence: ${evidence}`,
    `Why it matters: ${whyItMatters(insight)}`,
    `What to investigate next: ${investigateNext(insight)}`,
    `Limitation: This is synthetic historical data generated for a demonstration (${metrics.casesAnalyzed.toLocaleString()} records). It shows an association, not causation, and does not describe real dealership performance.`,
  ].join("\n");
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

export async function explainInsight(options: {
  insight: Insight;
  metrics: DescriptiveMetrics;
  fetchImpl?: typeof fetch;
}): Promise<ExplainResult> {
  const evidence = buildInsightEvidence(options.insight, options.metrics);
  const messages = buildExplainMessages(evidence);

  try {
    const text = await requestText(messages, options.fetchImpl);
    if (text && checkGrounded(text, evidence.allowedNumbers).ok) {
      return { text, source: "deepseek" };
    }
  } catch {
    // fall through to the deterministic grounded explanation
  }

  return { text: localExplanation(options.insight, options.metrics), source: "local" };
}
