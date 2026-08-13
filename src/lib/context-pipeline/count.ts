import type { Provider } from "@/lib/providers/types";

// Exact token counting for the Context Pipeline "measure" panel. Mirrors the
// shape of src/lib/providers/* (BYOK key in, fetch out) but counts instead of
// completes. Anthropic + Google expose dedicated count endpoints; OpenAI has no
// stable standalone counter, so we fall back to the chars÷4 estimate used
// elsewhere in the app and flag the result as approximate.

export interface CountArgs {
  provider: Provider;
  apiKey: string;
  model: string;
  text: string;
}

export interface CountResult {
  tokens: number;
  approximate: boolean;
}

const ANTHROPIC_VERSION = "2023-06-01";

function roughTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function countTokens(args: CountArgs): Promise<CountResult> {
  switch (args.provider) {
    case "anthropic":
      return countAnthropic(args);
    case "google":
      return countGoogle(args);
    // OpenAI and the OpenAI-compatible providers (xAI, NVIDIA, OpenRouter,
    // DeepSeek) have no stable standalone token counter — approximate.
    case "openai":
    case "xai":
    case "nvidia":
    case "openrouter":
    case "deepseek":
      return { tokens: roughTokens(args.text), approximate: true };
  }
}

async function countAnthropic(args: CountArgs): Promise<CountResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "x-api-key": args.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: args.text }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { input_tokens?: number };
  if (typeof data.input_tokens !== "number") {
    throw new Error("Anthropic count_tokens returned no input_tokens");
  }
  return { tokens: data.input_tokens, approximate: false };
}

async function countGoogle(args: CountArgs): Promise<CountResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    args.model,
  )}:countTokens`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": args.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: args.text }] }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as { totalTokens?: number };
  if (typeof data.totalTokens !== "number") {
    throw new Error("Gemini countTokens returned no totalTokens");
  }
  return { tokens: data.totalTokens, approximate: false };
}
