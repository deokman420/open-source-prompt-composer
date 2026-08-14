/**
 * Vault crypto — PBKDF2-SHA256 + AES-GCM-256, WebCrypto only.
 *
 * Ported from the cbapp.html session-encryption design. The contract:
 *
 *   - The passphrase is NEVER persisted. Not to storage, not to a cookie, not
 *     to the server. It exists in a module-local variable for the life of the
 *     tab and is dropped on lock().
 *   - The derived key is cached in memory keyed by (passphrase, salt, work
 *     factor) so we don't re-run 600k PBKDF2 rounds on every keystroke-triggered
 *     autosave.
 *   - AES-GCM's auth tag doubles as the passphrase check. A wrong passphrase
 *     fails decryption; there is no separate verifier blob to leak from.
 *
 * The envelope is versioned by its `alg`/`kdf` strings. `alg` must match exactly;
 * `kdf` must name a work factor we still support (see SUPPORTED_ITERATIONS).
 * Anything else is rejected rather than best-effort parsed — a malformed or
 * downgraded envelope should surface as an error, not as silently weaker crypto.
 */

// OWASP's floor for PBKDF2-SHA256 is 600k. The envelope originally shipped at
// 210k (inherited from cbapp.html); new envelopes use the higher figure.
export const PBKDF2_ITERATIONS = 600_000;

// Iteration counts we will still OPEN. Raising the work factor must never
// orphan an existing vault: the count is read from the envelope itself, so an
// old one decrypts at its own setting and is silently re-wrapped at the current
// setting on the next save (encryptJson always writes PBKDF2_ITERATIONS).
// Removing an entry from this list makes those vaults permanently unreadable.
const LEGACY_ITERATIONS = [210_000];
const SUPPORTED_ITERATIONS = new Set([PBKDF2_ITERATIONS, ...LEGACY_ITERATIONS]);

export const ENVELOPE_ALG = "AES-GCM-256";
export const ENVELOPE_KDF = `PBKDF2-SHA256-${PBKDF2_ITERATIONS}`;

/** Pull the work factor out of an envelope's kdf string, or null if unusable. */
function iterationsFromKdf(kdf: unknown): number | null {
  if (typeof kdf !== "string") return null;
  const m = /^PBKDF2-SHA256-(\d+)$/.exec(kdf);
  if (!m) return null;
  const n = Number(m[1]);
  return SUPPORTED_ITERATIONS.has(n) ? n : null;
}

const SALT_BYTES = 16;
const IV_BYTES = 12;

export type Envelope = {
  alg: typeof ENVELOPE_ALG;
  /** `PBKDF2-SHA256-<iterations>` — the count this envelope was sealed with. */
  kdf: string;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
};

/* ------------------------------------------------------------------ *
 * base64 <-> bytes
 * ------------------------------------------------------------------ */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked to avoid blowing the argument limit on large vaults.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ *
 * Key derivation (with a single-entry memo)
 * ------------------------------------------------------------------ */

// In-memory only. Cleared by lock(). A page reload wipes these; the ciphertext
// in IndexedDB survives and the user re-enters the passphrase.
let cachedPassphrase: string | null = null;
let cachedSaltB64: string | null = null;
let cachedIterations: number | null = null;
let cachedKey: CryptoKey | null = null;

export async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive-or-reuse. Autosave calls this on every write; without the memo each
 * save would cost 600k PBKDF2 rounds (roughly half a second) on the UI thread.
 */
async function ensureKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const saltB64 = toBase64(salt);
  if (
    cachedKey &&
    cachedPassphrase === passphrase &&
    cachedSaltB64 === saltB64 &&
    cachedIterations === iterations
  ) {
    return cachedKey;
  }
  const key = await deriveAesKey(passphrase, salt, iterations);
  cachedPassphrase = passphrase;
  cachedSaltB64 = saltB64;
  cachedIterations = iterations;
  cachedKey = key;
  return key;
}

/** Drop the cached passphrase and key. Called on lock and on sign-out-equivalent. */
export function clearKeyCache(): void {
  cachedPassphrase = null;
  cachedSaltB64 = null;
  cachedIterations = null;
  cachedKey = null;
}

/* ------------------------------------------------------------------ *
 * Envelope encode / decode
 * ------------------------------------------------------------------ */

export function isEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.alg === ENVELOPE_ALG &&
    // Any work factor we still support, not just the current one — otherwise
    // raising it would lock users out of their own vaults.
    iterationsFromKdf(o.kdf) !== null &&
    typeof o.salt === "string" &&
    typeof o.iv === "string" &&
    typeof o.ct === "string"
  );
}

/**
 * Encrypt for the active session, reusing the session salt when the passphrase
 * is unchanged so the memoized key stays valid across saves.
 */
export async function encryptJson(
  data: unknown,
  passphrase: string,
  reuseSalt?: string
): Promise<Envelope> {
  // Always seals at PBKDF2_ITERATIONS, so a vault opened from a legacy envelope
  // is transparently upgraded the first time it is saved.
  const salt =
    reuseSalt && cachedPassphrase === passphrase
      ? fromBase64(reuseSalt)
      : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await ensureKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource
  );

  return {
    alg: ENVELOPE_ALG,
    kdf: ENVELOPE_KDF,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  };
}

/**
 * Encrypt for export with a one-off passphrase.
 *
 * Deliberately does NOT touch the key cache: a Backup passphrase that differs
 * from the session passphrase must not become the session key, or the next
 * autosave would silently re-key the live vault. (This exact footgun is called
 * out in cbapp.html.)
 */
export async function encryptForExport(
  data: unknown,
  passphrase: string
): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt);

  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(data)) as unknown as BufferSource
  );

  return {
    alg: ENVELOPE_ALG,
    kdf: ENVELOPE_KDF,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  };
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Wrong passphrase.");
    this.name = "WrongPassphraseError";
  }
}

/** Decrypt an envelope produced by this module. Adopts the key into the cache. */
export async function decryptJson<T = unknown>(
  envelope: Envelope,
  passphrase: string
): Promise<T> {
  if (!isEnvelope(envelope)) {
    throw new Error("Not a recognized vault envelope.");
  }
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  // Derive at the count this envelope was SEALED with, not the current default.
  const key = await ensureKey(passphrase, salt, iterationsFromKdf(envelope.kdf) ?? PBKDF2_ITERATIONS);

  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      fromBase64(envelope.ct) as unknown as BufferSource
    );
  } catch {
    // AES-GCM auth-tag failure. Drop the cache so a bad passphrase doesn't
    // linger as the session key.
    clearKeyCache();
    throw new WrongPassphraseError();
  }
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}

/**
 * Is this the passphrase the envelope was sealed with?
 *
 * Uses a throwaway key rather than ensureKey, so probing a candidate
 * passphrase can never adopt it into the session cache on a near-miss.
 */
export async function verifyPassphrase(
  envelope: Envelope,
  passphrase: string
): Promise<boolean> {
  if (!isEnvelope(envelope)) return false;
  try {
    const key = await deriveAesKey(
      passphrase,
      fromBase64(envelope.salt),
      iterationsFromKdf(envelope.kdf) ?? PBKDF2_ITERATIONS
    );
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) as unknown as BufferSource },
      key,
      fromBase64(envelope.ct) as unknown as BufferSource
    );
    return true;
  } catch {
    return false;
  }
}

/** Last four characters of a secret, for display. Never round-trips a key. */
export function lastFour(secret: string): string {
  return secret.slice(-4).padStart(4, "•");
}
