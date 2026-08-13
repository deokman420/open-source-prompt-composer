"use client";

import FeatureDrafts from "@/app/_shared/FeatureDrafts";
import type { OrchState } from "@/lib/orchestra/types";

/**
 * Orchestra's saved-drafts strip. Thin wrapper over the shared vault-backed
 * component; exists only so OrchestraClient's call site stays as it was.
 */
export default function Drafts({
  onLoad,
  onSaveSignal,
  state,
  title,
  onSaved,
}: {
  onLoad: (s: OrchState) => void;
  onSaveSignal: number;
  state: OrchState;
  title?: string;
  onSaved?: () => void;
}) {
  return (
    <FeatureDrafts<OrchState>
      kind="orchestra"
      state={state}
      title={title}
      onSaveSignal={onSaveSignal}
      onLoad={onLoad}
      onSaved={onSaved}
      snippet={(s) =>
        s.agents.find((a) => a.slots?.goal)?.slots.goal?.slice(0, 60) ||
        `${s.pattern} · ${s.agents.length} agents`
      }
      body={(s) =>
        s.agents
          .map((a) => `${a.name}\n${Object.values(a.slots ?? {}).join("\n")}`)
          .join("\n\n")
      }
    />
  );
}
