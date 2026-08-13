"use client";
import { DEFAULT_CTX_MODEL } from "@/lib/context-pipeline/models";
import type {
  CtxState,
  SourceKey,
  EvictionTrigger,
  CompactionMethod,
  SalienceBias,
  SurgicalTrim,
  HandoffFormat,
} from "@/lib/context-pipeline/types";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function initialState(): CtxState {
  return {
    model: DEFAULT_CTX_MODEL,
    sources: {
      pinned: { enabled: true, tokens: 30000 },
      retrieved: { enabled: true, tokens: 50000 },
      scratchpad: { enabled: true, tokens: 20000 },
      history: { enabled: true, tokens: 60000 },
      shared_store: { enabled: false, tokens: 0 },
      user_prefs: { enabled: false, tokens: 0 },
    },
    output: 20000,
    eviction: { trigger: "token_threshold", threshold: 0.85, turnLimit: null },
    pinnedSlots: [
      { id: uid(), label: "System prompt + tool definitions", tokens: 8000 },
      { id: uid(), label: "Safety constraints", tokens: 1000 },
      { id: uid(), label: "Decision log + open tasks", tokens: 3000 },
    ],
    compaction: { method: "summarize", salience: "entity_ids", surgical: "strip_payloads" },
    handoff: { format: "summary", writeScratchpad: true, writeRetrieved: false, writeFinalAnswer: true },
  };
}

export type CtxAction =
  | { type: "load"; state: CtxState }
  | { type: "reset" }
  | { type: "setModel"; model: string }
  | { type: "toggleSource"; key: SourceKey }
  | { type: "setSourceTokens"; key: SourceKey; tokens: number }
  | { type: "setOutput"; tokens: number }
  | { type: "setEvictionTrigger"; trigger: EvictionTrigger }
  | { type: "setThreshold"; value: number }
  | { type: "setTurnLimit"; value: number | null }
  | { type: "addPinnedSlot" }
  | { type: "updatePinnedSlot"; id: string; label?: string; tokens?: number }
  | { type: "removePinnedSlot"; id: string }
  | { type: "setCompactionMethod"; value: CompactionMethod }
  | { type: "setSalience"; value: SalienceBias }
  | { type: "setSurgical"; value: SurgicalTrim }
  | { type: "setHandoffFormat"; value: HandoffFormat }
  | { type: "toggleWrite"; field: "writeScratchpad" | "writeRetrieved" | "writeFinalAnswer" };

export function ctxReducer(state: CtxState, action: CtxAction): CtxState {
  switch (action.type) {
    case "load":
      return action.state;
    case "reset":
      return initialState();
    case "setModel":
      return { ...state, model: action.model };
    case "toggleSource": {
      const s = state.sources[action.key];
      return {
        ...state,
        sources: { ...state.sources, [action.key]: { ...s, enabled: !s.enabled } },
      };
    }
    case "setSourceTokens":
      return {
        ...state,
        sources: {
          ...state.sources,
          [action.key]: { ...state.sources[action.key], tokens: Math.max(0, action.tokens) },
        },
      };
    case "setOutput":
      return { ...state, output: Math.max(0, action.tokens) };
    case "setEvictionTrigger":
      return { ...state, eviction: { ...state.eviction, trigger: action.trigger } };
    case "setThreshold":
      return { ...state, eviction: { ...state.eviction, threshold: action.value } };
    case "setTurnLimit":
      return { ...state, eviction: { ...state.eviction, turnLimit: action.value } };
    case "addPinnedSlot":
      return {
        ...state,
        pinnedSlots: [...state.pinnedSlots, { id: uid(), label: "New pinned slot", tokens: 1000 }],
      };
    case "updatePinnedSlot":
      return {
        ...state,
        pinnedSlots: state.pinnedSlots.map((p) =>
          p.id === action.id
            ? {
                ...p,
                label: action.label !== undefined ? action.label : p.label,
                tokens: action.tokens !== undefined ? Math.max(0, action.tokens) : p.tokens,
              }
            : p,
        ),
      };
    case "removePinnedSlot":
      return { ...state, pinnedSlots: state.pinnedSlots.filter((p) => p.id !== action.id) };
    case "setCompactionMethod":
      return { ...state, compaction: { ...state.compaction, method: action.value } };
    case "setSalience":
      return { ...state, compaction: { ...state.compaction, salience: action.value } };
    case "setSurgical":
      return { ...state, compaction: { ...state.compaction, surgical: action.value } };
    case "setHandoffFormat":
      return { ...state, handoff: { ...state.handoff, format: action.value } };
    case "toggleWrite":
      return { ...state, handoff: { ...state.handoff, [action.field]: !state.handoff[action.field] } };
  }
}

export function hasAnyContent(s: CtxState): boolean {
  const init = initialState();
  return JSON.stringify({ ...s, pinnedSlots: s.pinnedSlots.map((p) => [p.label, p.tokens]) }) !==
    JSON.stringify({ ...init, pinnedSlots: init.pinnedSlots.map((p) => [p.label, p.tokens]) });
}
