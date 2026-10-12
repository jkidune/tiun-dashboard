"use client";

import { useState } from "react";
import { CopyButton } from "./client";

/** Tabbed code samples with a copy button. */
export function CodeTabs({ samples }: { samples: { label: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="segmented" role="tablist">
          {samples.map((s, idx) => (
            <button key={s.label} type="button" role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setI(idx)}>
              {s.label}
            </button>
          ))}
        </div>
        <CopyButton value={samples[i].code} label="Copy" />
      </div>
      <pre className="code-block">{samples[i].code}</pre>
    </div>
  );
}
