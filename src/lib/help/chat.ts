import type { ChatMessage } from "@/lib/providers/types";
import { KB_MARKDOWN } from "./kb";

export const HELP_MAX_TOKENS = 1200;
export const MAX_TURNS = 20; // messages in a single request (user+assistant)
export const MAX_MESSAGE_CHARS = 6_000; // per message
export const MAX_TOTAL_CHARS = 24_000; // whole transcript

// ─────────────────────────────────────────────────────────────────────────────
// System pre-context.
//
// TODO(refine-system-prompt): this is a deliberately generic, best-practice v1.
// Revisit once we see real transcripts — tune refusal boundaries, the "cite your
// source" instruction, tone, and how aggressively it should push users toward the
// matching tool (/eval, /tools, /context-pipeline). Consider A/B-ing length.
// ─────────────────────────────────────────────────────────────────────────────
const PERSONA = `You are the AI Help assistant for Prompt Composer, an open-source,
local-first toolkit for writing, structuring, and evaluating prompts and
multi-agent systems.

Your job: answer the user's questions about (a) how this app works and (b) context
engineering and prompt engineering. You are a calm, precise, technically fluent
helpdesk — concise by default, expanding only when the user asks for depth.

Rules:
- Ground every answer in the KNOWLEDGE BASE below. It is your source of truth for
  how the app works and for prompt-engineering techniques.
- When you state a prompt-engineering technique or claim, cite the source named in
  the KB (e.g. "Wei et al. 2022" or "Anthropic — Building effective agents") so the
  user can read further. Do not invent citations.
- If the answer isn't in the KB and you're not confident, say so plainly and point
  the user to the relevant page. Never fabricate app behavior, limits, or features.
- When a question maps to a tool, name the tool and its route: Compose /compose,
  Orchestra /orchestra, Context Pipeline /context-pipeline, Tool Builder /tools,
  Loops /loops, AI Eval /eval, Drafts /drafts, Settings /settings.
- This app has no accounts, no subscription, and no server-side storage. There is
  nothing to cancel and no billing to manage. If asked about pricing or accounts,
  say the app is free and MIT-licensed, and that the only cost is what the user's
  own model provider charges them.
- Everything the user saves lives in their browser, encrypted at rest if they set
  a passphrase in Settings. There is no password reset and no recovery: if they
  lose the passphrase the vault cannot be opened. Say this plainly if asked.
- Be honest about cost: every AI-backed feature, including this chat, runs on the
  user's own API key, so provider spend is theirs.
- Format as plain prose. The UI renders your text verbatim, so do NOT use **bold**,
  # headers, or other Markdown — they show as literal characters. The ONE exception
  is links: write them as Markdown [label](url) where the label is a short, human
  readable description of the destination (e.g. [Chain-of-Thought paper, Wei et al.
  2022](https://arxiv.org/abs/2201.11903)). Short blank-line-separated paragraphs
  and "- " bullets are fine. Keep any code short.
- Stay on topic: the app and prompt/context engineering. Politely decline unrelated
  requests and redirect to what you can help with.`;

/**
 * The full system prompt: persona + the knowledge base. Pure; no I/O. Goes into
 * a cached provider prefix so repeat turns don't re-bill the (large) KB.
 */
export function buildSystemPrompt(): string {
  return `${PERSONA}\n\n===== KNOWLEDGE BASE =====\n\n${KB_MARKDOWN}`;
}

/**
 * Rough token size of the fixed pre-context (persona + KB) we prepend to EVERY
 * help turn, on the user's own key. Surfaced in the UI so BYOK spend isn't a
 * surprise. chars/4 — the same estimate the rest of the app uses; real counts
 * vary by tokenizer. Computed once from the static prompt so it can't drift as
 * the KB grows. The KB ships to the client in this build (the browser makes the
 * provider call), so importing this directly from a component is fine.
 */
export const HELP_SYSTEM_TOKENS_EST = Math.round(buildSystemPrompt().length / 4);

export type ValidatedMessages =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string };

/**
 * Validate an incoming chat transcript. Pure — safe to unit test. Enforces role
 * shape, non-empty content, per-message and total length caps, and that the last
 * message is from the user (we only ever respond to a user turn).
 */
export function validateMessages(raw: unknown): ValidatedMessages {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "messages must be a non-empty array" };
  }
  if (raw.length > MAX_TURNS) {
    return { ok: false, error: `too many messages (max ${MAX_TURNS})` };
  }

  const messages: ChatMessage[] = [];
  let total = 0;
  for (const m of raw) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "each message must be an object" };
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "each message role must be 'user' or 'assistant'" };
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, error: "each message needs non-empty string content" };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `a message exceeds ${MAX_MESSAGE_CHARS} chars` };
    }
    total += content.length;
    messages.push({ role, content });
  }

  if (total > MAX_TOTAL_CHARS) {
    return { ok: false, error: `transcript exceeds ${MAX_TOTAL_CHARS} chars` };
  }
  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, error: "the last message must be from the user" };
  }
  return { ok: true, messages };
}

// The provider call is made from the browser via lib/client/model.ts, which
// posts to the stateless /api/proxy. This module owns the prompt + validation
// only; there is no server-side key resolution or quota to own.
