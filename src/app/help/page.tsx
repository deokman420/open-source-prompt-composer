import type { Metadata } from "next";
import Link from "next/link";
import HelpChat from "./HelpChat";

export const metadata: Metadata = {
  title: "AI Help",
  description:
    "A chat helpdesk that knows this app and prompt & context engineering, answering from a cited knowledge base on your own API key.",
};

export default function HelpPage() {
  return (
    <section style={{ maxWidth: "860px" }}>
      <div className="label-mono">00 · ai help</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>
        AI Help
      </h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        A chat helpdesk that knows this app and prompt &amp; context engineering.
        Answers stream from the model you select, on your own API key, and cite
        their sources.
      </p>

      <p className="muted" style={{ marginTop: "10px", fontSize: "0.88rem" }}>
        Looking for the written reference instead?{" "}
        <Link href="/help/kb">Open the knowledge base &rarr;</Link>
      </p>

      <div style={{ marginTop: "28px" }}>
        <HelpChat />
      </div>
    </section>
  );
}
