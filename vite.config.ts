import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createApiMiddleware } from "./server/api.mjs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";

function readBody(req: {
  on: (event: string, listener: (chunk?: unknown) => void) => void;
  destroy: () => void;
}): Promise<string> {
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

type Middleware = (
  req: {
    method?: string;
    on: (event: string, listener: (chunk?: unknown) => void) => void;
    destroy: () => void;
  },
  res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  },
) => void;

function deepseekProxy(env: Record<string, string>): Plugin {
  const apiKey = env.DEEPSEEK_API_KEY;
  const model = env.DEEPSEEK_MODEL || DEFAULT_MODEL;

  const handle: Middleware = async (req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "method-not-allowed" }));
      return;
    }
    if (!apiKey) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "no-key" }));
      return;
    }

    try {
      const parsed = JSON.parse(await readBody(req));
      const messages = Array.isArray(parsed?.messages) ? parsed.messages : null;
      if (!messages) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "bad-request" }));
        return;
      }

      const upstream = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 400,
          stream: false,
          thinking: { type: "disabled" },
        }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        res.statusCode = 502;
        res.end(
          JSON.stringify({ error: "upstream", status: upstream.status, detail: detail.slice(0, 300) }),
        );
        return;
      }

      const data = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      res.statusCode = 200;
      res.end(JSON.stringify({ text }));
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "proxy-error" }));
    }
  };

  return {
    name: "deepseek-copilot-proxy",
    configureServer(server) {
      server.middlewares.use("/api/copilot", handle as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/copilot", handle as never);
    },
  };
}

function c03Database(env: Record<string, string>): Plugin {
  const handler = () => {
    if (env.C03_DB_PATH && !process.env.C03_DB_PATH) {
      process.env.C03_DB_PATH = env.C03_DB_PATH;
    }
    return createApiMiddleware() as never;
  };
  return {
    name: "c03-database",
    configureServer(server) {
      server.middlewares.use("/api", handler());
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api", handler());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), deepseekProxy(env), c03Database(env)],
    server: {
      port: 5173,
      host: true,
    },
  };
});
