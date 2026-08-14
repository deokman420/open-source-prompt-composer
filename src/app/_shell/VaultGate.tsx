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
 *
 * What there IS is a way out. This gate covers the entire app, Settings
 * included, so pointing a locked-out user at the erase control in Settings sent
 * them somewhere they cannot reach — the only escape was clearing site data
 * through browser preferences. The same erase lives here now, behind the same
 * typed confirmation.
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
            the vault cannot be opened.
          </p>
        </form>

        <LockedOut />
      </div>
    </main>
  );
}

/**
 * The way out for someone who cannot unlock.
 *
 * Erasing is offered rather than hidden because the alternative isn't safety —
 * it's a user digging through browser site-data settings to achieve exactly the
 * same thing, with more collateral. It grants no read access either: the
 * ciphertext is unreadable to whoever clicks this, same as before.
 *
 * It still costs a deliberate disclosure plus typing the word, matching the
 * Erase everything card in Settings, so nobody destroys a vault by fumbling a
 * button next to the passphrase field.
 */
function LockedOut() {
  const { wipe } = useVault();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function doWipe() {
    setBusy(true);
    try {
      await wipe();
      setConfirmText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="vault-escape">
      <summary>Forgotten your passphrase?</summary>
      <p className="muted" style={{ fontSize: "0.8rem", margin: "10px 0" }}>
        The data cannot be recovered — but you can erase it and start with an
        empty vault on this device. That deletes every prompt, draft, eval, and
        API key stored here, permanently. If you have an encrypted backup file,
        erase first and then restore it from Settings. Type <code>erase</code> to
        confirm.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 160 }}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="erase"
          autoComplete="off"
          spellCheck={false}
          aria-label="Type erase to confirm"
        />
        <button
          type="button"
          className="btn btn-danger"
          onClick={doWipe}
          disabled={confirmText !== "erase" || busy}
        >
          {busy ? "Erasing…" : "Erase and start over"}
        </button>
      </div>
    </details>
  );
}
