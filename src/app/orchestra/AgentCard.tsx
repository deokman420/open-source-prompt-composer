"use client";
import {
  ORCH_AGENT_SLOTS,
  type Agent,
  type AgentModel,
  type AgentSlot,
  type ProviderId,
} from "@/lib/orchestra/types";
import { slotPlaceholder } from "@/lib/orchestra/agent";
import { MODELS } from "@/lib/orchestra/exporters";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini" },
];

export default function AgentCard({
  agent,
  idx,
  onRename,
  onToggleCollapse,
  onDelete,
  onSlot,
  onSetModel,
}: {
  agent: Agent;
  idx: number;
  onRename: (name: string) => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onSlot: (slot: AgentSlot, value: string) => void;
  onSetModel: (model: AgentModel | null) => void;
}) {
  const isLead = agent.kind === "orchestrator";
  const summary = (agent.slots.role || "(no role set)").slice(0, 60);

  function pickProvider(value: string) {
    if (!value) {
      onSetModel(null); // "Export default"
      return;
    }
    const provider = value as ProviderId;
    // Default to the provider's first model when switching providers.
    const stillValid = agent.model?.provider === provider;
    const id = stillValid ? agent.model!.id : MODELS[provider][0].id;
    onSetModel({ provider, id });
  }
  return (
    <div
      className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3"
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
            isLead ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "bg-[var(--bg-card-2)] text-[var(--text-dim)]"
          }`}
        >
          {isLead ? "lead" : "worker"}
        </span>
        <input
          name={`agent-${agent.id}-name`}
          value={agent.name}
          onChange={(e) => onRename(e.target.value)}
          className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          aria-label={`Agent ${idx + 1} name`}
        />
        <span className="hidden text-xs text-[var(--text-dim)] sm:inline">{summary}</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          {agent.collapsed ? "expand ▾" : "collapse ▴"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-[var(--text-muted)] hover:text-[var(--bad)]"
          aria-label={`Delete ${agent.name}`}
          title="Delete agent"
        >
          ✕
        </button>
      </div>

      {/* Per-agent model. Default = "Export default" (no override); pick a
          provider/model to pin this agent. Any pinned agent flips code export
          to the multi-provider router. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">model</span>
        <select
          name={`agent-${agent.id}-provider`}
          value={agent.model?.provider ?? ""}
          onChange={(e) => pickProvider(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
          aria-label={`${agent.name} provider`}
        >
          <option value="">Export default</option>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {agent.model && (
          <select
            name={`agent-${agent.id}-model`}
            value={agent.model.id}
            onChange={(e) => onSetModel({ provider: agent.model!.provider, id: e.target.value })}
            className="rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
            aria-label={`${agent.name} model`}
          >
            {MODELS[agent.model.provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        {agent.model && (
          <button
            type="button"
            onClick={() => onSetModel(null)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
            title="Use the export-time model instead"
          >
            reset
          </button>
        )}
      </div>

      {!agent.collapsed && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {ORCH_AGENT_SLOTS.map((slot) => (
            <div key={slot}>
              <label
                className="block text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
                htmlFor={`agent-${agent.id}-slot-${slot}`}
              >
                {slot}
              </label>
              <textarea
                id={`agent-${agent.id}-slot-${slot}`}
                name={`agent-${agent.id}-slot-${slot}`}
                rows={3}
                value={agent.slots[slot] || ""}
                placeholder={slotPlaceholder(slot)}
                onChange={(e) => onSlot(slot, e.target.value)}
                className="orch-slot mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] p-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                spellCheck
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
