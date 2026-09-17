import type {
  ChartDatum,
  ClusterSummary,
  DescriptiveMetrics,
  HistoricalRecord,
  InsightsCharts,
  IssueType,
} from "./types.ts";

const ISSUE_ORDER: IssueType[] = ["puncture", "wear", "valve", "pressure", "sidewall"];

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(records: HistoricalRecord[], predicate: (record: HistoricalRecord) => boolean): number {
  if (records.length === 0) return 0;
  return records.filter(predicate).length / records.length;
}

export function buildMetrics(records: HistoricalRecord[]): DescriptiveMetrics {
  const offerPopulation = records.filter(
    (record) => record.front_flagged || record.rear_flagged,
  );
  const delayCount = records.filter((record) => record.missed_target).length;

  return {
    casesAnalyzed: records.length,
    offerPopulation: offerPopulation.length,
    avgHoursToOffer: mean(records.map((record) => record.hours_to_offer)),
    avgHoursToContact: mean(records.map((record) => record.hours_to_customer_contact)),
    approvalRate: rate(offerPopulation, (record) => record.offer_approved),
    rejectionRate: rate(offerPopulation, (record) => record.offer_rejected),
    missingEvidenceRate: rate(records, (record) => !record.measurement_complete),
    stockDelayRate: rate(records, (record) => !record.stock_confirmed),
    casesWithDelays: delayCount,
    delayRate: records.length === 0 ? 0 : delayCount / records.length,
    reviewTaskRate: rate(records, (record) => record.review_task_created),
    contactedRate: rate(records, (record) => record.customer_contacted),
  };
}

export function buildCharts(
  records: HistoricalRecord[],
  clusters: ClusterSummary[],
): InsightsCharts {
  const complete = records.filter((record) => record.measurement_complete);
  const incomplete = records.filter((record) => !record.measurement_complete);
  const confirmed = records.filter((record) => record.stock_confirmed);
  const unconfirmed = records.filter((record) => !record.stock_confirmed);

  const delayRateByIssueType: ChartDatum[] = ISSUE_ORDER.map((issue) => {
    const issueRecords = records.filter((record) => record.issue_type === issue);
    return {
      label: issue,
      value: rate(issueRecords, (record) => record.missed_target),
      count: issueRecords.length,
    };
  }).filter((datum) => datum.count > 0);

  const missingVsDelay: ChartDatum[] = [
    {
      label: "Measurement complete",
      value: rate(complete, (record) => record.missed_target),
      count: complete.length,
    },
    {
      label: "Measurement incomplete",
      value: rate(incomplete, (record) => record.missed_target),
      count: incomplete.length,
    },
  ];

  const stockVsContact: ChartDatum[] = [
    {
      label: "Stock confirmed",
      value: mean(confirmed.map((record) => record.hours_to_customer_contact)),
      count: confirmed.length,
    },
    {
      label: "Stock unconfirmed",
      value: mean(unconfirmed.map((record) => record.hours_to_customer_contact)),
      count: unconfirmed.length,
    },
  ];

  const clusterDistribution: ChartDatum[] = clusters.map((cluster) => ({
    label: cluster.description,
    value: cluster.share,
    count: cluster.size,
  }));

  const offerPopulation = records.filter(
    (record) => record.front_flagged || record.rear_flagged,
  );

  const outcomes: ChartDatum[] = [
    {
      label: "Approved",
      value: offerPopulation.filter((record) => record.offer_approved).length,
      count: offerPopulation.filter((record) => record.offer_approved).length,
    },
    {
      label: "Rejected",
      value: offerPopulation.filter((record) => record.offer_rejected).length,
      count: offerPopulation.filter((record) => record.offer_rejected).length,
    },
    {
      label: "Awaiting decision",
      value: offerPopulation.filter(
        (record) => !record.offer_approved && !record.offer_rejected,
      ).length,
      count: offerPopulation.filter(
        (record) => !record.offer_approved && !record.offer_rejected,
      ).length,
    },
  ].filter((datum) => datum.count > 0);

  const leadBuckets: Array<{ label: string; test: (days: number) => boolean }> = [
    { label: "1 day", test: (days) => days === 1 },
    { label: "2 days", test: (days) => days === 2 },
    { label: "3-4 days", test: (days) => days >= 3 && days <= 4 },
    { label: "5-7 days", test: (days) => days >= 5 && days <= 7 },
    { label: "8-10 days", test: (days) => days >= 8 && days <= 10 },
    { label: "11-14 days", test: (days) => days >= 11 },
  ];
  const delayByLeadTime: ChartDatum[] = leadBuckets
    .map((bucket) => {
      const rows = records.filter((record) => bucket.test(record.appointment_days_ahead));
      return {
        label: bucket.label,
        value: rate(rows, (record) => record.missed_target),
        count: rows.length,
      };
    })
    .filter((datum) => datum.count > 0);

  const histogramBins: Array<{ label: string; test: (hours: number) => boolean }> = [
    { label: "0-10", test: (hours) => hours < 10 },
    { label: "10-20", test: (hours) => hours >= 10 && hours < 20 },
    { label: "20-30", test: (hours) => hours >= 20 && hours < 30 },
    { label: "30-40", test: (hours) => hours >= 30 && hours < 40 },
    { label: "40-50", test: (hours) => hours >= 40 && hours < 50 },
    { label: "50+", test: (hours) => hours >= 50 },
  ];
  const timeToOfferHistogram: ChartDatum[] = histogramBins.map((bin) => {
    const count = records.filter((record) => bin.test(record.hours_to_offer)).length;
    return { label: bin.label, value: count, count };
  });

  const scatterStride = Math.max(1, Math.floor(records.length / 180));
  const scatter = records
    .filter((_, index) => index % scatterStride === 0)
    .map((record) => ({
      x: record.hours_to_offer,
      y: record.hours_to_customer_contact,
      stockConfirmed: record.stock_confirmed,
    }));

  return {
    delayRateByIssueType,
    missingVsDelay,
    stockVsContact,
    clusterDistribution,
    outcomes,
    delayByLeadTime,
    timeToOfferHistogram,
    scatter,
  };
}
