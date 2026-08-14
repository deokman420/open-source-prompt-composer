"use client";

import Link from "next/link";
import { useKeys } from "@/lib/vault/hooks";

/**
 * One quiet line pointing at Settings for the two features that need a key.
 *
 * Deliberately small and conditional. Only Eval and the Help chat call a model;
 * Compose, Orchestra, Context Pipeline, Loops, and Tool Builder are pure local
 * builders that never need one. So this is a footnote, not a call to action —
 * and it disappears entirely once any key is configured.
 */
export default function KeyNudge() {
  const { configured } = useKeys();
  if (configured.size > 0) return null;

  return (
    <p className="muted" style={{ fontSize: "0.8rem", marginTop: 24 }}>
      Optional: <strong style={{ fontWeight: 500 }}>Eval</strong> and the{" "}
      <strong style={{ fontWeight: 500 }}>Help chat</strong> call a model, so
      they need your own API key. Everything else here works without one.{" "}
      <Link href="/settings">Add a key in Settings</Link>
      .
    </p>
  );
}
