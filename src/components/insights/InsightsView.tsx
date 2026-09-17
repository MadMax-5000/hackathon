import { useMemo, useState } from "react";
import type { QueueGroup } from "../../engine/types.ts";
import { clearAnalyticsCache, getAnalytics } from "../../insights/analytics.ts";
import { Icon } from "../Icon";
import { InsightsCharts } from "./InsightsCharts";
import { InsightsKpis } from "./InsightsKpis";

export function InsightsView({
  onOpenWorkflow,
}: {
  onOpenWorkflow: (groups: QueueGroup[]) => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const analytics = useMemo(() => getAnalytics(), [reloadKey]);

  if (!analytics.ok) {
    return (
      <section className="insights-view" aria-label="Insights">
        <header className="insights-head">
          <span className="insights-kicker">Analytics</span>
          <h2 className="insights-title">Insights</h2>
          <p className="insights-sub">Synthetic historical data — generated for demonstration</p>
        </header>
        <section className="error-state" role="alert">
          <h2>Analytics unavailable</h2>
          <p>
            The synthetic historical dataset or its models could not be produced. The operational
            inspection-to-offer workflow is unaffected.
          </p>
          <p className="error-detail">{analytics.error}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              clearAnalyticsCache();
              setReloadKey((value) => value + 1);
            }}
          >
            Retry analytics
          </button>
        </section>
      </section>
    );
  }

  const { data } = analytics;

  return (
    <section className="insights-view" aria-label="Insights">
      <header className="insights-head">
        <span className="insights-kicker">Analytics</span>
        <h2 className="insights-title">Insights</h2>
        <p className="insights-sub">Synthetic historical data — generated for demonstration</p>
      </header>

      <InsightsKpis metrics={data.metrics} />

      <InsightsCharts charts={data.charts} />

      <footer className="insights-foot is-end">
        <button type="button" className="btn" onClick={() => onOpenWorkflow([])}>
          <Icon name="arrow" size={16} />
          Return to coordinator workspace
        </button>
      </footer>
    </section>
  );
}
