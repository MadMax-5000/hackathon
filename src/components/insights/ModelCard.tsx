import { useState } from "react";
import type { DelayRiskModel, RiskPrediction } from "../../insights/types.ts";
import { Icon } from "../Icon";
import { RingGauge } from "./charts";

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function Factors({ prediction }: { prediction: RiskPrediction }) {
  const max = Math.max(...prediction.factors.map((factor) => Math.abs(factor.contribution)), 1e-9);
  return (
    <ol className="factor-list">
      {prediction.factors.map((factor) => (
        <li key={factor.label}>
          <div className="factor-head">
            <span>{factor.label}</span>
            <span className="factor-weight">
              {factor.contribution >= 0 ? "+" : "−"}
              {Math.abs(factor.contribution).toFixed(2)}
            </span>
          </div>
          <div className="factor-track">
            <span
              className={`factor-fill ${factor.contribution >= 0 ? "is-positive" : "is-negative"}`}
              style={{ width: `${Math.max(2, (Math.abs(factor.contribution) / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ModelCard({ model }: { model: DelayRiskModel }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = model.topRisks[selectedIndex] ?? model.prediction;
  const evaluation = model.evaluation;
  const maxImportance = Math.max(
    ...model.globalImportance.map((entry) => entry.importance),
    1e-9,
  );

  return (
    <section className="model-card" aria-label="Delay-risk model">
      <header className="model-card-head">
        <h3>
          <Icon name="chart" size={18} />
          Delay-risk model
        </h3>
        <span className="model-tag">logistic regression · explainable</span>
      </header>

      <div className="model-prediction">
        <span className={`model-prediction-label ${selected.probability >= 0.5 ? "is-high" : "is-low"}`}>
          {selected.label} — {percent(selected.probability)}
        </span>
        <span className="model-prediction-case">{selected.caseId} · synthetic record</span>
      </div>

      <div className="model-grid">
        <div>
          <h4 className="model-subtitle">Top contributing factors</h4>
          <Factors prediction={selected} />
          <p className="model-note">Prediction is based on the synthetic historical dataset.</p>
        </div>

        <div>
          <h4 className="model-subtitle">Global feature importance (|weight|)</h4>
          <ul className="importance-list">
            {model.globalImportance.map((entry) => (
              <li key={entry.label}>
                <div className="importance-head">
                  <span>{entry.label}</span>
                  <span className="importance-value">{entry.importance.toFixed(2)}</span>
                </div>
                <div className="importance-track">
                  <span
                    className="importance-fill"
                    style={{ width: `${Math.max(2, (entry.importance / maxImportance) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="model-eval">
        <RingGauge
          value={evaluation.auc}
          display={evaluation.auc.toFixed(2)}
          label="AUC"
        />
        <dl className="model-eval-facts">
          <div>
            <dt>Hold-out accuracy</dt>
            <dd>{(evaluation.accuracy * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Precision</dt>
            <dd>{(evaluation.precision * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Recall</dt>
            <dd>{(evaluation.recall * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Base rate</dt>
            <dd>{(evaluation.baseRate * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt>Train / test</dt>
            <dd>
              {evaluation.trainSize.toLocaleString()} · {evaluation.testSize.toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="model-risks">
        <h4 className="model-subtitle">Top predicted delay risks</h4>
        <ul className="risk-list">
          {model.topRisks.map((prediction, index) => (
            <li key={prediction.caseId}>
              <button
                type="button"
                className={`risk-row ${index === selectedIndex ? "is-selected" : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className="risk-row-id">{prediction.caseId}</span>
                <span className="risk-row-factor">{prediction.factors[0]?.label ?? "—"}</span>
                <span className="risk-row-prob">{percent(prediction.probability)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
