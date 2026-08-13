import type {
  CtxState,
  EvictionTrigger,
  CompactionMethod,
  SalienceBias,
  SurgicalTrim,
  HandoffFormat,
} from "./types";
import { SOURCE_KEYS, SOURCE_META } from "./types";
import { enabledSources, totalAllocated, windowFor, headroom, fmtK } from "./budget";
import { findCtxModel } from "./models";
import { OPENAI_COMPAT, type OAICompatId } from "@/lib/providers/openai-compatible";

export type CtxTargetKey =
  | "spec-md"
  | "spec-xml"
  | "langgraph-python"
  | "n8n-json"
  | "raw-python"
  | "raw-ts";

export interface CtxTarget {
  key: CtxTargetKey;
  group: "spec" | "scaffold";
  label: string;
  lang: "markdown" | "xml" | "python" | "typescript" | "json";
}

export const CTX_TARGETS: CtxTarget[] = [
  { key: "spec-md", group: "spec", label: "Context spec · Markdown", lang: "markdown" },
  { key: "spec-xml", group: "spec", label: "Context spec · XML", lang: "xml" },
  { key: "langgraph-python", group: "scaffold", label: "LangGraph · Python", lang: "python" },
  { key: "n8n-json", group: "scaffold", label: "n8n workflow JSON", lang: "json" },
  { key: "raw-python", group: "scaffold", label: "Raw API · Python", lang: "python" },
  { key: "raw-ts", group: "scaffold", label: "Raw API · TypeScript", lang: "typescript" },
];

const TRIGGER_LABEL: Record<EvictionTrigger, string> = {
  token_threshold: "token threshold (0.85× window)",
  turn_count: "turn count",
  manual: "manual",
  never: "never",
};
const METHOD_LABEL: Record<CompactionMethod, string> = {
  summarize: "summarize N→1",
  drop_oldest: "drop oldest",
  none: "none",
};
const SALIENCE_LABEL: Record<SalienceBias, string> = {
  entity_ids: "active entity IDs",
  recency: "recency",
  none: "none",
};
const SURGICAL_LABEL: Record<SurgicalTrim, string> = {
  strip_payloads: "strip verbose payloads",
  full_turns: "full turns",
  none: "none",
};
const HANDOFF_LABEL: Record<HandoffFormat, string> = {
  summary: "summary",
  json: "structured JSON",
  transcript: "full transcript",
};

function triggerDetail(state: CtxState): string {
  const t = state.eviction.trigger;
  if (t === "token_threshold") return `token threshold (${state.eviction.threshold}× window)`;
  if (t === "turn_count") return `turn count (> ${state.eviction.turnLimit ?? "N"})`;
  return TRIGGER_LABEL[t];
}

function sharedWrites(state: CtxState): string[] {
  const w: string[] = [];
  if (state.handoff.writeScratchpad) w.push("scratchpad state → key/value");
  if (state.handoff.writeRetrieved) w.push("retrieved chunks");
  if (state.handoff.writeFinalAnswer) w.push("final answer → append log");
  return w;
}

// ---------- Spec: Markdown ----------
export function renderSpecMd(state: CtxState): string {
  const model = findCtxModel(state.model);
  const win = windowFor(state);
  const lines: string[] = [];
  lines.push("# Context pipeline spec", "");
  lines.push("## Sources", "");
  lines.push("| Source | Enabled | Allocated |", "|---|---|---|");
  for (const k of SOURCE_KEYS) {
    const s = state.sources[k];
    lines.push(`| ${SOURCE_META[k].name} | ${s.enabled ? "yes" : "no"} | ${s.enabled ? fmtK(s.tokens) : "—"} |`);
  }
  lines.push("");
  lines.push("## Token budget", "");
  lines.push(`- Model: \`${model.id}\` (${model.label})`);
  lines.push(`- Window: ${fmtK(win)}`);
  lines.push(`- Allocated: ${fmtK(totalAllocated(state))} (incl. ${fmtK(state.output)} output reserve)`);
  lines.push(`- Headroom: ${fmtK(headroom(state))}`);
  lines.push("");
  lines.push("## Eviction rules", "");
  lines.push(`- Trigger: ${triggerDetail(state)}`);
  lines.push("- Pinned (never evicted):");
  for (const p of state.pinnedSlots) lines.push(`  - ${p.label} — ${fmtK(p.tokens)}`);
  lines.push(
    `- Compaction: ${METHOD_LABEL[state.compaction.method]} · salience ${SALIENCE_LABEL[state.compaction.salience]} · trim ${SURGICAL_LABEL[state.compaction.surgical]}`,
  );
  lines.push("");
  lines.push("## Handoff", "");
  lines.push(`- Format: ${HANDOFF_LABEL[state.handoff.format]}`);
  const writes = sharedWrites(state);
  lines.push(`- Shared-store writes: ${writes.length ? writes.join("; ") : "none"}`);
  return lines.join("\n");
}

// ---------- Spec: XML ----------
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function renderSpecXml(state: CtxState): string {
  const model = findCtxModel(state.model);
  const lines: string[] = [];
  lines.push(`<context_pipeline model="${esc(model.id)}" window="${windowFor(state)}">`);
  lines.push("  <sources>");
  for (const k of SOURCE_KEYS) {
    const s = state.sources[k];
    lines.push(`    <source key="${k}" enabled="${s.enabled}" tokens="${s.tokens}"/>`);
  }
  lines.push("  </sources>");
  lines.push(`  <output_reserve tokens="${state.output}"/>`);
  lines.push("  <eviction>");
  lines.push(`    <trigger>${esc(triggerDetail(state))}</trigger>`);
  lines.push("    <pinned>");
  for (const p of state.pinnedSlots) {
    lines.push(`      <slot tokens="${p.tokens}">${esc(p.label)}</slot>`);
  }
  lines.push("    </pinned>");
  lines.push(
    `    <compaction method="${state.compaction.method}" salience="${state.compaction.salience}" surgical="${state.compaction.surgical}"/>`,
  );
  lines.push("  </eviction>");
  lines.push(`  <handoff format="${state.handoff.format}">`);
  lines.push(`    <write_scratchpad>${state.handoff.writeScratchpad}</write_scratchpad>`);
  lines.push(`    <write_retrieved>${state.handoff.writeRetrieved}</write_retrieved>`);
  lines.push(`    <write_final_answer>${state.handoff.writeFinalAnswer}</write_final_answer>`);
  lines.push("  </handoff>");
  lines.push("</context_pipeline>");
  return lines.join("\n");
}

// ---------- shared budget dict ----------
function pyBudget(state: CtxState): string {
  const rows = enabledSources(state)
    .map((k) => `    "${k}": ${state.sources[k].tokens},`)
    .join("\n");
  return `BUDGET = {\n${rows}\n    "output_reserve": ${state.output},\n}\nWINDOW = ${windowFor(state)}`;
}
function tsBudget(state: CtxState): string {
  const rows = enabledSources(state)
    .map((k) => `  ${k}: ${state.sources[k].tokens},`)
    .join("\n");
  return `const BUDGET = {\n${rows}\n  output_reserve: ${state.output},\n} as const;\nconst WINDOW = ${windowFor(state)};`;
}

const SCAFFOLD_HEADER =
  "framework scaffolding — budget values + control flow are wired as stubs.\nThis is NOT a complete implementation. Fill in build_context / should_evict /\ncompact_history with your real retrieval, storage, and summarization logic.";

// ---------- LangGraph · Python ----------
export function renderLangGraph(state: CtxState): string {
  const model = findCtxModel(state.model);
  return `"""
${SCAFFOLD_HEADER}
"""
from typing import TypedDict
from langgraph.graph import StateGraph, END

${pyBudget(state)}

EVICTION_TRIGGER = ${JSON.stringify(triggerDetail(state))}
THRESHOLD = ${state.eviction.threshold}
HANDOFF_FORMAT = ${JSON.stringify(state.handoff.format)}
MODEL = ${JSON.stringify(model.id)}


class CtxState(TypedDict):
    messages: list
    scratchpad: dict
    token_estimate: int


def build_context(state: CtxState) -> CtxState:
    # TODO: assemble context within BUDGET per source. Pinned slots never dropped.
    return state


def should_evict(state: CtxState) -> str:
    # TODO: real trigger. Stub uses the token-threshold rule.
    if state["token_estimate"] >= WINDOW * THRESHOLD:
        return "compact"
    return "call_model"


def compact_history(state: CtxState) -> CtxState:
    # TODO: ${state.compaction.method} · ${state.compaction.salience} · ${state.compaction.surgical}
    return state


def call_model(state: CtxState) -> CtxState:
    # TODO: call ${model.label} (${model.id}) with the assembled context.
    return state


graph = StateGraph(CtxState)
graph.add_node("build", build_context)
graph.add_node("compact", compact_history)
graph.add_node("call_model", call_model)
graph.set_entry_point("build")
graph.add_conditional_edges("build", should_evict, {"compact": "compact", "call_model": "call_model"})
graph.add_edge("compact", "call_model")
graph.add_edge("call_model", END)
app = graph.compile()
`;
}

// ---------- n8n workflow JSON (v1) ----------
export function renderN8n(state: CtxState): string {
  const model = findCtxModel(state.model);
  const budgetObj: Record<string, number> = { output_reserve: state.output };
  for (const k of enabledSources(state)) budgetObj[k] = state.sources[k].tokens;

  const workflow = {
    name: "Context pipeline (scaffold)",
    nodes: [
      {
        parameters: {
          notesInFlow: true,
          notes: "SCAFFOLD — wire real assembly/eviction logic into the Code nodes.",
          assignments: {
            assignments: [
              { id: "budget", name: "budget", type: "object", value: JSON.stringify(budgetObj) },
              { id: "window", name: "window", type: "number", value: windowFor(state) },
              { id: "model", name: "model", type: "string", value: model.id },
            ],
          },
        },
        id: "set-budget",
        name: "Budget constants",
        type: "n8n-nodes-base.set",
        typeVersion: 3.4,
        position: [240, 300],
      },
      {
        parameters: {
          jsCode:
            "// TODO: assemble context within $json.budget per source.\n// Pinned slots are never dropped. Return { context, tokenEstimate }.\nreturn items;",
        },
        id: "assemble",
        name: "Context assembly (stub)",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [460, 300],
      },
      {
        parameters: {
          jsCode: `// TODO: eviction — trigger: ${triggerDetail(state)}\n// compaction: ${state.compaction.method} / ${state.compaction.salience} / ${state.compaction.surgical}\nreturn items;`,
        },
        id: "evict",
        name: "Trim / eviction (stub)",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [680, 300],
      },
      {
        parameters: {
          method: "POST",
          url: providerEndpoint(model.id),
          options: {},
        },
        id: "call",
        name: "API call",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 4.2,
        position: [900, 300],
      },
    ],
    connections: {
      "Budget constants": { main: [[{ node: "Context assembly (stub)", type: "main", index: 0 }]] },
      "Context assembly (stub)": { main: [[{ node: "Trim / eviction (stub)", type: "main", index: 0 }]] },
      "Trim / eviction (stub)": { main: [[{ node: "API call", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
  return JSON.stringify(workflow, null, 2);
}

function providerEndpoint(modelId: string): string {
  const p = findCtxModel(modelId).provider;
  if (p === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (p === "openai") return "https://api.openai.com/v1/responses";
  if (p === "google")
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  // OpenAI-compatible providers (xAI, NVIDIA, OpenRouter, DeepSeek).
  return `${OPENAI_COMPAT[p as OAICompatId].baseUrl}/chat/completions`;
}

// ---------- Raw API · Python ----------
export function renderRawPython(state: CtxState): string {
  const model = findCtxModel(state.model);
  return `"""
${SCAFFOLD_HEADER}
"""
${pyBudget(state)}

EVICTION_TRIGGER = ${JSON.stringify(triggerDetail(state))}
THRESHOLD = ${state.eviction.threshold}
MODEL = ${JSON.stringify(model.id)}  # ${model.provider}


def build_context(messages, store):
    # TODO: assemble within BUDGET per source; never drop pinned slots.
    return messages


def should_evict(token_estimate):
    return token_estimate >= WINDOW * THRESHOLD


def compact_history(messages):
    # TODO: ${state.compaction.method} · ${state.compaction.salience} · ${state.compaction.surgical}
    return messages


def run(messages, store):
    ctx = build_context(messages, store)
    if should_evict(estimate_tokens(ctx)):
        ctx = compact_history(ctx)
    # TODO: call ${model.label} with ctx and a max_tokens of BUDGET["output_reserve"].
    return ctx


def estimate_tokens(messages) -> int:
    return sum(len(str(m)) for m in messages) // 4
`;
}

// ---------- Raw API · TypeScript ----------
export function renderRawTs(state: CtxState): string {
  const model = findCtxModel(state.model);
  return `/*
${SCAFFOLD_HEADER}
*/
${tsBudget(state)}

const EVICTION_TRIGGER = ${JSON.stringify(triggerDetail(state))};
const THRESHOLD = ${state.eviction.threshold};
const MODEL = ${JSON.stringify(model.id)}; // ${model.provider}

function buildContext(messages: unknown[], store: Record<string, unknown>): unknown[] {
  // TODO: assemble within BUDGET per source; never drop pinned slots.
  return messages;
}

function shouldEvict(tokenEstimate: number): boolean {
  return tokenEstimate >= WINDOW * THRESHOLD;
}

function compactHistory(messages: unknown[]): unknown[] {
  // TODO: ${state.compaction.method} · ${state.compaction.salience} · ${state.compaction.surgical}
  return messages;
}

export async function run(messages: unknown[], store: Record<string, unknown>) {
  let ctx = buildContext(messages, store);
  if (shouldEvict(estimateTokens(ctx))) ctx = compactHistory(ctx);
  // TODO: call ${model.label} with ctx; max_tokens = BUDGET.output_reserve.
  return ctx;
}

function estimateTokens(messages: unknown[]): number {
  return Math.ceil(messages.reduce((n, m) => n + String(m).length, 0) / 4);
}
`;
}

export function renderCtxExport(key: CtxTargetKey, state: CtxState): string {
  switch (key) {
    case "spec-md":
      return renderSpecMd(state);
    case "spec-xml":
      return renderSpecXml(state);
    case "langgraph-python":
      return renderLangGraph(state);
    case "n8n-json":
      return renderN8n(state);
    case "raw-python":
      return renderRawPython(state);
    case "raw-ts":
      return renderRawTs(state);
  }
}
