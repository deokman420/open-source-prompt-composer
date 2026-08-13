import type { CtxHealthReport, CtxState, HealthCheck } from "./types";
import { isOverBudget, totalAllocated, windowFor, fmtK } from "./budget";

export function computeCtxHealth(state: CtxState): CtxHealthReport {
  const checks: HealthCheck[] = [];

  // 1. Budget balanced
  const over = isOverBudget(state);
  checks.push({
    label: "Budget balanced",
    pass: !over,
    detail: over
      ? `over by ${fmtK(totalAllocated(state) - windowFor(state))}`
      : `${fmtK(totalAllocated(state))} ≤ ${fmtK(windowFor(state))}`,
  });

  // 2. Pinned slots set
  const slots = state.pinnedSlots.length;
  checks.push({
    label: "Pinned slots set",
    pass: slots >= 1,
    detail: slots >= 1 ? `${slots} slot${slots === 1 ? "" : "s"}` : "none — nothing is protected",
  });

  // 3. Shared store has write rules when enabled
  const sharedOn = state.sources.shared_store.enabled;
  const hasWriteRule =
    state.handoff.writeScratchpad || state.handoff.writeRetrieved || state.handoff.writeFinalAnswer;
  checks.push({
    label: "Shared store",
    pass: !sharedOn || hasWriteRule,
    detail: !sharedOn ? "off" : hasWriteRule ? "write rules set" : "on, but nothing writes to it",
  });

  // 4. Handoff sane (adapted: warn on transcript)
  const fmt = state.handoff.format;
  checks.push({
    label: "Handoff format",
    pass: fmt === "summary" || fmt === "json",
    detail: fmt === "transcript" ? "transcript bloats the next context" : fmt,
  });

  // 5. Retrieval budget (adapted: retrieved on must have a budget)
  const retrieved = state.sources.retrieved;
  checks.push({
    label: "Retrieval budget",
    pass: !retrieved.enabled || retrieved.tokens > 0,
    detail: !retrieved.enabled
      ? "off"
      : retrieved.tokens > 0
      ? `${fmtK(retrieved.tokens)} allocated`
      : "on, but 0 tokens allocated",
  });

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  return { passed, total, score: Math.round((passed / total) * 100), checks };
}
