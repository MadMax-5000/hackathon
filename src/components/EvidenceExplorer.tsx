import { lazy, Suspense } from "react";
import type { DerivedCase } from "../engine/types";
import { stockLine } from "../engine/workflow";
import { Icon, type IconName } from "./Icon";

const VehicleBlueprint = lazy(() => import("./VehicleBlueprint"));

type Props = {
  item: DerivedCase;
};

type Fact = { label: string; icon: IconName; value: string };

export function EvidenceExplorer({ item }: Props) {
  const stock = stockLine(item);
  const facts: Fact[] = [
    { label: "Size", icon: "layers", value: item.wheel.size },
    { label: "Appointment", icon: "calendar", value: item.wheel.appointment },
    { label: "Contact", icon: "person", value: item.wheel.contact },
    { label: "Stock", icon: "cube", value: stock ?? "Not used" },
  ];

  return (
    <section className="evidence-explorer" id="evidence">
      <div className="evidence-grid has-viewer">
        <div className="evidence-block evidence-viewer">
          <Suspense fallback={<div className="vehicle-blueprint is-fallback" aria-hidden="true" />}>
            <VehicleBlueprint item={item} />
          </Suspense>
        </div>
        <div className="evidence-block evidence-side">
          <dl className="evidence-facts is-stacked">
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
