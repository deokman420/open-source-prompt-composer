"use client";

import { useEffect, useRef } from "react";
import { useVault } from "@/lib/vault/store";

/**
 * Bridges the vanilla composer bundle (/composer/app.js) to the encrypted vault.
 *
 * The bundle is the free site's original, DOM-driven composer — 1900 lines of
 * proven logic for the R-G-C-B-T-S frame, live preview, export formats, starter
 * templates, and share links. Rewriting it as React would risk all of that to
 * gain nothing, so it ships as-is with exactly one change: every storage call
 * goes through `PC_STORE` instead of `localStorage`.
 *
 * This component supplies that PC_STORE.
 *
 * The hard constraint is that the bundle's storage calls are SYNCHRONOUS
 * (`getItem` returns a string, right now) while the vault is async and
 * encrypted. That's reconcilable only because the vault is already decrypted in
 * memory by the time any page renders — so this keeps a synchronous mirror of
 * the composer's slice, serves reads from it instantly, and flushes writes back
 * to the vault on a debounce.
 *
 * Feedback-loop hazard: flushing calls setValue, which re-renders this
 * component. The mirror therefore lives in a ref and is seeded exactly once, on
 * mount — never re-synced from props. If it were reseeded on every render, a
 * flush would race the render it caused and could revert the keystroke that
 * triggered it.
 */

const FEATURE_KEY = "composer";
const FLUSH_DEBOUNCE_MS = 500;

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

  // Latest `update` without making it an effect dependency — re-running the
  // mount effect would re-inject the bundle and reseed the mirror.
  const updateRef = useRef(update);
  updateRef.current = update;

  // Seed value captured on first render only; see the note above.
  const seedRef = useRef<Record<string, string> | null>(null);
  if (seedRef.current === null) {
    seedRef.current = {
      ...((doc?.featureState?.[FEATURE_KEY] as Record<string, string> | undefined) ?? {}),
    };
  }

  useEffect(() => {
    const mirror = seedRef.current ?? {};
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      updateRef.current((d) => ({
        ...d,
        featureState: { ...d.featureState, [FEATURE_KEY]: { ...mirror } },
      }));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, FLUSH_DEBOUNCE_MS);
    };

    window.__pcStore = {
      getItem: (key) => (key in mirror ? mirror[key] : null),
      setItem: (key, value) => {
        mirror[key] = String(value);
        schedule();
      },
      removeItem: (key) => {
        delete mirror[key];
        schedule();
      },
    };

    // Inject after the shim exists — the bundle reads window.__pcStore at the
    // top of its IIFE, so installing it later would silently fall back to
    // localStorage and write outside the vault.
    //
    // A fresh <script> element per mount (rather than next/script) forces
    // re-execution on client-side navigation back to /compose, where the DOM is
    // recreated but a module would not re-run. The bundle's per-DOM guard makes
    // a redundant evaluation a no-op, so StrictMode's double-invoke is safe.
    const script = document.createElement("script");
    script.src = "/composer/app.js";
    script.async = false;
    document.body.appendChild(script);

    return () => {
      script.remove();
      // Don't lose an edit made in the last few hundred milliseconds.
      if (timer) {
        clearTimeout(timer);
        flush();
      }
      delete window.__pcStore;
    };
  }, []);

  return null;
}
