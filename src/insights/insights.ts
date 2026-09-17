import type { HistoricalRecord, Insight, InsightUnit } from "./types.ts";
import type { QueueGroup } from "../engine/types.ts";
import { mean } from "./metrics.ts";

const SUPPORT_LIMIT = 40;
const MIN_GROUP = 60;

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function delayRate(records: HistoricalRecord[]): number {
  if (records.length === 0) return 0;
  return records.filter((record) => record.missed_target).length / records.length;
}

function incompletenessRate(records: HistoricalRecord[]): number {
  if (records.length === 0) return 0;
  return records.filter((record) => !record.measurement_complete).length / records.length;
}

function contactHours(records: HistoricalRecord[]): number {
  return mean(records.map((record) => record.hours_to_customer_contact));
}

type Candidate = {
  id: string;
  factorLabel: string;
  withLabel: string;
  withoutLabel: string;
  unit: InsightUnit;
  metricLabel: string;
  minDifference: number;
  workflowGroups: QueueGroup[];
  test: (record: HistoricalRecord) => boolean;
  outcome: (records: HistoricalRecord[]) => number;
  support: (withRecords: HistoricalRecord[]) => HistoricalRecord[];
  title: (withValue: number, withoutValue: number) => string;
};

const CANDIDATES: Candidate[] = [
  {
    id: "measurement",
    factorLabel: "Incomplete measurements",
    withLabel: "Incomplete measurement",
    withoutLabel: "complete measurement",
    unit: "rate",
    metricLabel: "delay rate",
    minDifference: 0.03,
    workflowGroups: ["Missing evidence"],
    test: (record) => !record.measurement_complete,
    outcome: delayRate,
    support: (records) => records.filter((record) => record.missed_target),
    title: (withValue, withoutValue) =>
      `Incomplete measurements are associated with delayed offers: a ${pct(withValue)} delay rate versus ${pct(withoutValue)} when measurements are complete.`,
  },
  {
    id: "correction",
    factorLabel: "Technician corrections",
    withLabel: "Technician correction",
    withoutLabel: "no correction",
    unit: "rate",
    metricLabel: "incomplete-evidence rate",
    minDifference: 0.05,
    workflowGroups: ["Awaiting technician", "Missing evidence"],
    test: (record) => record.technician_correction,
    outcome: incompletenessRate,
    support: (records) => records.filter((record) => !record.measurement_complete),
    title: (withValue, withoutValue) =>
      `Technician corrections are concentrated in incomplete inspection records: ${pct(withValue)} of corrected cases had missing measurements versus ${pct(withoutValue)} of uncorrected cases.`,
  },
  {
    id: "stock",
    factorLabel: "Stock unconfirmed",
    withLabel: "unconfirmed stock",
    withoutLabel: "confirmed stock",
    unit: "hours",
    metricLabel: "average time to customer contact",
    minDifference: 4,
    workflowGroups: ["Awaiting stock"],
    test: (record) => !record.stock_confirmed,
    outcome: contactHours,
    support: (records) => records,
    title: (withValue, withoutValue) =>
      `Cases waiting for stock confirmation have longer customer-contact times: ${withValue.toFixed(1)} h on average versus ${withoutValue.toFixed(1)} h when stock is confirmed.`,
  },
  {
    id: "contact",
    factorLabel: "Contact unavailable",
    withLabel: "unavailable contact",
    withoutLabel: "available contact",
    unit: "rate",
    metricLabel: "delay rate",
    minDifference: 0.03,
    workflowGroups: ["Missing evidence"],
    test: (record) => !record.contact_available,
    outcome: delayRate,
    support: (records) => records.filter((record) => record.missed_target),
    title: (withValue, withoutValue) =>
      `Cases with unavailable customer contact show a ${pct(withValue)} delay rate versus ${pct(withoutValue)} when contact is available.`,
  },
  {
    id: "appointment",
    factorLabel: "Appointment within 2 days",
    withLabel: "appointment within 2 days",
    withoutLabel: "more lead time",
    unit: "rate",
    metricLabel: "delay rate",
    minDifference: 0.03,
    workflowGroups: ["Urgent"],
    test: (record) => record.appointment_days_ahead <= 2,
    outcome: delayRate,
    support: (records) => records.filter((record) => record.missed_target),
    title: (withValue, withoutValue) =>
      `Cases whose appointment is within 2 days show a ${pct(withValue)} delay rate versus ${pct(withoutValue)} with more lead time.`,
  },
];

function strength(unit: InsightUnit, difference: number): number {
  return unit === "hours" ? Math.abs(difference) / 24 : Math.abs(difference);
}

export function buildInsights(records: HistoricalRecord[]): Insight[] {
  const insights: Array<{ insight: Insight; strength: number }> = [];

  for (const candidate of CANDIDATES) {
    const withRecords = records.filter(candidate.test);
    const withoutRecords = records.filter((record) => !candidate.test(record));
    if (withRecords.length < MIN_GROUP || withoutRecords.length < MIN_GROUP) continue;

    const withValue = candidate.outcome(withRecords);
    const withoutValue = candidate.outcome(withoutRecords);
    const difference = withValue - withoutValue;
    if (Math.abs(difference) < candidate.minDifference) continue;

    const supporting = candidate.support(withRecords).slice(0, SUPPORT_LIMIT);

    insights.push({
      strength: strength(candidate.unit, difference),
      insight: {
        id: candidate.id,
        title: candidate.title(withValue, withoutValue),
        detail:
          `Across ${records.length.toLocaleString()} synthetic historical records, ` +
          `${withRecords.length.toLocaleString()} ${candidate.withLabel} and ` +
          `${withoutRecords.length.toLocaleString()} ${candidate.withoutLabel} were compared. ` +
          `This is an observed association in generated data, not evidence of causation.`,
        metricLabel: candidate.metricLabel,
        unit: candidate.unit,
        withValue,
        withoutValue,
        withLabel: candidate.withLabel,
        withoutLabel: candidate.withoutLabel,
        withCount: withRecords.length,
        withoutCount: withoutRecords.length,
        difference,
        supportingCaseIds: supporting.map((record) => record.case_id),
        workflowGroups: candidate.workflowGroups,
        factorLabel: candidate.factorLabel,
      },
    });
  }

  return insights
    .sort((a, b) => b.strength - a.strength)
    .map((entry) => entry.insight);
}
