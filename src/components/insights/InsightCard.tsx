import type { QueueGroup } from "../../engine/types.ts";
import type { Insight } from "../../insights/types.ts";
import { Icon } from "../Icon";

function formatValue(unit: Insight["unit"], value: number): string {
  return unit === "rate" ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(1)} h`;
}

function Comparison({ insight }: { insight: Insight }) {
  const max = Math.max(insight.withValue, insight.withoutValue, 1e-9);
  const bars = [
    { label: insight.withLabel, value: insight.withValue, tone: "is-with" as const },
    { label: insight.withoutLabel, value: insight.withoutValue, tone: "is-without" as const },
  ];

  return (
    <ul className="insight-compare">
      {bars.map((bar) => (
        <li key={bar.label}>
          <div className="insight-compare-head">
            <span>{bar.label}</span>
            <span className="insight-compare-value">{formatValue(insight.unit, bar.value)}</span>
          </div>
          <div className="insight-compare-track">
            <span
              className={`insight-compare-fill ${bar.tone}`}
              style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InsightCard({
  insight,
  supportOpen,
  onExplain,
  onToggleSupport,
  onOpenWorkflow,
}: {
  insight: Insight;
  supportOpen: boolean;
  onExplain: () => void;
  onToggleSupport: () => void;
  onOpenWorkflow: (groups: QueueGroup[]) => void;
}) {
  return (
    <article className="insight-card">
      <div className="insight-card-top">
        <span className="insight-card-tag">
          <Icon name="alert" size={14} />
          {insight.factorLabel}
        </span>
        <span className="insight-card-metric">{insight.metricLabel}</span>
      </div>

      <p className="insight-card-title">{insight.title}</p>
      <Comparison insight={insight} />
      <p className="insight-card-detail">{insight.detail}</p>

      <div className="insight-card-actions">
        <button type="button" className="btn" onClick={onExplain}>
          <Icon name="sparkle" size={16} />
          Explain
        </button>
        <button type="button" className="btn" onClick={onToggleSupport}>
          <Icon name="layers" size={16} />
          {supportOpen ? "Hide supporting cases" : "View supporting cases"}
        </button>
        {insight.workflowGroups.length > 0 ? (
          <button
            type="button"
            className="insight-workflow-link"
            onClick={() => onOpenWorkflow(insight.workflowGroups)}
          >
            <Icon name="arrow" size={16} />
            View affected workflow cases
          </button>
        ) : null}
      </div>
    </article>
  );
}
