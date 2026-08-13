import type { Provider } from "@/lib/providers/types";

// The context pipeline supports the same provider set as the rest of the app.
export type CtxProvider = Provider;

export interface CtxModel {
  id: string;
  label: string;
  provider: CtxProvider;
  // Nominal context window in tokens. Drives the budget total + slider max.
  // Reference values, not contractual — Opus/Sonnet 1M, Haiku 200k; OpenAI /
  // Gemini windows are approximate and editable here as providers update them.
  window: number;
}

export const CTX_MODELS: Record<CtxProvider, CtxModel[]> = {
  anthropic: [
    { id: "claude-fable-5", label: "Claude Fable 5", provider: "anthropic", window: 1_000_000 },
    { id: "claude-opus-5", label: "Claude Opus 5", provider: "anthropic", window: 1_000_000 },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", window: 1_000_000 },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic", window: 1_000_000 },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", window: 1_000_000 },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", window: 200_000 },
  ],
  openai: [
    { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", window: 400_000 },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", provider: "openai", window: 256_000 },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", provider: "openai", window: 256_000 },
  ],
  google: [
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", provider: "google", window: 1_000_000 },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "google", window: 1_000_000 },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", provider: "google", window: 1_000_000 },
  ],
  // Windows below are reference values from each provider's docs — editable as
  // they change. IDs mirror src/lib/models.ts; confirm against GET /v1/models.
  xai: [
    { id: "grok-4.3", label: "Grok 4.3", provider: "xai", window: 1_000_000 },
    { id: "grok-4.20-0309-reasoning", label: "Grok 4.20 reasoning", provider: "xai", window: 1_000_000 },
    { id: "grok-4.20-0309-non-reasoning", label: "Grok 4.20 non-reasoning", provider: "xai", window: 1_000_000 },
  ],
  nvidia: [
    { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "nvidia", window: 128_000 },
    { id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1", provider: "nvidia", window: 128_000 },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B", provider: "nvidia", window: 128_000 },
  ],
  openrouter: [
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat (OR)", provider: "openrouter", window: 128_000 },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (OR)", provider: "openrouter", window: 128_000 },
    { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OR)", provider: "openrouter", window: 1_000_000 },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat", provider: "deepseek", window: 128_000 },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", provider: "deepseek", window: 128_000 },
  ],
};

export const ALL_CTX_MODELS: CtxModel[] = [
  ...CTX_MODELS.anthropic,
  ...CTX_MODELS.openai,
  ...CTX_MODELS.google,
  ...CTX_MODELS.xai,
  ...CTX_MODELS.nvidia,
  ...CTX_MODELS.openrouter,
  ...CTX_MODELS.deepseek,
];

export const DEFAULT_CTX_MODEL = "claude-sonnet-5";

export function findCtxModel(id: string): CtxModel {
  return ALL_CTX_MODELS.find((m) => m.id === id) ?? CTX_MODELS.anthropic[1];
}

export function modelWindow(id: string): number {
  return findCtxModel(id).window;
}
