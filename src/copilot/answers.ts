import type { DerivedCase } from "../engine/types.ts";
import { CHANNEL_ORDER, channelLabel } from "../engine/contact.ts";
import {
  applicableRulesFor,
  customerMessageLockReason,
  decisionOwnerFor,
  draftCustomerMessage,
  nextActionKind,
  nextStep,
  stockLine,
} from "../engine/workflow.ts";

export type SegmentKind = "source" | "ai" | "human" | "simulated";

export type AnswerSegment = {
  kind: SegmentKind;
  text: string;
};

export type SafeAction = {
  id: string;
  label: string;
  consequential: boolean;
  hint: string;
};

export type CopilotAnswer = {
  intent: string;
  segments: AnswerSegment[];
  groundedIn: string[];
  actions: SafeAction[];
};

const INTENTS: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "risk", patterns: [/risk/i, /careful/i, /before (i )?approv/i, /wrong/i, /double.?check/i, /watch out/i] },
  {
    id: "channel",
    patterns: [
      /whatsapp/i,
      /\be-?mail\b/i,
      /\bsms\b/i,
      /\bphone\b/i,
      /\bcall\b/i,
      /which channel/i,
      /\bchannel\b/i,
      /can i contact/i,
      /why can.?t i contact/i,
      /contact.*(available|unavailable|missing|by|via|channel)/i,
    ],
  },
  { id: "blocked", patterns: [/block/i, /stuck/i, /insufficient/i, /cannot|can't|can not/i, /why not/i] },
  { id: "missing", patterns: [/missing/i, /incomplete/i, /what.*(need|require)/i, /unknown/i, /absent/i] },
  { id: "quantity", patterns: [/quantit/i, /how many/i, /why.*(2|two|1|one)\b/i, /why.*tyre/i, /number of/i] },
  { id: "evidence", patterns: [/evidence/i, /support/i, /source/i, /what.*know/i, /proof/i, /based on/i] },
  { id: "stock", patterns: [/stock/i, /inventory/i, /available/i, /units?\b/i] },
  { id: "approval", patterns: [/approv/i, /technician/i, /sign.?off/i, /decision/i] },
  { id: "message", patterns: [/message/i, /customer/i, /contact/i, /send/i, /offer/i] },
  { id: "rule", patterns: [/rule/i, /policy/i, /allowed/i, /permitted/i] },
  { id: "owner", patterns: [/who.*(decide|approve|own|responsible)/i, /owner/i] },
  { id: "next", patterns: [/next/i, /what should i do/i, /what now/i, /action/i] },
  { id: "changed", patterns: [/changed/i, /since/i, /history/i, /timeline/i, /happened/i] },
  { id: "summary", patterns: [/summary/i, /overview/i, /status/i, /explain/i, /what is this/i] },
];

export function classify(question: string): string {
  const text = question.trim();
  for (const intent of INTENTS) {
    if (intent.patterns.some((pattern) => pattern.test(text))) return intent.id;
  }
  return "summary";
}

function proposalText(item: DerivedCase): string {
  if (item.runtime.quantity != null && item.runtime.size) {
    return `${item.runtime.quantity} × ${item.runtime.size}`;
  }
  return "no proposal quantity";
}

const OPEN_EVIDENCE: SafeAction = {
  id: "open-evidence",
  label: "Open evidence",
  consequential: false,
  hint: "Jump to the evidence explorer.",
};

const PREPARE_PROPOSAL: SafeAction = {
  id: "prepare-proposal",
  label: "Prepare proposal",
  consequential: false,
  hint: "Jump to the decision for this case.",
};

const REVIEW_TASK: SafeAction = {
  id: "create-review-task",
  label: "Create review task",
  consequential: true,
  hint: "Adds a human review task to the timeline.",
};

const CONFIRM_STOCK: SafeAction = {
  id: "confirm-stock",
  label: "Confirm stock (simulated)",
  consequential: true,
  hint: "Opens the labeled stock simulation.",
};

const GENERATE_MESSAGE: SafeAction = {
  id: "generate-message",
  label: "Generate message (simulated)",
  consequential: true,
  hint: "Opens the simulated customer message step.",
};

function uniqueActions(actions: SafeAction[]): SafeAction[] {
  const seen = new Set<string>();
  const out: SafeAction[] = [];
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    out.push(action);
  }
  return out;
}

function nextActions(item: DerivedCase): SafeAction[] {
  if (item.blocked && !item.runtime.task) return [REVIEW_TASK, OPEN_EVIDENCE];
  const kind = nextActionKind(item);
  if (kind === "approve") return [PREPARE_PROPOSAL, OPEN_EVIDENCE];
  if (kind === "stock") return [CONFIRM_STOCK, OPEN_EVIDENCE];
  if (kind === "message") return [GENERATE_MESSAGE, OPEN_EVIDENCE];
  return [OPEN_EVIDENCE];
}

function sourceEvidenceSegments(item: DerivedCase): AnswerSegment[] {
  return [
    { kind: "source", text: `Front observation: ${item.wheel.front}.` },
    { kind: "source", text: `Rear observation: ${item.wheel.rear}.` },
    { kind: "source", text: `Recorded tyre size: ${item.wheel.size}.` },
    { kind: "source", text: `Appointment: ${item.wheel.appointment} (as recorded, not confirmed).` },
    { kind: "source", text: `Customer contact: ${item.wheel.contact}.` },
  ];
}

function stockSegment(item: DerivedCase): AnswerSegment {
  if (item.blocked || item.noAction) {
    return { kind: "ai", text: "Stock is not used on this case." };
  }
  if (!item.stock) {
    return { kind: "source", text: "No matching stock record exists in the supplied synthetic data." };
  }
  const simulated = item.runtime.history.some(
    (event) => event.kind === "simulated" && /stock/i.test(event.label),
  );
  if (item.stock.confirmed && simulated) {
    return {
      kind: "simulated",
      text: `Stock ${item.stock.availabilityId} (${item.stock.units} × ${item.stock.size}) was confirmed through the labeled simulation.`,
    };
  }
  if (item.stock.confirmed) {
    return {
      kind: "source",
      text: `Stock ${item.stock.availabilityId} (${item.stock.units} × ${item.stock.size}) is marked confirmed in the supplied data.`,
    };
  }
  return {
    kind: "ai",
    text: `Stock ${item.stock.availabilityId} (${item.stock.units} × ${item.stock.size}) is reported, not confirmed. ${customerMessageLockReason(item) ?? ""}`.trim(),
  };
}

function buildAnswer(intent: string, item: DerivedCase, rules: string[]): CopilotAnswer {
  switch (intent) {
    case "quantity": {
      const segments: AnswerSegment[] = [];
      if (item.blocked) {
        segments.push({ kind: "source", text: `Front: ${item.wheel.front}; Rear: ${item.wheel.rear}.` });
        segments.push({ kind: "ai", text: "No quantity is proposed because the evidence is insufficient." });
      } else if (item.noAction) {
        segments.push({ kind: "source", text: `Front: ${item.wheel.front}; Rear: ${item.wheel.rear}.` });
        segments.push({ kind: "ai", text: "No quantity is proposed because no axle is marked for review replacement." });
      } else {
        segments.push({
          kind: "ai",
          text: item.whyProposed ?? `${proposalText(item)} proposed from inspection flags.`,
        });
        if (item.runtime.humanCorrected) {
          segments.push({ kind: "human", text: `A coordinator corrected the proposal to ${proposalText(item)}.` });
        }
        if (item.runtime.approved) {
          segments.push({ kind: "human", text: `A technician approved ${proposalText(item)}.` });
        } else {
          segments.push({
            kind: "ai",
            text: "This is still a proposal. A technician must approve, correct, or reject it.",
          });
        }
      }
      return {
        intent,
        segments,
        groundedIn: ["front observation", "rear observation", "inspection flags", "supplied rule 1"],
        actions: nextActions(item),
      };
    }

    case "evidence": {
      const segments = sourceEvidenceSegments(item);
      segments.push(stockSegment(item));
      if (item.whyProposed) segments.push({ kind: "ai", text: item.whyProposed });
      return {
        intent,
        segments,
        groundedIn: ["front observation", "rear observation", "tyre size", "appointment", "contact", "stock row"],
        actions: [OPEN_EVIDENCE, ...(item.blocked && !item.runtime.task ? [REVIEW_TASK] : [])],
      };
    }

    case "missing": {
      const segments: AnswerSegment[] = [];
      const missing: string[] = [...item.blockReasons];
      if (!item.blocked && !item.noAction && !item.runtime.approved && !item.runtime.rejected) {
        missing.push("technician approval");
      }
      if (!item.blocked && !item.noAction && item.stock && !item.stock.confirmed) {
        missing.push(`stock confirmation for ${item.stock.size}`);
      }
      if (!item.blocked && !item.noAction && !item.stock) {
        missing.push("a matching stock record");
      }
      if (item.noAction) {
        segments.push({ kind: "source", text: "Nothing is missing. No concern is recorded, so no offer is required." });
      } else if (missing.length === 0) {
        segments.push({ kind: "source", text: "No required evidence is missing for this case." });
      } else {
        segments.push({ kind: "source", text: `Missing or unconfirmed: ${missing.join("; ")}.` });
      }
      if (item.blocked) {
        segments.push({
          kind: "ai",
          text: "No proposal is prepared until the missing measurement and tyre size are collected.",
        });
      }
      return {
        intent,
        segments,
        groundedIn: ["case block checks", "stock row", "approval state"],
        actions: item.blocked ? [REVIEW_TASK, OPEN_EVIDENCE] : [OPEN_EVIDENCE],
      };
    }

    case "channel": {
      const segments: AnswerSegment[] = [];
      const customer = item.customer;
      if (item.wheel.contact === "missing" || !customer) {
        segments.push({
          kind: "source",
          text: "DATABASE FACT: the stored customer record has contact missing, so no phone, WhatsApp, email or SMS channel is recorded.",
        });
        segments.push({
          kind: "ai",
          text: "AI REASONING: no channel can be used and the offer cannot reach the customer until the record is corrected.",
        });
        if (rules[2]) segments.push({ kind: "source", text: `Rule: ${rules[2]}` });
        return {
          intent,
          segments,
          groundedIn: ["customer record", "contact status"],
          actions: nextActions(item),
        };
      }

      const available = item.availableChannels;
      const list = CHANNEL_ORDER.map(
        (channel) => `${channelLabel(channel)} — ${available.includes(channel) ? "Available" : "Unavailable"}`,
      );
      segments.push({
        kind: "source",
        text: `DATABASE FACT: recorded channels: ${list.join("; ")}.`,
      });
      if (customer.preferredChannel && available.includes(customer.preferredChannel)) {
        segments.push({
          kind: "source",
          text: `DATABASE FACT: the recorded preferred channel is ${channelLabel(customer.preferredChannel)}.`,
        });
      } else {
        segments.push({
          kind: "source",
          text: "DATABASE FACT: no preferred channel is recorded for this customer.",
        });
      }
      segments.push({
        kind: "ai",
        text: item.contactLock
          ? `AI REASONING: contact is currently locked. ${item.contactLock}`
          : "AI REASONING: the offer is approved and the required gates are satisfied, so a channel can be selected.",
      });
      if (item.runtime.messageSimulated) {
        segments.push({
          kind: "simulated",
          text: "SIMULATED ACTION: a message draft was generated and marked simulated. It was not sent.",
        });
      } else if (item.runtime.approved) {
        segments.push({
          kind: "human",
          text: "HUMAN DECISION: a technician approved the offer. Choosing and generating a channel remains a human action.",
        });
      }
      return {
        intent,
        segments,
        groundedIn: ["customer record", "contact channel availability", "approved offer", "message gate"],
        actions: nextActions(item),
      };
    }

    case "blocked": {
      if (!item.blocked) {
        return {
          intent,
          segments: [
            { kind: "source", text: `Status: ${item.status}.` },
            { kind: "ai", text: "This case is not blocked." },
          ],
          groundedIn: ["case status"],
          actions: nextActions(item),
        };
      }
      const segments: AnswerSegment[] = item.blockReasons.map((reason) => ({
        kind: "source" as const,
        text: `Missing evidence: ${reason}.`,
      }));
      segments.push({
        kind: "ai",
        text: "This case is blocked: insufficient evidence. No offer and no customer message can be generated.",
      });
      segments.push({
        kind: "human",
        text: item.runtime.task
          ? `Review task created: ${item.runtime.task.note}`
          : "No review task has been created yet.",
      });
      if (rules[1]) segments.push({ kind: "source", text: `Rule: ${rules[1]}` });
      return {
        intent,
        segments,
        groundedIn: ["block reasons", "review task state", "supplied rule 2"],
        actions: [REVIEW_TASK, OPEN_EVIDENCE],
      };
    }

    case "next": {
      return {
        intent,
        segments: [
          { kind: "ai", text: nextStep(item) },
          { kind: "ai", text: decisionOwnerFor(item) },
        ],
        groundedIn: ["workflow state", "decision ownership"],
        actions: nextActions(item),
      };
    }

    case "changed": {
      return {
        intent,
        segments: item.runtime.history.map((event) => ({ kind: event.kind, text: event.label })),
        groundedIn: ["case timeline"],
        actions: [OPEN_EVIDENCE],
      };
    }

    case "risk": {
      const segments: AnswerSegment[] = [{ kind: "ai", text: "Before approving, check the following." }];
      for (const uncertainty of item.uncertainties) {
        segments.push({ kind: "ai", text: uncertainty });
      }
      if (item.stock && !item.stock.confirmed) {
        segments.push({
          kind: "simulated",
          text: "Stock confirmation is only available through the labeled simulation.",
        });
      }
      segments.push({
        kind: "ai",
        text: "Approval is a human decision, and only approved offers may become customer messages.",
      });
      return {
        intent,
        segments,
        groundedIn: ["uncertainties", "stock state", "supplied rules"],
        actions: uniqueActions([...nextActions(item), OPEN_EVIDENCE]),
      };
    }

    case "stock": {
      const segments: AnswerSegment[] = [stockSegment(item)];
      if (!item.blocked && !item.noAction && item.stock && item.stock.confirmed) {
        segments.push({
          kind: "ai",
          text: "Stock is confirmed, so the customer message step is not blocked by stock.",
        });
      }
      return {
        intent,
        segments,
        groundedIn: ["stock row", "stock event history"],
        actions: item.stock
          ? uniqueActions([
              ...(item.runtime.approved && !item.stock.confirmed ? [CONFIRM_STOCK] : []),
              OPEN_EVIDENCE,
            ])
          : [OPEN_EVIDENCE],
      };
    }

    case "approval": {
      const segments: AnswerSegment[] = [];
      if (item.noAction) {
        segments.push({ kind: "ai", text: "No approval is needed — no offer is required." });
      } else if (item.blocked) {
        segments.push({
          kind: "ai",
          text: "A technician cannot decide yet because the evidence is incomplete.",
        });
      } else if (item.runtime.rejected) {
        segments.push({
          kind: "human",
          text: item.runtime.rejectReason
            ? `A human rejected the proposal: ${item.runtime.rejectReason}`
            : "A human rejected the proposal. Review is required.",
        });
      } else if (item.runtime.approved) {
        segments.push({
          kind: "human",
          text: `A technician approved ${proposalText(item)}${item.runtime.note ? ` · ${item.runtime.note}` : ""}.`,
        });
      } else {
        segments.push({
          kind: "ai",
          text: `Awaiting technician approval for ${proposalText(item)}. This is a proposal, not a decision.`,
        });
        if (rules[0]) segments.push({ kind: "source", text: `Rule: ${rules[0]}` });
      }
      return {
        intent,
        segments,
        groundedIn: ["approval state", "supplied rule 1"],
        actions: nextActions(item),
      };
    }

    case "message": {
      const lock = customerMessageLockReason(item);
      const segments: AnswerSegment[] = [];
      if (lock) {
        segments.push({ kind: "ai", text: `No customer message can be generated yet. ${lock}` });
        if (rules[2]) segments.push({ kind: "source", text: `Rule: ${rules[2]}` });
      } else {
        const draft = draftCustomerMessage(item);
        segments.push({ kind: "ai", text: `Draft (SIMULATED, not sent): ${draft}` });
        if (item.runtime.messageSimulated) {
          segments.push({
            kind: "simulated",
            text: "A simulated customer message was generated. It was not actually sent.",
          });
        }
      }
      return {
        intent,
        segments,
        groundedIn: ["message gate", "approval state", "stock state"],
        actions: nextActions(item),
      };
    }

    case "rule": {
      const applicable = applicableRulesFor(item, rules);
      return {
        intent,
        segments:
          applicable.length === 0
            ? [{ kind: "source", text: "No supplied rule applies to a no-concern record." }]
            : applicable.map((rule) => ({ kind: "source" as const, text: `Rule: ${rule}` })),
        groundedIn: ["supplied rules"],
        actions: [],
      };
    }

    case "owner": {
      return {
        intent,
        segments: [{ kind: "ai", text: decisionOwnerFor(item) }],
        groundedIn: ["workflow state", "decision ownership"],
        actions: nextActions(item),
      };
    }

    default: {
      const segments: AnswerSegment[] = [
        {
          kind: "source",
          text: `${item.wheel.id} · ${item.wheel.customer_id} · ${item.wheel.appointment}.`,
        },
        ...sourceEvidenceSegments(item),
        { kind: "ai", text: `Status: ${item.status}.` },
      ];
      if (item.whyProposed) segments.push({ kind: "ai", text: item.whyProposed });
      const stock = stockLine(item);
      if (stock) segments.push({ kind: "source", text: `Stock: ${stock}.` });
      return {
        intent: "summary",
        segments,
        groundedIn: ["case fields", "case status"],
        actions: nextActions(item),
      };
    }
  }
}

export function answerQuestion(question: string, item: DerivedCase, rules: string[]): CopilotAnswer {
  return buildAnswer(classify(question), item, rules);
}

export function suggestedQuestions(item: DerivedCase): string[] {
  const questions: string[] = [];
  if (item.blocked) {
    questions.push("Why is this case blocked?");
    questions.push("What information is missing?");
  } else if (!item.noAction && item.runtime.quantity != null) {
    questions.push(`Why ${item.runtime.quantity} tyre${item.runtime.quantity === 1 ? "" : "s"}?`);
  }
  if (!item.blocked && !item.noAction) {
    questions.push("Which channel should I use?");
  }
  questions.push("What evidence supports this proposal?");
  questions.push("What should I do next?");
  questions.push("What changed since the inspection?");
  questions.push("What risk should I check before approving?");
  return questions.slice(0, 5);
}

export function suggestedActions(item: DerivedCase): SafeAction[] {
  const actions: SafeAction[] = [OPEN_EVIDENCE];
  if (item.blocked && !item.runtime.task) actions.push(REVIEW_TASK);
  if (!item.blocked && !item.noAction && !item.runtime.approved && !item.runtime.rejected) {
    actions.push(PREPARE_PROPOSAL);
  }
  if (item.runtime.approved && item.stock && !item.stock.confirmed) actions.push(CONFIRM_STOCK);
  if (item.runtime.approved && (!item.stock || item.stock.confirmed) && !item.runtime.messageSimulated) {
    actions.push(GENERATE_MESSAGE);
  }
  if (!item.runtime.evidenceReviewed) {
    actions.push({
      id: "mark-evidence-reviewed",
      label: "Mark evidence reviewed",
      consequential: false,
      hint: "Adds a human event to the timeline.",
    });
  }
  if (item.stock) {
    actions.push({
      id: "show-affected-cases",
      label: "Show affected cases",
      consequential: false,
      hint: `Cases using stock ${item.stock.size}.`,
    });
  }
  return uniqueActions(actions).slice(0, 4);
}

export function hintFor(item: DerivedCase): string | null {
  if (item.blocked) {
    return `Missing: ${item.blockReasons.join("; ")}. No proposal can be prepared yet.`;
  }
  if (item.noAction) {
    return "Front and rear have no concern recorded. No offer is needed.";
  }
  if (item.runtime.rejected) {
    return item.runtime.rejectReason
      ? `Rejected — ${item.runtime.rejectReason}`
      : "Rejected — review required before any customer contact.";
  }
  if (!item.runtime.approved) {
    if (item.runtime.humanCorrected) {
      return "You corrected the proposal. Approve it, correct further, or reject.";
    }
    return null;
  }
  if (item.stock && !item.stock.confirmed) {
    return "The offer is approved. Stock is still reported, not confirmed.";
  }
  if (!item.runtime.messageSimulated) {
    return "The offer is approved and the customer message is ready to generate.";
  }
  return "Demo path complete for this case.";
}
