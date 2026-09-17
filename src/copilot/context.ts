import type { DerivedCase } from "../engine/types";

export type CaseContext = {
  caseId: string;
  customerId: string;
  appointment: string;
  contact: string;
  customer: {
    id: string;
    displayName: string;
    contactStatus: string;
    preferredChannel: string | null;
    channels: Record<string, { available: boolean; value: string | null }>;
  } | null;
  approvedOffer: { quantity: number; size: string; status: string } | null;
  evidence: {
    front: string;
    rear: string;
    size: string;
    stock: { id: string; size: string; units: number; confirmed: boolean } | null;
  };
  proposal: {
    aiQuantity: number | null;
    aiSize: string | null;
    quantity: number | null;
    size: string | null;
    humanCorrected: boolean;
  };
  state: {
    status: string;
    offerState: string;
    queueGroup: string;
    blocked: boolean;
    noAction: boolean;
    blockReasons: string[];
    uncertainties: string[];
    decisionOwner: string;
    whyProposed: string | null;
  };
  decisions: {
    approved: boolean;
    rejected: boolean;
    rejectReason: string;
    messageSimulated: boolean;
    evidenceReviewed: boolean;
    task: string | null;
  };
  rules: string[];
  timeline: Array<{ kind: string; label: string }>;
};

export function buildCaseContext(item: DerivedCase, rules: string[]): CaseContext {
  const customer = item.customer;
  return {
    caseId: item.wheel.id,
    customerId: item.wheel.customer_id,
    appointment: item.wheel.appointment,
    contact: item.wheel.contact,
    customer: customer
      ? {
          id: customer.id,
          displayName: customer.displayName,
          contactStatus: item.wheel.contact,
          preferredChannel: customer.preferredChannel,
          channels: {
            whatsapp: { available: item.availableChannels.includes("whatsapp"), value: customer.whatsapp },
            email: { available: item.availableChannels.includes("email"), value: customer.email },
            phone: { available: item.availableChannels.includes("phone"), value: customer.phone },
            sms: { available: item.availableChannels.includes("sms"), value: customer.phone },
          },
        }
      : null,
    approvedOffer:
      item.runtime.approved && item.runtime.quantity != null && item.runtime.size
        ? {
            quantity: item.runtime.quantity,
            size: item.runtime.size,
            status: item.runtime.messageSimulated ? "message_simulated" : "technician_approved",
          }
        : null,
    evidence: {
      front: item.wheel.front,
      rear: item.wheel.rear,
      size: item.wheel.size,
      stock: item.stock
        ? {
            id: item.stock.availabilityId,
            size: item.stock.size,
            units: item.stock.units,
            confirmed: item.stock.confirmed,
          }
        : null,
    },
    proposal: {
      aiQuantity: item.runtime.aiQuantity,
      aiSize: item.runtime.aiSize,
      quantity: item.runtime.quantity,
      size: item.runtime.size,
      humanCorrected: item.runtime.humanCorrected,
    },
    state: {
      status: item.status,
      offerState: item.offerState,
      queueGroup: item.queueGroup,
      blocked: item.blocked,
      noAction: item.noAction,
      blockReasons: item.blockReasons,
      uncertainties: item.uncertainties,
      decisionOwner: item.decisionOwner,
      whyProposed: item.whyProposed,
    },
    decisions: {
      approved: item.runtime.approved,
      rejected: item.runtime.rejected,
      rejectReason: item.runtime.rejectReason,
      messageSimulated: item.runtime.messageSimulated,
      evidenceReviewed: item.runtime.evidenceReviewed,
      task: item.runtime.task ? item.runtime.task.note : null,
    },
    rules,
    timeline: item.runtime.history.map((event) => ({ kind: event.kind, label: event.label })),
  };
}
