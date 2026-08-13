"use client";
import { ORCH_PATTERNS } from "@/lib/orchestra/patterns";
import type { PatternId } from "@/lib/orchestra/types";

export default function PatternPicker({
  current,
  onPick,
}: {
  current: PatternId;
  onPick: (id: PatternId) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(ORCH_PATTERNS) as PatternId[]).map((id) => {
        const p = ORCH_PATTERNS[id];
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className={`rounded border p-3 text-left transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="text-sm font-medium text-[var(--text)]">{p.title}</div>
            <div className="mt-1 text-xs text-[var(--text-dim)]">{p.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}
