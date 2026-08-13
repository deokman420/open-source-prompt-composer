"use client";

import { useState } from "react";
import { useKeys } from "@/lib/vault/hooks";
import { PROVIDER_LABELS, PROVIDER_ORDER } from "@/lib/models";
import { lastFour } from "@/lib/vault/crypto";
import type { Provider } from "@/lib/providers/types";

/**
 * Where each provider issues keys. Linked rather than explained at length —
 * these consoles get redesigned often and a stale screenshot is worse than a
 * link.
 */
const CONSOLE_URL: Record<Provider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/app/apikey",
  xai: "https://console.x.ai",
  nvidia: "https://build.nvidia.com",
  openrouter: "https://openrouter.ai/keys",
  deepseek: "https://platform.deepseek.com/api_keys",
};

export default function KeysPanel() {
  const { keys, saveKey, deleteKey } = useKeys();

  return (
    <section className="card card-lg">
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>
        API keys
      </h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 20 }}>
        Keys are stored in this browser only. If you set a vault passphrase they
        are encrypted at rest; otherwise they sit in local storage as plain text,
        readable by anyone with access to this browser profile. A key is sent to
        this site&rsquo;s proxy only at the moment you make a request, and is not
        retained there.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {PROVIDER_ORDER.map((provider) => (
          <KeyRow
            key={provider}
            provider={provider}
            existing={keys.find((k) => k.provider === provider) ?? null}
            onSave={saveKey}
            onDelete={deleteKey}
          />
        ))}
      </div>
    </section>
  );
}

function KeyRow({
  provider,
  existing,
  onSave,
  onDelete,
}: {
  provider: Provider;
  existing: { apiKey: string; lastUsedAt: string | null } | null;
  onSave: (p: Provider, key: string, label?: string) => void;
  onDelete: (p: Provider) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  function save() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(provider, trimmed);
    setValue("");
    setShow(false);
    setEditing(false);
  }

  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: "0.9rem" }}>{PROVIDER_LABELS[provider]}</strong>
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 2 }}>
            {existing ? (
              <>
                Saved · ends {lastFour(existing.apiKey)}
                {existing.lastUsedAt
                  ? ` · last used ${new Date(existing.lastUsedAt).toLocaleDateString()}`
                  : " · never used"}
              </>
            ) : (
              <a href={CONSOLE_URL[provider]} target="_blank" rel="noreferrer noopener">
                Get a key →
              </a>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Cancel" : existing ? "Replace" : "Add key"}
          </button>
          {existing && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => onDelete(provider)}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 240 }}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Paste your ${PROVIDER_LABELS[provider]} key`}
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShow((s) => !s)}
          >
            {show ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!value.trim()}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
