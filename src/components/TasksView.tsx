import type { CaseTask, DerivedCase } from "../engine/types";
import { Icon } from "./Icon";
import { stateBadge } from "./status";

type Props = {
  tasks: CaseTask[];
  needsTask: DerivedCase[];
  onOpenCase: (id: string) => void;
};

function formatTaskTime(value: number): string | null {
  if (!Number.isFinite(value) || value < 1_000_000_000_000) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CaseMeta({ item }: { item: DerivedCase }) {
  return (
    <p className="case-meta task-meta">
      <span>
        <Icon name="person" size={16} /> {item.wheel.customer_id}
      </span>
      <span>
        <Icon name="calendar" size={16} /> {item.wheel.appointment}
      </span>
      <span className="case-record-id">{item.wheel.id}</span>
    </p>
  );
}

function Badge({ item }: { item: DerivedCase }) {
  const badge = stateBadge(item);
  return (
    <span className={`state-badge tone-${badge.tone}`}>
      <Icon name={badge.icon} size={16} />
      {badge.label}
    </span>
  );
}

export function TasksView({ tasks, needsTask, onOpenCase }: Props) {
  const empty = tasks.length === 0 && needsTask.length === 0;

  return (
    <section className="tasks-view" aria-label="Tasks">
      <header className="tasks-head">
        <h2 className="tasks-title">Tasks</h2>
        <p className="tasks-sub">
          Human follow-ups recorded on cases. No task is created automatically; the AI never adds
          one.
        </p>
      </header>

      {empty ? (
        <p className="empty tasks-empty">No open tasks. Blocked cases will appear here.</p>
      ) : null}

      {needsTask.length > 0 ? (
        <section className="tasks-section" aria-label="Needs a task">
          <h3 className="tasks-section-title">
            <Icon name="alert" size={16} className="icon-bad" />
            Needs a task
          </h3>
          <ul className="task-list">
            {needsTask.map((item) => (
              <li key={item.wheel.id} className="task-card">
                <div className="task-card-head">
                  <CaseMeta item={item} />
                  <Badge item={item} />
                </div>
                <ul className="blocked-list task-reasons">
                  {item.blockReasons.map((reason) => (
                    <li key={reason}>
                      <Icon name="x" size={16} className="icon-bad" />
                      {reason}
                    </li>
                  ))}
                </ul>
                <div className="task-card-foot">
                  <span className="task-hint">
                    Open the case to record a review task on the timeline.
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onOpenCase(item.wheel.id)}
                  >
                    Open case
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section className="tasks-section" aria-label="Review tasks">
          <h3 className="tasks-section-title">
            <Icon name="clipboard" size={16} />
            Review tasks
          </h3>
          <ul className="task-list">
            {tasks.map((entry) => {
              const recorded = formatTaskTime(entry.createdAt);
              return (
                <li key={entry.case.wheel.id} className="task-card">
                  <div className="task-card-head">
                    <CaseMeta item={entry.case} />
                    <Badge item={entry.case} />
                  </div>
                  <p className="task-note">{entry.note}</p>
                  <div className="task-card-foot">
                    <span className="task-hint">
                      {recorded ? `Recorded ${recorded}` : "Recorded on the case timeline"}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onOpenCase(entry.case.wheel.id)}
                    >
                      Open case
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
