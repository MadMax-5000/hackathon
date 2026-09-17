import { createHmac } from "node:crypto";
import { makeReporter } from "./harness.mjs";
import { createDbStore } from "./db-harness.mjs";
import { GateError, DeliveryError } from "../server/service.mjs";
import { verifyResendSignature, mapResendEvent } from "../server/webhooks.mjs";

const { check, finish } = makeReporter("CONTACT SEND");

const realFetch = globalThis.fetch;

function configureMailer(on) {
  if (on) {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "Inspection Desk <desk@example.invalid>";
    process.env.RESEND_REPLY_TO = "replies@example.invalid";
  } else {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.RESEND_REPLY_TO;
  }
}

async function rejects(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
}

console.log("\n[1] No credentials → email falls back to the mock provider (no network)");
{
  configureMailer(false);
  const { store, cleanup } = createDbStore();
  store.approve("TY-1");

  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("network should not be reached");
  };

  const result = await store.sendContact("TY-1", "email", "");
  check("1a  mock provider used", result.provider === "mock", result.provider);
  check("1b  no provider call attempted", called === false);
  const message = result.workspace.contactMessages.find((m) => m.wheelSetId === "TY-1");
  check("1c  message recorded as mock_sent", message?.status === "mock_sent", message?.status);
  check(
    "1d  contact_sent event recorded",
    result.workspace.events.some((e) => e.eventType === "contact_sent"),
  );
  check(
    "1e  event is labelled MOCK",
    result.workspace.events.some((e) => e.eventType === "contact_sent" && /MOCK/i.test(e.label)),
  );
  check(
    "1f  audit states mock delivery",
    result.workspace.audit.some((a) => a.action === "contact_sent" && /MOCK/i.test(a.detail)),
  );
  cleanup();
}

console.log("\n[2] Every message channel can auto-send; Call cannot");
{
  configureMailer(false);
  const { store, cleanup } = createDbStore();
  store.approve("TY-3");
  store.simulateStock("TY-3");

  globalThis.fetch = async () => {
    throw new Error("network should not be reached");
  };

  const whatsapp = await store.sendContact("TY-3", "whatsapp", "hi");
  check(
    "2a  WhatsApp sends via mock",
    whatsapp.provider === "mock" &&
      whatsapp.workspace.contactMessages.some((m) => m.channel === "whatsapp" && m.status === "mock_sent"),
    JSON.stringify(whatsapp.workspace.contactMessages.map((m) => [m.channel, m.status])),
  );

  const sms = await store.sendContact("TY-3", "sms", "hi");
  check(
    "2b  SMS sends via mock",
    sms.provider === "mock" &&
      sms.workspace.contactMessages.some((m) => m.channel === "sms" && m.status === "mock_sent"),
  );

  const callError = await rejects(store.sendContact("TY-1", "phone", "hi"));
  check("2c  Call is rejected as a message channel", callError instanceof DeliveryError, String(callError));
  cleanup();
}

console.log("\n[3] Configured send delivers through Resend and is audited");
{
  configureMailer(true);
  const { store, cleanup } = createDbStore();
  store.approve("TY-1");

  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body), auth: init.headers.Authorization };
    return { ok: true, status: 200, json: async () => ({ id: "resend-id-123" }) };
  };

  const result = await store.sendContact("TY-1", "email", "");
  check("3a  provider endpoint called", captured?.url === "https://api.resend.com/emails", captured?.url);
  check("3b  bearer key sent", captured?.auth === "Bearer re_test_key", captured?.auth);
  check("3c  recipient is the recorded customer email", captured?.body.to?.[0] === "cus-1@example.invalid", JSON.stringify(captured?.body.to));
  check("3d  from address used", captured?.body.from === "Inspection Desk <desk@example.invalid>", captured?.body.from);
  check("3e  subject names the tyre size", /205\/55 R16/.test(captured?.body.subject ?? ""), captured?.body.subject);
  check("3f  default body is generated when blank", /205\/55 R16/.test(captured?.body.text ?? ""), captured?.body.text);

  const ws = result.workspace;
  const message = ws.contactMessages.find((m) => m.wheelSetId === "TY-1");
  check("3g  message stored as sent", message?.status === "sent", message?.status);
  check("3h  provider id returned", result.providerMessageId === "resend-id-123", String(result.providerMessageId));
  check("3i  contact_sent event recorded", ws.events.some((e) => e.eventType === "contact_sent" && e.wheelSetId === "TY-1"));
  check("3j  contact_sent audit recorded", ws.audit.some((a) => a.action === "contact_sent" && a.wheelSetId === "TY-1"));
  check("3k  send reports the resend provider", result.provider === "resend", result.provider);
  cleanup();
}

console.log("\n[4] Provider rejection is recorded as failed, never as sent");
{
  configureMailer(true);
  const { store, cleanup } = createDbStore();
  store.approve("TY-1");

  globalThis.fetch = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ message: "domain not verified" }),
  });

  const error = await rejects(store.sendContact("TY-1", "email", "hello"));
  check("4a  rejected with a DeliveryError", error instanceof DeliveryError, String(error));
  check("4b  provider detail surfaced", /domain not verified/.test(error?.reason ?? ""), error?.reason);

  const ws = store.getWorkspace();
  const message = ws.contactMessages.find((m) => m.wheelSetId === "TY-1");
  check("4c  message stored as send_failed", message?.status === "send_failed", message?.status);
  check("4d  no contact_sent event recorded", !ws.events.some((e) => e.eventType === "contact_sent"));
  check("4e  contact_send_failed audit recorded", ws.audit.some((a) => a.action === "contact_send_failed"));
  cleanup();
}

console.log("\n[5] Automatic send keeps the existing contact gates");
{
  configureMailer(true);
  const { store, cleanup } = createDbStore();

  globalThis.fetch = async () => {
    throw new Error("network should not be reached");
  };

  const error = await rejects(store.sendContact("TY-2", "email", "hello"));
  check("5a  missing-contact case is gated", error instanceof GateError, String(error));
  check("5b  no message stored", store.getWorkspace().contactMessages.length === 0);
  cleanup();
}

console.log("\n[6] Resend webhook signatures are verified");
{
  const secret = "whsec_" + Buffer.from("super-secret-key").toString("base64");
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const id = "msg_1";
  const ts = 1_700_000_000;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  const headers = {
    "svix-id": id,
    "svix-timestamp": String(ts),
    "svix-signature": `v1,${signature}`,
  };

  check("6a  valid signature accepted", verifyResendSignature(body, headers, secret, ts).ok === true);
  check("6b  tampered body rejected", verifyResendSignature(`${body} `, headers, secret, ts).ok === false);
  check(
    "6c  wrong secret rejected",
    verifyResendSignature(body, headers, "whsec_" + Buffer.from("nope").toString("base64"), ts).ok === false,
  );
  check(
    "6d  stale timestamp rejected",
    verifyResendSignature(body, headers, secret, ts + 3600).reason === "stale-timestamp",
  );
  check("6e  missing secret rejected", verifyResendSignature(body, headers, "", ts).reason === "no-secret");
  check(
    "6f  unsupported event has no status",
    mapResendEvent({ type: "email.opened", data: { email_id: "x" } }).status === null,
  );
  check(
    "6g  delivered maps to status",
    mapResendEvent({ type: "email.delivered", data: { email_id: "x" } }).status === "delivered",
  );
}

console.log("\n[7] Delivery webhook updates the sent message");
{
  configureMailer(true);
  const { store, cleanup } = createDbStore();
  store.approve("TY-1");

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: "resend-webhook-1" }),
  });

  await store.sendContact("TY-1", "email", "");
  const result = store.applyDeliveryEvent("resend-webhook-1", "delivered", "email.delivered");
  check("7a  delivery event applied", result.applied === true, JSON.stringify(result));
  const ws = result.workspace;
  const message = ws.contactMessages.find((m) => m.wheelSetId === "TY-1");
  check("7b  message marked delivered", message?.status === "delivered", message?.status);
  check("7c  contact_delivered event recorded", ws.events.some((e) => e.eventType === "contact_delivered"));
  check("7d  contact_delivered audit recorded", ws.audit.some((a) => a.action === "contact_delivered"));
  check(
    "7e  unknown provider id is ignored",
    store.applyDeliveryEvent("does-not-exist", "delivered", "email.delivered").applied === false,
  );
  cleanup();
}

console.log("\n[8] Mock sends are not eligible for delivery webhooks");
{
  configureMailer(false);
  const { store, cleanup } = createDbStore();
  store.approve("TY-1");

  globalThis.fetch = async () => {
    throw new Error("network should not be reached");
  };

  const result = await store.sendContact("TY-1", "email", "");
  const applied = store.applyDeliveryEvent(result.providerMessageId, "delivered", "email.delivered");
  check("8a  delivery event ignored for a mock message", applied.applied === false, JSON.stringify(applied));
  const message = store.getWorkspace().contactMessages.find((m) => m.wheelSetId === "TY-1");
  check("8b  mock message stays mock_sent", message?.status === "mock_sent", message?.status);
  cleanup();
}

globalThis.fetch = realFetch;
process.exit(finish());
