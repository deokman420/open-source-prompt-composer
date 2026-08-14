"use client";
import { useEffect, useReducer, useState } from "react";
import PatternPicker from "./PatternPicker";
import AgentCard from "./AgentCard";
import CoordinationCard from "./CoordinationCard";
import LivePreview from "./LivePreview";
import Library from "./Library";
import Drafts from "./Drafts";
import { hasAnyContent, initialState, orchReducer } from "./state";
import { ORCH_PATTERNS } from "@/lib/orchestra/patterns";
import { encodeState, decodeState } from "@/lib/orchestra/share";
import type { OrchState, PatternId } from "@/lib/orchestra/types";
import { scratchGet, scratchSet } from "@/lib/vault/scratch";
import { takeHandoff } from "@/lib/handoff";

const CURRENT_KEY = "context.composer.orch.current.v1";

function persist(s: OrchState) {
  // Into the encrypted vault, not localStorage — a plaintext mirror of the
  // same prompts would make vault encryption decorative.
  scratchSet(CURRENT_KEY, s);
}

function restore(): OrchState | null {
  try {
    const s = scratchGet<unknown>(CURRENT_KEY) as Record<string, unknown> | null;
    if (!s) return null;
    if (!s || !s.pattern || !Array.isArray(s.agents)) return null;
    return s as unknown as OrchState;
  } catch {
    return null;
  }
}

// Opened from the /drafts library: the orchestra state is stashed in
// sessionStorage. Consume it once and validate shape; takes precedence over the
// local restore (mirrors the compose/tool/ctx editors).
function readPrefill(): OrchState | null {
  if (typeof window === "undefined") return null;
  const raw = takeHandoff("orch-prefill");
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s.pattern !== "string" || !Array.isArray(s.agents)) return null;
    return s as unknown as OrchState;
  } catch {
    return null;
  }
}

export default function OrchestraClient() {
  const [state, dispatch] = useReducer(orchReducer, undefined, initialState);
  const [saveSignal, setSaveSignal] = useState(0);
  const [toast, setToast] = useState("");

  // Restore from localStorage / hash on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.startsWith("#o=")) {
      const decoded = decodeState(hash.slice(3));
      if (decoded) {
        dispatch({ type: "load", state: decoded });
        history.replaceState(null, "", location.pathname);
        showToast("Loaded shared orchestra");
        return;
      }
    }
    const pre = readPrefill();
    if (pre) {
      dispatch({ type: "load", state: pre });
      showToast("Orchestra loaded");
      return;
    }
    const restored = restore();
    if (restored) dispatch({ type: "load", state: restored });
  }, []);

  // Persist on every state change.
  useEffect(() => {
    persist(state);
  }, [state]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function switchPattern(id: PatternId) {
    if (hasAnyContent(state)) {
      const next = ORCH_PATTERNS[id].title;
      if (!window.confirm(`Switch to "${next}"? Current agents will be replaced with the pattern's defaults.`)) {
        return;
      }
    }
    dispatch({ type: "switchPattern", pattern: id });
  }

  function loadTemplate(next: OrchState, label: string) {
    if (hasAnyContent(state) && !window.confirm(`Load "${label}"? Current orchestra will be replaced.`)) return;
    dispatch({ type: "load", state: next });
    showToast(`Loaded: ${label}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function newBlank() {
    if (hasAnyContent(state) && !window.confirm("Clear this orchestra? Save a draft first if you want to keep it.")) return;
    dispatch({ type: "newBlank" });
  }

  function saveDraft() {
    if (!hasAnyContent(state)) {
      showToast("Fill at least one agent first.");
      return;
    }
    setSaveSignal((n) => n + 1);
    showToast("Saved ✓");
  }

  async function share() {
    if (!hasAnyContent(state)) {
      showToast("Fill at least one agent first.");
      return;
    }
    const encoded = encodeState(state);
    const url = `${location.origin}${location.pathname}#o=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(url.length > 2000 ? `⚠ URL is long (${url.length} chars)` : "Link copied ✓");
    } catch {
      window.prompt("Copy this URL:", url);
    }
  }

  const pattern = ORCH_PATTERNS[state.pattern];
  const workerCount = state.agents.filter((a) => a.kind === "worker").length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded bg-[var(--bg-card-2)] px-4 py-2 text-sm text-[var(--text)] shadow-lg">
          {toast}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          01 · jump-start · pick a pattern
        </h2>
        <PatternPicker current={state.pattern} onPick={switchPattern} />
      </section>

      <Library onLoad={loadTemplate} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              02 · pattern
            </div>
            <div className="text-sm font-medium text-[var(--text)]">{pattern.title}</div>
            <div className="mt-1 text-xs text-[var(--text-dim)]">{pattern.blurb}</div>
            <pre className="mt-2 overflow-auto rounded bg-[var(--bg)] p-3 text-[12px] leading-none text-[var(--text-dim)]">
              {pattern.diagram}
            </pre>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                03 · agents
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                {workerCount === 1 ? "1 worker" : `${workerCount} workers`}
              </span>
            </div>
            <div className="space-y-3">
              {state.agents.map((agent, idx) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  idx={idx}
                  onRename={(name) => dispatch({ type: "renameAgent", idx, name })}
                  onToggleCollapse={() => dispatch({ type: "toggleCollapse", idx })}
                  onDelete={() => dispatch({ type: "deleteAgent", idx })}
                  onSlot={(slot, value) => dispatch({ type: "setSlot", idx, slot, value })}
                  onSetModel={(model) => dispatch({ type: "setAgentModel", idx, model })}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "addWorker" })}
              className="mt-3 text-sm text-[var(--accent)] hover:opacity-80"
            >
              + Add worker
            </button>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              04 · coordination
            </div>
            <CoordinationCard
              value={state.coordination}
              onChange={{
                handoff: (v) => dispatch({ type: "setHandoff", value: v }),
                maxWorkers: (v) => dispatch({ type: "setMaxWorkers", value: v }),
                termination: (v) => dispatch({ type: "setTermination", value: v }),
                sharedMemory: (v) => dispatch({ type: "setSharedMemory", value: v }),
              }}
            />
          </section>

          {/* Buttons, not text links: the action bar was reading as easily-missed
              prose. btn-secondary gives it a clear affordance; New blank is the
              odd-one-out (destructive-ish) so it stays the quieter btn-ghost. */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={newBlank} className="btn btn-ghost">
              New blank orchestra
            </button>
            <button type="button" onClick={saveDraft} className="btn btn-secondary">
              Save draft
            </button>
            <button type="button" onClick={share} className="btn btn-secondary">
              Share link
            </button>
          </div>
        </div>

        <aside className="min-w-0">
          <LivePreview state={state} />
        </aside>
      </div>

      <Drafts
        state={state}
        onSaveSignal={saveSignal}
        onLoad={(s) => {
          dispatch({ type: "load", state: s });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
