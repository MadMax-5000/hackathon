import type { DerivedCase } from "../engine/types";
import { Icon, type IconName } from "./Icon";

type Props = {
  item: DerivedCase;
  onSimulateStock: () => void;
  onBackToReview: () => void;
};

type StockState = "pending" | "ok" | "missing";

const ALERT: Record<StockState, { icon: IconName; title: string }> = {
  pending: { icon: "clock", title: "Confirmation pending" },
  ok: { icon: "check", title: "Stock confirmed" },
  missing: { icon: "alert", title: "No matching stock record" },
};

export function VerifyStockCard({ item, onSimulateStock, onBackToReview }: Props) {
  if (item.noAction) {
    return <p className="vstep-idle">No offer — no stock to verify.</p>;
  }

  if (item.blocked) {
    return (
      <p className="vstep-idle">
        <Icon name="lock" size={18} />
        Locked until the missing evidence is collected.
      </p>
    );
  }

  if (!item.runtime.approved) {
    return (
      <p className="vstep-idle">
        <Icon name="lock" size={18} />
        Locked until the proposal is approved.
      </p>
    );
  }

  const state: StockState = !item.stock ? "missing" : item.stock.confirmed ? "ok" : "pending";
  const alert = ALERT[state];
  const size = item.stock?.size ?? item.runtime.size ?? "Unknown";
  const units = item.stock?.units ?? 0;

  const description =
    state === "pending"
      ? `${units} × ${size} reported in the supplied data — not yet verified.`
      : state === "ok"
        ? `${units} × ${size} confirmed via simulated event.`
        : "The availability data has no row matching this tyre size.";

  return (
    <div className={`stock-card is-${state}`}>
      <div className="stock-alert">
        <Icon name={alert.icon} size={18} className="stock-alert-icon" />
        <div className="stock-alert-text">
          <strong>{alert.title}</strong>
          <span>{description}</span>
        </div>
      </div>

      {item.stock ? (
        <dl className="stock-meta">
          <div>
            <dt>Size</dt>
            <dd>{item.stock.size}</dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>{item.stock.units}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{item.stock.confirmed ? "Simulated event" : "Reported"}</dd>
          </div>
        </dl>
      ) : null}

      <div className="stock-actions">
        {state === "pending" ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onSimulateStock}>
              <Icon name="cube" size={18} strokeWidth={2} />
              Simulate stock confirmation
            </button>
            <button type="button" className="btn" onClick={onBackToReview}>
              <Icon name="redo" size={18} strokeWidth={2} />
              Back to review
            </button>
          </>
        ) : state === "ok" ? (
          <p className="stock-ready">
            <Icon name="check" size={16} strokeWidth={2} />
            Ready — the customer message can now be prepared.
          </p>
        ) : (
          <button type="button" className="btn" onClick={onBackToReview}>
            <Icon name="redo" size={18} strokeWidth={2} />
            Back to review
          </button>
        )}
      </div>
    </div>
  );
}
