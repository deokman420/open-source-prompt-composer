import { SOURCE_KEYS, type CtxState, type SourceKey } from "./types";
import { modelWindow } from "./models";

export function enabledSources(state: CtxState): SourceKey[] {
  return SOURCE_KEYS.filter((k) => state.sources[k].enabled);
}

// Sum of enabled per-source allocations + the output reserve.
export function totalAllocated(state: CtxState): number {
  const sources = enabledSources(state).reduce((sum, k) => sum + state.sources[k].tokens, 0);
  return sources + state.output;
}

export function windowFor(state: CtxState): number {
  return modelWindow(state.model);
}

export function headroom(state: CtxState): number {
  return windowFor(state) - totalAllocated(state);
}

export function isOverBudget(state: CtxState): boolean {
  return totalAllocated(state) > windowFor(state);
}

export function fmtK(tokens: number): string {
  if (Math.abs(tokens) >= 1000) {
    const k = tokens / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${tokens}`;
}
