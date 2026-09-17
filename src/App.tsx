import { useEffect, useMemo, useState } from "react";
import { CaseWorkspace } from "./components/CaseWorkspace";
import { CopilotBubble } from "./components/CopilotBubble";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomeHeader } from "./components/HomeHeader";
import { Icon } from "./components/Icon";
import { Sidebar, type AppView } from "./components/Sidebar";
import { TasksView } from "./components/TasksView";
import { TimelineView } from "./components/TimelineView";
import { WorkQueue } from "./components/WorkQueue";
import { InsightsView } from "./components/insights/InsightsView";
import { clearOverviewCache } from "./copilot/overviewCache";
import { fetchState, resetDemo as resetDemoApi, runCommand, type Workspace } from "./data/api";
import type { ContactChannel, QueueGroup } from "./engine/types";
import {
  casesNeedingTask,
  deriveCase,
  deriveTasks,
  findUrgentId,
  groupCases,
  sortCases,
} from "./engine/workflow";

const VIEW_TITLE: Record<AppView, string> = {
  home: "Work queue",
  timeline: "Timeline",
  tasks: "Tasks",
  insights: "Insights · synthetic data",
};

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("home");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : !window.matchMedia("(max-width: 860px)").matches,
  );
  const [resetKey, setResetKey] = useState(0);
  const [queueFocus, setQueueFocus] = useState<QueueGroup[]>([]);

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
  const tasks = useMemo(() => deriveTasks(allCases), [allCases]);
  const needsTask = useMemo(() => casesNeedingTask(allCases), [allCases]);
  const effectiveSelectedId =
    selectedId && allCases.some((item) => item.wheel.id === selectedId)
      ? selectedId
      : urgentId ?? allCases[0]?.wheel.id ?? null;
  const selected = allCases.find((item) => item.wheel.id === effectiveSelectedId) ?? allCases[0];

  function run(promise: Promise<Workspace>) {
    setActionError(null);
    return promise
      .then((state) => {
        setWorkspace(state);
      })
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

  function openCase(id: string) {
    setSelectedId(id);
    setView("home");
  }

  function openWorkflow(groups: QueueGroup[]) {
    setQueueFocus(groups);
    setView("home");
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
    <div className="app-shell">
      <div className={`shell ${sidebarOpen ? "is-open" : "is-collapsed"}`}>
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close sidebar"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar
          view={view}
          taskCount={tasks.length}
          onNavigate={setView}
          onReset={resetDemo}
        />

        <div className="shell-main">
          <header className="shell-bar">
            <button
              type="button"
              className="shell-toggle"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              aria-expanded={sidebarOpen}
              title={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              <Icon name={sidebarOpen ? "panel-open" : "panel-close"} size={20} />
            </button>
            <span className="shell-bar-title">{VIEW_TITLE[view]}</span>
          </header>

          <div className="shell-body">
            {actionError ? (
              <p className="action-error" role="alert">
                {actionError}
              </p>
            ) : null}

            {view === "insights" ? (
              <InsightsView onOpenWorkflow={openWorkflow} />
            ) : view === "tasks" ? (
              <TasksView tasks={tasks} needsTask={needsTask} onOpenCase={openCase} />
            ) : view === "timeline" ? (
              <TimelineView item={selected} />
            ) : (
              <>
                <HomeHeader cases={allCases} onOpenCase={openCase} />
                <div className="workspace">
                <aside className="queue-rail">
                  <WorkQueue
                    groups={groups}
                    selectedId={caseId}
                    focusGroups={queueFocus}
                    onSelect={setSelectedId}
                  />
                </aside>

                <main className="case-pane">
                  <ErrorBoundary onReset={resetDemo}>
                    <CaseWorkspace
                      key={`${resetKey}-${caseId}`}
                      item={selected}
                      rules={source.rules}
                      contactMessages={caseMessages}
                      onApprove={() => run(runCommand(`/api/cases/${caseId}/approve`))}
                      onReject={(reason) =>
                        run(runCommand(`/api/cases/${caseId}/reject`, { reason }))
                      }
                      onSaveEdit={(quantity, size, note) =>
                        run(runCommand(`/api/cases/${caseId}/edit`, { quantity, size, note }))
                      }
                      onSimulateStock={() =>
                        run(runCommand(`/api/cases/${caseId}/stock/simulate`))
                      }
                      onBackToReview={() =>
                        run(runCommand(`/api/cases/${caseId}/back-to-review`))
                      }
                      onCreateReviewTask={(note) =>
                        run(runCommand(`/api/cases/${caseId}/review-task`, { note }))
                      }
                      onContactGenerate={(channel: ContactChannel, body: string) =>
                        run(
                          runCommand(`/api/cases/${caseId}/contact/draft`, { channel, body }),
                        )
                      }
                      onContactMarkSimulated={(channel: ContactChannel) =>
                        run(
                          runCommand(`/api/cases/${caseId}/contact/mark-simulated`, {
                            channel,
                          }),
                        )
                      }
                      onContactSend={(channel: ContactChannel, body: string) =>
                        run(
                          runCommand(`/api/cases/${caseId}/contact/send`, { channel, body }),
                        )
                      }
                    />
                  </ErrorBoundary>
                </main>
                </div>
              </>
            )}

            {view === "home" || view === "timeline" ? (
              <CopilotBubble item={selected} rules={source.rules} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
