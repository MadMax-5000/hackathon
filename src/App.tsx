import { useEffect, useMemo, useState } from "react";
import { CaseWorkspace } from "./components/CaseWorkspace";
import { CopilotBubble } from "./components/CopilotBubble";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WorkQueue } from "./components/WorkQueue";
import { clearOverviewCache } from "./copilot/overviewCache";
import { fetchState, resetDemo as resetDemoApi, runCommand, type Workspace } from "./data/api";
import type { ContactChannel } from "./engine/types";
import { deriveCase, findUrgentId, groupCases, sortCases } from "./engine/workflow";

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((state) => {
        if (cancelled) return;
        setWorkspace(state);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(String(error instanceof Error ? error.message : error));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const source = workspace?.source ?? null;
  const urgentId = useMemo(
    () => (source ? findUrgentId(source.wheel_sets) : null),
    [source],
  );

  const allCases = useMemo(() => {
    if (!workspace || !source) return [];
    return sortCases(
      source.wheel_sets.map((wheel) =>
        deriveCase(
          wheel,
          source.availability,
          workspace.overlay.runtimes[wheel.id],
          workspace.overlay.confirmedOverrides,
          urgentId,
          workspace.customers.find((customer) => customer.id === wheel.customer_id) ?? null,
        ),
      ),
    );
  }, [workspace, source, urgentId]);

  const groups = useMemo(() => groupCases(allCases), [allCases]);
  const effectiveSelectedId =
    selectedId && allCases.some((item) => item.wheel.id === selectedId)
      ? selectedId
      : urgentId ?? allCases[0]?.wheel.id ?? null;
  const selected = allCases.find((item) => item.wheel.id === effectiveSelectedId) ?? allCases[0];

  function run(promise: Promise<Workspace>) {
    setActionError(null);
    promise
      .then((state) => setWorkspace(state))
      .catch((error: unknown) => {
        setActionError(String(error instanceof Error ? error.message : error));
      });
  }

  function resetDemo() {
    clearOverviewCache();
    setActionError(null);
    resetDemoApi()
      .then((state) => {
        setWorkspace(state);
        setSelectedId(null);
        setResetKey((value) => value + 1);
      })
      .catch((error: unknown) => {
        setActionError(String(error instanceof Error ? error.message : error));
      });
  }

  if (loading && !workspace) {
    return (
      <div className="app">
        <p className="empty">Loading persisted workspace…</p>
      </div>
    );
  }

  if (loadError && !workspace) {
    return (
      <div className="app">
        <section className="error-state">
          <h2>Database unavailable</h2>
          <p>The local prototype database could not be reached.</p>
          <p className="error-detail">{loadError}</p>
        </section>
      </div>
    );
  }

  if (!selected || !source) {
    return (
      <div className="app">
        <p className="empty">No inspection records in the supplied data.</p>
      </div>
    );
  }

  const caseId = selected.wheel.id;
  const caseMessages = workspace
    ? workspace.contactMessages.filter((message) => message.wheelSetId === caseId)
    : [];

  return (
    <div className="app">
      <div className="workspace">
        <aside className="queue-rail">
          <WorkQueue
            groups={groups}
            selectedId={caseId}
            onSelect={setSelectedId}
            onReset={resetDemo}
          />
        </aside>

        <main className="case-pane">
          {actionError ? (
            <p className="action-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <ErrorBoundary onReset={resetDemo}>
            <CaseWorkspace
              key={`${resetKey}-${caseId}`}
              item={selected}
              rules={source.rules}
              stockEvent={Boolean(workspace?.stockEvents[caseId])}
              contactMessages={caseMessages}
              onApprove={() => run(runCommand(`/api/cases/${caseId}/approve`))}
              onReject={(reason) => run(runCommand(`/api/cases/${caseId}/reject`, { reason }))}
              onSaveEdit={(quantity, size, note) =>
                run(runCommand(`/api/cases/${caseId}/edit`, { quantity, size, note }))
              }
              onSimulateStock={() => run(runCommand(`/api/cases/${caseId}/stock/simulate`))}
              onBackToReview={() => run(runCommand(`/api/cases/${caseId}/back-to-review`))}
              onCreateReviewTask={(note) =>
                run(runCommand(`/api/cases/${caseId}/review-task`, { note }))
              }
              onContactGenerate={(channel: ContactChannel, body: string) =>
                run(runCommand(`/api/cases/${caseId}/contact/draft`, { channel, body }))
              }
              onContactMarkSimulated={(channel: ContactChannel) =>
                run(runCommand(`/api/cases/${caseId}/contact/mark-simulated`, { channel }))
              }
            />
          </ErrorBoundary>
        </main>
      </div>

      <CopilotBubble item={selected} rules={source.rules} />
    </div>
  );
}
