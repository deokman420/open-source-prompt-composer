import type { HealthReport, OrchState } from "./types";

function simpleOverlap(a: string, b: string): number {
  const wa = new Set(a.split(/\W+/).filter((w) => w.length > 4));
  const wb = new Set(b.split(/\W+/).filter((w) => w.length > 4));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

export function computeHealth(s: OrchState): HealthReport {
  const issues: string[] = [];
  const oks: string[] = [];
  let score = 0;

  const orchAgents = s.agents.filter((a) => a.kind === "orchestrator");
  const workers = s.agents.filter((a) => a.kind === "worker");

  if (orchAgents.length === 1) {
    score += 10;
    oks.push("exactly one lead agent");
  } else if (orchAgents.length === 0) {
    issues.push("no orchestrator/lead agent defined");
  } else {
    issues.push(`${orchAgents.length} orchestrators — pick one lead`);
  }

  if (workers.length >= 1) {
    score += 5;
    oks.push(`${workers.length} worker${workers.length === 1 ? "" : "s"} defined`);
  } else {
    issues.push("no workers defined");
  }

  const incomplete = s.agents.filter(
    (a) => !a.slots.role.trim() || !a.slots.goal.trim(),
  );
  if (incomplete.length === 0) {
    score += 15;
    oks.push("every agent has role + goal");
  } else {
    issues.push(`${incomplete.length} agent(s) missing role or goal`);
  }

  const unbounded = workers.filter((w) => !w.slots.bounds.trim());
  if (workers.length && unbounded.length === 0) {
    score += 10;
    oks.push("every worker has bounds");
  } else if (unbounded.length) {
    issues.push(`${unbounded.length} worker(s) have no bounds — scope creep risk`);
  }

  const noFormat = workers.filter((w) => !w.slots.format.trim());
  if (workers.length && noFormat.length === 0) {
    score += 10;
    oks.push("every worker has output format");
  } else if (noFormat.length) {
    issues.push(
      `${noFormat.length} worker(s) have no output format — handoff will be ambiguous`,
    );
  }

  const lead = orchAgents[0];
  if (lead) {
    const blob = (lead.slots.bounds + " " + lead.slots.role + " " + lead.slots.goal).toLowerCase();
    if (/(delegate|don'?t do|don'?t execute|never perform|never execute)/.test(blob)) {
      score += 10;
      oks.push("lead is told to delegate, not do");
    } else {
      issues.push('lead has no "delegate, don\'t do" rule');
    }
  }

  if (s.coordination.handoffFormat === "summary" || s.coordination.handoffFormat === "json") {
    score += 10;
    oks.push(`handoff = ${s.coordination.handoffFormat} (avoids context bloat)`);
  } else {
    issues.push("handoff = transcript — orchestrator context will bloat fast");
  }

  if (workers.length <= 5) {
    score += 10;
    oks.push(`worker count ${workers.length} ≤ 5 (context-safe)`);
  } else {
    issues.push(`${workers.length} workers — context overflow likely above 4–5`);
  }

  const overlaps: string[] = [];
  for (let i = 0; i < workers.length; i++) {
    for (let j = i + 1; j < workers.length; j++) {
      const a = (workers[i].slots.role || "").toLowerCase();
      const b = (workers[j].slots.role || "").toLowerCase();
      if (a.length > 20 && b.length > 20 && simpleOverlap(a, b) > 0.6) {
        overlaps.push(`"${workers[i].name}" ≈ "${workers[j].name}"`);
      }
    }
  }
  if (workers.length >= 2 && overlaps.length === 0) {
    score += 10;
    oks.push("no overlapping worker roles");
  } else if (overlaps.length) {
    issues.push("overlapping roles: " + overlaps.join(", "));
  }

  if ((s.coordination.terminationRule || "").trim().length >= 10) {
    score += 10;
    oks.push("explicit termination rule");
  } else {
    issues.push("no termination rule — agents may loop");
  }

  return { score: Math.min(100, score), issues, oks };
}

export function estimateTokens(text: string): number {
  return Math.max(0, Math.round(text.length / 4));
}
