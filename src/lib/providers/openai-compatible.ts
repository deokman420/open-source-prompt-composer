import type { ProviderResult } from "./anthropic";
import type { ChatMessage } from "./types";
import { ProviderHttpError } from "./errors";

// Shared adapter for every OpenAI-compatible provider (OpenAI itself, xAI/Grok,
// NVIDIA NIM, OpenRouter, DeepSeek). They all expose POST {baseUrl}/chat/completions
// with Bearer auth and identical request/response shapes — the only deltas are the
// base URL and the token-limit parameter name (GPT-5.x and xAI use
// `max_completion_tokens`; the others use the classic `max_tokens`). This file is
// the single source of truth for that call so the per-provider modules stay thin.

// Providers whose API is OpenAI-compatible. Kept as its own union (a subset of
// Provider) so the config map below is exhaustive and type-checked.
export type OAICompatId = "openai" | "xai" | "nvidia" | "openrouter" | "deepseek";

export type OAICompatConfig = {
  /** Which provider this config is for — used to label upstream errors. */
  id: OAICompatId;
  baseUrl: string; // no trailing slash; "/chat/completions" is appended
  tokenParam: "max_tokens" | "max_completion_tokens";
};

export const OPENAI_COMPAT: Record<OAICompatId, OAICompatConfig> = {
  openai: { id: "openai", baseUrl: "https://api.openai.com/v1", tokenParam: "max_completion_tokens" },
  xai: { id: "xai", baseUrl: "https://api.x.ai/v1", tokenParam: "max_completion_tokens" },
  nvidia: { id: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1", tokenParam: "max_tokens" },
  openrouter: { id: "openrouter", baseUrl: "https://openrouter.ai/api/v1", tokenParam: "max_tokens" },
  deepseek: { id: "deepseek", baseUrl: "https://api.deepseek.com/v1", tokenParam: "max_tokens" },
};

export type OpenAICompatCallArgs = {
  apiKey: string;
  system: string;
  user?: string;
  messages?: ChatMessage[];
  model?: string;
  maxTokens?: number;
  // Eval forces a JSON object; chat wants free-form prose. Defaults to JSON to
  // preserve existing eval behavior when callers don't ask.
  json?: boolean;
};

// OpenRouter uses these headers for app attribution / ranking; harmless on the
// other providers (they ignore unknown headers), so we always send them.
const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://prompt.phbeks.com",
  "X-Title": "Prompt Composer",
};

export async function callOpenAICompatible(
  args: OpenAICompatCallArgs,
  cfg: OAICompatConfig,
): Promise<ProviderResult> {
  const json = args.json ?? true;
  const turns: ChatMessage[] =
    args.messages ?? [{ role: "user", content: args.user ?? "" }];

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
      ...(cfg.baseUrl.includes("openrouter.ai") ? OPENROUTER_HEADERS : {}),
    },
    body: JSON.stringify({
      model: args.model,
      // GPT-5.x / xAI use max_completion_tokens; others use max_tokens.
      [cfg.tokenParam]: args.maxTokens ?? 1500,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: args.system }, ...turns],
    }),
  });

  if (!res.ok) {
    throw new ProviderHttpError(cfg.id, res.status, await res.text());
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}
