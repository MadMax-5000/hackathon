import type { Anomaly, HistoricalRecord } from "./types.ts";

type AnomalyField = {
  label: string;
  value: (record: HistoricalRecord) => number;
};

const FIELDS: AnomalyField[] = [
  {
    label: "Time from inspection to offer",
    value: (record) => record.hours_to_offer,
  },
  {
    label: "Time from inspection to customer contact",
    value: (record) => record.hours_to_customer_contact,
  },
  {
    label: "Delay beyond target",
    value: (record) => record.delay_hours,
  },
  {
    label: "Contact lag after offer",
    value: (record) => record.hours_to_customer_contact - record.hours_to_offer,
  },
];

export type AnomalyResult = {
  anomalies: Anomaly[];
  aboveThreshold: number;
  scanned: number;
};

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], average: number): number {
  if (values.length === 0) return 1;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return sd < 1e-9 ? 1 : sd;
}

export function detectAnomalies(
  records: HistoricalRecord[],
  options: { threshold?: number; limit?: number } = {},
): AnomalyResult {
  const threshold = options.threshold ?? 3;
  const limit = options.limit ?? 12;

  const baselines = FIELDS.map((field) => {
    const values = records.map((record) => field.value(record));
    const average = mean(values);
    return { field, average, sd: stdDev(values, average) };
  });

  const scored: Array<Anomaly & { absolute: number }> = [];

  for (const record of records) {
    let driver = baselines[0];
    let maxZ = 0;
    for (const baseline of baselines) {
      const z = Math.abs((baseline.field.value(record) - baseline.average) / baseline.sd);
      if (z > maxZ) {
        maxZ = z;
        driver = baseline;
      }
    }

    if (maxZ < threshold) continue;

    const value = driver.field.value(record);
    const context: string[] = [];
    if (!record.stock_confirmed) context.push("stock was unconfirmed");
    if (record.technician_correction) context.push("a technician correction was recorded");
    if (!record.measurement_complete) context.push("measurement was incomplete");

    scored.push({
      caseId: record.case_id,
      driverLabel: driver.field.label,
      zScore: maxZ,
      value,
      baseline: driver.average,
      detail:
        `${driver.field.label} was ${value.toFixed(1)} h against a synthetic average of ` +
        `${driver.average.toFixed(1)} h (z = ${maxZ.toFixed(1)})` +
        (context.length > 0 ? `; ${context.join(", ")}.` : "."),
      absolute: maxZ,
    });
  }

  scored.sort((a, b) => b.absolute - a.absolute);

  return {
    anomalies: scored.slice(0, limit).map(({ absolute: _absolute, ...anomaly }) => anomaly),
    aboveThreshold: scored.length,
    scanned: records.length,
  };
}
