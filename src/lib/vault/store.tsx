"use client";

/**
 * The vault store — the single source of truth for user state in this app.
 *
 * Lifecycle:
 *
 *   boot ──► no record?  ──────────────► "empty"    (first run; create on demand)
 *        ├─► record, unprotected ─────► "unlocked"  (plaintext at rest, local-only)
 *        └─► record, protected ───────► "locked"    (await passphrase)
 *
 * "Protected" is opt-in, matching cbapp's Protect toggle. Unprotected still
 * never leaves the device — it just isn't encrypted at rest, which is the right
 * default for a browser profile only the owner uses, and the wrong one for a
 * shared machine. The UI states that trade-off plainly rather than deciding for
 * the user.
 *
 * Writes are debounced and serialized: an autosave triggered on every keystroke
 * would otherwise interleave two encrypt-and-put cycles and let the slower one
 * land last, silently reverting the newer edit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { idbGet, idbPut, idbClear } from "./idb";
import {
  clearKeyCache,
  decryptJson,
  encryptForExport,
  encryptJson,
  isEnvelope,
  verifyPassphrase,
  WrongPassphraseError,
  type Envelope,
} from "./crypto";
import { emptyVault, migrate, SCHEMA_VERSION, type VaultDoc } from "./schema";
import { installScratchBridge, purgeLegacyPlaintext } from "./scratch";

const RECORD_KEY = "doc";
const SAVE_DEBOUNCE_MS = 400;

/** Shared floor for every passphrase the app accepts (vault and backups). */
export const MIN_PASSPHRASE_LENGTH = 8;

/** What actually sits in IndexedDB. */
type StoredRecord =
  | { protected: true; envelope: Envelope }
  | { protected: false; doc: VaultDoc };

export type VaultStatus = "loading" | "empty" | "locked" | "unlocked" | "error";

export type VaultApi = {
  status: VaultStatus;
  /** Non-null exactly when status === "unlocked". */
  doc: VaultDoc | null;
  /** True when a passphrase guards the vault at rest. */
  isProtected: boolean;
  error: string | null;
  /** True while an encrypt+write is in flight — drives the "Saving…" hint. */
  saving: boolean;

  /** Create a fresh vault. Only valid from "empty". */
  create: (passphrase?: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  /** Mutate the document. The updater must return a NEW object, not mutate. */
  update: (fn: (doc: VaultDoc) => VaultDoc) => void;
  /**
   * Add or change the at-rest passphrase. Changing an existing one requires
   * the current passphrase.
   */
  protect: (passphrase: string, currentPassphrase?: string) => Promise<void>;
  /** Remove passphrase protection. Requires the current passphrase. */
  unprotect: (passphrase: string) => Promise<void>;
  /** Serialize to a downloadable backup. Always encrypted; passphrase required. */
  exportVault: (passphrase: string) => Promise<string>;
  /** Replace the vault from a backup file. Destructive. */
  importVault: (json: string, passphrase?: string) => Promise<void>;
  /** Erase everything from this browser. */
  wipe: () => Promise<void>;
};

const VaultContext = createContext<VaultApi | null>(null);

export function useVault(): VaultApi {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [doc, setDoc] = useState<VaultDoc | null>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Session passphrase. In memory only, for the life of the tab — never
  // persisted anywhere, and cleared by lock().
  const passphraseRef = useRef<string | null>(null);
  // Salt of the current envelope, reused across saves so the memoized PBKDF2
  // key in crypto.ts stays valid instead of being re-derived on every write.
  const saltRef = useRef<string | undefined>(undefined);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  // Latest document, readable from callbacks that must not re-bind on every
  // edit (the unload flush below, and lock()).
  const docRef = useRef<VaultDoc | null>(doc);
  docRef.current = doc;

  /* ---------------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    // Before anything else: remove plaintext left by earlier builds (and by the
    // composer bundle running without a host). Stopping new writes isn't enough
    // — the old copies are the exposure.
    purgeLegacyPlaintext();
    (async () => {
      try {
        const record = await idbGet<StoredRecord>(RECORD_KEY);
        if (cancelled) return;
        if (!record) {
          setStatus("empty");
          return;
        }
        if (record.protected) {
          setIsProtected(true);
          saltRef.current = record.envelope.salt;
          setStatus("locked");
          return;
        }
        setDoc(migrate(record.doc));
        setIsProtected(false);
        setStatus("unlocked");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to open local storage.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Persistence
   * ---------------------------------------------------------------- */

  /**
   * Encrypt (if protected) and write. Chained off the previous save so two
   * rapid edits can't race to be the last writer.
   *
   * The passphrase is snapshotted HERE, at call time — not inside `run`.
   *
   * `run` executes later, off the promise chain. Reading the ref from inside it
   * meant a caller that queued a write and then changed the passphrase ref
   * synchronously would have its write performed under the NEW value. lock()
   * does exactly that: it flushes a pending save and then immediately nulls the
   * ref, so the flush saw `null`, took the unencrypted branch, and rewrote the
   * vault as `{ protected: false, doc }` — plaintext API keys on disk, while
   * the UI still showed the lock screen. Unlock then reported "No protected
   * vault found in this browser", because by then there genuinely wasn't one.
   *
   * Snapshotting binds each write to the protection state in effect when it was
   * requested, which is the only interpretation that can't silently downgrade
   * encryption.
   */
  const persist = useCallback(
    (next: VaultDoc): Promise<void> => {
      const pass = passphraseRef.current;
      const run = async () => {
        setSaving(true);
        try {
          if (pass) {
            const envelope = await encryptJson(next, pass, saltRef.current);
            saltRef.current = envelope.salt;
            await idbPut(RECORD_KEY, { protected: true, envelope } satisfies StoredRecord);
          } else {
            await idbPut(RECORD_KEY, { protected: false, doc: next } satisfies StoredRecord);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed.");
        } finally {
          setSaving(false);
        }
      };
      saveChain.current = saveChain.current.then(run, run);
      return saveChain.current;
    },
    []
  );

  const update = useCallback(
    (fn: (doc: VaultDoc) => VaultDoc) => {
      setDoc((current) => {
        if (!current) return current;
        const next = { ...fn(current), updatedAt: new Date().toISOString() };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void persist(next), SAVE_DEBOUNCE_MS);
        return next;
      });
    },
    [persist]
  );

  // A debounced write pending at unload would be lost. Flush it synchronously
  // enough to matter: clearing the timer and firing immediately gives the
  // encrypt+put a chance to complete during the unload task.
  //
  // This effect must NOT depend on `doc`. An earlier version did, which made
  // React tear down and re-run it on every single edit — and the teardown ran
  // flush(), which cancelled the save timer `update()` had just scheduled and
  // wrote the doc captured in the *previous* render's closure. The newest
  // change was silently dropped on every write, and the vault trailed one edit
  // behind whatever was on screen. Hence the ref: `persist` is stable, so the
  // effect mounts once and the flush always sees the current document.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (docRef.current) void persist(docRef.current);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [persist]);

  /* ---------------------------------------------------------------- *
   * Commands
   * ---------------------------------------------------------------- */

  const create = useCallback(
    async (passphrase?: string) => {
      const fresh = emptyVault(new Date().toISOString());
      passphraseRef.current = passphrase ?? null;
      saltRef.current = undefined;
      setDoc(fresh);
      setIsProtected(Boolean(passphrase));
      setStatus("unlocked");
      await persist(fresh);
    },
    [persist]
  );

  const unlock = useCallback(async (passphrase: string) => {
    setError(null);
    try {
      const record = await idbGet<StoredRecord>(RECORD_KEY);
      if (!record?.protected || !isEnvelope(record.envelope)) {
        throw new Error("No protected vault found in this browser.");
      }
      const plain = await decryptJson<unknown>(record.envelope, passphrase);
      passphraseRef.current = passphrase;
      saltRef.current = record.envelope.salt;
      setDoc(migrate(plain));
      setIsProtected(true);
      setStatus("unlocked");
    } catch (err) {
      if (err instanceof WrongPassphraseError) {
        setError("Wrong passphrase.");
        throw err;
      }
      setError(err instanceof Error ? err.message : "Unlock failed.");
      throw err;
    }
  }, []);

  // Reads the document through the ref so its identity stays stable across
  // edits — otherwise the idle auto-lock effect below would tear down and
  // re-arm its timer on every keystroke.
  const lock = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (docRef.current) void persist(docRef.current);
    }
    passphraseRef.current = null;
    clearKeyCache();
    setDoc(null);
    setStatus(isProtected ? "locked" : "unlocked");
  }, [isProtected, persist]);

  /**
   * Set or change the at-rest passphrase.
   *
   * Changing an existing passphrase is re-keying, and re-keying an unlocked tab
   * is exactly as dangerous as stripping encryption: whoever walks up to an
   * unattended session could seal the vault under a passphrase only they know,
   * locking the owner out permanently — there is no recovery path. So the same
   * gate as unprotect() applies, verified against the stored envelope rather
   * than the in-memory session value.
   *
   * Setting a passphrase for the first time has nothing to verify against, so
   * `currentPassphrase` is only required when a protected record exists.
   */
  const protect = useCallback(
    async (passphrase: string, currentPassphrase?: string) => {
      if (!doc) throw new Error("Unlock the vault first.");

      const record = await idbGet<StoredRecord>(RECORD_KEY);
      if (record?.protected) {
        if (!currentPassphrase) {
          throw new Error("Enter your current passphrase to change it.");
        }
        const ok = await verifyPassphrase(record.envelope, currentPassphrase);
        if (!ok) throw new WrongPassphraseError();
      }

      passphraseRef.current = passphrase;
      // Force a fresh salt: re-keying must not reuse the previous envelope's.
      saltRef.current = undefined;
      clearKeyCache();
      setIsProtected(true);
      await persist(doc);
    },
    [doc, persist]
  );

  /**
   * Remove passphrase protection — requires the current passphrase.
   *
   * An unlocked tab left unattended is the threat here. Without this check,
   * anyone who walks up to an open session can strip encryption in two clicks
   * and read the API keys straight off disk, without ever knowing the
   * passphrase. Verification is against the stored envelope rather than the
   * in-memory session value, so it holds even if the ref were somehow stale.
   */
  const unprotect = useCallback(
    async (passphrase: string) => {
      if (!doc) throw new Error("Unlock the vault first.");

      const record = await idbGet<StoredRecord>(RECORD_KEY);
      if (record?.protected) {
        const ok = await verifyPassphrase(record.envelope, passphrase);
        if (!ok) throw new WrongPassphraseError();
      }

      passphraseRef.current = null;
      saltRef.current = undefined;
      clearKeyCache();
      setIsProtected(false);
      await persist(doc);
    },
    [doc, persist]
  );

  /**
   * Serialize to a backup file. Always encrypted — a passphrase is required.
   *
   * A backup is the one copy of this data that leaves the browser's storage and
   * lands somewhere durable: a Downloads folder, a cloud-synced directory, a USB
   * stick, an email to yourself. Writing API keys there in cleartext undoes the
   * whole point of the vault, and it does so at exactly the moment the data is
   * most likely to be handled carelessly. So there is no unencrypted option.
   */
  const exportVault = useCallback(
    async (passphrase: string) => {
      if (!doc) throw new Error("Unlock the vault first.");
      if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(
          `Backups are always encrypted — choose a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
        );
      }
      // encryptForExport, NOT encryptJson: a one-off backup passphrase must
      // never be adopted as the session key.
      const envelope = await encryptForExport(doc, passphrase);
      return JSON.stringify(
        {
          app: "prompt-composer",
          schemaVersion: SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          encrypted: true,
          envelope,
        },
        null,
        2
      );
    },
    [doc]
  );

  const importVault = useCallback(
    async (json: string, passphrase?: string) => {
      let parsed: {
        app?: string;
        encrypted?: boolean;
        envelope?: Envelope;
        doc?: unknown;
      };
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (parsed.app !== "prompt-composer") {
        throw new Error("That file isn't a Prompt Composer backup.");
      }

      let incoming: unknown;
      if (parsed.encrypted) {
        if (!parsed.envelope) throw new Error("Backup is marked encrypted but has no envelope.");
        if (!passphrase) throw new Error("This backup is encrypted — enter its passphrase.");
        incoming = await decryptJson(parsed.envelope, passphrase);
        // decryptJson adopts the backup passphrase into the key cache; drop it
        // so the live vault keeps its own session key.
        clearKeyCache();
      } else {
        incoming = parsed.doc;
      }

      const next = migrate(incoming);
      setDoc(next);
      setStatus("unlocked");
      saltRef.current = undefined;
      await persist(next);
    },
    [persist]
  );

  const wipe = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await idbClear();
    passphraseRef.current = null;
    saltRef.current = undefined;
    clearKeyCache();
    setDoc(null);
    setIsProtected(false);
    setError(null);
    setStatus("empty");
  }, []);

  /* ---------------------------------------------------------------- *
   * Scratch bridge
   * ---------------------------------------------------------------- */

  /**
   * Expose featureState to the module-level persist()/restore() helpers in the
   * feature editors, so their working drafts land in the encrypted vault
   * instead of localStorage. Reads come off the ref so the bridge doesn't need
   * reinstalling on every edit; writes go through update() and inherit its
   * debounce.
   */
  useEffect(() => {
    installScratchBridge({
      get: (key) => docRef.current?.featureState?.[key],
      set: (key, value) =>
        update((d) => ({
          ...d,
          featureState: { ...d.featureState, [key]: value },
        })),
      remove: (key) =>
        update((d) => {
          const next = { ...d.featureState };
          delete next[key];
          return { ...d, featureState: next };
        }),
    });
    return () => installScratchBridge(null);
  }, [update]);

  /* ---------------------------------------------------------------- *
   * Idle auto-lock
   * ---------------------------------------------------------------- */

  const autoLockMinutes = doc?.preferences.autoLockMinutes ?? 0;
  useEffect(() => {
    if (!autoLockMinutes || !isProtected || status !== "unlocked") return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, autoLockMinutes * 60_000);
    };
    const events = ["mousedown", "keydown", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [autoLockMinutes, isProtected, status, lock]);

  const api = useMemo<VaultApi>(
    () => ({
      status,
      doc,
      isProtected,
      error,
      saving,
      create,
      unlock,
      lock,
      update,
      protect,
      unprotect,
      exportVault,
      importVault,
      wipe,
    }),
    [
      status,
      doc,
      isProtected,
      error,
      saving,
      create,
      unlock,
      lock,
      update,
      protect,
      unprotect,
      exportVault,
      importVault,
      wipe,
    ]
  );

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>;
}
