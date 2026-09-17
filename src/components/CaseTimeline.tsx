import type { DerivedCase, HistoryKind } from "../engine/types";
import { Icon, type IconName } from "./Icon";

type Props = {
  item: DerivedCase;
};

const KIND: Record<HistoryKind, { label: string; icon: IconName }> = {
  source: { label: "Source", icon: "layers" },
  ai: { label: "AI proposal", icon: "sparkle" },
  human: { label: "Human decision", icon: "person" },
  simulated: { label: "Simulated event", icon: "play" },
};

function formatTime(value?: string): string | null {
  if (!value) return null;
  const match = /T(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : null;
}

export function CaseTimeline({ item }: Props) {
  return (
    <section className="case-timeline" id="timeline">
      <h3>
        <Icon name="clock" size={18} />
        Case timeline · exercise-local time
      </h3>
      <ol className="timeline">
        {item.runtime.history.map((event, index) => {
          const kind = KIND[event.kind];
          const time = formatTime(event.createdAt);
          return (
            <li key={event.id} className={`timeline-item kind-${event.kind}`}>
              <span className="timeline-marker" aria-hidden="true">
                <Icon name={kind.icon} size={16} />
              </span>
              <span className="timeline-body">
                <span className="timeline-meta">
                  <span className={`timeline-kind kind-${event.kind}`}>{kind.label}</span>
                  {event.source ? (
                    <span
                      className="timeline-source"
                      title={`Event type: ${event.eventType ?? "unknown"}`}
                    >
                      {event.source}
                      {event.eventType ? ` · ${event.eventType}` : ""}
                    </span>
                  ) : null}
                  {time ? <span className="timeline-time">{time}</span> : null}
                  <span className="timeline-step">Step {index + 1}</span>
                </span>
                <span className="timeline-text">{event.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
