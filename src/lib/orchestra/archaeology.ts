import { mkAgent } from "./agent";
import type { ArchaeologyDef } from "./types";

export const ORCH_ARCHAEOLOGY: Record<string, ArchaeologyDef> = {
  "anthropic-research-prod": {
    title: "Anthropic Research (lead agent)",
    blurb: "Production multi-agent research system",
    source: "Anthropic · anthropic.com/engineering/multi-agent-research-system",
    state: () => ({
      pattern: "orchestrator-worker",
      agents: [
        mkAgent("orchestrator", "Lead agent", {
          role: "Lead research agent. Plans, delegates, and reconciles.",
          goal: "Answer the user's research query by decomposing it, dispatching parallel subagents, and synthesizing their findings.",
          context:
            "- Subagents have isolated context windows and their own tool access.\n- Plan is persisted to memory so the lead can re-strategize if early findings shift direction.",
          bounds:
            "- Don't execute searches yourself once subagents are spawned.\n- Don't fabricate citations — every claim must trace to a subagent finding.",
          task: "1. Analyze query.\n2. Save plan to memory.\n3. Spawn subagents for independent directions.\n4. Read condensed findings.\n5. Reconcile into a cited final answer.",
          success: "Final answer cites every non-trivial claim and addresses the original query end-to-end.",
          tools: "subagent_dispatch, memory_write, memory_read.",
          format: "Cited prose answer.",
        }),
        mkAgent("worker", "Search subagent", {
          role: "Search-focused subagent. One direction at a time.",
          goal: "Investigate the brief from the lead and return a condensed, cited summary.",
          context: "- Each subagent gets: objective, output format, tools/sources, task boundaries.",
          bounds: "- Don't expand beyond your brief.\n- Return summary, not transcript.",
          task: "Use tools → gather → condense.",
          success: "Summary directly answers the brief with citations.",
          tools: "web_search, web_fetch.",
          format: "Summary + sources.",
        }),
      ],
      coordination: {
        handoffFormat: "summary",
        maxWorkers: 5,
        terminationRule: "Stop when lead's plan is fully addressed.",
        sharedMemory: true,
      },
    }),
  },
  "crewai-crew": {
    title: "CrewAI crew (role-based)",
    blurb: "Canonical CrewAI shape: a crew of role-defined agents working a sequenced task list",
    source: "CrewAI docs · crewai.com",
    state: () => ({
      pattern: "sequential",
      agents: [
        mkAgent("worker", "Researcher", {
          role: "Senior Research Analyst. Expert at finding emerging trends.",
          goal: "Uncover cutting-edge developments in the user's topic.",
          context: "- backstory: years of analyst experience\n- delegation: false",
          task: "Conduct a comprehensive analysis of the topic.",
          success: "Detailed report on the latest trends.",
          tools: "search_tool.",
          format: "Detailed report.",
        }),
        mkAgent("worker", "Writer", {
          role: "Tech Content Strategist.",
          goal: "Craft compelling content from the analysis.",
          context: "- backstory: renowned for clarity\n- delegation: true (can delegate back to Researcher)",
          task: "Write a blog post draft using the analysis.",
          success: "Blog post draft ready to ship.",
          format: "Markdown.",
        }),
      ],
      coordination: {
        handoffFormat: "summary",
        maxWorkers: 4,
        terminationRule: "Process=sequential; stop after final task.",
        sharedMemory: false,
      },
    }),
  },
  "autogen-group": {
    title: "AutoGen group chat",
    blurb: "Multi-agent conversational thread under a chat manager",
    source: "Microsoft AutoGen · microsoft.github.io/autogen",
    state: () => ({
      pattern: "group-chat",
      agents: [
        mkAgent("orchestrator", "GroupChatManager", {
          role: "Group chat manager. Selects next speaker, manages turn-taking.",
          goal: "Run the group chat to convergence on the user's task.",
          bounds: "- Don't speak as a participant.\n- Enforce max_round.",
          task: "1. Init chat with user task.\n2. Select next speaker by relevance.\n3. Terminate on convergence or max_round.",
          success: "Final agent posts an answer accepted by the UserProxyAgent.",
          format: "Speaker-tagged transcript.",
        }),
        mkAgent("worker", "AssistantAgent", {
          role: "Assistant agent with code-writing ability.",
          goal: "Write code to solve the user task.",
          tools: "code_execution.",
          format: "Code blocks + brief prose.",
        }),
        mkAgent("worker", "UserProxyAgent", {
          role: "Stands in for the user; executes code and gives feedback.",
          goal: "Run the assistant's code and report results.",
          tools: "shell.",
          format: "Result blocks.",
        }),
      ],
      coordination: {
        handoffFormat: "transcript",
        maxWorkers: 4,
        terminationRule: "Until UserProxy says TERMINATE or max_round reached.",
        sharedMemory: true,
      },
    }),
  },
};
