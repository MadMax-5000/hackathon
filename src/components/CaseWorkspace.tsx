import { useState } from "react";
import type { ContactChannel, DerivedCase } from "../engine/types";
import type { ContactMessageRow } from "../data/api";
import { heroHeadline } from "../engine/workflow";
import { hintFor } from "../copilot/answers";
import { CaseOverview } from "./CaseOverview";
import { ContactHub } from "./ContactHub";
import { EvidenceExplorer } from "./EvidenceExplorer";
import { Icon } from "./Icon";
import { ValidationTimeline } from "./ValidationTimeline";
import { VerifyStockCard } from "./VerifyStockCard";
import { stateBadge } from "./status";

type Props = {
  item: DerivedCase;
  rules: string[];
  contactMessages: ContactMessageRow[];
  onApprove: () => void;
  onReject: (reason: string) => void;
  onSaveEdit: (quantity: number, size: string, note: string) => void;
  onSimulateStock: () => void;
  onBackToReview: () => void;
  onCreateReviewTask: (note: string) => void;
  onContactGenerate: (channel: ContactChannel, body: string) => void;
  onContactMarkSimulated: (channel: ContactChannel) => void;
  onContactSend: (channel: ContactChannel, body: string) => void | Promise<unknown>;
};

export function CaseWorkspace({
  item,
  rules,
  contactMessages,
  onApprove,
  onReject,
  onSaveEdit,
  onSimulateStock,
  onBackToReview,
  onCreateReviewTask,
  onContactGenerate,
  onContactMarkSimulated,
  onContactSend,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reviewTaskOpen, setReviewTaskOpen] = useState(false);
  const [bufferedCaseId, setBufferedCaseId] = useState(item.wheel.id);
  const [quantity, setQuantity] = useState(item.runtime.quantity ?? 1);
  const [size, setSize] = useState(item.runtime.size ?? item.wheel.size);
  const [note, setNote] = useState(item.runtime.note);
  const [rejectReason, setRejectReason] = useState(item.runtime.rejectReason);
  const [taskNote, setTaskNote] = useState("Collect missing measurement and confirm tyre size.");

  if (bufferedCaseId !== item.wheel.id) {
    setBufferedCaseId(item.wheel.id);
    setEditing(false);
    setRejecting(false);
    setReviewTaskOpen(false);
    setQuantity(item.runtime.quantity ?? 1);
    setSize(item.runtime.size ?? item.wheel.size);
    setNote(item.runtime.note);
    setRejectReason(item.runtime.rejectReason);
  }

  const badge = stateBadge(item);
  const hint = hintFor(item);

  function startEdit() {
    setQuantity(item.runtime.quantity ?? 1);
    setSize(item.runtime.size ?? item.wheel.size);
    setNote(item.runtime.note);
    setEditing(true);
    setRejecting(false);
    setReviewTaskOpen(false);
  }

  const approveContent = (
    <>
      {item.whyProposed && !item.runtime.approved && !item.runtime.humanCorrected ? (
        <p className="offer-why">{item.whyProposed}</p>
      ) : null}

      {editing ? (
        <form
          className="edit-form panel"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit(quantity, size.trim(), note.trim());
            setEditing(false);
          }}
        >
          <h3>Correct the proposal</h3>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Size
            <input value={size} onChange={(event) => setSize(event.target.value)} required />
          </label>
          <label>
            Internal note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </label>
          <div className="action-row">
            <button type="submit" className="btn btn-primary">
              <Icon name="check" size={18} />
              Save correction
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : rejecting ? (
        <form
          className="edit-form panel"
          onSubmit={(event) => {
            event.preventDefault();
            onReject(rejectReason.trim());
            setRejecting(false);
          }}
        >
          <h3>Reject the proposal</h3>
          <label>
            Reason
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={2}
            />
          </label>
          <div className="action-row">
            <button type="submit" className="btn btn-primary">
              <Icon name="x" size={18} />
              Confirm reject
            </button>
            <button type="button" className="btn" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : reviewTaskOpen ? (
        <form
          className="edit-form panel"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateReviewTask(taskNote.trim() || "Collect missing evidence.");
            setReviewTaskOpen(false);
          }}
        >
          <h3>Create review task</h3>
          <p className="form-note">
            This records a human task on the timeline. It does not create an offer or contact the customer.
          </p>
          <label>
            Task
            <textarea value={taskNote} onChange={(event) => setTaskNote(event.target.value)} rows={2} />
          </label>
          <div className="action-row">
            <button type="submit" className="btn btn-primary">
              <Icon name="clipboard" size={18} />
              Confirm task
            </button>
            <button type="button" className="btn" onClick={() => setReviewTaskOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : item.noAction ? (
        <p className="vstep-idle">
          <Icon name="check" size={18} />
          No action required — no offer is needed.
        </p>
      ) : item.blocked ? (
        <>
          <ul className="blocked-list">
            {item.blockReasons.map((reason) => (
              <li key={reason}>
                <Icon name="x" size={16} className="icon-bad" />
                {reason}
              </li>
            ))}
          </ul>
          {item.runtime.task ? (
            <p className="vstep-idle">
              <Icon name="clipboard" size={18} />
              Review task created — {item.runtime.task.note}
            </p>
          ) : (
            <div className="action-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setReviewTaskOpen(true)}
              >
                <Icon name="clipboard" size={18} />
                Create review task
              </button>
              <span className="action-hint">
                Collect the missing evidence before an offer is prepared.
              </span>
            </div>
          )}
        </>
      ) : item.runtime.rejected ? (
        <div className="action-row">
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
      ) : !item.runtime.approved ? (
        <div className="action-bar is-decision">
          <button type="button" className="btn btn-primary" onClick={onApprove}>
            <Icon name="check" size={18} />
            Approve proposal
          </button>
          <button type="button" className="btn" onClick={startEdit}>
            <Icon name="pen" size={18} />
            Correct
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setRejecting(true);
              setEditing(false);
            }}
          >
            <Icon name="x" size={18} />
            Reject
          </button>
        </div>
      ) : (
        <p className="vstep-idle">
          <Icon name="check" size={18} />
          Proposal approved — {item.runtime.quantity} × {item.runtime.size}
          {item.runtime.humanCorrected ? " (human-corrected)" : ""}.
        </p>
      )}

      {hint ? (
        <p className="hint">
          <Icon name="info" size={18} className="hint-icon" />
          <span>{hint}</span>
        </p>
      ) : null}
    </>
  );

  const contactContent = (
    <>
      {item.contactLock ? (
        <p className="vstep-idle">
          <Icon name="lock" size={18} />
          {item.contactLock}
        </p>
      ) : null}
      <ContactHub
        embedded
        item={item}
        messages={contactMessages}
        onGenerate={onContactGenerate}
        onMarkSimulated={onContactMarkSimulated}
        onSend={onContactSend}
      />
    </>
  );

  return (
    <article>
      <section className="case-header">
        <div className="case-header-top">
          <p className="case-meta">
            <span>
              <Icon name="person" size={16} /> {item.wheel.customer_id}
            </span>
            <span>
              <Icon name="calendar" size={16} /> {item.wheel.appointment}
            </span>
            <span className="case-record-id">{item.wheel.id}</span>
          </p>
          <span className={`state-badge tone-${badge.tone}`}>
            <Icon name={badge.icon} size={16} />
            {badge.label}
          </span>
        </div>

        <h2 className="offer">
          {!item.blocked && !item.noAction && item.runtime.quantity != null && item.runtime.size ? (
            <>
              <span className="offer-qty">{item.runtime.quantity} ×</span>
              <span className="offer-pill">
                <Icon name="tyre" className="offer-tyre" size={32} />
                <span>{item.runtime.size}</span>
              </span>
            </>
          ) : (
            <span>{heroHeadline(item)}</span>
          )}
        </h2>

        <EvidenceExplorer item={item} />
      </section>

      <CaseOverview item={item} rules={rules} />

      <ValidationTimeline
        item={item}
        approve={approveContent}
        stock={
          <VerifyStockCard
            item={item}
            onSimulateStock={onSimulateStock}
            onBackToReview={onBackToReview}
          />
        }
        contact={contactContent}
      />
    </article>
  );
}
