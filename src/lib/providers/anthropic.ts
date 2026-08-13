import type { ChatMessage } from "./types";
import { ProviderHttpError } from "./errors";

export type AnthropicCallArgs = {
  apiKey: string;
  system: string;
  // Single-shot path (eval): one user string. Multi-turn path (chat): messages[].
  user?: string;
  messages?: ChatMessage[];
  model?: string;
  maxTokens?: number;
  // Cache the (large) system prefix so repeat turns don't re-bill it. BYOK —
  // the user pays input tokens every turn, so this matters for their bill.
  cacheSystem?: boolean;
  // Eval passes its per-mode JSON Schema. Applied only on models that support
  // structured outputs (see SUPPORTS_JSON_SCHEMA); everywhere else the schema is
  // ignored and the "return STRICT JSON" system instruction carries the format.
  jsonSchema?: Record<string, unknown>;
};

export type ProviderResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

// Last-resort fallback if a caller omits model. Sonnet, matching the system
// floor in lib/models.ts — callers normally pass an explicit model.
const DEFAULT_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

// Claude 5-series models think by default, and thinking tokens come out of the
// SAME max_tokens budget as the visible answer. A limit tuned against a 4.x
// model (1200-2500 here) can be spent entirely on thinking, returning truncated
// or empty text — which for the eval grader means unparseable JSON. So for these
// models we bound thinking with a low effort level (Opus 5 / Sonnet 5 stay
// strong there) and give the answer real headroom. 4.x models don't think unless
// asked, and Haiku 4.5 rejects `effort` outright, so they keep the plain shape.
const THINKS_BY_DEFAULT = new Set(["claude-opus-5", "claude-sonnet-5", "claude-fable-5"]);

// Structured outputs (output_config.format) constrain decoding to a JSON Schema,
// so the grader can't get preamble or a code fence around its JSON. Support is
// per-model, not universal — Sonnet 4.6 and Opus 4.7 don't have it, and sending
// the field to a model that doesn't support it is a 400. Hence an allow-list, and
// the "return STRICT JSON" instruction stays in every system prompt as the
// fallback for everything not on it (plus safeParseJson as the net below that).
const SUPPORTS_JSON_SCHEMA = new Set([
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-fable-5",
  "claude-opus-4-8",
  "claude-haiku-4-5-20251001",
]);

type OutputConfig = { effort?: string; format?: { type: "json_schema"; schema: unknown } };

// Both the thinking budget and the response format live under output_config, so
// they're built together — sending two output_config keys would drop one.
export function anthropicBudget(
  model: string,
  maxTokens: number,
  jsonSchema?: Record<string, unknown>
): { max_tokens: number; output_config?: OutputConfig } {
  const thinks = THINKS_BY_DEFAULT.has(model);
  const schema = jsonSchema && SUPPORTS_JSON_SCHEMA.has(model) ? jsonSchema : undefined;
  const output_config: OutputConfig = {};
  if (thinks) output_config.effort = "low";
  if (schema) output_config.format = { type: "json_schema", schema };
  return {
    max_tokens: thinks ? Math.max(maxTokens * 4, 8000) : maxTokens,
    ...(Object.keys(output_config).length ? { output_config } : {}),
  };
}

export async function callAnthropic(args: AnthropicCallArgs): Promise<ProviderResult> {
  const messages =
    args.messages ?? [{ role: "user" as const, content: args.user ?? "" }];
  const model = args.model ?? DEFAULT_MODEL;

  // Array form lets us attach cache_control to the stable system prefix.
  const system = args.cacheSystem
    ? [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }]
    : args.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": args.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...anthropicBudget(model, args.maxTokens ?? 1500, args.jsonSchema),
      system,
      messages,
    }),
  });

  if (!res.ok) {
    throw new ProviderHttpError("anthropic", res.status, await res.text());
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text =
    data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}
