"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import VaultChip from "./VaultChip";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // The inline links are display:none below 720px, so the drawer is the only
  // way to reach seven of the nine surfaces on a phone. Close it whenever the
  // route changes — App Router keeps this component mounted across navigations,
  // so without this the drawer stays open over the page the user just picked.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes; the body stops scrolling behind the overlay. Both are
  // registered only while open.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <button
            type="button"
            className="nav-burger"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <Link href="/" className="brand">
            <span className="brand-prefix">$ </span>
            <span className="brand-name">prompt-composer</span>
          </Link>

          <div className="topnav-links">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`topnav-link${isActive(link.href) ? " is-active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="topnav-right">
            <VaultChip />
            <Link
              href="/settings"
              className={`topnav-link topnav-link-settings${
                isActive("/settings") ? " is-active" : ""
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </nav>

      <div
        className={`nav-overlay${menuOpen ? " is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        id="nav-drawer"
        className={`nav-drawer${menuOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="nav-drawer-head">
          <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
            <span className="brand-prefix">$ </span>
            <span className="brand-name">prompt-composer</span>
          </Link>
          <button
            type="button"
            className="nav-drawer-close"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="nav-drawer-links">
          {[...NAV_LINKS, { href: "/settings", label: "Settings" }].map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`topnav-link${isActive(link.href) ? " is-active" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </>
  );
}
