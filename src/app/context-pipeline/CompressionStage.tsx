"use client";
import type { Dispatch } from "react";
import type {
  CtxState,
  EvictionTrigger,
  CompactionMethod,
  SalienceBias,
  SurgicalTrim,
} from "@/lib/context-pipeline/types";
import type { CtxAction } from "./state";

const TRIGGERS: { value: EvictionTrigger; label: string }[] = [
  { value: "token_threshold", label: "Token threshold (0.85×)" },
  { value: "turn_count", label: "Turn count (>N)" },
  { value: "manual", label: "Manual" },
  { value: "never", label: "Never" },
];

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-[var(--text-muted)]">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              value === o.value
                ? "border-[var(--warn)] bg-[rgba(245,158,11,0.12)] text-[var(--warn)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-strong)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompressionStage({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  return (
    <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        03 · compression &amp; eviction — when the window fills
      </div>

      {/* Eviction trigger */}
      <div className="mb-4">
        <div className="mb-2 text-xs text-[var(--text-dim)]">Eviction trigger</div>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((t) => {
            const active = state.eviction.trigger === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => dispatch({ type: "setEvictionTrigger", trigger: t.value })}
                className={`rounded border px-3 py-2 text-left text-xs transition-colors ${
                  active
                    ? "border-[var(--warn)] bg-[rgba(245,158,11,0.12)] text-[var(--warn)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-dim)] hover:border-[var(--border-strong)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {state.eviction.trigger === "turn_count" && (
          <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-dim)]">
            Evict after
            <input
              name="eviction-turn-limit"
              type="number"
              min={1}
              value={state.eviction.turnLimit ?? ""}
              placeholder="N"
              onChange={(e) =>
                dispatch({ type: "setTurnLimit", value: e.target.value ? Number(e.target.value) : null })
              }
              className="w-20 rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            turns
          </label>
        )}
      </div>

      {/* Pinned slots */}
      <div className="mb-4">
        <div className="mb-2 text-xs text-[var(--text-dim)]">Pinned slots — never evicted</div>
        <div className="space-y-2">
          {state.pinnedSlots.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">📌</span>
              <input
                name={`pinned-${p.id}-label`}
                aria-label="Pinned slot label"
                value={p.label}
                onChange={(e) => dispatch({ type: "updatePinnedSlot", id: p.id, label: e.target.value })}
                className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <input
                name={`pinned-${p.id}-tokens`}
                aria-label="Pinned slot token budget"
                type="number"
                min={0}
                step={500}
                value={p.tokens}
                onChange={(e) => dispatch({ type: "updatePinnedSlot", id: p.id, tokens: Number(e.target.value) })}
                className="w-24 rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-right font-mono text-xs text-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => dispatch({ type: "removePinnedSlot", id: p.id })}
                aria-label="Remove pinned slot"
                className="px-1 text-[var(--text-muted)] hover:text-[var(--bad)]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "addPinnedSlot" })}
          className="mt-2 text-xs text-[var(--accent)] hover:opacity-80"
        >
          + add pinned slot
        </button>
      </div>

      {/* History compaction */}
      <div className="space-y-2">
        <div className="text-xs text-[var(--text-dim)]">History compaction</div>
        <Pills<CompactionMethod>
          label="Method"
          value={state.compaction.method}
          onChange={(v) => dispatch({ type: "setCompactionMethod", value: v })}
          options={[
            { value: "summarize", label: "summarize N→1" },
            { value: "drop_oldest", label: "drop oldest" },
            { value: "none", label: "none" },
          ]}
        />
        <Pills<SalienceBias>
          label="Salience bias"
          value={state.compaction.salience}
          onChange={(v) => dispatch({ type: "setSalience", value: v })}
          options={[
            { value: "entity_ids", label: "active entity IDs" },
            { value: "recency", label: "recency" },
            { value: "none", label: "none" },
          ]}
        />
        <Pills<SurgicalTrim>
          label="Surgical trim"
          value={state.compaction.surgical}
          onChange={(v) => dispatch({ type: "setSurgical", value: v })}
          options={[
            { value: "strip_payloads", label: "strip verbose payloads" },
            { value: "full_turns", label: "full turns" },
            { value: "none", label: "none" },
          ]}
        />
      </div>
    </section>
  );
}
