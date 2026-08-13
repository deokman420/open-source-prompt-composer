import { ORCH_AGENT_SLOTS, type Agent, type AgentKind, type AgentSlot } from "./types";

let _seq = 0;
function uid(): string {
  // Mirror vanilla site's short id but deterministic when needed.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "a" + crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  }
  _seq += 1;
  return "a" + _seq.toString(36);
}

export function mkAgent(
  kind: AgentKind,
  name: string,
  slots?: Partial<Record<AgentSlot, string>>,
): Agent {
  const empty = Object.fromEntries(
    ORCH_AGENT_SLOTS.map((s) => [s, ""]),
  ) as Record<AgentSlot, string>;
  return {
    id: uid(),
    kind,
    name,
    collapsed: false,
    slots: { ...empty, ...(slots ?? {}) },
  };
}

export function slotPlaceholder(slot: AgentSlot): string {
  switch (slot) {
    case "role":
      return "Who this agent is.";
    case "goal":
      return "Single outcome, verb-first.";
    case "context":
      return "Facts this agent needs that won't be in the brief.";
    case "bounds":
      return "What this agent must not do.";
    case "task":
      return "Concrete steps.";
    case "success":
      return "Checkable result shape.";
    case "tools":
      return "Allowed tools / APIs.";
    case "format":
      return "Output shape (markdown / JSON / table).";
  }
}
