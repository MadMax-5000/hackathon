import type { DerivedCase } from "../engine/types.ts";
import { askOverview, type OverviewResult } from "./client.ts";

const cache = new Map<string, OverviewResult>();
const inflight = new Map<string, Promise<OverviewResult>>();

export function getCachedOverview(id: string): OverviewResult | undefined {
  return cache.get(id);
}

export function loadOverview(item: DerivedCase, rules: string[]): Promise<OverviewResult> {
  const id = item.wheel.id;

  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);

  const pending = inflight.get(id);
  if (pending) return pending;

  const request = askOverview({ item, rules })
    .then((result) => {
      cache.set(id, result);
      inflight.delete(id);
      return result;
    })
    .catch((error: unknown) => {
      inflight.delete(id);
      throw error;
    });

  inflight.set(id, request);
  return request;
}

export function regenerateOverview(item: DerivedCase, rules: string[]): Promise<OverviewResult> {
  cache.delete(item.wheel.id);
  inflight.delete(item.wheel.id);
  return loadOverview(item, rules);
}

export function clearOverviewCache(): void {
  cache.clear();
  inflight.clear();
}
