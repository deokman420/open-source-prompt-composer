// Hard validation for tool definitions. Shared by the live builder panel
// (validateToolDef, operating on typed state) and the server draft route
// (toolPayloadError, operating on an unknown JSON payload). Keeping both paths
// on the same helpers is what guarantees client/server parity — the server
// stays authoritative (see CLAUDE.md / plan §5, §8).
//
// v1.0 emits hard errors only. Soft "quality" tips (description length, missing
// param descriptions, vague names) are layered in separately in v1.1.

import { fullName } from "./serialize";
import {
  PARAM_KEY_RE,
  PARAM_TYPES,
  TOOL_NAME_RE,
  type ParamType,
  type ToolDef,
  type ToolParam,
} from "./types";

export interface ToolIssue {
  level: "error" | "warn";
  field: string; // dotted path, e.g. "name", "params.0.key"
  message: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---- example ↔ schema checking -------------------------------------------

function typeMatches(expected: ParamType, value: unknown): boolean {
  switch (expected) {
    case "string":
    case "enum":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isRecord(value);
  }
}

/**
 * Validate a single input example against the param rows. Mirrors what the API
 * checks for `input_examples` (invalid examples are rejected with a 400).
 */
function exampleIssues(params: ToolParam[], example: unknown, idx: number): ToolIssue[] {
  const out: ToolIssue[] = [];
  const field = `inputExamples.${idx}`;
  if (!isRecord(example)) {
    out.push({ level: "error", field, message: `Example ${idx + 1} must be an object.` });
    return out;
  }
  const byKey = new Map(params.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p]));
  // Required params present.
  for (const p of byKey.values()) {
    if (p.required && !(p.key.trim() in example)) {
      out.push({
        level: "error",
        field,
        message: `Example ${idx + 1} is missing required "${p.key.trim()}".`,
      });
    }
  }
  // Each provided key is known and type-correct.
  for (const [key, value] of Object.entries(example)) {
    const p = byKey.get(key);
    if (!p) {
      out.push({
        level: "error",
        field,
        message: `Example ${idx + 1} has unknown property "${key}".`,
      });
      continue;
    }
    if (!typeMatches(p.type, value)) {
      out.push({
        level: "error",
        field,
        message: `Example ${idx + 1}: "${key}" should be a ${p.type}.`,
      });
    }
    if (p.type === "enum" && typeof value === "string" && !(p.enumValues ?? []).includes(value)) {
      out.push({
        level: "error",
        field,
        message: `Example ${idx + 1}: "${key}" must be one of ${(p.enumValues ?? []).join(", ")}.`,
      });
    }
  }
  return out;
}

// ---- core hard validation -------------------------------------------------

/** Hard errors for a typed ToolDef (used by the live builder panel). */
export function validateToolDef(def: ToolDef): ToolIssue[] {
  const issues: ToolIssue[] = [];

  // name (after namespace folding)
  const name = fullName(def);
  if (!name) {
    issues.push({ level: "error", field: "name", message: "Tool name is required." });
  } else if (!TOOL_NAME_RE.test(name)) {
    issues.push({
      level: "error",
      field: "name",
      message: `Name "${name}" must match ^[a-zA-Z0-9_-]{1,64}$ (letters, digits, _ and - only; ≤64 chars).`,
    });
  }

  if (!(def.description || "").trim()) {
    issues.push({ level: "error", field: "description", message: "Description is required." });
  }

  // params
  const seen = new Set<string>();
  def.params.forEach((p, i) => {
    const key = (p.key || "").trim();
    const base = `params.${i}`;
    if (!key) {
      issues.push({ level: "error", field: `${base}.key`, message: `Parameter ${i + 1} needs a name.` });
    } else {
      if (!PARAM_KEY_RE.test(key)) {
        issues.push({
          level: "error",
          field: `${base}.key`,
          message: `Parameter "${key}" must start with a letter/underscore and contain only letters, digits, underscores.`,
        });
      }
      if (seen.has(key)) {
        issues.push({ level: "error", field: `${base}.key`, message: `Duplicate parameter "${key}".` });
      }
      seen.add(key);
    }
    if (!(PARAM_TYPES as readonly string[]).includes(p.type)) {
      issues.push({ level: "error", field: `${base}.type`, message: `Parameter "${key}" has an invalid type.` });
    }
    if (p.type === "enum" && !(p.enumValues ?? []).filter((v) => v.trim()).length) {
      issues.push({ level: "error", field: `${base}.enum`, message: `Enum "${key}" needs at least one value.` });
    }
    if (p.type === "array" && !p.itemType) {
      issues.push({ level: "error", field: `${base}.itemType`, message: `Array "${key}" needs an item type.` });
    }
  });

  // input examples (if any) must validate against the built schema
  (def.inputExamples ?? []).forEach((ex, i) => {
    issues.push(...exampleIssues(def.params, ex, i));
  });

  return issues;
}

// ---- server entry point ---------------------------------------------------

/**
 * Coerce an unknown stored payload into a ToolDef-shaped object for validation.
 * Defensive: anything malformed becomes an error string rather than throwing.
 */
function coerce(payload: unknown): ToolDef | string {
  if (!isRecord(payload)) return "payload must be an object";
  if (typeof payload.name !== "string") return 'tool "name" must be a string';
  if ("namespace" in payload && typeof payload.namespace !== "string") {
    return 'tool "namespace" must be a string';
  }
  if (typeof payload.description !== "string") return 'tool "description" must be a string';
  if (!Array.isArray(payload.params)) return 'tool "params" must be an array';
  for (let i = 0; i < payload.params.length; i++) {
    const p = payload.params[i];
    if (!isRecord(p)) return `param ${i + 1} must be an object`;
    if (typeof p.key !== "string") return `param ${i + 1} "key" must be a string`;
    if (typeof p.type !== "string") return `param ${i + 1} "type" must be a string`;
  }
  if ("inputExamples" in payload && !Array.isArray(payload.inputExamples)) {
    return 'tool "inputExamples" must be an array';
  }
  return payload as unknown as ToolDef;
}

/**
 * Server-side hard validation. Returns the first error string (matching the
 * `validatePayload` contract in lib/drafts.ts) or null when the payload is a
 * persistable tool definition.
 */
export function toolPayloadError(payload: unknown): string | null {
  const def = coerce(payload);
  if (typeof def === "string") return def;
  const errs = validateToolDef(def).filter((i) => i.level === "error");
  return errs.length ? errs[0].message : null;
}

/** Label for the drafts list: the folded tool name, else a description snippet. */
export function toolLabel(payload: Record<string, unknown>): string {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const ns = typeof payload.namespace === "string" ? payload.namespace.trim() : "";
  if (name) return (ns ? `${ns}_${name}` : name).slice(0, 60);
  const desc = typeof payload.description === "string" ? payload.description.trim() : "";
  return (desc || "(unnamed tool)").slice(0, 60);
}
