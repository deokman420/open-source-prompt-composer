"use client";
import { useEffect, useReducer, useState } from "react";
import ParamRow from "./ParamRow";
import ToolPreview from "./ToolPreview";
import Drafts from "./Drafts";
import { hasAnyContent, initialState, toolReducer } from "./state";
import { TOOL_TEMPLATES } from "@/lib/tools/templates";
import type { ToolDef, ToolState } from "@/lib/tools/types";

const CURRENT_KEY = "context.composer.tool.current.v1";

function persist(s: ToolState) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}

function restore(): ToolState | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.tool || !Array.isArray(s.tool.params)) return null;
    return s as ToolState;
  } catch {
    return null;
  }
}

// Opened from the /drafts library: the tool def is stashed in sessionStorage.
// Consume it once and validate shape; takes precedence over the local restore.
function readPrefill(): ToolDef | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem("pc:tool-prefill");
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    sessionStorage.removeItem("pc:tool-prefill");
  } catch {
    /* ignore */
  }
  try {
    const def = JSON.parse(raw);
    if (!def || !Array.isArray(def.params)) return null;
    return def as ToolDef;
  } catch {
    return null;
  }
}

const inputCls =
  "w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]";

export default function ToolsClient() {
  const [state, dispatch] = useReducer(toolReducer, undefined, initialState);
  const [saveSignal, setSaveSignal] = useState(0);
  const [toast, setToast] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    // Precedence: a draft opened from the library, then the local working copy.
    const pre = readPrefill();
    if (pre) {
      dispatch({ type: "load", state: { tool: pre } });
      return;
    }
    const restored = restore();
    if (restored) dispatch({ type: "load", state: restored });
  }, []);

  useEffect(() => {
    persist(state);
  }, [state]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function loadTemplate(id: string) {
    const tpl = TOOL_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (hasAnyContent(state) && !window.confirm(`Load "${tpl.title}"? Current tool will be replaced.`)) {
      return;
    }
    dispatch({ type: "load", state: { tool: structuredClone(tpl.tool) } });
    showToast(`Loaded: ${tpl.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newBlank() {
    if (hasAnyContent(state) && !window.confirm("Clear this tool? Save a draft first if you want to keep it.")) {
      return;
    }
    dispatch({ type: "newBlank" });
    setTitle("");
  }

  function saveDraft() {
    if (!hasAnyContent(state)) {
      showToast("Add a name or description first.");
      return;
    }
    setSaveSignal((n) => n + 1);
    showToast("Saved ✓");
  }

  const tool = state.tool;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded bg-[var(--bg-card-2)] px-4 py-2 text-sm text-[var(--text)] shadow-lg">
          {toast}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          01 · jump-start · load a template
        </h2>
        <div className="flex flex-wrap gap-2">
          {TOOL_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => loadTemplate(t.id)}
              title={t.blurb}
              className="rounded border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 font-mono text-xs text-[var(--text-dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {t.title}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          {/* Identity */}
          <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              02 · identity
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <div>
                <label className={labelCls} htmlFor="tool-ns">Namespace</label>
                <input
                  id="tool-ns"
                  className={inputCls + " font-mono"}
                  value={tool.namespace ?? ""}
                  placeholder="optional"
                  spellCheck={false}
                  onChange={(e) => dispatch({ type: "setMeta", field: "namespace", value: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="tool-name">Name</label>
                <input
                  id="tool-name"
                  className={inputCls + " font-mono"}
                  value={tool.name}
                  placeholder="get_weather"
                  spellCheck={false}
                  onChange={(e) => dispatch({ type: "setMeta", field: "name", value: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls} htmlFor="tool-desc">Description</label>
              <textarea
                id="tool-desc"
                className={inputCls + " resize-y"}
                rows={4}
                value={tool.description}
                placeholder="What the tool does, in detail. Aim for 3-4 sentences: what it does, what it returns, and any caveats."
                onChange={(e) => dispatch({ type: "setMeta", field: "description", value: e.target.value })}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="tool-when">When to use</label>
                <textarea
                  id="tool-when"
                  className={inputCls + " resize-y"}
                  rows={2}
                  value={tool.whenToUse ?? ""}
                  placeholder="Optional — appended to the description."
                  onChange={(e) => dispatch({ type: "setMeta", field: "whenToUse", value: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="tool-whennot">When NOT to use</label>
                <textarea
                  id="tool-whennot"
                  className={inputCls + " resize-y"}
                  rows={2}
                  value={tool.whenNotToUse ?? ""}
                  placeholder="Optional — appended to the description."
                  onChange={(e) => dispatch({ type: "setMeta", field: "whenNotToUse", value: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls} htmlFor="tool-returns">Returns (note)</label>
              <input
                id="tool-returns"
                className={inputCls}
                value={tool.returnsNote ?? ""}
                placeholder="Optional — what the tool returns (the API has no response schema; this lives in the description)."
                onChange={(e) => dispatch({ type: "setMeta", field: "returnsNote", value: e.target.value })}
              />
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-dim)]">
              <input
                name="tool-strict"
                type="checkbox"
                checked={Boolean(tool.strict)}
                onChange={(e) => dispatch({ type: "setStrict", value: e.target.checked })}
              />
              <span>
                <code>strict: true</code> — guarantee tool calls match the schema (closes the schema with{" "}
                <code>additionalProperties: false</code>).
              </span>
            </label>
          </section>

          {/* Parameters */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                03 · parameters
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                {tool.params.length === 1 ? "1 parameter" : `${tool.params.length} parameters`}
              </span>
            </div>
            <div className="space-y-3">
              {tool.params.map((p, idx) => (
                <ParamRow
                  key={p.id ?? idx}
                  param={p}
                  idx={idx}
                  onChange={(patch) => dispatch({ type: "setParam", idx, patch })}
                  onDelete={() => dispatch({ type: "deleteParam", idx })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "addParam" })}
              className="mt-3 text-sm text-[var(--accent)] hover:opacity-80"
            >
              + Add parameter
            </button>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <input
              name="tool-draft-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Optional title for this draft"
              aria-label="Draft title"
              className={`${inputCls} max-w-xs`}
            />
            <button type="button" onClick={newBlank} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
              New blank tool
            </button>
            <button type="button" onClick={saveDraft} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
              Save draft
            </button>
          </div>
        </div>

        <aside>
          <ToolPreview tool={tool} />
        </aside>
      </div>

      <Drafts
        tool={tool}
        title={title}
        onSaved={() => setTitle("")}
        onSaveSignal={saveSignal}
        onLoad={(t: ToolDef) => {
          dispatch({ type: "load", state: { tool: t } });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
