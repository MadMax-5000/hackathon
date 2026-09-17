import type { DerivedCase } from "../engine/types";
import { casesNeedingAttention } from "../engine/workflow";
import { Icon } from "./Icon";
import { stateBadge } from "./status";

type Props = {
  cases: DerivedCase[];
  onOpenCase: (id: string) => void;
};

export function HomeHeader({ cases, onOpenCase }: Props) {
  const attention = casesNeedingAttention(cases);
  const count = attention.length;
  const noun = count === 1 ? "case needs" : "cases need";

  return (
    <header className="home-hero">
      <div className="home-hero-text">
        <p className="home-hero-kicker">Home</p>
        <h1 className="home-hero-title">
          <span className="home-hero-greet">Good morning</span>
          <span className="home-hero-dash" aria-hidden="true">
            —
          </span>
          <span className="home-hero-attention">
            <span className="home-hero-count">{count}</span> {noun} attention
          </span>
        </h1>
      </div>

      {count > 0 ? (
        <section className="home-attention" aria-label="Cases needing attention">
          <h2 className="home-attention-title">Needs attention</h2>
          <ul className="home-attention-list">
            {attention.map((item) => {
              const badge = stateBadge(item);
              return (
                <li key={item.wheel.id}>
                  <button
                    type="button"
                    className="home-case"
                    onClick={() => onOpenCase(item.wheel.id)}
                  >
                    <span className="home-case-top">
                      <span className="home-case-id">{item.wheel.id}</span>
                      <span className={`state-badge tone-${badge.tone}`}>
                        <Icon name={badge.icon} size={14} />
                        {badge.label}
                      </span>
                    </span>
                    <span className="home-case-concern">{item.concernSummary}</span>
                    <span className="home-case-meta">
                      <span>
                        <Icon name="person" size={14} /> {item.wheel.customer_id}
                      </span>
                      <span>
                        <Icon name="calendar" size={14} /> {item.wheel.appointment}
                      </span>
                    </span>
                    <span className="home-case-cta">
                      Open case
                      <Icon name="arrow" size={14} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="home-attention-empty">
          You&rsquo;re all caught up — nothing needs attention.
        </p>
      )}
    </header>
  );
}
