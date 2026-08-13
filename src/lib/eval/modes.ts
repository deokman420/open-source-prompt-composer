// Pure, client-safe half of Eval: the per-mode prompts + JSON Schemas, and the
// tolerant JSON parser. No network, no storage, no environment access — which
// is what makes it unit-testable without a browser or an API key.

export type EvalMode = "spellcheck" | "optimize" | "codecheck" | "structure";
export const EVAL_MODES: EvalMode[] = ["spellcheck", "optimize", "codecheck", "structure"];

export const EVAL_MODE_LABELS: Record<EvalMode, string> = {
  spellcheck: "Spellcheck & grammar",
  optimize: "Rewrite for clarity",
  codecheck: "Validate code blocks",
  structure: "Score R-G-C-B-T-S",
};

export type ModeSpec = {
  system: string;
  user: (prompt: string) => string;
  maxTokens: number;
  // JSON Schema for the mode's response, mirroring the shape the system prompt
  // describes. Providers that support structured outputs decode against it, so
  // the grader physically cannot emit preamble or a code fence; the rest fall
  // back to the prompt instruction (and safeParseJson below that). Schemas are
  // written to the structured-output subset: every object carries `required` and
  // `additionalProperties: false`, and no min/max constraints.
  jsonSchema: Record<string, unknown>;
};

// Short helper so the schemas below read as shapes, not boilerplate.
function obj(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
const str = { type: "string" };

export const MODES: Record<EvalMode, ModeSpec> = {
  spellcheck: {
    system:
      "You are a copy editor for LLM prompts. Find typos, grammar errors, and spelling mistakes ONLY. Do not rewrite content or suggest structural changes. Return STRICT JSON with no prose before or after: " +
      '{"issues": [{"original": string, "suggestion": string, "reason": string}]}. ' +
      "Empty array if nothing to fix.",
    user: (p) => `Find issues in this prompt:\n\n<prompt>\n${p}\n</prompt>`,
    maxTokens: 1500,
    jsonSchema: obj({
      issues: {
        type: "array",
        items: obj({ original: str, suggestion: str, reason: str }),
      },
    }),
  },
  optimize: {
    system:
      "You are a prompt engineer. Rewrite the user's prompt for clarity, structure, and effectiveness WITHOUT changing the intent or scope. Use the R-G-C-B-T-S frame where it helps (Role, Goal, Context, Bounds, Task, Success). Return ONLY strict JSON — no prose, markdown, or code fences before or after: " +
      '{"rewritten": string, "changes": [{"what": string, "why": string}]}.',
    user: (p) => `Optimize this prompt:\n\n<prompt>\n${p}\n</prompt>`,
    maxTokens: 2500,
    jsonSchema: obj({
      rewritten: str,
      changes: { type: "array", items: obj({ what: str, why: str }) },
    }),
  },
  codecheck: {
    system:
      "You are a code reviewer. The user will give you a prompt that may contain code blocks (in any language). For each code block, validate: syntax errors, undefined symbols, obvious bugs, unsafe patterns. Return STRICT JSON: " +
      '{"blocks": [{"language": string, "issues": [{"line": number|null, "severity": "error"|"warning", "message": string}]}]}. ' +
      "If no code blocks, return blocks: [].",
    user: (p) => `Review code in this prompt:\n\n<prompt>\n${p}\n</prompt>`,
    maxTokens: 2000,
    jsonSchema: obj({
      blocks: {
        type: "array",
        items: obj({
          language: str,
          issues: {
            type: "array",
            items: obj({
              // Nullable line: a whole-block finding has no single line.
              line: { anyOf: [{ type: "integer" }, { type: "null" }] },
              severity: { type: "string", enum: ["error", "warning"] },
              message: str,
            }),
          },
        }),
      },
    }),
  },
  structure: {
    system:
      "You are a prompt-engineering judge. Score the prompt against the R-G-C-B-T-S rubric, each 0-100 (Role, Goal, Context, Bounds, Task, Success). Return STRICT JSON: " +
      '{"scores": {"role": number, "goal": number, "context": number, "bounds": number, "task": number, "success": number}, "overall": number, "feedback": string}. ' +
      "feedback is one to three sentences; no markdown.",
    user: (p) => `Score this prompt:\n\n<prompt>\n${p}\n</prompt>`,
    maxTokens: 1200,
    jsonSchema: obj({
      // 0-100 per slot. The structured-output subset has no numeric bounds, so
      // the range lives in the system prompt; the UI clamps on render.
      scores: obj({
        role: { type: "number" },
        goal: { type: "number" },
        context: { type: "number" },
        bounds: { type: "number" },
        task: { type: "number" },
        success: { type: "number" },
      }),
      overall: { type: "number" },
      feedback: str,
    }),
  },
};

// The response schema per mode, exported so it can be asserted against the
// structured-output subset without reaching into MODES.
export const EVAL_MODE_SCHEMAS: Record<EvalMode, Record<string, unknown>> = Object.fromEntries(
  Object.entries(MODES).map(([mode, spec]) => [mode, spec.jsonSchema]),
) as Record<EvalMode, Record<string, unknown>>;

/**
 * Rough token size of the fixed instructions we prepend per eval run, on the
 * user's own key — the largest mode's system string. Surfaced in the UI so BYOK
 * spend isn't a surprise. chars/4, matching the rest of the app; the user's own
 * prompt is extra on top. Tiny compared to AI Help's KB prefix.
 */
export const EVAL_SYSTEM_TOKENS_EST = Math.max(
  ...Object.values(MODES).map((m) => Math.round(m.system.length / 4)),
);

export function safeParseJson(text: string): { parsed: unknown; parseError: string | null } {
  // Strip ```json fences if the model added them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 1) Happy path: the whole thing is valid JSON.
  try {
    return { parsed: JSON.parse(cleaned), parseError: null };
  } catch (firstErr) {
    // 2) Models often emit the JSON object then trailing prose (or leading
    //    preamble). Extract the first balanced {…} or […] and parse just that.
    const slice = extractFirstJson(cleaned);
    if (slice && slice !== cleaned) {
      try {
        return { parsed: JSON.parse(slice), parseError: null };
      } catch {
        /* fall through to report the original error */
      }
    }
    return {
      parsed: null,
      parseError: firstErr instanceof Error ? firstErr.message : "parse failed",
    };
  }
}

// Returns the first balanced JSON object/array substring, scanning from the
// first `{` or `[` and tracking depth while ignoring braces inside strings.
// This tolerates trailing prose, preamble, and stray fences around the JSON.
function extractFirstJson(s: string): string | null {
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}
