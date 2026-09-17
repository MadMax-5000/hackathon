import { useEffect, useId, useRef, useState } from "react";
import type { DerivedCase, QueueGroup, QueueGroupView } from "../engine/types";
import { Icon } from "./Icon";

type Props = {
  groups: QueueGroupView[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReset: () => void;
};

const GROUP_TONE: Record<QueueGroup, string> = {
  Urgent: "tone-bad",
  "Missing evidence": "tone-warn",
  "Awaiting technician": "tone-action",
  "Awaiting stock": "tone-warn",
  "Ready for customer": "tone-ok",
  Complete: "tone-ok",
  "No action required": "tone-muted",
};

type FilterOption = { group: QueueGroup; count: number };

function QueueFilter({
  options,
  active,
  onToggle,
  onClear,
}: {
  options: FilterOption[];
  active: Set<QueueGroup>;
  onToggle: (group: QueueGroup) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hasFilters = active.size > 0;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="queue-filter" ref={rootRef}>
      <button
        type="button"
        className={`queue-icon-btn ${hasFilters ? "is-active" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Filter by status"
        title="Filter by status"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="filter" size={18} />
      </button>

      {open && (
        <div
          className="queue-filter-panel"
          id={panelId}
          role="group"
          aria-label="Filter by status"
        >
          <div className="queue-filter-head">
            <span className="queue-filter-title">Filter</span>
            <button
              type="button"
              className="queue-filter-clear"
              onClick={onClear}
              disabled={!hasFilters}
            >
              Clear
            </button>
          </div>
          <ul className="queue-filter-list">
            {options.map(({ group, count }) => (
              <li key={group}>
                <label className="queue-filter-option">
                  <input
                    type="checkbox"
                    className="queue-filter-check"
                    checked={active.has(group)}
                    onChange={() => onToggle(group)}
                  />
                  <span className={`queue-dot ${GROUP_TONE[group]}`} aria-hidden="true" />
                  <span className="queue-filter-label">{group}</span>
                  <span className="queue-group-count">{count}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QueueRow({
  group,
  item,
  selected,
  onSelect,
}: {
  group: QueueGroup;
  item: DerivedCase;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const detail = item.runtime.size || item.wheel.size || "unknown";

  return (
    <li>
      <button
        type="button"
        className={`queue-row ${selected ? "is-selected" : ""}`}
        aria-current={selected ? "true" : undefined}
        title={`${group} · ${detail}`}
        onClick={() => onSelect(item.wheel.id)}
      >
        <span className="queue-row-main">
          <span className={`queue-dot ${GROUP_TONE[group]}`} aria-hidden="true" />
          <span className="queue-row-id">{item.wheel.id}</span>
        </span>
        <span className="queue-row-size">{detail}</span>
      </button>
    </li>
  );
}

export function WorkQueue({ groups, selectedId, onSelect, onReset }: Props) {
  const [active, setActive] = useState<Set<QueueGroup>>(new Set());

  const options: FilterOption[] = groups.map((entry) => ({
    group: entry.group,
    count: entry.cases.length,
  }));
  const flat = groups.flatMap((entry) =>
    entry.cases.map((item) => ({ group: entry.group, item })),
  );
  const visible = active.size === 0 ? flat : flat.filter((row) => active.has(row.group));

  function toggleGroup(group: QueueGroup) {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  return (
    <section className="work-queue" aria-label="Work queue">
      <div className="queue-head">
        <h2 className="queue-title">Work queue</h2>
        <div className="queue-head-actions">
          <span className="queue-count" aria-hidden="true">
            {visible.length}
          </span>
          <span className="sr-only">{visible.length} cases shown</span>
          <QueueFilter
            options={options}
            active={active}
            onToggle={toggleGroup}
            onClear={() => setActive(new Set())}
          />
          <button
            type="button"
            className="queue-icon-btn"
            onClick={onReset}
            aria-label="Reset demo"
            title="Reset demo"
          >
            <Icon name="redo" size={18} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty queue-empty">
          {flat.length === 0
            ? "No inspection records in the supplied data."
            : "No cases match this filter."}
        </p>
      ) : (
        <ul className="queue-list">
          {visible.map(({ group, item }) => (
            <QueueRow
              key={item.wheel.id}
              group={group}
              item={item}
              selected={item.wheel.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
