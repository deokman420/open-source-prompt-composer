import type { CtxState } from "./types";
import { SOURCE_META } from "./types";
import { enabledSources, windowFor, totalAllocated, fmtK } from "./budget";
import { findCtxModel } from "./models";
import { ORCH_PATTERNS } from "@/lib/orchestra/patterns";
import type { OrchState } from "@/lib/orchestra/types";

// Bridge a Context Pipeline plan into an Orchestra seed. The Orchestra `#o=`
// share loader expects a *full* valid OrchState, so we start from the
// orchestrator-worker pattern (the closest fit — a lead that plans within a
// budget) and enrich it with the pipeline's budget, eviction, and handoff
// decisions. Handoff format + shared-memory map directly; the budget table is
// injected into the orchestrator's `context` slot so the planning agent knows
// the token envelope it must work within.

function budgetBlock(ctx: CtxState): string {
  const model = findCtxModel(ctx.model);
  const lines: string[] = [];
  lines.push(`Context budget (from Context Pipeline) — model ${model.label} (${model.id}):`);
  lines.push(`- Window ${fmtK(windowFor(ctx))}; allocated ${fmtK(totalAllocated(ctx))} incl. ${fmtK(ctx.output)} output reserve.`);
  for (const k of enabledSources(ctx)) {
    lines.push(`- ${SOURCE_META[k].name}: ${fmtK(ctx.sources[k].tokens)}`);
  }
  if (ctx.pinnedSlots.length) {
    const pinned = ctx.pinnedSlots.map((p) => `${p.label} (${fmtK(p.tokens)})`).join("; ");
    lines.push(`- Pinned, never evicted: ${pinned}`);
  }
  lines.push(
    `- Eviction trigger: ${ctx.eviction.trigger}${ctx.eviction.trigger === "token_threshold" ? ` @ ${ctx.eviction.threshold}×` : ""}; compaction: ${ctx.compaction.method}.`,
  );
  return lines.join("\n");
}

export function ctxToOrchSeed(ctx: CtxState): OrchState {
  const seed = ORCH_PATTERNS["orchestrator-worker"].seed();

  // Prepend the budget envelope to the lead orchestrator's context.
  const lead = seed.agents.find((a) => a.kind === "orchestrator") ?? seed.agents[0];
  if (lead) {
    lead.slots.context = `${budgetBlock(ctx)}\n\n${lead.slots.context}`.trim();
  }

  // Carry over the decisions the two tools share.
  seed.coordination.handoffFormat = ctx.handoff.format;
  seed.coordination.sharedMemory = ctx.sources.shared_store.enabled;

  return seed;
}
