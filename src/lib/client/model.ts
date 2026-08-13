"use client";

/**
 * Browser-side model client.
 *
 * Every feature page calls the model through here. The key is read from the
 * decrypted vault at call time and sent in the request body to /api/proxy,
 * which forwards it upstream and keeps nothing.
 *
 * The key is never placed in a URL, a query string, or a header the browser
 * would log or a referrer would leak — request body only.
 */

import type { ChatMessage, Provider } from "@/lib/providers/types";

export type ModelRequest = {
  provider: Provider;
  apiKey: string;
  model?: string;
  system?: string;
  /** Single-shot. Mutually exclusive with `messages`. */
  user?: string;
  /** Multi-turn. Mutually exclusive with `user`. */
  messages?: ChatMessage[];
  maxTokens?: number;
  /** Ask the provider for a JSON object. Defaults to the adapter's behavior. */
  json?: boolean;
  /** Anthropic only — cache the (large) system prefix across turns. */
  cacheSystem?: boolean;
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type ModelUsage = { inputTokens: number | null; outputTokens: number | null };

export type ModelResponse = {
  text: string;
  model: string;
  provider: Provider;
  usage: ModelUsage;
};

/**
 * A failed model call, carrying the HTTP status so callers can distinguish a
 * bad key (400) from rate-limiting (429) from an upstream outage (502) without
 * string-matching the message.
 */
export class ModelError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ModelError";
  }
}

function buildBody(req: ModelRequest, stream: boolean) {
  const { signal: _signal, ...rest } = req;
  return JSON.stringify({ ...rest, stream });
}

async function errorFrom(res: Response): Promise<ModelError> {
  let message = `Request failed (HTTP ${res.status}).`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) message = data.error;
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  return new ModelError(message, res.status);
}

/** Single request, complete response. Used by eval and other one-shot paths. */
export async function callModel(req: ModelRequest): Promise<ModelResponse> {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: buildBody(req, false),
    signal: req.signal,
  });

  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as ModelResponse;
}

/**
 * Streaming request. `onText` fires per delta; resolves with final usage.
 *
 * The proxy normalizes every provider to NDJSON, so this parser is
 * provider-independent. Errors raised after the stream opens arrive as a final
 * `{type:"error"}` frame rather than an HTTP status — hence the in-band check.
 */
export async function streamModel(
  req: ModelRequest,
  onText: (delta: string) => void
): Promise<ModelResponse> {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: buildBody(req, true),
    signal: req.signal,
  });

  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ModelError("The server returned no response body.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: ModelUsage = { inputTokens: null, outputTokens: null };
  let model = req.model ?? "";

  const handle = (line: string) => {
    if (!line.trim()) return;
    let frame: { type?: string; text?: string; usage?: ModelUsage; model?: string; error?: string };
    try {
      frame = JSON.parse(line);
    } catch {
      return; // partial or malformed frame; skip
    }
    if (frame.type === "text" && frame.text) {
      text += frame.text;
      onText(frame.text);
    } else if (frame.type === "done") {
      if (frame.usage) usage = frame.usage;
      if (frame.model) model = frame.model;
    } else if (frame.type === "error") {
      throw new ModelError(frame.error ?? "The provider call failed.", 502);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      handle(line);
    }
  }
  handle(buffer); // trailing frame with no newline

  return { text, model, provider: req.provider, usage };
}
