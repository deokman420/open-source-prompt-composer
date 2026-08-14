"use client";

import { useState } from "react";
import { useVault } from "@/lib/vault/store";

/**
 * The unlock screen. Shown only when the user has explicitly protected their
 * vault with a passphrase — this app has no accounts, so there is nothing else
 * to authenticate.
 *
 * There is deliberately no "forgot passphrase" path. The passphrase is the only
 * key material and it exists nowhere but the user's head; a reset link would
 * imply a recovery capability that cannot exist. The copy says so plainly, and
 * Settings pushes an encrypted backup for exactly this reason.
 */
export default function VaultGate() {
  const { unlock, error } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase || busy) return;
    setBusy(true);
    try {
      await unlock(passphrase);
      setPassphrase("");
    } catch {
      // `error` from the store carries the message; nothing to add here.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="auth-shell">
        <form className="vault-card" onSubmit={onSubmit}>
          <h1>Unlock your vault</h1>
          <p>
            Your prompts and API keys are encrypted on this device. Enter the
            passphrase you set to open them.
          </p>

          {error && <div className="vault-error">{error}</div>}

          {/* Hidden identity for password managers. This app has no accounts,
              but a password form without a username field is unfileable — the
              manager either refuses to save or attaches the entry to nothing.
              autoComplete="username" + a constant value gives it a stable handle. */}
          <input
            type="text"
            name="username"
            value="prompt-composer-vault"
            autoComplete="username"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />

          <div className="field">
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              className="input"
              type={show ? "text" : "password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              autoComplete="current-password"
              spellCheck={false}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.8rem",
              marginBottom: 20,
            }}
          >
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            Show passphrase
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!passphrase || busy}
            style={{ width: "100%" }}
          >
            {busy ? "Decrypting…" : "Unlock"}
          </button>

          <p className="muted-strong" style={{ marginTop: 20, fontSize: "0.8rem" }}>
            There is no password reset. Nobody — including this site — holds a
            copy of your passphrase or your data, so a forgotten passphrase means
            the vault cannot be opened. If that has happened, Settings can erase
            it and start over.
          </p>
        </form>
      </div>
    </main>
  );
}
