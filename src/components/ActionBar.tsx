import type { DerivedCase } from "../engine/types";
import { Icon } from "./Icon";

type Props = {
  item: DerivedCase;
  onApprove: () => void;
  onStartEdit: () => void;
  onStartReject: () => void;
  onBackToReview: () => void;
  onSimulateStock: () => void;
  onStartReviewTask: () => void;
};

export function ActionBar({
  item,
  onApprove,
  onStartEdit,
  onStartReject,
  onBackToReview,
  onSimulateStock,
  onStartReviewTask,
}: Props) {
  if (item.noAction) {
    return (
      <div className="action-bar is-idle" id="decision">
        <Icon name="check" size={18} />
        No action required — no offer is needed.
      </div>
    );
  }

  if (item.blocked) {
    if (item.runtime.task) {
      return (
        <div className="action-bar is-idle" id="decision">
          <Icon name="clipboard" size={18} />
          Review task created — {item.runtime.task.note}
        </div>
      );
    }
    return (
      <div className="action-bar" id="decision">
        <button type="button" className="btn btn-primary" onClick={onStartReviewTask}>
          <Icon name="clipboard" size={18} />
          Create review task
        </button>
        <span className="action-hint">Collect the missing evidence before an offer is prepared.</span>
      </div>
    );
  }

  if (item.runtime.rejected) {
    return (
      <div className="action-bar" id="decision">
        <p className="decision-note">
          {item.runtime.rejectReason
            ? `Rejected — ${item.runtime.rejectReason}`
            : "Rejected — review required."}
        </p>
        <button type="button" className="btn" onClick={onBackToReview}>
          <Icon name="redo" size={18} />
          Back to review
        </button>
      </div>
    );
  }

  if (!item.runtime.approved) {
    return (
      <div className="action-bar is-decision" id="decision">
        <button type="button" className="btn btn-primary" onClick={onApprove}>
          <Icon name="check" size={18} />
          Approve proposal
        </button>
        <button type="button" className="btn" onClick={onStartEdit}>
          <Icon name="pen" size={18} />
          Correct
        </button>
        <button type="button" className="btn" onClick={onStartReject}>
          <Icon name="x" size={18} />
          Reject
        </button>
      </div>
    );
  }

  if (item.stock && !item.stock.confirmed) {
    return (
      <div className="action-bar" id="decision">
        <button type="button" className="btn btn-primary" onClick={onSimulateStock}>
          <Icon name="cube" size={18} />
          Simulate stock confirmation
        </button>
        <button type="button" className="btn" onClick={onBackToReview}>
          <Icon name="redo" size={18} />
          Back to review
        </button>
        <span className="action-hint sim">SIMULATED — not a live inventory system.</span>
      </div>
    );
  }

  if (!item.runtime.messageSimulated) {
    return (
      <div className="action-bar" id="decision">
        <button type="button" className="btn" onClick={onBackToReview}>
          <Icon name="redo" size={18} />
          Back to review
        </button>
        <span className="action-hint sim">
          Choose a contact channel in the Contact hub below. SIMULATED — never sent.
        </span>
      </div>
    );
  }

  return (
    <div className="action-bar is-idle" id="decision">
      <Icon name="check" size={18} />
      Demo path complete — customer message simulated.
    </div>
  );
}
