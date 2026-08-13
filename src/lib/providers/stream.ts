import type { Provider } from "./types";
import type { ChatMessage } from "./types";
import { OPENAI_COMPAT, type OAICompatId } from "./openai-compatible";
import { anthropicBudget } from "./anthropic";
import { ProviderHttpError } from "./errors";

// Streaming counterpart to callProvider. Used by AI Help chat so tokens arrive
// incrementally. Eval keeps using the non-streaming callProvider path.

export type StreamUsage = { inputTokens: number | null; outputTokens: number | null };

export type StreamArgs = {
  provider: Provider;
  apiKey: string;
  system: string;
  messages: ChatMessage[];
  model: string;
  maxTokens: number;
  cacheSystem?: boolean; // Anthropic only — cache the (large) system prefix
};

// What a single parsed SSE event contributes: some text, and/or token counts.
// Kept pure and exported so the per-provider mapping is unit-testable without
// any network.
export type StreamEvent = { text?: string; inputTokens?: number; outputTokens?: number };

export function interpretAnthropicEvent(evt: unknown): StreamEvent {
  const e = evt as {
    type?: string;
    delta?: { type?: string; text?: string };
    message?: { usage?: { input_tokens?: number } };
    usage?: { output_tokens?: number };
  };
  if (e?.type === "content_block_delta" && e.delta?.type === "text_delta") {
    return { text: e.delta.text ?? "" };
  }
  if (e?.type === "message_start" && e.message?.usage?.input_tokens != null) {
    return { inputTokens: e.message.usage.input_tokens };
  }
  if (e?.type === "message_delta" && e.usage?.output_tokens != null) {
    return { outputTokens: e.usage.output_tokens };
  }
  return {};
}

export function interpretOpenAIEvent(evt: unknown): StreamEvent {
  const e = evt as {
    choices?: Array<{ delta?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const out: StreamEvent = {};
  const content = e?.choices?.[0]?.delta?.content;
  if (typeof content === "string" && content) out.text = content;
  // Present only on the final chunk (stream_options.include_usage).
  if (e?.usage) {
    if (e.usage.prompt_tokens != null) out.inputTokens = e.usage.prompt_tokens;
    if (e.usage.completion_tokens != null) out.outputTokens = e.usage.completion_tokens;
  }
  return out;
}

export function interpretGeminiEvent(evt: unknown): StreamEvent {
  const e = evt as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const out: StreamEvent = {};
  const parts = e?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts.map((p) => p.text ?? "").join("");
    if (text) out.text = text;
  }
  if (e?.usageMetadata) {
    if (e.usageMetadata.promptTokenCount != null) out.inputTokens = e.usageMetadata.promptTokenCount;
    if (e.usageMetadata.candidatesTokenCount != null) out.outputTokens = e.usageMetadata.candidatesTokenCount;
  }
  return out;
}

type Interpreter = (evt: unknown) => StreamEvent;

const INTERPRETERS: Record<Provider, Interpreter> = {
  anthropic: interpretAnthropicEvent,
  google: interpretGeminiEvent,
  // Every OpenAI-compatible provider streams the same SSE chunk shape, so they
  // all reuse interpretOpenAIEvent.
  openai: interpretOpenAIEvent,
  xai: interpretOpenAIEvent,
  nvidia: interpretOpenAIEvent,
  openrouter: interpretOpenAIEvent,
  deepseek: interpretOpenAIEvent,
};

// Reads an SSE body and yields the payload after each `data:` line. Buffers
// across chunk boundaries so a JSON event split mid-stream is reassembled.
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload) yield payload;
      }
    }
  }
  const tail = buf.trim();
  if (tail.startsWith("data:")) {
    const payload = tail.slice(5).trim();
    if (payload) yield payload;
  }
}

// Exported for unit tests: lets the per-provider request shape (URL, token-param,
// headers, body) be asserted without opening a network connection.
export function buildRequest(args: StreamArgs): { url: string; init: RequestInit } {
  switch (args.provider) {
    case "anthropic": {
      const system = args.cacheSystem
        ? [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }]
        : args.system;
      return {
        url: "https://api.anthropic.com/v1/messages",
        init: {
          method: "POST",
          headers: {
            "x-api-key": args.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: args.model,
            // Same thinking-budget rule as the non-streaming path — see
            // anthropicBudget(). Thinking deltas are ignored by the interpreter
            // below, so only the answer reaches the user.
            ...anthropicBudget(args.model, args.maxTokens),
            system,
            messages: args.messages,
            stream: true,
          }),
        },
      };
    }
    // OpenAI + every OpenAI-compatible provider (xAI, NVIDIA, OpenRouter,
    // DeepSeek) share one request shape; only the base URL + token-param differ.
    case "openai":
    case "xai":
    case "nvidia":
    case "openrouter":
    case "deepseek": {
      const cfg = OPENAI_COMPAT[args.provider as OAICompatId];
      return {
        url: `${cfg.baseUrl}/chat/completions`,
        init: {
          method: "POST",
          headers: {
            Authorization: `Bearer ${args.apiKey}`,
            "content-type": "application/json",
            ...(args.provider === "openrouter"
              ? { "HTTP-Referer": "https://prompt.phbeks.com", "X-Title": "Prompt Composer" }
              : {}),
          },
          body: JSON.stringify({
            model: args.model,
            [cfg.tokenParam]: args.maxTokens,
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: "system", content: args.system }, ...args.messages],
          }),
        },
      };
    }
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          args.model
        )}:streamGenerateContent?alt=sse`,
        init: {
          method: "POST",
          headers: {
            "x-goog-api-key": args.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: args.system }] },
            contents: args.messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: args.maxTokens },
          }),
        },
      };
  }
}

/**
 * Stream a chat completion, invoking `onText` for each text delta as it arrives.
 * Resolves with the final token usage once the stream ends. Throws on a non-2xx
 * response (before any text is emitted).
 */
export async function streamProvider(
  args: StreamArgs,
  onText: (delta: string) => void
): Promise<StreamUsage> {
  const { url, init } = buildRequest(args);
  const res = await fetch(url, init);
  if (!res.ok || !res.body) {
    const text = res.ok ? "no response body" : await res.text();
    throw new ProviderHttpError(args.provider, res.status, text);
  }

  const interpret = INTERPRETERS[args.provider];
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for await (const payload of sseData(res.body)) {
    if (payload === "[DONE]") continue; // OpenAI terminator
    let evt: unknown;
    try {
      evt = JSON.parse(payload);
    } catch {
      continue; // ignore keep-alives / non-JSON lines
    }
    const e = interpret(evt);
    if (e.text) onText(e.text);
    if (e.inputTokens != null) inputTokens = e.inputTokens;
    if (e.outputTokens != null) outputTokens = e.outputTokens;
  }

  return { inputTokens, outputTokens };
}
