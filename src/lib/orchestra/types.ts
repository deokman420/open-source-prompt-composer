export const ORCH_AGENT_SLOTS = [
  "role",
  "goal",
  "context",
  "bounds",
  "task",
  "success",
  "tools",
  "format",
] as const;

export type AgentSlot = (typeof ORCH_AGENT_SLOTS)[number];

export type AgentKind = "orchestrator" | "worker";

// Optional per-agent model override. When absent, the agent inherits the
// model picked at export time (the historical single-model behavior). When
// present on ANY agent, code export switches to the multi-provider router so
// agents can run on different providers/models. `provider` is the 3-provider
// orchestra ProviderId (see below); `id` is a raw model id from MODELS.
export interface AgentModel {
  provider: ProviderId;
  id: string;
}

export interface Agent {
  id: string;
  kind: AgentKind;
  name: string;
  collapsed: boolean;
  slots: Record<AgentSlot, string>;
  model?: AgentModel;
}

export type HandoffFormat = "summary" | "json" | "transcript";

export interface Coordination {
  handoffFormat: HandoffFormat;
  maxWorkers: number;
  terminationRule: string;
  sharedMemory: boolean;
}

export type PatternId =
  | "orchestrator-worker"
  | "sequential"
  | "parallel"
  | "group-chat"
  | "handoff";

export interface OrchState {
  pattern: PatternId;
  agents: Agent[];
  coordination: Coordination;
}

export interface PatternDef {
  title: string;
  blurb: string;
  diagram: string;
  seed: () => OrchState;
}

export interface TemplateDef {
  title: string;
  blurb: string;
  state: () => OrchState;
}

export interface ArchaeologyDef {
  title: string;
  blurb: string;
  source: string;
  state: () => OrchState;
}

export interface HealthReport {
  score: number;
  issues: string[];
  oks: string[];
}

export type ProviderId = "anthropic" | "openai" | "gemini";

export interface ModelEntry {
  id: string;
  label: string;
  bedrock?: string;
  vertex?: string;
}

export interface PromptTarget {
  kind: "prompt";
  label: string;
  caption: string;
}

export interface CodeTarget {
  kind: "code";
  provider: ProviderId;
  lang: "python" | "ts";
  label: string;
  adapter: (modelId: string) => string;
}

export type Target = PromptTarget | CodeTarget;
