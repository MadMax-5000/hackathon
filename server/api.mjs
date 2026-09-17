import { getStore, GateError } from "./service.mjs";

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

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

// Connect middleware. Mount with server.middlewares.use("/api", handler).
export function createApiMiddleware(store = getStore()) {
  return async function c03Api(req, res, next) {
    let path = req.url || "/";
    const queryIndex = path.indexOf("?");
    if (queryIndex >= 0) path = path.slice(0, queryIndex);
    if (path.startsWith("/api")) path = path.slice(4);
    if (!path.startsWith("/")) path = `/${path}`;
    const segments = path.split("/").filter(Boolean);

    const method = (req.method || "GET").toUpperCase();

    try {
      if (method === "GET" && segments.length === 1 && segments[0] === "state") {
        send(res, 200, store.getWorkspace());
        return;
      }

      if (method === "POST" && segments.length === 1 && segments[0] === "reset") {
        send(res, 200, store.reset());
        return;
      }

      if (segments[0] === "cases" && segments.length >= 3) {
        const wheelSetId = decodeURIComponent(segments[1]);
        const action = segments[2];
        const sub = segments[3];
        const body = method === "POST" ? await readJson(req) : {};

        if (method !== "POST") {
          send(res, 405, { error: "method-not-allowed" });
          return;
        }

        switch (action) {
          case "approve":
            send(res, 200, store.approve(wheelSetId, body.actor));
            return;
          case "reject":
            send(res, 200, store.reject(wheelSetId, body.reason ?? "", body.actor));
            return;
          case "edit":
            send(
              res,
              200,
              store.edit(wheelSetId, Number(body.quantity), String(body.size ?? ""), body.note ?? "", body.actor),
            );
            return;
          case "back-to-review":
            send(res, 200, store.backToReview(wheelSetId, body.actor));
            return;
          case "review-task":
            send(res, 200, store.createReviewTask(wheelSetId, body.note ?? "", body.actor));
            return;
          case "evidence-reviewed":
            send(res, 200, store.markEvidenceReviewed(wheelSetId, body.actor));
            return;
          case "stock":
            if (sub === "simulate") {
              send(res, 200, store.simulateStock(wheelSetId, body.actor));
              return;
            }
            break;
          case "contact":
            if (sub === "draft") {
              const result = store.draftContact(wheelSetId, body.channel, body.body);
              send(res, 200, result);
              return;
            }
            if (sub === "mark-simulated") {
              const result = store.markContactSimulated(wheelSetId, body.channel);
              send(res, 200, result);
              return;
            }
            break;
          default:
            break;
        }
      }

      if (typeof next === "function") {
        next();
        return;
      }
      send(res, 404, { error: "not-found", path });
    } catch (error) {
      if (error instanceof GateError) {
        send(res, 409, { error: "gated", reason: error.gatedReason });
        return;
      }
      send(res, 500, { error: "server-error", detail: String(error?.message ?? error) });
    }
  };
}
