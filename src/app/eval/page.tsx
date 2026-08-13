import type { Metadata } from "next";
import EvalForm from "./EvalForm";

export const metadata: Metadata = {
  title: "Eval",
  description:
    "Score a prompt against the R-G-C-B-T-S rubric, rewrite it for clarity, spellcheck it, or validate its code blocks — using your own API key.",
};

export default function EvalPage() {
  return (
    <>
      <h1 className="page-h1">AI Eval</h1>
      <p className="page-sub">
        Score, rewrite, spellcheck, or code-check a prompt. Runs on your own API
        key against the provider you pick; the request passes through this
        site&rsquo;s proxy and is not stored.
      </p>
      <div style={{ marginTop: 28 }}>
        <EvalForm />
      </div>
    </>
  );
}
