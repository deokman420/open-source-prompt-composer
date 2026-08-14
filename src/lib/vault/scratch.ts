"use client";

/**
 * Vault-backed scratch storage for feature editors.
 *
 * Every feature client keeps a "current working draft" so a reload doesn't lose
 * what you were mid-way through writing. In the hosted app that went straight
 * to localStorage, which was fine there because the server held the sensitive
 * material. Here it is exactly wrong: the vault encrypts IndexedDB, and a
 * plaintext copy of the same prompts sitting in localStorage makes that
 * encryption decorative. Anyone with the browser profile — or a devtools
 * window — reads it all regardless of the passphrase.
 *
 * So working state goes through here into the vault's featureState instead.
 *
 * The bridge is a module singleton installed by VaultProvider, rather than a
 * hook, because the callers are module-level `persist()`/`restore()` functions
 * invoked from reducers and mount effects where hooks aren't available. Writes
 * are no-ops while the vault is locked, which is the correct behaviour: there
 * is nothing to write into, and nothing should be written anywhere else.
 */

type Bridge = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  remove: (key: string) => void;
};

let bridge: Bridge | null = null;

/** Called once by VaultProvider. */
export function installScratchBridge(next: Bridge | null): void {
  bridge = next;
}

/** Read a feature's working state. Returns null when locked or unset. */
export function scratchGet<T>(key: string): T | null {
  if (!bridge) return null;
  const value = bridge.get(key);
  return (value as T | undefined) ?? null;
}

/** Write a feature's working state. Silently no-ops while locked. */
export function scratchSet(key: string, value: unknown): void {
  bridge?.set(key, value);
}

export function scratchRemove(key: string): void {
  bridge?.remove(key);
}

/**
 * Plaintext keys written by earlier builds (and by the standalone composer
 * bundle when it runs without a host). Purged on boot so upgrading actually
 * removes the exposure rather than just stopping new writes — otherwise a user
 * who enabled encryption still has yesterday's prompts sitting in the clear.
 */
const LEGACY_LOCAL_KEYS = [
  "context.composer.orch.current.v1",
  "context.composer.ctx.current.v1",
  "context.composer.loop.current.v1",
  "context.composer.tool.current.v1",
  "context.composer.drafts.v1",
  "context.composer.current.v1",
  "context.composer.orch.drafts.v1",
  "context.composer.ctx.drafts.v1",
  "context.composer.loop.drafts.v1",
  "context.composer.tool.drafts.v1",
  "context.composer.format.v1",
  "context.composer.model.v1",
  "context.composer.bestScore.v1",
  "context.composer.lifetimeCount.v1",
  "context.composer.mode.v1",
  "context.theme",
  "pc.eval.drafts.v1",
];

const LEGACY_SESSION_KEYS = [
  "pc:help-chat:v1",
  "pc:eval-prefill",
  "pc:orch-prefill",
  "pc:ctx-prefill",
  "pc:tool-prefill",
  "pc:loop-prefill",
  "pc:compose-prefill",
  "pc.eval.prompt",
];

/** Remove every plaintext artefact earlier builds may have left behind. */
export function purgeLegacyPlaintext(): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of LEGACY_LOCAL_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
  try {
    for (const k of LEGACY_SESSION_KEYS) sessionStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}
