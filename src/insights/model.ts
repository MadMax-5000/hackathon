import {
  DELAY_FEATURES,
  buildFeatureMatrix,
  deterministicSplit,
  fitStandardizer,
  standardizeRow,
  type FeatureMatrix,
} from "./features.ts";
import type {
  DelayRiskModel,
  FeatureImportance,
  HistoricalRecord,
  ModelEvaluation,
  RiskContribution,
  RiskPrediction,
  Standardizer,
} from "./types.ts";

export type TrainedModel = {
  standardizer: Standardizer;
  weights: number[];
  bias: number;
};

export type TrainOptions = {
  epochs?: number;
  learningRate?: number;
  l2?: number;
};

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

function dot(weights: number[], row: number[]): number {
  let sum = 0;
  for (let index = 0; index < weights.length; index += 1) sum += weights[index] * row[index];
  return sum;
}

/**
 * Deterministic logistic regression over standardized features. Small,
 * explainable, and reproducible: zero-initialised weights, fixed epochs, L2.
 */
export function trainLogistic(
  matrix: FeatureMatrix,
  labels: number[],
  trainIndices: number[],
  options: TrainOptions = {},
): TrainedModel {
  const epochs = options.epochs ?? 320;
  const learningRate = options.learningRate ?? 0.35;
  const l2 = options.l2 ?? 0.01;
  const standardizer = fitStandardizer(matrix);
  const featureCount = matrix.names.length;

  const rows = trainIndices.map((index) => standardizeRow(standardizer, matrix.rows[index]));
  const targets = trainIndices.map((index) => labels[index]);
  const sampleCount = rows.length;

  const weights = new Array(featureCount).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = new Array(featureCount).fill(0);
    let gradB = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const prediction = sigmoid(dot(weights, rows[i]) + bias);
      const error = prediction - targets[i];
      for (let j = 0; j < featureCount; j += 1) gradW[j] += error * rows[i][j];
      gradB += error;
    }
    for (let j = 0; j < featureCount; j += 1) {
      const gradient = gradW[j] / sampleCount + l2 * weights[j];
      weights[j] -= learningRate * gradient;
    }
    bias -= learningRate * (gradB / sampleCount);
  }

  return { standardizer, weights, bias };
}

export function predictRecord(
  model: TrainedModel,
  record: HistoricalRecord,
  topN = 3,
): RiskPrediction {
  const raw = DELAY_FEATURES.map((spec) => spec.value(record));
  const normalized = standardizeRow(model.standardizer, raw);
  const z = dot(model.weights, normalized) + model.bias;
  const probability = sigmoid(z);

  const contributions: RiskContribution[] = model.standardizer.featureLabels.map(
    (label, index) => ({
      label,
      value: raw[index],
      contribution: model.weights[index] * normalized[index],
    }),
  );
  const factors = contributions
    .slice()
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, topN);

  return {
    caseId: record.case_id,
    probability,
    label: probability >= 0.5 ? "High delay risk" : "Low delay risk",
    factors,
  };
}

export function featureImportance(model: TrainedModel): FeatureImportance[] {
  return model.standardizer.featureLabels
    .map((label, index) => ({ label, importance: Math.abs(model.weights[index]) }))
    .sort((a, b) => b.importance - a.importance);
}

function aucScore(scores: number[], labels: number[]): number {
  const positives = labels.filter((label) => label === 1).length;
  const negatives = labels.length - positives;
  if (positives === 0 || negatives === 0) return 0.5;

  const ranked = scores
    .map((score, index) => ({ score, label: labels[index] }))
    .sort((a, b) => a.score - b.score);

  let rank = 1;
  let positiveRankSum = 0;
  let index = 0;
  while (index < ranked.length) {
    let end = index;
    while (end + 1 < ranked.length && ranked[end + 1].score === ranked[index].score) {
      end += 1;
    }
    const averageRank = (rank + (rank + (end - index))) / 2;
    for (let cursor = index; cursor <= end; cursor += 1) {
      if (ranked[cursor].label === 1) positiveRankSum += averageRank;
    }
    rank += end - index + 1;
    index = end + 1;
  }

  return (positiveRankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

export function evaluateModel(
  model: TrainedModel,
  records: HistoricalRecord[],
  testIndices: number[],
): ModelEvaluation {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  const scores: number[] = [];
  const labels: number[] = [];

  for (const index of testIndices) {
    const prediction = predictRecord(model, records[index]);
    const actual = records[index].missed_target ? 1 : 0;
    const predicted = prediction.probability >= 0.5 ? 1 : 0;
    scores.push(prediction.probability);
    labels.push(actual);
    if (predicted === 1 && actual === 1) truePositive += 1;
    else if (predicted === 1 && actual === 0) falsePositive += 1;
    else if (predicted === 0 && actual === 1) falseNegative += 1;
    else trueNegative += 1;
  }

  const total = testIndices.length || 1;
  const precisionDenominator = truePositive + falsePositive;
  const recallDenominator = truePositive + falseNegative;
  const positiveRate = labels.reduce((sum, label) => sum + label, 0) / total;

  return {
    trainSize: records.length - testIndices.length,
    testSize: testIndices.length,
    accuracy: (truePositive + trueNegative) / total,
    precision: precisionDenominator === 0 ? 0 : truePositive / precisionDenominator,
    recall: recallDenominator === 0 ? 0 : truePositive / recallDenominator,
    auc: aucScore(scores, labels),
    baseRate: positiveRate,
  };
}

export function buildDelayRiskModel(
  records: HistoricalRecord[],
  topRiskCount = 8,
): DelayRiskModel {
  const matrix = buildFeatureMatrix(records);
  const labels = records.map((record) => (record.missed_target ? 1 : 0));
  const split = deterministicSplit(records.length);
  const model = trainLogistic(matrix, labels, split.train);
  const evaluation = evaluateModel(model, records, split.test);
  const predictions = records.map((record) => predictRecord(model, record));
  const topRisks = predictions
    .slice()
    .sort((a, b) => b.probability - a.probability)
    .slice(0, topRiskCount);

  return {
    prediction: topRisks[0],
    topRisks,
    globalImportance: featureImportance(model).slice(0, 6),
    evaluation,
  };
}
