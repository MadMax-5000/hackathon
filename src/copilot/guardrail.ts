import type { CaseContext } from "./context";

const FORBIDDEN = /(price|cost|payment|discount|refund|invoice|supplier|purchase|deliver|diagnos)/i;
const SIZE_PATTERN = /\b\d{3}\s?\/\s?\d{2}\s?R\s?\d{2}\b/g;

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

function normalizeSize(size: string): string {
  return size.toUpperCase().replace(/\s+/g, "");
}

export function knownSizes(context: CaseContext): string[] {
  const sizes = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (value && /^\d/.test(value.trim())) sizes.add(normalizeSize(value));
  };
  add(context.evidence.size);
  add(context.proposal.aiSize);
  add(context.proposal.size);
  add(context.evidence.stock?.size);
  return [...sizes];
}

export function checkAnswer(text: string, context: CaseContext): GuardrailResult {
  if (!text.trim()) return { ok: false, reason: "empty" };
  if (FORBIDDEN.test(text)) return { ok: false, reason: "forbidden-content" };

  const known = knownSizes(context);
  const matched = text.match(SIZE_PATTERN) ?? [];
  for (const size of matched) {
    if (!known.includes(normalizeSize(size))) {
      return { ok: false, reason: `unknown-size:${size}` };
    }
  }
  return { ok: true };
}
