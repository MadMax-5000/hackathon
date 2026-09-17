// Vercel serverless entry point.
// Bundles the C03 database API and the DeepSeek copilot proxy into a single
// catch-all function mounted at /api/*. The Vite build output is served as the
// static frontend, so there is no dev-server middleware in production.
import { createApiMiddleware } from "../server/api.mjs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";

// createApiMiddleware() calls getStore(), which opens and seeds the SQLite
// database. On Vercel C03_DB_PATH points at /tmp (the only writable path).
const store = createApiMiddleware();

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function copilot(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method-not-allowed" });
    return;
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: "no-key" });
    return;
  }
  try {
    const parsed = JSON.parse(await readBody(req));
    const messages = Array.isArray(parsed?.messages) ? parsed.messages : null;
    if (!messages) {
      sendJson(res, 400, { error: "bad-request" });
      return;
    }

    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 400,
        stream: false,
        thinking: { type: "disabled" },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      sendJson(res, 502, {
        error: "upstream",
        status: upstream.status,
        detail: detail.slice(0, 300),
      });
      return;
    }

    const data = await upstream.json();
    sendJson(res, 200, { text: data.choices?.[0]?.message?.content ?? "" });
  } catch {
    sendJson(res, 500, { error: "proxy-error" });
  }
}

export default async function handler(req, res) {
  const path = (req.url || "/").split("?")[0].replace(/\/+$/, "");

  if (path.endsWith("/copilot")) {
    await copilot(req, res);
    return;
  }

  store(req, res, () => sendJson(res, 404, { error: "not-found", path }));
}
