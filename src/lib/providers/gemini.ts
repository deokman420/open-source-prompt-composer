import type { ProviderResult } from "./anthropic";
import type { ChatMessage } from "./types";
import { ProviderHttpError } from "./errors";

export type GeminiCallArgs = {
  apiKey: string;
  system: string;
  user?: string;
  messages?: ChatMessage[];
  model?: string;
  maxTokens?: number;
  // Eval forces JSON; chat wants free-form prose. Defaults to JSON to preserve
  // existing eval behavior when callers don't ask.
  json?: boolean;
};

const DEFAULT_MODEL = "gemini-3.5-flash";

export async function callGemini(args: GeminiCallArgs): Promise<ProviderResult> {
  const model = args.model ?? DEFAULT_MODEL;
  const json = args.json ?? true;
  const turns: ChatMessage[] =
    args.messages ?? [{ role: "user", content: args.user ?? "" }];

  // Gemini's assistant role is "model"; there is no system role inside contents[].
  const contents = turns.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": args.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents,
      generationConfig: {
        maxOutputTokens: args.maxTokens ?? 1500,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new ProviderHttpError("google", res.status, await res.text());
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}
