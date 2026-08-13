/**
 * Vault crypto — PBKDF2-SHA256 + AES-GCM-256, WebCrypto only.
 *
 * Ported from the cbapp.html session-encryption design. The contract:
 *
 *   - The passphrase is NEVER persisted. Not to storage, not to a cookie, not
 *     to the server. It exists in a module-local variable for the life of the
 *     tab and is dropped on lock().
 *   - The derived key is cached in memory keyed by (passphrase, salt) so we
 *     don't re-run 210k PBKDF2 rounds on every keystroke-triggered autosave.
 *   - AES-GCM's auth tag doubles as the passphrase check. A wrong passphrase
 *     fails decryption; there is no separate verifier blob to leak from.
 *
 * The envelope is versioned by its `alg`/`kdf` strings. Anything that doesn't
 * match exactly is rejected rather than best-effort parsed — a malformed or
 * downgraded envelope should surface as an error, not as silently weaker
 * crypto.
 */

// OWASP's floor for PBKDF2-SHA256 as of 2023 is 600k; 210k is the figure the
// cbapp envelope shipped with and the two must agree for imported backups to
// open. Raising it is a breaking envelope change — bump ENVELOPE_KDF too and
// write a migration that re-wraps on next unlock.
export const PBKDF2_ITERATIONS = 210_000;

export const ENVELOPE_ALG = "AES-GCM-256";
export const ENVELOPE_KDF = `PBKDF2-SHA256-${PBKDF2_ITERATIONS}`;

const SALT_BYTES = 16;
const IV_BYTES = 12;

export type Envelope = {
  alg: typeof ENVELOPE_ALG;
  kdf: typeof ENVELOPE_KDF;
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
let cachedKey: CryptoKey | null = null;

export async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array
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
      iterations: PBKDF2_ITERATIONS,
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
 * save would cost 210k PBKDF2 rounds (~100-300ms) on the UI thread.
 */
async function ensureKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltB64 = toBase64(salt);
  if (cachedKey && cachedPassphrase === passphrase && cachedSaltB64 === saltB64) {
    return cachedKey;
  }
  const key = await deriveAesKey(passphrase, salt);
  cachedPassphrase = passphrase;
  cachedSaltB64 = saltB64;
  cachedKey = key;
  return key;
}

/** Drop the cached passphrase and key. Called on lock and on sign-out-equivalent. */
export function clearKeyCache(): void {
  cachedPassphrase = null;
  cachedSaltB64 = null;
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
    o.kdf === ENVELOPE_KDF &&
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
  const key = await ensureKey(passphrase, salt);

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
    const key = await deriveAesKey(passphrase, fromBase64(envelope.salt));
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
