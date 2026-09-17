import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SYNTHETIC_COUNT, generateSyntheticHistory } from "../src/insights/synthetic.ts";
import { buildAnalytics, getAnalytics, clearAnalyticsCache } from "../src/insights/analytics.ts";
import {
  buildSnapshot,
  askAnalyst,
  localAnalystAnswer,
  classifyAnalystQuestion,
} from "../src/insights/ai/analyst.ts";
import {
  buildInsightEvidence,
  explainInsight,
  localExplanation,
} from "../src/insights/ai/client.ts";
import { checkGrounded } from "../src/insights/ai/guardrail.ts";
import { makeReporter } from "./harness.mjs";

const { check, finish } = makeReporter("INSIGHTS ANALYTICS");
const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_COUNT = 1200;
const REAL_IDS = new Set(
  JSON.parse(readFileSync(resolve(__dirname, "../src/data/initial.json"), "utf8")).wheel_sets.map(
    (wheel) => wheel.id,
  ),
);

function fakeFetch(text) {
  return async () => ({ ok: true, json: async () => ({ text }) });
}

console.log("\n[1] Deterministic synthetic dataset generation");
{
  const first = buildAnalytics({ count: TEST_COUNT });
  const second = buildAnalytics({ count: TEST_COUNT });
  check("1a  build succeeds", first.ok && second.ok);
  const a = first.ok ? first.data : null;
  const b = second.ok ? second.data : null;
  check("1b  records are identical", JSON.stringify(a.records) === JSON.stringify(b.records));
  check(
    "1c  model predictions are identical",
    JSON.stringify(a.model.topRisks) === JSON.stringify(b.model.topRisks),
  );
  check(
    "1d  default dataset size is 2000-5000",
    SYNTHETIC_COUNT >= 2000 && SYNTHETIC_COUNT <= 5000,
    String(SYNTHETIC_COUNT),
  );
  check("1e  generated count matches requested", a.records.length === TEST_COUNT);
  const ids = new Set(a.records.map((record) => record.case_id));
  check("1f  record ids are unique", ids.size === a.records.length);

  const fields = [
    "case_id",
    "issue_type",
    "tyre_size",
    "front_flagged",
    "rear_flagged",
    "measurement_complete",
    "contact_available",
    "stock_confirmed",
    "appointment_days_ahead",
    "hours_to_offer",
    "hours_to_customer_contact",
    "technician_correction",
    "offer_approved",
    "offer_rejected",
    "customer_contacted",
    "contact_channel",
    "review_task_created",
    "workflow_completed",
    "missed_target",
    "delay_hours",
  ];
  const sample = a.records[0];
  check(
    "1g  record carries every documented field",
    fields.every((field) => field in sample),
    fields.filter((field) => !(field in sample)).join(", "),
  );
  check("1h  no record carries a live C03 id", a.records.every((record) => !REAL_IDS.has(record.case_id)));
}

console.log("\n[2] Model input/output shape");
{
  const result = buildAnalytics({ count: TEST_COUNT });
  const model = result.data.model;
  const prediction = model.prediction;
  check("2a  a flagship prediction exists", Boolean(prediction));
  check(
    "2b  probability is in [0,1]",
    prediction.probability >= 0 && prediction.probability <= 1,
    String(prediction.probability),
  );
  check(
    "2c  label is high or low delay risk",
    prediction.label === "High delay risk" || prediction.label === "Low delay risk",
    prediction.label,
  );
  check("2d  exactly three contributing factors", prediction.factors.length === 3);
  check(
    "2e  factors are ordered by contribution",
    prediction.factors[0].contribution >= prediction.factors[1].contribution &&
      prediction.factors[1].contribution >= prediction.factors[2].contribution,
  );
  check("2f  top risks are sorted descending", model.topRisks.every((risk, index, list) => index === 0 || list[index - 1].probability >= risk.probability));
  check(
    "2g  evaluation metrics are in range",
    [model.evaluation.accuracy, model.evaluation.precision, model.evaluation.recall, model.evaluation.auc].every(
      (value) => value >= 0 && value <= 1,
    ),
  );
  check("2h  global importance is present", model.globalImportance.length === 6);
}

console.log("\n[3] Insight calculations match recomputation over the dataset");
{
  const result = buildAnalytics({ count: TEST_COUNT });
  const { records, insights } = result.data;
  check("3a  at least three insights were derived", insights.length >= 3, String(insights.length));

  const measurement = insights.find((insight) => insight.id === "measurement");
  const incomplete = records.filter((record) => !record.measurement_complete);
  const complete = records.filter((record) => record.measurement_complete);
  const delayRate = (rows) => rows.filter((row) => row.missed_target).length / rows.length;
  check("3b  measurement with-rate matches recomputation", Math.abs(measurement.withValue - delayRate(incomplete)) < 1e-9);
  check("3c  measurement without-rate matches recomputation", Math.abs(measurement.withoutValue - delayRate(complete)) < 1e-9);
  check("3d  measurement counts match", measurement.withCount === incomplete.length && measurement.withoutCount === complete.length);

  const byId = new Set(records.map((record) => record.case_id));
  check(
    "3e  supporting ids all exist in the synthetic dataset",
    insights.every((insight) => insight.supportingCaseIds.every((id) => byId.has(id))),
  );
  check(
    "3f  insight rates stay in range",
    insights.filter((insight) => insight.unit === "rate").every((insight) => insight.withValue >= 0 && insight.withValue <= 1 && insight.withoutValue >= 0 && insight.withoutValue <= 1),
  );
  check(
    "3g  support is capped at 40 records",
    insights.every((insight) => insight.supportingCaseIds.length <= 40),
  );
}

console.log("\n[4] Clusters and anomalies are computed, not hardcoded");
{
  const result = buildAnalytics({ count: TEST_COUNT });
  const { clusters, anomalies, anomaliesAboveThreshold, anomaliesScanned } = result.data;
  check("4a  four clusters returned", clusters.length === 4);
  check("4b  every cluster has a description", clusters.every((cluster) => cluster.description.length > 0));
  check("4c  cluster sizes sum to the dataset", clusters.reduce((sum, cluster) => sum + cluster.size, 0) === TEST_COUNT);
  check(
    "4d  cluster top features carry measured values",
    clusters.every((cluster) =>
      cluster.topFeatures.every((feature) => Number.isFinite(feature.mean) && Number.isFinite(feature.globalMean)),
    ),
  );
  check("4e  anomaly scan covers the dataset", anomaliesScanned === TEST_COUNT);
  check("4f  anomaly count is not negative", anomaliesAboveThreshold >= 0);
  check(
    "4g  returned anomalies all clear the threshold",
    anomalies.every((anomaly) => anomaly.zScore >= 3),
  );
}

console.log("\n[5] Synthetic historical data never mixes with initial C03 cases");
{
  const importPattern = /(?:from|require\s*\()\s*["'][^"']*initial\.json["']/;
  const source = readFileSync(resolve(__dirname, "../src/insights/synthetic.ts"), "utf8");
  check("5a  synthetic generator does not import initial.json", !importPattern.test(source));
  const records = generateSyntheticHistory(1, 200);
  check("5b  every generated id uses the HIST namespace", records.every((record) => record.case_id.startsWith("HIST-")));
  check("5c  no generated id collides with a live C03 case", records.every((record) => !REAL_IDS.has(record.case_id)));
  const analystSource = readFileSync(resolve(__dirname, "../src/insights/ai/analyst.ts"), "utf8");
  check("5d  analytics modules never read the live workspace", !importPattern.test(analystSource));
}

console.log("\n[6] AI explanation grounding");
{
  const result = buildAnalytics({ count: TEST_COUNT });
  const insight = result.data.insights[0];
  const evidence = buildInsightEvidence(insight, result.data.metrics);

  check("6a  grounded explanation passes", checkGrounded("The delay rate was " + (insight.withValue * 100).toFixed(1) + "%.", evidence.allowedNumbers).ok);
  check("6b  invented number is rejected", checkGrounded("The delay rate was 91.7%.", evidence.allowedNumbers).ok === false);
  check("6c  commercial content is rejected", checkGrounded("The price is 100.", evidence.allowedNumbers).ok === false);
  check("6d  causation claim is rejected", checkGrounded("Missing evidence causes delays.", evidence.allowedNumbers).ok === false);
  check("6e  real-data claim is rejected", checkGrounded("This reflects real dealership performance.", evidence.allowedNumbers).ok === false);

  const fallback = await explainInsight({
    insight,
    metrics: result.data.metrics,
    fetchImpl: async () => ({ ok: true, json: async () => ({ text: "The delay rate was 91.7%." }) }),
  });
  check("6f  hallucinated model reply falls back to local", fallback.source === "local");
  check("6g  local explanation covers the five points", ["What we observed", "Evidence", "Why it matters", "What to investigate next", "Limitation"].every((section) => localExplanation(insight, result.data.metrics).includes(section)));
  check("6h  local explanation states association not causation", /association, not causation/i.test(localExplanation(insight, result.data.metrics)));

  const valid = await explainInsight({
    insight,
    metrics: result.data.metrics,
    fetchImpl: fakeFetch("What we observed: " + insight.title + " Evidence: the delay rate was " + (insight.withValue * 100).toFixed(1) + "%."),
  });
  check("6i  grounded model reply is used", valid.source === "deepseek");
}

console.log("\n[7] Ask Insights AI is grounded and admits its limits");
{
  const result = buildAnalytics({ count: TEST_COUNT });
  const snapshot = buildSnapshot(result.data);

  check("7a  delay question classifies as delays", classifyAnalystQuestion("What is causing the most delays?") === "delays" || classifyAnalystQuestion("What is causing the most delays?") === "factor");
  check("7b  risk question classifies as risk", classifyAnalystQuestion("Which cases are most at risk?") === "risk");
  check("7c  patterns question classifies as patterns", classifyAnalystQuestion("What patterns do you see?") === "patterns");
  check("7d  anomaly question classifies as anomaly", classifyAnalystQuestion("Explain the biggest anomaly.") === "anomaly");

  const localRisk = localAnalystAnswer("Which cases are most at risk?", snapshot);
  check("7e  local risk answer names a synthetic case", /HIST-/.test(localRisk));
  check("7f  local answer labels the data synthetic or a model estimate", /synthetic|estimate/i.test(localRisk));

  const grounded = await askAnalyst({
    question: "What is causing the most delays?",
    snapshot,
    fetchImpl: fakeFetch("The delay rate was " + (result.data.metrics.delayRate * 100).toFixed(1) + "% in the synthetic data."),
  });
  check("7g  grounded analyst reply used", grounded.source === "deepseek");

  const hallucinated = await askAnalyst({
    question: "What is causing the most delays?",
    snapshot,
    fetchImpl: fakeFetch("Delays are caused by 77.7% of cases."),
  });
  check("7h  hallucinated analyst reply falls back to local", hallucinated.source === "local");

  const offline = await askAnalyst({
    question: "What is the weather today?",
    snapshot,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  check("7i  out-of-scope question states the data limit", /can only answer|do not have|synthetic/i.test(offline.text));
}

console.log("\n[8] Graceful failure when analytics are unavailable");
{
  const exploded = buildAnalytics({
    count: TEST_COUNT,
    generate: () => {
      throw new Error("generator exploded");
    },
  });
  check("8a  a throwing generator returns a failure result", exploded.ok === false);
  check("8b  the failure carries a message", exploded.ok === false && exploded.error.includes("generator exploded"));

  const empty = buildAnalytics({ count: 0, generate: () => [] });
  check("8c  an empty dataset returns a failure result", empty.ok === false);
}

console.log("\n[9] Analytics are cached and never retrain on read");
{
  clearAnalyticsCache();
  const first = getAnalytics();
  const second = getAnalytics();
  check("9a  repeated reads return the same object", first === second);
  clearAnalyticsCache();
  const third = getAnalytics();
  check("9b  clearing the cache rebuilds", third !== first);
}

console.log("\n[10] Chart data shapes for the visuals");
{
  const { charts } = buildAnalytics({ count: TEST_COUNT }).data;
  check("10a  outcome donut includes an approved segment", charts.outcomes.some((datum) => datum.label === "Approved"));
  check("10b  lead-time trend has ordered buckets", charts.delayByLeadTime.length >= 4);
  check("10c  histogram has six bins", charts.timeToOfferHistogram.length === 6);
  check(
    "10d  scatter points carry finite coordinates",
    charts.scatter.length > 0 && charts.scatter.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  );
  check(
    "10e  scatter marks stock state",
    charts.scatter.every((point) => typeof point.stockConfirmed === "boolean"),
  );
  check(
    "10f  cluster donut sums to the dataset",
    charts.clusterDistribution.reduce((total, datum) => total + datum.count, 0) === TEST_COUNT,
  );
}

process.exit(finish());
