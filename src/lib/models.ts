import type { Provider } from "@/lib/providers/types";

export type ModelInfo = {
  id: string;
  label: string;
  note?: string;
  // Whether this model reliably honors response_format:{json_object} — the eval
  // grader requires it. Undefined means "yes" (the default for the original
  // three providers). Set false to mark a model chat-only: it appears in AI Help
  // and Context Pipeline but is hidden from / rejected by the eval grader.
  evalJson?: boolean;
};

// Curated model list per provider (Anthropic refreshed 2026-08: Opus 5 /
// Sonnet 5 / Fable 5 added, Opus 4.7 dropped). Eval defaults to the
// cheapest capable model; users can pick a stronger one. Keep IDs in sync
// with each provider's API — update here when models are deprecated.
//
// NOTE: the NVIDIA / OpenRouter IDs below are seeded against each provider's
// published model names and should still be confirmed against the live
// `GET {baseUrl}/v1/models` once a BYOK key is on file (see
// docs/BYOK_PROVIDER_KEYS.md and `scripts/verify-models.mjs`). xAI was
// reconciled with docs.x.ai on 2026-08 (grok-4.6 flagship; grok-4.5 / 4.3 /
// 4.20 family kept; grok-3/4 retired). The adapter/routing is ID-independent;
// only this list and context-pipeline/models.ts need updating when real IDs
// are confirmed.
export const PROVIDER_MODELS: Record<Provider, ModelInfo[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "fast · cheap" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "balanced · default" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "balanced · prev gen" },
    { id: "claude-opus-5", label: "Claude Opus 5", note: "most capable" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "capable · prev gen" },
    // Anthropic's frontier tier. Priced above Opus ($10/$50 per MTok) and it
    // requires 30-day data retention — an org on zero-data-retention gets a 400
    // on every request, which surfaces here as a provider error, not a bug.
    { id: "claude-fable-5", label: "Claude Fable 5", note: "frontier · premium price" },
  ],
  openai: [
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "fast · cheap" },
    { id: "gpt-5.5", label: "GPT-5.5", note: "flagship" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "cheapest" },
  ],
  google: [
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "fast" },
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", note: "most capable" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", note: "cheapest" },
  ],
  // NVIDIA / OpenRouter are chat-only by default (evalJson:false) until we
  // confirm json_object support per model. xAI (Grok) and DeepSeek support
  // strict JSON output, so they're eval-enabled out of the box.
  xai: [
    { id: "grok-4.6", label: "Grok 4.6", note: "flagship · recommended" },
    { id: "grok-4.5", label: "Grok 4.5", note: "prev gen" },
    { id: "grok-4.3", label: "Grok 4.3", note: "1M context · cheaper" },
    { id: "grok-4.20-0309-reasoning", label: "Grok 4.20 reasoning", note: "deep reasoning" },
    { id: "grok-4.20-0309-non-reasoning", label: "Grok 4.20 non-reasoning", note: "low latency" },
  ],
  nvidia: [
    { id: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", note: "general", evalJson: false },
    { id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1", note: "reasoning", evalJson: false },
    { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B", note: "NVIDIA-tuned", evalJson: false },
  ],
  openrouter: [
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat (OR)", note: "cheap", evalJson: false },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (OR)", note: "general", evalJson: false },
    { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OR)", note: "capable", evalJson: false },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat", note: "fast · cheap" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", note: "reasoning" },
  ],
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  // Sonnet (not Haiku) is the system floor: it's the safe starting point for a
  // cost-naive user who lands in AI Help/Eval before picking a model. Users can
  // override their personal default via account preferences (user_preferences).
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4-mini",
  google: "gemini-3.5-flash",
  xai: "grok-4.6",
  nvidia: "meta/llama-3.3-70b-instruct",
  openrouter: "deepseek/deepseek-chat",
  deepseek: "deepseek-chat",
};

// Human-facing provider names + display order. Centralized here (a client-safe
// module — keys.ts pulls in server-only db/crypto) so the eval, help, and keys
// UIs share one definition instead of drifting copies.
export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (GPT)",
  google: "Google (Gemini)",
  xai: "xAI (Grok)",
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

export const PROVIDER_ORDER: Provider[] = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "nvidia",
  "openrouter",
  "deepseek",
];

export function isValidModel(provider: Provider, model: string): boolean {
  return PROVIDER_MODELS[provider]?.some((m) => m.id === model) ?? false;
}

// Eval grader can only use models that honor JSON-object output. Defaults to
// true (the original providers); false is set explicitly on chat-only models.
export function supportsEvalJson(provider: Provider, model: string): boolean {
  const m = PROVIDER_MODELS[provider]?.find((x) => x.id === model);
  if (!m) return false;
  return m.evalJson ?? true;
}

// Models selectable in the eval grader (JSON-capable subset).
export function evalModels(provider: Provider): ModelInfo[] {
  return PROVIDER_MODELS[provider]?.filter((m) => m.evalJson ?? true) ?? [];
}

export function modelLabel(provider: Provider, model: string): string {
  return PROVIDER_MODELS[provider]?.find((m) => m.id === model)?.label ?? model;
}

// A user's saved default model preference (single global default — provider +
// model). Null model means "no preference set; use the system default".
export type ModelSelection = { provider: Provider; model: string };

// The system floor used when a user has no saved preference. Anthropic + Sonnet:
// capable, eval-ready, and a safer cost starting point than the cheapest model.
export const SYSTEM_DEFAULT_SELECTION: ModelSelection = {
  provider: "anthropic",
  model: DEFAULT_MODEL.anthropic,
};

// Resolve the initial model selection for AI Help. Help accepts any valid model,
// so an honored preference just needs to still exist in the catalog.
export function resolveHelpSelection(pref: ModelSelection | null): ModelSelection {
  if (pref && isValidModel(pref.provider, pref.model)) return pref;
  return SYSTEM_DEFAULT_SELECTION;
}

// Resolve the initial model selection for AI Eval. Eval only runs JSON-capable
// models, so a chat-only preference (or an unknown one) falls back to the system
// default rather than seeding the picker with a model the grader would reject.
export function resolveEvalSelection(pref: ModelSelection | null): ModelSelection {
  if (pref && supportsEvalJson(pref.provider, pref.model)) return pref;
  return SYSTEM_DEFAULT_SELECTION;
}
