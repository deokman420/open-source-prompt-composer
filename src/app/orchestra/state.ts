"use client";
import { mkAgent } from "@/lib/orchestra/agent";
import { ORCH_PATTERNS, DEFAULT_PATTERN, blankSeed } from "@/lib/orchestra/patterns";
import type {
  Agent,
  AgentModel,
  AgentSlot,
  HandoffFormat,
  OrchState,
  PatternId,
} from "@/lib/orchestra/types";

export type OrchAction =
  | { type: "load"; state: OrchState }
  | { type: "switchPattern"; pattern: PatternId }
  | { type: "newBlank" }
  | { type: "addWorker" }
  | { type: "deleteAgent"; idx: number }
  | { type: "renameAgent"; idx: number; name: string }
  | { type: "setAgentModel"; idx: number; model: AgentModel | null }
  | { type: "toggleCollapse"; idx: number }
  | { type: "setSlot"; idx: number; slot: AgentSlot; value: string }
  | { type: "setHandoff"; value: HandoffFormat }
  | { type: "setMaxWorkers"; value: number }
  | { type: "setTermination"; value: string }
  | { type: "setSharedMemory"; value: boolean };

export function orchReducer(state: OrchState, action: OrchAction): OrchState {
  switch (action.type) {
    case "load":
      return action.state;
    case "switchPattern":
      return ORCH_PATTERNS[action.pattern].seed();
    case "newBlank":
      return blankSeed();
    case "addWorker": {
      const workerN = state.agents.filter((a) => a.kind === "worker").length + 1;
      const next = mkAgent("worker", `Worker ${workerN}`, {});
      return { ...state, agents: [...state.agents, next] };
    }
    case "deleteAgent": {
      const agents = state.agents.filter((_, i) => i !== action.idx);
      return { ...state, agents };
    }
    case "renameAgent":
      return {
        ...state,
        agents: state.agents.map((a, i) => (i === action.idx ? { ...a, name: action.name } : a)),
      };
    case "setAgentModel":
      return {
        ...state,
        agents: state.agents.map((a, i) => {
          if (i !== action.idx) return a;
          if (action.model === null) {
            // Clear the override → agent inherits the export-time model again.
            const next = { ...a };
            delete next.model;
            return next;
          }
          return { ...a, model: action.model };
        }),
      };
    case "toggleCollapse":
      return {
        ...state,
        agents: state.agents.map((a, i) =>
          i === action.idx ? { ...a, collapsed: !a.collapsed } : a,
        ),
      };
    case "setSlot":
      return {
        ...state,
        agents: state.agents.map((a, i) => {
          if (i !== action.idx) return a;
          return { ...a, slots: { ...a.slots, [action.slot]: action.value } };
        }),
      };
    case "setHandoff":
      return { ...state, coordination: { ...state.coordination, handoffFormat: action.value } };
    case "setMaxWorkers":
      return { ...state, coordination: { ...state.coordination, maxWorkers: action.value } };
    case "setTermination":
      return { ...state, coordination: { ...state.coordination, terminationRule: action.value } };
    case "setSharedMemory":
      return { ...state, coordination: { ...state.coordination, sharedMemory: action.value } };
  }
}

export function hasAnyContent(s: OrchState): boolean {
  return s.agents.some((a: Agent) => Object.values(a.slots).some((v) => v && v.trim()));
}

export function initialState(): OrchState {
  return ORCH_PATTERNS[DEFAULT_PATTERN].seed();
}
