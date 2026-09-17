const FORBIDDEN = /(price|cost|payment|discount|refund|invoice|supplier|purchase order|deliver|delivery)/i;
const CAUSAL = /\b(causes|caused by|because of|proves|proof that|leads to|results in)\b/i;
const REAL_DATA = /\breal (dealership|dealer|customer|data|performance|statistics)\b/i;
const NUMBER = /-?\d+(?:\.\d+)?/g;

export type GroundingResult = { ok: true } | { ok: false; reason: string };

export function extractNumbers(text: string): number[] {
  const matches = text.match(NUMBER) ?? [];
  return matches.map((match) => Number(match)).filter((value) => Number.isFinite(value));
}

function toleranceFor(allowed: number): number {
  return Math.min(1, Math.max(0.05, Math.abs(allowed) * 0.02));
}

function isAllowed(value: number, allowedNumbers: number[]): boolean {
  // Structural small integers (e.g. "top 3 factors", "2 days") are always fine.
  if (Number.isInteger(value) && value >= 1 && value <= 5) return true;
  return allowedNumbers.some((allowed) => Math.abs(allowed - value) <= toleranceFor(allowed));
}

/**
 * A reply is grounded only if every number it states appears in the computed
 * evidence, and if it does not claim real data, causation, or commercial facts.
 */
export function checkGrounded(
  text: string,
  allowedNumbers: number[],
): GroundingResult {
  if (!text.trim()) return { ok: false, reason: "empty" };
  if (FORBIDDEN.test(text)) return { ok: false, reason: "forbidden-commercial" };
  if (REAL_DATA.test(text)) return { ok: false, reason: "claims-real-data" };
  if (CAUSAL.test(text)) return { ok: false, reason: "claims-causation" };

  for (const value of extractNumbers(text)) {
    if (!isAllowed(value, allowedNumbers)) {
      return { ok: false, reason: `ungrounded-number:${value}` };
    }
  }
  return { ok: true };
}
