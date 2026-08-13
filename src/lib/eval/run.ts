"use client";

/**
 * Eval execution, browser-side.
 *
 * The hosted version ran on the server: it looked the user's key up in
 * Supabase, decrypted it with a master key, enforced a per-day quota, and
 * logged a hash of every prompt. None of that applies here — the key comes out
 * of the local vault, there is no quota because the user is paying their own
 * provider directly, and there is nobody to log to.
 */

import { callModel, ModelError } from "@/lib/client/model";
import { MODES, safeParseJson, type EvalMode } from "./modes";
import type { Provider } from "@/lib/providers/types";

export type EvalRunArgs = {
  provider: Provider;
  apiKey: string;
  model: string;
  mode: EvalMode;
  promptText: string;
  signal?: AbortSignal;
};

export type EvalRunResult = {
  raw: string;
  parsed: unknown;
  parseError: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  promptSha256: string;
};

/**
 * SHA-256 via WebCrypto.
 *
 * The server version used node:crypto synchronously. Kept (async) because the
 * hash is what lets eval history dedupe repeated runs of the same prompt
 * without storing the prompt twice — it is not, here, an audit trail.
 */
export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class EvalNoKeyError extends Error {
  constructor(public provider: Provider) {
    super(`No ${provider} API key saved. Add one in Settings → API keys.`);
    this.name = "EvalNoKeyError";
  }
}

export async function runEval(args: EvalRunArgs): Promise<EvalRunResult> {
  const spec = MODES[args.mode];
  if (!spec) throw new Error(`Unknown eval mode: ${args.mode}`);
  if (!args.apiKey) throw new EvalNoKeyError(args.provider);

  const result = await callModel({
    provider: args.provider,
    apiKey: args.apiKey,
    model: args.model,
    system: spec.system,
    user: spec.user(args.promptText),
    maxTokens: spec.maxTokens,
    json: true,
    jsonSchema: spec.jsonSchema,
    signal: args.signal,
  });

  // Models ignore "return strict JSON" often enough that the tolerant parser
  // earns its keep — it strips fences and pulls the first balanced object out
  // of surrounding prose. A parse failure is reported, not thrown: the raw text
  // is still shown so the run isn't wasted.
  const { parsed, parseError } = safeParseJson(result.text);

  return {
    raw: result.text,
    parsed,
    parseError,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    promptSha256: await sha256(args.promptText),
  };
}

export { ModelError };
