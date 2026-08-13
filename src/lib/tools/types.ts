// Agent Tool Builder — domain types. A ToolDef is the editable, UI-friendly
// shape; the serializer (./serialize) projects it into the canonical Anthropic
// Messages-API tool definition ({name, description, input_schema, ...}). Stored
// verbatim in the generic `drafts` table under kind="tool".

export const PARAM_TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "enum",
] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

// Scalar item types offered for array params (v1 supports arrays of scalars;
// arrays-of-objects are a v2 raw-JSON escape hatch).
export const ARRAY_ITEM_TYPES = ["string", "number", "integer", "boolean"] as const;
export type ArrayItemType = (typeof ARRAY_ITEM_TYPES)[number];

export interface ToolParam {
  id?: string; // stable React key; never serialized into the tool JSON
  key: string; // JSON Schema property name
  type: ParamType;
  description: string;
  required: boolean;
  enumValues?: string[]; // when type === "enum"
  itemType?: ArrayItemType; // when type === "array"
}

export interface ToolDef {
  name: string; // must match ^[a-zA-Z0-9_-]{1,64}$ after namespace folding
  namespace?: string; // optional prefix; folded into name on export (namespace_name)
  description: string;
  params: ToolParam[];
  inputExamples?: Record<string, unknown>[]; // optional; each must validate vs input_schema
  strict?: boolean;
  // Optional richness (Alex reference) — folded into the exported description:
  whenToUse?: string;
  whenNotToUse?: string;
  returnsNote?: string;
}

export interface ToolState {
  tool: ToolDef;
}

// The canonical, API-shaped tool definition produced by the serializer.
export interface ToolJson {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  input_examples?: Record<string, unknown>[];
  strict?: boolean;
}

// Anthropic hard constraint (define-tools API reference).
export const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;
// JSON Schema property name we accept in the builder (identifier-ish, keeps
// generated code/examples sane). Stricter than JSON Schema allows by design.
export const PARAM_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
