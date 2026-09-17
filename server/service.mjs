import { getDatabase, inTransaction } from "./db.mjs";
import { seedDatabase, seedIfEmpty } from "./seed.mjs";
import * as repo from "./repository.mjs";

const REVIEW = "review replacement";
const MEASUREMENT_MISSING = "measurement missing";
const SIZE_UNKNOWN = "unknown";
const CONTACT_MISSING = "missing";

const CHANNELS = ["whatsapp", "email", "phone", "sms"];

export class GateError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "GateError";
    this.gatedReason = reason;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function availableChannels(customer) {
  const out = [];
  if (!customer) return out;
  if (customer.whatsapp_available && customer.whatsapp) out.push("whatsapp");
  if (customer.email_available && customer.email) out.push("email");
  if (customer.phone_available && customer.phone) out.push("phone");
  if (customer.sms_available && (customer.phone || customer.whatsapp)) out.push("sms");
  return out;
}

function channelLabel(channel) {
  switch ((channel || "").toLowerCase()) {
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

function mapCustomer(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    smsAvailable: Boolean(row.sms_available),
    phoneAvailable: Boolean(row.phone_available),
    whatsappAvailable: Boolean(row.whatsapp_available),
    emailAvailable: Boolean(row.email_available),
    preferredChannel: row.preferred_channel ?? null,
  };
}

function mapOffer(row) {
  return {
    offerId: row.offer_id,
    wheelSetId: row.wheel_set_id,
    quantity: row.quantity ?? null,
    tyreSize: row.tyre_size ?? null,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    approvedBy: row.approved_by ?? null,
    humanCorrected: Boolean(row.human_corrected),
    aiQuantity: row.ai_quantity ?? null,
    aiSize: row.ai_size ?? null,
    note: row.note ?? "",
    rejectReason: row.reject_reason ?? "",
  };
}

function mapEvent(row) {
  const payload = parsePayload(row.payload);
  return {
    id: row.id,
    wheelSetId: row.wheel_set_id,
    eventType: row.event_type,
    source: row.source,
    label: typeof payload.label === "string" ? payload.label : "",
    payload,
    createdAt: row.created_at,
  };
}

function mapAudit(row) {
  return {
    id: row.id,
    wheelSetId: row.wheel_set_id,
    actor: row.actor,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

function mapContactMessage(row) {
  return {
    id: row.id,
    wheelSetId: row.wheel_set_id,
    channel: row.channel,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
  };
}

function buildRuntime(offerRow, eventRows) {
  const status = offerRow ? offerRow.status : null;
  const taskEvent = [...eventRows].reverse().find((row) => row.eventType === "review_task_created");
  let task = null;
  if (taskEvent) {
    task = {
      createdAt: taskEvent.createdAt ? Date.parse(taskEvent.createdAt) || 0 : 0,
      note: typeof taskEvent.payload?.note === "string" ? taskEvent.payload.note : "",
    };
  }

  return {
    quantity: offerRow ? offerRow.quantity ?? null : null,
    size: offerRow ? offerRow.tyre_size ?? null : null,
    aiQuantity: offerRow ? offerRow.ai_quantity ?? null : null,
    aiSize: offerRow ? offerRow.ai_size ?? null : null,
    note: offerRow ? offerRow.note ?? "" : "",
    humanCorrected: offerRow ? Boolean(offerRow.human_corrected) : false,
    approved: status === "technician_approved" || status === "message_simulated",
    rejected: status === "rejected",
    rejectReason: offerRow ? offerRow.reject_reason ?? "" : "",
    messageSimulated:
      status === "message_simulated" ||
      eventRows.some((row) => row.eventType === "message_simulated"),
    evidenceReviewed: eventRows.some((row) => row.eventType === "evidence_reviewed"),
    task,
    history: eventRows.map((row, index) => ({
      id: `e${index + 1}`,
      kind: row.source,
      label: row.label,
      createdAt: row.createdAt,
      source: row.source,
      eventType: row.eventType,
      simulated: row.source === "simulated",
    })),
  };
}

function buildSource(meta, wheels, stock) {
  return {
    case_id: meta.case_id,
    data_status: meta.data_status,
    clock: meta.clock,
    wheel_sets: wheels.map((wheel) => ({
      id: wheel.wheel_set_id,
      customer_id: wheel.customer_id,
      front: wheel.front_finding,
      rear: wheel.rear_finding,
      size: wheel.tyre_size,
      appointment: wheel.appointment,
      contact: wheel.contact_status,
    })),
    availability: stock.map((row) => ({
      id: row.stock_id,
      size: row.tyre_size,
      units: row.units,
      confirmed: Boolean(row.confirmed),
    })),
    rules: JSON.parse(meta.rules_json),
  };
}

export function createStore(db) {
  seedIfEmpty(db);

  function getWorkspace() {
    const meta = repo.getMeta(db);
    const wheels = repo.listWheelSets(db);
    const stock = repo.listStock(db);
    const customers = repo.listCustomers(db).map(mapCustomer);
    const offers = repo.listOffers(db).map(mapOffer);
    const events = repo.listEvents(db).map(mapEvent);
    const audit = repo.listAudit(db).map(mapAudit);
    const contactMessages = repo.listContactMessages(db).map(mapContactMessage);

    const runtimes = {};
    const stockEvents = {};
    for (const wheel of wheels) {
      const wheelEvents = events.filter((event) => event.wheelSetId === wheel.wheel_set_id);
      const offerRow = repo.getOfferByWheel(db, wheel.wheel_set_id);
      runtimes[wheel.wheel_set_id] = buildRuntime(offerRow, wheelEvents);
      stockEvents[wheel.wheel_set_id] = wheelEvents.some(
        (event) => event.eventType === "stock_confirmed",
      );
    }

    return {
      source: buildSource(meta, wheels, stock),
      overlay: { runtimes, confirmedOverrides: {}, stockEvents },
      customers,
      offers,
      events,
      audit,
      contactMessages,
      stockEvents,
      serverTime: nowIso(),
    };
  }

  function insertEvent(wheelSetId, eventType, source, payload, createdAt) {
    repo.insertEvent(db, { wheelSetId, eventType, source, payload, createdAt });
  }

  function contactGate(wheelSetId, channel) {
    const wheel = repo.getWheelSet(db, wheelSetId);
    if (!wheel) return "Case not found.";
    if (wheel.contact_status === CONTACT_MISSING) {
      return "Customer contact is missing in the supplied record. No channel can be used.";
    }
    const offer = repo.getOfferByWheel(db, wheelSetId);
    if (!offer) return "No approved offer exists for this case.";
    if (offer.status !== "technician_approved" && offer.status !== "message_simulated") {
      return "Customer contact locked until technician approval.";
    }
    const stock = offer.tyre_size ? repo.findStockBySize(db, offer.tyre_size) : null;
    if (stock && !stock.confirmed) return "Customer contact locked until stock is confirmed.";
    const customer = repo.getCustomer(db, wheel.customer_id);
    const channels = availableChannels(customer);
    if (channels.length === 0) return "No usable contact channel is recorded for this customer.";
    if (channel && !channels.includes(String(channel).toLowerCase())) {
      return `Channel ${channelLabel(channel)} is not available for this customer.`;
    }
    return null;
  }

  function approve(wheelSetId, actor = "Technician") {
    inTransaction(db, () => {
      const offer = repo.getOfferByWheel(db, wheelSetId);
      if (!offer) return;
      const createdAt = nowIso();
      repo.updateOffer(db, wheelSetId, {
        status: "technician_approved",
        approved_at: createdAt,
        approved_by: actor,
      });
      insertEvent(wheelSetId, "technician_approved", "human", {
        label: "Technician approved fitment and quantity.",
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "approve",
        detail: `Approved ${offer.quantity ?? "?"} × ${offer.tyre_size ?? "unknown size"}.`,
        createdAt,
      });
    });
    return getWorkspace();
  }

  function reject(wheelSetId, reason = "", actor = "Technician") {
    inTransaction(db, () => {
      const offer = repo.getOfferByWheel(db, wheelSetId);
      if (!offer) return;
      const createdAt = nowIso();
      repo.updateOffer(db, wheelSetId, {
        status: "rejected",
        approved_at: null,
        approved_by: null,
        reject_reason: reason,
      });
      insertEvent(wheelSetId, "proposal_rejected", "human", {
        label: reason
          ? `Rejected — review required. Reason: ${reason}`
          : "Rejected — review required.",
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "reject",
        detail: reason ? `Rejected: ${reason}` : "Rejected — review required.",
        createdAt,
      });
    });
    return getWorkspace();
  }

  function edit(wheelSetId, quantity, size, note = "", actor = "Coordinator") {
    inTransaction(db, () => {
      const offer = repo.getOfferByWheel(db, wheelSetId);
      if (!offer) return;
      const createdAt = nowIso();
      repo.updateOffer(db, wheelSetId, {
        quantity,
        tyre_size: size,
        note,
        human_corrected: 1,
        status: "human_corrected",
        approved_at: null,
        approved_by: null,
      });
      insertEvent(wheelSetId, "proposal_corrected", "human", {
        label: `Human-corrected proposal: ${quantity} × ${size}.`,
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "correct",
        detail: `Corrected to ${quantity} × ${size}.`,
        createdAt,
      });
    });
    return getWorkspace();
  }

  function backToReview(wheelSetId, actor = "Coordinator") {
    inTransaction(db, () => {
      const offer = repo.getOfferByWheel(db, wheelSetId);
      if (!offer) return;
      const createdAt = nowIso();
      repo.updateOffer(db, wheelSetId, {
        status: offer.human_corrected ? "human_corrected" : "proposal_generated",
        approved_at: null,
        approved_by: null,
        reject_reason: "",
      });
      insertEvent(wheelSetId, "returned_to_review", "human", {
        label: "Returned to review — earlier decision undone.",
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "return_to_review",
        detail: "Earlier decision undone; case returned to review.",
        createdAt,
      });
    });
    return getWorkspace();
  }

  function createReviewTask(wheelSetId, note, actor = "Coordinator") {
    inTransaction(db, () => {
      const existing = repo
        .listEventsByWheel(db, wheelSetId)
        .some((row) => row.event_type === "review_task_created");
      if (existing) return;
      const createdAt = nowIso();
      insertEvent(wheelSetId, "review_task_created", "human", {
        label: `Review task created: ${note}`,
        note,
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "review_task",
        detail: note,
        createdAt,
      });
    });
    return getWorkspace();
  }

  function markEvidenceReviewed(wheelSetId, actor = "Coordinator") {
    inTransaction(db, () => {
      const existing = repo
        .listEventsByWheel(db, wheelSetId)
        .some((row) => row.event_type === "evidence_reviewed");
      if (existing) return;
      const createdAt = nowIso();
      insertEvent(wheelSetId, "evidence_reviewed", "human", {
        label: "Evidence reviewed by coordinator.",
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "evidence_reviewed",
        detail: "Coordinator marked the evidence as reviewed.",
        createdAt,
      });
    });
    return getWorkspace();
  }

  function simulateStock(wheelSetId, actor = "Simulated supplier feed") {
    inTransaction(db, () => {
      const offer = repo.getOfferByWheel(db, wheelSetId);
      if (!offer || !offer.tyre_size) return;
      const stock = repo.findStockBySize(db, offer.tyre_size);
      if (!stock || stock.confirmed) return;
      const createdAt = nowIso();
      repo.updateStockConfirmed(db, stock.stock_id, true, createdAt);
      insertEvent(wheelSetId, "stock_confirmed", "simulated", {
        label: "SIMULATION: stock confirmation event received. Stock is now confirmed.",
        stockId: stock.stock_id,
        size: stock.tyre_size,
        units: stock.units,
      }, createdAt);
      repo.insertAudit(db, {
        wheelSetId,
        actor,
        action: "stock_confirmation",
        detail: `${stock.stock_id} ${stock.tyre_size} — ${stock.units} units confirmed (SIMULATED STOCK EVENT).`,
        createdAt,
      });
    });
    return getWorkspace();
  }

  function draftContact(wheelSetId, channel, body, actor = "Coordinator (simulated)") {
    const normalized = String(channel || "").toLowerCase();
    if (!CHANNELS.includes(normalized)) throw new Error(`Unsupported channel: ${channel}`);
    const gate = contactGate(wheelSetId, normalized);
    if (gate) throw new GateError(gate);
    const createdAt = nowIso();
    const messageId = repo.insertContactMessage(db, {
      wheelSetId,
      channel: normalized,
      body,
      status: "draft",
      createdAt,
    });
    insertEvent(wheelSetId, "contact_draft_generated", "simulated", {
      label: `SIMULATED ${channelLabel(normalized)} message generated. Not sent.`,
      channel: normalized,
    }, createdAt);
    repo.insertAudit(db, {
      wheelSetId,
      actor,
      action: "contact_generated",
      detail: `${channelLabel(normalized)} draft generated — SIMULATED, NOT SENT.`,
      createdAt,
    });
    return { messageId, workspace: getWorkspace() };
  }

  function markContactSimulated(wheelSetId, channel, actor = "Coordinator (simulated)") {
    const normalized = String(channel || "").toLowerCase();
    const gate = contactGate(wheelSetId, normalized);
    if (gate) throw new GateError(gate);
    const draft = repo
      .listContactMessagesByWheel(db, wheelSetId)
      .reverse()
      .find((row) => row.channel === normalized && row.status === "draft");
    if (!draft) throw new GateError("Generate a message before marking it as simulated.");
    const createdAt = nowIso();
    repo.updateContactMessageStatus(db, draft.id, "marked_simulated");
    repo.updateOffer(db, wheelSetId, { status: "message_simulated" });
    insertEvent(wheelSetId, "message_simulated", "simulated", {
      label: "SIMULATED customer message generated. Not actually sent.",
      channel: normalized,
    }, createdAt);
    repo.insertAudit(db, {
      wheelSetId,
      actor,
      action: "message_simulated",
      detail: `${channelLabel(normalized)} message marked as simulated. NOT SENT.`,
      createdAt,
    });
    return { messageId: draft.id, workspace: getWorkspace() };
  }

  function reset() {
    seedDatabase(db);
    return getWorkspace();
  }

  return {
    db,
    getWorkspace,
    approve,
    reject,
    edit,
    backToReview,
    createReviewTask,
    markEvidenceReviewed,
    simulateStock,
    draftContact,
    markContactSimulated,
    getContactGate: contactGate,
    reset,
    availableChannels,
  };
}

let defaultStore = null;

export function getStore() {
  if (!defaultStore) defaultStore = createStore(getDatabase());
  return defaultStore;
}

export function resetStoreForTests() {
  defaultStore = null;
}
