"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVault } from "@/lib/vault/store";

/**
 * Bridges the vanilla composer bundle (/composer/app.js) to the encrypted vault.
 *
 * The bundle is the free site's original, DOM-driven composer — ~1,900 lines of
 * proven logic for the R-G-C-B-T-S frame, live preview, export formats, starter
 * templates, and share links. It ships as-is with exactly one change: every
 * storage call goes through `PC_STORE` instead of `localStorage`.
 *
 * This component supplies that PC_STORE.
 *
 * The hard constraint is that the bundle's storage calls are SYNCHRONOUS
 * (`getItem` returns a string, right now) while the vault is async and
 * encrypted. That reconciles because the decrypted document is already in
 * memory by render time, so reads can be served straight from it.
 *
 * Reads come from the LIVE document (via a ref), not a snapshot taken at mount.
 *
 * An earlier version seeded a mirror object once on mount and served reads from
 * that. Two failures fell out of it, both visible only when navigating away and
 * back:
 *
 *   1. A stale seed. If the mirror was captured before a pending flush landed,
 *      the remounted bundle read an empty store, found nothing to restore, and
 *      then persisted the resulting blank form OVER the real saved work.
 *   2. A zombie writer. The previous instance's debounced flush could still
 *      fire after unmount and write its now-stale mirror back into the vault,
 *      clobbering whatever the new instance had written.
 *
 * Both are fixed structurally: reads are always live, and each instance refuses
 * to write once it has been torn down.
 */

const FEATURE_KEY = "composer";
const FLUSH_DEBOUNCE_MS = 500;

/** Sentinel for a key the bundle deleted but which hasn't been flushed yet. */
const DELETED = Symbol("deleted");

declare global {
  interface Window {
    __pcStore?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
    };
  }
}

export default function ComposerHost() {
  const { doc, update } = useVault();
  const router = useRouter();

  // Live views of vault state and the update fn, so the mount effect never has
  // to re-run (re-running it would re-inject the bundle).
  const docRef = useRef(doc);
  docRef.current = doc;
  const updateRef = useRef(update);
  updateRef.current = update;

  // The bundle asks the host to route ("Send to Evaluator") rather than doing a
  // full page load, which would destroy the in-memory handoff carrying the
  // prompt. Claiming the event with preventDefault() tells it we handled it.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const href = (e as CustomEvent<{ href?: string }>).detail?.href;
      if (!href) return;
      e.preventDefault();
      router.push(href);
    };
    window.addEventListener("pc:navigate", onNavigate);
    return () => window.removeEventListener("pc:navigate", onNavigate);
  }, [router]);

  useEffect(() => {
    // Writes the bundle has made that haven't been flushed to the vault yet.
    // Reads check here first, then fall through to the committed document.
    const pending = new Map<string, string | typeof DELETED>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const committed = (): Record<string, string> =>
      (docRef.current?.featureState?.[FEATURE_KEY] as Record<string, string> | undefined) ?? {};

    const flush = () => {
      timer = null;
      if (!alive || pending.size === 0) return;
      const batch = new Map(pending);
      pending.clear();
      updateRef.current((d) => {
        const slice = {
          ...((d.featureState?.[FEATURE_KEY] as Record<string, string> | undefined) ?? {}),
        };
        for (const [k, v] of batch) {
          if (v === DELETED) delete slice[k];
          else slice[k] = v;
        }
        return { ...d, featureState: { ...d.featureState, [FEATURE_KEY]: slice } };
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
    };

    window.__pcStore = {
      getItem: (key) => {
        if (pending.has(key)) {
          const v = pending.get(key)!;
          return v === DELETED ? null : v;
        }
        return committed()[key] ?? null;
      },
      setItem: (key, value) => {
        pending.set(key, String(value));
        schedule();
      },
      removeItem: (key) => {
        pending.set(key, DELETED);
        schedule();
      },
    };

    // Inject only after the shim exists — the bundle reads window.__pcStore at
    // the top of its IIFE, so installing it later would silently fall back to
    // localStorage and write outside the vault.
    //
    // A fresh <script> element per mount (rather than next/script) forces
    // re-execution on client-side navigation back to /compose, where the DOM is
    // recreated but a module would not re-run. The bundle's per-DOM guard makes
    // a redundant evaluation a no-op.
    const script = document.createElement("script");
    script.src = "/composer/app.js";
    script.async = false;
    document.body.appendChild(script);

    return () => {
      script.remove();
      // Commit anything still pending, then refuse all further writes. Without
      // the `alive` latch a queued flush from this instance could land after
      // the next one has already written, reverting it.
      if (timer) clearTimeout(timer);
      flush();
      alive = false;
      delete window.__pcStore;
    };
  }, []);

  return null;
}
