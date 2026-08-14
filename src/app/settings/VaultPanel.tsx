"use client";

import { useRef, useState } from "react";
import { useVault, MIN_PASSPHRASE_LENGTH } from "@/lib/vault/store";

/**
 * Encryption, backup, and erasure.
 *
 * Every control here can destroy or expose data that exists in exactly one
 * place, so each one is gated on something more than a single click:
 * removing encryption requires the current passphrase, exporting requires a
 * passphrase to encrypt with, and erasing requires typing a confirmation word.
 */
export default function VaultPanel() {
  const { isProtected, protect, unprotect, exportVault, importVault, wipe } = useVault();

  return (
    <>
      <ProtectionCard
        isProtected={isProtected}
        onProtect={protect}
        onUnprotect={unprotect}
      />
      <BackupCard onExport={exportVault} onImport={importVault} />
      <DangerCard onWipe={wipe} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function ProtectionCard({
  isProtected,
  onProtect,
  onUnprotect,
}: {
  isProtected: boolean;
  onProtect: (p: string) => Promise<void>;
  onUnprotect: (p: string) => Promise<void>;
}) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Removing encryption is a separate, separately-gated action.
  const [removePass, setRemovePass] = useState("");
  const [removing, setRemoving] = useState(false);

  const mismatch = confirm.length > 0 && pass !== confirm;
  const tooShort = pass.length > 0 && pass.length < MIN_PASSPHRASE_LENGTH;
  const canSubmit =
    pass.length >= MIN_PASSPHRASE_LENGTH && pass === confirm && !busy;

  async function apply() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await onProtect(pass);
      setNote(isProtected ? "Passphrase changed." : "Vault encrypted.");
      setPass("");
      setConfirm("");
      setShow(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to apply passphrase.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removePass || removing) return;
    if (
      !window.confirm(
        "Remove encryption? Your keys and prompts will be stored unencrypted in this browser."
      )
    )
      return;
    setRemoving(true);
    setErr(null);
    setNote(null);
    try {
      await onUnprotect(removePass);
      setRemovePass("");
      setNote("Encryption removed. Data is stored unencrypted on this device.");
    } catch (e) {
      setErr(
        e instanceof Error && e.name === "WrongPassphraseError"
          ? "Wrong passphrase — encryption was not removed."
          : e instanceof Error
            ? e.message
            : "Failed to remove encryption."
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="card card-lg">
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>
        Encryption
      </h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
        {isProtected ? (
          <>
            Your vault is encrypted with AES-GCM-256, keyed from your passphrase
            via PBKDF2-SHA256. You&rsquo;ll be asked for it each time you open the
            app in a new tab.
          </>
        ) : (
          <>
            Your data is stored on this device but <strong>not encrypted</strong>.
            Anyone with access to this browser profile can read your API keys. Set
            a passphrase if this machine is shared.
          </>
        )}
      </p>

      {note && (
        <p style={{ color: "var(--good)", fontSize: "0.85rem", marginBottom: 12 }}>
          {note}
        </p>
      )}
      {err && <p className="vault-error">{err}</p>}

      {/* A real <form> so browsers stop warning about orphaned password
          fields and password managers can offer to save the passphrase.
          onSubmit drives the same path as the button. */}
      <form
        style={{ display: "grid", gap: 10, maxWidth: 420 }}
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
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
        <div>
          <label className="field-label" htmlFor="new-pass">
            {isProtected ? "New passphrase" : "Passphrase"}
          </label>
          <input
            id="new-pass"
            className="input"
            type={show ? "text" : "password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
          />
          {tooShort && (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              At least {MIN_PASSPHRASE_LENGTH} characters.
            </span>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="confirm-pass">
            Confirm
          </label>
          <input
            id="confirm-pass"
            className="input"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
          />
          {mismatch && (
            <span style={{ color: "var(--bad)", fontSize: "0.75rem" }}>
              Passphrases don&rsquo;t match.
            </span>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show passphrase
        </label>

        <div>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {isProtected ? "Change passphrase" : "Encrypt vault"}
          </button>
        </div>
      </form>

      <p className="muted-strong" style={{ fontSize: "0.78rem", marginTop: 16 }}>
        There is no recovery. Nothing about your passphrase leaves this device, so
        it cannot be reset — if you forget it, the vault is unreadable. Export a
        backup below before you rely on it.
      </p>

      {isProtected && (
        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            maxWidth: 420,
          }}
        >
          <label className="field-label" htmlFor="remove-pass">
            Remove encryption
          </label>
          <p className="muted" style={{ fontSize: "0.78rem", marginBottom: 8 }}>
            Enter your current passphrase to confirm. Without this, anyone who
            finds an unlocked tab could strip encryption and read your keys
            without ever knowing it.
          </p>
          <form
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              void remove();
            }}
          >
            <input
              id="remove-pass"
              className="input"
              type="password"
              value={removePass}
              onChange={(e) => setRemovePass(e.target.value)}
              placeholder="Current passphrase"
              autoComplete="current-password"
              spellCheck={false}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={remove}
              disabled={!removePass || removing}
            >
              {removing ? "Checking…" : "Remove encryption"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function BackupCard({
  onExport,
  onImport,
}: {
  onExport: (p: string) => Promise<string>;
  onImport: (json: string, p?: string) => Promise<void>;
}) {
  const [exportPass, setExportPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportTooShort =
    exportPass.length > 0 && exportPass.length < MIN_PASSPHRASE_LENGTH;
  const exportMismatch = confirmPass.length > 0 && exportPass !== confirmPass;
  const canExport =
    exportPass.length >= MIN_PASSPHRASE_LENGTH &&
    exportPass === confirmPass &&
    !busy;

  async function doExport() {
    if (!canExport) return;
    setBusy(true);
    setErr(null);
    try {
      const json = await onExport(exportPass);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `prompt-composer-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(
        "Encrypted backup downloaded. Store the passphrase somewhere safe — the file is unreadable without it."
      );
      setExportPass("");
      setConfirmPass("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file: File) {
    if (
      !window.confirm(
        "Importing replaces everything currently in this browser — prompts, drafts, and keys. Continue?"
      )
    ) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onImport(await file.text(), importPass || undefined);
      setNote("Backup restored.");
      setImportPass("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-lg">
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>
        Backup &amp; restore
      </h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
        Your data exists only in this browser. Clearing site data, switching
        browsers, or reinstalling will lose it. Export a file to keep a copy or
        move to another machine.
      </p>

      {note && (
        <p style={{ color: "var(--good)", fontSize: "0.85rem", marginBottom: 12 }}>{note}</p>
      )}
      {err && <p className="vault-error">{err}</p>}

      <div style={{ display: "grid", gap: 24, maxWidth: 460 }}>
        <div>
          <label className="field-label" htmlFor="export-pass">
            Backup passphrase (required)
          </label>
          <p className="muted" style={{ fontSize: "0.75rem", marginBottom: 8 }}>
            Backups are always encrypted. A backup file leaves this browser and
            lands somewhere durable — Downloads, a synced folder, a USB stick —
            so writing your API keys into it in the clear would undo the point of
            the vault. This can differ from your vault passphrase; it is used
            only for this file and never becomes your session key.
          </p>
          <form
            style={{ display: "grid", gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              void doExport();
            }}
          >
            <input
              type="text"
              name="username"
              value="prompt-composer-backup"
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
            <input
              id="export-pass"
              className="input"
              type="password"
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              placeholder="Passphrase for this file"
              autoComplete="new-password"
              spellCheck={false}
            />
            {exportTooShort && (
              <span className="muted" style={{ fontSize: "0.75rem" }}>
                At least {MIN_PASSPHRASE_LENGTH} characters.
              </span>
            )}
            <input
              className="input"
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Confirm passphrase"
              autoComplete="new-password"
              spellCheck={false}
            />
            {exportMismatch && (
              <span style={{ color: "var(--bad)", fontSize: "0.75rem" }}>
                Passphrases don&rsquo;t match.
              </span>
            )}
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={!canExport}
              style={{ marginTop: 2, justifySelf: "start" }}
            >
              Download encrypted backup
            </button>
          </form>
        </div>

        <div>
          <label className="field-label" htmlFor="import-pass">
            Restore from a backup
          </label>
          <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 8 }}>
          <input
            type="text"
            name="username"
            value="prompt-composer-backup"
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
          <input
            id="import-pass"
            className="input"
            type="password"
            value={importPass}
            onChange={(e) => setImportPass(e.target.value)}
            placeholder="That file's passphrase"
            autoComplete="off"
            spellCheck={false}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ marginTop: 8, fontSize: "0.8rem" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImport(file);
            }}
          />
          </form>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function DangerCard({ onWipe }: { onWipe: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function doWipe() {
    setBusy(true);
    try {
      await onWipe();
      setConfirmText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-lg" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8 }}>
        Erase everything
      </h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
        Deletes every prompt, draft, eval, and API key from this browser. This
        cannot be undone and there is no server-side copy. Type{" "}
        <code>erase</code> to confirm.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 420 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 180 }}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="erase"
          autoComplete="off"
        />
        <button
          type="button"
          className="btn btn-danger"
          onClick={doWipe}
          disabled={confirmText !== "erase" || busy}
        >
          Erase all local data
        </button>
      </div>
    </section>
  );
}
