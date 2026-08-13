"use client";

/**
 * The one place every saved thing shows up.
 *
 * In the hosted app this had to reconcile two backends — a `drafts` table and a
 * separate `orchestra_drafts` table — plus per-feature localStorage fallbacks,
 * and the tabs existed partly to paper over which store a row came from. Here
 * there is one array in one vault, so the tabs are purely a filter and rename
 * and delete work uniformly (Orchestra couldn't be renamed before, because its
 * table had no title column).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDrafts } from "@/lib/vault/hooks";
import type { Draft } from "@/lib/vault/schema";

const TABS: { id: Draft["kind"] | "all"; label: string; href?: string }[] = [
  { id: "all", label: "All" },
  { id: "compose", label: "Compose", href: "/compose" },
  { id: "orchestra", label: "Orchestra", href: "/orchestra" },
  { id: "context-pipeline", label: "Context", href: "/context-pipeline" },
  { id: "loop", label: "Loops", href: "/loops" },
  { id: "tool", label: "Tools", href: "/tools" },
  { id: "eval", label: "Eval", href: "/eval" },
];

export default function DraftsLibraryClient() {
  const { drafts, updateDraft, deleteDraft } = useDrafts();
  const [tab, setTab] = useState<Draft["kind"] | "all">("all");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: drafts.length };
    for (const d of drafts) c[d.kind] = (c[d.kind] ?? 0) + 1;
    return c;
  }, [drafts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts
      .filter((d) => tab === "all" || d.kind === tab)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.body.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
  }, [drafts, tab, query]);

  function startRename(d: Draft) {
    setRenaming(d.id);
    setRenameValue(d.title);
  }

  function commitRename(id: string) {
    const title = renameValue.trim();
    if (title) updateDraft(id, { title });
    setRenaming(null);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setTab(t.id)}
            style={{ fontSize: "0.8rem", padding: "6px 12px" }}
          >
            {t.label}
            {counts[t.id] ? (
              <span className="muted" style={{ marginLeft: 6 }}>
                {counts[t.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search titles, contents, and tags…"
        style={{ marginBottom: 20, maxWidth: 420 }}
      />

      {visible.length === 0 ? (
        <EmptyState tab={tab} hasAny={drafts.length > 0} />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {visible.map((d) => (
            <li key={d.id} className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {renaming === d.id ? (
                    <input
                      className="input"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(d.id);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      style={{ maxWidth: 420 }}
                    />
                  ) : (
                    <strong style={{ fontSize: "0.92rem" }}>{d.title}</strong>
                  )}
                  <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                    <span className="label-mono">{d.kind}</span> ·{" "}
                    {new Date(d.updatedAt).toLocaleString()}
                    {d.tags.length > 0 && ` · ${d.tags.join(", ")}`}
                  </div>
                  {d.body && (
                    <p
                      className="muted"
                      style={{
                        fontSize: "0.8rem",
                        marginTop: 8,
                        marginBottom: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {d.body}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => startRename(d)}
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => downloadDraft(d)}
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm(`Delete “${d.title}”? This can't be undone.`)) {
                        deleteDraft(d.id);
                      }
                    }}
                    style={{ fontSize: "0.75rem", padding: "4px 8px" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyState({ tab, hasAny }: { tab: string; hasAny: boolean }) {
  const target = TABS.find((t) => t.id === tab);
  return (
    <div className="card card-dashed card-quiet">
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        {hasAny
          ? "Nothing matches that filter."
          : "No saved drafts yet. Anything you save from a feature page lands here."}
      </p>
      {target?.href && (
        <Link href={target.href} className="btn btn-secondary" style={{ marginTop: 12 }}>
          Open {target.label}
        </Link>
      )}
    </div>
  );
}

/** Download a single draft as JSON — the per-item counterpart to a full backup. */
function downloadDraft(d: Draft) {
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "draft"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
