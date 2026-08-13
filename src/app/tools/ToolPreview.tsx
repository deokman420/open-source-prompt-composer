"use client";
import { useMemo, useState } from "react";
import { toToolJsonString } from "@/lib/tools/serialize";
import { validateToolDef } from "@/lib/tools/validate";
import type { ToolDef } from "@/lib/tools/types";

export default function ToolPreview({ tool }: { tool: ToolDef }) {
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => toToolJsonString(tool), [tool]);
  const issues = useMemo(() => validateToolDef(tool), [tool]);
  const errors = issues.filter((i) => i.level === "error");

  const tokens = Math.ceil(json.length / 4);

  function copy() {
    navigator.clipboard.writeText(json).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  // Hand the tool JSON to AI Eval (mirrors Compose / Orchestra's "Send to
  // Evaluator"). EvalForm reads + clears "pc:eval-prefill" on mount.
  function sendToEval() {
    try {
      sessionStorage.setItem("pc:eval-prefill", json);
    } catch {
      /* sessionStorage unavailable — ignore */
    }
    window.location.assign("/eval");
  }

  return (
    <aside className="preview-card">
      <div className="preview-header">
        <h2>Tool JSON</h2>
        <span className="token-est" title="Rough estimate (chars ÷ 4). Real count varies by model.">
          ~{tokens} tokens <span className="token-est-suffix">· rough</span>
        </span>
      </div>

      <div className="preview-health">
        <span>Validation</span>
        <span
          className="preview-health-score"
          style={{ color: errors.length ? "var(--bad)" : "var(--good)" }}
        >
          {errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}` : "valid ✓"}
        </span>
      </div>
      {errors.length > 0 && (
        <ul className="preview-issues">
          {errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      )}

      <p className="fmt-caption">
        Anthropic Messages-API tool definition. Paste into a <code>tools:[ ]</code> array. Copy is
        disabled while there are validation errors.
      </p>

      <pre className="preview-text">{json}</pre>

      <div className="preview-actions">
        <button
          type="button"
          className="copy-btn primary"
          onClick={copy}
          disabled={errors.length > 0}
        >
          {copied ? "Copied ✓" : "Copy JSON"}
        </button>
      </div>
      <button
        type="button"
        className="copy-btn send-eval-btn"
        onClick={sendToEval}
        disabled={errors.length > 0}
        title={errors.length ? "Fix validation errors first" : "Critique this tool definition in AI Eval"}
      >
        Send to Evaluator &rarr;
      </button>
      <p className="preview-hint">Local-only — never leaves your browser.</p>
    </aside>
  );
}
