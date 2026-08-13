/**
 * The vault document — every piece of user state in this app, in one JSON blob.
 *
 * The whole document is encrypted as a single envelope and written as one
 * IndexedDB record. That makes saves atomic and export/import trivial, at the
 * cost of re-encrypting everything on each write. At realistic sizes (text
 * prompts, a few hundred KB) that's sub-millisecond, and the key derivation —
 * the expensive part — is memoized in crypto.ts.
 *
 * `schemaVersion` is bumped whenever a shape changes; `migrate()` walks a
 * loaded document forward. Never mutate an existing version's meaning in
 * place — an old vault in someone's browser is the only copy of their data.
 */

import type { Provider } from "@/lib/providers/types";

export const SCHEMA_VERSION = 1;

/** A saved API key. Plaintext in the decrypted document; sealed at rest. */
export type VaultKey = {
  provider: Provider;
  /** The secret itself. Only ever leaves the browser as a proxy request body. */
  apiKey: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type Draft = {
  id: string;
  title: string;
  body: string;
  /** Which surface produced it — drives the tab it appears under in /drafts. */
  kind: "compose" | "orchestra" | "context-pipeline" | "loop";
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Free-form per-kind payload (orchestra run config, pipeline stages, …). */
  meta?: Record<string, unknown>;
};

export type EvalRecord = {
  id: string;
  promptSha256: string;
  provider: Provider;
  model: string;
  mode: string;
  raw: string;
  parsed: unknown;
  createdAt: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type Preferences = {
  /** Default provider+model used to seed Help and Eval pickers. */
  defaultProvider: Provider | null;
  defaultModel: string | null;
  theme: "system" | "light" | "dark";
  /** Auto-lock the vault after N minutes idle. 0 disables. */
  autoLockMinutes: number;
};

export type VaultDoc = {
  schemaVersion: number;
  keys: VaultKey[];
  drafts: Draft[];
  evals: EvalRecord[];
  preferences: Preferences;
  /** Arbitrary per-feature scratch state (tool configs, loop definitions). */
  featureState: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  defaultProvider: null,
  defaultModel: null,
  theme: "system",
  autoLockMinutes: 0,
};

export function emptyVault(now: string): VaultDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    keys: [],
    drafts: [],
    evals: [],
    preferences: { ...DEFAULT_PREFERENCES },
    featureState: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Walk a loaded document forward to SCHEMA_VERSION.
 *
 * Unknown-but-newer versions are refused rather than coerced: a user who opened
 * a newer build in another browser should get a clear error, not a silently
 * downgraded vault that drops the fields this build doesn't know about.
 */
export function migrate(doc: unknown): VaultDoc {
  if (!doc || typeof doc !== "object") {
    throw new Error("Vault document is not an object.");
  }
  const d = doc as Partial<VaultDoc> & { schemaVersion?: number };
  const version = typeof d.schemaVersion === "number" ? d.schemaVersion : 0;

  if (version > SCHEMA_VERSION) {
    throw new Error(
      `This vault was written by a newer version of Prompt Composer (schema ${version} > ${SCHEMA_VERSION}). Update the app before opening it.`
    );
  }

  // v0 -> v1: the pre-release shape had no featureState/evals. Fill defaults.
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    keys: Array.isArray(d.keys) ? d.keys : [],
    drafts: Array.isArray(d.drafts) ? d.drafts : [],
    evals: Array.isArray(d.evals) ? d.evals : [],
    preferences: { ...DEFAULT_PREFERENCES, ...(d.preferences ?? {}) },
    featureState:
      d.featureState && typeof d.featureState === "object" ? d.featureState : {},
    createdAt: d.createdAt ?? now,
    updatedAt: d.updatedAt ?? now,
  };
}
