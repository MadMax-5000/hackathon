import type {
  CaseRuntime,
  ContactChannel,
  CustomerContact,
  DerivedCase,
  StockView,
  WheelSet,
} from "./types";

export const CHANNEL_ORDER: ContactChannel[] = ["whatsapp", "email", "phone", "sms"];

export function channelLabel(channel: ContactChannel): string {
  switch (channel) {
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "phone":
      return "Call";
    case "sms":
      return "SMS";
    default:
      return channel;
  }
}

// Only ever reports channels that exist in the stored customer record.
// A customer with contact missing yields an empty list — nothing is invented.
export function availableChannels(customer: CustomerContact | null): ContactChannel[] {
  if (!customer) return [];
  const out: ContactChannel[] = [];
  if (customer.whatsappAvailable && customer.whatsapp) out.push("whatsapp");
  if (customer.emailAvailable && customer.email) out.push("email");
  if (customer.phoneAvailable && customer.phone) out.push("phone");
  if (customer.smsAvailable && (customer.phone || customer.whatsapp)) out.push("sms");
  return out;
}

export function preferredChannels(
  customer: CustomerContact | null,
  channels: ContactChannel[],
): { preferred: ContactChannel | null; others: ContactChannel[] } {
  if (!customer || !customer.preferredChannel || !channels.includes(customer.preferredChannel)) {
    return { preferred: null, others: channels };
  }
  return {
    preferred: customer.preferredChannel,
    others: channels.filter((channel) => channel !== customer.preferredChannel),
  };
}

type ContactGateInput = {
  blocked: boolean;
  noAction: boolean;
  runtime: CaseRuntime;
  stock: StockView | null;
  wheel: WheelSet;
  customer: CustomerContact | null;
  channels: ContactChannel[];
};

// Preserves the existing business gates: approval, then stock confirmation,
// then a usable recorded contact channel.
export function contactLockReason(input: ContactGateInput): string | null {
  const { blocked, noAction, runtime, stock, wheel, channels } = input;
  if (blocked) return "No customer contact — this case is blocked until the missing evidence is collected.";
  if (noAction) return "No customer contact — no offer is required.";
  if (runtime.rejected) return "Customer contact locked. Proposal was rejected.";
  if (!runtime.approved) return "Customer contact locked until technician approval.";
  if (stock && !stock.confirmed) return "Customer contact locked until stock is confirmed.";
  if (wheel.contact === "missing") {
    return "Customer contact unavailable in the supplied record. No channel can be used.";
  }
  if (channels.length === 0) return "No usable contact channel is recorded for this customer.";
  if (runtime.quantity == null || !runtime.size) {
    return "Customer contact locked — quantity or size is missing.";
  }
  return null;
}

export function draftContactMessage(item: DerivedCase, _channel: ContactChannel): string | null {
  if (item.runtime.quantity == null || !item.runtime.size) return null;
  return `Hello, based on the inspection, your vehicle has an approved tyre replacement for ${item.runtime.quantity} × ${item.runtime.size}. Please contact us regarding the appointment.`;
}
