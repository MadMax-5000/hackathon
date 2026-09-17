import {
  DELAY_FEATURES,
  buildFeatureMatrix,
  fitStandardizer,
  standardizeRow,
} from "./features.ts";
import { createRng } from "./rng.ts";
import type { ClusterFeatureStat, ClusterSummary, HistoricalRecord } from "./types.ts";

const CLUSTERS = 4;
const ITERATIONS = 80;
const CLUSTER_SEED = 7919;

function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const diff = a[index] - b[index];
    sum += diff * diff;
  }
  return sum;
}

function kmeansPlusPlus(
  rows: number[][],
  k: number,
  next: () => number,
): number[][] {
  const centroids: number[][] = [rows[Math.floor(next() * rows.length)]];
  while (centroids.length < k) {
    const distances = rows.map((row) =>
      Math.min(...centroids.map((centroid) => squaredDistance(row, centroid))),
    );
    const total = distances.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      centroids.push(rows[Math.floor(next() * rows.length)]);
      continue;
    }
    let roll = next() * total;
    let chosen = rows.length - 1;
    for (let index = 0; index < rows.length; index += 1) {
      roll -= distances[index];
      if (roll <= 0) {
        chosen = index;
        break;
      }
    }
    centroids.push(rows[chosen]);
  }
  return centroids;
}

export type ClusterResult = {
  assignments: number[];
  centroids: number[][];
  summaries: ClusterSummary[];
};

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(records: HistoricalRecord[], predicate: (record: HistoricalRecord) => boolean): number {
  if (records.length === 0) return 0;
  return records.filter(predicate).length / records.length;
}

type ClusterProfiles = {
  meanHoursToOffer: number;
  missingRate: number;
  stockPendingRate: number;
  correctionRate: number;
  contactRate: number;
};

function profile(records: HistoricalRecord[]): ClusterProfiles {
  return {
    meanHoursToOffer: mean(records.map((record) => record.hours_to_offer)),
    missingRate: rate(records, (record) => !record.measurement_complete),
    stockPendingRate: rate(records, (record) => !record.stock_confirmed),
    correctionRate: rate(records, (record) => record.technician_correction),
    contactRate: rate(records, (record) => record.contact_available),
  };
}

/**
 * Description is derived from the measured cluster profile relative to the
 * global profile. No conclusion is hardcoded; if no deviation clears the
 * threshold the largest measured deviation names the cluster instead.
 */
function describeCluster(
  stats: ClusterProfiles,
  global: ClusterProfiles,
  topFeatures: ClusterFeatureStat[],
): string {
  const fast =
    stats.meanHoursToOffer <= global.meanHoursToOffer * 0.72 &&
    stats.correctionRate <= global.correctionRate * 0.7 &&
    stats.missingRate <= global.missingRate * 0.8;
  if (fast) return "Fast / clean workflow";

  if (stats.missingRate >= global.missingRate + 0.1) return "Missing-evidence cases";
  if (stats.stockPendingRate >= global.stockPendingRate + 0.1) return "Stock-constrained cases";
  if (stats.correctionRate >= global.correctionRate + 0.1) return "High-correction cases";

  const top = topFeatures[0];
  if (!top) return "Mixed workflow pattern";
  return top.direction === "higher"
    ? `Elevated ${top.label.toLowerCase()}`
    : `Low ${top.label.toLowerCase()}`;
}

export function clusterRecords(
  records: HistoricalRecord[],
  k: number = CLUSTERS,
): ClusterResult {
  const matrix = buildFeatureMatrix(records, DELAY_FEATURES);
  const standardizer = fitStandardizer(matrix);
  const rows = matrix.rows.map((row) => standardizeRow(standardizer, row));
  const next = createRng(CLUSTER_SEED);

  let centroids = kmeansPlusPlus(rows, k, next);
  let assignments = new Array(records.length).fill(0);

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    let changed = false;
    const nextAssignments = rows.map((row) => {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let cluster = 0; cluster < centroids.length; cluster += 1) {
        const distance = squaredDistance(row, centroids[cluster]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cluster;
        }
      }
      return best;
    });

    for (let index = 0; index < nextAssignments.length; index += 1) {
      if (nextAssignments[index] !== assignments[index]) changed = true;
    }
    assignments = nextAssignments;

    const recomputed = centroids.map((centroid, cluster) => {
      const members = rows.filter((_, index) => assignments[index] === cluster);
      if (members.length === 0) return centroid;
      return centroid.map(
        (_, column) => mean(members.map((member) => member[column])),
      );
    });
    centroids = recomputed;
    if (!changed && iteration > 0) break;
  }

  const globalProfile = profile(records);
  const usedDescriptions = new Set<string>();

  const summaries: ClusterSummary[] = centroids.map((_, cluster) => {
    const memberRecords = records.filter((_, index) => assignments[index] === cluster);
    const stats = profile(memberRecords);

    const topFeatures: ClusterFeatureStat[] = matrix.labels
      .map((label, column) => {
        const clusterMean = mean(memberRecords.map((record) => DELAY_FEATURES[column].value(record)));
        const globalMean = mean(records.map((record) => DELAY_FEATURES[column].value(record)));
        const deviation = Math.abs(clusterMean - globalMean) / (standardizer.stds[column] || 1);
        return {
          label,
          mean: clusterMean,
          globalMean,
          direction: (clusterMean >= globalMean ? "higher" : "lower") as "higher" | "lower",
          deviation,
        };
      })
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 3)
      .map(({ label, mean: value, globalMean, direction }) => ({
        label,
        mean: value,
        globalMean,
        direction,
      }));

    let description = describeCluster(stats, globalProfile, topFeatures);
    if (usedDescriptions.has(description)) description = `${description} (cluster ${cluster + 1})`;
    usedDescriptions.add(description);

    return {
      id: cluster,
      size: memberRecords.length,
      share: records.length === 0 ? 0 : memberRecords.length / records.length,
      description,
      topFeatures,
      exampleCaseIds: memberRecords.slice(0, 5).map((record) => record.case_id),
    };
  });

  return { assignments, centroids, summaries: summaries.sort((a, b) => b.size - a.size) };
}
