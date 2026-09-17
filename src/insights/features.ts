import type { FeatureSpec, HistoricalRecord, Standardizer } from "./types.ts";

export const DELAY_FEATURES: FeatureSpec[] = [
  {
    name: "measurement_complete",
    label: "Measurement complete",
    value: (record) => (record.measurement_complete ? 1 : 0),
  },
  {
    name: "stock_confirmed",
    label: "Stock confirmed",
    value: (record) => (record.stock_confirmed ? 1 : 0),
  },
  {
    name: "contact_available",
    label: "Contact available",
    value: (record) => (record.contact_available ? 1 : 0),
  },
  {
    name: "technician_correction",
    label: "Technician correction",
    value: (record) => (record.technician_correction ? 1 : 0),
  },
  {
    name: "review_task_created",
    label: "Review task created",
    value: (record) => (record.review_task_created ? 1 : 0),
  },
  {
    name: "front_flagged",
    label: "Front flagged",
    value: (record) => (record.front_flagged ? 1 : 0),
  },
  {
    name: "rear_flagged",
    label: "Rear flagged",
    value: (record) => (record.rear_flagged ? 1 : 0),
  },
  {
    name: "appointment_imminent",
    label: "Appointment within 2 days",
    value: (record) => (record.appointment_days_ahead <= 2 ? 1 : 0),
  },
  {
    name: "appointment_days_ahead",
    label: "Days until appointment",
    value: (record) => record.appointment_days_ahead,
  },
];

export type FeatureMatrix = {
  names: string[];
  labels: string[];
  rows: number[][];
};

export function buildFeatureMatrix(
  records: HistoricalRecord[],
  specs: FeatureSpec[] = DELAY_FEATURES,
): FeatureMatrix {
  return {
    names: specs.map((spec) => spec.name),
    labels: specs.map((spec) => spec.label),
    rows: records.map((record) => specs.map((spec) => spec.value(record))),
  };
}

export function fitStandardizer(matrix: FeatureMatrix): Standardizer {
  const { rows, names, labels } = matrix;
  const means = names.map((_, column) => {
    const sum = rows.reduce((total, row) => total + row[column], 0);
    return rows.length === 0 ? 0 : sum / rows.length;
  });
  const stds = names.map((_, column) => {
    const variance =
      rows.reduce((total, row) => total + (row[column] - means[column]) ** 2, 0) /
      Math.max(1, rows.length);
    const sd = Math.sqrt(variance);
    return sd < 1e-9 ? 1 : sd;
  });
  return { featureNames: names, featureLabels: labels, means, stds };
}

export function standardizeRow(standardizer: Standardizer, row: number[]): number[] {
  return row.map(
    (value, column) => (value - standardizer.means[column]) / standardizer.stds[column],
  );
}

export type Split = {
  train: number[];
  test: number[];
};

/**
 * Deterministic index split. Uses a fixed modular stride so the split is stable
 * regardless of platform and does not depend on Math.random.
 */
export function deterministicSplit(
  total: number,
  trainRatio = 0.8,
  stride = 7,
): Split {
  const train: number[] = [];
  const test: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (index % stride === 0) test.push(index);
    else train.push(index);
  }
  // Guarantee the requested ratio by moving the overflow back into train.
  const targetTest = Math.round(total * (1 - trainRatio));
  while (test.length > targetTest) {
    const moved = test.pop();
    if (moved !== undefined) train.push(moved);
  }
  while (test.length < targetTest) {
    const moved = train.pop();
    if (moved !== undefined) test.push(moved);
  }
  train.sort((a, b) => a - b);
  test.sort((a, b) => a - b);
  return { train, test };
}
