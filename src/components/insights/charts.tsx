import type { ChartDatum, ScatterPoint } from "../../insights/types.ts";

const PALETTE = [
  "var(--accent-ink)",
  "var(--ok)",
  "var(--warn)",
  "var(--bad)",
  "var(--muted)",
];

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/* ------------------------------------------------------------------ */
/* Donut                                                              */
/* ------------------------------------------------------------------ */

export function DonutChart({
  data,
  format,
  centerLabel,
  centerValue,
}: {
  data: ChartDatum[];
  format: (value: number) => string;
  centerLabel: string;
  centerValue: string;
}) {
  const total = sum(data.map((datum) => datum.value)) || 1;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut" role="img" aria-label={centerLabel}>
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="var(--page)"
          strokeWidth="26"
        />
        {data.map((datum, index) => {
          const share = datum.value / total;
          const dash = share * circumference;
          const element = (
            <circle
              key={datum.label}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth="26"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            />
          );
          offset += dash;
          return element;
        })}
        <text x="90" y="86" textAnchor="middle" className="donut-center-value">
          {centerValue}
        </text>
        <text x="90" y="104" textAnchor="middle" className="donut-center-label">
          {centerLabel}
        </text>
      </svg>
      <ul className="donut-legend">
        {data.map((datum, index) => (
          <li key={datum.label}>
            <span
              className="legend-swatch"
              style={{ background: PALETTE[index % PALETTE.length] }}
              aria-hidden="true"
            />
            <span className="legend-label">{datum.label}</span>
            <span className="legend-value">{format(datum.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line + area                                                        */
/* ------------------------------------------------------------------ */

export function LineAreaChart({
  data,
  format,
}: {
  data: ChartDatum[];
  format: (value: number) => string;
}) {
  const width = 340;
  const height = 190;
  const padL = 44;
  const padR = 14;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxValue = Math.max(...data.map((datum) => datum.value), 0.01);

  const point = (datum: ChartDatum, index: number) => {
    const x = padL + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotW);
    const y = padT + plotH - (datum.value / maxValue) * plotH;
    return { x, y };
  };

  const points = data.map(point);
  const line = points.map((entry) => `${entry.x.toFixed(1)},${entry.y.toFixed(1)}`).join(" ");
  const baseline = padT + plotH;
  const area = `M ${points[0]?.x ?? padL} ${baseline} L ${line.replace(/ /g, " L ")} L ${
    points[points.length - 1]?.x ?? padL
  } ${baseline} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="line-chart"
      role="img"
      aria-label="Trend chart"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = padT + plotH - tick * plotH;
        return (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} className="grid-line" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="axis-label">
              {format(maxValue * tick)}
            </text>
          </g>
        );
      })}

      <path d={area} className="area-fill" />
      <polyline points={line} className="line-stroke" />

      {points.map((entry, index) => (
        <circle key={data[index].label} cx={entry.x} cy={entry.y} r="3.2" className="line-dot" />
      ))}

      {data.map((datum, index) => {
        const x = padL + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotW);
        return (
          <text
            key={datum.label}
            x={x}
            y={height - 12}
            textAnchor="middle"
            className="axis-label"
          >
            {datum.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Columns (vertical histogram)                                       */
/* ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  format,
}: {
  data: ChartDatum[];
  format: (value: number) => string;
}) {
  const width = 340;
  const height = 190;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxValue = Math.max(...data.map((datum) => datum.value), 1);
  const slot = plotW / data.length;
  const barWidth = slot * 0.56;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="column-chart"
      role="img"
      aria-label="Distribution chart"
    >
      <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} className="axis-line" />
      {data.map((datum, index) => {
        const barHeight = (datum.value / maxValue) * plotH;
        const x = padL + index * slot + (slot - barWidth) / 2;
        const y = padT + plotH - barHeight;
        return (
          <g key={datum.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" className="column-fill" />
            <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="column-value">
              {format(datum.value)}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 12}
              textAnchor="middle"
              className="axis-label"
            >
              {datum.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Scatter                                                            */
/* ------------------------------------------------------------------ */

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xMax,
  yMax,
  formatX,
  formatY,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xMax: number;
  yMax: number;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
}) {
  const width = 340;
  const height = 210;
  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const plot = (value: number, max: number, padStart: number, span: number) =>
    padStart + (Math.min(value, max) / max) * span;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="scatter-chart"
      role="img"
      aria-label="Scatter plot"
    >
      {[0, 0.5, 1].map((tick) => {
        const y = padT + plotH - tick * plotH;
        const x = padL + tick * plotW;
        return (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} className="grid-line" />
            <line x1={x} x2={x} y1={padT} y2={padT + plotH} className="grid-line" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="axis-label">
              {formatY(yMax * tick)}
            </text>
            <text x={x} y={height - 22} textAnchor="middle" className="axis-label">
              {formatX(xMax * tick)}
            </text>
          </g>
        );
      })}

      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}-${index}`}
          cx={plot(point.x, xMax, padL, plotW)}
          cy={padT + plotH - plot(point.y, yMax, 0, plotH)}
          r="2.6"
          className={point.stockConfirmed ? "scatter-dot is-confirmed" : "scatter-dot is-pending"}
        />
      ))}

      <text x={padL + plotW / 2} y={height - 4} textAnchor="middle" className="axis-title">
        {xLabel}
      </text>
      <text
        x={12}
        y={padT + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${padT + plotH / 2})`}
        className="axis-title"
      >
        {yLabel}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Ring gauge                                                         */
/* ------------------------------------------------------------------ */

export function RingGauge({
  value,
  display,
  label,
}: {
  value: number;
  display: string;
  label: string;
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 140 140" className="ring" role="img" aria-label={label}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--page)" strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="14"
          strokeDasharray={`${clamped * circumference} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="72" textAnchor="middle" className="ring-value">
          {display}
        </text>
        <text x="70" y="92" textAnchor="middle" className="ring-label">
          {label}
        </text>
      </svg>
    </div>
  );
}
