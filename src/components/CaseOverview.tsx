import { useEffect, useState } from "react";
import type { DerivedCase } from "../engine/types";
import type { CopilotSource } from "../copilot/client";
import { getCachedOverview, loadOverview, regenerateOverview } from "../copilot/overviewCache";
import { Icon } from "./Icon";

type Props = {
  item: DerivedCase;
  rules: string[];
};

type OverviewState = {
  context: string;
  action: string;
  source?: CopilotSource;
  loading: boolean;
};

function initialState(item: DerivedCase): OverviewState {
  const cached = getCachedOverview(item.wheel.id);
  return cached ? { ...cached, loading: false } : { context: "", action: "", loading: true };
}

export function CaseOverview({ item, rules }: Props) {
  const [state, setState] = useState<OverviewState>(() => initialState(item));

  useEffect(() => {
    const id = item.wheel.id;
    const cached = getCachedOverview(id);
    if (cached) {
      setState({ ...cached, loading: false });
      return;
    }

    let cancelled = false;
    setState({ context: "", action: "", loading: true });
    loadOverview(item, rules).then((result) => {
      if (!cancelled) setState({ ...result, loading: false });
    });
    return () => {
      cancelled = true;
    };
    // Generate once per case id — later edits must not regenerate the brief.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.wheel.id]);

  function regenerate() {
    setState({ context: "", action: "", loading: true });
    regenerateOverview(item, rules).then((result) => {
      setState({ ...result, loading: false });
    });
  }

  return (
    <section className="overview-card" aria-live="polite" aria-busy={state.loading}>
      <header className="overview-head">
        <span className="overview-title">
          <Icon name="sparkle" size={18} />
          Case brief
        </span>
        <span className="overview-tools">
          <button
            type="button"
            className="queue-icon-btn"
            onClick={regenerate}
            disabled={state.loading}
            aria-label="Regenerate case brief"
            title="Regenerate case brief"
          >
            <Icon name="redo" size={18} />
          </button>
        </span>
      </header>

      {state.loading ? (
        <p className="overview-loading">Generating brief…</p>
      ) : (
        <>
          <p className="overview-context">{state.context}</p>
          {state.action ? (
            <p className="overview-action">
              <Icon name="arrow" size={18} />
              <span>{state.action}</span>
            </p>
          ) : null}
          {state.source === "local" ? (
            <span className="overview-offline">offline answer</span>
          ) : null}
        </>
      )}
    </section>
  );
}
