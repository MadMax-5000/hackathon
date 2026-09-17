import { chance, clamp, createRng, gaussian, pick, round, weighted } from "./rng.ts";
import type {
  HistoricalContactChannel,
  HistoricalRecord,
  IssueType,
} from "./types.ts";

// Fixed seed so the synthetic dataset is byte-for-byte reproducible.
// This module NEVER imports initial.json; the generated ids use a HIST- namespace
// that cannot collide with the operational TY-* / CUS-* records.
export const SYNTHETIC_SEED = 20260917;
export const SYNTHETIC_COUNT = 3000;

const TYRE_SIZES = [
  "195/65 R15",
  "205/55 R16",
  "215/60 R16",
  "225/45 R17",
  "225/50 R17",
  "235/55 R18",
];

const ISSUE_WEIGHTS: Array<{ value: IssueType; weight: number }> = [
  { value: "puncture", weight: 0.28 },
  { value: "wear", weight: 0.3 },
  { value: "valve", weight: 0.14 },
  { value: "pressure", weight: 0.16 },
  { value: "sidewall", weight: 0.12 },
];

const CHANNEL_WEIGHTS: Array<{ value: HistoricalContactChannel; weight: number }> = [
  { value: "whatsapp", weight: 0.42 },
  { value: "email", weight: 0.27 },
  { value: "phone", weight: 0.21 },
  { value: "sms", weight: 0.1 },
];

function caseId(index: number): string {
  return `HIST-${String(index + 1).padStart(5, "0")}`;
}

/**
 * Generate the synthetic historical workflow dataset.
 *
 * The generative model deliberately encodes the associations the analytics
 * layer is meant to surface (incomplete evidence and unconfirmed stock push
 * time-to-offer / time-to-contact upward, corrections cluster in incomplete
 * records). Nothing here is measured from a real dealership.
 */
export function generateSyntheticHistory(
  seed: number = SYNTHETIC_SEED,
  count: number = SYNTHETIC_COUNT,
): HistoricalRecord[] {
  const next = createRng(seed);
  const records: HistoricalRecord[] = [];

  for (let index = 0; index < count; index += 1) {
    const issue_type = weighted(next, ISSUE_WEIGHTS);
    const tyre_size = pick(next, TYRE_SIZES);

    const front_flagged = chance(next, 0.62);
    const rear_flagged = chance(next, 0.5);
    const flaggedCount = (front_flagged ? 1 : 0) + (rear_flagged ? 1 : 0);

    const appointment_days_ahead = 1 + Math.floor(next() * 14);
    const appointment_imminent = appointment_days_ahead <= 2;

    const issueMissingBase =
      issue_type === "pressure" ? 0.08 : issue_type === "puncture" ? 0.12 : 0.2;
    const missingBase = issueMissingBase + (appointment_imminent ? 0.1 : 0);
    const measurement_complete = !chance(next, missingBase);
    const contact_available = !chance(next, 0.07);

    const stockConfirmedProbability =
      0.5 +
      0.14 * flaggedCount -
      (measurement_complete ? 0 : 0.05) -
      (appointment_imminent ? 0.08 : 0);
    const stock_confirmed = chance(next, clamp(stockConfirmedProbability, 0.1, 0.92));

    const correctionProbability =
      0.05 +
      (measurement_complete ? 0 : 0.3) +
      (stock_confirmed ? 0 : 0.06) +
      (front_flagged && rear_flagged ? 0.02 : 0);
    const technician_correction = chance(next, clamp(correctionProbability, 0, 0.95));

    const pressurePenalty = Math.max(0, 4 - appointment_days_ahead) * 1.4;
    const hours_to_offer = clamp(
      10 +
        (measurement_complete ? 0 : 38) +
        (contact_available ? 0 : 20) +
        (technician_correction ? 10 : 0) +
        (stock_confirmed ? 0 : 4) +
        pressurePenalty +
        gaussian(next, 0, 8),
      1,
      240,
    );

    const hasOffer = flaggedCount > 0;
    const approvalProbability =
      0.9 - (measurement_complete ? 0 : 0.2) - (technician_correction ? 0.06 : 0);
    const offer_approved = hasOffer && chance(next, clamp(approvalProbability, 0.1, 0.97));
    const offer_rejected =
      hasOffer && !offer_approved && chance(next, measurement_complete ? 0.5 : 0.75);

    const contactLag =
      gaussian(next, 10, 6) +
      (contact_available ? 0 : gaussian(next, 34, 16)) +
      (stock_confirmed ? 0 : gaussian(next, 22, 9));
    const hours_to_customer_contact = clamp(
      hours_to_offer + Math.max(1, contactLag),
      1,
      480,
    );

    const customer_contacted =
      contact_available && offer_approved && chance(next, 0.82);

    const contact_channel: HistoricalContactChannel = customer_contacted
      ? weighted(next, CHANNEL_WEIGHTS)
      : "none";

    const review_task_created = chance(next, measurement_complete ? 0.05 : 0.7);

    const missed_target = hours_to_offer > 48;
    const delay_hours = Math.max(0, hours_to_offer - 48);
    const workflow_completed = customer_contacted && chance(next, 0.86);

    records.push({
      case_id: caseId(index),
      issue_type,
      tyre_size,
      front_flagged,
      rear_flagged,
      measurement_complete,
      contact_available,
      stock_confirmed,
      appointment_days_ahead,
      hours_to_offer: round(hours_to_offer),
      hours_to_customer_contact: round(hours_to_customer_contact),
      technician_correction,
      offer_approved,
      offer_rejected,
      customer_contacted,
      contact_channel,
      review_task_created,
      workflow_completed,
      missed_target,
      delay_hours: round(delay_hours),
    });
  }

  return records;
}
