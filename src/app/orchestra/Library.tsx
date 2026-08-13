"use client";
import { ORCH_TEMPLATES } from "@/lib/orchestra/templates";
import { ORCH_ARCHAEOLOGY } from "@/lib/orchestra/archaeology";
import type { OrchState } from "@/lib/orchestra/types";

export default function Library({ onLoad }: { onLoad: (s: OrchState, label: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">Orchestra templates</h3>
        <p className="mb-2 text-[11px] text-[var(--text-muted)]">Complete starter orchestras.</p>
        <div className="grid gap-2">
          {Object.entries(ORCH_TEMPLATES).map(([id, t]) => (
            <button
              key={id}
              type="button"
              onClick={() => onLoad(t.state(), t.title)}
              className="rounded border border-[var(--border)] p-2 text-left hover:border-[var(--border-strong)]"
            >
              <div className="text-sm text-[var(--text)]">{t.title}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{t.blurb}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">Orchestra archaeology</h3>
        <p className="mb-2 text-[11px] text-[var(--text-muted)]">
          Publicly documented multi-agent systems decomposed.
        </p>
        <div className="grid gap-2">
          {Object.entries(ORCH_ARCHAEOLOGY).map(([id, a]) => (
            <button
              key={id}
              type="button"
              onClick={() => onLoad(a.state(), a.title)}
              className="rounded border border-[var(--border)] p-2 text-left hover:border-[var(--border-strong)]"
            >
              <div className="text-sm text-[var(--text)]">{a.title}</div>
              <div className="text-[11px] text-[var(--text-muted)]">{a.blurb}</div>
              <div className="mt-1 text-[10px] text-[var(--text-muted)]">{a.source}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
