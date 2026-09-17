import { Icon, type IconName } from "./Icon";

export type AppView = "home" | "tasks" | "timeline" | "insights";

type Props = {
  view: AppView;
  taskCount: number;
  onNavigate: (view: AppView) => void;
  onReset: () => void;
};

const NAV: { id: AppView; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "layers" },
  { id: "timeline", label: "Timeline", icon: "clock" },
  { id: "tasks", label: "Tasks", icon: "clipboard" },
  { id: "insights", label: "Insights", icon: "chart" },
];

export function Sidebar({ view, taskCount, onNavigate, onReset }: Props) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <nav className="sidebar-nav" aria-label="Views">
        {NAV.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`nav-item ${view === entry.id ? "is-active" : ""}`}
            aria-current={view === entry.id ? "page" : undefined}
            onClick={() => onNavigate(entry.id)}
          >
            <Icon name={entry.icon} size={18} />
            <span className="nav-label">{entry.label}</span>
            {entry.id === "tasks" && taskCount > 0 ? (
              <span className="nav-count">{taskCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <button type="button" className="sidebar-reset" onClick={onReset}>
        <Icon name="redo" size={18} />
        Reset demo
      </button>
    </aside>
  );
}
