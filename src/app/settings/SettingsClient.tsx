"use client";

import { usePreferences, useKeys } from "@/lib/vault/hooks";
import { PROVIDER_LABELS, PROVIDER_MODELS, PROVIDER_ORDER } from "@/lib/models";
import type { Provider } from "@/lib/providers/types";
import KeysPanel from "./KeysPanel";
import VaultPanel from "./VaultPanel";

export default function SettingsClient() {
  return (
    <>
      <h1 className="page-h1">Settings</h1>
      <p className="page-sub">
        Everything here is stored in this browser. Nothing on this page is sent
        anywhere.
      </p>

      <div style={{ display: "grid", gap: 20, marginTop: 28 }}>
        <KeysPanel />
        <DefaultsPanel />
        <VaultPanel />
      </div>
    </>
  );
}

/**
 * Default provider + model, plus idle auto-lock.
 *
 * The provider list is filtered to configured keys: offering a default the user
 * can't actually run would just move the failure from here to the first request.
 */
function DefaultsPanel() {
  const { preferences, setPreferences } = usePreferences();
  const { configured } = useKeys();

  if (!preferences) return null;

  const available = PROVIDER_ORDER.filter((p) => configured.has(p));
  const selectedProvider = preferences.defaultProvider;
  const models: { id: string; label: string }[] = selectedProvider
    ? PROVIDER_MODELS[selectedProvider]
    : [];

  return (
    <section className="card card-lg">
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>
        Defaults
      </h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
        Which model the pickers open on, and when to lock the vault while
        you&rsquo;re away.
      </p>

      {available.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Add an API key above to choose a default model.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <label className="field-label" htmlFor="default-provider">
              Provider
            </label>
            <select
              id="default-provider"
              className="select"
              value={selectedProvider ?? ""}
              onChange={(e) =>
                setPreferences({
                  defaultProvider: (e.target.value || null) as Provider | null,
                  // A model from the previous provider is meaningless here.
                  defaultModel: null,
                })
              }
            >
              <option value="">No preference</option>
              {available.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider && (
            <div>
              <label className="field-label" htmlFor="default-model">
                Model
              </label>
              <select
                id="default-model"
                className="select"
                value={preferences.defaultModel ?? ""}
                onChange={(e) => setPreferences({ defaultModel: e.target.value || null })}
              >
                <option value="">Provider default</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="field-label" htmlFor="auto-lock">
              Auto-lock after
            </label>
            <select
              id="auto-lock"
              className="select"
              value={preferences.autoLockMinutes}
              onChange={(e) =>
                setPreferences({ autoLockMinutes: Number(e.target.value) })
              }
            >
              <option value={0}>Never</option>
              <option value={5}>5 minutes idle</option>
              <option value={15}>15 minutes idle</option>
              <option value={60}>1 hour idle</option>
            </select>
            <p className="muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
              Only applies when the vault has a passphrase.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
