/* Hand-rolled SVG charts. Server components; tooltips use native <title>. */

const W = 720;

/** Placeholder shown instead of a flat, all-zero chart. */
export function ChartEmpty({ text = "No data for this period yet.", height = 220 }: { text?: string; height?: number }) {
  return <div className="chart-empty" style={{ minHeight: height }}>{text}</div>;
}
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function Grid({ max, h, fmt }: { max: number; h: number; fmt: (n: number) => string }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.top + (h - PAD.top - PAD.bottom) * (1 - t);
        return (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} />
            <text className="axis" x={PAD.left - 8} y={y + 4} textAnchor="end">{fmt(max * t)}</text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ labels, h, every }: { labels: string[]; h: number; every: number }) {
  const step = (W - PAD.left - PAD.right) / labels.length;
  return (
    <g>
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={i} className="axis" x={PAD.left + step * i + step / 2} y={h - 8} textAnchor="middle">{l}</text>
        ) : null,
      )}
    </g>
  );
}

export function LineChart({
  labels,
  values,
  previous,
  fmt,
  height = 240,
  title,
  empty,
}: {
  labels: string[];
  values: number[];
  previous?: number[];
  fmt: (n: number) => string;
  height?: number;
  title: string;
  empty?: string;
}) {
  if (!values.some((v) => v !== 0)) return <ChartEmpty text={empty} height={height} />;
  const max = niceMax(Math.max(...values, ...(previous ?? [0])));
  const innerH = height - PAD.top - PAD.bottom;
  const step = (W - PAD.left - PAD.right) / labels.length;
  const x = (i: number) => PAD.left + step * i + step / 2;
  const y = (v: number) => PAD.top + innerH * (1 - v / max);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
      <Grid max={max} h={height} fmt={fmt} />
      <path className="area" d={`${path(values)} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`} />
      {previous && <path className="line prev" d={path(previous)} />}
      <path className="line" d={path(values)} />
      <circle className="dot" cx={x(last)} cy={y(values[last])} r={4.5} />
      {values.map((v, i) => (
        <rect key={i} className="hit" x={x(i) - step / 2} y={PAD.top} width={step} height={innerH}>
          <title>{`${labels[i]}: ${fmt(v)}${previous ? ` (previous ${fmt(previous[i])})` : ""}`}</title>
        </rect>
      ))}
      <XLabels labels={labels} h={height} every={Math.ceil(labels.length / 8)} />
    </svg>
  );
}

/** Vertical bars. Several series stack (only when they sum to a whole) unless `grouped`. */
export function BarChart({
  labels,
  series,
  fmt,
  height = 220,
  title,
  grouped,
  empty,
}: {
  labels: string[];
  series: { name: string; values: number[]; tone: "c1" | "c2" | "c3" | "c4" | "pos" }[];
  fmt: (n: number) => string;
  height?: number;
  title: string;
  grouped?: boolean;
  empty?: string;
}) {
  if (!series.some((s) => s.values.some((v) => v > 0))) return <ChartEmpty text={empty} height={height} />;
  const totals = labels.map((_, i) =>
    grouped ? Math.max(...series.map((se) => se.values[i])) : series.reduce((s, se) => s + se.values[i], 0),
  );
  const max = niceMax(Math.max(...totals));
  const innerH = height - PAD.top - PAD.bottom;
  const step = (W - PAD.left - PAD.right) / labels.length;
  const bw = Math.max(3, Math.min(28, step * 0.62));
  const gw = Math.max(2, Math.min(18, (step * 0.7) / series.length));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
      <Grid max={max} h={height} fmt={fmt} />
      {labels.map((label, i) => {
        let acc = 0;
        const cx = PAD.left + step * i + step / 2;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = s.values[i];
              const h = (v / max) * innerH;
              if (grouped) {
                const x = cx - (gw * series.length) / 2 + gw * si;
                return v > 0 ? <rect key={s.name} className={`bar ${s.tone}`} x={x + 0.5} y={PAD.top + innerH - h} width={gw - 1} height={h} rx={2} /> : null;
              }
              const yTop = PAD.top + innerH - ((acc + v) / max) * innerH;
              acc += v;
              return v > 0 ? <rect key={s.name} className={`bar ${s.tone}`} x={cx - bw / 2} y={yTop} width={bw} height={h} rx={2} /> : null;
            })}
            <rect className="hit" x={cx - step / 2} y={PAD.top} width={step} height={innerH}>
              <title>{`${label}: ${series.map((s) => `${s.name} ${fmt(s.values[i])}`).join(", ")}`}</title>
            </rect>
          </g>
        );
      })}
      <XLabels labels={labels} h={height} every={Math.ceil(labels.length / 10)} />
    </svg>
  );
}

/** Waterfall bridge: start total, signed changes, end total. */
export function Waterfall({
  steps,
  fmt,
  height = 240,
  title,
}: {
  steps: { label: string; value: number; kind: "total" | "delta" }[];
  fmt: (n: number) => string;
  height?: number;
  title: string;
}) {
  if (!steps.some((s) => s.value !== 0)) return <ChartEmpty text="The bridge appears once you have revenue in two consecutive months." height={height} />;
  let running = 0;
  const bars = steps.map((s) => {
    if (s.kind === "total") {
      running = s.value;
      return { ...s, from: 0, to: s.value };
    }
    const from = running;
    running += s.value;
    return { ...s, from, to: running };
  });
  const max = niceMax(Math.max(...bars.map((b) => Math.max(b.from, b.to))));
  const innerH = height - PAD.top - PAD.bottom;
  const step = (W - PAD.left - PAD.right) / steps.length;
  const bw = Math.min(70, step * 0.5);
  const y = (v: number) => PAD.top + innerH * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
      <Grid max={max} h={height} fmt={fmt} />
      {bars.map((b, i) => {
        const cx = PAD.left + step * i + step / 2;
        const top = y(Math.max(b.from, b.to));
        const h = Math.max(1.5, Math.abs(y(b.from) - y(b.to)));
        const tone = b.kind === "total" ? "c1" : b.value >= 0 ? "pos" : "neg";
        return (
          <g key={b.label}>
            <rect className={`bar ${tone}`} x={cx - bw / 2} y={top} width={bw} height={h} rx={3}>
              <title>{`${b.label}: ${b.kind === "delta" && b.value > 0 ? "+" : ""}${fmt(b.value)}`}</title>
            </rect>
            <text className="value" x={cx} y={top - 6} textAnchor="middle">
              {b.kind === "delta" && b.value > 0 ? "+" : ""}
              {fmt(b.value)}
            </text>
            {i < bars.length - 1 && (
              <line className="connector" x1={cx + bw / 2} x2={cx + step - bw / 2} y1={y(b.to)} y2={y(b.to)} />
            )}
            <text className="axis" x={cx} y={height - 8} textAnchor="middle">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ rows, fmt }: { rows: { label: string; value: number }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="hbar-track" aria-hidden>
            <div className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Cohort retention grid: rows = signup month, columns = months since signup, cells = % retained. */
export function CohortHeatmap({ cohorts }: { cohorts: { label: string; size: number; retained: (number | null)[] }[] }) {
  const cols = Math.max(...cohorts.map((c) => c.retained.length));
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th>Cohort</th>
            <th>Customers</th>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i}>Month {i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td className="muted">{c.size}</td>
              {Array.from({ length: cols }, (_, i) => {
                const v = c.retained[i];
                if (v === null || v === undefined) return <td key={i} />;
                const strength = Math.round(12 + v * 0.75);
                return (
                  <td
                    key={i}
                    className="cell"
                    style={{
                      background: `color-mix(in srgb, var(--accent) ${strength}%, var(--surface))`,
                      color: strength > 55 ? "#fff" : "var(--fg)",
                    }}
                  >
                    {v}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
