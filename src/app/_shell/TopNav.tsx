"use client";

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
