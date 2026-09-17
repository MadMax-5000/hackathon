// Resend email delivery.
// Only runs when RESEND_API_KEY and RESEND_FROM are configured. The key is
// read server-side (Vite middleware) and is never exposed to the browser.

const RESEND_URL = "https://api.resend.com/emails";

export function mailerConfig(env = process.env) {
  const apiKey = env.RESEND_API_KEY || "";
  const from = env.RESEND_FROM || env.RESEND_FROM_EMAIL || "";
  const replyTo = env.RESEND_REPLY_TO || "";
  return { apiKey, from, replyTo, configured: Boolean(apiKey && from) };
}

export async function sendEmail({ to, subject, text, apiKey, from, replyTo }) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.message || payload?.error || `resend-${response.status}`;
    throw new Error(String(detail));
  }
  return { id: payload?.id ?? null };
}
