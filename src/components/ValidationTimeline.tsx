import type { ReactNode } from "react";
import type { DerivedCase } from "../engine/types";
import { Icon, type IconName } from "./Icon";

type StepState = "done" | "active" | "locked" | "blocked" | "rejected" | "skipped";

type Step = {
  key: "approve" | "stock" | "contact";
  title: string;
  detail: string;
  icon: IconName;
  state: StepState;
};

const STATUS_LABEL: Record<StepState, string> = {
  done: "Done",
  active: "In progress",
  locked: "Locked",
  blocked: "Blocked",
  rejected: "Rejected",
  skipped: "N/A",
};

function ballIcon(step: Step): IconName {
  if (step.state === "done") return "check";
  if (step.state === "locked") return "lock";
  if (step.state === "blocked") return "alert";
  if (step.state === "rejected") return "redo";
  return step.icon;
}

function approvalStep(item: DerivedCase): Step {
  if (item.noAction) {
    return {
      key: "approve",
      title: "Approve proposal",
      detail: "No offer required.",
      icon: "shield",
      state: "skipped",
    };
  }
  if (item.blocked) {
    return {
      key: "approve",
      title: "Approve proposal",
      detail: "Blocked — missing evidence.",
      icon: "shield",
      state: "blocked",
    };
  }
  if (item.runtime.rejected) {
    return {
      key: "approve",
      title: "Approve proposal",
      detail: item.runtime.rejectReason
        ? `Rejected — ${item.runtime.rejectReason}`
        : "Rejected — review required.",
      icon: "shield",
      state: "rejected",
    };
  }
  if (item.runtime.approved) {
    return {
      key: "approve",
      title: "Approve proposal",
      detail: "Approved by technician.",
      icon: "shield",
      state: "done",
    };
  }
  return {
    key: "approve",
    title: "Approve proposal",
    detail: "Awaiting technician decision.",
    icon: "shield",
    state: "active",
  };
}

function stockStep(item: DerivedCase): Step {
  const base = { key: "stock" as const, title: "Verify stock", icon: "cube" as IconName };
  if (item.blocked || item.noAction || item.runtime.rejected || !item.runtime.approved) {
    return { ...base, detail: "Locked until the proposal is approved.", state: "locked" };
  }
  if (!item.stock) {
    return { ...base, detail: "No matching stock record.", state: "skipped" };
  }
  if (item.stock.confirmed) {
    return { ...base, detail: `${item.stock.units} units confirmed.`, state: "done" };
  }
  return {
    ...base,
    detail: `${item.stock.units} reported — confirmation pending.`,
    state: "active",
  };
}

function contactStep(item: DerivedCase): Step {
  const base = { key: "contact" as const, title: "Contact client", icon: "send" as IconName };
  if (item.blocked || item.noAction || item.runtime.rejected || !item.runtime.approved) {
    return { ...base, detail: "Locked until the offer is approved.", state: "locked" };
  }
  if (item.stock && !item.stock.confirmed) {
    return { ...base, detail: "Locked until stock is confirmed.", state: "locked" };
  }
  if (item.runtime.messageSimulated) {
    return { ...base, detail: "Customer message generated (simulated).", state: "done" };
  }
  return { ...base, detail: "Ready to contact the customer.", state: "active" };
}

type Props = {
  item: DerivedCase;
  approve: ReactNode;
  stock: ReactNode;
  contact: ReactNode;
};

export function ValidationTimeline({ item, approve, stock, contact }: Props) {
  const steps = [approvalStep(item), stockStep(item), contactStep(item)];
  const content: Record<Step["key"], ReactNode> = { approve, stock, contact };

  return (
    <section className="validation-timeline" aria-label="Validation progress">
      <h2 className="validation-title">
        <Icon name="layers" size={18} />
        Validation progress
      </h2>
      <ol className="v-timeline">
        {steps.map((step) => (
          <li key={step.key} className={`vstep is-${step.state}`}>
            <span className="vstep-ball" aria-hidden="true">
              <Icon name={ballIcon(step)} size={18} />
            </span>
            <div className="vstep-card">
              <header className="vstep-head">
                <span className="vstep-heading">
                  <span className="vstep-title">{step.title}</span>
                  <span className="vstep-detail">{step.detail}</span>
                </span>
                <span className={`vstep-status is-${step.state}`}>
                  {STATUS_LABEL[step.state]}
                </span>
              </header>
              <div className="vstep-content">{content[step.key]}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
