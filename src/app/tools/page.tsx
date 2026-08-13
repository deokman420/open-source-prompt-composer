import type { Metadata } from "next";
import ToolsClient from "./ToolsClient";

export const metadata: Metadata = {
  title: "Tool Builder",
  description:
    "Design a tool-use JSON schema, validate it against the provider subset, and export it for Anthropic, OpenAI, or Gemini.",
};

export default function ToolsPage() {
  return (
    <section style={{ maxWidth: "1140px" }}>
      <div className="label-mono">04 · tool use</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>
        Tool Builder
      </h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        Define a tool once — name, description, parameters — and export a valid
        schema for Anthropic, OpenAI, or Gemini. Validation catches the shapes
        each provider rejects before you paste it into an agent.
      </p>
      <div style={{ marginTop: "24px" }}>
        <ToolsClient />
      </div>
    </section>
  );
}
