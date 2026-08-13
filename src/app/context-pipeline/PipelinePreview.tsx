"use client";
import { useMemo, useState, type Dispatch } from "react";
import type { CtxState } from "@/lib/context-pipeline/types";
import type { CtxAction } from "./state";
import { computeCtxHealth } from "@/lib/context-pipeline/health";
import { CTX_MODELS } from "@/lib/context-pipeline/models";
import { CTX_TARGETS, renderCtxExport, type CtxTargetKey } from "@/lib/context-pipeline/exporters";
import { ctxToOrchSeed } from "@/lib/context-pipeline/to-orchestra";
import { encodeState as encodeOrchState } from "@/lib/orchestra/share";
import { estimateTokens } from "@/lib/orchestra/health";

export default function PipelinePreview({
  state,
  dispatch,
}: {
  state: CtxState;
  dispatch: Dispatch<CtxAction>;
}) {
  const [target, setTarget] = useState<CtxTargetKey>("spec-md");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => renderCtxExport(target, state), [target, state]);
  const health = computeCtxHealth(state);
  const size = estimateTokens(output);
  const isScaffold = CTX_TARGETS.find((t) => t.key === target)?.group === "scaffold";

  const healthColor =
    health.passed === health.total
      ? "var(--good)"
      : health.passed >= 3
      ? "var(--warn)"
      : "var(--bad)";

  function copy() {
    navigator.clipboard.writeText(output).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  function sendToOrchestra() {
    const encoded = encodeOrchState(ctxToOrchSeed(state));
    window.open(`/orchestra#o=${encoded}`, "_blank", "noopener");
  }

  return (
    <aside className="preview-card">
      <div className="preview-header">
        <h2>Live preview</h2>
        <span className="token-est" title="Rough estimate (chars ÷ 4). Real count varies by model.">
          ~{size} tokens <span className="token-est-suffix">· rough</span>
        </span>
      </div>

      <div className="preview-health">
        <span>Pipeline health</span>
        <span className="preview-health-score" style={{ color: healthColor }}>
          {health.passed} / {health.total}
        </span>
      </div>
      <ul className="preview-checks">
        {health.checks.map((c) => (
          <li key={c.label} className="preview-check">
            <span className="preview-check-dot" style={{ background: c.pass ? "var(--good)" : "var(--warn)" }} />
            <span>
              {c.label}
              <span className="preview-check-detail"> — {c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="preview-meta-row">
        <label className="preview-meta-field">
          <span className="preview-meta-label">Model · window</span>
          <select
            className="model-select"
            value={state.model}
            onChange={(e) => dispatch({ type: "setModel", model: e.target.value })}
            aria-label="Target model"
          >
            <optgroup label="Anthropic">
              {CTX_MODELS.anthropic.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {Math.round(m.window / 1000)}k
                </option>
              ))}
            </optgroup>
            <optgroup label="OpenAI">
              {CTX_MODELS.openai.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {Math.round(m.window / 1000)}k
                </option>
              ))}
            </optgroup>
            <optgroup label="Google Gemini">
              {CTX_MODELS.google.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {Math.round(m.window / 1000)}k
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="preview-meta-field">
          <span className="preview-meta-label">Export as</span>
          <select
            className="fmt-select"
            value={target}
            onChange={(e) => setTarget(e.target.value as CtxTargetKey)}
            aria-label="Output format"
          >
            <optgroup label="Spec documents">
              {CTX_TARGETS.filter((t) => t.group === "spec").map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="— framework scaffolding —">
              {CTX_TARGETS.filter((t) => t.group === "scaffold").map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <p className="fmt-caption">
        {isScaffold
          ? "Runnable stub — budget values wired as constants. Fill in the build/evict/compact logic before running."
          : "Portable spec of this context plan."}
      </p>

      <pre className="preview-text">{output}</pre>

      <div className="preview-actions">
        <button type="button" className="copy-btn primary" onClick={copy}>
          {copied ? "Copied ✓" : "Copy export"}
        </button>
        <button type="button" className="copy-btn" onClick={sendToOrchestra} title="Open Orchestra pre-seeded with this budget">
          Send to Orchestra →
        </button>
      </div>
      <p className="preview-hint">Your plan stays in your browser. (The optional Measure tool sends pasted text to your chosen provider to count it.)</p>
    </aside>
  );
}
