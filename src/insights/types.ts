import type { QueueGroup } from "../engine/types.ts";

export const INSIGHTS_DISCLAIMER =
  "SYNTHETIC HISTORICAL DATA — GENERATED FOR DEMONSTRATION";

export type IssueType = "puncture" | "wear" | "valve" | "pressure" | "sidewall";

export type HistoricalContactChannel = "whatsapp" | "email" | "phone" | "sms" | "none";

export type HistoricalRecord = {
  case_id: string;
  issue_type: IssueType;
  tyre_size: string;
  front_flagged: boolean;
  rear_flagged: boolean;
  measurement_complete: boolean;
  contact_available: boolean;
  stock_confirmed: boolean;
  appointment_days_ahead: number;
  hours_to_offer: number;
  hours_to_customer_contact: number;
  technician_correction: boolean;
  offer_approved: boolean;
  offer_rejected: boolean;
  customer_contacted: boolean;
  contact_channel: HistoricalContactChannel;
  review_task_created: boolean;
  workflow_completed: boolean;
  missed_target: boolean;
  delay_hours: number;
};

export type FeatureSpec = {
  name: string;
  label: string;
  value: (record: HistoricalRecord) => number;
};

export type Standardizer = {
  featureNames: string[];
  featureLabels: string[];
  means: number[];
  stds: number[];
};

export type RiskContribution = {
  label: string;
  value: number;
  contribution: number;
};

export type RiskPrediction = {
  caseId: string;
  probability: number;
  label: "High delay risk" | "Low delay risk";
  factors: RiskContribution[];
};

export type ModelEvaluation = {
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  auc: number;
  baseRate: number;
};

export type FeatureImportance = {
  label: string;
  importance: number;
};

export type DelayRiskModel = {
  prediction: RiskPrediction;
  topRisks: RiskPrediction[];
  globalImportance: FeatureImportance[];
  evaluation: ModelEvaluation;
};

export type ClusterFeatureStat = {
  label: string;
  mean: number;
  globalMean: number;
  direction: "higher" | "lower";
};

export type ClusterSummary = {
  id: number;
  size: number;
  share: number;
  description: string;
  topFeatures: ClusterFeatureStat[];
  exampleCaseIds: string[];
};

export type Anomaly = {
  caseId: string;
  driverLabel: string;
  zScore: number;
  value: number;
  baseline: number;
  detail: string;
};

export type DescriptiveMetrics = {
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
  reviewTaskRate: number;
  contactedRate: number;
};

export type InsightUnit = "rate" | "hours";

export type Insight = {
  id: string;
  title: string;
  detail: string;
  metricLabel: string;
  unit: InsightUnit;
  withValue: number;
  withoutValue: number;
  withLabel: string;
  withoutLabel: string;
  withCount: number;
  withoutCount: number;
  difference: number;
  supportingCaseIds: string[];
  workflowGroups: QueueGroup[];
  factorLabel: string;
};

export type ChartDatum = {
  label: string;
  value: number;
  count: number;
};

export type ScatterPoint = {
  x: number;
  y: number;
  stockConfirmed: boolean;
};

export type InsightsCharts = {
  delayRateByIssueType: ChartDatum[];
  missingVsDelay: ChartDatum[];
  stockVsContact: ChartDatum[];
  clusterDistribution: ChartDatum[];
  outcomes: ChartDatum[];
  delayByLeadTime: ChartDatum[];
  timeToOfferHistogram: ChartDatum[];
  scatter: ScatterPoint[];
};

export type AnalyzeFailure = {
  ok: false;
  error: string;
};

export type AnalyticsData = {
  version: string;
  seed: number;
  records: HistoricalRecord[];
  metrics: DescriptiveMetrics;
  model: DelayRiskModel;
  clusters: ClusterSummary[];
  anomalies: Anomaly[];
  anomaliesAboveThreshold: number;
  anomaliesScanned: number;
  insights: Insight[];
  charts: InsightsCharts;
};

export type AnalyzeSuccess = {
  ok: true;
  data: AnalyticsData;
};

export type AnalyzeResult = AnalyzeSuccess | AnalyzeFailure;
