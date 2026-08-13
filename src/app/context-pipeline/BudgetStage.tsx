"use client";
import type { Dispatch } from "react";
import { SOURCE_META, OUTPUT_COLOR, type CtxState, type SourceKey } from "@/lib/context-pipeline/types";
import { enabledSources, totalAllocated, windowFor, headroom, isOverBudget, fmtK } from "@/lib/context-pipeline/budget";
import type { CtxAction } from "./state";

function Row({
  color,
  name,
  tokens,
  window: win,
  onChange,
}: {
  color: string;
  name: string;
  tokens: number;
  window: number;
  onChange: (t: number) => void;
}) {
  const pct = win > 0 ? Math.min(100, (tokens / win) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-[var(--text)]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {name}
        </span>
        <span className="font-mono text-[var(--text-dim)]">{fmtK(tokens)}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          name={`budget-${name}`}
          aria-label={`${name} token budget`}
          type="range"
          min={0}
          max={win}
          step={1000}
          value={Math.min(tokens, win)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer"
          style={{ accentColor: color }}
        />
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-[var(--bg-card-2)]">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function BudgetStage({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  const win = windowFor(state);
  const total = totalAllocated(state);
  const over = isOverBudget(state);
  const head = headroom(state);
  const enabled = enabledSources(state);

  const segments: { color: string; tokens: number }[] = [
    ...enabled.map((k) => ({ color: SOURCE_META[k].color, tokens: state.sources[k].tokens })),
    { color: OUTPUT_COLOR, tokens: state.output },
  ];

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        02 · token budget — allocate the window
      </div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">Treat tokens like RAM — allocate explicitly per component.</p>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-[var(--text-muted)]">
          Window <span className="font-mono text-[var(--text)]">{fmtK(win)}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          Allocated <span className="font-mono text-[var(--text)]">{fmtK(total)}</span>
        </span>
        <span className={over ? "text-[var(--bad)]" : "text-[var(--good)]"}>
          {over ? `over budget by ${fmtK(total - win)}` : `${fmtK(head)} headroom`}
        </span>
      </div>

      <div className="space-y-3">
        {enabled.map((k: SourceKey) => (
          <Row
            key={k}
            color={SOURCE_META[k].color}
            name={SOURCE_META[k].name}
            tokens={state.sources[k].tokens}
            window={win}
            onChange={(t) => dispatch({ type: "setSourceTokens", key: k, tokens: t })}
          />
        ))}
        <Row
          color={OUTPUT_COLOR}
          name="Output reserve"
          tokens={state.output}
          window={win}
          onChange={(t) => dispatch({ type: "setOutput", tokens: t })}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Total allocation</span>
          <span className={over ? "text-[var(--bad)]" : "text-[var(--good)]"}>
            {over ? "over budget" : `${fmtK(head)} free`}
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded bg-[var(--bg-card-2)]">
          {segments.map((seg, i) => {
            const w = win > 0 ? (seg.tokens / win) * 100 : 0;
            if (w <= 0) return null;
            return <div key={i} style={{ width: `${w}%`, background: seg.color }} title={fmtK(seg.tokens)} />;
          })}
        </div>
      </div>
    </section>
  );
}
