import type { DescriptiveMetrics } from "../../insights/types.ts";

type Kpi = {
  label: string;
  value: string;
  hint: string;
};

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function InsightsKpis({ metrics }: { metrics: DescriptiveMetrics }) {
  const kpis: Kpi[] = [
    {
      label: "Cases analyzed",
      value: metrics.casesAnalyzed.toLocaleString(),
      hint: "Synthetic historical records",
    },
    {
      label: "Average time to offer",
      value: `${metrics.avgHoursToOffer.toFixed(1)} h`,
      hint: "Inspection to proposal",
    },
    {
      label: "Approval rate",
      value: percent(metrics.approvalRate),
      hint: `${metrics.offerPopulation.toLocaleString()} offer records`,
    },
    {
      label: "Cases with delays",
      value: metrics.casesWithDelays.toLocaleString(),
      hint: `${percent(metrics.delayRate)} beyond the 48 h target`,
    },
  ];

  return (
    <section className="insights-kpis" aria-label="Key metrics">
      {kpis.map((kpi) => (
        <article key={kpi.label} className="insights-kpi">
          <span className="insights-kpi-label">{kpi.label}</span>
          <span className="insights-kpi-value">{kpi.value}</span>
          <span className="insights-kpi-hint">{kpi.hint}</span>
        </article>
      ))}
    </section>
  );
}
