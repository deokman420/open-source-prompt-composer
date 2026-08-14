"use client";

/**
 * In-memory handoff between pages ("Send to Evaluator", "Open in Tool Builder").
 *
 * These used sessionStorage, which put the prompt on disk — briefly, but on
 * disk, in the clear, regardless of vault encryption. The window between write
 * and consume is short; the window in which it is *recoverable* is not, because
 * sessionStorage survives reloads for the life of the tab and a crash can leave
 * it there indefinitely.
 *
 * A module-level Map is enough: these handoffs are same-tab client-side
 * navigations, and Next keeps module state across them. A hard reload loses the
 * handoff, which is the right trade — the cost is re-clicking a button, and the
 * alternative is writing user prompts to disk outside the vault.
 *
 * It hangs off `window` so the vanilla composer bundle (a separate <script>,
 * not part of the module graph) can use the same channel.
 */

export type HandoffKey =
  | "eval-prefill"
  | "orch-prefill"
  | "ctx-prefill"
  | "tool-prefill"
  | "loop-prefill"
  | "compose-prefill";

declare global {
  interface Window {
    __pcHandoff?: Map<string, string>;
  }
}

function store(): Map<string, string> | null {
  if (typeof window === "undefined") return null;
  if (!window.__pcHandoff) window.__pcHandoff = new Map();
  return window.__pcHandoff;
}

export function setHandoff(key: HandoffKey, value: string): void {
  store()?.set(key, value);
}

/** Read and clear. Handoffs are single-use by design. */
export function takeHandoff(key: HandoffKey): string | null {
  const map = store();
  if (!map) return null;
  const value = map.get(key) ?? null;
  map.delete(key);
  return value;
}
