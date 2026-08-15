"use client";
import type { Dispatch } from "react";
import type { CtxState, HandoffFormat } from "@/lib/context-pipeline/types";
import type { CtxAction } from "./state";

const FORMATS: { value: HandoffFormat; label: string; badge?: string; badgeTone?: "good" | "bad"; desc: string }[] = [
  { value: "summary", label: "Summary", badge: "recommended", badgeTone: "good", desc: "Condensed result. Keeps the next context lean." },
  { value: "json", label: "Structured JSON", desc: "Machine-readable fields for a downstream agent." },
  { value: "transcript", label: "Full transcript", badge: "risky", badgeTone: "bad", desc: "Everything. Bloats the next context fast." },
];

const WRITES: { field: "writeScratchpad" | "writeRetrieved" | "writeFinalAnswer"; label: string; on: string; off: string }[] = [
  { field: "writeScratchpad", label: "Scratchpad state", on: "yes — key/value", off: "no" },
  { field: "writeRetrieved", label: "Retrieved chunks", on: "yes", off: "no — ephemeral" },
  { field: "writeFinalAnswer", label: "Final answer", on: "yes — append log", off: "no" },
];

export default function HandoffStage({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  return (
    <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        04 · handoff — what leaves this context
      </div>

      <div className="mb-2 text-xs text-[var(--text-dim)]">Handoff format</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FORMATS.map((f) => {
          const active = state.handoff.format === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => dispatch({ type: "setHandoffFormat", value: f.value })}
              aria-pressed={active}
              className={`rounded border p-3 text-left transition-colors ${
                active ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)]">{f.label}</span>
                {f.badge && (
                  <span
                    /* Opaque --bg, not a translucent semantic tint. The tint
                       composited over whatever the card is showing, and on the
                       selected card (which is itself accent-tinted) that lifted
                       the backdrop enough to drop both badges under 4.5:1 —
                       4.31 for good, 4.06 for bad. A fixed dark ground makes
                       the ratio independent of the card's state; the border
                       carries the tone the fill used to. */
                    className={`rounded-full border bg-[var(--bg)] px-1.5 py-0.5 text-[10px] ${
                      f.badgeTone === "good"
                        ? "border-[rgba(16,185,129,0.4)] text-[var(--good)]"
                        : "border-[rgba(239,68,68,0.4)] text-[var(--bad)]"
                    }`}
                  >
                    {f.badge}
                  </span>
                )}
              </div>
              {/* The selected card tints its own background with --accent-dim,
                  lifting the backdrop under this line to #122f31. Neither muted
                  nor dim clears 4.5:1 there — dim lands at 4.49, which is a
                  fail, not a rounding argument. --text does, and the selected
                  card is the one that should read most clearly anyway; 11px
                  against the 14px medium title still ranks it as secondary. */}
              <p className={`mt-1 text-[11px] ${active ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{f.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 mb-2 text-xs text-[var(--text-dim)]">Write to shared store</div>
      <div className="space-y-2">
        {WRITES.map((w) => {
          const on = state.handoff[w.field];
          return (
            <div key={w.field} className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
              <span className="text-xs text-[var(--text)]">{w.label}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: "toggleWrite", field: w.field })}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  on ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)]"
                }`}
              >
                {on ? w.on : w.off}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
