"use client";
import { useEffect, useReducer, useState } from "react";
import SourcesStage from "./SourcesStage";
import BudgetStage from "./BudgetStage";
import MeasurePanel from "./MeasurePanel";
import CompressionStage from "./CompressionStage";
import HandoffStage from "./HandoffStage";
import PipelinePreview from "./PipelinePreview";
import Drafts from "./Drafts";
import { ctxReducer, initialState, hasAnyContent } from "./state";
import { encodeState, decodeState } from "@/lib/context-pipeline/share";
import type { CtxState } from "@/lib/context-pipeline/types";

const CURRENT_KEY = "context.composer.ctxpipe.current.v1";

function persist(s: CtxState) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}

function restore(): CtxState | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.model !== "string" || !s.sources) return null;
    return s as CtxState;
  } catch {
    return null;
  }
}

// Opened from the /drafts library: the pipeline is stashed in sessionStorage.
// Consume it once and validate shape; takes precedence over the local restore.
function readPrefill(): CtxState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem("pc:ctx-prefill");
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    sessionStorage.removeItem("pc:ctx-prefill");
  } catch {
    /* ignore */
  }
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s.model !== "string" || !s.sources) return null;
    return s as CtxState;
  } catch {
    return null;
  }
}

export default function ContextPipelineClient() {
  const [state, dispatch] = useReducer(ctxReducer, undefined, initialState);
  const [toast, setToast] = useState("");
  const [saveSignal, setSaveSignal] = useState(0);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Precedence: a share-link hash, then a draft opened from the library, then
    // the local working copy.
    const hash = window.location.hash;
    if (hash.startsWith("#c=")) {
      const decoded = decodeState(hash.slice(3));
      if (decoded) {
        dispatch({ type: "load", state: decoded });
        history.replaceState(null, "", location.pathname);
        showToast("Loaded shared pipeline");
        return;
      }
    }
    const pre = readPrefill();
    if (pre) {
      dispatch({ type: "load", state: pre });
      showToast("Pipeline loaded");
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

  function newBlank() {
    if (hasAnyContent(state) && !window.confirm("Reset to defaults? Your current pipeline will be cleared.")) return;
    dispatch({ type: "reset" });
    setTitle("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function share() {
    const encoded = encodeState(state);
    const url = `${location.origin}${location.pathname}#c=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(url.length > 2000 ? `⚠ URL is long (${url.length} chars)` : "Link copied ✓");
    } catch {
      window.prompt("Copy this URL:", url);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded bg-[var(--bg-card-2)] px-4 py-2 text-sm text-[var(--text)] shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <SourcesStage state={state} dispatch={dispatch} />
          <BudgetStage state={state} dispatch={dispatch} />
          <MeasurePanel state={state} dispatch={dispatch} />
          <CompressionStage state={state} dispatch={dispatch} />
          <HandoffStage state={state} dispatch={dispatch} />

          <div className="flex flex-wrap items-center gap-3">
            <input
              name="pipeline-draft-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Optional title for this draft"
              aria-label="Draft title"
              className="max-w-xs rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setSaveSignal((n) => n + 1);
                showToast("Pipeline saved");
              }}
              className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              Save pipeline
            </button>
            <button type="button" onClick={newBlank} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
              Reset to defaults
            </button>
            <button type="button" onClick={share} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
              Share link
            </button>
          </div>

          <Drafts
            onLoad={(s) => {
              dispatch({ type: "load", state: s });
              showToast("Pipeline loaded");
            }}
            onSaveSignal={saveSignal}
            state={state}
            title={title}
            onSaved={() => setTitle("")}
          />
        </div>

        <aside>
          <PipelinePreview state={state} dispatch={dispatch} />
        </aside>
      </div>
    </div>
  );
}
