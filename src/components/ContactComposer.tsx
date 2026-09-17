import { useEffect, useState } from "react";
import type { ContactChannel, DerivedCase } from "../engine/types";
import type { ContactMessageRow } from "../data/api";
import { channelLabel, draftContactMessage } from "../engine/contact";
import { Icon } from "./Icon";

type Props = {
  item: DerivedCase;
  channel: ContactChannel;
  message: ContactMessageRow | undefined;
  onGenerate: (body: string) => void;
  onMarkSimulated: () => void;
};

export function ContactComposer({ item, channel, message, onGenerate, onMarkSimulated }: Props) {
  const initial = draftContactMessage(item, channel) ?? "";
  const [body, setBody] = useState(initial);

  useEffect(() => {
    setBody(draftContactMessage(item, channel) ?? "");
  }, [item.wheel.id, channel, item.runtime.quantity, item.runtime.size]);

  const generated = message?.status === "draft" || message?.status === "marked_simulated";
  const marked = message?.status === "marked_simulated";

  return (
    <div className="contact-composer">
      <p className="composer-title">SIMULATED {channelLabel(channel).toUpperCase()} MESSAGE</p>

      <ul className="message-facts">
        <li>
          <span>Channel</span>
          <strong>{channelLabel(channel)}</strong>
        </li>
        <li>
          <span>Customer</span>
          <strong>{item.customer ? item.customer.displayName : item.wheel.customer_id}</strong>
        </li>
        <li>
          <span>Approved offer</span>
          <strong>
            {item.runtime.quantity} × {item.runtime.size}
          </strong>
        </li>
        <li>
          <span>Status</span>
          <strong>{marked ? "Marked simulated" : generated ? "Draft generated" : "Not generated"}</strong>
        </li>
      </ul>

      <label className="composer-field">
        <span className="contact-label">Message draft</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          aria-label={`Simulated ${channelLabel(channel)} message draft`}
        />
      </label>

      <div className="action-row">
        <button type="button" className="btn btn-primary" onClick={() => onGenerate(body)}>
          <Icon name="play" size={18} />
          Generate
        </button>
        <button
          type="button"
          className="btn"
          onClick={onMarkSimulated}
          disabled={!generated || marked}
        >
          <Icon name="check" size={18} />
          Mark as simulated
        </button>
      </div>

      <p className="sim-note">
        SIMULATED — NOT SENT. This prototype generates a draft only. No real customer is contacted and
        no message leaves this workspace.
      </p>
    </div>
  );
}
