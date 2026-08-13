"use client";

/**
 * AI Eval — score, rewrite, spellcheck, or code-check a prompt.
 *
 * The hosted version took a per-day quota, a Pro entitlement, and a
 * server-resolved key. None of those exist here: the key comes from the local
 * vault and the user is billed by their own provider, so there is no cap to
 * enforce and nobody to enforce it for.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Provider } from "@/lib/providers/types";
import {
  DEFAULT_MODEL,
  modelLabel,
  evalModels,
  PROVIDER_LABELS,
  PROVIDER_ORDER,
} from "@/lib/models";
import { EVAL_SYSTEM_TOKENS_EST } from "@/lib/eval/modes";
import { runEval, EvalNoKeyError } from "@/lib/eval/run";
import { ModelError } from "@/lib/client/model";
import { useKeys, useDrafts, usePreferences } from "@/lib/vault/hooks";

type Mode = "spellcheck" | "optimize" | "codecheck" | "structure";

const MODE_LABELS: Record<Mode, string> = {
  structure: "Score R-G-C-B-T-S",
  optimize: "Rewrite for clarity",
  spellcheck: "Spellcheck & grammar",
  codecheck: "Validate code blocks",
};

type RunState = {
  result: { raw: string; parsed: unknown; parseError: string | null };
  usage: { inputTokens: number | null; outputTokens: number | null };
  model: string;
  mode: Mode;
  promptText: string;
};

export default function EvalForm() {
  const { configured, getKey, markUsed } = useKeys();
  const { createDraft } = useDrafts();
  const { defaultSelection } = usePreferences();

  const available = useMemo(
    () => PROVIDER_ORDER.filter((p) => configured.has(p)),
    [configured]
  );

  const [provider, setProvider] = useState<Provider>(defaultSelection.provider);
  const [model, setModel] = useState<string>(defaultSelection.model);
  const [mode, setMode] = useState<Mode>("optimize");
  const [promptText, setPromptText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // A prompt sent over from /compose arrives in sessionStorage rather than the
  // URL — prompts routinely exceed what a query string can carry, and putting
  // one there would also leak it into history and any referrer.
  useEffect(() => {
    try {
      const handoff = sessionStorage.getItem("pc.eval.prompt");
      if (handoff) {
        setPromptText(handoff);
        sessionStorage.removeItem("pc.eval.prompt");
      }
    } catch {
      /* storage blocked — nothing to hand off */
    }
  }, []);

  // Keep the picker on a provider the user actually has a key for.
  useEffect(() => {
    if (available.length && !available.includes(provider)) {
      const next = available[0];
      setProvider(next);
      setModel(DEFAULT_MODEL[next]);
    }
  }, [available, provider]);

  function changeProvider(p: Provider) {
    setProvider(p);
    // Carry the saved default across only when it belongs to this provider.
    setModel(
      p === defaultSelection.provider ? defaultSelection.model : DEFAULT_MODEL[p]
    );
  }

  async function go() {
    if (busy) return;
    const text = promptText.trim();
    if (text.length < 10) {
      setError("Give the evaluator at least a sentence to work with.");
      return;
    }

    const apiKey = getKey(provider);
    if (!apiKey) {
      setError(`No ${PROVIDER_LABELS[provider]} key saved. Add one in Settings.`);
      return;
    }

    setBusy(true);
    setError(null);
    setRun(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runEval({
        provider,
        apiKey,
        model,
        mode,
        promptText: text,
        signal: controller.signal,
      });
      markUsed(provider);
      setRun({
        result: {
          raw: result.raw,
          parsed: result.parsed,
          parseError: result.parseError,
        },
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
        model,
        mode,
        promptText: text,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof EvalNoKeyError || err instanceof ModelError) {
        setError(err.message);
      } else {
        setError("The evaluation failed. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Persist a finished run to the vault so it surfaces under /drafts. */
  function saveRun(state: RunState): boolean {
    try {
      createDraft({
        title: `${MODE_LABELS[state.mode]} · ${new Date().toLocaleString()}`,
        body: state.promptText,
        kind: "compose",
        tags: ["eval", state.mode],
        meta: {
          evalMode: state.mode,
          model: state.model,
          result: state.result,
          usage: state.usage,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  if (available.length === 0) {
    return (
      <div className="card card-lg card-dashed">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>
          Add an API key to use Eval
        </h2>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
          Eval sends your prompt to a model you choose, using your own key. It
          costs whatever that provider charges for roughly{" "}
          {EVAL_SYSTEM_TOKENS_EST} tokens of instructions plus your prompt.
        </p>
        <Link href="/settings" className="btn btn-primary">
          Add a key
        </Link>
      </div>
    );
  }

  const models = evalModels(provider);

  return (
    <>
      <div className="card card-lg">
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginBottom: 16,
          }}
        >
          <div>
            <label className="field-label" htmlFor="eval-provider">
              Provider
            </label>
            <select
              id="eval-provider"
              className="select"
              value={provider}
              onChange={(e) => changeProvider(e.target.value as Provider)}
            >
              {available.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="eval-model">
              Model
            </label>
            <select
              id="eval-model"
              className="select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.note ? ` — ${m.note}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="eval-mode">
              What to check
            </label>
            <select
              id="eval-mode"
              className="select"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="field-label" htmlFor="eval-prompt">
          Prompt to evaluate
        </label>
        <textarea
          id="eval-prompt"
          className="textarea"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Paste the prompt you want scored, rewritten, or checked…"
          rows={12}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={go}
            disabled={busy || promptText.trim().length < 10}
          >
            {busy ? "Evaluating…" : "Run eval"}
          </button>
          {busy && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel
            </button>
          )}
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            ~{EVAL_SYSTEM_TOKENS_EST} tokens of instructions + your prompt, billed
            to your {PROVIDER_LABELS[provider]} account.
          </span>
        </div>

        {error && (
          <p className="vault-error" style={{ marginTop: 12, marginBottom: 0 }}>
            {error}
          </p>
        )}
      </div>

      {run && (
        <div style={{ marginTop: 20 }}>
          <ResultBlock
            mode={run.mode}
            promptText={run.promptText}
            result={run.result}
            usage={run.usage}
            ranModel={modelLabel(provider, run.model)}
            onSave={() => saveRun(run)}
          />
        </div>
      )}
    </>
  );
}

function ResultBlock({
  mode,
  promptText,
  result,
  usage,
  ranModel,
  onSave,
}: {
  mode: Mode;
  promptText: string;
  result: { raw: string; parsed: unknown; parseError: string | null };
  usage?: { inputTokens: number | null; outputTokens: number | null };
  ranModel: string;
  /** Persist this run to the vault. Supplied by EvalForm, which owns the hook. */
  onSave: () => boolean;
}) {
  const [copied, setCopied] = useState<"md" | "plain" | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const md = resultToMarkdown(mode, result.parsed, result.raw);
  const plain = resultToPlain(mode, result.parsed, result.raw);

  async function copy(kind: "md" | "plain", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked by the browser */
    }
  }

  // Persist the whole eval run (prompt + mode + result snapshot) to the vault
  // so it surfaces on /drafts. Synchronous: the parent writes into the already
  // decrypted in-memory document, and encryption happens on the store's debounce.
  function save() {
    setSaving(true);
    setSaveErr("");
    const ok = onSave();
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } else {
      setSaveErr("Couldn't save this eval. Please try again.");
    }
  }

  return (
    <section className="card" style={{ background: "var(--bg-card-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <span className="label-mono">result · {ranModel}</span>
        {usage && (
          <span className="label-mono">
            in {usage.inputTokens ?? "?"} · out {usage.outputTokens ?? "?"} tokens
          </span>
        )}
      </div>

      {result.parseError ? (
        <>
          <p style={{ color: "var(--warn)", fontSize: "0.78rem", marginBottom: "8px" }}>
            Model returned non-JSON ({result.parseError}). Showing raw text.
          </p>
          <pre style={{ overflow: "auto", whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>{result.raw}</pre>
        </>
      ) : (
        <RenderParsed mode={mode} parsed={result.parsed} />
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "16px" }}>
        <button className="btn btn-primary" type="button" onClick={() => copy("md", md)}>
          {copied === "md" ? "Copied ✓" : "Copy as Markdown"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => copy("plain", plain)}>
          {copied === "plain" ? "Copied ✓" : "Copy as plain text"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={save} disabled={saving}>
          {saved ? "Saved to drafts ✓" : saving ? "Saving…" : "Save to Eval drafts"}
        </button>
        {saved && (
          <Link href="/drafts" style={{ fontSize: "0.8rem" }}>Open Drafts &rarr;</Link>
        )}
        {saveErr && (
          <span style={{ fontSize: "0.8rem", color: "var(--bad)" }}>{saveErr}</span>
        )}
      </div>
    </section>
  );
}

function RenderParsed({ mode, parsed }: { mode: Mode; parsed: unknown }) {
  if (mode === "structure" && isStructure(parsed)) return <StructureView data={parsed} />;
  if (mode === "spellcheck" && isSpellcheck(parsed)) return <SpellcheckView data={parsed} />;
  if (mode === "optimize" && isOptimize(parsed)) return <OptimizeView data={parsed} />;
  if (mode === "codecheck" && isCodecheck(parsed)) return <CodecheckView data={parsed} />;
  return (
    <pre style={{ overflow: "auto", whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

const RGCBTS: Array<keyof StructureData["scores"]> = ["role", "goal", "context", "bounds", "task", "success"];

type StructureData = {
  scores: { role: number; goal: number; context: number; bounds: number; task: number; success: number };
  overall: number;
  feedback: string;
};

function StructureView({ data }: { data: StructureData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontSize: "2rem", fontWeight: 700, color: scoreColor(data.overall) }}>{data.overall}</span>
        <span className="muted" style={{ fontSize: "0.85rem" }}>overall / 100</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {RGCBTS.map((k) => (
          <ScoreBar key={k} label={k} value={data.scores[k] ?? 0} />
        ))}
      </div>
      {data.feedback && (
        <p style={{ fontSize: "0.9rem", color: "var(--text-dim)", lineHeight: 1.6, marginTop: "4px" }}>
          {data.feedback}
        </p>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "84px 1fr 36px", alignItems: "center", gap: "10px" }}>
      <span className="label-mono" style={{ textTransform: "capitalize" }}>{label}</span>
      <span style={{ height: "8px", borderRadius: "999px", background: "var(--bg-card-hover)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: scoreColor(value), borderRadius: "999px" }} />
      </span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function scoreColor(v: number): string {
  if (v >= 75) return "var(--good)";
  if (v >= 45) return "var(--warn)";
  return "var(--bad)";
}

type SpellcheckData = { issues: Array<{ original: string; suggestion: string; reason: string }> };

function SpellcheckView({ data }: { data: SpellcheckData }) {
  if (data.issues.length === 0) {
    return <p style={{ color: "var(--good)", fontSize: "0.9rem" }}>No spelling or grammar issues found.</p>;
  }
  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: "10px", listStyle: "none", padding: 0, margin: 0 }}>
      {data.issues.map((iss, i) => (
        <li key={i} className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "0.85rem" }}>
            <span style={{ color: "var(--bad)", textDecoration: "line-through" }}>{iss.original}</span>
            {" → "}
            <span style={{ color: "var(--good)" }}>{iss.suggestion}</span>
          </div>
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: "4px" }}>{iss.reason}</div>
        </li>
      ))}
    </ul>
  );
}

type OptimizeData = { rewritten: string; changes: Array<{ what: string; why: string }> };

function OptimizeView({ data }: { data: OptimizeData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <div className="label-mono" style={{ marginBottom: "6px" }}>rewritten</div>
        <pre style={{ overflow: "auto", whiteSpace: "pre-wrap", fontSize: "0.85rem", background: "var(--bg-card)", padding: "12px", borderRadius: "8px" }}>
          {data.rewritten}
        </pre>
      </div>
      {data.changes?.length > 0 && (
        <div>
          <div className="label-mono" style={{ marginBottom: "6px" }}>changes</div>
          <ul style={{ display: "flex", flexDirection: "column", gap: "8px", listStyle: "none", padding: 0, margin: 0 }}>
            {data.changes.map((c, i) => (
              <li key={i} style={{ fontSize: "0.85rem" }}>
                <strong>{c.what}</strong>
                <span className="muted"> — {c.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type CodecheckData = {
  blocks: Array<{ language: string; issues: Array<{ line: number | null; severity: "error" | "warning"; message: string }> }>;
};

function CodecheckView({ data }: { data: CodecheckData }) {
  if (data.blocks.length === 0) {
    return <p className="muted" style={{ fontSize: "0.9rem" }}>No code blocks found in the prompt.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {data.blocks.map((b, i) => (
        <div key={i}>
          <div className="label-mono" style={{ marginBottom: "6px" }}>{b.language || "code"}</div>
          {b.issues.length === 0 ? (
            <p style={{ color: "var(--good)", fontSize: "0.85rem" }}>No issues.</p>
          ) : (
            <ul style={{ display: "flex", flexDirection: "column", gap: "6px", listStyle: "none", padding: 0, margin: 0 }}>
              {b.issues.map((iss, j) => (
                <li key={j} style={{ fontSize: "0.85rem" }}>
                  <span className="label-mono" style={{ color: iss.severity === "error" ? "var(--bad)" : "var(--warn)" }}>
                    {iss.severity}
                  </span>
                  {iss.line != null ? ` L${iss.line}` : ""} — {iss.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function isStructure(v: unknown): v is StructureData {
  return !!v && typeof v === "object" && "scores" in v && "overall" in v;
}
function isSpellcheck(v: unknown): v is SpellcheckData {
  return !!v && typeof v === "object" && Array.isArray((v as SpellcheckData).issues);
}
function isOptimize(v: unknown): v is OptimizeData {
  return !!v && typeof v === "object" && typeof (v as OptimizeData).rewritten === "string";
}
function isCodecheck(v: unknown): v is CodecheckData {
  return !!v && typeof v === "object" && Array.isArray((v as CodecheckData).blocks);
}

// ---------- result copy / export helpers ----------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function resultToMarkdown(mode: Mode, parsed: unknown, raw: string): string {
  if (mode === "optimize" && isOptimize(parsed)) return parsed.rewritten.trim();
  if (mode === "structure" && isStructure(parsed)) {
    const rows = RGCBTS.map((k) => `- **${cap(k)}:** ${parsed.scores[k] ?? 0}`).join("\n");
    return `**Overall: ${parsed.overall}/100**\n\n${rows}${parsed.feedback ? `\n\n${parsed.feedback}` : ""}`;
  }
  if (mode === "spellcheck" && isSpellcheck(parsed)) {
    if (!parsed.issues.length) return "No spelling or grammar issues found.";
    return parsed.issues.map((i) => `- "${i.original}" → "${i.suggestion}" — ${i.reason}`).join("\n");
  }
  if (mode === "codecheck" && isCodecheck(parsed)) {
    if (!parsed.blocks.length) return "No code blocks found.";
    return parsed.blocks
      .map((b) => {
        const head = `### ${b.language || "code"}`;
        if (!b.issues.length) return `${head}\nNo issues.`;
        return `${head}\n` + b.issues.map((x) => `- **${x.severity}**${x.line != null ? ` (L${x.line})` : ""}: ${x.message}`).join("\n");
      })
      .join("\n\n");
  }
  return raw;
}

function resultToPlain(mode: Mode, parsed: unknown, raw: string): string {
  if (mode === "optimize" && isOptimize(parsed)) {
    return parsed.rewritten.replace(/^#{1,6}\s+/gm, "").trim(); // strip heading markers
  }
  if (mode === "structure" && isStructure(parsed)) {
    const rows = RGCBTS.map((k) => `${cap(k)}: ${parsed.scores[k] ?? 0}`).join("\n");
    return `Overall: ${parsed.overall}/100\n\n${rows}${parsed.feedback ? `\n\n${parsed.feedback}` : ""}`;
  }
  if (mode === "spellcheck" && isSpellcheck(parsed)) {
    if (!parsed.issues.length) return "No spelling or grammar issues found.";
    return parsed.issues.map((i) => `${i.original} -> ${i.suggestion} (${i.reason})`).join("\n");
  }
  if (mode === "codecheck" && isCodecheck(parsed)) {
    if (!parsed.blocks.length) return "No code blocks found.";
    return parsed.blocks
      .map((b) => {
        const head = `${b.language || "code"}:`;
        if (!b.issues.length) return `${head} No issues.`;
        return `${head}\n` + b.issues.map((x) => `${x.severity}${x.line != null ? ` (L${x.line})` : ""}: ${x.message}`).join("\n");
      })
      .join("\n\n");
  }
  return raw;
}
