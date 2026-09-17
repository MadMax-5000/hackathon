import { useEffect, useState } from "react";
import type { ContactChannel, DerivedCase } from "../engine/types";
import type { ContactMessageRow } from "../data/api";
import { channelLabel, preferredChannels } from "../engine/contact";
import { Icon } from "./Icon";
import { ContactComposer } from "./ContactComposer";
import whatsappIcon from "../public/whatsapp-icon.svg";
import gmailIcon from "../public/gmail.svg";
import callIcon from "../public/cal.svg";
import smsIcon from "../public/sms.svg";

type Props = {
  item: DerivedCase;
  messages: ContactMessageRow[];
  onGenerate: (channel: ContactChannel, body: string) => void;
  onMarkSimulated: (channel: ContactChannel) => void;
  embedded?: boolean;
};

const CHANNEL_ICON_SRC: Record<ContactChannel, string> = {
  whatsapp: whatsappIcon,
  email: gmailIcon,
  phone: callIcon,
  sms: smsIcon,
};

const CHANNEL_ACTION: Record<ContactChannel, string> = {
  whatsapp: "Send message",
  email: "Send email",
  phone: "Call",
  sms: "Send SMS",
};

function channelValue(item: DerivedCase, channel: ContactChannel): string | null {
  const customer = item.customer;
  if (!customer) return null;
  if (channel === "email") return customer.email;
  if (channel === "whatsapp") return customer.whatsapp;
  if (channel === "phone" || channel === "sms") return customer.phone ?? customer.whatsapp;
  return null;
}

function channelHref(channel: ContactChannel, value: string): string {
  const digits = value.replace(/[^\d+]/g, "");
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/${digits.replace(/\+/g, "")}`;
    case "email":
      return `mailto:${value}`;
    case "phone":
      return `tel:${digits}`;
    case "sms":
      return `sms:${digits}`;
  }
}

export function ContactHub({ item, messages, onGenerate, onMarkSimulated, embedded }: Props) {
  const [selected, setSelected] = useState<ContactChannel | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [item.wheel.id]);

  if (item.noAction) return null;

  const { preferred, others } = preferredChannels(item.customer, item.availableChannels);
  const ordered = preferred ? [preferred, ...others] : others;

  const selectedMessage = selected
    ? [...messages].reverse().find((message) => message.channel === selected)
    : undefined;

  return (
    <section className={`contact-hub${embedded ? " is-embedded" : ""}`} id="contact">
      <div className="contact-head">
        {embedded ? null : (
          <h3>
            <Icon name="person" size={18} />
            Contact hub
          </h3>
        )}
        <span className="chip">Simulated</span>
      </div>

      <div className="contact-identity">
        <div>
          <span className="contact-label">Customer</span>
          <strong>{item.customer ? item.customer.displayName : item.wheel.customer_id}</strong>
        </div>
        <div>
          <span className="contact-label">Record</span>
          <strong>
            {item.wheel.customer_id} · {item.wheel.appointment}
          </strong>
        </div>
        <div>
          <span className="contact-label">Contact status</span>
          <strong>{item.wheel.contact === "missing" ? "Unavailable" : "Recorded"}</strong>
        </div>
      </div>

      {item.customer && ordered.length > 0 ? (
        <>
          <div className="contact-actions">
            <span className="contact-label">Contact customer</span>
            <ul className="channel-list contact-list">
              {ordered.map((channel) => {
                const value = channelValue(item, channel);
                return (
                  <li key={channel} className={selected === channel ? "is-selected" : ""}>
                    <img
                      className={`channel-icon${
                        channel === "phone" || channel === "sms" ? " is-inverted" : ""
                      }`}
                      src={CHANNEL_ICON_SRC[channel]}
                      alt=""
                    />
                    <button
                      type="button"
                      className="channel-select"
                      onClick={() => setSelected(channel)}
                    >
                      {channelLabel(channel)}
                      {preferred === channel ? (
                        <em className="channel-preferred">preferred</em>
                      ) : null}
                    </button>
                    <a
                      className="channel-link"
                      href={value ? channelHref(channel, value) : undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {CHANNEL_ACTION[channel]}
                      <Icon name="arrow" size={14} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected ? (
            <ContactComposer
              item={item}
              channel={selected}
              message={selectedMessage}
              onGenerate={(body) => onGenerate(selected, body)}
              onMarkSimulated={() => onMarkSimulated(selected)}
            />
          ) : null}
        </>
      ) : (
        <p className="contact-missing">
          <Icon name="alert" size={16} className="icon-bad" />
          Contact unavailable — not present in the supplied record. No channel has been invented.
        </p>
      )}
    </section>
  );
}
