import type { DerivedCase } from "../engine/types";
import { customerMessageLockReason, draftCustomerMessage } from "../engine/workflow";
import { Icon } from "./Icon";

type Props = {
  item: DerivedCase;
};

export function CustomerMessage({ item }: Props) {
  if (item.blocked || item.noAction) return null;

  const lock = customerMessageLockReason(item);
  const draft = lock ? null : draftCustomerMessage(item);
  const approved = item.runtime.quantity != null && item.runtime.size;

  return (
    <section className="customer-message" id="message">
      <div className="customer-message-head">
        <h3>
          <Icon name="mail" size={18} />
          Customer communication
        </h3>
        <span className="chip">Simulated</span>
      </div>

      {lock ? (
        <p className="lock">
          <Icon name="lock" size={18} className="lock-icon" />
          {lock}
        </p>
      ) : (
        <>
          <ul className="message-facts">
            <li>
              <span>Approved quantity</span>
              <strong>
                {item.runtime.quantity} × {item.runtime.size}
              </strong>
            </li>
            <li>
              <span>Tyre size</span>
              <strong>{item.runtime.size}</strong>
            </li>
            <li>
              <span>Technician approval</span>
              <strong>{approved ? "Approved" : "Pending"}</strong>
            </li>
            <li>
              <span>Next step</span>
              <strong>Contact us to confirm {item.wheel.appointment}</strong>
            </li>
          </ul>
          <p className={`message-copy ${item.runtime.messageSimulated ? "is-generated" : "is-draft"}`}>
            {draft}
          </p>
          <p className="sim-note">
            {item.runtime.messageSimulated
              ? "SIMULATED — message generated, not actually sent."
              : "Draft only. Nothing is sent from this prototype."}
          </p>
        </>
      )}
    </section>
  );
}
