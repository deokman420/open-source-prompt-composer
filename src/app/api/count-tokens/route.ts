import { NextRequest, NextResponse } from "next/server";
import { countTokens } from "@/lib/context-pipeline/count";
import { isProvider } from "@/lib/providers/types";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";

/**
 * Exact token counting for the Context Pipeline measure panel.
 *
 * Same stateless-proxy contract as /api/proxy: the key arrives in the request
 * body, is used for one upstream call, and is dropped. Nothing is stored or
 * logged. It exists for the same reason — Anthropic's and Google's count
 * endpoints reject browser origins.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_CHARS = 500_000;

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const extra = (process.env.PROMPT_COMPOSER_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return origin === new URL(req.url).origin || extra.includes(origin);
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json(
      { error: "cross-origin requests are not allowed" },
      { status: 403 }
    );
  }

  let body: { provider?: string; apiKey?: string; model?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const provider = body.provider;
  if (!isProvider(provider)) {
    return NextResponse.json(
      { error: "provider is missing or unrecognized" },
      { status: 400 }
    );
  }

  const text = body.text ?? "";
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: `text exceeds ${MAX_TEXT_CHARS} characters` },
      { status: 413 }
    );
  }

  const model =
    body.model && body.model.length > 0 ? body.model : DEFAULT_MODEL[provider];
  if (!isValidModel(provider, model)) {
    return NextResponse.json(
      { error: `model "${model}" is not a known ${provider} model` },
      { status: 400 }
    );
  }

  try {
    const result = await countTokens({
      provider,
      apiKey: body.apiKey ?? "",
      model,
      text,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Counting is a convenience, not the feature. A failed upstream call
    // shouldn't break the panel, so report the shape and let the client fall
    // back to its chars/4 estimate.
    console.error("count-tokens failed", {
      provider,
      name: err instanceof Error ? err.name : typeof err,
    });
    return NextResponse.json(
      { error: "Token counting failed. Falling back to an estimate." },
      { status: 502 }
    );
  }
}
