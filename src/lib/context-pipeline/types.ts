export const SOURCE_KEYS = [
  "pinned",
  "retrieved",
  "scratchpad",
  "history",
  "shared_store",
  "user_prefs",
] as const;

export type SourceKey = (typeof SOURCE_KEYS)[number];

export interface SourceMeta {
  name: string;
  subtitle: string;
  color: string;
}

// Brand-token hexes (kept inline — the interactive client has no access to the
// CSS-var classes the way the design-token surfaces do).
export const SOURCE_META: Record<SourceKey, SourceMeta> = {
  pinned: { name: "In-context (pinned)", subtitle: "Always present · never evicted", color: "#3b82f6" },
  retrieved: { name: "Retrieved (RAG)", subtitle: "Semantic / keyword search", color: "#10b981" },
  scratchpad: { name: "Scratchpad", subtitle: "Written by agent mid-run", color: "#f59e0b" },
  history: { name: "Conversation history", subtitle: "Prior turns, compressible", color: "#00d4aa" },
  shared_store: { name: "Shared store", subtitle: "Persists across agents", color: "#a855f7" },
  user_prefs: { name: "User preferences", subtitle: "Long-term profile data", color: "#8492a6" },
};

export const OUTPUT_COLOR = "#4a5568";

export interface SourceState {
  enabled: boolean;
  tokens: number;
}

export type EvictionTrigger = "token_threshold" | "turn_count" | "manual" | "never";
export type CompactionMethod = "summarize" | "drop_oldest" | "none";
export type SalienceBias = "entity_ids" | "recency" | "none";
export type SurgicalTrim = "strip_payloads" | "full_turns" | "none";
export type HandoffFormat = "summary" | "json" | "transcript";

export interface PinnedSlot {
  id: string;
  label: string;
  tokens: number;
}

export interface Eviction {
  trigger: EvictionTrigger;
  threshold: number;
  turnLimit: number | null;
}

export interface Compaction {
  method: CompactionMethod;
  salience: SalienceBias;
  surgical: SurgicalTrim;
}

export interface Handoff {
  format: HandoffFormat;
  writeScratchpad: boolean;
  writeRetrieved: boolean;
  writeFinalAnswer: boolean;
}

export interface CtxState {
  model: string;
  sources: Record<SourceKey, SourceState>;
  output: number;
  eviction: Eviction;
  pinnedSlots: PinnedSlot[];
  compaction: Compaction;
  handoff: Handoff;
}

export interface HealthCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface CtxHealthReport {
  passed: number;
  total: number;
  score: number;
  checks: HealthCheck[];
}
