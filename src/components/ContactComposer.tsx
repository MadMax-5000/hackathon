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
  onSend: (body: string) => void | Promise<unknown>;
};

const SEND_LABEL: Record<ContactChannel, string> = {
  whatsapp: "Send WhatsApp now",
  email: "Send email now",
  phone: "",
  sms: "Send SMS now",
};

export function ContactComposer({
  item,
  channel,
  message,
  onGenerate,
  onMarkSimulated,
  onSend,
}: Props) {
  const initial = draftContactMessage(item, channel) ?? "";
  const [body, setBody] = useState(initial);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setBody(draftContactMessage(item, channel) ?? "");
  }, [item.wheel.id, channel, item.runtime.quantity, item.runtime.size]);

  const canAutoSend = channel !== "phone";
  const isDraft = message?.status === "draft";
  const marked = message?.status === "marked_simulated";
  const failed = message?.status === "send_failed";
  const mockSent = message?.status === "mock_sent";
  const deliveryLabel =
    message?.status === "delivered"
      ? "Delivered"
      : message?.status === "bounced"
        ? "Bounced"
        : message?.status === "complained"
          ? "Complained"
          : message?.status === "delayed"
            ? "Delivery delayed"
            : null;
  const sent =
    message?.status === "sent" ||
    mockSent ||
    message?.status === "delivered" ||
    deliveryLabel !== null;

  const statusLabel = deliveryLabel
    ? deliveryLabel
    : mockSent
      ? "Sent (mock)"
      : message?.status === "sent"
        ? "Sent automatically"
        : failed
          ? "Send failed"
          : marked
            ? "Marked simulated"
            : isDraft
              ? "Draft generated"
              : "Not generated";

  function handleSend() {
    setSending(true);
    Promise.resolve(onSend(body)).finally(() => setSending(false));
  }

  return (
    <div className="contact-composer">
      <p className="composer-title">
        {sent
          ? `SENT ${channelLabel(channel).toUpperCase()} MESSAGE`
          : `SIMULATED ${channelLabel(channel).toUpperCase()} MESSAGE`}
      </p>

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
          <strong>{statusLabel}</strong>
        </li>
      </ul>

      <label className="composer-field">
        <span className="contact-label">Message draft</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          aria-label={`${channelLabel(channel)} message draft`}
        />
      </label>

      <div className="action-row is-centered">
        <button type="button" className="btn btn-primary" onClick={() => onGenerate(body)}>
          <Icon name="play" size={18} />
          Generate
        </button>
        <button
          type="button"
          className="btn"
          onClick={onMarkSimulated}
          disabled={!isDraft || marked}
        >
          <Icon name="check" size={18} />
          Mark as simulated
        </button>
        {canAutoSend ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || sent}
          >
            <Icon name="arrow" size={18} />
            {sending ? "Sending…" : sent ? "Sent" : SEND_LABEL[channel]}
          </button>
        ) : null}
      </div>

      {canAutoSend ? (
        <p className="contact-send-hint">
          Sends automatically — email goes through Resend when configured, other channels use the
          {" "}
          mock provider. The manual hand-off links above still work.
        </p>
      ) : null}
    </div>
  );
}
