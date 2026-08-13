import type { Metadata } from "next";
import ContextPipelineClient from "./ContextPipelineClient";

export const metadata: Metadata = {
  title: "Context Pipeline",
  description:
    "Plan a context budget: decide what each call sees, how much of the window it gets, what happens when it fills, and what leaves at handoff.",
};

export default function ContextPipelinePage() {
  return (
    <section style={{ maxWidth: "1140px" }}>
      <div className="label-mono">02 · context</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>
        Context Pipeline
      </h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        Plan a context budget the way you&apos;d plan RAM: decide what each call
        sees, how much of the window it gets, what happens when it fills, and
        what leaves at handoff. Export the plan as a spec or as runnable
        framework scaffolding.
      </p>
      <div style={{ marginTop: "24px" }}>
        <ContextPipelineClient />
      </div>
    </section>
  );
}
