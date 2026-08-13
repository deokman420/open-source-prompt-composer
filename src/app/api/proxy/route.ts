import { NextRequest, NextResponse } from "next/server";
import { callProvider } from "@/lib/providers";
import { streamProvider } from "@/lib/providers/stream";
import { describeProviderError } from "@/lib/providers/errors";
import { isProvider, type ChatMessage, type Provider } from "@/lib/providers/types";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";

/**
 * The one and only server-side surface in this app.
 *
 * It exists for exactly two reasons the browser can't solve on its own:
 *   1. CORS — most model providers reject browser-origin requests outright.
 *   2. Header control — some require headers browsers refuse to let JS set.
 *
 * What it deliberately does NOT do:
 *   - store the API key (it lives only in the request body, in RAM, for the
 *     life of the call)
 *   - log the key, the prompt, or the completion
 *   - keep any per-user state, session, cookie, or database row
 *
 * Restarting the server loses nothing, because it was holding nothing. That is
 * the whole security argument for the hosted deployment, and it is why this
 * file must stay boring: any `console.log(body)` added here would quietly turn
 * a zero-knowledge proxy into a key-harvesting one.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_CHARS = 200_000;

type ProxyBody = {
  provider?: string;
  apiKey?: string;
  system?: string;
  user?: string;
  messages?: ChatMessage[];
  model?: string;
  maxTokens?: number;
  json?: boolean;
  cacheSystem?: boolean;
  jsonSchema?: Record<string, unknown>;
  stream?: boolean;
};

/**
 * Refuse cross-origin calls.
 *
 * This proxy takes the key from the caller, so it can't be "abused" to spend
 * someone else's credit — but left wide open it's a free anonymizing relay in
 * front of every major model API, which is the kind of thing that gets a
 * deployment blocked. Same-origin only; self-hosters running from a different
 * origin can set PROMPT_COMPOSER_ALLOWED_ORIGINS.
 */
function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Non-browser callers (curl, a local script) send no Origin. Allow them:
  // there's no cookie or ambient authority here for a CSRF to ride on.
  if (!origin) return true;

  const extra = (process.env.PROMPT_COMPOSER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const self = new URL(req.url).origin;
  return origin === self || extra.includes(origin);
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) return bad("cross-origin requests are not allowed", 403);

  let body: ProxyBody;
  try {
    body = await req.json();
  } catch {
    return bad("invalid json");
  }

  const provider = body.provider;
  if (!isProvider(provider)) {
    return bad("provider is missing or unrecognized");
  }

  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey) {
    return bad("no API key supplied — add one in Settings → API keys");
  }

  // Default to the provider's cheapest capable model, and reject anything not
  // in our catalog. The base URLs are hard-coded per provider, so this isn't an
  // SSRF guard — it's here so a typo'd model surfaces as our clear error rather
  // than a raw upstream 404.
  const model = body.model && body.model.length > 0 ? body.model : DEFAULT_MODEL[provider];
  if (!isValidModel(provider, model)) {
    return bad(`model "${model}" is not a known ${provider} model`);
  }

  const system = body.system ?? "";
  const messages = body.messages;
  const user = body.user;
  if (!messages?.length && !user) {
    return bad("supply either `user` (single-shot) or `messages` (multi-turn)");
  }

  const size = JSON.stringify({ system, messages, user }).length;
  if (size > MAX_BODY_CHARS) {
    return bad(`request exceeds ${MAX_BODY_CHARS} characters`, 413);
  }

  const maxTokens = clampTokens(body.maxTokens);

  try {
    if (body.stream) {
      return streamResponse({
        provider,
        apiKey,
        system,
        messages: messages ?? [{ role: "user", content: user ?? "" }],
        model,
        maxTokens,
        cacheSystem: body.cacheSystem,
      });
    }

    const result = await callProvider({
      provider,
      apiKey,
      system,
      user,
      messages,
      model,
      maxTokens,
      json: body.json,
      cacheSystem: body.cacheSystem,
      jsonSchema: body.jsonSchema,
    });

    return NextResponse.json(
      {
        text: result.text,
        model,
        provider,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return providerFailure(err, provider);
  }
}

function clampTokens(requested: number | undefined): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) return 1500;
  return Math.min(Math.max(Math.floor(requested), 1), 64_000);
}

/**
 * Pipe provider SSE deltas to the browser as newline-delimited JSON.
 *
 * NDJSON rather than passing the upstream SSE through: each provider frames
 * its stream differently, and lib/providers/stream.ts already normalizes them.
 * The client gets one shape regardless of which provider it picked.
 */
function streamResponse(args: {
  provider: Provider;
  apiKey: string;
  system: string;
  messages: ChatMessage[];
  model: string;
  maxTokens: number;
  cacheSystem?: boolean;
}): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const usage = await streamProvider(args, (delta) => send({ type: "text", text: delta }));
        send({ type: "done", usage, model: args.model, provider: args.provider });
      } catch (err) {
        // The stream is already open, so an HTTP status is no longer available
        // to us — the error has to travel in-band as a final frame.
        const described = describeProviderError(err);
        send({
          type: "error",
          error: described?.message ?? "The provider call failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Defeats proxy buffering that would otherwise defer the whole stream.
      "X-Accel-Buffering": "no",
    },
  });
}

function providerFailure(err: unknown, provider: Provider) {
  const described = describeProviderError(err);
  if (described) {
    return NextResponse.json(
      { error: described.message, provider },
      { status: described.status }
    );
  }
  // Not a mapped upstream error — ours. Log the shape, never the payload:
  // the payload contains the user's prompt and, on some paths, their key.
  console.error(`proxy: unmapped ${provider} failure`, {
    name: err instanceof Error ? err.name : typeof err,
  });
  return NextResponse.json({ error: "The provider call failed." }, { status: 502 });
}
