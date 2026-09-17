import type { DerivedCase } from "../engine/types";
import { stockLine } from "../engine/workflow";
import { Icon, type IconName } from "./Icon";

type Props = {
  item: DerivedCase;
};

type Fact = { label: string; icon: IconName; value: string };

export function EvidenceExplorer({ item }: Props) {
  const stock = stockLine(item);
  const facts: Fact[] = [
    { label: "Front", icon: "tyre", value: item.wheel.front },
    { label: "Rear", icon: "tyre", value: item.wheel.rear },
    { label: "Size", icon: "layers", value: item.wheel.size },
    { label: "Appointment", icon: "calendar", value: item.wheel.appointment },
    { label: "Contact", icon: "person", value: item.wheel.contact },
    { label: "Stock", icon: "cube", value: stock ?? "Not used" },
  ];

  return (
    <section className="evidence-explorer" id="evidence">
      <div className="evidence-grid">
        <div className="evidence-block is-wide">
          <dl className="evidence-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>
                  <Icon name={fact.icon} size={16} />
                  {fact.label}
                </dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
