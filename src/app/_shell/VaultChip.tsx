"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVault, MIN_PASSPHRASE_LENGTH } from "@/lib/vault/store";

/**
 * Vault state at a glance, plus the action that state implies.
 *
 * The labels say "Protected" / "Not protected" rather than "unlocked" /
 * "local". "Unlocked" and "local" described the mechanism (a session key is in
 * memory; the data sits in this browser) but read as a safety claim to anyone
 * not holding that model — "local" sounds reassuring while it is the state
 * where API keys sit on disk in the clear. The question a user actually has is
 * whether their keys are protected, so the chip answers that one.
 *
 * Unprotected is also the state where the chip has something to offer, so it
 * doubles as the entry point: setting a passphrase happens here, in a popover,
 * instead of routing the user to Settings to find the same two fields.
 */
export default function VaultChip() {
  const { status, isProtected, saving, lock } = useVault();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape. Registered only while open so the app
  // isn't carrying two document listeners for a popover nobody opened.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Placeholder rather than null before hydration, so the nav doesn't change
  // height when the vault store resolves — see the .topnav-right note in
  // globals.css.
  if (status === "loading") {
    return (
      <span className="vault-chip" data-state="loading">
        …
      </span>
    );
  }

  if (!isProtected) {
    return (
      <div className="vault-chip-wrap" ref={wrapRef}>
        <button
          type="button"
          className="vault-chip vault-chip-btn"
          data-state="open"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          title="Your keys are stored unencrypted in this browser. Click to set a passphrase."
        >
          Not protected
        </button>
        {open && <ProtectForm onDone={() => setOpen(false)} />}
      </div>
    );
  }

  if (status === "locked") {
    return (
      <span className="vault-chip" data-state="locked">
        Protected · locked
      </span>
    );
  }

  return (
    <span className="vault-chip" data-state="unlocked" title="Encrypted at rest with your passphrase.">
      {saving ? "saving…" : "Protected"}
      <button type="button" onClick={lock} title="Lock the vault">
        lock
      </button>
    </span>
  );
}

/**
 * Set a passphrase without leaving the page.
 *
 * Same store call and same minimum as the Settings card — this is a second
 * doorway to `protect()`, not a lighter-weight variant of it. The
 * no-recovery warning comes along for the ride, because the fastest way to
 * set a passphrase should not also be the quietest.
 */
function ProtectForm({ onDone }: { onDone: () => void }) {
  const { protect } = useVault();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && pass !== confirm;
  const tooShort = pass.length > 0 && pass.length < MIN_PASSPHRASE_LENGTH;
  const canSubmit =
    pass.length >= MIN_PASSPHRASE_LENGTH && pass === confirm && !busy;

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await protect(pass);
      setPass("");
      setConfirm("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to set passphrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="vault-pop" onSubmit={apply} role="dialog" aria-label="Protect vault">
      <h3>Protect this vault</h3>
      <p className="muted">
        Encrypts your prompts and API keys on this device with AES-GCM-256. You
        will be asked for the passphrase each time you open the app in a new tab.
      </p>

      {err && <p className="vault-error">{err}</p>}

      {/* Hidden identity so password managers can file the entry — see the
          same field in VaultGate for why a lone password input isn't enough. */}
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

      <label className="field-label" htmlFor="chip-pass">
        Passphrase
      </label>
      <input
        id="chip-pass"
        className="input"
        type={show ? "text" : "password"}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
        autoFocus
      />
      {tooShort && (
        <span className="muted" style={{ fontSize: "0.72rem" }}>
          At least {MIN_PASSPHRASE_LENGTH} characters.
        </span>
      )}

      <label className="field-label" htmlFor="chip-confirm">
        Confirm
      </label>
      <input
        id="chip-confirm"
        className="input"
        type={show ? "text" : "password"}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        spellCheck={false}
      />
      {mismatch && (
        <span style={{ color: "var(--bad)", fontSize: "0.72rem" }}>
          Passphrases don&rsquo;t match.
        </span>
      )}

      <label className="vault-pop-show">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
        Show passphrase
      </label>

      <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
        {busy ? "Encrypting…" : "Protect vault"}
      </button>

      <p className="muted-strong">
        There is no recovery — forget it and the vault is unreadable. Export a
        backup from{" "}
        <Link href="/settings#backup" onClick={onDone}>
          Settings
        </Link>{" "}
        before you rely on it.
      </p>
    </form>
  );
}
