"use client";

/**
 * The saved-drafts strip that sits under Orchestra, Loops, Tools, and Context
 * Pipeline.
 *
 * The hosted app had four near-identical copies of this, each talking to a
 * different endpoint and each carrying its own localStorage fallback for when
 * the DB wasn't configured. With one local store behind everything, that
 * duplication has no reason to exist — this is the single implementation, and
 * the per-feature files are thin wrappers that keep their original call sites
 * unchanged.
 *
 * Drafts are held in the vault, so a save is a synchronous in-memory write that
 * the store encrypts on its own debounce. There is no loading state, no
 * hydration race, and no "server unavailable" branch to fall back from.
 */

import { useMemo, useState } from "react";
import { useDrafts } from "@/lib/vault/hooks";
import type { Draft } from "@/lib/vault/schema";

const MAX_SHOWN = 10;

export type FeatureDraftsProps<T> = {
  /** Vault draft kind — also the tab this lands under on /drafts. */
  kind: Draft["kind"];
  /** Current editor state, captured on save. */
  state: T;
  /** Optional user-supplied title; falls back to `snippet(state)`. */
  title?: string;
  /** Incremented by the parent to request a save. 0 means "never saved yet". */
  onSaveSignal: number;
  onLoad: (state: T) => void;
  onSaved?: () => void;
  /** One-line label for a draft when the user didn't title it. */
  snippet: (state: T) => string;
  /** Plain-text body stored alongside the state, for search on /drafts. */
  body?: (state: T) => string;
};

export default function FeatureDrafts<T>({
  kind,
  state,
  title,
  onSaveSignal,
  onLoad,
  onSaved,
  snippet,
  body,
}: FeatureDraftsProps<T>) {
  const { drafts, createDraft, deleteDraft } = useDrafts();
  const [lastSignal, setLastSignal] = useState(0);

  const mine = useMemo(
    () =>
      drafts
        .filter((d) => d.kind === kind)
        .slice(0, MAX_SHOWN),
    [drafts, kind]
  );

  // Save on the parent's signal. Doing this during render rather than in an
  // effect keeps the write in the same commit as the click that asked for it;
  // an effect would fire a frame later and could be missed if the parent
  // unmounted in between (e.g. the user navigated straight after saving).
  if (onSaveSignal > 0 && onSaveSignal !== lastSignal) {
    setLastSignal(onSaveSignal);
    queueMicrotask(() => {
      createDraft({
        title: (title ?? "").trim() || snippet(state),
        body: body ? body(state) : "",
        kind,
        tags: [],
        meta: { state },
      });
      onSaved?.();
    });
  }

  if (mine.length === 0) {
    return (
      <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
        No saved drafts yet. Saving keeps a copy in this browser only.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "grid",
        gap: 8,
      }}
    >
      {mine.map((d) => (
        <li
          key={d.id}
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
          }}
        >
          <button
            type="button"
            onClick={() => onLoad(d.meta?.state as T)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer",
              flex: 1,
              minWidth: 0,
            }}
            title="Load this draft"
          >
            <span
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.title}
            </span>
            <span className="muted" style={{ fontSize: "0.72rem" }}>
              {relTime(d.updatedAt)}
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => deleteDraft(d.id)}
            title="Delete this draft"
            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
