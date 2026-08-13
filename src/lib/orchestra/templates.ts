import { mkAgent } from "./agent";
import { ORCH_PATTERNS } from "./patterns";
import type { TemplateDef } from "./types";

export const ORCH_TEMPLATES: Record<string, TemplateDef> = {
  "anthropic-research": {
    title: "Anthropic-style research",
    blurb: "Lead orchestrator + parallel research workers + synthesis worker",
    state: ORCH_PATTERNS["orchestrator-worker"].seed,
  },
  "doc-pipeline": {
    title: "Doc pipeline (research → outline → write → review)",
    blurb: "Sequential 4-stage content production",
    state: ORCH_PATTERNS.sequential.seed,
  },
  "red-team-review": {
    title: "Red-team review (parallel)",
    blurb: "Optimist + skeptic + pragmatist on the same proposal, then merge",
    state: ORCH_PATTERNS.parallel.seed,
  },
  "support-triage": {
    title: "Support triage (handoff)",
    blurb: "Triage classifies, then routes to a specialist",
    state: ORCH_PATTERNS.handoff.seed,
  },
  "kvac-commander": {
    title: "KVAC Commander + specialists",
    blurb: "User's own framework: Commander dispatches to a focused subset of specialists",
    state: () => ({
      pattern: "orchestrator-worker",
      agents: [
        mkAgent("orchestrator", "Commander", {
          role: "KVAC Commander. Atomizes user intent into file-level tasks and dispatches to the smallest qualified specialist set.",
          goal: "Translate the user's request into a sequenced plan of specialist consultations, then synthesize results.",
          bounds:
            "- Never execute a specialist's work.\n- Prefer the smallest specialist set that can answer.\n- Atomize tasks to file-level precision before dispatching.",
          task: "1. Parse intent.\n2. Atomize into tasks.\n3. Pick consultation mode (focused | broad | adversarial | sequential).\n4. Dispatch.\n5. Reconcile.",
          success: "Plan, dispatch log, and final synthesis are all present.",
          format: "Markdown: ## Plan, ## Dispatch, ## Synthesis.",
        }),
        mkAgent("worker", "Architecture specialist", {
          role: "System architect. Designs across components, not within them.",
          goal: "Answer architecture questions from Commander; defer implementation details.",
          format: "Markdown.",
        }),
        mkAgent("worker", "Implementation specialist", {
          role: "Implementer. Writes the code for a single named file or function.",
          goal: "Produce the implementation for the file Commander names.",
          bounds: "- Touch only the file named in the brief.",
          format: "Code block + one-line change summary.",
        }),
        mkAgent("worker", "Verification specialist", {
          role: "Verifier. Reads outputs and challenges them.",
          goal: "Tell Commander whether the work passes the user's success criteria.",
          format: "JSON: {passes: bool, blocking_issues: [...]}.",
        }),
      ],
      coordination: {
        handoffFormat: "json",
        maxWorkers: 4,
        terminationRule:
          "Stop when Verification returns passes:true or after 2 retry rounds.",
        sharedMemory: true,
      },
    }),
  },
};
