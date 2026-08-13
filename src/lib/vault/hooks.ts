"use client";

/**
 * Typed accessors over the vault document.
 *
 * Pages should reach for these rather than poking at `doc` and `update`
 * directly, so the shape of the document stays changeable in one place.
 */

import { useCallback, useMemo } from "react";
import { useVault } from "./store";
import type { Draft, EvalRecord, Preferences, VaultKey } from "./schema";
import type { Provider } from "@/lib/providers/types";
import { DEFAULT_MODEL, isValidModel, SYSTEM_DEFAULT_SELECTION } from "@/lib/models";

/** Unique enough without a clock or crypto dependency in render paths. */
function newId(): string {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------------ *
 * API keys
 * ------------------------------------------------------------------ */

export function useKeys() {
  const { doc, update } = useVault();
  const keys = doc?.keys ?? [];

  const saveKey = useCallback(
    (provider: Provider, apiKey: string, label?: string) => {
      update((d) => {
        const now = new Date().toISOString();
        const existing = d.keys.find((k) => k.provider === provider);
        const entry: VaultKey = {
          provider,
          apiKey,
          label: label ?? existing?.label ?? null,
          createdAt: existing?.createdAt ?? now,
          lastUsedAt: existing?.lastUsedAt ?? null,
        };
        return {
          ...d,
          keys: [...d.keys.filter((k) => k.provider !== provider), entry],
        };
      });
    },
    [update]
  );

  const deleteKey = useCallback(
    (provider: Provider) => {
      update((d) => ({ ...d, keys: d.keys.filter((k) => k.provider !== provider) }));
    },
    [update]
  );

  /**
   * The plaintext key for a provider, or null.
   *
   * Callers pass the result straight to the proxy and drop it. Do not stash it
   * in component state — that widens the window where it sits in a React tree
   * that a devtools extension can walk.
   */
  const getKey = useCallback(
    (provider: Provider): string | null =>
      keys.find((k) => k.provider === provider)?.apiKey ?? null,
    [keys]
  );

  const markUsed = useCallback(
    (provider: Provider) => {
      update((d) => ({
        ...d,
        keys: d.keys.map((k) =>
          k.provider === provider ? { ...k, lastUsedAt: new Date().toISOString() } : k
        ),
      }));
    },
    [update]
  );

  const configured = useMemo(
    () => new Set(keys.map((k) => k.provider)),
    [keys]
  );

  return { keys, configured, saveKey, deleteKey, getKey, markUsed };
}

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

export function useDrafts() {
  const { doc, update } = useVault();
  const drafts = doc?.drafts ?? [];

  const createDraft = useCallback(
    (input: Omit<Draft, "id" | "createdAt" | "updatedAt">): string => {
      const id = newId();
      const now = new Date().toISOString();
      update((d) => ({
        ...d,
        drafts: [{ ...input, id, createdAt: now, updatedAt: now }, ...d.drafts],
      }));
      return id;
    },
    [update]
  );

  const updateDraft = useCallback(
    (id: string, patch: Partial<Omit<Draft, "id" | "createdAt">>) => {
      update((d) => ({
        ...d,
        drafts: d.drafts.map((draft) =>
          draft.id === id
            ? { ...draft, ...patch, updatedAt: new Date().toISOString() }
            : draft
        ),
      }));
    },
    [update]
  );

  const deleteDraft = useCallback(
    (id: string) => {
      update((d) => ({ ...d, drafts: d.drafts.filter((draft) => draft.id !== id) }));
    },
    [update]
  );

  const getDraft = useCallback(
    (id: string): Draft | null => drafts.find((d) => d.id === id) ?? null,
    [drafts]
  );

  return { drafts, createDraft, updateDraft, deleteDraft, getDraft };
}

/* ------------------------------------------------------------------ *
 * Eval history
 * ------------------------------------------------------------------ */

export function useEvals() {
  const { doc, update } = useVault();
  const evals = doc?.evals ?? [];

  const recordEval = useCallback(
    (input: Omit<EvalRecord, "id" | "createdAt">) => {
      update((d) => ({
        ...d,
        // Bounded: eval history is a convenience, not an archive, and an
        // unbounded list would grow the re-encrypted-on-every-save document
        // without limit.
        evals: [
          { ...input, id: newId(), createdAt: new Date().toISOString() },
          ...d.evals,
        ].slice(0, 200),
      }));
    },
    [update]
  );

  const clearEvals = useCallback(() => {
    update((d) => ({ ...d, evals: [] }));
  }, [update]);

  return { evals, recordEval, clearEvals };
}

/* ------------------------------------------------------------------ *
 * Preferences
 * ------------------------------------------------------------------ */

export function usePreferences() {
  const { doc, update } = useVault();
  const preferences = doc?.preferences ?? null;

  const setPreferences = useCallback(
    (patch: Partial<Preferences>) => {
      update((d) => ({ ...d, preferences: { ...d.preferences, ...patch } }));
    },
    [update]
  );

  /**
   * The provider+model a picker should open on: the saved preference when it
   * still exists in the catalog, otherwise the system default.
   */
  const defaultSelection = useMemo(() => {
    const p = preferences?.defaultProvider;
    const m = preferences?.defaultModel;
    if (p && m && isValidModel(p, m)) return { provider: p, model: m };
    if (p) return { provider: p, model: DEFAULT_MODEL[p] };
    return SYSTEM_DEFAULT_SELECTION;
  }, [preferences]);

  return { preferences, setPreferences, defaultSelection };
}

/* ------------------------------------------------------------------ *
 * Per-feature scratch state
 * ------------------------------------------------------------------ */

/**
 * Namespaced slot in the vault for a feature's own persisted state (a tool
 * definition, a loop config, the last pipeline layout). Keeps feature shapes
 * out of the top-level schema so adding a feature isn't a migration.
 */
export function useFeatureState<T>(key: string, fallback: T) {
  const { doc, update } = useVault();
  const value = (doc?.featureState?.[key] as T | undefined) ?? fallback;

  const setValue = useCallback(
    (next: T) => {
      update((d) => ({ ...d, featureState: { ...d.featureState, [key]: next } }));
    },
    [key, update]
  );

  return [value, setValue] as const;
}
