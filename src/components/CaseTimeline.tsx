import { useState } from "react";
import type { DerivedCase, HistoryEvent, HistoryKind } from "../engine/types";
import { Icon, type IconName } from "./Icon";

type Props = {
  item: DerivedCase;
};

type RowView = { icon: IconName; title: string; description?: string };

const KIND_META: Record<HistoryKind, { label: string; icon: IconName }> = {
  source: { label: "Source", icon: "layers" },
  ai: { label: "AI", icon: "sparkle" },
  human: { label: "Human", icon: "person" },
  simulated: { label: "Simulated", icon: "play" },
};

const TITLES: Record<string, Omit<RowView, "description">> = {
  inspection_detected: { icon: "search", title: "Inspection received" },
  offer_blocked: { icon: "alert", title: "Offer blocked" },
  no_offer: { icon: "check", title: "No offer needed" },
  ai_proposal: { icon: "sparkle", title: "AI proposal" },
  technician_approved: { icon: "check", title: "Technician approved" },
  proposal_rejected: { icon: "x", title: "Proposal rejected" },
  proposal_corrected: { icon: "pen", title: "Proposal corrected" },
  returned_to_review: { icon: "redo", title: "Returned to review" },
  review_task_created: { icon: "clipboard", title: "Review task created" },
  evidence_reviewed: { icon: "search", title: "Evidence reviewed" },
  stock_confirmed: { icon: "cube", title: "Stock confirmed" },
  contact_draft_generated: { icon: "mail", title: "Message draft generated" },
  message_simulated: { icon: "send", title: "Message simulated" },
};

function formatTime(value?: string): string | null {
  if (!value) return null;
  const match = /T(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : null;
}

function formatFullTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function describe(item: DerivedCase, event: HistoryEvent): string | undefined {
  switch (event.eventType) {
    case "inspection_detected":
      return item.concernSummary;
    case "offer_blocked":
      return item.blockReasons.length ? `Missing: ${item.blockReasons.join("; ")}.` : undefined;
    case "no_offer":
      return "No concern recorded on front or rear.";
    case "ai_proposal":
      return item.runtime.aiQuantity != null && item.runtime.aiSize
        ? `${item.runtime.aiQuantity} × ${item.runtime.aiSize} proposed.`
        : undefined;
    case "technician_approved":
      return item.runtime.quantity != null && item.runtime.size
        ? `Approved ${item.runtime.quantity} × ${item.runtime.size}.`
        : "Fitment and quantity approved.";
    case "proposal_rejected":
      return item.runtime.rejectReason
        ? `Reason: ${item.runtime.rejectReason}.`
        : "Needs review before contact.";
    case "proposal_corrected":
      return item.runtime.quantity != null && item.runtime.size
        ? `Corrected to ${item.runtime.quantity} × ${item.runtime.size}.`
        : undefined;
    case "returned_to_review":
      return "Earlier decision undone.";
    case "review_task_created":
      return item.runtime.task?.note;
    case "stock_confirmed":
      return "Simulation — not a supplier system.";
    case "contact_draft_generated":
      return "Draft generated — not sent.";
    case "message_simulated":
      return "Simulated — not sent.";
    default:
      return undefined;
  }
}

function viewFor(item: DerivedCase, event: HistoryEvent): RowView {
  const known = event.eventType ? TITLES[event.eventType] : undefined;
  const description = describe(item, event);
  if (known) return { ...known, description };
  const kind = KIND_META[event.kind];
  return { icon: kind.icon, title: kind.label, description };
}

export function CaseTimeline({ item }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="case-timeline" id="timeline" aria-label="Activity history">
      <ol className="tl">
        {item.runtime.history.map((event) => {
          const view = viewFor(item, event);
          const time = formatTime(event.createdAt);
          const fullTime = formatFullTime(event.createdAt);
          const isOpen = Boolean(open[event.id]);
          const detailsId = `timeline-details-${event.id}`;
          return (
            <li key={event.id} className={`tl-row kind-${event.kind}`}>
              <span className="tl-icon" aria-hidden="true">
                <Icon name={view.icon} size={16} />
              </span>

              <div className="tl-entry">
                <div className="tl-head">
                  <span className={`tl-badge kind-${event.kind}`}>
                    {KIND_META[event.kind].label}
                  </span>
                  <span className="tl-title">{view.title}</span>
                  {time ? <span className="tl-time">{time}</span> : null}
                </div>

                {view.description ? <p className="tl-desc">{view.description}</p> : null}

                <button
                  type="button"
                  className={`tl-toggle${isOpen ? " is-open" : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={detailsId}
                  onClick={() =>
                    setOpen((current) => ({ ...current, [event.id]: !current[event.id] }))
                  }
                >
                  <Icon name="chevron" size={14} />
                  {isOpen ? "Hide details" : "View details"}
                </button>

                {isOpen ? (
                  <dl className="tl-details" id={detailsId}>
                    <div>
                      <dt>Recorded</dt>
                      <dd>{fullTime ?? "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{event.source ?? event.kind}</dd>
                    </div>
                    <div>
                      <dt>Event</dt>
                      <dd>{event.eventType ?? event.kind}</dd>
                    </div>
                    <div className="tl-details-wide">
                      <dt>Audit record</dt>
                      <dd>{event.label}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
