import type { LucideIcon } from "lucide-react";

/** Designed empty state: what will appear here and how to add the first one. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty${compact ? " compact" : ""}`}>
      <span className="empty-icon"><Icon size={24} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

/** Empty state spanning a whole table body. */
export function EmptyRow({ colSpan, ...props }: React.ComponentProps<typeof EmptyState> & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell">
        <EmptyState {...props} compact />
      </td>
    </tr>
  );
}

/** Circular score / progress, 0–100. */
export function ProgressRing({
  value,
  size = 64,
  tone = "warn",
  label,
}: {
  value: number;
  size?: number;
  tone?: "warn" | "good" | "accent";
  label?: string;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className={`fill${tone === "warn" ? "" : ` ${tone}`}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <b>{label ?? Math.round(v)}</b>
    </div>
  );
}
