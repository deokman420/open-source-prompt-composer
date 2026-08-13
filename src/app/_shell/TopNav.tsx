"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVault } from "@/lib/vault/store";

/** Every surface in the app, in nav order. */
export const NAV_LINKS = [
  { href: "/compose", label: "Compose" },
  { href: "/orchestra", label: "Orchestra" },
  { href: "/context-pipeline", label: "Context" },
  { href: "/eval", label: "Eval" },
  { href: "/loops", label: "Loops" },
  { href: "/tools", label: "Tools" },
  { href: "/drafts", label: "Drafts" },
  { href: "/help", label: "Help" },
] as const;

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand">
          <span className="brand-prefix">$ </span>
          <span className="brand-name">prompt-composer</span>
        </Link>

        <div className="topnav-links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`topnav-link${
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? " is-active"
                  : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="topnav-right">
          <VaultChip />
          <Link
            href="/settings"
            className={`topnav-link${pathname.startsWith("/settings") ? " is-active" : ""}`}
          >
            Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * Lock state at a glance, plus the one-click Lock action.
 *
 * Renders a placeholder (not null) before hydration so the nav doesn't change
 * height when the vault store resolves — see the .topnav-right note in
 * globals.css.
 */
function VaultChip() {
  const { status, isProtected, saving, lock } = useVault();

  if (status === "loading") {
    return (
      <span className="vault-chip" data-state="loading">
        …
      </span>
    );
  }

  if (!isProtected) {
    return (
      <span className="vault-chip" data-state="open" title="Stored on this device, unencrypted. Add a passphrase in Settings.">
        local
      </span>
    );
  }

  if (status === "locked") {
    return (
      <span className="vault-chip" data-state="locked">
        locked
      </span>
    );
  }

  return (
    <span className="vault-chip" data-state="unlocked">
      {saving ? "saving…" : "unlocked"}
      <button type="button" onClick={lock} title="Lock the vault">
        lock
      </button>
    </span>
  );
}
