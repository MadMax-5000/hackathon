// Resend delivery webhooks (Svix-signed).
// Verifies the signature server-side and maps provider events onto the
// status of the contact message that was sent.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

const STATUS_BY_EVENT = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
};

export function verifyResendSignature(
  rawBody,
  headers,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret) return { ok: false, reason: "no-secret" };

  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing-headers" };

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale-timestamp" };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  const provided = String(signature)
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  const match = provided.some((value) => {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });

  return match ? { ok: true } : { ok: false, reason: "bad-signature" };
}

export function mapResendEvent(payload) {
  const type = typeof payload?.type === "string" ? payload.type : "";
  const providerMessageId =
    typeof payload?.data?.email_id === "string" ? payload.data.email_id : null;
  return { type, providerMessageId, status: STATUS_BY_EVENT[type] ?? null };
}
