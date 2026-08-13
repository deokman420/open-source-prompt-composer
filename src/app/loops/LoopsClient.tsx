"use client";
import { useEffect, useMemo, useState } from "react";
import Drafts from "./Drafts";
import {
  analyzeInterval,
  buildCommand,
  buildLoopMd,
  loopError,
} from "@/lib/loops/build";
import { LOOP_TEMPLATES } from "@/lib/loops/templates";
import { LOOP_CATEGORIES, emptyLoopState } from "@/lib/loops/types";
import type { LoopMode, LoopState } from "@/lib/loops/types";

const CURRENT_KEY = "context.composer.loop.current.v1";

function persist(s: LoopState) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
}
function restore(): LoopState | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.mode !== "string") return null;
    return s as LoopState;
  } catch {
    return null;
  }
}

// Opened from the /drafts library (Loops tab): the LoopState is stashed in
// sessionStorage. Consume it once and validate shape; takes precedence over the
// local working copy. Mirrors ToolsClient.readPrefill.
function readPrefill(): LoopState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem("pc:loop-prefill");
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    sessionStorage.removeItem("pc:loop-prefill");
  } catch {
    /* ignore */
  }
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s.mode !== "string") return null;
    return s as LoopState;
  } catch {
    return null;
  }
}

const inputCls =
  "w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]";

const MODES: { id: LoopMode; label: string; hint: string }[] = [
  { id: "fixed", label: "Fixed interval", hint: "Interval + prompt → a fixed cron schedule." },
  { id: "self-paced", label: "Self-paced", hint: "Prompt only → Claude picks each delay (1–60m)." },
  { id: "maintenance", label: "Maintenance", hint: "Bare /loop → built-in prompt or your loop.md." },
];

export default function LoopsClient() {
  const [loop, setLoop] = useState<LoopState>(() => emptyLoopState("fixed"));
  const [title, setTitle] = useState("");
  const [saveSignal, setSaveSignal] = useState(0);
  const [toast, setToast] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    // Precedence: a draft opened from the library, then the local working copy.
    const pre = readPrefill();
    if (pre) {
      setLoop(pre);
      return;
    }
    const r = restore();
    if (r) setLoop(r);
  }, []);
  useEffect(() => {
    persist(loop);
  }, [loop]);

  function set<K extends keyof LoopState>(key: K, val: LoopState[K]) {
    setLoop((l) => ({ ...l, [key]: val }));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function loadState(next: LoopState, label: string) {
    setLoop(structuredClone(next));
    showToast(`Loaded: ${label}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveLoop() {
    const err = loopError(loop);
    if (err) {
      showToast(err);
      return;
    }
    setSaveSignal((n) => n + 1);
    showToast("Saved ✓");
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${what} ✓`);
    } catch {
      showToast("Copy failed — select and copy manually.");
    }
  }

  const analysis = useMemo(() => analyzeInterval(loop.interval), [loop.interval]);
  const command = useMemo(() => buildCommand(loop), [loop]);
  const loopMd = useMemo(() => buildLoopMd(loop), [loop]);
  const err = loopError(loop);

  const showInterval = loop.mode === "fixed" || loop.mode === "maintenance";
  const showLoopMd = loop.mode === "maintenance";

  const galleryTemplates =
    cat === "all" ? LOOP_TEMPLATES : LOOP_TEMPLATES.filter((t) => t.category === cat);

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded bg-[var(--bg-card-2)] px-4 py-2 text-sm text-[var(--text)] shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,460px)]">
        {/* ── Builder ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Mode */}
          <div>
            <span className={labelCls}>Loop type</span>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const active = loop.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("mode", m.id)}
                    className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                        : "border-[var(--border)] bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                    }`}
                    aria-pressed={active}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {MODES.find((m) => m.id === loop.mode)?.hint}
            </p>
          </div>

          {/* Interval (fixed + optional for maintenance) */}
          {showInterval && (
            <div>
              <label className={labelCls} htmlFor="loop-interval">
                Interval {loop.mode === "maintenance" && "(optional — leave blank to let Claude pace it)"}
              </label>
              <input
                id="loop-interval"
                className={inputCls}
                placeholder="5m · 30m · 2h · 1d"
                value={loop.interval}
                onChange={(e) => set("interval", e.target.value)}
              />
              {analysis.notes.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {analysis.notes.map((n, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-xs"
                      style={{ color: n.severity === "warn" ? "var(--warn)" : "var(--text-muted)" }}
                    >
                      <span aria-hidden>{n.severity === "warn" ? "▲" : "›"}</span>
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              {analysis.cron && (
                <p className="mt-1 font-mono text-xs text-[var(--text-dim)]">
                  cron: {analysis.cron}
                </p>
              )}
            </div>
          )}

          {/* Prompt / loop.md body */}
          {(
            <div>
              <label className={labelCls} htmlFor="loop-prompt">
                {loop.mode === "maintenance" ? "loop.md body (optional)" : loop.isCommand ? "Slash command to re-run" : "Prompt to run each iteration"}
              </label>
              <textarea
                id="loop-prompt"
                className={`${inputCls} min-h-[96px] resize-y ${loop.isCommand ? "font-mono" : "font-sans"}`}
                placeholder={
                  loop.mode === "maintenance"
                    ? "Leave blank to use the built-in maintenance prompt, or describe a custom default…"
                    : loop.isCommand
                      ? "/review-pr 1234"
                      : "Check whether CI passed and address any review comments."
                }
                value={loop.prompt}
                onChange={(e) => set("prompt", e.target.value)}
              />
              {loop.mode !== "maintenance" && (
                <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <input
                    type="checkbox"
                    checked={loop.isCommand}
                    onChange={(e) => set("isCommand", e.target.checked)}
                  />
                  The body is a saved slash command (e.g. <code>/review-pr 1234</code>)
                </label>
              )}
            </div>
          )}

          {/* Guardrails — the loop-engineering layer */}
          {!loop.isCommand && (
            <details className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3" open={loop.mode !== "maintenance"}>
              <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">
                Stop condition &amp; verifier{" "}
                <span className="font-normal text-[var(--text-muted)]">— how the loop ends cleanly</span>
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className={labelCls} htmlFor="loop-stop">Stop when (measurable exit)</label>
                  <input
                    id="loop-stop"
                    className={inputCls}
                    placeholder="CI is green · the queue is empty · git status is clean"
                    value={loop.stopCondition}
                    onChange={(e) => set("stopCondition", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="loop-verifier">Verify completion by</label>
                  <input
                    id="loop-verifier"
                    className={inputCls}
                    placeholder="re-running the suite from clean — not by editing or skipping tests"
                    value={loop.verifier}
                    onChange={(e) => set("verifier", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    The hard part of a loop is the verifier, not the loop. One green run is luck; require proof.
                  </p>
                </div>
                <div>
                  <label className={labelCls} htmlFor="loop-cap">Give up after N iterations (optional)</label>
                  <input
                    id="loop-cap"
                    className={`${inputCls} max-w-[140px]`}
                    inputMode="numeric"
                    placeholder="20"
                    value={loop.maxTurns}
                    onChange={(e) => set("maxTurns", e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </div>
              </div>
            </details>
          )}

          {/* Save */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className={labelCls} htmlFor="loop-title">Name (optional)</label>
              <input
                id="loop-title"
                className={inputCls}
                placeholder="Release-branch keeper"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <button type="button" onClick={saveLoop} className="btn btn-primary">Save loop</button>
            <button
              type="button"
              onClick={() => { setLoop(emptyLoopState(loop.mode)); setTitle(""); }}
              className="btn"
            >
              Clear
            </button>
          </div>

          <Drafts
            loop={loop}
            title={title}
            onSaveSignal={saveSignal}
            onLoad={(l) => loadState(l, "saved loop")}
            onSaved={() => { setTitle(""); }}
          />
        </div>

        {/* ── Live preview ────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className={labelCls + " mb-0"}>Command</span>
              <button
                type="button"
                onClick={() => copy(command, "command")}
                className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
              >
                Copy
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--bg-card-2)] p-3 font-mono text-sm text-[var(--text)]">
{command || "/loop"}
            </pre>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Paste into Claude Code (v2.1.72+). Press <kbd>Esc</kbd> while it waits to stop the loop.
              {err && <span style={{ color: "var(--warn)" }}> · {err}</span>}
            </p>
          </div>

          {showLoopMd && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className={labelCls + " mb-0"}>.claude/loop.md</span>
                <button
                  type="button"
                  onClick={() => copy(loopMd, "loop.md")}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--bg-card-2)] p-3 font-mono text-xs text-[var(--text)]">
{loopMd}
              </pre>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Commit as <code>.claude/loop.md</code> (project) or <code>~/.claude/loop.md</code> (user).
                Bare <code>/loop</code> runs it; edits apply on the next iteration. Max 25,000 bytes.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 text-xs leading-relaxed text-[var(--text-muted)]">
            <p className="mb-1 font-medium text-[var(--text)]">Good to know</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Loops are session-scoped — they pause when the session closes and restore on <code>--resume</code>.</li>
              <li>Recurring tasks auto-expire 7 days after creation.</li>
              <li>For unattended scheduling, reach for Routines, Desktop tasks, or GitHub Actions instead.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Education gallery ─────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="label-mono">learn · loop patterns</div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Pattern gallery</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Each card is a working loop with the technique it teaches. Load one, then edit it into your own.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Pattern category">
          {["all", ...LOOP_CATEGORIES].map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                }`}
              >
                {c === "all" ? "All" : c}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {galleryTemplates.map((t) => {
            const cmd = buildCommand(t.state);
            return (
              <div key={t.id} className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--accent)]">{t.category}</div>
                <h3 className="text-sm font-semibold text-[var(--text)]">{t.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{t.blurb}</p>

                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--bg-card-2)] p-2 font-mono text-[11px] text-[var(--text)]">
{cmd}
                </pre>

                <div className="mt-3 space-y-2 text-xs">
                  <p><span className="font-medium text-[var(--text)]">Teaches: </span><span className="text-[var(--text-muted)]">{t.teaches}</span></p>
                  <p><span className="font-medium text-[var(--text)]">When: </span><span className="text-[var(--text-muted)]">{t.whenToUse}</span></p>
                </div>

                <div className="mt-3 flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => loadState(t.state, t.title)}
                    className="rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--text)] hover:bg-[var(--accent-dim)]"
                  >
                    Load into builder
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(cmd, "command")}
                    className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
