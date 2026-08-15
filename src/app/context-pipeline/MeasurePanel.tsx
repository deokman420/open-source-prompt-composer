"use client";
import { useState, type Dispatch } from "react";
import { SOURCE_META, type CtxState, type SourceKey } from "@/lib/context-pipeline/types";
import { enabledSources, fmtK } from "@/lib/context-pipeline/budget";
import { findCtxModel } from "@/lib/context-pipeline/models";
import { PROVIDER_LABELS } from "@/lib/models";
import type { CtxAction } from "./state";
import { useKeys } from "@/lib/vault/hooks";

type CountResponse = { tokens?: number; approximate?: boolean; error?: string; hint?: string };

export default function MeasurePanel({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  const { getKey } = useKeys();
  const enabled = enabledSources(state);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<SourceKey>(enabled[0] ?? "pinned");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ tokens: number; approximate: boolean } | null>(null);

  // Keep the dropdown valid if the user disables the selected source upstream.
  const targetValid = enabled.includes(target);
  const effectiveTarget = targetValid ? target : enabled[0];

  async function count() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      // The hosted build let the server resolve the key from the DB; here it
      // comes out of the vault and rides along in the request body.
      const provider = findCtxModel(state.model).provider;
      const apiKey = getKey(provider);
      if (!apiKey) {
        setError(`No ${PROVIDER_LABELS[provider]} key saved — add one in Settings to count exactly.`);
        return;
      }
      const res = await fetch("/api/count-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model: state.model, text }),
      });
      const data = (await res.json()) as CountResponse;
      if (!res.ok || typeof data.tokens !== "number") {
        setError(data.hint ? `${data.error} — ${data.hint}` : data.error || `count failed (${res.status})`);
        return;
      }
      setResult({ tokens: data.tokens, approximate: Boolean(data.approximate) });
    } catch {
      setError("network error");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!result || !effectiveTarget) return;
    dispatch({ type: "setSourceTokens", key: effectiveTarget, tokens: result.tokens });
  }

  const providerLabel = PROVIDER_LABELS[findCtxModel(state.model).provider];

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        measure — count real text
      </div>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Paste actual context to get an exact token count from {providerLabel}, then apply it to a source budget.
        Uses your own API key (BYOK).
      </p>

      <textarea
        name="measure-text"
        aria-label="Text to measure"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Paste a system prompt, retrieved chunk, transcript, etc."
        className="w-full resize-y rounded border border-[var(--border)] bg-[var(--bg-card-2)] p-2 font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-muted)]"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={count}
          disabled={busy || text.trim().length === 0}
          className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text)] hover:bg-[var(--bg-card-2)] disabled:opacity-50"
        >
          {busy ? "Counting…" : "Count tokens"}
        </button>

        {result && (
          <>
            <span className="font-mono text-[var(--text)]">
              {fmtK(result.tokens)} tokens
              {result.approximate && <span className="text-[var(--text-muted)]"> · approx (no counter for {providerLabel})</span>}
            </span>
            <span className="text-[var(--text-muted)]">→</span>
            <label className="flex items-center gap-1">
              <select
                value={effectiveTarget}
                onChange={(e) => setTarget(e.target.value as SourceKey)}
                className="rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-1 py-0.5 text-[var(--text)]"
                aria-label="Apply to source"
              >
                {enabled.map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_META[k].name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={apply}
              disabled={!effectiveTarget}
              className="rounded border border-[var(--good)] px-3 py-1 text-[var(--good)] hover:bg-[var(--bg-card-2)] disabled:opacity-50"
            >
              Apply
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-[var(--bad)]">{error}</p>}
    </section>
  );
}
