import type { ContactChannel, CustomerContact, InitialData, RuntimeOverlay } from "../engine/types";

export type OfferRow = {
  offerId: string;
  wheelSetId: string;
  quantity: number | null;
  tyreSize: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  humanCorrected: boolean;
  aiQuantity: number | null;
  aiSize: string | null;
  note: string;
  rejectReason: string;
};

export type EventRow = {
  id: number;
  wheelSetId: string;
  eventType: string;
  source: string;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AuditRow = {
  id: number;
  wheelSetId: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type ContactMessageRow = {
  id: number;
  wheelSetId: string;
  channel: ContactChannel;
  body: string;
  status:
    | "draft"
    | "marked_simulated"
    | "sent"
    | "mock_sent"
    | "send_failed"
    | "delivered"
    | "bounced"
    | "complained"
    | "delayed";
  createdAt: string;
};

export type Workspace = {
  source: InitialData;
  overlay: RuntimeOverlay;
  customers: CustomerContact[];
  offers: OfferRow[];
  events: EventRow[];
  audit: AuditRow[];
  contactMessages: ContactMessageRow[];
  stockEvents: Record<string, boolean>;
  serverTime: string;
};

type ApiPayload = Workspace | { workspace: Workspace };

function unwrap(payload: ApiPayload): Workspace {
  if (payload && typeof payload === "object" && "workspace" in payload) return payload.workspace;
  return payload as Workspace;
}

async function request(path: string, init?: RequestInit): Promise<Workspace> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => ({}))) as ApiPayload & {
    error?: string;
    reason?: string;
  };
  if (!response.ok) {
    const detail = payload.reason || payload.error || `request-failed:${response.status}`;
    throw new Error(detail);
  }
  return unwrap(payload);
}

export function fetchState(): Promise<Workspace> {
  return request("/api/state");
}

export function runCommand(
  path: string,
  body?: Record<string, unknown>,
): Promise<Workspace> {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export function resetDemo(): Promise<Workspace> {
  return runCommand("/api/reset");
}
