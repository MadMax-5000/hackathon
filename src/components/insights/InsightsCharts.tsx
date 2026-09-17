import type { ReactNode } from "react";
import type { ChartDatum, InsightsCharts as ChartsData } from "../../insights/types.ts";
import { ColumnChart, DonutChart, LineAreaChart, ScatterPlot } from "./charts";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function count(value: number): string {
  return Math.round(value).toLocaleString();
}

function ChartCard({
  question,
  answer,
  children,
}: {
  question: string;
  answer: string;
  children: ReactNode;
}) {
  return (
    <article className="insights-chart">
      <header className="chart-card-head">
        <h3>{question}</h3>
        <p className="chart-answer">{answer}</p>
      </header>
      {children}
    </article>
  );
}

function StatTile({
  label,
  value,
  count: support,
  tone,
}: {
  label: string;
  value: string;
  count: number;
  tone: "bad" | "ok" | "warn";
}) {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-count">{support.toLocaleString()} records</span>
    </div>
  );
}

function IssueRanking({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((datum) => datum.value), 1e-9);
  const ranked = [...data].sort((a, b) => b.value - a.value);

  return (
    <ul className="issue-ranking">
      {ranked.map((datum) => (
        <li key={datum.label}>
          <span className="issue-rank-label">{datum.label}</span>
          <span className="issue-rank-track">
            <span
              className="issue-rank-dot-line"
              style={{ width: `${Math.max(4, (datum.value / max) * 100)}%` }}
            />
            <span
              className="issue-rank-dot"
              style={{ left: `${Math.max(0, (datum.value / max) * 100)}%` }}
            />
          </span>
          <span className="issue-rank-value">{percent(datum.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function InsightsCharts({ charts }: { charts: ChartsData }) {
  const outcomesTotal = charts.outcomes.reduce((total, datum) => total + datum.value, 0);
  const clusterTotal = charts.clusterDistribution.reduce(
    (total, datum) => total + datum.count,
    0,
  );
  const delayPeak = [...charts.delayByLeadTime].sort((a, b) => b.value - a.value)[0];
  const missing = charts.missingVsDelay[0];
  const incomplete = charts.missingVsDelay[1];
  const confirmed = charts.stockVsContact[0];
  const unconfirmed = charts.stockVsContact[1];

  const xMax = Math.max(...charts.scatter.map((point) => point.x), 1);
  const yMax = Math.max(...charts.scatter.map((point) => point.y), 1);

  return (
    <section className="insights-charts" aria-label="Analytics charts">
      <ChartCard
        question="How do offers resolve?"
        answer={`${percent(charts.outcomes[0] ? charts.outcomes[0].value / outcomesTotal : 0)} approved across ${count(outcomesTotal)} offer records.`}
      >
        <DonutChart
          data={charts.outcomes}
          format={count}
          centerValue={count(outcomesTotal)}
          centerLabel="offers"
        />
      </ChartCard>

      <ChartCard
        question="Does a tighter appointment window raise delay rate?"
        answer={
          delayPeak
            ? `Highest delay rate is ${percent(delayPeak.value)} at ${delayPeak.label} out.`
            : "No lead-time data."
        }
      >
        <LineAreaChart
          data={charts.delayByLeadTime}
          format={(value) => `${(value * 100).toFixed(0)}%`}
        />
      </ChartCard>

      <ChartCard
        question="How do the historical workflows cluster?"
        answer={`${charts.clusterDistribution.length} derived patterns across ${count(clusterTotal)} cases.`}
      >
        <DonutChart
          data={charts.clusterDistribution}
          format={percent}
          centerValue={count(clusterTotal)}
          centerLabel="cases"
        />
      </ChartCard>

      <ChartCard
        question="Which issue types delay most?"
        answer={`${charts.delayRateByIssueType.length} issue types compared by missed-target rate.`}
      >
        <IssueRanking data={charts.delayRateByIssueType} />
      </ChartCard>

      <ChartCard
        question="Does unconfirmed stock push contact later?"
        answer="Each point is a synthetic workflow: offer time versus customer-contact time."
      >
        <ScatterPlot
          points={charts.scatter}
          xLabel="Time to offer (h)"
          yLabel="Time to contact (h)"
          xMax={xMax}
          yMax={yMax}
          formatX={(value) => `${value.toFixed(0)}h`}
          formatY={(value) => `${value.toFixed(0)}h`}
        />
        <ul className="scatter-legend">
          <li>
            <span className="legend-swatch is-confirmed" aria-hidden="true" />
            Stock confirmed
          </li>
          <li>
            <span className="legend-swatch is-pending" aria-hidden="true" />
            Stock unconfirmed
          </li>
        </ul>
      </ChartCard>

      <ChartCard
        question="How is time-to-offer distributed?"
        answer="Count of synthetic workflows per hours-to-offer band."
      >
        <ColumnChart data={charts.timeToOfferHistogram} format={count} />
      </ChartCard>

      <ChartCard
        question="Does missing evidence relate to delay?"
        answer="Missed-target rate for complete versus incomplete measurements."
      >
        <div className="insights-stats">
          {missing && incomplete ? (
            <>
              <StatTile
                label={missing.label}
                value={percent(missing.value)}
                count={missing.count}
                tone="ok"
              />
              <StatTile
                label={incomplete.label}
                value={percent(incomplete.value)}
                count={incomplete.count}
                tone="bad"
              />
            </>
          ) : null}
        </div>
      </ChartCard>

      <ChartCard
        question="Does stock confirmation shorten contact time?"
        answer="Average hours to customer contact by stock state."
      >
        <div className="insights-stats">
          {confirmed && unconfirmed ? (
            <>
              <StatTile
                label={confirmed.label}
                value={`${confirmed.value.toFixed(1)} h`}
                count={confirmed.count}
                tone="ok"
              />
              <StatTile
                label={unconfirmed.label}
                value={`${unconfirmed.value.toFixed(1)} h`}
                count={unconfirmed.count}
                tone="warn"
              />
            </>
          ) : null}
        </div>
      </ChartCard>
    </section>
  );
}
