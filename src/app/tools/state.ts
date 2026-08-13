"use client";
import { blankState } from "@/lib/tools/templates";
import type { ParamType, ToolDef, ToolParam, ToolState } from "@/lib/tools/types";

// Text fields on ToolDef that are edited as plain strings.
export type ToolMetaField =
  | "name"
  | "namespace"
  | "description"
  | "whenToUse"
  | "whenNotToUse"
  | "returnsNote";

export type ToolAction =
  | { type: "load"; state: ToolState }
  | { type: "newBlank" }
  | { type: "setMeta"; field: ToolMetaField; value: string }
  | { type: "setStrict"; value: boolean }
  | { type: "addParam" }
  | { type: "deleteParam"; idx: number }
  | { type: "setParam"; idx: number; patch: Partial<ToolParam> };

function pid(): string {
  return Math.random().toString(36).slice(2);
}

function newParam(): ToolParam {
  return { id: pid(), key: "", type: "string", description: "", required: false };
}

// Ensure every param has a stable id (templates and restored drafts may lack
// one). Used on every `load` so React keys stay stable across edits/deletes.
function withParamIds(state: ToolState): ToolState {
  return {
    ...state,
    tool: {
      ...state.tool,
      params: state.tool.params.map((p) => (p.id ? p : { ...p, id: pid() })),
    },
  };
}

// When the type changes, drop type-specific fields that no longer apply and
// seed the ones that the new type needs.
function normalizeForType(p: ToolParam, type: ParamType): ToolParam {
  const next: ToolParam = { ...p, type };
  if (type !== "enum") delete next.enumValues;
  else if (!next.enumValues) next.enumValues = [];
  if (type !== "array") delete next.itemType;
  else if (!next.itemType) next.itemType = "string";
  return next;
}

export function toolReducer(state: ToolState, action: ToolAction): ToolState {
  switch (action.type) {
    case "load":
      return withParamIds(action.state);
    case "newBlank":
      return blankState();
    case "setMeta":
      return { ...state, tool: { ...state.tool, [action.field]: action.value } };
    case "setStrict":
      return { ...state, tool: { ...state.tool, strict: action.value } };
    case "addParam":
      return { ...state, tool: { ...state.tool, params: [...state.tool.params, newParam()] } };
    case "deleteParam":
      return {
        ...state,
        tool: { ...state.tool, params: state.tool.params.filter((_, i) => i !== action.idx) },
      };
    case "setParam": {
      const params = state.tool.params.map((p, i) => {
        if (i !== action.idx) return p;
        const patched = { ...p, ...action.patch };
        return action.patch.type ? normalizeForType(patched, action.patch.type) : patched;
      });
      return { ...state, tool: { ...state.tool, params } };
    }
  }
}

export function hasAnyContent(s: ToolState): boolean {
  const t = s.tool;
  return Boolean(
    (t.name && t.name.trim()) ||
      (t.description && t.description.trim()) ||
      t.params.some((p) => p.key.trim() || p.description.trim()),
  );
}

export function initialState(): ToolState {
  return blankState();
}

export type { ToolDef };
