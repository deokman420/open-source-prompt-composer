import { ORCH_AGENT_SLOTS, type Agent, type OrchState, type ProviderId } from "./types";

const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

export function escXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBundleMd(s: OrchState): string {
  const parts: string[] = [];
  parts.push(`# ORCHESTRA · pattern: ${s.pattern}`);
  for (const agent of s.agents) {
    const tag = agent.kind === "orchestrator" ? "ORCHESTRATOR" : "WORKER";
    parts.push(`---\n\n## ${tag} — ${agent.name}`);
    if (agent.model) {
      parts.push(`### MODEL\n${PROVIDER_LABEL[agent.model.provider]} · ${agent.model.id}`);
    }
    for (const slot of ORCH_AGENT_SLOTS) {
      const v = (agent.slots[slot] || "").trim();
      if (!v) continue;
      parts.push(`### ${slot.toUpperCase()}\n${v}`);
    }
  }
  parts.push(
    `---\n\n## COORDINATION\n- Handoff format: ${s.coordination.handoffFormat}\n- Max workers: ${s.coordination.maxWorkers}\n- Shared memory: ${s.coordination.sharedMemory ? "yes" : "no (chat only)"}\n- Termination: ${s.coordination.terminationRule || "(not set)"}`,
  );
  return parts.join("\n\n");
}

export function renderBundleXml(s: OrchState): string {
  const parts: string[] = [`<orchestra pattern="${escXml(s.pattern)}">`];
  for (const agent of s.agents) {
    const modelAttr = agent.model
      ? ` provider="${escXml(agent.model.provider)}" model="${escXml(agent.model.id)}"`
      : "";
    parts.push(`  <agent kind="${escXml(agent.kind)}" name="${escXml(agent.name)}"${modelAttr}>`);
    for (const slot of ORCH_AGENT_SLOTS) {
      const v = (agent.slots[slot] || "").trim();
      if (!v) continue;
      parts.push(`    <${slot}>${escXml(v)}</${slot}>`);
    }
    parts.push(`  </agent>`);
  }
  parts.push(`  <coordination>`);
  parts.push(`    <handoff_format>${escXml(s.coordination.handoffFormat)}</handoff_format>`);
  parts.push(`    <max_workers>${s.coordination.maxWorkers}</max_workers>`);
  parts.push(`    <shared_memory>${s.coordination.sharedMemory}</shared_memory>`);
  parts.push(`    <termination_rule>${escXml(s.coordination.terminationRule || "")}</termination_rule>`);
  parts.push(`  </coordination>`);
  parts.push(`</orchestra>`);
  return parts.join("\n");
}

export function agentSystemPrompt(agent: Agent): string {
  const lines: string[] = [];
  for (const slot of ORCH_AGENT_SLOTS) {
    const v = (agent.slots[slot] || "").trim();
    if (!v) continue;
    lines.push(`## ${slot.toUpperCase()}\n${v}`);
  }
  return lines.join("\n\n") || `(empty system prompt for ${agent.name || agent.kind})`;
}
