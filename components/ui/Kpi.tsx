import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

export type KpiItem = {
  label: string;
  icon: LucideIcon;
  value: string;
  sub: string;
  trend?: { dir: "up" | "down"; pct: string; good?: boolean };
  bars?: number[];
  muted?: boolean;
  operator?: string;
};

export function KpiStrip({ items, label }: { items: KpiItem[]; label: string }) {
  return (
    <section className="stats" aria-label={label}>
      {items.map((k) => {
        const max = Math.max(1, ...(k.bars ?? [1]));
        const Arrow = k.trend?.dir === "down" ? ArrowDown : ArrowUp;
        const good = k.trend?.good ?? k.trend?.dir === "up";
        return (
          <div className="stat" key={k.label}>
            {k.operator && <span className="op" aria-hidden>{k.operator}</span>}
            <div className="stat-head">
              <span className={`stat-icon${k.muted ? " muted" : ""}`}>
                <k.icon size={17} strokeWidth={1.7} />
              </span>
              {k.label}
              {k.trend && k.trend.pct !== "—" && (
                <span
                  className="trend"
                  style={good ? undefined : { background: "var(--red-bg)", color: "var(--red)" }}
                >
                  <Arrow size={13} strokeWidth={2.2} />
                  {k.trend.pct}
                </span>
              )}
            </div>
            <div className="stat-body">
              <div>
                <div className="stat-value">{k.value}</div>
                <div className="stat-sub">{k.sub}</div>
              </div>
              {k.bars && k.bars.some((v) => v > 0) && (
                <div className={`bars${k.muted ? " muted" : ""}`} aria-hidden>
                  {k.bars.map((v, i) => (
                    <span
                      key={i}
                      className={i === k.bars!.length - 1 ? "last" : ""}
                      style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
