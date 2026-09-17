import type { AnalyticsData } from "../types.ts";
import { checkGrounded } from "./guardrail.ts";
import { buildAnalystMessages, type ChatMessage } from "./prompt.ts";

export type SnapshotInsight = {
  id: string;
  title: string;
  metricLabel: string;
  unit: "rate" | "hours";
  withValue: number;
  withoutValue: number;
  withCount: number;
  withoutCount: number;
  factorLabel: string;
  workflowGroups: string[];
};

export type InsightsSnapshot = {
  dataset: {
    casesAnalyzed: number;
    offerPopulation: number;
    avgHoursToOffer: number;
    avgHoursToContact: number;
    approvalRate: number;
    rejectionRate: number;
    missingEvidenceRate: number;
    stockDelayRate: number;
    casesWithDelays: number;
    delayRate: number;
  };
  delayRiskModel: {
    accuracy: number;
    auc: number;
    baseRate: number;
    topFactors: Array<{ label: string; importance: number }>;
  };
  topRiskCases: Array<{
    caseId: string;
    probability: number;
    factors: Array<{ label: string; contribution: number }>;
  }>;
  insights: SnapshotInsight[];
  clusters: Array<{
    description: string;
    size: number;
    share: number;
    topFeatures: Array<{ label: string; mean: number; globalMean: number; direction: string }>;
  }>;
  anomalies: Array<{
    caseId: string;
    driverLabel: string;
    zScore: number;
    value: number;
    baseline: number;
  }>;
  charts: {
    missingVsDelay: Array<{ label: string; value: number; count: number }>;
    stockVsContact: Array<{ label: string; value: number; count: number }>;
    delayRateByIssueType: Array<{ label: string; value: number; count: number }>;
  };
  allowedNumbers: number[];
};

export type AnalystSource = "deepseek" | "local";
export type AnalystResult = { text: string; source: AnalystSource };

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildSnapshot(data: AnalyticsData): InsightsSnapshot {
  const allowedNumbers = new Set<number>();
  const add = (value: number) => {
    if (Number.isFinite(value)) allowedNumbers.add(value);
  };

  const { metrics } = data;
  add(metrics.casesAnalyzed);
  add(metrics.offerPopulation);
  add(metrics.avgHoursToOffer);
  add(metrics.avgHoursToContact);
  add(metrics.casesWithDelays);
  add(metrics.delayRate);
  add(metrics.delayRate * 100);
  add(metrics.approvalRate);
  add(metrics.approvalRate * 100);
  add(metrics.rejectionRate);
  add(metrics.rejectionRate * 100);
  add(metrics.missingEvidenceRate);
  add(metrics.missingEvidenceRate * 100);
  add(metrics.stockDelayRate);
  add(metrics.stockDelayRate * 100);
  add(48);

  add(data.model.evaluation.accuracy);
  add(data.model.evaluation.accuracy * 100);
  add(data.model.evaluation.auc);
  add(data.model.evaluation.auc * 100);
  add(data.model.evaluation.baseRate);
  add(data.model.evaluation.baseRate * 100);

  for (const importance of data.model.globalImportance) add(importance.importance);
  for (const prediction of data.model.topRisks) {
    add(prediction.probability);
    add(prediction.probability * 100);
    for (const factor of prediction.factors) add(factor.contribution);
  }
  for (const insight of data.insights) {
    add(insight.withValue);
    add(insight.withValue * 100);
    add(insight.withoutValue);
    add(insight.withoutValue * 100);
    add(insight.withCount);
    add(insight.withoutCount);
  }
  for (const cluster of data.clusters) {
    add(cluster.size);
    add(cluster.share);
    add(cluster.share * 100);
    for (const feature of cluster.topFeatures) {
      add(feature.mean);
      add(feature.globalMean);
    }
  }
  for (const anomaly of data.anomalies) {
    add(anomaly.zScore);
    add(anomaly.value);
    add(anomaly.baseline);
  }
  for (const chart of [
    data.charts.missingVsDelay,
    data.charts.stockVsContact,
    data.charts.delayRateByIssueType,
  ]) {
    for (const datum of chart) {
      add(datum.value);
      add(datum.value * 100);
      add(datum.count);
    }
  }

  return {
    dataset: {
      casesAnalyzed: metrics.casesAnalyzed,
      offerPopulation: metrics.offerPopulation,
      avgHoursToOffer: metrics.avgHoursToOffer,
      avgHoursToContact: metrics.avgHoursToContact,
      approvalRate: metrics.approvalRate,
      rejectionRate: metrics.rejectionRate,
      missingEvidenceRate: metrics.missingEvidenceRate,
      stockDelayRate: metrics.stockDelayRate,
      casesWithDelays: metrics.casesWithDelays,
      delayRate: metrics.delayRate,
    },
    delayRiskModel: {
      accuracy: data.model.evaluation.accuracy,
      auc: data.model.evaluation.auc,
      baseRate: data.model.evaluation.baseRate,
      topFactors: data.model.globalImportance.map((entry) => ({
        label: entry.label,
        importance: entry.importance,
      })),
    },
    topRiskCases: data.model.topRisks.map((prediction) => ({
      caseId: prediction.caseId,
      probability: prediction.probability,
      factors: prediction.factors.map((factor) => ({
        label: factor.label,
        contribution: factor.contribution,
      })),
    })),
    insights: data.insights.map((insight) => ({
      id: insight.id,
      title: insight.title,
      metricLabel: insight.metricLabel,
      unit: insight.unit,
      withValue: insight.withValue,
      withoutValue: insight.withoutValue,
      withCount: insight.withCount,
      withoutCount: insight.withoutCount,
      factorLabel: insight.factorLabel,
      workflowGroups: insight.workflowGroups,
    })),
    clusters: data.clusters.map((cluster) => ({
      description: cluster.description,
      size: cluster.size,
      share: cluster.share,
      topFeatures: cluster.topFeatures.map((feature) => ({
        label: feature.label,
        mean: feature.mean,
        globalMean: feature.globalMean,
        direction: feature.direction,
      })),
    })),
    anomalies: data.anomalies.map((anomaly) => ({
      caseId: anomaly.caseId,
      driverLabel: anomaly.driverLabel,
      zScore: anomaly.zScore,
      value: anomaly.value,
      baseline: anomaly.baseline,
    })),
    charts: {
      missingVsDelay: data.charts.missingVsDelay,
      stockVsContact: data.charts.stockVsContact,
      delayRateByIssueType: data.charts.delayRateByIssueType,
    },
    allowedNumbers: [...allowedNumbers],
  };
}

export type AnalystIntent =
  | "risk"
  | "delays"
  | "factor"
  | "anomaly"
  | "patterns"
  | "compare"
  | "first"
  | "unknown";

const INTENTS: Array<{ id: AnalystIntent; patterns: RegExp[] }> = [
  { id: "risk", patterns: [/most at risk/i, /at.?risk/i, /predict/i, /highest risk/i, /which cases/i] },
  { id: "factor", patterns: [/strongest/i, /which factor/i, /most (important|associated|related)/i, /driver/i, /relationship/i] },
  { id: "anomaly", patterns: [/anomal/i, /unusual/i, /outlier/i, /weird/i] },
  { id: "compare", patterns: [/compare/i, /versus|\bvs\b/i, /complete vs incomplete/i, /difference between/i] },
  { id: "patterns", patterns: [/pattern/i, /cluster/i, /group/i, /segment/i] },
  { id: "first", patterns: [/first/i, /priority/i, /what should (the coordinator|i) (do|investigate)/i, /start with/i] },
  { id: "delays", patterns: [/delay/i, /late/i, /miss(ed)? (the )?target/i, /slow/i] },
];

export function classifyAnalystQuestion(question: string): AnalystIntent {
  for (const intent of INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(question))) return intent.id;
  }
  return "unknown";
}

export function localAnalystAnswer(
  question: string,
  snapshot: InsightsSnapshot,
): string {
  const intent = classifyAnalystQuestion(question);

  switch (intent) {
    case "risk": {
      const top = snapshot.topRiskCases[0];
      if (!top) return "No delay-risk predictions are available in the synthetic dataset.";
      const factor = top.factors[0];
      return `The highest predicted delay risk in the synthetic history is ${top.caseId} at an estimated ${(top.probability * 100).toFixed(0)}%, driven most by ${factor?.label ?? "unknown factors"}. This is a model estimate from synthetic data, not a certainty.`;
    }
    case "factor": {
      const top = snapshot.delayRiskModel.topFactors[0];
      if (!top) return "No model factor importances are available.";
      const strongestInsight = snapshot.insights[0];
      return `The strongest model factor is ${top.label} (importance ${top.importance.toFixed(2)}). The largest observed association is: ${strongestInsight?.title ?? "no insight available"}`;
    }
    case "anomaly": {
      const top = snapshot.anomalies[0];
      if (!top) return "No workflows in the synthetic dataset exceeded the anomaly threshold.";
      return `The largest anomaly is ${top.caseId}: ${top.driverLabel} was ${top.value.toFixed(1)} against a synthetic baseline of ${top.baseline.toFixed(1)} (z = ${top.zScore.toFixed(1)}).`;
    }
    case "patterns": {
      const parts = snapshot.clusters
        .slice(0, 4)
        .map((cluster) => `${cluster.description} (${(cluster.share * 100).toFixed(0)}%, ${cluster.size} cases)`);
      return `The synthetic history groups into: ${parts.join("; ")}.`;
    }
    case "compare": {
      const complete = snapshot.charts.missingVsDelay[0];
      const incomplete = snapshot.charts.missingVsDelay[1];
      if (!complete || !incomplete) return "The complete-versus-incomplete comparison is unavailable.";
      return `Measurement-complete cases show a ${percent(complete.value)} delay rate (${complete.count} cases) versus ${percent(incomplete.value)} for incomplete cases (${incomplete.count} cases) in the synthetic history.`;
    }
    case "first": {
      const top = snapshot.insights[0];
      if (!top) return "No computed insights are available to prioritise.";
      return `Investigate first: ${top.title} Relevant queue groups: ${top.workflowGroups.join(", ") || "none mapped"}.`;
    }
    case "delays":
    default: {
      const top = snapshot.insights[0];
      if (!top) {
        return `I can only answer from the synthetic historical analytics dataset, which contains ${snapshot.dataset.casesAnalyzed} generated records. I do not have a computed insight for that question.`;
      }
      return `${top.title} (${top.withCount} versus ${top.withoutCount} synthetic records.)`;
    }
  }
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

export async function askAnalyst(options: {
  question: string;
  snapshot: InsightsSnapshot;
  history?: ChatMessage[];
  fetchImpl?: typeof fetch;
}): Promise<AnalystResult> {
  const messages = buildAnalystMessages(
    options.question,
    options.snapshot,
    options.history ?? [],
  );

  try {
    const text = await requestText(messages, options.fetchImpl);
    if (text && checkGrounded(text, options.snapshot.allowedNumbers).ok) {
      return { text, source: "deepseek" };
    }
  } catch {
    // fall through to the deterministic grounded answer
  }

  return { text: localAnalystAnswer(options.question, options.snapshot), source: "local" };
}
