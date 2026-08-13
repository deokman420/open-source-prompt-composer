import { mkAgent } from "./agent";
import type { OrchState, PatternDef, PatternId } from "./types";

export const ORCH_PATTERNS: Record<PatternId, PatternDef> = {
  "orchestrator-worker": {
    title: "Orchestrator + workers",
    blurb:
      "Lead agent decomposes the task and delegates to specialized workers in parallel. Anthropic's Research pattern; ~90% lift over single agent on internal evals.",
    diagram: `Orchestrator
  ├──▶ Worker 1
  ├──▶ Worker 2
  └──▶ Worker 3`,
    seed: (): OrchState => ({
      pattern: "orchestrator-worker",
      agents: [
        mkAgent("orchestrator", "Lead orchestrator", {
          role: "Lead research orchestrator. Plans, delegates, never executes the work itself.",
          goal: "Decompose the user's task into independent subtasks and delegate each to a specialized worker; reconcile results into a final answer with citations.",
          context:
            "- Workers run in parallel with isolated context windows.\n- Workers return condensed summaries (not transcripts).\n- The user's task arrives as the first user message.",
          bounds:
            "- Delegate, don't do. Never perform a worker's job yourself.\n- Don't ask the user for missing info you can have a worker fetch.\n- Don't expand scope beyond the user's request.",
          task: "1. Read the user's task.\n2. Draft a plan: list 2–N independent subtasks.\n3. For each subtask, write a focused brief (objective, format, tools, boundaries) and dispatch to the matching worker.\n4. Collect summaries.\n5. Reconcile into the final answer; cite each claim to the worker it came from.",
          success:
            "Final answer addresses the user's task end-to-end, every non-trivial claim is attributed to a worker summary, and no contradictions are left unresolved.",
          tools: "Worker dispatch only. No direct tool calls.",
          format: "Plan first (numbered), then 'Final answer:' block with inline [W1], [W2] citations.",
        }),
        mkAgent("worker", "Research worker", {
          role: "Focused research worker. Narrow scope, deep depth.",
          goal: "Answer exactly the brief sent by the orchestrator and return a condensed summary.",
          context:
            "- You receive: objective, expected format, allowed tools, boundaries.\n- You do not see the user's full task or other workers' work.",
          bounds:
            "- Don't expand scope beyond your brief.\n- Don't return a transcript — return a summary.\n- Flag uncertainty; don't fabricate.",
          task: "1. Confirm you understand the brief.\n2. Use tools to gather evidence.\n3. Return a summary in the requested format.",
          success: "Summary directly answers the brief, ≤ 300 words, cites sources, flags unknowns explicitly.",
          tools: "Web search, file read.",
          format: "Summary block + sources list.",
        }),
        mkAgent("worker", "Synthesis worker", {
          role: "Analytical worker that compares and contrasts multiple inputs.",
          goal: "Take the orchestrator's brief and produce a structured comparison or synthesis.",
          context: "- You may receive multiple research summaries as input.",
          bounds: "- Don't introduce facts not in the inputs.\n- Don't summarize — analyze.",
          task: "1. Identify the dimensions being compared.\n2. Build a table or structured comparison.\n3. Highlight tradeoffs.",
          success: "Output is a markdown table or structured list with clear axes.",
          tools: "No external tools — analysis only.",
          format: "Markdown table.",
        }),
      ],
      coordination: {
        handoffFormat: "summary",
        maxWorkers: 5,
        terminationRule:
          "Stop when every dispatched worker returns a summary, or after 2 dispatch rounds, whichever first.",
        sharedMemory: true,
      },
    }),
  },
  sequential: {
    title: "Sequential pipeline",
    blurb:
      "Agents run in a fixed order; each one's output is the next one's input. Use when steps are linear and stable (research → outline → write → review).",
    diagram: `Researcher ──▶ Outliner ──▶ Writer ──▶ Reviewer`,
    seed: (): OrchState => ({
      pattern: "sequential",
      agents: [
        mkAgent("worker", "1. Researcher", {
          role: "Researcher who gathers raw material.",
          goal: "Collect facts and sources relevant to the user's topic.",
          bounds: "- Don't write prose — collect material only.",
          task: "1. Identify the 3–5 angles worth covering.\n2. Gather 2–4 sources per angle.\n3. Return a structured notes file.",
          success: "Output is a markdown notes file grouped by angle with source URLs.",
          format: "Markdown.",
        }),
        mkAgent("worker", "2. Outliner", {
          role: "Outliner who shapes raw notes into a structure.",
          goal: "Turn the researcher's notes into a numbered outline.",
          bounds: "- Don't add facts not in the notes.",
          task: "1. Identify the thesis.\n2. Group notes into sections.\n3. Order sections for the reader.",
          success: "Numbered outline with one line per section explaining what goes there.",
          format: "Numbered markdown list.",
        }),
        mkAgent("worker", "3. Writer", {
          role: "Writer who drafts from an outline.",
          goal: "Write the full draft following the outline.",
          bounds: "- Follow the outline order.\n- Don't editorialize beyond the notes.",
          task: "Draft the full piece section by section.",
          success: "Full prose draft, all outline sections present.",
          format: "Markdown.",
        }),
        mkAgent("worker", "4. Reviewer", {
          role: "Editor reviewing for clarity and accuracy.",
          goal: "Return a revised draft + change log.",
          bounds: "- Don't change facts.\n- Keep voice consistent.",
          task: "1. Read the draft.\n2. Tighten and fix.\n3. List changes.",
          success: "Revised draft + bulleted change log.",
          format: "Markdown.",
        }),
      ],
      coordination: {
        handoffFormat: "summary",
        maxWorkers: 6,
        terminationRule: "Stop after the last agent completes.",
        sharedMemory: false,
      },
    }),
  },
  parallel: {
    title: "Parallel perspectives",
    blurb:
      "Agents work the same input from different angles simultaneously; results are merged. Use for multi-perspective review or red-teaming.",
    diagram: `        ┌──▶ Perspective 1 ──┐
Input ──┼──▶ Perspective 2 ──┼──▶ Merge
        └──▶ Perspective 3 ──┘`,
    seed: (): OrchState => ({
      pattern: "parallel",
      agents: [
        mkAgent("orchestrator", "Merger", {
          role: "Merger who reconciles parallel perspectives into one output.",
          goal: "Combine each perspective's output into a single coherent answer.",
          bounds: "- Preserve disagreements; don't paper over them.",
          task: "1. Read every perspective's output.\n2. Group agreements and disagreements.\n3. Produce the merged answer with a 'Disagreements' section if any.",
          success: "One merged answer + an explicit 'Disagreements' section when perspectives diverge.",
          format: "Markdown with 'Merged' and 'Disagreements' sections.",
        }),
        mkAgent("worker", "Optimist perspective", {
          role: "Devil's advocate for the proposal — argues why it works.",
          goal: "Give the strongest case for the proposal.",
          task: "List 3–5 reasons this works.",
          success: "Markdown bullets, no hedging.",
          format: "Markdown bullets.",
        }),
        mkAgent("worker", "Skeptic perspective", {
          role: "Red-team reviewer — argues why it fails.",
          goal: "Give the strongest case against the proposal.",
          task: "List 3–5 failure modes.",
          success: "Markdown bullets, concrete scenarios.",
          format: "Markdown bullets.",
        }),
        mkAgent("worker", "Pragmatist perspective", {
          role: "Implementer — what would shipping this actually require?",
          goal: "Surface the implementation cost and risk.",
          task: "List 3–5 concrete implementation requirements.",
          success: "Markdown bullets, each with rough effort estimate.",
          format: "Markdown bullets.",
        }),
      ],
      coordination: {
        handoffFormat: "summary",
        maxWorkers: 5,
        terminationRule: "Run all perspectives in parallel; merge when all return.",
        sharedMemory: true,
      },
    }),
  },
  "group-chat": {
    title: "Group chat / debate",
    blurb:
      "Agents converse in a shared thread under a chat manager. Use for deliberation, debate, or consensus-building.",
    diagram: `Chat Manager  (turn-taking thread)
  ├◀──▶ Agent 1
  ├◀──▶ Agent 2
  └◀──▶ Agent 3`,
    seed: (): OrchState => ({
      pattern: "group-chat",
      agents: [
        mkAgent("orchestrator", "Chat manager", {
          role: "Chat manager who picks the next speaker and decides when to end.",
          goal: "Run a productive multi-agent discussion that converges on an answer.",
          bounds: "- Don't speak as a domain agent yourself.\n- Don't let one agent dominate.",
          task: "1. Open the topic.\n2. Pick the next speaker based on relevance.\n3. End when convergence reached or after N turns.\n4. Post the final consensus.",
          success:
            "Conversation has ≥1 turn from every participant; ends with an explicit consensus or 'no consensus' note.",
          format: "Speaker tags + final 'Consensus:' block.",
        }),
        mkAgent("worker", "Domain expert", {
          role: "Subject-matter expert on the topic. Speak only on technical merits.",
          goal: "Offer factual depth when called on.",
          format: "≤ 100 words per turn.",
        }),
        mkAgent("worker", "User advocate", {
          role: "User advocate. Speak for whoever uses the thing being discussed.",
          goal: "Surface user impact when called on.",
          format: "≤ 100 words per turn.",
        }),
      ],
      coordination: {
        handoffFormat: "transcript",
        maxWorkers: 4,
        terminationRule: "End on convergence or after 8 total turns.",
        sharedMemory: true,
      },
    }),
  },
  handoff: {
    title: "Handoff / routing",
    blurb:
      "Each agent decides when to pass control to a more specialized one. Use for customer-support style triage or task routing.",
    diagram: `Triage ──▶ Specialist A
   └─(fallback)──▶ Specialist B`,
    seed: (): OrchState => ({
      pattern: "handoff",
      agents: [
        mkAgent("orchestrator", "Triage", {
          role: "Triage agent that classifies the request and hands off.",
          goal: "Read the request and route to the right specialist; only answer directly if no specialist fits.",
          bounds: "- Don't answer outside your shallow knowledge.\n- Always state the handoff decision explicitly.",
          task: "1. Classify the request (category, priority).\n2. Decide: handle here, or hand off to which specialist?\n3. State the decision + hand off (or answer briefly).",
          success: "Output names the chosen specialist (or 'self') with a one-line reason.",
          format: "JSON: {decision, target, reason, brief}.",
        }),
        mkAgent("worker", "Specialist A", {
          role: "Domain specialist (rename to your domain).",
          goal: "Answer requests routed by Triage that match your specialty.",
          bounds: "- Decline politely if the request isn't in your scope and route back to Triage.",
          task: "1. Read the brief from Triage.\n2. Answer.\n3. Flag any follow-ups Triage should re-route.",
          success: "In-scope request fully answered; out-of-scope explicitly returned.",
        }),
      ],
      coordination: {
        handoffFormat: "json",
        maxWorkers: 6,
        terminationRule: "Stop when the request is fully resolved or all specialists decline.",
        sharedMemory: false,
      },
    }),
  },
};

export const DEFAULT_PATTERN: PatternId = "orchestrator-worker";

export function blankSeed(): OrchState {
  const s = ORCH_PATTERNS[DEFAULT_PATTERN].seed();
  s.agents.forEach((a) => {
    for (const slot of Object.keys(a.slots) as (keyof typeof a.slots)[]) {
      a.slots[slot] = "";
    }
  });
  s.coordination.terminationRule = "";
  return s;
}
