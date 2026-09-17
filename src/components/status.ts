import type { DerivedCase } from "../engine/types";
import type { IconName } from "./Icon";

export type Badge = { label: string; tone: string; icon: IconName };

export function stateBadge(item: DerivedCase): Badge {
  if (item.blocked) return { label: "Missing evidence", tone: "bad", icon: "alert" };
  if (item.noAction) return { label: "No action", tone: "muted", icon: "check" };
  if (item.runtime.rejected) return { label: "Rejected", tone: "warn", icon: "redo" };
  if (item.runtime.messageSimulated) return { label: "Message simulated", tone: "ok", icon: "mail" };
  if (item.runtime.approved && item.stock && !item.stock.confirmed) {
    return { label: "Stock pending", tone: "warn", icon: "clock" };
  }
  if (item.runtime.approved) return { label: "Ready to send", tone: "ok", icon: "check" };
  return { label: "Decision needed", tone: "action", icon: "tyre" };
}

export function caseMeta(item: DerivedCase): string {
  const qty =
    !item.blocked && !item.noAction && item.runtime.quantity != null
      ? ` · ${item.runtime.quantity}×`
      : "";
  return `${item.wheel.appointment}${qty}`;
}
