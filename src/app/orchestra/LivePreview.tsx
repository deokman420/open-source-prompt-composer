"use client";
import { useMemo, useState } from "react";
import { renderBundleMd, renderBundleXml } from "@/lib/orchestra/bundle";
import { computeHealth, estimateTokens } from "@/lib/orchestra/health";
import { ORCH_TARGETS, MODELS, findModel, renderCode, anyAgentHasModel } from "@/lib/orchestra/exporters";
import type { OrchState, ProviderId } from "@/lib/orchestra/types";

type TargetKey = keyof typeof ORCH_TARGETS;

function targetProvider(key: TargetKey): ProviderId {
  const t = ORCH_TARGETS[key];
  return t.kind === "code" ? t.provider : "anthropic";
}

export default function LivePreview({ state }: { state: OrchState }) {
  const [format, setFormat] = useState<TargetKey>("markdown");
  const [modelByProvider, setModelByProvider] = useState<Record<ProviderId, string>>({
    anthropic: MODELS.anthropic[0].id,
    openai: MODELS.openai[0].id,
    gemini: MODELS.gemini[0].id,
  });
  const [copied, setCopied] = useState<"" | "bundle" | "json">("");

  const provider = targetProvider(format);
  const target = ORCH_TARGETS[format];

  const output = useMemo(() => {
    if (target.kind === "prompt") {
      return format === "xml" ? renderBundleXml(state) : renderBundleMd(state);
    }
    const model = findModel(provider, modelByProvider[provider]);
    return renderCode(format, state, model);
  }, [state, format, provider, modelByProvider, target.kind]);

  const tokens = estimateTokens(output);
  const health = computeHealth(state);

  const perAgentModels = anyAgentHasModel(state);
  const caption =
    target.kind === "code"
      ? perAgentModels
        ? `Runnable ${target.label} for pattern: ${state.pattern}. Per-agent models are set, so this emits a multi-provider router + AGENTS registry (the "Model" picker above sets the fallback for agents left on Export default; Bedrock/Vertex hosting isn't applied in this mode).`
        : `Runnable ${target.label} for pattern: ${state.pattern}. Adapter + agent system-prompts + coordination loop. Edit before running.`
      : target.caption;

  const healthColor =
    health.score >= 80 ? "var(--good)" : health.score >= 50 ? "var(--warn)" : "var(--bad)";

  function copy(text: string, which: "bundle" | "json") {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(which);
        setTimeout(() => setCopied(""), 1500);
      },
      () => {},
    );
  }

  // Hand the rendered Markdown bundle to AI Eval (mirrors Compose's
  // "Send to Evaluator"). sessionStorage is read + cleared by EvalForm on mount.
  function sendToEval() {
    try {
      sessionStorage.setItem("pc:eval-prefill", renderBundleMd(state));
    } catch {
      /* sessionStorage unavailable — ignore */
    }
    window.location.assign("/eval");
  }

  return (
    <aside className="preview-card">
      <div className="preview-header">
        <h2>Live preview</h2>
        <span className="token-est" title="Rough estimate (chars ÷ 4). Real count varies by model.">
          ~{tokens} tokens <span className="token-est-suffix">· rough</span>
        </span>
      </div>

      <div className="preview-health">
        <span>Orchestra health</span>
        <span className="preview-health-score" style={{ color: healthColor }}>{health.score}</span>
      </div>
      {health.issues.length > 0 && (
        <ul className="preview-issues">
          {health.issues.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      <div className="preview-meta-row">
        <label className="preview-meta-field">
          <span className="preview-meta-label">Export as</span>
          <select
            className="fmt-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as TargetKey)}
            aria-label="Output format"
          >
            <optgroup label="Prompt bundle">
              <option value="markdown">Markdown</option>
              <option value="xml">XML</option>
            </optgroup>
            <optgroup label="Anthropic (Claude)">
              <option value="anthropic-python">Python SDK</option>
              <option value="anthropic-ts">TypeScript SDK</option>
              <option value="bedrock-python">AWS Bedrock · Python</option>
              <option value="bedrock-ts">AWS Bedrock · TypeScript</option>
              <option value="vertex-python">Vertex AI · Python</option>
              <option value="vertex-ts">Vertex AI · TypeScript</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="openai-python">Python SDK</option>
              <option value="openai-ts">TypeScript SDK</option>
            </optgroup>
            <optgroup label="Google Gemini">
              <option value="gemini-python">Python SDK</option>
              <option value="gemini-ts">TypeScript SDK</option>
            </optgroup>
          </select>
        </label>

        {target.kind === "code" && (
          <label className="preview-meta-field">
            <span className="preview-meta-label">Model</span>
            <select
              className="model-select"
              value={modelByProvider[provider]}
              onChange={(e) =>
                setModelByProvider((prev) => ({ ...prev, [provider]: e.target.value }))
              }
              aria-label="Target model"
            >
              {MODELS[provider].map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="fmt-caption">{caption}</p>

      <pre className="preview-text">{output}</pre>

      <div className="preview-actions">
        <button type="button" className="copy-btn primary" onClick={() => copy(output, "bundle")}>
          {copied === "bundle" ? "Copied ✓" : "Copy bundle"}
        </button>
        <button
          type="button"
          className="copy-btn"
          onClick={() => copy(JSON.stringify(state, null, 2), "json")}
        >
          {copied === "json" ? "Copied ✓" : "Copy as JSON"}
        </button>
      </div>
      <button type="button" className="copy-btn send-eval-btn" onClick={sendToEval}>
        Send to Evaluator &rarr;
      </button>
      <p className="preview-hint">Local-only — never leaves your browser.</p>
    </aside>
  );
}
