/**
 * Shared provider types.
 *
 * In the hosted build this lived in `lib/keys.ts` alongside the Supabase-backed
 * key store, which made every importer drag in server-only code. Here the key
 * store is the browser vault, so `Provider` belongs with the adapters — this
 * module is client-safe and has no imports at all.
 */

export type Provider =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "nvidia"
  | "openrouter"
  | "deepseek";

export const PROVIDERS: Provider[] = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "nvidia",
  "openrouter",
  "deepseek",
];

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

/** Multi-turn chat shape. Single-shot callers pass `system` + `user` strings. */
export type ChatMessage = { role: "user" | "assistant"; content: string };
