"use client";
import type { Dispatch } from "react";
import { SOURCE_KEYS, SOURCE_META, type CtxState } from "@/lib/context-pipeline/types";
import type { CtxAction } from "./state";

export default function SourcesStage({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  return (
    <section>
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        01 · sources — what information exists
      </div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Toggle the components that will share this context window. Only enabled sources get a budget row below.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOURCE_KEYS.map((key) => {
          const meta = SOURCE_META[key];
          const on = state.sources[key].enabled;
          return (
            <button
              key={key}
              type="button"
              onClick={() => dispatch({ type: "toggleSource", key })}
              aria-pressed={on}
              className={`flex items-start gap-3 rounded border p-3 text-left transition-colors ${
                on
                  ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                  : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: on ? meta.color : "#3a4250" }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text)]">{meta.name}</span>
                <span className="block text-[11px] text-[var(--text-muted)]">{meta.subtitle}</span>
              </span>
              <span className={`ml-auto text-[11px] ${on ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                {on ? "on" : "off"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
