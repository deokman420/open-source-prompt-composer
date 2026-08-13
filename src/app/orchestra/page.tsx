import type { Metadata } from "next";
import OrchestraClient from "./OrchestraClient";

export const metadata: Metadata = {
  title: "Orchestra",
  description:
    "Compose multi-agent systems from five canonical orchestration patterns and export them as Markdown, XML, or runnable Python / TypeScript.",
};

export default function OrchestraPage() {
  return (
    <section style={{ maxWidth: "1140px" }}>
      <div className="label-mono">01 · multi-agent</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>
        Agent Orchestra
      </h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        Compose multi-agent systems with one of five canonical orchestration
        patterns. Export the bundle as Markdown, XML, or runnable Python /
        TypeScript for Anthropic, OpenAI, Gemini, Bedrock, or Vertex.
      </p>
      <div style={{ marginTop: "24px" }}>
        <OrchestraClient />
      </div>
    </section>
  );
}
