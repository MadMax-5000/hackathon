import { INSIGHTS_DISCLAIMER } from "../../insights/types.ts";
import { Icon } from "../Icon";

export function SyntheticNotice() {
  return (
    <aside className="insights-notice" role="note" aria-label="Synthetic data disclaimer">
      <Icon name="alert" size={20} className="insights-notice-icon" />
      <div>
        <p className="insights-notice-title">{INSIGHTS_DISCLAIMER}</p>
        <p className="insights-notice-body">
          This analytics surface is trained on generated historical records only. It is not real
          dealership performance, and it is kept separate from the live C03 case data. Findings are
          associations in synthetic data, not causation.
        </p>
      </div>
    </aside>
  );
}
