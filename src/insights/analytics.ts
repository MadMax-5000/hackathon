import { detectAnomalies } from "./anomaly.ts";
import { clusterRecords } from "./clustering.ts";
import { buildInsights } from "./insights.ts";
import { buildCharts, buildMetrics } from "./metrics.ts";
import { buildDelayRiskModel } from "./model.ts";
import { SYNTHETIC_COUNT, SYNTHETIC_SEED, generateSyntheticHistory } from "./synthetic.ts";
import type { AnalyzeResult, AnalyticsData, HistoricalRecord } from "./types.ts";

export const ANALYTICS_VERSION = "insights-v1";

export type BuildOptions = {
  seed?: number;
  count?: number;
  generate?: (seed: number, count: number) => HistoricalRecord[];
};

/**
 * Build the full analytics bundle: synthetic data, delay-risk model, clusters,
 * anomalies, descriptive metrics, insights, and chart data.
 *
 * Pure and exception-safe. If the synthetic dataset cannot be produced, the
 * caller receives a failure result rather than an exception, so the operational
 * workflow is never disturbed.
 */
export function buildAnalytics(options: BuildOptions = {}): AnalyzeResult {
  try {
    const seed = options.seed ?? SYNTHETIC_SEED;
    const count = options.count ?? SYNTHETIC_COUNT;
    const generate = options.generate ?? generateSyntheticHistory;
    const records = generate(seed, count);

    if (!Array.isArray(records) || records.length === 0) {
      return { ok: false, error: "The synthetic dataset generator returned no records." };
    }

    const clusters = clusterRecords(records);
    const model = buildDelayRiskModel(records);
    const anomaly = detectAnomalies(records);
    const metrics = buildMetrics(records);
    const insights = buildInsights(records);
    const charts = buildCharts(records, clusters.summaries);

    const data: AnalyticsData = {
      version: ANALYTICS_VERSION,
      seed,
      records,
      metrics,
      model,
      clusters: clusters.summaries,
      anomalies: anomaly.anomalies,
      anomaliesAboveThreshold: anomaly.aboveThreshold,
      anomaliesScanned: anomaly.scanned,
      insights,
      charts,
    };

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

let cached: AnalyzeResult | null = null;

/** Build once per session and reuse. Never retrains on render. */
export function getAnalytics(): AnalyzeResult {
  if (!cached) cached = buildAnalytics();
  return cached;
}

export function clearAnalyticsCache(): void {
  cached = null;
}
