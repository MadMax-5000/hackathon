import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendHistory,
  createInitialRuntimes,
  createReviewTask,
  deriveCase,
  deriveInsights,
  findUrgentId,
  groupCases,
  markEvidenceReviewed,
  simulateMessage,
  simulateStockConfirmation,
  sortCases,
} from "../src/engine/workflow.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const source = JSON.parse(readFileSync(resolve(__dirname, "../src/data/initial.json"), "utf8"));
export const urgentId = findUrgentId(source.wheel_sets);

export function createHarness() {
  let overlay = {
    runtimes: createInitialRuntimes(source),
    confirmedOverrides: {},
    stockEvents: {},
  };
  let selectedId = urgentId ?? source.wheel_sets[0].id;

  function apply(id, patch, event) {
    const merged = { ...overlay.runtimes[id], ...patch };
    overlay = {
      ...overlay,
      runtimes: {
        ...overlay.runtimes,
        [id]: event ? appendHistory(merged, event.kind, event.label) : merged,
      },
    };
  }

  function cases() {
    return sortCases(
      source.wheel_sets.map((wheel) =>
        deriveCase(wheel, source.availability, overlay.runtimes[wheel.id], overlay.confirmedOverrides, urgentId),
      ),
    );
  }

  function derive(id) {
    const wheel = source.wheel_sets.find((entry) => entry.id === id);
    return deriveCase(wheel, source.availability, overlay.runtimes[id], overlay.confirmedOverrides, urgentId);
  }

  function select(id) {
    selectedId = id;
  }

  function approve() {
    apply(selectedId, { approved: true, rejected: false }, { kind: "human", label: "Technician approved fitment and quantity." });
  }

  function reject(reason) {
    apply(
      selectedId,
      { rejected: true, approved: false, messageSimulated: false, rejectReason: reason ?? "" },
      { kind: "human", label: reason ? `Rejected — review required. Reason: ${reason}` : "Rejected — review required." },
    );
  }

  function edit(quantity, size, note) {
    apply(
      selectedId,
      { quantity, size, note: note ?? "", humanCorrected: true, approved: false },
      { kind: "human", label: `Human-corrected proposal: ${quantity} × ${size}.` },
    );
  }

  function backToReview() {
    apply(
      selectedId,
      { approved: false, rejected: false, rejectReason: "", messageSimulated: false },
      { kind: "human", label: "Returned to review — earlier decision undone." },
    );
  }

  function runStockSimulation() {
    overlay = simulateStockConfirmation(overlay, selectedId, source);
  }

  function runMessageSimulation() {
    overlay = simulateMessage(overlay, selectedId);
  }

  function markReviewed() {
    overlay = markEvidenceReviewed(overlay, selectedId);
  }

  function createTask(note) {
    overlay = createReviewTask(overlay, selectedId, note);
  }

  function reset() {
    overlay = { runtimes: createInitialRuntimes(source), confirmedOverrides: {}, stockEvents: {} };
    selectedId = urgentId ?? source.wheel_sets[0].id;
  }

  function groups() {
    return groupCases(cases());
  }

  function insights() {
    return deriveInsights(cases());
  }

  function getOverlay() {
    return overlay;
  }

  return {
    select,
    selected: () => derive(selectedId),
    approve,
    reject,
    edit,
    backToReview,
    runStockSimulation,
    runMessageSimulation,
    markReviewed,
    createTask,
    reset,
    cases,
    derive,
    groups,
    insights,
    getOverlay,
  };
}

export function makeReporter(title) {
  const failures = [];
  function check(label, ok, detail) {
    if (ok) {
      console.log("  PASS  " + label);
    } else {
      console.log("  FAIL  " + label + (detail ? " — " + detail : ""));
      failures.push(label);
    }
  }
  function finish() {
    console.log("\n" + "=".repeat(60));
    if (failures.length === 0) {
      console.log(`${title}: ALL ASSERTIONS PASSED.`);
      return 0;
    }
    console.log(`${title}: ${failures.length} ASSERTION(S) FAILED:`);
    for (const failure of failures) console.log("  • " + failure);
    return 1;
  }
  return { check, finish };
}
