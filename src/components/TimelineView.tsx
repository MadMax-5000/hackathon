import type { DerivedCase } from "../engine/types";
import { CaseTimeline } from "./CaseTimeline";
import { Icon } from "./Icon";
import { stateBadge } from "./status";

type Props = {
  item: DerivedCase;
};

export function TimelineView({ item }: Props) {
  const badge = stateBadge(item);

  return (
    <section className="timeline-view" aria-label="Case timeline">
      <header className="timeline-view-head">
        <div>
          <h2 className="timeline-view-title">
            Case timeline
            <span className="timeline-view-count">{item.runtime.history.length}</span>
          </h2>
          <p className="timeline-view-sub">
            Chronological activity for {item.wheel.id}, labeled by source. Exercise-local time; only
            real runtime events appear.
          </p>
        </div>
        <span className={`state-badge tone-${badge.tone}`}>
          <Icon name={badge.icon} size={16} />
          {badge.label}
        </span>
      </header>

      <p className="case-meta timeline-view-meta">
        <span>
          <Icon name="person" size={16} /> {item.wheel.customer_id}
        </span>
        <span>
          <Icon name="calendar" size={16} /> {item.wheel.appointment}
        </span>
        <span className="case-record-id">{item.wheel.id}</span>
      </p>

      <CaseTimeline key={item.wheel.id} item={item} />
    </section>
  );
}
