import { callAnthropic, ProviderResult } from "./anthropic";
import { callGemini } from "./gemini";
import { callOpenAICompatible, OPENAI_COMPAT } from "./openai-compatible";
import type { Provider } from "./types";
import type { ChatMessage } from "./types";

export type { ChatMessage } from "./types";

export type ProviderCallArgs = {
  provider: Provider;
  apiKey: string;
  system: string;
  // Single-shot (eval): pass `user`. Multi-turn (chat): pass `messages`.
  user?: string;
  messages?: ChatMessage[];
  model?: string;
  maxTokens?: number;
  // Chat sets json:false (free-form prose) and cacheSystem:true (cache the KB
  // prefix). Both default to the eval-compatible behavior when omitted.
  json?: boolean;
  cacheSystem?: boolean;
  // Anthropic-only for now: constrain decoding to this JSON Schema on models that
  // support structured outputs. Other adapters ignore it and keep using their
  // json_object / prompt-instruction path.
  jsonSchema?: Record<string, unknown>;
};

export async function callProvider(args: ProviderCallArgs): Promise<ProviderResult> {
  switch (args.provider) {
    case "anthropic":
      return callAnthropic(args);
    case "google":
      return callGemini(args);
    // All OpenAI-compatible providers share one adapter, differing only by base
    // URL + token-param (see OPENAI_COMPAT).
    case "openai":
    case "xai":
    case "nvidia":
    case "openrouter":
    case "deepseek":
      return callOpenAICompatible(args, OPENAI_COMPAT[args.provider]);
  }
}
