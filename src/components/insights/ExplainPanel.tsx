import { useEffect, useState } from "react";
import type { DescriptiveMetrics, Insight } from "../../insights/types.ts";
import {
  explainInsight,
  localExplanation,
  type ExplainResult,
} from "../../insights/ai/client.ts";
import { Icon } from "../Icon";

export function ExplainPanel({
  insight,
  metrics,
  onClose,
}: {
  insight: Insight;
  metrics: DescriptiveMetrics;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);

    explainInsight({ insight, metrics })
      .then((value) => {
        if (cancelled) return;
        setResult(value);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ text: localExplanation(insight, metrics), source: "local" });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [insight, metrics]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="explain-overlay" role="presentation" onClick={onClose}>
      <section
        className="explain-panel"
        role="dialog"
        aria-modal="true"
        aria-label="AI explanation"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="explain-head">
          <h3>
            <Icon name="sparkle" size={18} />
            AI explanation
          </h3>
          <button
            type="button"
            className="chat-close"
            aria-label="Close explanation"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <p className="explain-insight-title">{insight.title}</p>

        <div className="explain-body">
          {loading ? (
            <p className="explain-loading">Explaining from the computed synthetic evidence…</p>
          ) : (
            <p className="explain-text">{result?.text}</p>
          )}
        </div>

        <footer className="explain-foot">
          <span className="explain-source">
            {result?.source === "local" ? "offline explanation" : "AI explanation"} · synthetic
            historical data
          </span>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
