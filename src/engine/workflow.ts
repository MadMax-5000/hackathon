import type {
  Availability,
  CaseRuntime,
  CaseTask,
  CustomerContact,
  DerivedCase,
  HistoryEvent,
  HistoryKind,
  InitialData,
  Insight,
  InsightTone,
  NextActionKind,
  OfferState,
  QueueGroup,
  QueueGroupView,
  QueuePriority,
  ReviewTask,
  RuntimeOverlay,
  StockView,
  WheelSet,
  WorkflowState,
} from "./types";
import { availableChannels, contactLockReason } from "./contact.ts";

const REVIEW = "review replacement";
const MEASUREMENT_MISSING = "measurement missing";
const SIZE_UNKNOWN = "unknown";
const CONTACT_MISSING = "missing";

type CaseFacts = Omit<
  DerivedCase,
  "queueGroup" | "uncertainties" | "decisionOwner" | "priority" | "customer" | "availableChannels" | "contactLock"
>;

export function appointmentDay(appointment: string): number {
  const match = appointment.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function isReviewReplacement(value: string): boolean {
  return value === REVIEW;
}

export function proposedQuantityFromInspection(wheel: WheelSet): number {
  return [wheel.front, wheel.rear].filter(isReviewReplacement).length;
}

export function getBlockReasons(wheel: WheelSet): string[] {
  const reasons: string[] = [];
  if (wheel.front === MEASUREMENT_MISSING || wheel.rear === MEASUREMENT_MISSING) {
    reasons.push("tyre measurement missing");
  }
  if (!wheel.size || wheel.size.toLowerCase() === SIZE_UNKNOWN) {
    reasons.push("tyre size unknown");
  }
  if (wheel.contact === CONTACT_MISSING) {
    reasons.push("customer contact unavailable");
  }
  return reasons;
}

export function concernSummary(wheel: WheelSet): string {
  const parts: string[] = [];
  if (isReviewReplacement(wheel.front) && isReviewReplacement(wheel.rear)) {
    return "Front and rear: review replacement";
  }
  if (isReviewReplacement(wheel.front)) parts.push("Front: review replacement");
  if (isReviewReplacement(wheel.rear)) parts.push("Rear: review replacement");
  if (wheel.front === MEASUREMENT_MISSING) parts.push("Front: measurement missing");
  if (wheel.rear === MEASUREMENT_MISSING) parts.push("Rear: measurement missing");
  if (parts.length === 0) return "No concern recorded";
  return parts.join(" · ");
}

export function whyQuantityProposed(wheel: WheelSet, quantity: number): string {
  const front = isReviewReplacement(wheel.front);
  const rear = isReviewReplacement(wheel.rear);
  if (front && rear) {
    return "Front and rear are both marked for review replacement. Current proposal = 2 units.";
  }
  if (front) {
    return "Front is marked for review replacement. Rear has no concern recorded. Current proposal = 1 unit.";
  }
  if (rear) {
    return "Rear is marked for review replacement. Front has no concern recorded. Current proposal = 1 unit.";
  }
  return `Current proposal = ${quantity} unit${quantity === 1 ? "" : "s"} based on inspection flags marked for review replacement.`;
}

export function appendHistory(runtime: CaseRuntime, kind: HistoryKind, label: string): CaseRuntime {
  const event: HistoryEvent = {
    id: `e${runtime.history.length + 1}`,
    kind,
    label,
  };
  return { ...runtime, history: [...runtime.history, event] };
}

function startingHistory(blocked: boolean, quantity: number, knownSize: string | null): HistoryEvent[] {
  const loaded: HistoryEvent = {
    id: "e1",
    kind: "source",
    label: "Inspection detected — front and rear observations loaded from synthetic exercise data.",
  };
  if (blocked) {
    return [
      loaded,
      {
        id: "e2",
        kind: "ai",
        label: "Offer blocked: insufficient evidence. No proposal generated. Review task required.",
      },
    ];
  }
  if (quantity === 0 || !knownSize) {
    return [
      loaded,
      {
        id: "e2",
        kind: "ai",
        label: "No concern recorded. No offer proposed.",
      },
    ];
  }
  return [
    loaded,
    {
      id: "e2",
      kind: "ai",
      label: `AI proposal generated: ${quantity} × ${knownSize} from ${quantity} axle${quantity === 1 ? "" : "s"} marked review replacement. Pending technician approval.`,
    },
  ];
}

export function queuePriority(derived: Pick<DerivedCase, "noAction" | "blocked" | "urgent">): QueuePriority {
  if (derived.noAction) return "No action";
  if (derived.blocked) return "Missing evidence";
  if (derived.urgent) return "Urgent";
  return "Review";
}

export function customerMessageLockReason(derived: DerivedCase): string | null {
  if (derived.blocked) return "No offer can be generated until missing evidence is collected.";
  if (derived.noAction) return "No customer message — no offer is required.";
  if (derived.runtime.rejected) return "Customer message locked. Proposal was rejected.";
  if (!derived.runtime.approved) return "Customer message locked until technician approval.";
  if (derived.stock && !derived.stock.confirmed) return "Customer message locked until stock is confirmed.";
  if (derived.runtime.quantity == null || !derived.runtime.size) {
    return "Customer message locked — quantity or size is missing.";
  }
  return null;
}

export function nextStep(derived: DerivedCase): string {
  if (derived.blocked) return "Collect the missing measurement and confirm tyre size before an offer can be prepared.";
  if (derived.noAction) return "No further action on this record.";
  if (derived.runtime.rejected) return "Review the rejection before any customer message.";
  if (!derived.runtime.approved) return "Approve, correct, or reject the proposed offer.";
  if (derived.stock && !derived.stock.confirmed) return "Confirm stock to unlock the customer message.";
  if (!derived.runtime.messageSimulated) return "Generate the SIMULATED customer message.";
  return "Demo path complete for this case.";
}

export function nextActionKind(item: DerivedCase): NextActionKind {
  if (item.blocked || item.noAction || item.runtime.rejected) return null;
  if (!item.runtime.approved) return "approve";
  if (item.stock && !item.stock.confirmed) return "stock";
  if (!customerMessageLockReason(item) && !item.runtime.messageSimulated) return "message";
  return null;
}

export function heroHeadline(item: DerivedCase): string {
  if (item.blocked || item.noAction) return "No offer";
  if (item.runtime.quantity != null && item.runtime.size) {
    return `${item.runtime.quantity} × ${item.runtime.size}`;
  }
  return item.wheel.id;
}

export function stockLine(item: DerivedCase): string | null {
  if (item.blocked || item.noAction) return null;
  if (!item.stock) return "No matching stock record in the supplied data.";
  if (item.stock.confirmed) return `${item.stock.units} units confirmed`;
  return `${item.stock.units} units reported · Confirmation pending`;
}

export function lookupStock(
  size: string | null,
  availability: Availability[],
  confirmedOverrides: Record<string, boolean>,
): StockView | null {
  if (!size || size.toLowerCase() === SIZE_UNKNOWN) return null;
  const item = availability.find((entry) => entry.size === size);
  if (!item) return null;
  return {
    availabilityId: item.id,
    size: item.size,
    units: item.units,
    confirmed: confirmedOverrides[item.id] ?? item.confirmed,
    source: "reported",
  };
}

export function initialRuntime(wheel: WheelSet): CaseRuntime {
  const blocked = getBlockReasons(wheel).length > 0;
  const quantity = proposedQuantityFromInspection(wheel);
  const knownSize = wheel.size && wheel.size.toLowerCase() !== SIZE_UNKNOWN ? wheel.size : null;

  if (blocked || quantity === 0 || !knownSize) {
    return {
      quantity: null,
      size: null,
      aiQuantity: null,
      aiSize: null,
      note: "",
      humanCorrected: false,
      approved: false,
      rejected: false,
      rejectReason: "",
      messageSimulated: false,
      evidenceReviewed: false,
      task: null,
      history: startingHistory(blocked, quantity, knownSize),
    };
  }

  return {
    quantity,
    size: knownSize,
    aiQuantity: quantity,
    aiSize: knownSize,
    note: "",
    humanCorrected: false,
    approved: false,
    rejected: false,
    rejectReason: "",
    messageSimulated: false,
    evidenceReviewed: false,
    task: null,
    history: startingHistory(blocked, quantity, knownSize),
  };
}

function resolveStatus(input: {
  blocked: boolean;
  noAction: boolean;
  runtime: CaseRuntime;
  stock: StockView | null;
}): WorkflowState {
  const { blocked, noAction, runtime, stock } = input;
  if (blocked) return "Blocked: insufficient evidence";
  if (noAction) return "No action required";
  if (runtime.rejected) return "Rejected";
  if (runtime.messageSimulated) return "Message simulated";
  if (runtime.approved) {
    if (stock && !stock.confirmed) return "Approved";
    return "Ready for customer message";
  }
  return "Pending technician approval";
}

function resolveOfferState(input: {
  blocked: boolean;
  noAction: boolean;
  runtime: CaseRuntime;
}): OfferState {
  const { blocked, noAction, runtime } = input;
  if (blocked) return "Blocked";
  if (noAction) return "No offer";
  if (runtime.rejected) return "Rejected — review required";
  if (runtime.messageSimulated) return "Message simulated";
  if (runtime.approved) return "Technician approved";
  if (runtime.humanCorrected) return "Human-corrected proposal";
  return "Proposal generated";
}

export function resolveQueueGroup(input: {
  blocked: boolean;
  noAction: boolean;
  urgent: boolean;
  runtime: CaseRuntime;
  stock: StockView | null;
}): QueueGroup {
  const { blocked, noAction, urgent, runtime, stock } = input;
  if (noAction) return "No action required";
  if (blocked) return "Missing evidence";
  if (runtime.messageSimulated) return "Complete";
  if (runtime.rejected) return "Awaiting technician";
  if (!runtime.approved) return urgent ? "Urgent" : "Awaiting technician";
  if (stock && !stock.confirmed) return "Awaiting stock";
  return "Ready for customer";
}

export function uncertaintiesFor(item: CaseFacts): string[] {
  const out: string[] = [];
  if (item.noAction) {
    return ["No concern recorded on front or rear — no offer is required."];
  }
  for (const reason of item.blockReasons) {
    out.push(`Missing source evidence: ${reason}.`);
  }
  if (item.blocked) {
    out.push("No proposal can be prepared until the missing evidence is collected.");
  }
  if (!item.blocked && !item.runtime.approved && !item.runtime.rejected) {
    out.push("Fitment and required quantity are not yet approved by a technician.");
  }
  if (item.runtime.humanCorrected && item.runtime.quantity !== item.runtime.aiQuantity) {
    out.push(
      `A coordinator corrected the proposal from the AI value (${item.runtime.aiQuantity ?? "none"}${
        item.runtime.aiSize ? ` × ${item.runtime.aiSize}` : ""
      }).`,
    );
  }
  if (!item.blocked && item.stock && !item.stock.confirmed) {
    out.push(`Stock for ${item.stock.size} is reported, not confirmed. Confirmation is a labeled simulation.`);
  }
  if (!item.blocked && !item.stock) {
    out.push("No matching stock record exists in the supplied synthetic data.");
  }
  if (item.runtime.rejected) {
    out.push(
      item.runtime.rejectReason
        ? `Proposal rejected — ${item.runtime.rejectReason}`
        : "Proposal rejected — review required.",
    );
  }
  out.push("Appointment time is as recorded in synthetic data; it is not a confirmed booking.");
  return out;
}

export function applicableRulesFor(item: CaseFacts, rules: string[]): string[] {
  if (item.noAction) return [];
  const out: string[] = [];
  if (rules[0]) out.push(rules[0]);
  if (item.blocked && rules[1]) out.push(rules[1]);
  if (rules[2]) out.push(rules[2]);
  return out;
}

export function decisionOwnerFor(item: CaseFacts): string {
  if (item.noAction) return "No decision required — no offer is needed.";
  if (item.blocked) return "Coordinator — collect the missing evidence. No technician decision is possible yet.";
  if (item.runtime.rejected) return "Technician or coordinator — review the rejection before any customer contact.";
  if (!item.runtime.approved) return "Technician — approve, correct, or reject the proposed fitment and quantity.";
  if (item.stock && !item.stock.confirmed) {
    return "Coordinator — wait for or simulate stock confirmation. The technician decision is already recorded.";
  }
  if (!item.runtime.messageSimulated) return "Coordinator — generate the SIMULATED customer message.";
  return "Complete — no further decision on this case.";
}

export function deriveCase(
  wheel: WheelSet,
  availability: Availability[],
  runtime: CaseRuntime,
  confirmedOverrides: Record<string, boolean>,
  urgentId: string | null,
  customer: CustomerContact | null = null,
): DerivedCase {
  const blockReasons = getBlockReasons(wheel);
  const blocked = blockReasons.length > 0;
  const quantityFromInspection = proposedQuantityFromInspection(wheel);
  const noAction = !blocked && quantityFromInspection === 0;
  const sizeForStock = blocked || noAction ? runtime.size : (runtime.size ?? wheel.size);
  const stock = lookupStock(sizeForStock, availability, confirmedOverrides);
  const channels = availableChannels(customer);

  const base: CaseFacts = {
    wheel,
    appointmentDay: appointmentDay(wheel.appointment),
    concernSummary: concernSummary(wheel),
    blockReasons,
    blocked,
    noAction,
    reviewTask: blocked
      ? "Collect missing measurement and confirm tyre size before preparing offer."
      : null,
    stock,
    runtime,
    status: resolveStatus({ blocked, noAction, runtime, stock }),
    offerState: resolveOfferState({ blocked, noAction, runtime }),
    urgent: wheel.id === urgentId,
    whyProposed:
      !blocked && !noAction && runtime.aiQuantity != null
        ? whyQuantityProposed(wheel, runtime.aiQuantity)
        : null,
  };

  const derived: DerivedCase = {
    ...base,
    priority: queuePriority(base),
    queueGroup: resolveQueueGroup({
      blocked,
      noAction,
      urgent: base.urgent,
      runtime,
      stock,
    }),
    uncertainties: uncertaintiesFor(base),
    decisionOwner: decisionOwnerFor(base),
    customer,
    availableChannels: channels,
    contactLock: contactLockReason({
      blocked,
      noAction,
      runtime,
      stock,
      wheel,
      customer,
      channels,
    }),
  };

  return derived;
}

export function priorityRank(derived: DerivedCase): [number, number] {
  let category = 1;
  if (derived.noAction) category = 4;
  else if (derived.blocked) category = 3;
  else if (derived.status === "Pending technician approval" || derived.runtime.humanCorrected) category = 2;
  else category = 1;
  return [derived.appointmentDay, category];
}

export function sortCases(cases: DerivedCase[]): DerivedCase[] {
  return [...cases].sort((a, b) => {
    const [dayA, catA] = priorityRank(a);
    const [dayB, catB] = priorityRank(b);
    if (dayA !== dayB) return dayA - dayB;
    return catA - catB;
  });
}

export function findUrgentId(wheels: WheelSet[]): string | null {
  const actionable = wheels
    .filter((wheel) => {
      const blocked = getBlockReasons(wheel).length > 0;
      const quantity = proposedQuantityFromInspection(wheel);
      return !blocked && quantity > 0;
    })
    .sort((a, b) => appointmentDay(a.appointment) - appointmentDay(b.appointment));
  return actionable[0]?.id ?? null;
}

export function createInitialRuntimes(data: InitialData): Record<string, CaseRuntime> {
  return Object.fromEntries(data.wheel_sets.map((wheel) => [wheel.id, initialRuntime(wheel)]));
}

const GROUP_ORDER: QueueGroup[] = [
  "Urgent",
  "Missing evidence",
  "Awaiting technician",
  "Awaiting stock",
  "Ready for customer",
  "Complete",
  "No action required",
];

export function groupCases(cases: DerivedCase[]): QueueGroupView[] {
  return GROUP_ORDER.map((group) => ({
    group,
    cases: cases.filter((item) => item.queueGroup === group),
  })).filter((entry) => entry.cases.length > 0);
}

export function deriveTasks(cases: DerivedCase[]): CaseTask[] {
  return cases
    .filter((item) => item.runtime.task)
    .map((item) => ({
      case: item,
      note: item.runtime.task!.note,
      createdAt: item.runtime.task!.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt || a.case.wheel.id.localeCompare(b.case.wheel.id));
}

export function casesNeedingTask(cases: DerivedCase[]): DerivedCase[] {
  return cases.filter((item) => item.blocked && !item.runtime.task);
}

export function casesNeedingAttention(cases: DerivedCase[]): DerivedCase[] {
  return cases.filter(
    (item) => item.queueGroup !== "Complete" && item.queueGroup !== "No action required",
  );
}

const INSIGHT_RANK: Record<InsightTone, number> = {
  urgent: 0,
  bad: 1,
  action: 2,
  warn: 3,
  ok: 4,
  muted: 5,
};

export function deriveInsights(cases: DerivedCase[]): Insight[] {
  const insights: Insight[] = [];
  for (const item of cases) {
    if (item.noAction) continue;
    const qty =
      item.runtime.quantity != null && item.runtime.size
        ? `${item.runtime.quantity} × ${item.runtime.size}`
        : null;

    if (item.blocked) {
      insights.push({
        id: `${item.wheel.id}-missing`,
        caseId: item.wheel.id,
        tone: "bad",
        icon: "alert",
        title: `${item.wheel.appointment} appointment · missing evidence`,
        detail: `${item.wheel.id} — ${item.blockReasons.join(", ")}. No offer can be prepared.`,
      });
      continue;
    }

    if (item.runtime.rejected) {
      insights.push({
        id: `${item.wheel.id}-rejected`,
        caseId: item.wheel.id,
        tone: "warn",
        icon: "info",
        title: "Proposal rejected — review required",
        detail: `${item.wheel.id} — no customer message is allowed until the rejection is reviewed.`,
      });
      continue;
    }

    if (!item.runtime.approved) {
      insights.push({
        id: `${item.wheel.id}-approval`,
        caseId: item.wheel.id,
        tone: item.urgent ? "urgent" : "action",
        icon: item.urgent ? "clock" : "tyre",
        title: item.urgent
          ? `Urgent · ${item.wheel.appointment} appointment`
          : "Proposal awaiting technician approval",
        detail: qty
          ? `${item.wheel.id} — ${qty} proposed, not yet approved.`
          : `${item.wheel.id} — awaiting technician decision.`,
      });
      continue;
    }

    if (item.stock && !item.stock.confirmed) {
      insights.push({
        id: `${item.wheel.id}-stock`,
        caseId: item.wheel.id,
        tone: "warn",
        icon: "cube",
        title: "Approved proposal awaiting stock confirmation",
        detail: `${item.wheel.id} — ${qty} approved · stock reported, not confirmed (simulated).`,
      });
      continue;
    }

    if (!item.runtime.messageSimulated) {
      insights.push({
        id: `${item.wheel.id}-message`,
        caseId: item.wheel.id,
        tone: "ok",
        icon: "mail",
        title: "Customer conversation ready",
        detail: `${item.wheel.id} — ${qty} approved and stock confirmed. Generate the simulated message.`,
      });
    }
  }
  return insights.sort((a, b) => INSIGHT_RANK[a.tone] - INSIGHT_RANK[b.tone]);
}

export function draftCustomerMessage(derived: DerivedCase): string | null {
  if (!derived.runtime.approved || derived.runtime.quantity == null || !derived.runtime.size) {
    return null;
  }
  if (derived.stock && !derived.stock.confirmed) return null;
  return `Hello — we inspected your wheel set. A technician approved a replacement of ${derived.runtime.quantity} × ${derived.runtime.size}. Next step: contact us to confirm your ${derived.wheel.appointment} appointment.`;
}

export function simulateStockConfirmation(
  state: RuntimeOverlay,
  wheelId: string,
  data: InitialData,
): RuntimeOverlay {
  const runtime = state.runtimes[wheelId];
  const wheel = data.wheel_sets.find((entry) => entry.id === wheelId);
  if (!runtime || !wheel) return state;

  const derived = deriveCase(wheel, data.availability, runtime, state.confirmedOverrides, null);
  const stock = derived.stock;
  if (!stock) return state;

  const row = data.availability.find((entry) => entry.id === stock.availabilityId);
  if (!row || row.size !== stock.size) return state;

  return {
    runtimes: {
      ...state.runtimes,
      [wheelId]: appendHistory(
        runtime,
        "simulated",
        "SIMULATION: stock confirmation event received. Stock is now confirmed.",
      ),
    },
    confirmedOverrides: { ...state.confirmedOverrides, [row.id]: true },
    stockEvents: { ...state.stockEvents, [wheelId]: true },
  };
}

export function simulateMessage(state: RuntimeOverlay, wheelId: string): RuntimeOverlay {
  const runtime = state.runtimes[wheelId];
  if (!runtime || !runtime.approved) return state;

  return {
    ...state,
    runtimes: {
      ...state.runtimes,
      [wheelId]: appendHistory(
        { ...runtime, messageSimulated: true },
        "simulated",
        "SIMULATED customer message generated. Not actually sent.",
      ),
    },
  };
}

export function markEvidenceReviewed(state: RuntimeOverlay, wheelId: string): RuntimeOverlay {
  const runtime = state.runtimes[wheelId];
  if (!runtime || runtime.evidenceReviewed) return state;

  return {
    ...state,
    runtimes: {
      ...state.runtimes,
      [wheelId]: appendHistory(
        { ...runtime, evidenceReviewed: true },
        "human",
        "Evidence reviewed by coordinator.",
      ),
    },
  };
}

export function createReviewTask(state: RuntimeOverlay, wheelId: string, note: string): RuntimeOverlay {
  const runtime = state.runtimes[wheelId];
  if (!runtime || runtime.task) return state;

  const task: ReviewTask = { createdAt: runtime.history.length + 1, note };
  return {
    ...state,
    runtimes: {
      ...state.runtimes,
      [wheelId]: appendHistory({ ...runtime, task }, "human", `Review task created: ${note}`),
    },
  };
}
