"use client";

import { useEffect } from "react";
import { VaultProvider, useVault } from "@/lib/vault/store";
import TopNav from "./TopNav";
import Footer from "./Footer";
import VaultGate from "./VaultGate";

/**
 * App shell. Owns the vault lifecycle so every page below can assume
 * `useVault().doc` is non-null once it renders.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <div className="shell">
        <TopNav />
        <VaultBoundary>{children}</VaultBoundary>
        <Footer />
      </div>
    </VaultProvider>
  );
}

/**
 * Stands between the nav and the page content.
 *
 * A first-time visitor gets an unprotected vault created for them silently —
 * no modal, no passphrase, no decision to make before they've seen the app.
 * Protection is offered in Settings once they have something worth protecting.
 * Only a vault the user *chose* to protect blocks the UI with an unlock prompt.
 */
function VaultBoundary({ children }: { children: React.ReactNode }) {
  const { status, create, error } = useVault();

  useEffect(() => {
    if (status === "empty") void create();
  }, [status, create]);

  if (status === "loading" || status === "empty") {
    return (
      <main className="page">
        <p className="muted">Opening your local vault…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="page">
        <div className="card card-lg">
          <h1 className="page-h1">Local storage is unavailable</h1>
          <p className="muted" style={{ marginTop: 12 }}>
            {error ??
              "This browser blocked IndexedDB. Prompt Composer keeps everything on your device, so it can't run without it."}
          </p>
          <p className="muted" style={{ marginTop: 12 }}>
            Private/incognito windows and some tracking-protection settings block
            local storage. Try a normal window, or allow site data for this
            origin.
          </p>
        </div>
      </main>
    );
  }

  if (status === "locked") return <VaultGate />;

  return <main className="page">{children}</main>;
}
