import Link from "next/link";
import type { Metadata } from "next";
import KeyNudge from "@/app/_shared/KeyNudge";

export const metadata: Metadata = {
  title: "Prompt Composer — local-first prompt engineering",
};

const FEATURES = [
  {
    href: "/compose",
    name: "Compose",
    blurb:
      "Build a structured prompt from role, task, context, constraints, and output format. Preview and copy it as plain text.",
  },
  {
    href: "/orchestra",
    name: "Orchestra",
    blurb:
      "Fan one prompt out across several models at once and compare their answers side by side.",
  },
  {
    href: "/context-pipeline",
    name: "Context Pipeline",
    blurb:
      "Chain transformations over a body of context — summarize, extract, rewrite — and watch the token count at each stage.",
  },
  {
    href: "/eval",
    name: "Eval",
    blurb:
      "Score a prompt against a rubric and get structured, comparable feedback instead of a vibe check.",
  },
  {
    href: "/loops",
    name: "Loops",
    blurb: "Run a prompt repeatedly over a list of inputs and collect the results.",
  },
  {
    href: "/tools",
    name: "Tool Builder",
    blurb:
      "Design a tool-use JSON schema and validate it before wiring it into your own agent.",
  },
];

export default function HomePage() {
  return (
    <>
      <h1 className="page-h1">Prompt engineering that stays on your machine.</h1>
      <p className="page-sub">
        Prompt Composer runs entirely in your browser. Your prompts, drafts, and
        API keys live in this device&rsquo;s local storage — optionally encrypted
        with a passphrase only you know. There is no account to create and no
        database holding your work.
      </p>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          marginTop: 32,
        }}
      >
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="card" style={{ display: "block" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8 }}>
              {f.name}
            </h3>
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              {f.blurb}
            </p>
          </Link>
        ))}
      </div>

      <KeyNudge />

      <div className="card card-quiet card-dashed" style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 10 }}>
          What &ldquo;local-first&rdquo; means here, precisely
        </h3>
        <ul className="muted" style={{ fontSize: "0.85rem", paddingLeft: 18, margin: 0 }}>
          <li>
            Prompts, drafts, settings, and API keys are written to this
            browser&rsquo;s IndexedDB and nowhere else.
          </li>
          <li>
            Setting a passphrase encrypts all of it at rest with AES-GCM-256,
            keyed by PBKDF2-SHA256. The passphrase never leaves memory.
          </li>
          <li>
            Model requests go to this site&rsquo;s proxy, which forwards them to
            the provider you picked and returns the answer. It exists because
            browsers can&rsquo;t call most provider APIs directly, and it keeps
            no record of the call.
          </li>
          <li>
            Clearing your browser data deletes everything. Export a backup from
            Settings first.
          </li>
        </ul>
      </div>
    </>
  );
}
