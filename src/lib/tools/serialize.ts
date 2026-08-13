// Project an editable ToolDef into the canonical Anthropic Messages-API tool
// definition. The output is a 1:1 pass-through into a `tools:[...]` array, so
// "Copy JSON" yields something you can paste straight into messages.create.

import type { ToolDef, ToolJson, ToolParam } from "./types";

/** Folded tool name: `namespace_name` when a namespace is set, else `name`. */
export function fullName(def: ToolDef): string {
  const ns = (def.namespace || "").trim();
  const base = (def.name || "").trim();
  return ns ? `${ns}_${base}` : base;
}

/**
 * Compose the exported description. Anthropic has no response-schema field, so
 * "when to use / when not / returns" guidance lives in the description prose —
 * exactly where the model reads it (writing-tools §descriptions).
 */
export function fullDescription(def: ToolDef): string {
  const parts: string[] = [];
  const base = (def.description || "").trim();
  if (base) parts.push(base);
  const whenToUse = (def.whenToUse || "").trim();
  if (whenToUse) parts.push(`When to use: ${whenToUse}`);
  const whenNotToUse = (def.whenNotToUse || "").trim();
  if (whenNotToUse) parts.push(`When NOT to use: ${whenNotToUse}`);
  const returns = (def.returnsNote || "").trim();
  if (returns) parts.push(`Returns: ${returns}`);
  return parts.join("\n\n");
}

/** Build the JSON Schema for a single parameter. */
function paramSchema(p: ToolParam): Record<string, unknown> {
  const desc = (p.description || "").trim();
  const withDesc = (schema: Record<string, unknown>) =>
    desc ? { ...schema, description: desc } : schema;

  switch (p.type) {
    case "enum":
      return withDesc({ type: "string", enum: p.enumValues ?? [] });
    case "array":
      return withDesc({ type: "array", items: { type: p.itemType ?? "string" } });
    case "object":
      // v1: opaque object placeholder; nested editing / raw-JSON is a v2 item.
      return withDesc({ type: "object" });
    default:
      return withDesc({ type: p.type });
  }
}

/** Build the tool's `input_schema` object from the param rows. */
export function buildInputSchema(def: ToolDef): ToolJson["input_schema"] {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of def.params) {
    const key = (p.key || "").trim();
    if (!key) continue;
    properties[key] = paramSchema(p);
    if (p.required) required.push(key);
  }
  const schema: ToolJson["input_schema"] = { type: "object", properties };
  if (required.length) schema.required = required;
  // Strict tool use requires a closed schema.
  if (def.strict) schema.additionalProperties = false;
  return schema;
}

/** The canonical, API-shaped tool definition. */
export function toToolJson(def: ToolDef): ToolJson {
  const json: ToolJson = {
    name: fullName(def),
    description: fullDescription(def),
    input_schema: buildInputSchema(def),
  };
  if (def.inputExamples && def.inputExamples.length) {
    json.input_examples = def.inputExamples;
  }
  if (def.strict) json.strict = true;
  return json;
}

/** Pretty-printed JSON for the live preview / copy button. */
export function toToolJsonString(def: ToolDef): string {
  return JSON.stringify(toToolJson(def), null, 2);
}
