"use client";
import type { Coordination, HandoffFormat } from "@/lib/orchestra/types";

export default function CoordinationCard({
  value,
  onChange,
}: {
  value: Coordination;
  onChange: {
    handoff: (v: HandoffFormat) => void;
    maxWorkers: (v: number) => void;
    termination: (v: string) => void;
    sharedMemory: (v: boolean) => void;
  };
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--text)]" htmlFor="coord-handoff">Handoff format</label>
        <p className="text-[11px] text-[var(--text-muted)]">
          How workers return results to the orchestrator. <strong>Summary</strong> is recommended —
          full transcripts pollute the orchestrator&apos;s context (15× more tokens).
        </p>
        <select
          id="coord-handoff"
          name="coord-handoff"
          value={value.handoffFormat}
          onChange={(e) => onChange.handoff(e.target.value as HandoffFormat)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="summary">summary (recommended)</option>
          <option value="json">structured JSON</option>
          <option value="transcript">full transcript (risky)</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--text)]" htmlFor="coord-max-workers">
          Max workers: <span className="text-[var(--accent)]">{value.maxWorkers}</span>
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">
          Above 4 workers, orchestrator context frequently overflows. Keep tight.
        </p>
        <input
          id="coord-max-workers"
          name="coord-max-workers"
          type="range"
          min={1}
          max={8}
          value={value.maxWorkers}
          onChange={(e) => onChange.maxWorkers(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-[var(--text)]" htmlFor="coord-termination">Termination rule</label>
        <p className="text-[11px] text-[var(--text-muted)]">When does the orchestrator stop and synthesize?</p>
        <textarea
          id="coord-termination"
          name="coord-termination"
          rows={2}
          value={value.terminationRule}
          onChange={(e) => onChange.termination(e.target.value)}
          placeholder='e.g., "Stop when every worker has returned a summary, or after 2 rounds, whichever first."'
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] p-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
        <input
          name="coord-shared-memory"
          type="checkbox"
          checked={value.sharedMemory}
          onChange={(e) => onChange.sharedMemory(e.target.checked)}
        />
        <span>
          Workers write to a <strong>shared memory store</strong> (vs chat-only)
        </span>
      </label>
    </div>
  );
}
