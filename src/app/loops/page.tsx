import type { Metadata } from "next";
import LoopsClient from "./LoopsClient";

export const metadata: Metadata = {
  title: "Loops",
  description:
    "Build, learn, and save Claude Code /loop commands — fixed, self-paced, and maintenance loops with verifier-backed stop conditions.",
};

export default function LoopsPage() {
  return (
    <section style={{ maxWidth: "1140px" }}>
      <div className="label-mono">06 · claude code loops</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>
        Loop Builder
      </h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        A guided builder and teaching gallery for Claude Code&apos;s{" "}
        <code>/loop</code> scheduled-task skill. Produces a copy-paste command
        and an optional <code>loop.md</code>.
      </p>
      <div style={{ marginTop: "24px" }}>
        <LoopsClient />
      </div>
    </section>
  );
}
