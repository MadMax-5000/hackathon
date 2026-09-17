// Shared deterministic pseudo-random helpers used by the synthetic dataset
// generator and the seeded k-means initialisation.

// mulberry32. Returns floats in [0, 1).
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chance(next: () => number, probability: number): boolean {
  return next() < probability;
}

export function between(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

export function pick<T>(next: () => number, values: T[]): T {
  return values[Math.floor(next() * values.length)];
}

export function weighted<T>(
  next: () => number,
  entries: Array<{ value: T; weight: number }>,
): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

export function gaussian(next: () => number, mean: number, sd: number): number {
  const u = Math.max(next(), 1e-9);
  const v = next();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sd * z;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
